import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { formatMinutes } from '../../lib/studyStats';
import { RequireRole } from '../../components/Guard';
import { Badge, Card, Empty, Icon, IconTile, Loading, Muted, Screen, Segmented } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { colors } from '../../theme';
import type { StudentPass } from '../../types';

interface Log {
  id: string;
  type: string;
  seat_number: number | null;
  logged_at: string;
  stay_duration_minutes: number | null;
}

const TYPE: Record<string, { label: string; icon: IconName; tint: string; bg: string }> = {
  CHECK_IN: { label: '입실', icon: 'log-in', tint: '#2563EB', bg: '#EAF1FF' },
  CHECK_OUT: { label: '퇴실', icon: 'log-out', tint: '#D92D20', bg: '#FEECEC' },
  AWAY: { label: '외출', icon: 'walk', tint: '#B54708', bg: '#FFF4DB' },
  RETURN: { label: '복귀', icon: 'return-down-back', tint: '#12A150', bg: '#E6F7EE' },
  MOVE: { label: '자리 이동', icon: 'swap-horizontal', tint: '#4F46E5', bg: '#ECEBFF' },
};
const PASS_STATUS: Record<string, string> = { ACTIVE: '이용 중', DEPLETED: '소진됨', EXPIRED: '만료됨' };

const dateTitle = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
const timeText = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

function Inner() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'logs' | 'pay'>('logs');
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [passes, setPasses] = useState<StudentPass[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
    if (!st) {
      setLogs([]);
      return;
    }
    const sid = (st as any).id;
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('attendance_logs').select('*').eq('student_id', sid).order('logged_at', { ascending: false }).limit(200),
      supabase.from('student_passes').select('*').eq('student_id', sid).order('created_at', { ascending: false }),
    ]);
    setLogs((l as Log[]) ?? []);
    setPasses((p as StudentPass[]) ?? []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 날짜별 그룹
  const groups: { title: string; rows: Log[] }[] = [];
  for (const l of logs ?? []) {
    const t = dateTitle(l.logged_at);
    const last = groups[groups.length - 1];
    if (last && last.title === t) last.rows.push(l);
    else groups.push({ title: t, rows: [l] });
  }

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'logs', label: '입·퇴실 기록' },
          { value: 'pay', label: '결제 내역' },
        ]}
      />
      <View style={{ height: 14 }} />

      {logs === null ? (
        <Loading />
      ) : tab === 'logs' ? (
        groups.length === 0 ? (
          <Empty icon="time-outline">아직 이용 기록이 없어요</Empty>
        ) : (
          groups.map((g) => (
            <View key={g.title}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSub, marginTop: 8, marginBottom: 8, marginLeft: 4 }}>{g.title}</Text>
              <Card style={{ padding: 4 }}>
                {g.rows.map((r, i) => {
                  const t = TYPE[r.type] ?? TYPE.CHECK_IN;
                  return (
                    <View
                      key={r.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        borderBottomWidth: i < g.rows.length - 1 ? 0.5 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <IconTile name={t.icon} color={t.tint} bg={t.bg} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{t.label}</Text>
                        <Muted>{r.seat_number ? `${r.seat_number}번 좌석` : '좌석 정보 없음'}</Muted>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSub }}>{timeText(r.logged_at)}</Text>
                        {r.type === 'CHECK_OUT' && !!r.stay_duration_minutes && (
                          <Badge text={`${formatMinutes(r.stay_duration_minutes)} 이용`} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )
      ) : passes.length === 0 ? (
        <Empty icon="receipt-outline">결제 내역이 없어요</Empty>
      ) : (
        passes.map((p) => (
          <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile name="ticket" color={colors.indigo} bg={colors.indigoSoft} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{p.product_name}</Text>
              <Muted>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : ''}</Muted>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{p.amount.toLocaleString()}원</Text>
              <Badge
                text={PASS_STATUS[p.status] ?? p.status}
                bg={p.status === 'ACTIVE' ? colors.indigoSoft : colors.graySoft}
                fg={p.status === 'ACTIVE' ? colors.indigo : colors.gray}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function HistoryScreen() {
  return (
    <RequireRole roles={['STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}
