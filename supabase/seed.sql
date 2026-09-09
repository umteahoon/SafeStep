-- ============================================================
-- SafeStep 테스트용 샘플 데이터
-- schema.sql 실행 후, Supabase SQL Editor에서 실행하세요.
-- 지도/좌석/키오스크 화면을 바로 테스트해볼 수 있습니다.
-- ============================================================

INSERT INTO academies (name, address, latitude, longitude, total_seats, subscription_status)
VALUES
  ('SafeStep 강남점', '서울 강남구 테헤란로 123', 37.5006, 127.0364, 30, 'ACTIVE'),
  ('SafeStep 안양점', '경기 안양시 동안구 시민대로 100', 37.3927, 126.9268, 12, 'TRIAL');

-- 좌석 배치(존 구분)는 seed_floorplan.sql 에서 생성합니다.
-- 이 파일 실행 직후 seed_floorplan.sql 도 이어서 실행하세요.

-- 테스트용 학생 (핀코드 111111로 키오스크 테스트 가능)
-- ⚠️ 실제 회원가입한 STUDENT 프로필과 연결하려면 user_id를 해당 auth.users.id로 업데이트하세요.
INSERT INTO students (academy_id, name, attendance_code, parent_phone)
VALUES
  ((SELECT id FROM academies WHERE name = 'SafeStep 강남점'), '홍길동', '111111', '010-1234-5678');
