import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { CATEGORIES, CATEGORY_LABEL, timeAgo } from '../lib/community';
import type { PostWithStats } from '../lib/community';
import { colors } from '../theme';
import type { CommunityCategory } from '../types';

const TAG: Record<CommunityCategory, { fg: string; bg: string }> = {
  FREE: { fg: '#475467', bg: '#F0F2F5' },
  QUESTION: { fg: '#B54708', bg: '#FFF4DB' },
  REVIEW: { fg: '#12A150', bg: '#E6F7EE' },
  STUDY: { fg: '#4F46E5', bg: '#ECEBFF' },
};

export function CategoryTag({ category }: { category: CommunityCategory }) {
  const t = TAG[category] ?? TAG.FREE;
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagText, { color: t.fg }]}>{CATEGORY_LABEL[category] ?? category}</Text>
    </View>
  );
}

/** 분류 탭: 칩이 아니라 폭을 균등 분할한 고정 탭(밑줄 표시) — 줄어들거나 잘릴 일이 없음 */
export function CategoryTabs({
  value,
  onChange,
}: {
  value: CommunityCategory | null;
  onChange: (v: CommunityCategory | null) => void;
}) {
  const short: Record<CommunityCategory, string> = { FREE: '자유', QUESTION: '질문', REVIEW: '후기', STUDY: '모집' };
  const items: { key: CommunityCategory | null; label: string }[] = [
    { key: null, label: '전체' },
    ...CATEGORIES.map((c) => ({ key: c, label: short[c] })),
  ];
  return (
    <View style={styles.tabs}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <Pressable key={it.label} onPress={() => onChange(it.key)} style={styles.tab}>
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{it.label}</Text>
            <View style={[styles.tabLine, on && styles.tabLineOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** 카테고리 필터 칩 (가로 스크롤). value 가 null 이면 전체 */
export function CategoryFilter({
  value,
  onChange,
}: {
  value: CommunityCategory | null;
  onChange: (v: CommunityCategory | null) => void;
}) {
  const items: { key: CommunityCategory | null; label: string }[] = [
    { key: null, label: '전체' },
    ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c] })),
  ];
  return (
    // flexGrow/flexShrink: 0 — 세로 flex 부모 안에서 칩 행이 높이를 더 차지하지도, 글 목록에 밀려 줄어들어(글자가 잘림) 보이지도 않도록
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <Pressable key={it.label} onPress={() => onChange(it.key)} style={[styles.filter, on && styles.filterOn]}>
            <Text style={[styles.filterText, on && { color: colors.white }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 게시글 한 줄 (카드 없이 구분선만) */
export function PostItem({
  post,
  onPress,
  academyName,
}: {
  post: PostWithStats;
  onPress: () => void;
  /** 여러 스터디카페 글을 섞어 보여줄 때 소속 표시 */
  academyName?: string;
}) {
  const isStaff = post.author?.role === 'ACADEMY_ADMIN' || post.author?.role === 'TEACHER';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: '#F7F8FA' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CategoryTag category={post.category} />
        {academyName && <Text style={styles.cafeTag}>{academyName}</Text>}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {post.title}
      </Text>
      <Text style={styles.preview} numberOfLines={2}>
        {post.content}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {post.author?.name ?? '익명'}
          {isStaff ? ' · 운영진' : ''} · {timeAgo(post.created_at)}
        </Text>
        <View style={{ flex: 1 }} />
        <Icon name={post.likedByMe ? 'heart' : 'heart-outline'} size={14} color={post.likedByMe ? '#F43F5E' : colors.textMuted} />
        <Text style={styles.metaCount}>{post.likeCount}</Text>
        <Icon name="chatbubble-outline" size={13} color={colors.textMuted} />
        <Text style={styles.metaCount}>{post.commentCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800' },
  cafeTag: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  filter: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F5F8' },
  filterOn: { backgroundColor: colors.text },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10 },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textMuted, paddingBottom: 9 },
  tabTextOn: { color: colors.text, fontWeight: '800' },
  tabLine: { height: 3, alignSelf: 'stretch', marginHorizontal: 8, borderRadius: 2, backgroundColor: 'transparent' },
  tabLineOn: { backgroundColor: colors.text },
  item: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  preview: { fontSize: 14, color: colors.textSub, lineHeight: 20, marginTop: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  metaText: { fontSize: 12, color: colors.textMuted },
  metaCount: { fontSize: 12, color: colors.textMuted, marginRight: 6, marginLeft: 1 },
});
