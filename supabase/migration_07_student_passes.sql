-- ============================================================
-- SafeStep - 학생 개인 이용권(시간권/기간권) 결제
-- schema.sql 적용 후 SQL Editor에서 이 파일을 1회 실행하세요.
--
-- student_passes: 학생이 토스페이먼츠로 결제한 개인 이용권 이력.
-- 쓰기는 백엔드(backend/src/routes/studentPass.ts, service role)로만 이루어지며
-- RLS는 SELECT 정책만 존재합니다 (subscriptions 테이블과 동일한 패턴).
-- ============================================================

CREATE TABLE student_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    pass_type VARCHAR(10) NOT NULL, -- 'TIME' | 'PERIOD'
    product_name VARCHAR(100) NOT NULL,
    remaining_minutes INT, -- TIME(시간권)만 사용
    expires_at TIMESTAMPTZ, -- PERIOD(기간권)만 사용
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'DEPLETED' | 'EXPIRED'
    payment_key VARCHAR(100),
    order_id VARCHAR(100) NOT NULL UNIQUE,
    amount INT NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_passes_type_fields CHECK (
        (pass_type = 'TIME' AND remaining_minutes IS NOT NULL AND expires_at IS NULL)
        OR (pass_type = 'PERIOD' AND expires_at IS NOT NULL AND remaining_minutes IS NULL)
    )
);
CREATE INDEX idx_student_passes_student ON student_passes(student_id, status);

ALTER TABLE student_passes ENABLE ROW LEVEL SECURITY;

-- 읽기: 학원 직원(원장/승인 강사), 본인(학생 계정), 학부모
CREATE POLICY "Student Passes Read" ON student_passes
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR student_id IN (
            SELECT id FROM students WHERE user_id = auth.uid() OR parent_user_id = auth.uid()
        )
    );
-- INSERT/UPDATE/DELETE 정책 없음 — 결제 승인·차감은 반드시 백엔드 서비스 롤로만

-- 키오스크 퇴실 처리 시 시간권에서 이용 시간을 차감 (가장 오래된 ACTIVE 시간권부터 소진)
-- 여러 시간권에 걸친 차감은 하지 않음(단순화) — 한 시간권 잔여량을 넘는 초과분은 버려짐
CREATE OR REPLACE FUNCTION deduct_time_pass(p_student UUID, p_minutes INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pass_id UUID;
  v_remaining INT;
BEGIN
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RETURN;
  END IF;

  SELECT id, remaining_minutes INTO v_pass_id, v_remaining
    FROM student_passes
   WHERE student_id = p_student
     AND pass_type = 'TIME'
     AND status = 'ACTIVE'
     AND remaining_minutes > 0
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE student_passes
     SET remaining_minutes = GREATEST(v_remaining - p_minutes, 0),
         status = CASE WHEN v_remaining - p_minutes <= 0 THEN 'DEPLETED' ELSE status END
   WHERE id = v_pass_id;
END;
$$;

REVOKE ALL ON FUNCTION deduct_time_pass(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deduct_time_pass(UUID, INT) TO service_role;
