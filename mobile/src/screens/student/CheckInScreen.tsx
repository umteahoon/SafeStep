import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Empty, Icon, Loading, Screen, SectionTitle } from '../../components/ui';
import { STATUS_LABEL, checkInWindow, expectedStatus, nowMinutes, windowMessage } from '../../lib/checkIn';
import { colors, shadow } from '../../theme';
import type { Class, ClassAttendanceRecord, ClassSchedule } from '../../types';

interface Today {
  cls: Class;
  schedule: ClassSchedule;
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

function Inner() {
  const { student } = useAuth();
  const [today, setToday] = useState<Today[]>([]);
  const [records, setRecords] = useState<ClassAttendanceRecord[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<Record<string, string>>({}); // classId → status
  const [tick, setTick] = useState(0);

  // 1분마다 시간 규칙(버튼 활성 여부)을 다시 계산
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!student) return;
    const { data: enr } = await supabase.from('class_enrollments').select('class_id').eq('student_id', student.id);
    const classIds = ((enr as { class_id: string }[]) ?? []).map((e) => e.class_id);
    if (classIds.length === 0) {
      setToday([]);
      setRecords([]);
      setLoading(false);
      return;
    }
    const dow = new Date().getDay();
    const [{ data: cls }, { data: sch }, { data: recs }] = await Promise.all([
      supabase.from('classes').select('*').in('id', classIds),
      supabase.from('class_schedules').select('*').in('class_id', classIds).eq('day_of_week', dow),
      supabase
        .from('class_attendance_records')
        .select('*')
        .eq('student_id', student.id)
        .order('date', { ascending: false })
        .limit(60),
    ]);
    const classes = (cls as Class[]) ?? [];
    setClassNames(Object.fromEntries(classes.map((c) => [c.id, c.name])));
    const items: Today[] = [];
    for (const s of (sch as ClassSchedule[]) ?? []) {
      const c = classes.find((x) => x.id === s.class_id);
      if (c) items.push({ cls: c, schedule: s });
    }
    items.sort((a, b) => a.schedule.start_time.localeCompare(b.schedule.start_time));
    setToday(items);
    setRecords((recs as ClassAttendanceRecord[]) ?? []);
    setLoading(false);
  }, [student]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const doneToday = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of records) if (r.date === todayStr()) m[r.class_id] = r.status;
    return { ...m, ...justDone };
  }, [records, justDone]);

  const checkIn = async (classId: string) => {
    setError(null);
    setBusyId(classId);
    const { data, error: e } = await supabase.rpc('student_check_in', { p_class_id: classId });
    setBusyId(null);
    if (e) {
      setError(e.message);
      return;
    }
    const status = (data as { status?: string } | null)?.status ?? 'PRESENT';
    setJustDone((d) => ({ ...d, [classId]: status }));
    load();
  };

  if (loading) return <Loading />;

  const now = nowMinutes();
  void tick;

  return (
    <Screen contentStyle={{ padding: 20, gap: 14 }}>
      <Text style={styles.date}>{format(new Date(), 'M월 d일 EEEE', { locale: ko })}</Text>
      <Banner kind="error">{error ?? undefined}</Banner>

      {today.length === 0 ? (
        <View style={[styles.bigCard, { backgroundColor: '#F3F5F8' }]}>
          <Icon name="calendar-outline" size={44} color={colors.textMuted} />
          <Text style={styles.bigTitle}>오늘은 수업이 없어요</Text>
          <Text style={styles.bigSub}>수업이 있는 날 시작 30분 전부터 출석 버튼이 열려요</Text>
        </View>
      ) : (
        today.map(({ cls, schedule }) => {
          const done = doneToday[cls.id];
          const win = checkInWindow(now, schedule.start_time, schedule.end_time);
          const timeText = `${schedule.start_time.slice(0, 5)} ~ ${schedule.end_time.slice(0, 5)}`;
          if (done) {
            return (
              <View key={cls.id} style={[styles.bigCard, { backgroundColor: colors.successSoft }]} accessibilityLabel="출석 완료">
                <Icon name="checkmark-circle" size={72} color={colors.success} />
                <Text style={[styles.bigTitle, { color: colors.success }]}>출석되었습니다</Text>
                <Text style={styles.bigSub}>
                  {cls.name} · {timeText} · {STATUS_LABEL[done] ?? done}
                </Text>
              </View>
            );
          }
          const open = win === 'open';
          const expected = expectedStatus(now, schedule.start_time);
          return (
            <View key={cls.id} style={{ gap: 8 }}>
              <Pressable
                onPress={() => checkIn(cls.id)}
                disabled={!open || busyId === cls.id}
                accessibilityLabel="출석하기"
                style={({ pressed }) => [
                  styles.bigCard,
                  { backgroundColor: open ? colors.primary : '#E5E7EB' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Icon name="finger-print" size={64} color={open ? colors.white : colors.textMuted} />
                <Text style={[styles.bigTitle, { color: open ? colors.white : colors.textMuted }]}>
                  {busyId === cls.id ? '처리 중...' : '출석하기'}
                </Text>
                <Text style={[styles.bigSub, { color: open ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>
                  {cls.name} · {timeText}
                </Text>
              </Pressable>
              {open ? (
                expected === 'LATE' && <Banner kind="warn">수업 시작 10분이 지나 지각으로 기록돼요</Banner>
              ) : (
                <Banner kind="info">{windowMessage(win, schedule.start_time)}</Banner>
              )}
            </View>
          );
        })
      )}

      <SectionTitle>내 출석 기록</SectionTitle>
      {records.length === 0 ? (
        <Empty icon="document-text-outline">아직 출석 기록이 없어요</Empty>
      ) : (
        <View style={styles.history}>
          {records.map((r, i) => (
            <View key={r.id} style={[styles.histRow, i < records.length - 1 && styles.histLine]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histClass} numberOfLines={1}>
                  {classNames[r.class_id] ?? '수업'}
                </Text>
                <Text style={styles.histDate}>{format(new Date(r.date + 'T00:00:00'), 'M월 d일 (EEE)', { locale: ko })}</Text>
              </View>
              <Badge
                text={STATUS_LABEL[r.status] ?? r.status}
                bg={r.status === 'PRESENT' ? colors.successSoft : r.status === 'LATE' || r.status === 'EXCUSED' ? colors.warnSoft : '#FEE2E2'}
                fg={r.status === 'PRESENT' ? colors.success : r.status === 'LATE' || r.status === 'EXCUSED' ? colors.warnText : colors.danger}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

export default function CheckInScreen() {
  return (
    <RequireRole roles={['STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  date: { fontSize: 15, fontWeight: '700', color: colors.textSub },
  bigCard: { alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28, paddingVertical: 44, paddingHorizontal: 20, minHeight: 250, ...shadow },
  bigTitle: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  bigSub: { fontSize: 14, color: colors.textSub, textAlign: 'center' },
  history: { backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 16 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  histLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  histClass: { fontSize: 15, fontWeight: '600', color: colors.text },
  histDate: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
});
