-- ============================================================
-- seed_demo_rich.sql: 발표 · 시연용 데모 데이터 보강 (SafeStep 강남점)
--
-- 원장/강사 데모 계정이 보는 화면(대시보드 KPI, 출석부, 공지 · 알림 현황)이
-- 비어 보이지 않도록 학생 5명과 최근 3주치 출결 · 학습 기록을 넣습니다.
--   - 학생: 김서연 · 박지훈 · 이하은 · 최민준 · 정예린 (출결코드 2100xx)
--   - 모두 "중3 수학 데모반"에 배정 (홍길동 포함 6명)
--   - 반 수업일(월 · 수) 기준 출석 / 지각 / 결석 / 사유결석 기록
--     (지각 · 결석은 보호자 알림 발송됨으로 표시 → 대시보드 "출결 알림" 탭에 표시)
--   - 키오스크 퇴실 기록(학습시간) → 대시보드 "총 학습시간"
--   - 데모 기간권(시연용, 0원) → 키오스크 입실 시연 가능
--
-- 선행: schema.sql, seed.sql, seed_demo_accounts.mjs(데모반 생성), migration_18.
-- 여러 번 실행해도 안전합니다 (같은 학생 · 같은 날짜 기록은 건너뜀).
-- 지우려면 맨 아래 "되돌리기" 주석을 참고하세요.
-- ============================================================

DO $$
DECLARE
  v_academy UUID;
  v_class UUID;
  v_teacher UUID;
  v_day DATE;
  v_student RECORD;
  v_status TEXT;
  v_i INT := 0;
BEGIN
  SELECT id INTO v_academy FROM academies WHERE name = 'SafeStep 강남점';
  IF v_academy IS NULL THEN RAISE EXCEPTION 'SafeStep 강남점이 없습니다. seed.sql 을 먼저 실행하세요.'; END IF;
  SELECT id, teacher_id INTO v_class, v_teacher FROM classes WHERE academy_id = v_academy AND name = '중3 수학 데모반';
  IF v_class IS NULL THEN RAISE EXCEPTION '중3 수학 데모반이 없습니다. seed_demo_accounts.mjs 를 먼저 실행하세요.'; END IF;

  -- 1) 학생 5명
  INSERT INTO students (academy_id, name, attendance_code, parent_phone)
  SELECT v_academy, n.name, n.code, n.phone
  FROM (VALUES
    ('김서연', '210001', '010-2100-0001'),
    ('박지훈', '210002', '010-2100-0002'),
    ('이하은', '210003', '010-2100-0003'),
    ('최민준', '210004', '010-2100-0004'),
    ('정예린', '210005', '010-2100-0005')
  ) AS n(name, code, phone)
  ON CONFLICT ON CONSTRAINT unique_academy_attendance_code DO NOTHING;

  -- 2) 데모반 배정 (홍길동 포함)
  INSERT INTO class_enrollments (class_id, student_id)
  SELECT v_class, s.id FROM students s
  WHERE s.academy_id = v_academy AND (s.attendance_code LIKE '2100%' OR s.name = '홍길동')
  ON CONFLICT ON CONSTRAINT unique_class_student DO NOTHING;

  -- 3) 최근 3주 월 · 수요일 출결 (오늘 이전 날짜만)
  FOR v_day IN
    SELECT d::date FROM generate_series(CURRENT_DATE - 21, CURRENT_DATE - 1, INTERVAL '1 day') d
    WHERE EXTRACT(ISODOW FROM d) IN (1, 3)
  LOOP
    FOR v_student IN
      SELECT s.id, row_number() OVER (ORDER BY s.attendance_code) AS rn
      FROM students s JOIN class_enrollments ce ON ce.student_id = s.id
      WHERE ce.class_id = v_class
    LOOP
      v_i := v_i + 1;
      -- 대부분 출석, 일부 지각 · 결석 · 사유결석이 섞이도록
      v_status := CASE
        WHEN (v_i % 11) = 3 THEN 'LATE'
        WHEN (v_i % 17) = 5 THEN 'ABSENT'
        WHEN (v_i % 23) = 7 THEN 'EXCUSED'
        ELSE 'PRESENT' END;
      INSERT INTO class_attendance_records (academy_id, class_id, student_id, date, status, reason, alert_sent, recorded_by, recorded_at)
      VALUES (
        v_academy, v_class, v_student.id, v_day, v_status,
        CASE v_status WHEN 'EXCUSED' THEN '병원 진료' WHEN 'LATE' THEN NULL ELSE NULL END,
        v_status IN ('LATE', 'ABSENT'),
        v_teacher,
        (v_day + TIME '16:12') AT TIME ZONE 'Asia/Seoul'
      )
      ON CONFLICT ON CONSTRAINT unique_daily_class_attendance DO NOTHING;
    END LOOP;
  END LOOP;

  -- 4) 학습시간: 최근 2주 키오스크 퇴실 기록 (학생별 하루 1~3시간)
  INSERT INTO attendance_logs (academy_id, student_id, seat_number, type, check_method, logged_at, stay_duration_minutes, notification_status)
  SELECT v_academy, s.id, 10 + (row_number() OVER ()) % 30, 'CHECK_OUT', 'QR',
         (d::date + TIME '21:00') AT TIME ZONE 'Asia/Seoul', 60 + ((EXTRACT(DOY FROM d)::INT * 7 + length(s.name) * 13) % 121), 'SENT'
  FROM students s
  CROSS JOIN generate_series(CURRENT_DATE - 14, CURRENT_DATE - 1, INTERVAL '1 day') d
  WHERE s.academy_id = v_academy AND s.attendance_code LIKE '2100%'
    AND EXTRACT(ISODOW FROM d) <= 5
    AND NOT EXISTS (
      SELECT 1 FROM attendance_logs l
      WHERE l.student_id = s.id AND l.type = 'CHECK_OUT' AND l.logged_at::date = d::date
    );
END $$;

-- 5) 키오스크 입실 시연용 데모 이용권 (기간권, 1년) — 이용권이 없으면 키오스크 입실이 막히므로
--    결제 없이도 데모 학생(홍길동 포함)이 입실할 수 있게 함. migration_07(또는 20) 적용 후에만 동작.
DO $$
BEGIN
  IF to_regclass('public.student_passes') IS NULL THEN
    RAISE NOTICE 'student_passes 테이블이 없어 데모 이용권은 건너뜁니다 (migration_20 먼저 실행).';
    RETURN;
  END IF;
  INSERT INTO student_passes (academy_id, student_id, pass_type, product_name, expires_at, status, order_id, amount)
  SELECT s.academy_id, s.id, 'PERIOD', '데모 기간권(시연용)', NOW() + INTERVAL '1 year', 'ACTIVE', 'demo-pass-' || s.id, 0
  FROM students s
  WHERE s.academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
    AND (s.attendance_code LIKE '2100%' OR s.name = '홍길동')
  ON CONFLICT (order_id) DO NOTHING;
END $$;

-- 되돌리기 (필요할 때만 실행):
-- DELETE FROM students WHERE attendance_code LIKE '2100%'
--   AND academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점');
--   (학생을 지우면 그 학생의 반 배정 · 출결 · 학습 기록도 함께 삭제됩니다)
