-- ============================================================
-- migration_20: 운영 DB에서 빠져 있던 migration_07 · 08 · 09 한 번에 적용 (안전한 재실행판)
--
-- 2026-10-29 점검 결과 운영 Supabase 에 아래가 없었습니다:
--   - migration_07: student_passes 테이블 → 키오스크 입실이 "이용권 없음"으로 전부 막히고
--                   /student/passes(이용권) 화면이 오류
--   - migration_09: inquiries.submitted_by 컬럼 → "학원·카페 도입 문의" 제출이 서버 오류로 실패,
--                   /my/inquiries(내 문의 내역)가 400 오류
--   - migration_08: students.link_code UNIQUE 제약 (학생 자가 연동 시 코드 충돌 방지)
-- 원본 파일들과 내용은 같고, 이미 적용된 부분은 건너뛰도록(IF NOT EXISTS 등) 만들었습니다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================

-- ---------- migration_07: 학생 개인 이용권 ----------
CREATE TABLE IF NOT EXISTS student_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    pass_type VARCHAR(10) NOT NULL, -- 'TIME' | 'PERIOD'
    product_name VARCHAR(100) NOT NULL,
    remaining_minutes INT,
    expires_at TIMESTAMPTZ,
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
CREATE INDEX IF NOT EXISTS idx_student_passes_student ON student_passes(student_id, status);
ALTER TABLE student_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student Passes Read" ON student_passes;
CREATE POLICY "Student Passes Read" ON student_passes
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR student_id IN (
            SELECT id FROM students WHERE user_id = auth.uid() OR parent_user_id = auth.uid()
        )
    );

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
   WHERE student_id = p_student AND pass_type = 'TIME' AND status = 'ACTIVE' AND remaining_minutes > 0
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

-- ---------- migration_08: 연동코드 중복 방지 ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_link_code') THEN
    -- 혹시 이미 겹치는 코드가 있으면 뒤쪽 학생의 코드를 새로 발급한 뒤 제약 추가
    UPDATE students s
       SET link_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
     WHERE EXISTS (
       SELECT 1 FROM students o
        WHERE o.link_code = s.link_code AND o.created_at < s.created_at
     );
    ALTER TABLE students ADD CONSTRAINT unique_link_code UNIQUE (link_code);
  END IF;
END $$;

-- ---------- migration_09: 내 문의 내역 ----------
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "Inquiries Own Read" ON inquiries;
CREATE POLICY "Inquiries Own Read" ON inquiries
    FOR SELECT TO authenticated
    USING (submitted_by = auth.uid());

-- PostgREST 가 새 테이블 · 컬럼을 바로 인식하도록 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
