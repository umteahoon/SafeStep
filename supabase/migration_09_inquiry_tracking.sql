-- ============================================================
-- SafeStep - 도입 문의 제출자 본인 조회("내 문의 내역")
-- schema.sql 적용 후 SQL Editor에서 이 파일을 1회 실행하세요.
--
-- 기존에는 /inquiry 문의가 슈퍼관리자만 조회 가능했습니다. 로그인 상태로
-- 문의를 남긴 사용자는 이제 자신이 제출한 문의 목록을 볼 수 있습니다.
-- (비로그인 상태로 남긴 문의는 계정과 연결되지 않아 추적할 수 없습니다.)
-- ============================================================

ALTER TABLE inquiries ADD COLUMN submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE POLICY "Inquiries Own Read" ON inquiries
    FOR SELECT TO authenticated
    USING (submitted_by = auth.uid());
