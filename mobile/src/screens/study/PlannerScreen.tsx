import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { addDays, format } from 'date-fns';
import { RequireRole } from '../../components/Guard';
import { Button, Chip, DayStepper, Empty, Icon, Input, Screen } from '../../components/ui';
import { SectionHeader } from '../../components/home';
import {
  SUBJECTS,
  daysLeft,
  ddayLabel,
  loadDDays,
  loadTasks,
  newDDay,
  newTask,
  progress,
  saveDDays,
  updateTasks,
  weekProgress,
} from '../../lib/planner';
import type { DDay, Subject, Task, TaskMap } from '../../lib/planner';
import { dayKey, formatMinutes } from '../../lib/studyStats';
import { colors, radius } from '../../theme';

const SUBJECT_COLOR: Record<Subject, string> = {
  수학: '#2563EB',
  영어: '#12A150',
  국어: '#D97706',
  과학: '#7C3AED',
  사회: '#0E9384',
  기타: '#475467',
};
const GOAL_MINUTES = [0, 30, 60, 90, 120];

function Inner() {
  const today = new Date();
  const todayKey = dayKey(today);

  const [tasks, setTasks] = useState<TaskMap>({});
  const [ddays, setDdays] = useState<DDay[]>([]);
  const [selected, setSelected] = useState(todayKey);

  // 새 할 일 입력
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('수학');
  const [minutes, setMinutes] = useState(60);

  // D-day 추가
  const [ddayOpen, setDdayOpen] = useState(false);
  const [ddayTitle, setDdayTitle] = useState('');
  const [ddayDate, setDdayDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));

  const reload = useCallback(async () => {
    setTasks(await loadTasks());
    setDdays(await loadDDays());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const list: Task[] = tasks[selected] ?? [];
  const p = progress(list);
  const week = weekProgress(tasks, today);
  const isToday = selected === todayKey;

  const add = async () => {
    if (!title.trim()) return;
    setTasks(await updateTasks(selected, (l) => [...l, newTask(title, subject, minutes)]));
    setTitle('');
  };
  const toggle = async (id: string) =>
    setTasks(await updateTasks(selected, (l) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t))));
  const remove = async (id: string) => setTasks(await updateTasks(selected, (l) => l.filter((t) => t.id !== id)));
  // 못 끝낸 할 일을 다음 날로
  const carryOver = async () => {
    const undone = list.filter((t) => !t.done);
    if (undone.length === 0) return;
    const next = format(addDays(new Date(`${selected}T00:00:00`), 1), 'yyyy-MM-dd');
    await updateTasks(selected, (l) => l.filter((t) => t.done));
    setTasks(await updateTasks(next, (l) => [...l, ...undone.map((t) => ({ ...t, id: `${t.id}-n`, done: false }))]));
  };

  const addDday = async () => {
    if (!ddayTitle.trim()) return;
    const next = [...ddays, newDDay(ddayTitle, ddayDate)].sort((a, b) => a.date.localeCompare(b.date));
    setDdays(next);
    await saveDDays(next);
    setDdayTitle('');
    setDdayOpen(false);
  };
  const removeDday = async (id: string) => {
    const next = ddays.filter((d) => d.id !== id);
    setDdays(next);
    await saveDDays(next);
  };

  return (
    <Screen>
      {/* D-day */}
      <SectionHeader title="D-day" action={ddayOpen ? '닫기' : '+ 추가'} onAction={() => setDdayOpen((v) => !v)} />
      {ddayOpen && (
        <View style={styles.box}>
          <Input value={ddayTitle} onChangeText={setDdayTitle} placeholder="예: 중간고사, 모의고사" maxLength={30} />
          <View style={{ height: 10 }} />
          <DayStepper value={ddayDate} onChange={setDdayDate} />
          <View style={{ height: 12 }} />
          <Button title="D-day 추가" onPress={addDday} disabled={!ddayTitle.trim()} />
        </View>
      )}
      {ddays.length === 0 ? (
        <Text style={styles.hint}>시험·마감일을 등록하면 남은 날짜를 보여 드려요</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {ddays.map((d) => {
            const left = daysLeft(d.date, today);
            return (
              <View key={d.id} style={styles.dday}>
                <Text style={[styles.ddayBadge, left < 0 && { color: colors.textMuted, backgroundColor: '#F3F5F8' }]}>{ddayLabel(left)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ddayTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={styles.ddayDate}>{d.date}</Text>
                </View>
                <Pressable onPress={() => removeDday(d.id)} hitSlop={10}>
                  <Icon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* 이번 주 */}
      <SectionHeader title="이번 주 계획" />
      <View style={styles.weekRow}>
        {week.map((w) => {
          const on = w.key === selected;
          return (
            <Pressable key={w.key} onPress={() => setSelected(w.key)} style={[styles.weekCell, on && styles.weekCellOn]}>
              <Text style={[styles.weekLabel, on && { color: colors.white }, w.isToday && !on && { color: colors.primary }]}>{w.label}</Text>
              <Text style={[styles.weekNum, on && { color: colors.white }]}>{w.total === 0 ? '·' : `${w.done}/${w.total}`}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 선택한 날의 할 일 */}
      <SectionHeader title={isToday ? '오늘 할 일' : `${selected.slice(5).replace('-', '월 ')}일 할 일`} />
      <View style={styles.progressBox}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={styles.progressNum}>{p.percent}%</Text>
          <Text style={styles.progressSub}>
            {p.total === 0 ? '할 일을 추가해 보세요' : `${p.total}개 중 ${p.done}개 완료${p.planned ? ` · 목표 ${formatMinutes(p.planned)}` : ''}`}
          </Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${p.percent}%` }]} />
        </View>
      </View>

      {list.length === 0 ? (
        <Empty icon="checkbox-outline">아직 할 일이 없어요</Empty>
      ) : (
        <View>
          {list.map((t, i) => (
            <View key={t.id} style={[styles.taskRow, i < list.length - 1 && styles.taskBorder]}>
              <Pressable onPress={() => toggle(t.id)} hitSlop={8}>
                <Icon name={t.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={t.done ? colors.primary : colors.borderStrong} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={[styles.subjectTag, { color: SUBJECT_COLOR[t.subject], backgroundColor: SUBJECT_COLOR[t.subject] + '1A' }]}>{t.subject}</Text>
                  {t.minutes > 0 && <Text style={styles.taskMin}>{formatMinutes(t.minutes)}</Text>}
                </View>
              </View>
              <Pressable onPress={() => remove(t.id)} hitSlop={10}>
                <Icon name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {list.some((t) => !t.done) && (
        <Pressable onPress={carryOver} style={styles.carry}>
          <Icon name="arrow-forward-circle-outline" size={16} color={colors.textSub} />
          <Text style={styles.carryText}>못 끝낸 할 일 내일로 넘기기</Text>
        </Pressable>
      )}

      {/* 새 할 일 */}
      <View style={styles.box}>
        <Input value={title} onChangeText={setTitle} placeholder="무엇을 공부할까요? (예: 수학 문제집 30쪽)" maxLength={60} onSubmitEditing={add} returnKeyType="done" />
        <Text style={styles.label}>과목</Text>
        <View style={styles.chips}>
          {SUBJECTS.map((s) => (
            <Chip key={s} label={s} selected={subject === s} onPress={() => setSubject(s)} />
          ))}
        </View>
        <Text style={styles.label}>목표 시간</Text>
        <View style={styles.chips}>
          {GOAL_MINUTES.map((m) => (
            <Chip key={m} label={m === 0 ? '없음' : formatMinutes(m)} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>
        <View style={{ height: 14 }} />
        <Button title="할 일 추가" onPress={add} disabled={!title.trim()} />
      </View>
    </Screen>
  );
}

export default function PlannerScreen() {
  return (
    <RequireRole roles={['STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#F7F8FA', borderRadius: radius.lg, padding: 16, marginTop: 8 },
  hint: { fontSize: 13, color: colors.textMuted },
  dday: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F8FA', borderRadius: radius.lg, padding: 14 },
  ddayBadge: { fontSize: 15, fontWeight: '800', color: colors.primary, backgroundColor: '#EEF4FF', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, textAlign: 'center' },
  ddayTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ddayDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#F3F5F8' },
  weekCellOn: { backgroundColor: colors.primary },
  weekLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  weekNum: { fontSize: 12, fontWeight: '800', color: colors.text, marginTop: 4 },
  progressBox: { marginBottom: 8 },
  progressNum: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  progressSub: { fontSize: 13, color: colors.textSub, flexShrink: 1 },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#ECEFF3', marginTop: 10, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  taskBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  taskTitle: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  taskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  subjectTag: { fontSize: 11, fontWeight: '800', borderRadius: 6, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2 },
  taskMin: { fontSize: 12, color: colors.textMuted },
  carry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 10 },
  carryText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
