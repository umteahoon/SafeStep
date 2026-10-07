import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { inquiryLimiter, sendServerError } from '../lib/security';

const router = Router();

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

// POST /api/inquiries  { name, contact, business_name?, business_type?, message? }
// 비로그인도 가능. 로그인 상태면 Authorization 토큰으로 submitted_by를 함께 저장합니다.
// 브라우저가 inquiries 테이블에 직접 INSERT하지 않도록 서버를 거치고, IP당 레이트 리밋을 적용합니다.
router.post('/', inquiryLimiter, async (req, res) => {
  const name = str(req.body?.name, 50);
  const contact = str(req.body?.contact, 100);
  if (!name || !contact) {
    return res.status(400).json({ error: '담당자 이름과 연락처는 필수입니다.' });
  }

  let submittedBy: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
    submittedBy = data.user?.id ?? null;
  }

  const { error } = await supabaseAdmin.from('inquiries').insert({
    name,
    contact,
    business_name: str(req.body?.business_name, 100) || null,
    business_type: str(req.body?.business_type, 20) || null,
    message: str(req.body?.message, 2000) || null,
    submitted_by: submittedBy,
  });

  if (error) return sendServerError(res, 'inquiry', error);
  res.json({ success: true });
});

export default router;
