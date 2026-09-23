-- ============================================================
-- SafeStep - 실제 스터디카페 구조에 가까운 좌석 도면 시드
-- 이미 seed.sql 을 실행한 DB에서 좌석만 새 배치로 교체할 때 사용.
-- (academies / students 는 건드리지 않음 · 여러 번 재실행 가능)
-- Supabase SQL Editor 에서 실행하세요.
--
-- 강남점은 사용자가 제공한 실제 매장(초월 스터디카페 산본점) 키오스크
-- 좌석 선택 화면 사진을 기준으로 재현했습니다. 사진 속 실제 좌석 번호(1~58)와
-- 존 구분(포커스존/카페존(노트북)/컴퓨터책상/스터디룸)은 물론, 좌석 하나하나의
-- 배치와 통로까지 학원 전체 기준 절대 좌표(grid_x, grid_y)로 재현했습니다
-- (하단 academy_landmarks 인서트 참고 — supabase/migration_11_academy_landmarks.sql
-- 적용이 필요합니다. 적용 전이면 랜드마크 삽입은 건너뛰고 좌석만 반영됩니다).
-- 사진에 번호가 없던 "스터디룸"은 4인실로 가정해 59~62번을 새로 부여했습니다.
-- ============================================================

DO $$
DECLARE
  gangnam UUID := (SELECT id FROM academies WHERE name = 'SafeStep 강남점');
  anyang  UUID := (SELECT id FROM academies WHERE name = 'SafeStep 안양점');
BEGIN
  -- ---------- 강남점: 62석 / 실제 매장 사진 기반 배치(절대 좌표) ----------
  DELETE FROM seats WHERE academy_id = gangnam;
  UPDATE academies SET total_seats = 62 WHERE id = gangnam;

  -- 왼쪽 세로열 58~50 (x=1, y=1~9)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 58, 'OPEN', 1, 1, 'EMPTY'), (gangnam, 57, 'OPEN', 1, 2, 'EMPTY'),
    (gangnam, 56, 'OPEN', 1, 3, 'EMPTY'), (gangnam, 55, 'OPEN', 1, 4, 'EMPTY'),
    (gangnam, 54, 'OPEN', 1, 5, 'EMPTY'), (gangnam, 53, 'OPEN', 1, 6, 'EMPTY'),
    (gangnam, 52, 'OPEN', 1, 7, 'EMPTY'), (gangnam, 51, 'OPEN', 1, 8, 'EMPTY'),
    (gangnam, 50, 'OPEN', 1, 9, 'EMPTY');

  -- 상단 42~45 (x=5~8, y=1)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 45, 'OPEN', 5, 1, 'EMPTY'), (gangnam, 44, 'OPEN', 6, 1, 'EMPTY'),
    (gangnam, 43, 'OPEN', 7, 1, 'EMPTY'), (gangnam, 42, 'OPEN', 8, 1, 'EMPTY');

  -- 오른쪽 세로열 19~10 (x=10, y=1~10)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 19, 'OPEN', 10, 1, 'EMPTY'), (gangnam, 18, 'OPEN', 10, 2, 'EMPTY'),
    (gangnam, 17, 'OPEN', 10, 3, 'EMPTY'), (gangnam, 16, 'OPEN', 10, 4, 'EMPTY'),
    (gangnam, 15, 'OPEN', 10, 5, 'EMPTY'), (gangnam, 14, 'OPEN', 10, 6, 'EMPTY'),
    (gangnam, 13, 'OPEN', 10, 7, 'EMPTY'), (gangnam, 12, 'OPEN', 10, 8, 'EMPTY'),
    (gangnam, 11, 'OPEN', 10, 9, 'EMPTY'), (gangnam, 10, 'OPEN', 10, 10, 'EMPTY');

  -- 41~37 / 36~32 두 줄 (x=5~9, y=3~4)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 41, 'OPEN', 5, 3, 'EMPTY'), (gangnam, 40, 'OPEN', 6, 3, 'EMPTY'), (gangnam, 39, 'OPEN', 7, 3, 'EMPTY'),
    (gangnam, 38, 'OPEN', 8, 3, 'EMPTY'), (gangnam, 37, 'OPEN', 9, 3, 'EMPTY'),
    (gangnam, 36, 'OPEN', 5, 4, 'EMPTY'), (gangnam, 35, 'OPEN', 6, 4, 'EMPTY'), (gangnam, 34, 'OPEN', 7, 4, 'EMPTY'),
    (gangnam, 33, 'OPEN', 8, 4, 'EMPTY'), (gangnam, 32, 'OPEN', 9, 4, 'EMPTY');

  -- 포커스존(FOCUS) 12석 — 4행 x 3열 (x=5~7, y=6~9)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 31, 'FOCUS', 5, 6, 'EMPTY'), (gangnam, 30, 'FOCUS', 6, 6, 'EMPTY'), (gangnam, 29, 'FOCUS', 7, 6, 'EMPTY'),
    (gangnam, 28, 'FOCUS', 5, 7, 'EMPTY'), (gangnam, 27, 'FOCUS', 6, 7, 'EMPTY'), (gangnam, 26, 'FOCUS', 7, 7, 'EMPTY'),
    (gangnam, 25, 'FOCUS', 5, 8, 'EMPTY'), (gangnam, 24, 'FOCUS', 6, 8, 'EMPTY'), (gangnam, 23, 'FOCUS', 7, 8, 'EMPTY'),
    (gangnam, 22, 'FOCUS', 5, 9, 'EMPTY'), (gangnam, 21, 'FOCUS', 6, 9, 'EMPTY'), (gangnam, 20, 'FOCUS', 7, 9, 'EMPTY');

  -- 49·48·47 (x=2~4, y=9, 카페존 바로 위)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 49, 'OPEN', 2, 9, 'EMPTY'), (gangnam, 48, 'OPEN', 3, 9, 'EMPTY'), (gangnam, 47, 'OPEN', 4, 9, 'EMPTY');

  -- 카페존(노트북)(LAPTOP) 6석 — 9·8 / 7·5 / 6·4 (x=1~3, y=10~11) + 46번(x=4, y=10)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 9, 'LAPTOP', 1, 10, 'EMPTY'), (gangnam, 7, 'LAPTOP', 2, 10, 'EMPTY'), (gangnam, 5, 'LAPTOP', 3, 10, 'EMPTY'),
    (gangnam, 46, 'OPEN', 4, 10, 'EMPTY'),
    (gangnam, 8, 'LAPTOP', 1, 11, 'EMPTY'), (gangnam, 6, 'LAPTOP', 2, 11, 'EMPTY'), (gangnam, 4, 'LAPTOP', 3, 11, 'EMPTY');

  -- 컴퓨터책상(DESK) 3석 — 3·2·1 (x=1~3, y=12)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 3, 'DESK', 1, 12, 'EMPTY'), (gangnam, 2, 'DESK', 2, 12, 'EMPTY'), (gangnam, 1, 'DESK', 3, 12, 'EMPTY');

  -- 스터디룸(ROOM_A) 4인실 — 사진에는 번호가 없어 59~62번을 새로 부여 (x=9~10, y=11~12)
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 59, 'ROOM_A', 9, 11, 'EMPTY'), (gangnam, 60, 'ROOM_A', 10, 11, 'EMPTY'),
    (gangnam, 61, 'ROOM_A', 9, 12, 'EMPTY'), (gangnam, 62, 'ROOM_A', 10, 12, 'EMPTY');

  -- ---------- 안양점: 12석 / 2개 존 ----------
  DELETE FROM seats WHERE academy_id = anyang;
  UPDATE academies SET total_seats = 12 WHERE id = anyang;

  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT anyang, n, 'FOCUS', (n - 1) % 4, (n - 1) / 4, 'EMPTY'
  FROM generate_series(1, 8) AS n;

  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT anyang, n, 'OPEN', (n - 9), 0, 'EMPTY'
  FROM generate_series(9, 12) AS n;

  -- ---------- 강남점 랜드마크(존 라벨/통로/시설) — migration_11 적용 시에만 ----------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academy_landmarks') THEN
    DELETE FROM academy_landmarks WHERE academy_id = gangnam;
    INSERT INTO academy_landmarks (academy_id, label, icon, grid_x, grid_y) VALUES
      (gangnam, '입구 · 프론트데스크', '🚪', 1, 0),
      (gangnam, '포커스존', '', 5, 5),
      (gangnam, '카페존(노트북)', '', 4, 11),
      (gangnam, '컴퓨터책상', '', 4, 12),
      (gangnam, '스터디룸', '', 9, 10),
      (gangnam, '냉장고', '🧊', 2, 15),
      (gangnam, '창고', '📦', 1, 16),
      (gangnam, '여자화장실', '🚻', 10, 15),
      (gangnam, 'KIOSK', '🖥️', 9, 16);
  END IF;
END $$;

-- 데모용: 몇 자리는 사용중 / 외출중으로 표시
UPDATE seats SET status = 'OCCUPIED', occupied_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
  AND seat_number IN (5, 19, 24, 27, 31, 53);

UPDATE seats SET status = 'AWAY', occupied_at = NOW() - INTERVAL '40 min', away_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
  AND seat_number IN (21, 26);
