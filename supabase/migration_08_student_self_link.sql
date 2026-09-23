-- ============================================================
-- SafeStep - 학생 계정 ↔ 명부 자가 연동
-- schema.sql 적용 후 SQL Editor에서 이 파일을 1회 실행하세요.
--
-- 기존에는 원장/강사만 학생관리에서 students.user_id를 연결할 수 있었습니다.
-- 이제 학생 본인도 원장이 발급한 6자리 연동코드(link_code, 기존에는 보호자 전용)로
-- 자기 계정을 students 레코드에 직접 연결할 수 있습니다 (backend/src/routes/studentLink.ts).
--
-- link_code는 지금까지 UNIQUE 제약이 없었는데(학부모 연동만 쓰던 시절에는 충돌해도
-- 영향이 적었음), 학생 연동까지 같은 코드를 쓰게 되면서 충돌 시 계정이 잘못
-- 연결될 위험이 커져 UNIQUE 제약을 추가합니다.
-- ⚠️ 기존 데이터에 중복된 link_code가 있으면 이 ALTER는 실패합니다 — 그런 경우
-- 중복된 학생 중 하나의 link_code를 수동으로 바꾼 뒤 다시 실행하세요:
--   UPDATE students SET link_code = LPAD(FLOOR(RANDOM()*1000000)::TEXT, 6, '0') WHERE id = '...';
-- ============================================================

ALTER TABLE students ADD CONSTRAINT unique_link_code UNIQUE (link_code);
