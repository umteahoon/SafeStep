-- ============================================================
-- migration_15: 원장 → 강사 → 학생 초대 구조 + 학생 출석 버튼
--  1) academy_teacher_invites : 원장이 발급하는 "강사 초대 코드" (학원당 1개, 재발급 가능)
--  2) student_check_in(class)  : 학생이 수업 시간대에만 본인 출석을 직접 기록 (SECURITY DEFINER)
-- 기존 프로젝트에 한 번만 실행하세요. (신규 프로젝트는 schema.sql 이후 이어서 실행)
-- ============================================================

-- 1) 강사 초대 코드 ----------------------------------------------------
-- academies 는 지도용으로 공개 읽기라 코드를 거기 두면 노출되므로 별도 테이블로 분리.
-- RLS 를 켜고 정책을 두지 않아 service role(백엔드)만 접근 가능.
CREATE TABLE IF NOT EXISTS academy_teacher_invites (
    academy_id UUID PRIMARY KEY REFERENCES academies(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE academy_teacher_invites ENABLE ROW LEVEL SECURITY;

-- 2) 학생 출석 버튼 ----------------------------------------------------
-- 규칙: 본인 계정에 연동된 학생이, 오늘(KST) 시간표가 있는 본인 반에 대해,
--       수업 시작 30분 전 ~ 종료 사이에만, 하루 1회 기록할 수 있다.
--       시작 후 10분(LATE_GRACE)을 넘기면 LATE, 아니면 PRESENT.
--       이미 기록(강사가 처리한 것 포함)이 있으면 덮어쓰지 않고 그 상태를 그대로 돌려준다.
CREATE OR REPLACE FUNCTION student_check_in(p_class_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student   students%ROWTYPE;
    v_class     classes%ROWTYPE;
    v_now       TIMESTAMP := (NOW() AT TIME ZONE 'Asia/Seoul');
    v_today     DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
    v_dow       INT := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Seoul'))::INT;
    v_sched     class_schedules%ROWTYPE;
    v_start     TIMESTAMP;
    v_end       TIMESTAMP;
    v_existing  class_attendance_records%ROWTYPE;
    v_status    TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT * INTO v_student FROM students WHERE user_id = auth.uid() AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION '학원에 연동된 학생 계정이 아닙니다.';
    END IF;

    SELECT * INTO v_class FROM classes WHERE id = p_class_id AND academy_id = v_student.academy_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '내 학원의 반이 아닙니다.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM class_enrollments WHERE class_id = p_class_id AND student_id = v_student.id) THEN
        RAISE EXCEPTION '이 반에 배정되어 있지 않습니다.';
    END IF;

    SELECT * INTO v_existing FROM class_attendance_records
     WHERE class_id = p_class_id AND student_id = v_student.id AND date = v_today;
    IF FOUND THEN
        RETURN jsonb_build_object('status', v_existing.status, 'already', TRUE, 'class_id', p_class_id, 'date', v_today);
    END IF;

    SELECT * INTO v_sched FROM class_schedules WHERE class_id = p_class_id AND day_of_week = v_dow
     ORDER BY start_time LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION '오늘은 이 반의 수업이 없습니다.';
    END IF;

    v_start := v_today + v_sched.start_time;
    v_end   := v_today + v_sched.end_time;
    IF v_now < v_start - INTERVAL '30 minutes' THEN
        RAISE EXCEPTION '아직 출석할 수 있는 시간이 아닙니다. (수업 30분 전부터 가능)';
    END IF;
    IF v_now > v_end THEN
        RAISE EXCEPTION '수업이 이미 끝났습니다.';
    END IF;

    v_status := CASE WHEN v_now > v_start + INTERVAL '10 minutes' THEN 'LATE' ELSE 'PRESENT' END;

    INSERT INTO class_attendance_records (academy_id, class_id, student_id, date, status, note, recorded_by)
    VALUES (v_student.academy_id, p_class_id, v_student.id, v_today, v_status, '학생 출석 버튼', auth.uid());

    RETURN jsonb_build_object('status', v_status, 'already', FALSE, 'class_id', p_class_id, 'date', v_today);
END;
$$;

REVOKE ALL ON FUNCTION student_check_in(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_check_in(UUID) TO authenticated;
