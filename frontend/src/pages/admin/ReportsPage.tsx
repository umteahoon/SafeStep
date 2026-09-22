import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
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

const REASON_LABEL: Record<string, string> = {
  NOISE: '소음',
  MONOPOLY: '자리 독점',
  OTHER: '기타',
};

export default function ReportsPage() {
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
    setIsLoading(true);
    const [{ data: r, error: e }, { data: s }] = await Promise.all([
      supabase
        .from('seat_reports')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false }),
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
    await supabase
      .from('seat_reports')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
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
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="신고 관제" subtitle="익명 소음 · 자리 독점 신고" backTo="/dashboard" />

      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTab('PENDING')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === 'PENDING' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600'
            }`}
          >
            미처리 ({reports.filter((r) => !r.resolved).length})
          </button>
          <button
            onClick={() => setTab('RESOLVED')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === 'RESOLVED' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600'
            }`}
          >
            처리 완료 ({reports.filter((r) => r.resolved).length})
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">
            {tab === 'PENDING' ? '미처리 신고가 없습니다.' : '처리된 신고가 없습니다.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => {
              const seat = seats.find((s) => s.seat_number === r.seat_number);
              const isOccupied = seat?.status === 'OCCUPIED' || seat?.status === 'AWAY';
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {r.seat_number}번 좌석 · {REASON_LABEL[r.reason] ?? r.reason}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleString()}
                        {isOccupied && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                            현재 사용중
                          </span>
                        )}
                      </p>
                    </div>
                    {tab === 'PENDING' && (
                      <div className="flex gap-2">
                        {isOccupied && (
                          <button
                            onClick={() => forceCheckout(r.seat_number)}
                            disabled={busySeat === r.seat_number}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-500 disabled:opacity-40"
                          >
                            강제 퇴실
                          </button>
                        )}
                        <button
                          onClick={() => resolve(r.id)}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          처리 완료로 표시
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
