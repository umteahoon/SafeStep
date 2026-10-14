-- ============================================================
-- migration_16: 채팅방 비밀번호(참가 코드) 방식
--  - 강사가 방을 만들 때 비밀번호를 정하고, 학생은 학원 화면에서 방 목록을 보고
--    비밀번호를 입력해 들어온다.
--  - chat_rooms.join_code / chat_room_members / join_chat_room_by_code 는 모바일 앱이
--    이미 사용하고 있었지만 저장소 SQL 에 정의가 없어 여기서 정식으로 만든다.
--    (이미 수동으로 만들어 둔 DB 에서도 IF NOT EXISTS / OR REPLACE 로 안전하게 실행됨)
-- 기존 프로젝트에 한 번만 실행하세요. migration_03 · migration_05 이후에 실행.
-- ============================================================

-- 1) 컬럼 / 테이블 -----------------------------------------------------
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS join_code TEXT;
-- 비밀번호는 학원 안에서만 겹치지 않으면 됨 (대소문자 무시)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chat_room_join_code
    ON chat_rooms (academy_id, upper(join_code)) WHERE join_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_room_members (
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat Room Members Own Read" ON chat_room_members;
CREATE POLICY "Chat Room Members Own Read" ON chat_room_members
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND is_approved_staff_of(r.academy_id))
    );
-- 본인이 직접 나가기(삭제)는 허용, 참가(INSERT)는 아래 RPC 로만 가능
DROP POLICY IF EXISTS "Chat Room Members Own Leave" ON chat_room_members;
CREATE POLICY "Chat Room Members Own Leave" ON chat_room_members
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- 2) 내가 속한 학원 id 들 (원장·강사 프로필 / 연동된 학생 / 학부모) ----------
CREATE OR REPLACE FUNCTION my_academy_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid() AND academy_id IS NOT NULL
  UNION
  SELECT academy_id FROM students WHERE user_id = auth.uid() OR parent_user_id = auth.uid();
$$;

-- 3) 참여 판정에 "비밀번호로 들어온 멤버" 추가 --------------------------
CREATE OR REPLACE FUNCTION is_chat_room_participant(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        (r.type = 'ANNOUNCEMENT' AND is_academy_member(r.academy_id))
        OR (
          r.type = 'CLASS' AND (
            is_approved_staff_of(r.academy_id)
            OR EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = auth.uid())
            OR EXISTS (
              SELECT 1 FROM class_enrollments ce
              JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = r.class_id
                AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
            )
          )
        )
      )
  );
$$;

-- 글쓰기: 직원, 반에 배정된 학생, 비밀번호로 들어온 "학생"(학부모는 읽기 전용)
CREATE OR REPLACE FUNCTION can_post_in_chat_room(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        is_approved_staff_of(r.academy_id)
        OR (
          r.type = 'CLASS' AND (
            EXISTS (
              SELECT 1 FROM class_enrollments ce
              JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = r.class_id AND s.user_id = auth.uid()
            )
            OR (
              EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = auth.uid())
              AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'STUDENT')
            )
          )
        )
      )
  );
$$;

-- 방 한 줄 조회(select * 로 방을 열 때)도 멤버를 허용
DROP POLICY IF EXISTS "Chat Rooms Select" ON chat_rooms;
CREATE POLICY "Chat Rooms Select" ON chat_rooms
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR (type = 'ANNOUNCEMENT' AND is_academy_member(academy_id))
        OR (
            type = 'CLASS' AND (
                EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = chat_rooms.id AND m.user_id = auth.uid())
                OR EXISTS (
                    SELECT 1 FROM class_enrollments ce
                    JOIN students s ON s.id = ce.student_id
                    WHERE ce.class_id = chat_rooms.class_id
                      AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
                )
            )
        )
    );

-- 4) RPC -----------------------------------------------------------------
-- 학원 화면의 방 목록: 이 학원의 모든 방을 (비밀번호는 빼고) 보여주고, 내가 들어가 있는지 표시
CREATE OR REPLACE FUNCTION list_academy_chat_rooms(p_academy_id UUID)
RETURNS TABLE (id UUID, name TEXT, type TEXT, class_id UUID, joined BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name::TEXT, r.type::TEXT, r.class_id,
         (
           is_approved_staff_of(r.academy_id)
           OR r.type = 'ANNOUNCEMENT'
           OR EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = auth.uid())
           OR EXISTS (
             SELECT 1 FROM class_enrollments ce JOIN students s ON s.id = ce.student_id
             WHERE ce.class_id = r.class_id AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
           )
         ) AS joined,
         r.created_at
    FROM chat_rooms r
   WHERE r.academy_id = p_academy_id
     AND p_academy_id IN (SELECT my_academy_ids())
   ORDER BY (r.type = 'ANNOUNCEMENT') DESC, r.created_at;
$$;

-- 비밀번호로 특정 방에 참가
CREATE OR REPLACE FUNCTION join_chat_room(p_room_id UUID, p_password TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room chat_rooms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  SELECT * INTO v_room FROM chat_rooms WHERE id = p_room_id AND type = 'CLASS';
  IF NOT FOUND OR v_room.academy_id NOT IN (SELECT my_academy_ids()) THEN
    RAISE EXCEPTION '참여할 수 없는 채팅방입니다.';
  END IF;
  IF v_room.join_code IS NULL OR upper(btrim(v_room.join_code)) <> upper(btrim(COALESCE(p_password, ''))) THEN
    RAISE EXCEPTION '비밀번호가 맞지 않아요.';
  END IF;
  INSERT INTO chat_room_members (room_id, user_id) VALUES (v_room.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN v_room.id;
END;
$$;

-- 비밀번호만으로 참가 (채팅 목록의 "코드로 참가" 입력창)
CREATE OR REPLACE FUNCTION join_chat_room_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room chat_rooms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  SELECT * INTO v_room FROM chat_rooms
   WHERE type = 'CLASS'
     AND academy_id IN (SELECT my_academy_ids())
     AND join_code IS NOT NULL
     AND upper(btrim(join_code)) = upper(btrim(COALESCE(p_code, '')))
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION '유효하지 않은 참가 코드입니다.'; END IF;
  INSERT INTO chat_room_members (room_id, user_id) VALUES (v_room.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN v_room.id;
END;
$$;

REVOKE ALL ON FUNCTION my_academy_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION list_academy_chat_rooms(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_chat_room(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_chat_room_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION my_academy_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION list_academy_chat_rooms(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION join_chat_room(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_chat_room_by_code(TEXT) TO authenticated;
