import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const AWAY_TIMEOUT_MINUTES = 60;

async function releaseOverdueAwaySeats() {
  const cutoff = new Date(Date.now() - AWAY_TIMEOUT_MINUTES * 60_000).toISOString();

  const { data: overdue, error } = await supabaseAdmin
    .from('seats')
    .select('id, academy_id, seat_number, current_student_id')
    .eq('status', 'AWAY')
    .lt('away_at', cutoff);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[awayTimeout] 조회 실패:', error.message);
    return;
  }
  if (!overdue || overdue.length === 0) return;

  const ids = overdue.map((s) => s.id);
  await supabaseAdmin
    .from('seats')
    .update({
      status: 'EMPTY',
      current_student_id: null,
      occupied_at: null,
      away_at: null,
    })
    .in('id', ids);

  // eslint-disable-next-line no-console
  console.log(`[awayTimeout] ${ids.length}개 좌석 자동 반납 처리`);
}

// 매 10분마다 실행
export function scheduleAwayTimeout() {
  cron.schedule('*/10 * * * *', releaseOverdueAwaySeats);
}
