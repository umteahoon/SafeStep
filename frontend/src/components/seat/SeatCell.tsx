import type { Seat } from '../../types';

const STATUS_STYLE: Record<Seat['status'], string> = {
  EMPTY: 'bg-white border-gray-300 text-gray-500 hover:border-blue-400',
  OCCUPIED: 'bg-blue-500 border-blue-500 text-white',
  AWAY: 'bg-amber-400 border-amber-400 text-white',
};

const STATUS_LABEL: Record<Seat['status'], string> = {
  EMPTY: '빈자리',
  OCCUPIED: '사용중',
  AWAY: '외출중',
};

// 존별 좌석 모양: 1인 집중석은 칸막이(위쪽 두꺼운 테두리), 그 외는 일반 데스크
const SHAPE: Record<string, string> = {
  FOCUS: 'h-14 w-11 rounded-b-md border-t-4',
  OPEN: 'h-11 w-11 rounded-lg',
  LAPTOP: 'h-11 w-14 rounded-lg',
  DESK: 'h-11 w-11 rounded-md',
  ROOM: 'h-10 w-10 rounded-full',
};

interface SeatCellProps {
  seat: Seat;
  onClick?: (seat: Seat) => void;
}

export function SeatCell({ seat, onClick }: SeatCellProps) {
  const shape = SHAPE[seat.zone_type] ?? SHAPE.OPEN;
  return (
    <button
      type="button"
      onClick={() => onClick?.(seat)}
      title={`${seat.seat_number}번 · ${STATUS_LABEL[seat.status]}`}
      className={`flex items-center justify-center border text-xs font-semibold transition ${shape} ${STATUS_STYLE[seat.status]}`}
    >
      {seat.seat_number}
    </button>
  );
}
