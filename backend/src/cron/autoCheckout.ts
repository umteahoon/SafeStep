import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabaseAdmin';

async function forceCheckoutAllSeats() {
  const { error } = await supabaseAdmin
    .from('seats')
    .update({
      status: 'EMPTY',
      current_student_id: null,
      occupied_at: null,
      away_at: null,
    })
    .neq('status', 'EMPTY');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[autoCheckout] 좌석 정리 실패:', error.message);
  }
}

async function deactivateExpiredAcademies() {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('academies')
    .update({ subscription_status: 'EXPIRED' })
    .lt('subscription_expires_at', now)
    .neq('subscription_status', 'EXPIRED');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[autoCheckout] 이용권 만료 처리 실패:', error.message);
  }
}

// 매일 자정 실행
export function scheduleAutoCheckout() {
  cron.schedule('0 0 * * *', async () => {
    await forceCheckoutAllSeats();
    await deactivateExpiredAcademies();
    // eslint-disable-next-line no-console
    console.log('[autoCheckout] 자정 정리 작업 완료');
  });
}
