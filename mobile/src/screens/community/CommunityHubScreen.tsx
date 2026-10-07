import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { BlockRoles } from '../../components/Guard';
import { EXPLORE_BLOCKED } from '../../lib/teams';
import { useAuth } from '../../lib/useAuth';
import { useFavorites } from '../../lib/favorites';
import { fetchRecentPosts, filterPosts, sortPosts } from '../../lib/community';
import type { PostWithStats } from '../../lib/community';
import { inScope, scopeLabel, writeTarget } from '../../lib/communityScope';
import type { Scope, ScopeCafe } from '../../lib/communityScope';
import { CategoryTabs, PostItem } from '../../components/community';
import { CommunityScopeSheet } from '../../components/CommunityScopeSheet';
import { Empty, Icon, Loading, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, TabParamList } from '../../navigation/types';
import type { CommunityCategory } from '../../types';

const short = (n: string) => n.replace('SafeStep ', '');

/**
 * 커뮤니티 탭 — "게시판"을 고르는 화면.
 *  - 제목 자체가 게시판 선택 버튼(전체 / 내 스터디카페 / 즐겨찾기 / 지역 / 스터디카페 한 곳). 한 번의 시트로 끝남
 *  - 분류는 고정 탭, 검색은 아이콘으로 접어서 글 영역을 넓게
 */
function CommunityHubScreenInner() {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<RouteProp<TabParamList, 'CommunityTab'>>();
  const { user, academyId: myAcademyId } = useAuth();
  const { favorites } = useFavorites();

  const [posts, setPosts] = useState<PostWithStats[] | null>(null);
  const [cafes, setCafes] = useState<ScopeCafe[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [scope, setScope] = useState<Scope>({ kind: 'all' });
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [mode, setMode] = useState<'latest' | 'hot'>('latest');
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);

  // 내 정보의 "내 글"에서 넘어온 경우: 모든 게시판에서 내 글만
  const mineParam = route.params?.mine;
  const mineTs = route.params?.ts;
  useEffect(() => {
    if (!mineParam) return;
    picked.current = true;
    setScope({ kind: 'all' });
    setCategory(null);
    setMine(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineParam, mineTs]);

  // 내 스터디카페가 있으면 처음엔 그 게시판을 보여줌 (사용자가 직접 고른 뒤에는 건드리지 않음)
  const picked = useRef(false);
  // 소속이 없어지면(로그아웃·역할 전환) "내 스터디카페" 게시판이 비어 보이지 않도록 전체로 되돌림
  useEffect(() => {
    if (myAcademyId) {
      if (!picked.current) setScope((s) => (s.kind === 'all' ? { kind: 'mine' } : s));
    } else {
      picked.current = false;
      setScope((s) => (s.kind === 'mine' ? { kind: 'all' } : s));
    }
  }, [myAcademyId]);
  const chooseScope = (s: Scope) => {
    picked.current = true;
    setScope(s);
    setScopeOpen(false);
  };

  const load = useCallback(async () => {
    const [list, { data: ac }] = await Promise.all([
      fetchRecentPosts(user?.id, 200),
      supabase.from('academies').select('id, name, address'),
    ]);
    setPosts(list);
    setCafes(((ac as ScopeCafe[]) ?? []).map((c) => ({ id: c.id, name: c.name, address: c.address ?? '' })));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ctx = useMemo(() => ({ cafes, myAcademyId, favorites }), [cafes, myAcademyId, favorites]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (posts ?? []).forEach((p) => (c[p.academy_id] = (c[p.academy_id] ?? 0) + 1));
    return c;
  }, [posts]);
  const nameOf = useMemo(() => Object.fromEntries(cafes.map((c) => [c.id, short(c.name)])), [cafes]);

  const shown = useMemo(() => {
    const inBoard = (posts ?? []).filter((p) => inScope(p.academy_id, scope, ctx));
    return sortPosts(filterPosts(inBoard, { category, mine, query, userId: user?.id }), mode);
  }, [posts, scope, ctx, category, mine, query, mode, user]);

  const goWrite = (academyId: string) =>
    user
      ? navigation.navigate('PostWrite', { academyId })
      : navigation.navigate('Login', { next: { name: 'PostWrite', params: { academyId } } });

  const write = () => {
    const target = writeTarget(scope, myAcademyId);
    if (target) return goWrite(target);
    setWriteOpen(true); // 글을 남길 스터디카페를 먼저 고르게 함
  };

  const label = scopeLabel(scope, ctx);
  const showCafeTag = scope.kind !== 'cafe' && scope.kind !== 'mine';

  return (
    <Screen scroll={false} edges={['top', 'left', 'right']} backgroundColor={colors.white} keyboardAvoiding={false}>
      {/* 제목 = 게시판 선택 */}
      <View style={styles.header}>
        <Pressable onPress={() => setScopeOpen(true)} style={styles.titleBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="게시판 선택">
          <Text style={styles.title} numberOfLines={1}>
            {label}
          </Text>
          <Icon name="chevron-down" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="검색">
          <Icon name="search" size={22} color={searchOpen || query ? colors.primary : colors.text} />
        </Pressable>
        <Pressable onPress={write} style={styles.writeBtn} hitSlop={6}>
          <Icon name="create" size={17} color={colors.white} />
          <Text style={styles.writeText}>글쓰기</Text>
        </Pressable>
      </View>

      {(searchOpen || query.length > 0) && (
        <View style={styles.search}>
          <Icon name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="제목, 내용으로 검색"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoFocus={searchOpen && query.length === 0}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close-circle" size={17} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      <CategoryTabs value={category} onChange={setCategory} />

      {/* 개수 · 정렬 · 내 글 */}
      <View style={styles.metaRow}>
        <Text style={styles.count}>글 {shown.length}개</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setMode((m) => (m === 'latest' ? 'hot' : 'latest'))} style={styles.metaBtn} hitSlop={6}>
          <Icon name="swap-vertical" size={14} color={colors.textSub} />
          <Text style={styles.metaText}>{mode === 'latest' ? '최신순' : '인기순'}</Text>
        </Pressable>
        {user && (
          <Pressable onPress={() => setMine((v) => !v)} style={[styles.metaBtn, mine && styles.metaBtnOn]} hitSlop={6}>
            <Icon name={mine ? 'checkmark' : 'person-outline'} size={14} color={mine ? colors.primary : colors.textSub} />
            <Text style={[styles.metaText, mine && { color: colors.primary }]}>내 글</Text>
          </Pressable>
        )}
      </View>

      {posts === null ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <Empty icon="chatbubbles-outline">
              {mine
                ? '아직 내가 쓴 글이 없어요'
                : query
                  ? `"${query}"에 대한 글이 없어요`
                  : scope.kind === 'fav'
                    ? '즐겨찾기한 스터디카페의 글이 아직 없어요'
                    : `${label}에 아직 글이 없어요.\n첫 글을 남겨보세요!`}
            </Empty>
          }
          renderItem={({ item }) => (
            <PostItem
              post={item}
              academyName={showCafeTag ? nameOf[item.academy_id] : undefined}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            />
          )}
        />
      )}

      <CommunityScopeSheet
        visible={scopeOpen}
        cafes={cafes}
        counts={counts}
        value={scope}
        myCafeId={myAcademyId}
        favoriteCount={favorites.length}
        onSelect={chooseScope}
        onClose={() => setScopeOpen(false)}
      />
      <CommunityScopeSheet
        visible={writeOpen}
        mode="write"
        cafes={cafes}
        counts={counts}
        value={scope}
        myCafeId={myAcademyId}
        favoriteCount={0}
        onSelect={(s) => {
          setWriteOpen(false);
          if (s.kind === 'cafe') goWrite(s.id);
        }}
        onClose={() => setWriteOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  titleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.8, flexShrink: 1 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  writeText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F5F8', borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  count: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  metaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F5F8' },
  metaBtnOn: { backgroundColor: colors.primarySoft },
  metaText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
});

export default function CommunityHubScreen() {
  return (
    <BlockRoles roles={EXPLORE_BLOCKED}>
      <CommunityHubScreenInner />
    </BlockRoles>
  );
}
