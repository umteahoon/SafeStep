import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('ACADEMY_ADMIN'));

// POST /api/owner/claim  { code }
// 슈퍼관리자가 발급한 8자리 등록 코드로 원장 계정을 지점에 연결합니다.
router.post('/claim', async (req: AuthedRequest, res) => {
  if (req.academyId) {
    return res.status(409).json({ error: '이미 학원이 연결되어 있습니다.' });
  }

  const code = String(req.body?.code ?? '')
    .trim()
    .toUpperCase();
  if (!code) return res.status(400).json({ error: '등록 코드를 입력해주세요.' });

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('academy_owner_invites')
    .select('id, academy_id, used_at')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) return res.status(500).json({ error: inviteError.message });
  if (!invite) return res.status(404).json({ error: '유효하지 않은 등록 코드입니다.' });
  if (invite.used_at) {
    return res.status(409).json({ error: '이미 사용된 등록 코드입니다.' });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ academy_id: invite.academy_id })
    .eq('id', req.userId);
  if (profileError) return res.status(500).json({ error: profileError.message });

  await supabaseAdmin
    .from('academy_owner_invites')
    .update({ used_by: req.userId, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  const { data: academy } = await supabaseAdmin
    .from('academies')
    .select('*')
    .eq('id', invite.academy_id)
    .single();

  res.json({ success: true, academy });
});

export default router;
