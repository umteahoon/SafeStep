import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('ACADEMY_ADMIN'));

// 대기 중인 강사 목록 (본인 학원 소속만)
router.get('/pending', async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, phone, created_at')
    .eq('academy_id', req.academyId)
    .eq('role', 'TEACHER')
    .eq('approval_status', 'PENDING');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post('/:teacherId/approve', async (req: AuthedRequest, res) => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ approval_status: 'APPROVED' })
    .eq('id', req.params.teacherId)
    .eq('academy_id', req.academyId) // 🔒 타 학원 강사 승인 방지
    .eq('role', 'TEACHER');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/:teacherId/reject', async (req: AuthedRequest, res) => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ approval_status: 'REJECTED' })
    .eq('id', req.params.teacherId)
    .eq('academy_id', req.academyId)
    .eq('role', 'TEACHER');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
