import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Button, Card, Empty, Loading, Muted, Screen, Segmented } from '../../components/ui';
import { colors } from '../../theme';
import type { Seat } from '../../types';

interface SeatReport {
  id: string;
  academy_id: string;
  seat_number: number;
  reason: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = { NOISE: '소음', MONOPOLY: '자리 독점', OTHER: '기타' };

function Inner() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [reports, setReports] = useState<SeatReport[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [tab, setTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySeat, setBusySeat] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!academyId) return;
    const [{ data: r, error: e }, { data: s }] = await Promise.all([
      supabase.from('seat_reports').select('*').eq('academy_id', academyId).order('created_at', { ascending: false }),
      supabase.from('seats').select('*').eq('academy_id', academyId),
    ]);
    setReports((r as SeatReport[]) ?? []);
    setSeats((s as Seat[]) ?? []);
    setError(e?.message ?? null);
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string) => {
    await supabase.from('seat_reports').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const forceCheckout = async (seatNumber: number) => {
    const seat = seats.find((s) => s.seat_number === seatNumber);
    if (!seat?.current_student_id || !academyId) return;
    setBusySeat(seatNumber);
    setError(null);
    try {
      await apiFetch(`/api/kiosk/${academyId}/check-out`, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ studentId: seat.current_student_id }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '강제 퇴실 실패');
    } finally {
      setBusySeat(null);
    }
  };

  const filtered = reports.filter((r) => (tab === 'PENDING' ? !r.resolved : r.resolved));

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'PENDING', label: `미처리 (${reports.filter((r) => !r.resolved).length})` },
          { value: 'RESOLVED', label: `처리 완료 (${reports.filter((r) => r.resolved).length})` },
        ]}
      />
      <View style={{ height: 12 }} />
      <Banner kind="error">{error ?? undefined}</Banner>

      {isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty>{tab === 'PENDING' ? '미처리 신고가 없습니다.' : '처리된 신고가 없습니다.'}</Empty>
      ) : (
        filtered.map((r) => {
          const seat = seats.find((s) => s.seat_number === r.seat_number);
          const isOccupied = seat?.status === 'OCCUPIED' || seat?.status === 'AWAY';
          return (
            <Card key={r.id}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                {r.seat_number}번 좌석 · {REASON_LABEL[r.reason] ?? r.reason}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Muted>{new Date(r.created_at).toLocaleString('ko-KR')}</Muted>
                {isOccupied && <Badge text="현재 사용중" />}
              </View>
              {tab === 'PENDING' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {isOccupied && (
                    <Button
                      title="강제 퇴실"
                      variant="secondary"
                      small
                      style={{ flex: 1 }}
                      disabled={busySeat === r.seat_number}
                      onPress={() => forceCheckout(r.seat_number)}
                    />
                  )}
                  <Button title="처리 완료로 표시" variant="dark" small style={{ flex: 1 }} onPress={() => resolve(r.id)} />
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

export default function ReportsScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER']}>
      <Inner />
    </RequireRole>
  );
}
