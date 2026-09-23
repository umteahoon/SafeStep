-- ============================================================
-- SafeStep - 실제 스터디카페 구조에 가까운 좌석 도면 시드
-- 이미 seed.sql 을 실행한 DB에서 좌석만 새 배치로 교체할 때 사용.
-- (academies / students 는 건드리지 않음 · 여러 번 재실행 가능)
-- Supabase SQL Editor 에서 실행하세요.
--
-- 강남점은 사용자가 제공한 실제 매장(초월 스터디카페 산본점) 키오스크
-- 좌석 선택 화면 사진을 기준으로 재현했습니다. 사진 속 실제 좌석 번호(1~58)와
-- 존 구분(포커스존/카페존(노트북)/컴퓨터책상/스터디룸)을 그대로 사용했습니다.
-- 다만 SafeStep의 좌석 도면은 존마다 격자(그리드)로 배치를 그리는 방식이라,
-- 사진 속 통로·가구의 정확한 위치까지 픽셀 단위로 재현하지는 않습니다.
-- 사진에 번호가 없던 "스터디룸"은 4인실로 가정해 59~62번을 새로 부여했습니다.
-- ============================================================

DO $$
DECLARE
  gangnam UUID := (SELECT id FROM academies WHERE name = 'SafeStep 강남점');
  anyang  UUID := (SELECT id FROM academies WHERE name = 'SafeStep 안양점');
BEGIN
  -- ---------- 강남점: 62석 / 실제 매장 사진 기반 배치 ----------
  DELETE FROM seats WHERE academy_id = gangnam;
  UPDATE academies SET total_seats = 62 WHERE id = gangnam;

  -- 포커스존(FOCUS) 12석 — 사진 속 4행 x 3열 배치를 그대로 반영
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 31, 'FOCUS', 1, 1, 'EMPTY'), (gangnam, 30, 'FOCUS', 2, 1, 'EMPTY'), (gangnam, 29, 'FOCUS', 3, 1, 'EMPTY'),
    (gangnam, 28, 'FOCUS', 1, 2, 'EMPTY'), (gangnam, 27, 'FOCUS', 2, 2, 'EMPTY'), (gangnam, 26, 'FOCUS', 3, 2, 'EMPTY'),
    (gangnam, 25, 'FOCUS', 1, 3, 'EMPTY'), (gangnam, 24, 'FOCUS', 2, 3, 'EMPTY'), (gangnam, 23, 'FOCUS', 3, 3, 'EMPTY'),
    (gangnam, 22, 'FOCUS', 1, 4, 'EMPTY'), (gangnam, 21, 'FOCUS', 2, 4, 'EMPTY'), (gangnam, 20, 'FOCUS', 3, 4, 'EMPTY');

  -- 카페존(노트북)(LAPTOP) 6석 — 4·5·6·7·8·9번
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 9, 'LAPTOP', 1, 1, 'EMPTY'), (gangnam, 8, 'LAPTOP', 2, 1, 'EMPTY'),
    (gangnam, 7, 'LAPTOP', 1, 2, 'EMPTY'), (gangnam, 5, 'LAPTOP', 2, 2, 'EMPTY'),
    (gangnam, 6, 'LAPTOP', 1, 3, 'EMPTY'), (gangnam, 4, 'LAPTOP', 2, 3, 'EMPTY');

  -- 컴퓨터책상(DESK) 3석 — 1·2·3번
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (gangnam, 3, 'DESK', 1, 1, 'EMPTY'), (gangnam, 2, 'DESK', 2, 1, 'EMPTY'), (gangnam, 1, 'DESK', 3, 1, 'EMPTY');

  -- 스터디룸(ROOM_A) 4인실 — 사진에는 번호가 없어 59~62번을 새로 부여
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'ROOM_A', (n - 59), 0, 'EMPTY'
  FROM generate_series(59, 62) AS n;

  -- 자유석(OPEN) 37석 — 나머지 번호 전부(10~19, 32~49, 50~58), 10열 그리드로 배치
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'OPEN', (row_number() OVER (ORDER BY n) - 1) % 10,
         (row_number() OVER (ORDER BY n) - 1) / 10, 'EMPTY'
  FROM (
    SELECT n FROM generate_series(10, 19) AS n
    UNION ALL SELECT n FROM generate_series(32, 49) AS n
    UNION ALL SELECT n FROM generate_series(50, 58) AS n
  ) AS remaining(n);

  -- ---------- 안양점: 12석 / 2개 존 ----------
  DELETE FROM seats WHERE academy_id = anyang;
  UPDATE academies SET total_seats = 12 WHERE id = anyang;

  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT anyang, n, 'FOCUS', (n - 1) % 4, (n - 1) / 4, 'EMPTY'
  FROM generate_series(1, 8) AS n;

  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT anyang, n, 'OPEN', (n - 9), 0, 'EMPTY'
  FROM generate_series(9, 12) AS n;
END $$;

-- 데모용: 몇 자리는 사용중 / 외출중으로 표시
UPDATE seats SET status = 'OCCUPIED', occupied_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
  AND seat_number IN (5, 19, 24, 27, 31, 53);

UPDATE seats SET status = 'AWAY', occupied_at = NOW() - INTERVAL '40 min', away_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
  AND seat_number IN (21, 26);
