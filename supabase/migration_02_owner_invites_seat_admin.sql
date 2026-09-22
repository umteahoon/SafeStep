-- ============================================================
-- SafeStep migration 02 — 원장 초대코드 온보딩 + 좌석 관제 도구
-- 이미 schema.sql(+seed) 을 실행한 프로젝트에서 SQL Editor로 추가 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1. academy_owner_invites — 슈퍼관리자가 지점 생성 시 발급하는 8자리 등록 코드
--    ⚠️ 의도적으로 RLS 정책을 하나도 만들지 않습니다.
--       academies 처럼 공개 읽기 정책을 두면 코드가 그대로 노출되므로,
--       SUPABASE_SERVICE_ROLE_KEY(백엔드)로만 접근 가능해야 합니다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academy_owner_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL UNIQUE,
    used_by UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE academy_owner_invites ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. seats: 원장/승인 강사가 좌석을 추가·삭제할 수 있도록 (도면 에디터용)
--    기존에는 UPDATE만 허용돼 있었음
-- ------------------------------------------------------------
CREATE POLICY "Seats Staff Insert" ON seats
    FOR INSERT TO authenticated
    WITH CHECK (is_approved_staff_of(academy_id));

CREATE POLICY "Seats Staff Delete" ON seats
    FOR DELETE TO authenticated
    USING (is_approved_staff_of(academy_id));

-- ------------------------------------------------------------
-- 3. seat_reports: 처리 상태 컬럼 + 직원 처리 권한
-- ------------------------------------------------------------
ALTER TABLE seat_reports ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE seat_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE POLICY "Seat Reports Staff Update" ON seat_reports
    FOR UPDATE TO authenticated
    USING (is_approved_staff_of(academy_id));

-- ============================================================
-- 끝.
-- ============================================================
