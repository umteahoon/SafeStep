-- ============================================================
-- migration_18: 대시보드 "공지 · 알림 현황" + 채팅방 RLS 무한 재귀 수정
--
-- 1) 채팅방 조회 오류 수정
--    migration_16 이후 웹 /chat 에서
--      infinite recursion detected in policy for relation "chat_rooms"
--    가 발생합니다. "Chat Rooms Select" 정책이 chat_room_members 를 조회하고,
--    chat_room_members 의 정책은 다시 chat_rooms 를 조회해서 서로를 끝없이 부르기 때문.
--    멤버 확인을 SECURITY DEFINER 함수로 빼서(RLS 를 다시 타지 않음) 고리를 끊습니다.
--
-- 2) get_academy_notice_stats: 원장 대시보드의 공지 · 알림 현황
--    - 공지(공지방 글): 받는 사람 수(학원 직원 + 연동된 학생 · 학부모, 작성자 제외)와
--      그중 글을 읽은 사람 수(chat_room_reads.last_read_at >= 글 작성 시각)
--    - 출결 알림: 지각 · 결석 기록과 보호자 푸시 발송 여부(alert_sent)
--    학원의 승인된 직원만 조회 가능 (그 외에는 빈 결과)
--
-- 기존 프로젝트에 한 번만 실행하세요. migration_16 이후. 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1) 채팅방 RLS 재귀 수정 ---------------------------------------------------
CREATE OR REPLACE FUNCTION is_chat_room_member(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_room_members m
    WHERE m.room_id = target_room_id AND m.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION is_chat_room_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_chat_room_member(UUID) TO authenticated;

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
    );

-- 2) 공지 · 알림 현황 -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_academy_notice_stats(p_academy_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE (
    kind TEXT,          -- 'NOTICE' | 'ATTENDANCE'
    title TEXT,
    target TEXT,        -- 수신 대상 표시용
    sent_at TIMESTAMPTZ,
    sent BOOLEAN,       -- 공지: 게시됨 / 출결 알림: 보호자 푸시 발송 여부
    recipients INT,
    readers INT         -- 공지만 (출결 알림은 NULL)
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT is_approved_staff_of(p_academy_id) AS ok
  ),
  members AS (
    SELECT id AS uid FROM profiles WHERE academy_id = p_academy_id
    UNION
    SELECT user_id FROM students WHERE academy_id = p_academy_id AND user_id IS NOT NULL
    UNION
    SELECT parent_user_id FROM students WHERE academy_id = p_academy_id AND parent_user_id IS NOT NULL
  ),
  notices AS (
    SELECT
      'NOTICE'::TEXT AS kind,
      left(COALESCE(NULLIF(btrim(m.content), ''), '[이미지]'), 60) AS title,
      '학원 전체'::TEXT AS target,
      m.created_at AS sent_at,
      TRUE AS sent,
      (SELECT count(*) FROM members mb WHERE mb.uid IS DISTINCT FROM m.sender_id)::INT AS recipients,
      (SELECT count(*) FROM members mb
         JOIN chat_room_reads rr ON rr.user_id = mb.uid AND rr.room_id = m.room_id
        WHERE mb.uid IS DISTINCT FROM m.sender_id AND rr.last_read_at >= m.created_at)::INT AS readers
    FROM chat_messages m
    JOIN chat_rooms r ON r.id = m.room_id
    WHERE r.academy_id = p_academy_id AND r.type = 'ANNOUNCEMENT' AND m.type IN ('TEXT', 'IMAGE')
  ),
  alerts AS (
    SELECT
      'ATTENDANCE'::TEXT AS kind,
      s.name || ' ' || CASE a.status WHEN 'LATE' THEN '지각' WHEN 'ABSENT' THEN '결석' ELSE '사유결석' END AS title,
      '보호자'::TEXT AS target,
      a.recorded_at AS sent_at,
      COALESCE(a.alert_sent, FALSE) AS sent,
      (CASE WHEN s.parent_user_id IS NOT NULL THEN 1 ELSE 0 END)::INT AS recipients,
      NULL::INT AS readers
    FROM class_attendance_records a
    JOIN students s ON s.id = a.student_id
    WHERE a.academy_id = p_academy_id AND a.status IN ('LATE', 'ABSENT', 'EXCUSED')
  )
  SELECT x.* FROM (SELECT * FROM notices UNION ALL SELECT * FROM alerts) x, allowed
  WHERE allowed.ok
  ORDER BY x.sent_at DESC NULLS LAST
  LIMIT greatest(1, least(COALESCE(p_limit, 20), 100));
$$;
REVOKE ALL ON FUNCTION get_academy_notice_stats(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_academy_notice_stats(UUID, INT) TO authenticated;
