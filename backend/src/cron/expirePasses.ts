import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabaseAdmin';

async function deactivateExpiredPasses() {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('student_passes')
    .update({ status: 'EXPIRED' })
    .eq('pass_type', 'PERIOD')
    .eq('status', 'ACTIVE')
    .lt('expires_at', now);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[expirePasses] 기간권 만료 처리 실패:', error.message);
  }
}

// 매일 자정 실행
export function scheduleExpirePasses() {
  cron.schedule('0 0 * * *', async () => {
    await deactivateExpiredPasses();
    // eslint-disable-next-line no-console
    console.log('[expirePasses] 기간권 만료 처리 완료');
  });
}
