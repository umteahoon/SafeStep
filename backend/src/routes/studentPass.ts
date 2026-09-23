import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

interface PassPlan {
  id: string;
  passType: 'TIME' | 'PERIOD';
  name: string;
  amount: number;
  minutes?: number;
  days?: number;
}

// 고정 이용권 카탈로그 (학원별 커스텀 가격은 아직 지원하지 않음)
const PASS_PLANS: PassPlan[] = [
  { id: 'time_10h', passType: 'TIME', name: '10시간 이용권', amount: 15000, minutes: 10 * 60 },
  { id: 'time_30h', passType: 'TIME', name: '30시간 이용권', amount: 39000, minutes: 30 * 60 },
  { id: 'time_50h', passType: 'TIME', name: '50시간 이용권', amount: 59000, minutes: 50 * 60 },
  { id: 'period_1m', passType: 'PERIOD', name: '1개월 이용권', amount: 79000, days: 30 },
  { id: 'period_3m', passType: 'PERIOD', name: '3개월 이용권', amount: 219000, days: 90 },
];

// GET /api/student-passes/plans
router.get('/plans', (_req, res) => {
  res.json({ plans: PASS_PLANS });
});

// POST /api/student-passes/confirm  { paymentKey, orderId, amount, planId }
router.post('/confirm', async (req: AuthedRequest, res) => {
  const { paymentKey, orderId, amount, planId } = req.body;
  const secretKey = process.env.TOSS_SECRET_KEY as string;

  if (!paymentKey || !orderId || !amount || !planId) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  const plan = PASS_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return res.status(400).json({ error: '존재하지 않는 이용권입니다.' });
  }
  if (Number(amount) !== plan.amount) {
    return res.status(400).json({ error: '결제 금액이 이용권 가격과 일치하지 않습니다.' });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, academy_id')
    .eq('user_id', req.userId)
    .maybeSingle();

  if (studentError) return res.status(500).json({ error: studentError.message });
  if (!student) {
    return res.status(403).json({ error: '학원에 등록된 학생만 이용권을 구매할 수 있습니다.' });
  }

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const tossData = await tossRes.json();

  if (!tossRes.ok) {
    return res.status(tossRes.status).json({ error: tossData });
  }

  const now = new Date();
  const insertPayload: Record<string, unknown> = {
    academy_id: student.academy_id,
    student_id: student.id,
    pass_type: plan.passType,
    product_name: plan.name,
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status: 'ACTIVE',
    paid_at: now.toISOString(),
  };

  if (plan.passType === 'TIME') {
    insertPayload.remaining_minutes = plan.minutes;
  } else {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (plan.days ?? 30));
    insertPayload.expires_at = expiresAt.toISOString();
  }

  const { data: pass, error: insertError } = await supabaseAdmin
    .from('student_passes')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  res.json({ success: true, pass });
});

export default router;
