export interface SeatRow {
  academy_id: string;
  seat_number: number;
  zone_type: string;
  grid_x: number;
  grid_y: number;
  status: 'EMPTY';
}

/** 총 좌석 수를 존별(집중석/자유석/노트북존/스터디룸)로 나눠 그리드 좌표를 매긴 좌석 목록 생성 */
export function buildSeatLayout(academyId: string, total: number): SeatRow[] {
  const focus = Math.max(1, Math.round(total * 0.4));
  const open = Math.max(0, Math.round(total * 0.3));
  const laptop = Math.max(0, Math.round(total * 0.15));
  const rest = total - focus - open - laptop;
  const roomA = rest > 0 ? Math.ceil(rest / 2) : 0;
  const roomB = rest > 0 ? rest - roomA : 0;

  const zones: { zone: string; count: number; cols: number }[] = [
    { zone: 'FOCUS', count: focus, cols: 6 },
    { zone: 'OPEN', count: open, cols: 4 },
    { zone: 'LAPTOP', count: laptop, cols: 4 },
    { zone: 'ROOM_A', count: roomA, cols: roomA },
    { zone: 'ROOM_B', count: roomB, cols: roomB },
  ];

  const seats: SeatRow[] = [];
  let n = 1;
  for (const { zone, count, cols } of zones) {
    for (let i = 0; i < count; i += 1) {
      seats.push({
        academy_id: academyId,
        seat_number: n,
        zone_type: zone,
        grid_x: cols > 0 ? i % cols : i,
        grid_y: cols > 0 ? Math.floor(i / cols) : 0,
        status: 'EMPTY',
      });
      n += 1;
    }
  }
  return seats;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외

/** 8자리 원장 초대 코드 생성 (충돌 가능성은 호출측에서 unique 제약으로 재시도) */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
