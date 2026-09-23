-- ============================================================
-- SafeStep - 원장 등록 코드 "배정" (승인 대기 원장에게 알림으로 전달)
-- schema.sql + migration_02_owner_invites_seat_admin.sql 적용 후 실행하세요.
--
-- 기존에는 슈퍼관리자가 코드를 화면에서 확인해 오프라인(카톡/문자 등)으로
-- 원장에게 직접 전달해야 했습니다. 이제 슈퍼관리자가 "승인 대기 원장" 목록에서
-- 특정 원장을 지정해 학원+코드를 발급하면, 그 원장 본인이 /owner/claim 페이지에서
-- 자신에게 배정된 코드를 알림처럼 바로 확인할 수 있습니다.
--
-- ⚠️ 보안: 추가하는 RLS 정책은 "내게 배정되고 아직 사용되지 않은 초대"만 읽을 수
-- 있게 제한합니다. academy_owner_invites 전체를 공개하지 않으므로 기존 보안 설계
-- (SUPABASE_SERVICE_ROLE_KEY로만 전체 접근) 는 그대로 유지됩니다.
-- ============================================================

ALTER TABLE academy_owner_invites
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_owner_invites_assigned
  ON academy_owner_invites(assigned_user_id)
  WHERE used_at IS NULL;

CREATE POLICY "Owner Invites Assigned Read" ON academy_owner_invites
    FOR SELECT TO authenticated
    USING (assigned_user_id = auth.uid() AND used_at IS NULL);
