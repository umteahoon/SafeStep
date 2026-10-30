-- ============================================================
-- migration_21_demo_daily_reset.sql: 체험(데모) 학원 데이터 하루 1번 자동 초기화
--
-- 원장 · 강사 · 학부모 체험은 누구나 로그인 없이 들어오는 공용 계정이라
-- 방문자가 학생을 지우거나 반 · 공지를 만들면 다음 사람에게 그대로 보입니다.
-- reset_demo_academy() 가 SafeStep 강남점 데모 데이터를 기준 상태로 되돌리고,
-- 출결 · 학습 기록은 "오늘 기준 최근 3주"로 다시 만들어 늘 최신처럼 보이게 합니다.
--
-- 호출: 백엔드 POST /api/auth/demo-login 이 체험 접속 때마다 부르고,
--       함수가 마지막 초기화 후 20시간이 안 지났으면 바로 끝냅니다. (서버가 잠들어 있어도 동작)
-- 실행 권한: service_role 만 (방문자가 직접 부를 수 없음)
-- 선행: seed.sql, seed_demo_accounts.mjs, seed_demo_rich.sql, migration_19, migration_20
-- ============================================================

CREATE TABLE IF NOT EXISTS demo_reset_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- 이 시각 이전에 데모 계정이 쓴 메시지(예시 공지)는 기준 데이터로 보고 남김
  baseline_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reset_at TIMESTAMPTZ
);
INSERT INTO demo_reset_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE demo_reset_state ENABLE ROW LEVEL SECURITY; -- 정책 없음 = 방문자 접근 불가

CREATE OR REPLACE FUNCTION reset_demo_academy(p_force BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state demo_reset_state;
  v_academy UUID;
  v_class UUID;
  v_teacher UUID;
  v_parent UUID;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::date;
  v_day DATE;
  v_student RECORD;
  v_status TEXT;
  v_i INT := 0;
BEGIN
  SELECT * INTO v_state FROM demo_reset_state WHERE id = 1 FOR UPDATE;
  IF NOT p_force AND v_state.last_reset_at IS NOT NULL
     AND v_state.last_reset_at > NOW() - INTERVAL '20 hours' THEN
    RETURN 'skipped';
  END IF;

  SELECT id INTO v_academy FROM academies WHERE name = 'SafeStep 강남점';
  IF v_academy IS NULL THEN RETURN 'no demo academy'; END IF;
  SELECT id INTO v_teacher FROM profiles WHERE email = 'demo-teacher@safestep.local';
  SELECT id INTO v_parent FROM profiles WHERE email = 'demo-parent@safestep.local';

  -- 1) 반: 데모반만 남기고(방문자가 만든 반 삭제), 데모반이 지워졌으면 다시 만듦
  DELETE FROM classes WHERE academy_id = v_academy AND name <> '중3 수학 데모반';
  SELECT id INTO v_class FROM classes WHERE academy_id = v_academy AND name = '중3 수학 데모반';
  IF v_class IS NULL THEN
    INSERT INTO classes (academy_id, teacher_id, name, color_code)
    VALUES (v_academy, v_teacher, '중3 수학 데모반', '#3B82F6') RETURNING id INTO v_class;
    INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time)
    VALUES (v_class, 1, '16:00', '18:00'), (v_class, 3, '16:00', '18:00');
  END IF;

  -- 2) 학생: 기준 6명만 남기고(방문자가 추가한 학생 삭제 — 출결 · 기록도 함께 삭제됨), 빠진 학생은 다시 추가
  DELETE FROM students
   WHERE academy_id = v_academy
     AND attendance_code NOT IN ('111111', '210001', '210002', '210003', '210004', '210005');
  INSERT INTO students (academy_id, name, attendance_code, parent_phone)
  SELECT v_academy, n.name, n.code, n.phone
  FROM (VALUES
    ('홍길동', '111111', '010-1234-5678'),
    ('김서연', '210001', '010-2100-0001'),
    ('박지훈', '210002', '010-2100-0002'),
    ('이하은', '210003', '010-2100-0003'),
    ('최민준', '210004', '010-2100-0004'),
    ('정예린', '210005', '010-2100-0005')
  ) AS n(name, code, phone)
  ON CONFLICT ON CONSTRAINT unique_academy_attendance_code DO NOTHING;
  UPDATE students SET status = 'ACTIVE'
   WHERE academy_id = v_academy AND status IS DISTINCT FROM 'ACTIVE';

  INSERT INTO class_enrollments (class_id, student_id)
  SELECT v_class, s.id FROM students s WHERE s.academy_id = v_academy
  ON CONFLICT ON CONSTRAINT unique_class_student DO NOTHING;

  -- 3) 학부모 체험 계정: 홍길동 · 김서연 · 박지훈의 보호자, 나머지는 미연동
  UPDATE students
     SET parent_user_id = CASE WHEN name IN ('홍길동', '김서연', '박지훈') THEN v_parent END
   WHERE academy_id = v_academy;

  -- 4) 출결 · 학습 기록: 전부 지우고 오늘 기준 최근 3주로 다시 생성 (오늘 출석부는 비워 둠)
  DELETE FROM class_attendance_records WHERE academy_id = v_academy;
  DELETE FROM absence_requests WHERE academy_id = v_academy;
  DELETE FROM attendance_logs WHERE academy_id = v_academy;

  FOR v_day IN
    SELECT d::date FROM generate_series(v_today - 21, v_today - 1, INTERVAL '1 day') d
    WHERE EXTRACT(ISODOW FROM d) IN (1, 3)
  LOOP
    FOR v_student IN
      SELECT s.id FROM students s JOIN class_enrollments ce ON ce.student_id = s.id
      WHERE ce.class_id = v_class ORDER BY s.attendance_code
    LOOP
      v_i := v_i + 1;
      v_status := CASE
        WHEN (v_i % 11) = 3 THEN 'LATE'
        WHEN (v_i % 17) = 5 THEN 'ABSENT'
        WHEN (v_i % 23) = 7 THEN 'EXCUSED'
        ELSE 'PRESENT' END;
      INSERT INTO class_attendance_records (academy_id, class_id, student_id, date, status, reason, alert_sent, recorded_by, recorded_at)
      VALUES (v_academy, v_class, v_student.id, v_day, v_status,
              CASE WHEN v_status = 'EXCUSED' THEN '병원 진료' END,
              v_status IN ('LATE', 'ABSENT'), v_teacher,
              (v_day + TIME '16:12') AT TIME ZONE 'Asia/Seoul');
    END LOOP;
  END LOOP;

  INSERT INTO attendance_logs (academy_id, student_id, seat_number, type, check_method, logged_at, stay_duration_minutes, notification_status)
  SELECT v_academy, s.id, 10 + (row_number() OVER ()) % 30, 'CHECK_OUT', 'QR',
         (d::date + TIME '21:00') AT TIME ZONE 'Asia/Seoul',
         60 + ((EXTRACT(DOY FROM d)::INT * 7 + length(s.name) * 13) % 121), 'SENT'
  FROM students s
  CROSS JOIN generate_series(v_today - 14, v_today - 1, INTERVAL '1 day') d
  WHERE s.academy_id = v_academy AND s.attendance_code LIKE '2100%'
    AND EXTRACT(ISODOW FROM d) <= 5;

  -- 5) 키오스크 입실 시연용 데모 이용권
  INSERT INTO student_passes (academy_id, student_id, pass_type, product_name, expires_at, status, order_id, amount)
  SELECT s.academy_id, s.id, 'PERIOD', '데모 기간권(시연용)', NOW() + INTERVAL '1 year', 'ACTIVE', 'demo-pass-' || s.id, 0
  FROM students s WHERE s.academy_id = v_academy
  ON CONFLICT (order_id) DO UPDATE SET status = 'ACTIVE', expires_at = EXCLUDED.expires_at;

  -- 6) 방문자가 체험 계정으로 보낸 메시지 · 공지 삭제 (기준 시각 이전의 예시 공지는 유지)
  DELETE FROM chat_messages m
   USING profiles p
   WHERE m.sender_id = p.id
     AND p.email LIKE 'demo-%@safestep.local'
     AND m.created_at > v_state.baseline_at;

  -- 7) 좌석: 이용 중 표시를 비움 (방문자가 키오스크로 입실해 둔 자리)
  UPDATE seats SET status = 'EMPTY', current_student_id = NULL, occupied_at = NULL, away_at = NULL
   WHERE academy_id = v_academy AND current_student_id IS NOT NULL;

  UPDATE demo_reset_state SET last_reset_at = NOW() WHERE id = 1;
  RETURN 'reset';
END;
$$;

REVOKE ALL ON FUNCTION reset_demo_academy(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_demo_academy(BOOLEAN) TO service_role;

-- 확인 (바로 한 번 초기화):  SELECT reset_demo_academy(TRUE);
