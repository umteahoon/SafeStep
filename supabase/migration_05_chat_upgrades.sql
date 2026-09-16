-- ============================================================
-- SafeStep migration 05 — 채팅 고도화 (이미지 첨부 / 삭제·수정 / 안읽음 표시)
-- 이미 migration_03_chat.sql 을 실행한 프로젝트에서 SQL Editor로 추가 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1. chat_messages 컬럼 추가
-- ------------------------------------------------------------
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2. 안읽음 표시용 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_room_reads (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);
ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat Room Reads Own" ON chat_room_reads
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. 메시지 삭제/수정 정책
-- ------------------------------------------------------------
CREATE POLICY "Chat Messages Delete" ON chat_messages
    FOR DELETE TO authenticated
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM chat_rooms r
            WHERE r.id = chat_messages.room_id AND is_approved_staff_of(r.academy_id)
        )
    );

CREATE POLICY "Chat Messages Own Edit" ON chat_messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid() AND type = 'TEXT')
    WITH CHECK (sender_id = auth.uid() AND type = 'TEXT');

-- ------------------------------------------------------------
-- 4. 이미지 첨부용 Storage 버킷
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Chat Uploads Public Read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'chat-uploads');

CREATE POLICY "Chat Uploads Participant Insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'chat-uploads'
        AND can_post_in_chat_room((storage.foldername(name))[1]::uuid)
    );

-- ============================================================
-- 끝.
-- ============================================================
