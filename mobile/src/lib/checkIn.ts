/**
 * 학생 출석 버튼의 시간 규칙 (서버 RPC `student_check_in` 과 같은 규칙 — 화면 안내용이며 최종 판정은 서버).
 *  - 수업 시작 30분 전부터 종료까지 출석 가능
 *  - 시작 후 10분이 지나면 지각(LATE)
 */
export const EARLY_MINUTES = 30;
export const LATE_GRACE_MINUTES = 10;

export type CheckInWindow = 'early' | 'open' | 'closed';

/** 'HH:MM'(또는 'HH:MM:SS') → 그날 0시부터의 분 */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function checkInWindow(now: number, start: string, end: string): CheckInWindow {
  if (now < minutesOf(start) - EARLY_MINUTES) return 'early';
  if (now > minutesOf(end)) return 'closed';
  return 'open';
}

/** 지금 출석하면 어떤 상태가 될지 (안내용) */
export function expectedStatus(now: number, start: string): 'PRESENT' | 'LATE' {
  return now > minutesOf(start) + LATE_GRACE_MINUTES ? 'LATE' : 'PRESENT';
}

export const STATUS_LABEL: Record<string, string> = {
  PRESENT: '출석',
  LATE: '지각',
  ABSENT: '결석',
  EXCUSED: '사유 결석',
};

export function windowMessage(w: CheckInWindow, start: string): string {
  if (w === 'early') return `수업 ${EARLY_MINUTES}분 전부터 출석할 수 있어요 (${start.slice(0, 5)} 시작)`;
  if (w === 'closed') return '오늘 수업이 끝났어요';
  return '';
}
