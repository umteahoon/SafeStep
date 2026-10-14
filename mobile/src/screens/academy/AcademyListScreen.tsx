import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { placeImage } from '../../lib/cafeImages';
import { Badge, Empty, Icon, Loading, Screen } from '../../components/ui';
import { colors, shadow } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Academy } from '../../types';

type Row = Pick<Academy, 'id' | 'name' | 'address' | 'kind'>;

/**
 * 학원 탭 — 등록된 학원을 모두 보여주고, 누르면 그 학원의 채팅방·공지방·출결 화면으로 이동.
 * 내 소속 학원은 맨 위에 "내 학원"으로 표시.
 */
export default function AcademyListScreen() {
  const navigation = useNavigation<RootNav>();
  const { academyId: myAcademyId } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('academies').select('id, name, address, kind').order('name');
    setRows((data as Row[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || (r.address ?? '').toLowerCase().includes(q));
    return [...list].sort((a, b) => Number(b.id === myAcademyId) - Number(a.id === myAcademyId));
  }, [rows, query, myAcademyId]);

  return (
    <Screen scroll={false} edges={['top', 'left', 'right']} backgroundColor={colors.white} keyboardAvoiding={false}>
      <View style={styles.header}>
        <Text style={styles.title}>학원</Text>
        <Text style={styles.sub}>학원을 골라 채팅방·공지방·출결을 한 번에 확인하세요</Text>
      </View>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="학원 이름이나 주소 검색"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {rows === null ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
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
          ListEmptyComponent={<Empty icon="school-outline">{query ? `"${query}"에 맞는 학원이 없어요` : '등록된 학원이 아직 없어요'}</Empty>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('AcademyHome', { academyId: item.id })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              accessibilityLabel={item.name}
            >
              <Image source={placeImage(item.id, item.kind)} style={styles.thumb} resizeMode="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.id === myAcademyId && <Badge text="내 학원" />}
                </View>
                <Text style={styles.addr} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F5F8', borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 12, height: 42, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 12, marginBottom: 10, ...shadow },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#E5E7EB' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  addr: { fontSize: 12.5, color: colors.textMuted },
});
