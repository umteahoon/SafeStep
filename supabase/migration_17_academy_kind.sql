-- ============================================================
-- migration_17: academies.kind / category 컬럼 추가
--
-- migration_15·16과 함께 들어온 모바일 업데이트가 이미 이 두 컬럼을
-- 실제 컬럼인 것처럼 사용하고 있습니다:
--   - backend/src/routes/owner.ts: POST /api/owner/academies 가
--     academies.insert({ kind: 'ACADEMY', ... }) 를 호출
--   - mobile/src/screens/academy/AcademyListScreen.tsx: "학원" 탭이
--     supabase.from('academies').select('id, name, address, kind') 로
--     조회 (컬럼이 없으면 이 SELECT 자체가 에러로 실패해 "학원" 탭이
--     동작하지 않습니다)
-- 그런데 저장소 SQL 에는 이 컬럼을 추가하는 마이그레이션이 없었습니다
-- (friend 커밋 설명의 "SQL·백엔드는 실제 DB에서 검증하지 않았음" 과
-- 같은 이유로 보입니다). 그래서 이 파일로 추가합니다.
-- 기존 프로젝트에 한 번만 실행하세요. (신규 프로젝트는 schema.sql 이후 이어서 실행)
-- ============================================================

ALTER TABLE academies ADD COLUMN IF NOT EXISTS kind VARCHAR(20);
ALTER TABLE academies ADD COLUMN IF NOT EXISTS category VARCHAR(20);

-- 기존 데이터 백필: 이름에 "스터디카페"/"학원"이 들어간 기존 행을 구분해 둡니다.
-- (seed_real_studycafes.sql로 넣은 지점들은 전부 이름에 "스터디카페"가 들어 있어 자동으로 분류됩니다)
UPDATE academies SET kind = 'STUDY_CAFE' WHERE kind IS NULL AND name LIKE '%스터디카페%';
UPDATE academies SET kind = 'ACADEMY' WHERE kind IS NULL AND name LIKE '%학원%';
