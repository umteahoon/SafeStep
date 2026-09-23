import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Seat } from '../../types';

const ZONE_OPTIONS = [
  { value: 'FOCUS', label: '집중석(1인 칸막이)' },
  { value: 'OPEN', label: '자유석' },
  { value: 'LAPTOP', label: '노트북존' },
  { value: 'DESK', label: '컴퓨터책상' },
  { value: 'ROOM_A', label: '스터디룸 A' },
  { value: 'ROOM_B', label: '스터디룸 B' },
];

export default function SeatEditorPage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academyId) return;
    setIsLoading(true);
    const { data, error: e } = await supabase
      .from('seats')
      .select('*')
      .eq('academy_id', academyId)
      .order('seat_number');
    setSeats((data as Seat[]) ?? []);
    setError(e?.message ?? null);
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const addSeat = async () => {
    if (!academyId) return;
    const nextNumber = (seats.at(-1)?.seat_number ?? 0) + 1;
    const { error: insErr } = await supabase.from('seats').insert({
      academy_id: academyId,
      seat_number: nextNumber,
      zone_type: 'OPEN',
      grid_x: 0,
      grid_y: 0,
      status: 'EMPTY',
    });
    if (insErr) return setError(insErr.message);
    await load();
  };

  const updateSeat = async (seat: Seat, patch: Partial<Seat>) => {
    setError(null);
    const { error: updErr } = await supabase
      .from('seats')
      .update(patch)
      .eq('id', seat.id);
    if (updErr) {
      setError(
        updErr.message.includes('unique') ? '이미 사용 중인 좌석 번호입니다.' : updErr.message
      );
      await load(); // 롤백해서 화면 값 되돌리기
      return;
    }
    setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, ...patch } : s)));
  };

  const removeSeat = async (seat: Seat) => {
    if (seat.status !== 'EMPTY') {
      setError('사용중이거나 외출중인 좌석은 삭제할 수 없습니다. 먼저 퇴실 처리해주세요.');
      return;
    }
    if (!confirm(`${seat.seat_number}번 좌석을 삭제할까요?`)) return;
    const { error: delErr } = await supabase.from('seats').delete().eq('id', seat.id);
    if (delErr) return setError(delErr.message);
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="좌석 배치 에디터"
        subtitle="번호 · 위치(X,Y) · 유형 편집"
        backTo="/dashboard"
        right={
          <button
            onClick={addSeat}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + 좌석 추가
          </button>
        }
      />

      <div className="mx-auto max-w-3xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : seats.length === 0 ? (
          <p className="text-sm text-gray-400">좌석이 없습니다. "좌석 추가"로 시작하세요.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2">번호</th>
                  <th className="px-3 py-2">유형</th>
                  <th className="px-3 py-2">X</th>
                  <th className="px-3 py-2">Y</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seats.map((seat) => (
                  <tr key={seat.id}>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={seat.seat_number}
                        onBlur={(e) =>
                          Number(e.target.value) !== seat.seat_number &&
                          updateSeat(seat, { seat_number: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={seat.zone_type}
                        onChange={(e) => updateSeat(seat, { zone_type: e.target.value })}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        {ZONE_OPTIONS.map((z) => (
                          <option key={z.value} value={z.value}>
                            {z.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={seat.grid_x}
                        onBlur={(e) =>
                          Number(e.target.value) !== seat.grid_x &&
                          updateSeat(seat, { grid_x: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={seat.grid_y}
                        onBlur={(e) =>
                          Number(e.target.value) !== seat.grid_y &&
                          updateSeat(seat, { grid_y: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-400">{seat.status}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeSeat(seat)}
                        className="text-xs text-red-500"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          X/Y 는 좌석 도면(존별 그리드) 안에서의 상대 위치입니다. 실시간으로 저장됩니다.
        </p>
      </div>
    </div>
  );
}
