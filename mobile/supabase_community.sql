-- ============================================================================
-- 스터디카페 커뮤니티 (모바일 앱 전용 기능) — 선택 적용 마이그레이션
--
-- ⚠️ 이 파일은 아직 실제 Supabase 프로젝트에 실행해 검증하지 않았습니다.
--    운영 DB에 적용하기 전에 개발/스테이징 프로젝트에서 먼저 실행해 보세요.
--    (미리보기 모드에서는 앱 안의 메모리 가짜 서버가 이 테이블을 흉내 내므로 적용 없이도 화면은 동작합니다.)
--
-- 전제: supabase/schema.sql 이 적용되어 있고 is_approved_staff_of() 함수가 있어야 합니다.
-- 웹(frontend) 코드는 이 테이블을 사용하지 않으므로 웹에는 영향이 없습니다.
-- ============================================================================

-- 1) 게시글
CREATE TABLE IF NOT EXISTS community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 작성 시점의 이름/역할을 함께 저장: profiles RLS 때문에 다른 사용자의 프로필을 조인해 읽을 수 없어서
  author_name VARCHAR(100),
  author_role VARCHAR(20),
  category    VARCHAR(20) NOT NULL DEFAULT 'FREE'
              CHECK (category IN ('FREE', 'QUESTION', 'REVIEW', 'STUDY')),
  title       VARCHAR(100) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_academy_created
  ON community_posts (academy_id, created_at DESC);

-- 2) 댓글
CREATE TABLE IF NOT EXISTS community_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name VARCHAR(100),
  author_role VARCHAR(20),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments (post_id, created_at);

-- 3) 좋아요 (한 사람이 글당 한 번)
CREATE TABLE IF NOT EXISTS community_likes (
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 4) 작성자 이름/역할 자동 기록 (클라이언트가 보낸 값은 무시하고 서버가 profiles 에서 채움)
CREATE OR REPLACE FUNCTION community_fill_author()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT p.name, p.role INTO NEW.author_name, NEW.author_role
  FROM profiles p WHERE p.id = NEW.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_posts_author ON community_posts;
CREATE TRIGGER trg_community_posts_author
  BEFORE INSERT ON community_posts
  FOR EACH ROW EXECUTE FUNCTION community_fill_author();

DROP TRIGGER IF EXISTS trg_community_comments_author ON community_comments;
CREATE TRIGGER trg_community_comments_author
  BEFORE INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION community_fill_author();

-- 5) RLS
ALTER TABLE community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes    ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인 없이도 누구나 (일반 이용자가 스터디카페 분위기를 볼 수 있도록)
CREATE POLICY "Community posts read"    ON community_posts    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Community comments read" ON community_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Community likes read"    ON community_likes    FOR SELECT TO anon, authenticated USING (true);

-- 쓰기: 로그인한 본인 명의로만
CREATE POLICY "Community posts insert" ON community_posts
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Community comments insert" ON community_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Community likes insert" ON community_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 삭제: 본인, 또는 해당 스터디카페의 승인된 원장/강사(운영진)
CREATE POLICY "Community posts delete" ON community_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR is_approved_staff_of(academy_id));

CREATE POLICY "Community comments delete" ON community_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_posts p
      WHERE p.id = community_comments.post_id AND is_approved_staff_of(p.academy_id)
    )
  );

CREATE POLICY "Community likes delete" ON community_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 수정(UPDATE) 정책은 두지 않았습니다 — 글/댓글 수정 기능은 아직 앱에 없습니다.
