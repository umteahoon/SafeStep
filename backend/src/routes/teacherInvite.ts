import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { sendServerError } from '../lib/security';

const router = Router();

router.use(requireAuth, requireRole('TEACHER'));

// POST /api/teacher-invite/join  { code }
// 원장이 발급한 강사 초대 코드로 강사 계정을 그 학원에 연결합니다.
// 초대 코드를 아는 것 자체가 원장의 승인이므로 바로 APPROVED 처리합니다.
router.post('/join', async (req: AuthedRequest, res) => {
  if (req.academyId && req.approvalStatus === 'APPROVED') {
    return res.status(409).json({ error: '이미 학원에 소속되어 있습니다.' });
  }

  const code = String(req.body?.code ?? '')
    .trim()
    .toUpperCase();
  if (!code) return res.status(400).json({ error: '초대 코드를 입력해주세요.' });

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('academy_teacher_invites')
    .select('academy_id')
    .eq('code', code)
    .maybeSingle();
  if (inviteError) return sendServerError(res, 'teacherInvite', inviteError);
  if (!invite) return res.status(404).json({ error: '유효하지 않은 초대 코드입니다.' });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ academy_id: invite.academy_id, approval_status: 'APPROVED' })
    .eq('id', req.userId);
  if (error) return sendServerError(res, 'teacherInvite', error);

  const { data: academy } = await supabaseAdmin
    .from('academies')
    .select('id, name')
    .eq('id', invite.academy_id)
    .single();

  res.json({ success: true, academy });
});

export default router;
