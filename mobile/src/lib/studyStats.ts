// 학습 통계 계산 (순수 함수 — RN 의존성 없음)
// 학습시간 = 키오스크 퇴실(CHECK_OUT) 로그의 stay_duration_minutes 합계

export interface LogRow {
  type: string;
  logged_at: string;
  stay_duration_minutes?: number | null;
  seat_number?: number | null;
}

/** 로컬 날짜 키 'yyyy-MM-dd' */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 날짜별 학습 분 (CHECK_OUT 로그만 합산) */
export function dailyMinutes(logs: LogRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) {
    if (l.type !== 'CHECK_OUT') continue;
    const k = dayKey(new Date(l.logged_at));
    out[k] = (out[k] ?? 0) + (l.stay_duration_minutes ?? 0);
  }
  return out;
}

/** 이번 주(월~일) 막대 데이터 */
export function weekBars(daily: Record<string, number>, today: Date) {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = (monday.getDay() + 6) % 7; // 월=0
  monday.setDate(monday.getDate() - dow);
  return labels.map((label, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(d);
    return { label, key, minutes: daily[key] ?? 0, isToday: key === dayKey(today), isFuture: d.getTime() > today.getTime() && key !== dayKey(today) };
  });
}

/** 연속 학습 일수. 오늘 기록이 없으면 어제부터 이어지는 연속을 센다 */
export function streak(daily: Record<string, number>, today: Date): number {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!(daily[dayKey(d)] > 0)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (daily[dayKey(d)] > 0) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** 이번 달 총 학습 분 */
export function monthTotal(daily: Record<string, number>, today: Date): number {
  const prefix = dayKey(today).slice(0, 7);
  return Object.entries(daily)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((s, [, v]) => s + v, 0);
}

/** 이번 주 총 학습 분 */
export function weekTotal(bars: { minutes: number }[]): number {
  return bars.reduce((s, b) => s + b.minutes, 0);
}

/** 학습 기록이 있는 날 수 */
export function activeDays(daily: Record<string, number>): number {
  return Object.values(daily).filter((v) => v > 0).length;
}

/** 90 → '1시간 30분', 45 → '45분' */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h === 0) return `${min}분`;
  if (min === 0) return `${h}시간`;
  return `${h}시간 ${min}분`;
}

/** 초 → 'H:MM:SS' */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
