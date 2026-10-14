import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from './ui';
import { buildScopeSections } from '../lib/communityScope';
import type { Scope, ScopeCafe } from '../lib/communityScope';
import { colors } from '../theme';

type Row =
  | { type: 'quick'; key: string; label: string; sub?: string; icon: any; scope: Scope }
  | { type: 'region'; key: string; sido: string; postCount: number }
  | { type: 'cafe'; key: string; id: string; name: string; sub: string; mine: boolean };

/**
 * 커뮤니티에서 "어느 게시판을 볼지" 고르는 시트 — 단순한 구조:
 *   [전체 | 학원 | 스터디카페] → (지역 칩) → 이름 목록 한 줄씩
 *  - 맨 위 빠른 선택(전체 / 내 소속 / 즐겨찾기)
 *  - 지역 칩을 고르면 목록이 그 지역으로 좁혀지고 "OO 전체 게시판"이 맨 위에 나옴
 *  - 검색하면 이름·주소가 맞는 곳이 바로 나옴
 * mode='write' 이면 글을 남길 곳 하나만 고르도록 지점 목록만 보여줌.
 */
export function CommunityScopeSheet({
  visible,
  mode = 'filter',
  cafes,
  counts,
  value,
  myCafeId,
  favoriteCount,
  onSelect,
  onClose,
}: {
  visible: boolean;
  mode?: 'filter' | 'write';
  cafes: ScopeCafe[];
  counts: Record<string, number>;
  value: Scope;
  myCafeId?: string | null;
  favoriteCount: number;
  onSelect: (scope: Scope) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sido, setSido] = useState<string | null>(null);
  // 학원 / 스터디카페를 따로 골라 볼 수 있게 하는 구분 (지점에 종류 값이 있을 때만 표시)
  const [listKind, setListKind] = useState<'ALL' | 'ACADEMY' | 'STUDY_CAFE'>('ALL');
  const hasKinds = useMemo(() => cafes.some((c) => !!c.kind), [cafes]);
  const shownCafes = useMemo(
    () =>
      !hasKinds || listKind === 'ALL'
        ? cafes
        : cafes.filter((c) => (listKind === 'ACADEMY' ? c.kind === 'ACADEMY' : c.kind !== 'ACADEMY')),
    [cafes, hasKinds, listKind]
  );

  // 열 때: 검색·지역 초기화, 지금 보던 게시판의 종류로 시작
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSido(null);
    const kindOf = (id?: string | null) => cafes.find((c) => c.id === id)?.kind;
    const startKind =
      value.kind === 'type' ? value.type : value.kind === 'cafe' ? kindOf(value.id) : value.kind === 'mine' ? kindOf(myCafeId) : null;
    setListKind(startKind === 'ACADEMY' ? 'ACADEMY' : startKind ? 'STUDY_CAFE' : 'ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sections = useMemo(() => buildScopeSections(shownCafes, counts, query), [shownCafes, counts, query]);
  const regionChips = useMemo(() => buildScopeSections(shownCafes, counts, '').map((s) => s.sido), [shownCafes, counts]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const searching = query.trim().length > 0;
    if (mode === 'filter' && !searching) {
      out.push(
        listKind === 'ALL' || !hasKinds
          ? { type: 'quick', key: 'all', label: hasKinds ? '전체 학원·스터디카페' : '전체 스터디카페', icon: 'mc:view-grid-outline', scope: { kind: 'all' } }
          : {
              type: 'quick',
              key: `type-${listKind}`,
              label: listKind === 'ACADEMY' ? '전체 학원' : '전체 스터디카페',
              icon: 'mc:view-grid-outline',
              scope: { kind: 'type', type: listKind },
            }
      );
      if (myCafeId && shownCafes.some((c) => c.id === myCafeId)) {
        const mine = cafes.find((c) => c.id === myCafeId);
        out.push({
          type: 'quick',
          key: 'mine',
          label: mine?.kind === 'ACADEMY' ? '내 학원' : '내 스터디카페',
          sub: mine?.name.replace('SafeStep ', ''),
          icon: 'home-outline',
          scope: { kind: 'mine' },
        });
      }
      if (favoriteCount > 0) {
        out.push({ type: 'quick', key: 'fav', label: '즐겨찾기', sub: `${favoriteCount}곳`, icon: 'heart-outline', scope: { kind: 'fav' } });
      }
    }
    const visibleSections = sido && !searching ? sections.filter((s) => s.sido === sido) : sections;
    if (mode === 'filter' && sido && !searching) {
      const sec = sections.find((s) => s.sido === sido);
      if (sec) out.push({ type: 'region', key: `r-${sido}`, sido, postCount: sec.postCount });
    }
    for (const sec of visibleSections) {
      for (const c of sec.cafes) {
        out.push({
          type: 'cafe',
          key: `c-${c.id}`,
          id: c.id,
          name: c.name.replace('SafeStep ', ''),
          sub: `${sec.sido} ${c.sigungu}${mode === 'filter' ? ` · 글 ${c.count}개` : ''}`,
          mine: c.id === myCafeId,
        });
      }
    }
    return out;
  }, [sections, sido, query, mode, cafes, shownCafes, listKind, hasKinds, myCafeId, favoriteCount]);

  const isOn = (r: Row): boolean => {
    if (r.type === 'quick') {
      if (r.scope.kind === 'type') return value.kind === 'type' && value.type === r.scope.type;
      return r.scope.kind === value.kind;
    }
    if (r.type === 'region') return value.kind === 'region' && value.sido === r.sido && !value.sigungu;
    if (r.type === 'cafe') return mode === 'filter' && value.kind === 'cafe' && value.id === r.id;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>{mode === 'write' ? '글을 남길 곳' : '게시판 선택'}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        {hasKinds && (
          <View style={styles.kindSeg}>
            {(
              [
                ['ALL', '전체'],
                ['ACADEMY', '학원'],
                ['STUDY_CAFE', '스터디카페'],
              ] as const
            ).map(([v, label]) => (
              <Pressable
                key={v}
                onPress={() => {
                  setListKind(v);
                  setSido(null);
                }}
                style={[styles.kindItem, listKind === v && styles.kindItemOn]}
              >
                <Text style={[styles.kindText, listKind === v && styles.kindTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="이름·지역 검색"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* 지역 칩 — 아코디언 대신 한 줄로 좁혀 보기 */}
        {query.trim().length === 0 && regionChips.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <Pressable onPress={() => setSido(null)} style={[styles.chip, sido === null && styles.chipOn]}>
              <Text style={[styles.chipText, sido === null && styles.chipTextOn]}>전체 지역</Text>
            </Pressable>
            {regionChips.map((r) => (
              <Pressable key={r} onPress={() => setSido(r)} style={[styles.chip, sido === r && styles.chipOn]}>
                <Text style={[styles.chipText, sido === r && styles.chipTextOn]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={30}
          ListEmptyComponent={<Text style={styles.empty}>검색 결과가 없어요</Text>}
          renderItem={({ item }) => {
            const on = isOn(item);
            const pick = () => {
              if (item.type === 'quick') onSelect(item.scope);
              else if (item.type === 'region') onSelect({ kind: 'region', sido: item.sido });
              else if (item.type === 'cafe') onSelect({ kind: 'cafe', id: item.id });
            };
            return (
              <Pressable onPress={pick} style={styles.row}>
                {item.type === 'quick' && <Icon name={item.icon} size={20} color={on ? colors.primary : colors.textSub} />}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.rowText, on && { color: colors.primary, fontWeight: '800' }]} numberOfLines={1}>
                      {item.type === 'quick' ? item.label : item.type === 'region' ? `${item.sido} 전체 게시판` : item.name}
                    </Text>
                    {item.type === 'cafe' && item.mine && <Text style={styles.mine}>내 소속</Text>}
                  </View>
                  {item.type === 'quick' && item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                  {item.type === 'cafe' ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                  {item.type === 'region' ? <Text style={styles.rowSub}>글 {item.postCount}개</Text> : null}
                </View>
                {on && <Icon name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24, height: '72%' },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  kindSeg: { flexDirection: 'row', backgroundColor: '#F3F5F8', borderRadius: 12, padding: 4, marginHorizontal: 20, marginBottom: 10 },
  kindItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  kindItemOn: { backgroundColor: colors.white },
  kindText: { fontSize: 14, fontWeight: '600', color: colors.textSub },
  kindTextOn: { fontWeight: '800', color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F5F8', borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  chipScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 6 },
  chipRow: { paddingHorizontal: 20, gap: 8 },
  chip: { backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  chipTextOn: { color: colors.white },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { fontSize: 15.5, fontWeight: '600', color: colors.text, flexShrink: 1 },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  mine: { fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
});
