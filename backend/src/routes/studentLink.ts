import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

// POST /api/student-link/link  { linkCode }
router.post('/link', async (req: AuthedRequest, res) => {
  const linkCode = String(req.body.linkCode ?? '').trim();
  if (!/^\d{6}$/.test(linkCode)) {
    return res.status(400).json({ error: '6자리 숫자 코드를 입력해주세요.' });
  }

  const { data: alreadyLinked, error: alreadyError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', req.userId)
    .maybeSingle();
  if (alreadyError) return res.status(500).json({ error: alreadyError.message });
  if (alreadyLinked) {
    return res.status(409).json({ error: '이미 연동된 학생 계정이 있습니다.' });
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('id, name, user_id')
    .eq('link_code', linkCode)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!student) return res.status(404).json({ error: '일치하는 학생이 없습니다.' });
  if (student.user_id && student.user_id !== req.userId) {
    return res.status(409).json({ error: '이미 다른 계정과 연동된 학생입니다.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ user_id: req.userId })
    .eq('id', student.id);

  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ success: true, student: { id: student.id, name: student.name } });
});

export default router;
