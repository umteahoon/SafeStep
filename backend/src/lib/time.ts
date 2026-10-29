/** 서비스 기준 시간대. 서버(Render 등)는 기본이 UTC 라서 반드시 한국 시간으로 맞춰야 출결 · 자정 작업이 어긋나지 않음 */
export const APP_TIME_ZONE = 'Asia/Seoul';

/** 한국 시간 기준 'YYYY-MM-DD' (toISOString().slice(0,10) 은 UTC 날짜라 오전 9시 전에는 하루 전 날짜가 됨) */
export function localDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
