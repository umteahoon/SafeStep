import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/academy  — 현재 로그인한 직원의 소속 학원
// (학원 생성은 /api/admin/academies, 원장 연결은 /api/owner/claim 참고)
router.get('/', async (req: AuthedRequest, res) => {
  if (!req.academyId) return res.json({ data: null });
  const { data, error } = await supabaseAdmin
    .from('academies')
    .select('*')
    .eq('id', req.academyId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
