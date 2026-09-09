-- ============================================================
-- SafeStep - 로그인 시도 기록 (관리자 접속 감사용)
-- 이미 schema.sql을 적용한 프로젝트에 이 파일만 추가로 실행하세요.
-- (schema.sql에도 동일한 내용이 반영되어 있어 신규 설치 시에는 별도 실행 불필요)
-- ============================================================

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) NOT NULL,
    success BOOLEAN NOT NULL,
    reason VARCHAR(100),
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_created ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- 슈퍼관리자만 조회 가능. 쓰기는 백엔드가 SUPABASE_SERVICE_ROLE_KEY로만 수행하므로
-- (RLS를 우회) 별도의 INSERT 정책은 두지 않습니다.
CREATE POLICY "Login Attempts SuperAdmin Read" ON login_attempts
    FOR SELECT TO authenticated
    USING (current_user_role() = 'SUPER_ADMIN');
