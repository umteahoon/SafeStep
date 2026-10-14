import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Icon, IconTile } from './ui';
import { colors, radius } from '../theme';

interface Info {
  name: string;
  address: string;
  teachers: string[] | null;
  classCount: number | null;
}

/**
 * 홈 최상단 학원 카드 — 소속 학원의 이름·위치·강사·반·학생 수를 한눈에.
 * 일부 정보는 권한에 따라 못 읽을 수 있어, 읽은 항목만 표시합니다.
 */
export function AcademyCard({
  academyId,
  onPress,
}: {
  academyId: string | null | undefined;
  onPress?: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!academyId) return;
      let alive = true;
      (async () => {
        try {
          const [{ data: ac }, { data: tch }, { data: cls }] = await Promise.all([
            supabase.from('academies').select('name, address').eq('id', academyId).maybeSingle(),
            supabase.from('profiles').select('name').eq('academy_id', academyId).eq('role', 'TEACHER').eq('approval_status', 'APPROVED'),
            supabase.from('classes').select('id').eq('academy_id', academyId),
          ]);
          if (!alive || !ac) return;
          setInfo({
            name: String((ac as any).name),
            address: String((ac as any).address ?? ''),
            teachers: tch ? (tch as any[]).map((t) => String(t.name)) : null,
            classCount: cls ? (cls as any[]).length : null,
          });
        } catch {
          /* 카드는 부가 정보 — 실패해도 홈은 계속 */
        }
      })();
      return () => {
        alive = false;
      };
    }, [academyId])
  );

  if (!academyId || !info) return null;

  const stats: { label: string; value: string }[] = [];
  if (info.teachers) stats.push({ label: '강사', value: `${info.teachers.length}명` });
  if (info.classCount !== null) stats.push({ label: '반', value: `${info.classCount}개` });

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.head}>
        <IconTile name="mc:school-outline" color={colors.primary} bg={colors.primary + '1A'} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {info.name}
          </Text>
        </View>
        {onPress && <Icon name="chevron-forward" size={18} color={colors.textMuted} />}
      </View>

      {!!info.address && (
        <View style={styles.addrRow}>
          <Icon name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.addr} numberOfLines={1}>
            {info.address}
          </Text>
        </View>
      )}

      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {info.teachers && info.teachers.length > 0 && (
        <Text style={styles.teachers} numberOfLines={1}>
          담당 강사 · {info.teachers.join(', ')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#EEF4FF', borderRadius: radius.lg, padding: 18, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  addr: { flex: 1, fontSize: 13, color: colors.textSub },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  teachers: { fontSize: 12, color: colors.textSub, marginTop: 12 },
});
