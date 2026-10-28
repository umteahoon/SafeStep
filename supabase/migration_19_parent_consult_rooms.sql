-- ============================================================
-- migration_19: 학부모 1:1 상담방 (소통 메뉴를 학생 / 학부모로 분리)
--
-- - chat_rooms.type 에 'PARENT' 를 추가해 학생 한 명당 상담방 하나를 둡니다.
--   참여자: 그 학원의 승인된 직원(원장 · 강사) + 그 학생의 연동된 학부모.
--   메시지 · 읽음 표시는 기존 chat_messages / chat_room_reads 를 그대로 사용.
-- - 기존 반 채팅방(CLASS) · 공지방(ANNOUNCEMENT) 동작은 바뀌지 않습니다.
--
-- 기존 프로젝트에 한 번만 실행하세요. migration_18 이후. 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1) 상담방 컬럼 ------------------------------------------------------------
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chat_room_parent ON chat_rooms(student_id) WHERE type = 'PARENT';

-- 이 학생의 연동된 학부모인지 (RLS 재귀를 피하려고 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_parent_of_student(target_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM students s WHERE s.id = target_student_id AND s.parent_user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION is_parent_of_student(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_parent_of_student(UUID) TO authenticated;

-- 2) 참여 · 글쓰기 판정에 상담방 추가 (migration_16 정의 + PARENT) ------------
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
        OR (
          r.type = 'PARENT' AND (is_approved_staff_of(r.academy_id) OR is_parent_of_student(r.student_id))
        )
      )
  );
$$;

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
        -- 상담방은 학부모도 글을 쓸 수 있음 (반 채팅방에서는 계속 읽기 전용)
        OR (r.type = 'PARENT' AND is_parent_of_student(r.student_id))
      )
  );
$$;

-- 3) 방 조회 정책 (migration_18 정의 + PARENT) --------------------------------
DROP POLICY IF EXISTS "Chat Rooms Select" ON chat_rooms;
CREATE POLICY "Chat Rooms Select" ON chat_rooms
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR (type = 'ANNOUNCEMENT' AND is_academy_member(academy_id))
        OR (
            type = 'CLASS' AND (
                is_chat_room_member(chat_rooms.id)
                OR EXISTS (
                    SELECT 1 FROM class_enrollments ce
                    JOIN students s ON s.id = ce.student_id
                    WHERE ce.class_id = chat_rooms.class_id
                      AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
                )
            )
        )
        OR (type = 'PARENT' AND is_parent_of_student(student_id))
    );

-- 4) RPC --------------------------------------------------------------------
-- 학생의 상담방을 열기 (없으면 만듦). 그 학원 직원 또는 그 학생의 학부모만 가능.
CREATE OR REPLACE FUNCTION open_parent_room(p_student_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_room_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND OR NOT (is_approved_staff_of(v_student.academy_id) OR v_student.parent_user_id = auth.uid()) THEN
    RAISE EXCEPTION '상담방을 열 수 없습니다.';
  END IF;
  SELECT id INTO v_room_id FROM chat_rooms WHERE type = 'PARENT' AND student_id = p_student_id;
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (academy_id, type, name, student_id)
    VALUES (v_student.academy_id, 'PARENT', v_student.name || ' 학부모 상담', p_student_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_room_id;
    IF v_room_id IS NULL THEN
      SELECT id INTO v_room_id FROM chat_rooms WHERE type = 'PARENT' AND student_id = p_student_id;
    END IF;
  END IF;
  RETURN v_room_id;
END;
$$;

-- 직원용 학부모 상담 목록: 학원의 모든 학생 + 학부모 연동 여부 + 상담방 마지막 메시지 · 안읽음 수
CREATE OR REPLACE FUNCTION list_parent_consults(p_academy_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_name TEXT,
    parent_linked BOOLEAN,
    room_id UUID,
    last_message TEXT,
    last_at TIMESTAMPTZ,
    unread INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name::TEXT,
    pp.name::TEXT,
    s.parent_user_id IS NOT NULL,
    r.id,
    lm.content,
    lm.created_at,
    COALESCE((
      SELECT count(*) FROM chat_messages m
      WHERE m.room_id = r.id AND m.sender_id IS DISTINCT FROM auth.uid()
        AND m.created_at > COALESCE((SELECT rr.last_read_at FROM chat_room_reads rr WHERE rr.room_id = r.id AND rr.user_id = auth.uid()), 'epoch'::timestamptz)
    ), 0)::INT
  FROM students s
  LEFT JOIN profiles pp ON pp.id = s.parent_user_id
  LEFT JOIN chat_rooms r ON r.type = 'PARENT' AND r.student_id = s.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(btrim(m.content), ''), '[이미지]') AS content, m.created_at
    FROM chat_messages m WHERE m.room_id = r.id ORDER BY m.created_at DESC LIMIT 1
  ) lm ON TRUE
  WHERE s.academy_id = p_academy_id
    AND COALESCE(s.status, 'ACTIVE') = 'ACTIVE'
    AND is_approved_staff_of(p_academy_id)
  ORDER BY lm.created_at DESC NULLS LAST, s.name;
$$;

REVOKE ALL ON FUNCTION open_parent_room(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_parent_consults(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_parent_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_parent_consults(UUID) TO authenticated;
