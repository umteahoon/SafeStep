-- ============================================================
-- SafeStep - 프로필 권한 컬럼 자가 변경 차단
-- schema.sql 적용 후 SQL Editor에서 1회 실행하세요.
--
-- 기존 "Profiles Self Access" 정책은 FOR ALL + id = auth.uid() 라서, 로그인한
-- 사용자가 supabase-js로 본인 profiles 행의 role을 SUPER_ADMIN으로, academy_id를
-- 임의 학원으로, approval_status를 APPROVED로 직접 바꿀 수 있었습니다.
--
-- 이 파일은
--   1) 본인에게 INSERT/DELETE 권한을 주지 않고 SELECT/UPDATE만 허용하도록 정책 축소
--   2) UPDATE 시 role / academy_id / approval_status 변경을 authenticated 사용자에게만 차단
-- 백엔드(SUPABASE_SERVICE_ROLE_KEY)는 RLS와 이 트리거 모두 그대로 통과하므로
-- 회원가입·원장 등록 코드 연결·강사 승인 등 기존 서버 로직은 영향받지 않습니다.
-- Supabase 대시보드(SQL Editor / Table Editor)의 수동 변경도 auth.role()이
-- NULL이라 차단되지 않습니다 — 첫 슈퍼관리자 승격 절차를 그대로 쓸 수 있습니다.
-- ============================================================

DROP POLICY IF EXISTS "Profiles Self Access" ON profiles;

CREATE POLICY "Profiles Self Select" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Profiles Self Update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
       NEW.role IS DISTINCT FROM OLD.role
    OR NEW.academy_id IS DISTINCT FROM OLD.academy_id
    OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
  ) THEN
    RAISE EXCEPTION '역할·소속·승인 상태는 본인이 직접 변경할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_privileged_columns();
