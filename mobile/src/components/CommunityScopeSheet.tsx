import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from './ui';
import { buildScopeSections } from '../lib/communityScope';
import type { Scope, ScopeCafe } from '../lib/communityScope';
import { colors } from '../theme';

type Row =
  | { type: 'quick'; key: string; label: string; sub?: string; icon: any; scope: Scope }
  | { type: 'header'; key: string; sido: string; cafeCount: number; postCount: number; open: boolean }
  | { type: 'region'; key: string; sido: string; postCount: number }
  | { type: 'cafe'; key: string; id: string; name: string; sub: string; mine: boolean };

/**
 * 커뮤니티에서 "어느 게시판을 볼지" 고르는 시트. 한 번에 끝나도록
 *  - 맨 위 빠른 선택(전체 / 내 스터디카페 / 즐겨찾기)
 *  - 시/도별 섹션을 펼치면 그 아래에 바로 스터디카페 목록 ("서울 전체"도 같은 곳에)
 *  - 검색하면 이름·주소가 맞는 스터디카페가 모든 지역에서 바로 나옴
 * mode='write' 이면 글을 남길 스터디카페 하나만 고르도록 지점만 보여줌.
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
  const [open, setOpen] = useState<Set<string>>(new Set());
  const sections = useMemo(() => buildScopeSections(cafes, counts, query), [cafes, counts, query]);

  // 열 때: 검색 초기화, 현재 선택·내 소속이 있는 지역을 펼쳐 둠
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    const initial = new Set<string>();
    const all = buildScopeSections(cafes, counts, '');
    const sidoOf = (id?: string | null) => all.find((s) => s.cafes.some((c) => c.id === id))?.sido;
    if (value.kind === 'region') initial.add(value.sido);
    if (value.kind === 'cafe') sidoOf(value.id) && initial.add(sidoOf(value.id)!);
    if (myCafeId) sidoOf(myCafeId) && initial.add(sidoOf(myCafeId)!);
    if (initial.size === 0 && all[0]) initial.add(all[0].sido);
    setOpen(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const searching = query.trim().length > 0;
    if (mode === 'filter' && !searching) {
      out.push({ type: 'quick', key: 'all', label: '전체 스터디카페', icon: 'mc:view-grid-outline', scope: { kind: 'all' } });
      if (myCafeId) {
        const mine = cafes.find((c) => c.id === myCafeId);
        out.push({
          type: 'quick',
          key: 'mine',
          label: '내 스터디카페',
          sub: mine?.name.replace('SafeStep ', ''),
          icon: 'home-outline',
          scope: { kind: 'mine' },
        });
      }
      if (favoriteCount > 0) {
        out.push({ type: 'quick', key: 'fav', label: '즐겨찾기', sub: `${favoriteCount}곳`, icon: 'heart-outline', scope: { kind: 'fav' } });
      }
    }
    for (const sec of sections) {
      const isOpen = searching || open.has(sec.sido);
      out.push({ type: 'header', key: `h-${sec.sido}`, sido: sec.sido, cafeCount: sec.cafeCount, postCount: sec.postCount, open: isOpen });
      if (!isOpen) continue;
      if (mode === 'filter' && !searching) out.push({ type: 'region', key: `r-${sec.sido}`, sido: sec.sido, postCount: sec.postCount });
      for (const c of sec.cafes) {
        out.push({
          type: 'cafe',
          key: `c-${c.id}`,
          id: c.id,
          name: c.name.replace('SafeStep ', ''),
          sub: `${c.sigungu}${mode === 'filter' ? ` · 글 ${c.count}개` : ''}`,
          mine: c.id === myCafeId,
        });
      }
    }
    return out;
  }, [sections, open, query, mode, cafes, myCafeId, favoriteCount]);

  const isOn = (r: Row): boolean => {
    if (r.type === 'quick') return r.scope.kind === value.kind;
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
          <Text style={styles.title}>{mode === 'write' ? '글을 남길 스터디카페' : '게시판 선택'}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="스터디카페 이름·지역 검색"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={40}
          ListEmptyComponent={<Text style={styles.empty}>검색 결과가 없어요</Text>}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Pressable
                  onPress={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      next.has(item.sido) ? next.delete(item.sido) : next.add(item.sido);
                      return next;
                    })
                  }
                  style={styles.header}
                >
                  <Text style={styles.headerText}>{item.sido}</Text>
                  <Text style={styles.headerSub}>
                    스터디카페 {item.cafeCount}곳{mode === 'filter' ? ` · 글 ${item.postCount}개` : ''}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Icon name={item.open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>
              );
            }
            const on = isOn(item);
            const pick = () => {
              if (item.type === 'quick') onSelect(item.scope);
              else if (item.type === 'region') onSelect({ kind: 'region', sido: item.sido });
              else if (item.type === 'cafe') onSelect({ kind: 'cafe', id: item.id });
            };
            return (
              <Pressable onPress={pick} style={[styles.row, item.type !== 'quick' && { paddingLeft: 36 }]}>
                {item.type === 'quick' && <Icon name={item.icon} size={20} color={on ? colors.primary : colors.textSub} />}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.rowText, on && { color: colors.primary, fontWeight: '800' }]}>
                      {item.type === 'quick' ? item.label : item.type === 'region' ? `${item.sido} 전체` : item.name}
                    </Text>
                    {item.type === 'cafe' && item.mine && <Text style={styles.mine}>내 스터디카페</Text>}
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F5F8', borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 12, height: 42, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 40 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 22, paddingVertical: 14, backgroundColor: '#F7F8FA', marginTop: 8 },
  headerText: { fontSize: 15, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  mine: { fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
});
