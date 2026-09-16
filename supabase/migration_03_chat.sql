-- ============================================================
-- SafeStep migration 03 — 반 채팅 / 학원 공지방
-- 이미 schema.sql(+이전 마이그레이션)을 실행한 프로젝트에서 SQL Editor로 추가 실행하세요.
-- (schema.sql에도 동일한 내용이 반영되어 있어 신규 설치 시에는 별도 실행 불필요)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'CLASS' | 'ANNOUNCEMENT'
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX uniq_chat_room_class ON chat_rooms(class_id) WHERE class_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_chat_room_announcement ON chat_rooms(academy_id) WHERE type = 'ANNOUNCEMENT';

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'TEXT', -- 'TEXT' | 'ATTENDANCE_CHECK' | 'ATTENDANCE_RESPONSE' | 'SYSTEM'
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Helper 함수
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_academy_member(target_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND academy_id = target_academy_id
  ) OR EXISTS (
    SELECT 1 FROM students WHERE academy_id = target_academy_id AND parent_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_chat_room_participant(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        (r.type = 'ANNOUNCEMENT' AND is_academy_member(r.academy_id))
        OR (
          r.type = 'CLASS' AND (
            is_approved_staff_of(r.academy_id)
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

CREATE OR REPLACE FUNCTION can_post_in_chat_room(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        is_approved_staff_of(r.academy_id)
        OR (
          r.type = 'CLASS' AND EXISTS (
            SELECT 1 FROM class_enrollments ce
            JOIN students s ON s.id = ce.student_id
            WHERE ce.class_id = r.class_id AND s.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- ------------------------------------------------------------
-- 3. 정책
-- ------------------------------------------------------------
CREATE POLICY "Chat Rooms Select" ON chat_rooms
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR (type = 'ANNOUNCEMENT' AND is_academy_member(academy_id))
        OR (
            type = 'CLASS' AND EXISTS (
                SELECT 1 FROM class_enrollments ce
                JOIN students s ON s.id = ce.student_id
                WHERE ce.class_id = chat_rooms.class_id
                  AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Chat Rooms Staff Create" ON chat_rooms
    FOR INSERT TO authenticated
    WITH CHECK (is_approved_staff_of(academy_id));

CREATE POLICY "Chat Messages Select" ON chat_messages
    FOR SELECT TO authenticated
    USING (is_chat_room_participant(room_id));

CREATE POLICY "Chat Messages Insert" ON chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (can_post_in_chat_room(room_id) AND sender_id = auth.uid());

CREATE POLICY "Profiles Chat Participant Read" ON profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            WHERE m.sender_id = profiles.id
              AND is_chat_room_participant(m.room_id)
        )
    );

-- ------------------------------------------------------------
-- 4. Realtime 활성화 (없으면 새로고침 전까지 새 메시지가 안 보임)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

-- ============================================================
-- 끝.
-- ============================================================
