-- ============================================================
-- SafeStep - 팀(Teams 스타일) + 채팅 + 도입 문의 마이그레이션
-- schema.sql 적용 후 Supabase SQL Editor에서 이 파일을 통째로 1회 실행하세요.
--
-- 대상: 학원 소속 원장(ACADEMY_ADMIN) / 승인된 강사(TEACHER) / 학원에 등록된 학생(STUDENT)
-- 팀은 학원 단위로 격리되며, 같은 학원 사람만 참가 코드로 들어올 수 있습니다.
-- 테이블 쓰기는 대부분 SECURITY DEFINER RPC 함수로만 이루어집니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    join_code VARCHAR(8) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL DEFAULT 'MEMBER', -- 'OWNER' | 'MEMBER'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- 채팅방: 팀 단체방(TEAM, 팀당 1개) / 팀 내 1:1 개인방(DIRECT, user_a < user_b 로 정규화)
CREATE TABLE team_chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, -- 'TEAM' | 'DIRECT'
    user_a UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_b UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chat_room_shape CHECK (
        (type = 'TEAM' AND user_a IS NULL AND user_b IS NULL)
        OR (type = 'DIRECT' AND user_a IS NOT NULL AND user_b IS NOT NULL AND user_a < user_b)
    )
);
CREATE UNIQUE INDEX uq_team_chat_room_team ON team_chat_rooms(team_id) WHERE type = 'TEAM';
CREATE UNIQUE INDEX uq_team_chat_room_direct ON team_chat_rooms(team_id, user_a, user_b) WHERE type = 'DIRECT';

CREATE TABLE team_chat_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES team_chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_team_chat_messages_room ON team_chat_messages(room_id, created_at);

-- 학원·카페 도입 문의 (랜딩 페이지 /inquiry 폼)
CREATE TABLE inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    contact VARCHAR(100) NOT NULL,
    business_name VARCHAR(100),
    business_type VARCHAR(20),
    message TEXT CHECK (message IS NULL OR char_length(message) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. 헬퍼 함수
-- ------------------------------------------------------------

-- 팀 기능을 쓸 수 있는 사용자의 학원 id (원장/승인 강사/학원 등록 학생). 없으면 NULL.
CREATE OR REPLACE FUNCTION current_user_team_academy_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT academy_id FROM profiles
      WHERE id = auth.uid()
        AND academy_id IS NOT NULL
        AND (role = 'ACADEMY_ADMIN' OR (role = 'TEACHER' AND approval_status = 'APPROVED'))),
    (SELECT academy_id FROM students WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION is_team_member(p_team UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION can_access_room(p_room UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_chat_rooms r
    JOIN team_members m ON m.team_id = r.team_id AND m.user_id = auth.uid()
    WHERE r.id = p_room
      AND (r.type = 'TEAM' OR auth.uid() IN (r.user_a, r.user_b))
  );
$$;

-- 알파벳+숫자 조합 8자리 랜덤 코드 (헷갈리는 I, O, 0, 1 제외, 영문/숫자 각 1자 이상 보장)
CREATE OR REPLACE FUNCTION generate_team_code()
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
DECLARE
  chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  i INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::INT, 1);
    END LOOP;
    IF v_code ~ '[A-Z]' AND v_code ~ '[2-9]'
       AND NOT EXISTS (SELECT 1 FROM teams WHERE join_code = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 3. RLS (읽기는 정책, 쓰기는 아래 RPC 함수로만)
-- ------------------------------------------------------------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams Member Read" ON teams
    FOR SELECT TO authenticated
    USING (is_team_member(id));

CREATE POLICY "Team Members Read" ON team_members
    FOR SELECT TO authenticated
    USING (is_team_member(team_id));

-- 팀 나가기: 본인 행만 삭제 가능
CREATE POLICY "Team Members Leave" ON team_members
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Team Chat Rooms Read" ON team_chat_rooms
    FOR SELECT TO authenticated
    USING (can_access_room(id));

CREATE POLICY "Team Chat Messages Read" ON team_chat_messages
    FOR SELECT TO authenticated
    USING (can_access_room(room_id));

CREATE POLICY "Team Chat Messages Send" ON team_chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid() AND can_access_room(room_id));

CREATE POLICY "Inquiries Public Create" ON inquiries
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Inquiries SuperAdmin Read" ON inquiries
    FOR SELECT TO authenticated
    USING (current_user_role() = 'SUPER_ADMIN');

-- ------------------------------------------------------------
-- 4. RPC 함수 (프론트에서 supabase.rpc(...) 로 호출)
-- ------------------------------------------------------------

-- 팀 만들기: 랜덤 참가 코드 생성 + 만든 사람을 OWNER 로 등록 + 단체 채팅방 생성
CREATE OR REPLACE FUNCTION create_team(p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_academy UUID;
  v_team teams;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  v_academy := current_user_team_academy_id();
  IF v_academy IS NULL THEN
    RAISE EXCEPTION '학원에 소속된 원장·강사·학생만 팀을 만들 수 있습니다.';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION '팀 이름을 입력해주세요.';
  END IF;
  IF char_length(btrim(p_name)) > 50 THEN
    RAISE EXCEPTION '팀 이름은 50자 이하여야 합니다.';
  END IF;

  INSERT INTO teams (academy_id, name, description, join_code, created_by)
  VALUES (v_academy, btrim(p_name), LEFT(NULLIF(btrim(p_description), ''), 200),
          generate_team_code(), auth.uid())
  RETURNING * INTO v_team;

  INSERT INTO team_members (team_id, user_id, role) VALUES (v_team.id, auth.uid(), 'OWNER');
  INSERT INTO team_chat_rooms (team_id, type) VALUES (v_team.id, 'TEAM');

  RETURN v_team;
END;
$$;

-- 초대 링크/코드 미리보기 (참가 전 팀 이름·인원 확인)
CREATE OR REPLACE FUNCTION team_preview_by_code(p_code TEXT)
RETURNS TABLE (team_id UUID, team_name TEXT, description TEXT, member_count BIGINT,
               same_academy BOOLEAN, already_member BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name::TEXT, t.description::TEXT,
         (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id),
         t.academy_id IS NOT DISTINCT FROM current_user_team_academy_id(),
         EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = t.id AND m.user_id = auth.uid())
  FROM teams t
  WHERE auth.uid() IS NOT NULL AND t.join_code = upper(btrim(p_code));
$$;

-- 참가 코드로 팀 참가 (같은 학원 소속만). 이미 참가했으면 그대로 팀 id 반환.
CREATE OR REPLACE FUNCTION join_team_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_team teams;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  SELECT * INTO v_team FROM teams WHERE join_code = upper(btrim(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않은 참가 코드입니다.';
  END IF;
  IF v_team.academy_id IS DISTINCT FROM current_user_team_academy_id() THEN
    RAISE EXCEPTION '같은 학원에 소속된 사람만 참가할 수 있습니다.';
  END IF;
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_team.id, auth.uid(), 'MEMBER')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN v_team.id;
END;
$$;

-- 팀 멤버 목록 (profiles RLS 때문에 학생은 다른 사람 이름을 직접 못 읽으므로 RPC 로 제공)
CREATE OR REPLACE FUNCTION list_team_members(p_team UUID)
RETURNS TABLE (member_id UUID, member_name TEXT, team_role TEXT, account_role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.user_id, p.name::TEXT, m.role::TEXT, p.role::TEXT
  FROM team_members m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.team_id = p_team AND is_team_member(p_team)
  ORDER BY (m.role = 'OWNER') DESC, p.name;
$$;

-- 팀 내 1:1 개인 채팅방 시작 (이미 있으면 기존 방 반환)
CREATE OR REPLACE FUNCTION start_direct_chat(p_team UUID, p_other UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_room UUID;
BEGIN
  IF NOT is_team_member(p_team) THEN
    RAISE EXCEPTION '팀 멤버만 사용할 수 있습니다.';
  END IF;
  IF p_other = auth.uid() THEN
    RAISE EXCEPTION '자기 자신과는 개인 채팅을 할 수 없습니다.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team AND user_id = p_other) THEN
    RAISE EXCEPTION '같은 팀 멤버가 아닙니다.';
  END IF;

  v_a := LEAST(auth.uid(), p_other);
  v_b := GREATEST(auth.uid(), p_other);

  INSERT INTO team_chat_rooms (team_id, type, user_a, user_b)
  VALUES (p_team, 'DIRECT', v_a, v_b)
  ON CONFLICT (team_id, user_a, user_b) WHERE type = 'DIRECT' DO NOTHING;

  SELECT id INTO v_room FROM team_chat_rooms
   WHERE team_id = p_team AND type = 'DIRECT' AND user_a = v_a AND user_b = v_b;
  RETURN v_room;
END;
$$;

-- RPC 는 로그인 사용자만 호출
REVOKE ALL ON FUNCTION create_team(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION team_preview_by_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_team_by_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_team_members(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_direct_chat(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_team(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION team_preview_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_team_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_team_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION start_direct_chat(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. 실시간 채팅 (Supabase Realtime)
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE team_chat_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
