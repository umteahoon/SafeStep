-- ============================================================
-- SafeStep - 실제 매장 좌석 배치 재현: 초월 스터디카페 산본점
-- 사용자가 제공한 키오스크 좌석 선택 화면 사진을 기준으로 만든 데모 좌석 배치입니다.
-- schema.sql (+ 되도록 seed.sql) 적용 후 SQL Editor에서 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 사진에 표시된 실제 좌석 번호(1~58)와 존 구분(포커스존/카페존(노트북)/스터디룸)을
-- 그대로 사용했습니다. 다만 SafeStep의 좌석 도면은 존마다 격자(그리드)로 배치를
-- 그리는 방식이라, 사진 속 통로·가구의 정확한 위치까지 픽셀 단위로 재현하지는
-- 않습니다 — 같은 좌석 번호·같은 존 구성으로 기능적으로 동일하게 재현했습니다.
-- 사진에 번호가 없던 "스터디룸"은 4인실로 가정해 59~62번을 새로 부여했습니다.
-- ============================================================

DO $$
DECLARE
  sanbon UUID;
BEGIN
  SELECT id INTO sanbon FROM academies WHERE name = '초월 스터디카페 산본점';
  IF sanbon IS NULL THEN
    INSERT INTO academies (name, address, latitude, longitude, total_seats, subscription_status)
    VALUES ('초월 스터디카페 산본점', '경기 군포시 산본동', 37.3585, 126.9316, 62, 'ACTIVE')
    RETURNING id INTO sanbon;
  END IF;

  DELETE FROM seats WHERE academy_id = sanbon;
  UPDATE academies SET total_seats = 62 WHERE id = sanbon;

  -- 포커스존(FOCUS) 12석 — 사진 속 4행 x 3열 배치를 그대로 반영
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (sanbon, 31, 'FOCUS', 1, 1, 'EMPTY'), (sanbon, 30, 'FOCUS', 2, 1, 'EMPTY'), (sanbon, 29, 'FOCUS', 3, 1, 'EMPTY'),
    (sanbon, 28, 'FOCUS', 1, 2, 'EMPTY'), (sanbon, 27, 'FOCUS', 2, 2, 'EMPTY'), (sanbon, 26, 'FOCUS', 3, 2, 'EMPTY'),
    (sanbon, 25, 'FOCUS', 1, 3, 'EMPTY'), (sanbon, 24, 'FOCUS', 2, 3, 'EMPTY'), (sanbon, 23, 'FOCUS', 3, 3, 'EMPTY'),
    (sanbon, 22, 'FOCUS', 1, 4, 'EMPTY'), (sanbon, 21, 'FOCUS', 2, 4, 'EMPTY'), (sanbon, 20, 'FOCUS', 3, 4, 'EMPTY');

  -- 카페존(노트북)(LAPTOP) 6석 — 4·5·6·7·8·9번
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (sanbon, 9, 'LAPTOP', 1, 1, 'EMPTY'), (sanbon, 8, 'LAPTOP', 2, 1, 'EMPTY'),
    (sanbon, 7, 'LAPTOP', 1, 2, 'EMPTY'), (sanbon, 5, 'LAPTOP', 2, 2, 'EMPTY'),
    (sanbon, 6, 'LAPTOP', 1, 3, 'EMPTY'), (sanbon, 4, 'LAPTOP', 2, 3, 'EMPTY');

  -- 컴퓨터책상(DESK) 3석 — 1·2·3번
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status) VALUES
    (sanbon, 3, 'DESK', 1, 1, 'EMPTY'), (sanbon, 2, 'DESK', 2, 1, 'EMPTY'), (sanbon, 1, 'DESK', 3, 1, 'EMPTY');

  -- 스터디룸(ROOM_A) 4인실 — 사진에는 번호가 없어 59~62번을 새로 부여
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT sanbon, n, 'ROOM_A', (n - 59), 0, 'EMPTY'
  FROM generate_series(59, 62) AS n;

  -- 자유석(OPEN) 37석 — 나머지 번호 전부(10~19, 32~49, 50~58), 10열 그리드로 배치
  INSERT INTO seats (academy_id, seat_number, zone_type, grid_x, grid_y, status)
  SELECT sanbon, n, 'OPEN', (row_number() OVER (ORDER BY n) - 1) % 10,
         (row_number() OVER (ORDER BY n) - 1) / 10, 'EMPTY'
  FROM (
    SELECT n FROM generate_series(10, 19) AS n
    UNION ALL SELECT n FROM generate_series(32, 49) AS n
    UNION ALL SELECT n FROM generate_series(50, 58) AS n
  ) AS remaining(n);
END $$;

-- 데모용: 몇 자리는 사용중/외출중으로 표시 (사진 속 남은 시간 표시와 유사한 느낌)
UPDATE seats SET status = 'OCCUPIED', occupied_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = '초월 스터디카페 산본점')
  AND seat_number IN (5, 19, 24, 27, 31, 53);

UPDATE seats SET status = 'AWAY', occupied_at = NOW() - INTERVAL '30 min', away_at = NOW()
WHERE academy_id = (SELECT id FROM academies WHERE name = '초월 스터디카페 산본점')
  AND seat_number IN (21, 26);
