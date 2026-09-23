-- ============================================================
-- SafeStep - 팀 관리 기능 보강 (멤버 추방 / 팀 삭제 / 참가 코드 재발급)
-- supabase/migration_teams_chat.sql 적용 후 SQL Editor에서 이 파일을 1회 실행하세요.
-- 팀장(OWNER)만 호출 가능한 SECURITY DEFINER RPC 3개를 추가합니다.
-- ============================================================

-- 팀장이 멤버를 팀에서 추방 (본인은 추방 불가 — 팀 나가기/팀 삭제를 이용)
CREATE OR REPLACE FUNCTION kick_team_member(p_team UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team AND user_id = auth.uid() AND role = 'OWNER'
  ) THEN
    RAISE EXCEPTION '팀장만 멤버를 내보낼 수 있습니다.';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION '본인은 내보낼 수 없습니다.';
  END IF;

  DELETE FROM team_members WHERE team_id = p_team AND user_id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION '해당 멤버를 찾을 수 없습니다.';
  END IF;

  -- 추방된 멤버와의 1:1 개인 채팅방도 함께 정리
  DELETE FROM team_chat_rooms
   WHERE team_id = p_team AND type = 'DIRECT' AND (user_a = p_user OR user_b = p_user);
END;
$$;

-- 팀장이 팀을 삭제 (멤버/채팅방/메시지는 FK ON DELETE CASCADE로 함께 삭제됨)
CREATE OR REPLACE FUNCTION delete_team(p_team UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team AND user_id = auth.uid() AND role = 'OWNER'
  ) THEN
    RAISE EXCEPTION '팀장만 팀을 삭제할 수 있습니다.';
  END IF;
  DELETE FROM teams WHERE id = p_team;
END;
$$;

-- 팀장이 참가 코드를 재발급 (기존 코드는 즉시 무효화됨)
CREATE OR REPLACE FUNCTION regenerate_team_code(p_team UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team AND user_id = auth.uid() AND role = 'OWNER'
  ) THEN
    RAISE EXCEPTION '팀장만 참가 코드를 재발급할 수 있습니다.';
  END IF;
  v_code := generate_team_code();
  UPDATE teams SET join_code = v_code WHERE id = p_team;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION kick_team_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_team(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION regenerate_team_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kick_team_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_team_code(UUID) TO authenticated;
