import { useCallback, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useLiveSeat } from '../../lib/liveSeat';
import { getFocusDaily, getWeeklyGoal, setWeeklyGoal } from '../../lib/focusLog';
import { activeDays, dailyMinutes, dayKey, formatMinutes, monthTotal, streak, weekBars, weekTotal } from '../../lib/studyStats';
import type { LogRow } from '../../lib/studyStats';
import { RequireRole } from '../../components/Guard';
import { GoalCard, LiveSeatCard, WeekChart } from '../../components/study';
import { QuickGrid, SectionHeader } from '../../components/home';
import { Card, Icon, LargeHeader, Loading, Muted, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user } = useAuth();
  const live = useLiveSeat();
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [focusDaily, setFocusDaily] = useState<Record<string, number>>({});
  const [goal, setGoal] = useState(20);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
    if (st) {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('student_id', (st as any).id)
        .order('logged_at', { ascending: false })
        .limit(1000);
      setLogs((data as LogRow[]) ?? []);
    } else {
      setLogs([]);
    }
    setFocusDaily(await getFocusDaily());
    setGoal(await getWeeklyGoal());
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), live.reload()]);
    setRefreshing(false);
  };

  const changeGoal = (h: number) => {
    setGoal(h);
    setWeeklyGoal(h);
  };

  const today = new Date();
  const daily = dailyMinutes(logs ?? []);
  // 지금 이용 중인 시간도 오늘 학습에 포함
  const liveMin = live.seat ? Math.floor(live.elapsedSec / 60) : 0;
  const todayKey = dayKey(today);
  const dailyWithLive = { ...daily, [todayKey]: (daily[todayKey] ?? 0) + liveMin };
  const bars = weekBars(dailyWithLive, today);
  const wk = weekTotal(bars);
  const todayMin = dailyWithLive[todayKey] ?? 0;
  const focusToday = focusDaily[todayKey] ?? 0;

  return (
    <Screen
      edges={['top', 'left', 'right']}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LargeHeader title="내 공부" subtitle="이용 기록과 목표를 한눈에" />

      {live.seat && (
        <LiveSeatCard
          seat={live.seat}
          academyName={live.academyName}
          elapsedSec={live.elapsedSec}
          onPress={() => navigation.navigate('Kiosk', { academyId: live.seat!.academy_id, self: true })}
        />
      )}

      {logs === null ? (
        <Loading />
      ) : (
        <>
          <Card>
            <Muted>오늘 학습 시간</Muted>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1, marginTop: 4 }}>
              {formatMinutes(todayMin)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <Icon name="timer-outline" size={14} color={colors.textMuted} />
              <Muted>집중 타이머 {formatMinutes(focusToday)}</Muted>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <Card style={{ flex: 1, marginBottom: 0 }}>
              <Icon name="flame" size={22} color="#F97316" />
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 }}>{streak(dailyWithLive, today)}일</Text>
              <Muted>연속 학습</Muted>
            </Card>
            <Card style={{ flex: 1, marginBottom: 0 }}>
              <Icon name="calendar" size={22} color={colors.primary} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 }}>{formatMinutes(monthTotal(dailyWithLive, today))}</Text>
              <Muted>이번 달 누적</Muted>
            </Card>
            <Card style={{ flex: 1, marginBottom: 0 }}>
              <Icon name="ribbon" size={22} color="#12A150" />
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 }}>{activeDays(dailyWithLive)}일</Text>
              <Muted>총 이용일</Muted>
            </Card>
          </View>

          <GoalCard weekMinutes={wk} goalHours={goal} onChange={changeGoal} />

          <SectionHeader title="이번 주 학습" />
          <Card>
            <WeekChart bars={bars} />
          </Card>
        </>
      )}

      <SectionHeader title="학습 도구" />
      <QuickGrid
        items={[
          { label: '집중 타이머', icon: 'timer', color: '#2563EB', bg: '#EAF1FF', onPress: () => navigation.navigate('FocusTimer') },
          { label: '내 시간표', icon: 'calendar', color: '#B54708', bg: '#FFF4DB', onPress: () => navigation.navigate('Timetable') },
          { label: '이용 내역', icon: 'receipt', color: '#4F46E5', bg: '#ECEBFF', onPress: () => navigation.navigate('History') },
          { label: '이용권', icon: 'ticket', color: '#12A150', bg: '#E6F7EE', onPress: () => navigation.navigate('StudentPasses') },
          { label: '내 QR', icon: 'qr-code', color: '#2563EB', bg: '#EAF1FF', onPress: () => navigation.navigate('StudentQr') },
          { label: '알림', icon: 'notifications', color: '#D92D20', bg: '#FEECEC', onPress: () => navigation.navigate('Notifications') },
        ]}
      />
    </Screen>
  );
}

export default function StudyScreen() {
  return (
    <RequireRole roles={['STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}
