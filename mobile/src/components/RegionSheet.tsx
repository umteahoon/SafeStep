import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import type { SidoGroup } from '../lib/region';
import { colors } from '../theme';

export interface RegionValue {
  sido: string | null;
  sigungu: string | null;
}

/**
 * 지역 선택 바텀시트 — 왼쪽에서 시/도, 오른쪽에서 구/시를 고르는 2단 구조.
 * "전체"를 누르면 그 시/도 전체, 하단 "전체 지역"은 선택 해제.
 */
export function RegionSheet({
  visible,
  groups,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  groups: SidoGroup[];
  value: RegionValue;
  onSelect: (v: RegionValue) => void;
  onClose: () => void;
}) {
  // 시트 안에서 둘러보는 시/도 — 왼쪽 목록을 눌러도 선택이 적용되지 않고 오른쪽 구/시 목록만 바뀜
  const [browse, setBrowse] = useState<string | null>(value.sido);
  useEffect(() => {
    if (visible) setBrowse(value.sido);
  }, [visible, value.sido]);
  const active = groups.find((g) => g.sido === browse) ?? groups[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>지역 선택</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.empty}>선택할 수 있는 지역이 없어요</Text>
        ) : (
          <View style={styles.panes}>
            {/* 시/도 */}
            <FlatList
              style={styles.left}
              data={groups}
              keyExtractor={(g) => g.sido}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const on = item.sido === active?.sido;
                return (
                  <Pressable
                    onPress={() => setBrowse(item.sido)}
                    style={[styles.sido, on && styles.sidoOn]}
                  >
                    <Text style={[styles.sidoText, on && styles.sidoTextOn]}>{item.sido}</Text>
                    <Text style={[styles.count, on && { color: colors.primary }]}>{item.count}</Text>
                  </Pressable>
                );
              }}
            />
            {/* 구/시 */}
            <FlatList
              style={styles.right}
              data={[{ name: '__all__', count: active?.count ?? 0, empty: active?.empty ?? 0 }, ...(active?.districts ?? [])]}
              keyExtractor={(d) => d.name}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isAll = item.name === '__all__';
                const on = value.sido === active?.sido && (isAll ? !value.sigungu : value.sigungu === item.name);
                return (
                  <Pressable
                    onPress={() => active && onSelect({ sido: active.sido, sigungu: isAll ? null : item.name })}
                    style={styles.district}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.districtText, on && { color: colors.primary, fontWeight: '800' }]}>
                        {isAll ? `${active?.sido} 전체` : item.name}
                      </Text>
                      <Text style={styles.districtSub}>스터디카페 {item.count}곳</Text>
                    </View>
                    {on && <Icon name="checkmark" size={20} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        <Pressable onPress={() => onSelect({ sido: null, sigungu: null })} style={styles.reset}>
          <Text style={styles.resetText}>전체 지역 보기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 28, height: '62%' },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 40 },
  panes: { flex: 1, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  left: { width: 118, backgroundColor: '#F7F8FA' },
  sido: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  sidoOn: { backgroundColor: colors.white },
  sidoText: { fontSize: 15, fontWeight: '600', color: colors.textSub },
  sidoTextOn: { color: colors.text, fontWeight: '800' },
  count: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  right: { flex: 1 },
  district: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  districtText: { fontSize: 15, fontWeight: '600', color: colors.text },
  districtSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  reset: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 18 },
  resetText: { fontSize: 13, color: colors.textSub, fontWeight: '700', textDecorationLine: 'underline' },
});
