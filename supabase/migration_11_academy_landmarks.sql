-- ============================================================
-- SafeStep - 좌석 도면에 실제 매장처럼 통로/시설 배치를 재현하기 위한
-- 비좌석 랜드마크(존 라벨, 화장실·창고·냉장고·키오스크 위치 등) 테이블
-- schema.sql 적용 후 SQL Editor에서 이 파일을 1회 실행하세요.
--
-- 학원에 academy_landmarks 행이 하나라도 있으면 프론트(FloorPlanGrid.tsx)는
-- 좌석·랜드마크를 학원 전체 기준 절대 좌표(grid_x, grid_y) 하나의 격자에
-- 함께 배치하는 "자유 배치" 모드로 렌더링합니다(기존 존 상자별 배치 대신).
-- 랜드마크가 없는 학원은 기존처럼 존별 박스 배치를 그대로 사용합니다.
-- ============================================================

CREATE TABLE academy_landmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    label VARCHAR(30) NOT NULL,
    icon VARCHAR(10) DEFAULT '',
    grid_x INT NOT NULL,
    grid_y INT NOT NULL
);
CREATE INDEX idx_academy_landmarks_academy ON academy_landmarks(academy_id);

ALTER TABLE academy_landmarks ENABLE ROW LEVEL SECURITY;

-- 좌석 도면과 동일하게 공개 읽기(지도/좌석 화면은 로그인 불필요)
CREATE POLICY "Landmarks Public Read" ON academy_landmarks
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Landmarks Staff Write" ON academy_landmarks
    FOR ALL TO authenticated
    USING (is_approved_staff_of(academy_id))
    WITH CHECK (is_approved_staff_of(academy_id));
