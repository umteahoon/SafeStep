import { supabase } from './supabase';
import type { CommunityCategory, CommunityComment, CommunityPost } from '../types';

export const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  FREE: '자유',
  QUESTION: '질문',
  REVIEW: '후기',
  STUDY: '스터디 모집',
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as CommunityCategory[];

export interface PostWithStats extends CommunityPost {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

const POST_SELECT = '*, author:profiles(name, role)';

/** 프로필 조인이 RLS로 막히면 작성 시점에 저장된 author_name/author_role 로 대체 */
function withAuthor<T extends { author?: { name: string; role?: any } | null; author_name?: string | null; author_role?: any }>(row: T): T {
  if (row.author?.name) return row;
  return { ...row, author: row.author_name ? { name: row.author_name, role: row.author_role ?? undefined } : null };
}

async function withStats(posts: CommunityPost[], userId?: string | null): Promise<PostWithStats[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('community_likes').select('post_id, user_id').in('post_id', ids),
    supabase.from('community_comments').select('post_id').in('post_id', ids),
  ]);
  return posts.map(withAuthor).map((p) => ({
    ...p,
    likeCount: ((likes as any[]) ?? []).filter((l) => l.post_id === p.id).length,
    commentCount: ((comments as any[]) ?? []).filter((c) => c.post_id === p.id).length,
    likedByMe: !!userId && ((likes as any[]) ?? []).some((l) => l.post_id === p.id && l.user_id === userId),
  }));
}

/** 한 스터디카페의 게시글 (최신순) */
export async function fetchPosts(academyId: string, userId?: string | null): Promise<PostWithStats[]> {
  const { data } = await supabase
    .from('community_posts')
    .select(POST_SELECT)
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false })
    .limit(100);
  return withStats((data as CommunityPost[]) ?? [], userId);
}

/** 전체 스터디카페의 최근 게시글 (홈 인기글용) */
export async function fetchRecentPosts(userId?: string | null, limit = 30): Promise<PostWithStats[]> {
  const { data } = await supabase
    .from('community_posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  return withStats((data as CommunityPost[]) ?? [], userId);
}

export async function fetchPost(id: string, userId?: string | null): Promise<PostWithStats | null> {
  const { data } = await supabase.from('community_posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  return (await withStats([data as CommunityPost], userId))[0];
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data } = await supabase
    .from('community_comments')
    .select(POST_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  return ((data as CommunityComment[]) ?? []).map(withAuthor);
}

export async function createPost(input: {
  academyId: string;
  authorId: string;
  category: CommunityCategory;
  title: string;
  content: string;
}) {
  return supabase.from('community_posts').insert({
    academy_id: input.academyId,
    author_id: input.authorId,
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
  });
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) return supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', userId);
  return supabase.from('community_likes').insert({ post_id: postId, user_id: userId });
}

export async function addComment(postId: string, authorId: string, content: string) {
  return supabase.from('community_comments').insert({ post_id: postId, author_id: authorId, content: content.trim() });
}

export const deletePost = (id: string) => supabase.from('community_posts').delete().eq('id', id);
export const deleteComment = (id: string) => supabase.from('community_comments').delete().eq('id', id);

export function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

// ── 커뮤니티 탭용 필터/정렬 (순수 함수) ─────────────────

export interface PostFilter {
  academyId?: string | null;
  category?: CommunityCategory | null;
  mine?: boolean;
  query?: string;
  userId?: string | null;
}

export function filterPosts(posts: PostWithStats[], f: PostFilter): PostWithStats[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return posts.filter((p) => {
    if (f.academyId && p.academy_id !== f.academyId) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.mine && p.author_id !== f.userId) return false;
    if (q && !p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** 'latest': 최신순 / 'hot': 반응(좋아요×2 + 댓글) 많은 순, 같으면 최신순 */
export function sortPosts(posts: PostWithStats[], mode: 'latest' | 'hot'): PostWithStats[] {
  const byDate = (a: PostWithStats, b: PostWithStats) => +new Date(b.created_at) - +new Date(a.created_at);
  const score = (p: PostWithStats) => p.likeCount * 2 + p.commentCount;
  return [...posts].sort((a, b) => (mode === 'hot' ? score(b) - score(a) || byDate(a, b) : byDate(a, b)));
}
