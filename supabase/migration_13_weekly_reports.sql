-- ============================================================
-- SafeStep - 주간 학습 리포트 저장
-- 기존 프로젝트에서 SQL Editor로 1회 실행하세요.
--
-- backend/src/cron/weeklyReport.ts 가 매주 일요일 21:00에 학생별 출석률·학습시간을
-- 계산해 이 테이블에 upsert 합니다. 쓰기는 백엔드(service role)만 하고, 조회는
-- 같은 학원 승인 직원과 해당 학생·보호자만 가능합니다.
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    attendance_rate INT,
    study_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_weekly_report UNIQUE (student_id, week_start)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Weekly Reports Staff Read" ON weekly_reports;
CREATE POLICY "Weekly Reports Staff Read" ON weekly_reports
    FOR SELECT TO authenticated
    USING (is_approved_staff_of(academy_id));

DROP POLICY IF EXISTS "Weekly Reports Student Parent Read" ON weekly_reports;
CREATE POLICY "Weekly Reports Student Parent Read" ON weekly_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = weekly_reports.student_id
              AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
        )
    );
