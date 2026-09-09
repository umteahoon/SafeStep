import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('ACADEMY_ADMIN'));

// POST /api/payments/confirm  { paymentKey, orderId, amount }
router.post('/confirm', async (req: AuthedRequest, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const secretKey = process.env.TOSS_SECRET_KEY as string;

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
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

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error } = await supabaseAdmin.from('subscriptions').insert({
    academy_id: req.academyId,
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status: 'PAID',
    expires_at: expiresAt.toISOString(),
  });

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin
    .from('academies')
    .update({
      subscription_status: 'ACTIVE',
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq('id', req.academyId);

  res.json({ success: true, expiresAt });
});

export default router;
