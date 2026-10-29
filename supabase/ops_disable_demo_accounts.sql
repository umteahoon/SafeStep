-- ============================================================
-- ops_disable_demo_accounts.sql: 실제 운영 전에 공용 데모 계정 로그인 정지
--
-- 저장소가 공개되어 있고 예전 시드 스크립트에 데모 비밀번호가 적혀 있었기 때문에,
-- 백엔드 데모 로그인 API(DEMO_LOGIN_ENABLED=false)만 끄면 /login 에서 이메일 · 비밀번호로
-- 여전히 데모 원장 계정에 들어올 수 있습니다. 이 SQL은 데모 계정 자체를 정지(ban)합니다.
--   - 정지된 계정은 비밀번호 · 매직링크 로그인과 기존 세션 갱신이 모두 거부됩니다.
--   - 계정과 데모 데이터는 지우지 않습니다 (발표 · 시연이 다시 필요하면 아래 "되돌리기").
-- ============================================================

UPDATE auth.users
   SET banned_until = '2999-12-31 00:00:00+00'  -- 'infinity' 는 인증 서버가 처리하지 못해 500 오류가 남
 WHERE email IN ('demo-admin@safestep.local', 'demo-teacher@safestep.local', 'demo-parent@safestep.local');

-- 이미 로그인해 있는 데모 세션도 즉시 끊기 (리프레시 토큰 삭제)
DELETE FROM auth.refresh_tokens
 WHERE user_id::uuid IN (
   SELECT id FROM auth.users
    WHERE email IN ('demo-admin@safestep.local', 'demo-teacher@safestep.local', 'demo-parent@safestep.local')
 );

-- 확인: banned_until 이 2999-12-31 로 보이면 완료
SELECT email, banned_until FROM auth.users WHERE email LIKE 'demo-%@safestep.local';

-- 되돌리기 (데모를 다시 열 때만):
-- UPDATE auth.users SET banned_until = NULL
--  WHERE email IN ('demo-admin@safestep.local', 'demo-teacher@safestep.local', 'demo-parent@safestep.local');
-- 그리고 Render 의 DEMO_LOGIN_ENABLED 를 true 로.
