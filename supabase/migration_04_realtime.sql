-- ============================================================
-- SafeStep migration 04 — 채팅/출결 실시간(Realtime) 활성화
--
-- SQL로 테이블만 만들면 Supabase Realtime 발행 목록(supabase_realtime)에는
-- 자동으로 포함되지 않습니다. 그래서 chat_messages 에 새 메시지가 와도,
-- class_attendance_records 값이 바뀌어도 다른 사람 화면에는 새로고침 전까지
-- 반영되지 않았습니다. 이 파일을 SQL Editor에서 실행하면 실시간으로 반영됩니다.
--
-- 이미 등록된 테이블을 다시 추가해도 에러 없이 넘어가도록 존재 체크를 합니다.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE class_attendance_records;
  END IF;
END $$;
