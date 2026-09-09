-- ============================================================
-- SafeStep - 실제 스터디카페 구조에 가까운 좌석 도면 시드
-- 이미 seed.sql 을 실행한 DB에서 좌석만 새 배치로 교체할 때 사용.
-- (academies / students 는 건드리지 않음 · 여러 번 재실행 가능)
-- Supabase SQL Editor 에서 실행하세요.
-- ============================================================

DO $$
DECLARE
  gangnam UUID := (SELECT id FROM academies WHERE name = 'SafeStep 강남점');
  anyang  UUID := (SELECT id FROM academies WHERE name = 'SafeStep 안양점');
BEGIN
  -- ---------- 강남점: 30석 / 5개 존 ----------
  DELETE FROM seats WHERE academy_id = gangnam;
  UPDATE academies SET total_seats = 30 WHERE id = gangnam;

  -- 집중존(1인 칸막이석) 12석 : 6열 x 2행
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'FOCUS', (n - 1) % 6, (n - 1) / 6, 'EMPTY'
  FROM generate_series(1, 12) AS n;

  -- 자유존(오픈석) 8석 : 4열 x 2행
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'OPEN', (n - 13) % 4, (n - 13) / 4, 'EMPTY'
  FROM generate_series(13, 20) AS n;

  -- 노트북존 4석 : 1행
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'LAPTOP', (n - 21), 0, 'EMPTY'
  FROM generate_series(21, 24) AS n;

  -- 스터디룸 A 3석
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'ROOM_A', (n - 25), 0, 'EMPTY'
  FROM generate_series(25, 27) AS n;

  -- 스터디룸 B 3석
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT gangnam, n, 'ROOM_B', (n - 28), 0, 'EMPTY'
  FROM generate_series(28, 30) AS n;

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
  AND seat_number IN (2, 5, 9, 14, 22);

UPDATE seats SET status = 'AWAY', occupied_at = NOW() - INTERVAL '40 min', away_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = 'SafeStep 강남점')
  AND seat_number IN (7, 18);
