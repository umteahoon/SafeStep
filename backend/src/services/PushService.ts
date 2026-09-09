import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@safestep.local';

let pushEnabled = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    pushEnabled = true;
  } catch (e) {
    // 잘못된(placeholder) 키여도 서버는 계속 뜨도록 함
    // eslint-disable-next-line no-console
    console.warn(
      '[SafeStep] VAPID 키가 유효하지 않아 Web Push를 비활성화합니다:',
      e instanceof Error ? e.message : e
    );
  }
} else {
  // eslint-disable-next-line no-console
  console.warn('[SafeStep] VAPID 키가 설정되지 않아 Web Push를 보낼 수 없습니다.');
}

const STATUS_LABEL: Record<string, string> = {
  ABSENT: '결석',
  LATE: '지각',
};

export async function sendAbsenceAlert(
  studentId: string,
  status: string,
  reason?: string
) {
  if (!pushEnabled) return;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('student_id', studentId);

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name')
    .eq('id', studentId)
    .single();

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: `[SafeStep] ${student?.name ?? '자녀'} ${STATUS_LABEL[status] ?? status} 알림`,
    body: reason ? `사유: ${reason}` : '자세한 내용은 앱에서 확인해주세요.',
    tag: `attendance-${studentId}`,
  });

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );
}
