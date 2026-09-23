import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Seat } from '../../types';
import { SeatCell } from './SeatCell';

interface FloorPlanGridProps {
  academyId: string;
  onSelectSeat?: (seat: Seat) => void;
}

interface ZoneMeta {
  label: string;
  note?: string;
  order: number;
}

// zone_type → 표시 정보. 시드에 없는 값은 기본값으로 렌더됩니다.
const ZONE_META: Record<string, ZoneMeta> = {
  FOCUS: { label: '포커스존 · 1인 칸막이석', note: '정숙 구역', order: 1 },
  OPEN: { label: '자유존 · 오픈席', note: '가벼운 대화 가능', order: 2 },
  LAPTOP: { label: '카페존(노트북)', note: '타이핑 허용', order: 3 },
  DESK: { label: '컴퓨터책상', note: 'PC 이용석', order: 4 },
  ROOM_A: { label: '스터디룸 A', note: '4인 · 예약제', order: 5 },
  ROOM_B: { label: '스터디룸 B', note: '4인 · 예약제', order: 6 },
};

function metaFor(zone: string): ZoneMeta {
  return ZONE_META[zone] ?? { label: zone, order: 99 };
}

export function FloorPlanGrid({ academyId, onSelectSeat }: FloorPlanGridProps) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('seats')
        .select('*')
        .eq('academy_id', academyId)
        .order('seat_number');
      if (mounted) {
        setSeats((data as Seat[]) ?? []);
        setIsLoading(false);
      }
    }
    load();

    // 좌석 상태 실시간 반영 (입/퇴실, 외출/복귀 즉시 화면 갱신)
    const channel = supabase
      .channel(`seats-${academyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seats',
          filter: `academy_id=eq.${academyId}`,
        },
        (payload) => {
          setSeats((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((s) => s.id !== (payload.old as Seat).id);
            }
            const updated = payload.new as Seat;
            const exists = prev.some((s) => s.id === updated.id);
            return exists
              ? prev.map((s) => (s.id === updated.id ? updated : s))
              : [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [academyId]);

  const zones = useMemo(() => {
    const byZone = new Map<string, Seat[]>();
    for (const seat of seats) {
      const key = seat.zone_type || 'OPEN';
      if (!byZone.has(key)) byZone.set(key, []);
      byZone.get(key)!.push(seat);
    }
    return [...byZone.entries()]
      .map(([zone, zoneSeats]) => ({ zone, seats: zoneSeats }))
      .sort((a, b) => metaFor(a.zone).order - metaFor(b.zone).order);
  }, [seats]);

  const summary = useMemo(() => {
    const empty = seats.filter((s) => s.status === 'EMPTY').length;
    return { empty, total: seats.length };
  }, [seats]);

  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400">좌석 정보를 불러오는 중...</p>;
  }

  if (seats.length === 0) {
    return (
      <p className="p-6 text-sm text-gray-400">
        아직 좌석 도면이 등록되지 않았습니다.
      </p>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* 범례 + 요약 */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-gray-300 bg-white" /> 빈자리
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-blue-500" /> 사용중
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-400" /> 외출중
        </span>
        <span className="ml-auto font-medium text-gray-700">
          잔여 {summary.empty} / {summary.total}석
        </span>
      </div>

      {/* 도면 캔버스 */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-6">
        {/* 입구 / 프론트 */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-500">
          <span>🚪 입구</span>
          <span>프론트데스크 · 키오스크</span>
        </div>

        {/* 존별 배치 */}
        <div className="grid gap-4 md:grid-cols-2">
          {zones.map(({ zone, seats: zoneSeats }) => (
            <ZoneBox
              key={zone}
              zone={zone}
              seats={zoneSeats}
              onSelectSeat={onSelectSeat}
            />
          ))}
        </div>

        {/* 편의시설 */}
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-gray-400">
          <span className="rounded-lg bg-white px-3 py-1">🥤 정수기</span>
          <span className="rounded-lg bg-white px-3 py-1">🚻 화장실</span>
          <span className="rounded-lg bg-white px-3 py-1">🔒 사물함</span>
          <span className="rounded-lg bg-white px-3 py-1">☕ 휴게실</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        좌석을 누르면 소음·자리 독점을 익명으로 신고할 수 있습니다.
      </p>
    </div>
  );
}

function ZoneBox({
  zone,
  seats,
  onSelectSeat,
}: {
  zone: string;
  seats: Seat[];
  onSelectSeat?: (seat: Seat) => void;
}) {
  const meta = metaFor(zone);
  const isRoom = zone.startsWith('ROOM');

  const minX = Math.min(...seats.map((s) => s.grid_x));
  const minY = Math.min(...seats.map((s) => s.grid_y));
  const cols = Math.max(...seats.map((s) => s.grid_x)) - minX + 1;
  const rows = Math.max(...seats.map((s) => s.grid_y)) - minY + 1;
  const emptyCount = seats.filter((s) => s.status === 'EMPTY').length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{meta.label}</h3>
          {meta.note && <p className="text-xs text-gray-400">{meta.note}</p>}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            emptyCount > 0
              ? 'bg-blue-50 text-blue-600'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {emptyCount}석
        </span>
      </div>

      {isRoom ? (
        // 스터디룸: 가운데 테이블 + 둘레 좌석
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            {seats.slice(0, Math.ceil(seats.length / 2)).map((s) => (
              <SeatCell key={s.id} seat={s} onClick={onSelectSeat} />
            ))}
          </div>
          <div className="my-1 h-8 w-3/4 rounded-md bg-gray-200 text-center text-[10px] leading-8 text-gray-400">
            TABLE
          </div>
          <div className="flex gap-2">
            {seats.slice(Math.ceil(seats.length / 2)).map((s) => (
              <SeatCell key={s.id} seat={s} onClick={onSelectSeat} />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="grid justify-center gap-x-3 gap-y-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, max-content))`,
            gridTemplateRows: `repeat(${rows}, min-content)`,
          }}
        >
          {seats.map((s) => (
            <div
              key={s.id}
              style={{
                gridColumn: s.grid_x - minX + 1,
                gridRow: s.grid_y - minY + 1,
              }}
            >
              <SeatCell seat={s} onClick={onSelectSeat} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
