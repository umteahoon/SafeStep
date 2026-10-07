import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Card, Empty, Loading, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { Class, ClassSchedule } from '../../types';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const ROW_H = 56;
const TIME_W = 38;

const toMin = (t: string) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};

function Inner() {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !profile) return;
    let classIds: string[] = [];
    if (profile.role === 'STUDENT') {
      const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
      if (st) {
        const { data: en } = await supabase.from('class_enrollments').select('class_id').eq('student_id', (st as any).id);
        classIds = ((en as any[]) ?? []).map((e) => e.class_id);
      }
    } else if (profile.academy_id) {
      const { data: cls } = await supabase.from('classes').select('id').eq('academy_id', profile.academy_id);
      classIds = ((cls as any[]) ?? []).map((c) => c.id);
    }
    if (classIds.length === 0) {
      setClasses([]);
      setSchedules([]);
      setLoading(false);
      return;
    }
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('classes').select('*').in('id', classIds),
      supabase.from('class_schedules').select('*').in('class_id', classIds),
    ]);
    setClasses((c as Class[]) ?? []);
    setSchedules((s as ClassSchedule[]) ?? []);
    setLoading(false);
  }, [user, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;

  // 월~토 + 일요일 수업이 있으면 일요일까지
  const hasSunday = schedules.some((s) => s.day_of_week === 0);
  const days = hasSunday ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6];
  const startH = schedules.length ? Math.max(0, Math.floor(Math.min(...schedules.map((s) => toMin(s.start_time))) / 60) - 1) : 9;
  const endH = schedules.length ? Math.min(24, Math.ceil(Math.max(...schedules.map((s) => toMin(s.end_time))) / 60) + 1) : 21;
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const colW = (Dimensions.get('window').width - 32 - TIME_W) / days.length;
  const todayDow = new Date().getDay();
  const classById = (id: string) => classes.find((c) => c.id === id);

  return (
    <Screen>
      {schedules.length === 0 ? (
        <Empty icon="calendar-outline">
          {profile?.role === 'STUDENT' ? '배정된 수업이 없어요.\n원장에게 반 배정을 요청하세요.' : '등록된 시간표가 없어요.'}
        </Empty>
      ) : (
        <>
          <Card style={{ padding: 10 }}>
            {/* 요일 헤더 */}
            <View style={{ flexDirection: 'row', marginLeft: TIME_W, marginBottom: 6 }}>
              {days.map((d) => (
                <View key={d} style={{ width: colW, alignItems: 'center' }}>
                  <Text style={[styles.dayLabel, d === todayDow && styles.dayToday]}>{DAY_LABELS[d]}</Text>
                </View>
              ))}
            </View>
            <ScrollView style={{ maxHeight: 520 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row' }}>
                {/* 시간 축 */}
                <View style={{ width: TIME_W }}>
                  {hours.map((h) => (
                    <Text key={h} style={[styles.hour, { height: ROW_H }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {/* 격자 + 수업 블록 */}
                <View style={{ width: colW * days.length, height: ROW_H * hours.length }}>
                  {hours.map((h, i) => (
                    <View key={h} style={[styles.gridLine, { top: i * ROW_H }]} />
                  ))}
                  {days.map((d, i) => (
                    <View
                      key={d}
                      style={{
                        position: 'absolute',
                        left: i * colW,
                        top: 0,
                        bottom: 0,
                        width: colW,
                        backgroundColor: d === todayDow ? 'rgba(37,99,235,0.05)' : 'transparent',
                      }}
                    />
                  ))}
                  {schedules.map((s) => {
                    const col = days.indexOf(s.day_of_week);
                    if (col < 0) return null;
                    const c = classById(s.class_id);
                    const top = ((toMin(s.start_time) - startH * 60) / 60) * ROW_H;
                    const height = Math.max(26, ((toMin(s.end_time) - toMin(s.start_time)) / 60) * ROW_H);
                    return (
                      <View
                        key={s.id}
                        style={[styles.block, { left: col * colW + 1.5, top: top + 1, width: colW - 3, height: height - 2, backgroundColor: c?.color_code ?? colors.primary }]}
                      >
                        <Text style={styles.blockTitle} numberOfLines={3}>
                          {c?.name}
                        </Text>
                        <Text style={styles.blockTime}>{String(s.start_time).slice(0, 5)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Card>

          <SectionTitle>수업 목록</SectionTitle>
          {classes.map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color_code }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>{c.name}</Text>
                <Muted>
                  {schedules
                    .filter((s) => s.class_id === c.id)
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((s) => `${DAY_LABELS[s.day_of_week]} ${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}`)
                    .join(' · ')}
                </Muted>
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

export default function TimetableScreen() {
  return (
    <RequireRole roles={['STUDENT', 'ACADEMY_ADMIN', 'TEACHER']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  dayToday: { color: colors.primary },
  hour: { fontSize: 11, color: colors.textMuted, textAlign: 'right', paddingRight: 6, marginTop: -6 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  block: { position: 'absolute', borderRadius: 8, padding: 4, overflow: 'hidden' },
  blockTitle: { color: colors.white, fontSize: 10, fontWeight: '800', lineHeight: 13 },
  blockTime: { color: 'rgba(255,255,255,0.85)', fontSize: 9, marginTop: 2 },
});
