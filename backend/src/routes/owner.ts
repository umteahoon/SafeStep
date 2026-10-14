import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { buildSeatLayout, generateInviteCode } from '../utils/seatLayout';
import { sendServerError } from '../lib/security';

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

// POST /api/owner/academies  { name, address, latitude?, longitude?, totalSeats? }
// 원장이 직접 학원을 만든다 (좌석 자동 배치 + 내 계정에 바로 연결 + 강사 초대 코드 발급).
router.post('/academies', async (req: AuthedRequest, res) => {
  if (req.academyId) {
    return res.status(409).json({ error: '이미 학원이 연결되어 있습니다.' });
  }
  const { name, address, latitude = 37.5665, longitude = 126.978, totalSeats = 20 } = req.body ?? {};
  const cleanName = String(name ?? '').trim();
  const cleanAddress = String(address ?? '').trim();
  if (!cleanName || !cleanAddress) {
    return res.status(400).json({ error: '학원 이름과 주소는 필수입니다.' });
  }
  if (cleanName.length > 60 || cleanAddress.length > 120) {
    return res.status(400).json({ error: '학원 이름 또는 주소가 너무 깁니다.' });
  }
  const seatCount = Math.min(200, Math.max(1, Number(totalSeats) || 20));

  const { data: academy, error: academyError } = await supabaseAdmin
    .from('academies')
    .insert({
      name: cleanName,
      address: cleanAddress,
      kind: 'ACADEMY',
      latitude: Number(latitude),
      longitude: Number(longitude),
      total_seats: seatCount,
      subscription_status: 'TRIAL',
    })
    .select()
    .single();
  if (academyError) return sendServerError(res, 'owner', academyError);

  const seats = buildSeatLayout(academy.id, seatCount);
  if (seats.length > 0) await supabaseAdmin.from('seats').insert(seats);

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ academy_id: academy.id })
    .eq('id', req.userId);
  if (profileError) return sendServerError(res, 'owner', profileError);

  const code = await upsertTeacherInvite(academy.id);
  res.json({ success: true, academy, teacherInviteCode: code });
});

// GET /api/owner/teacher-invite — 내 학원의 강사 초대 코드(없으면 발급)
router.get('/teacher-invite', async (req: AuthedRequest, res) => {
  if (!req.academyId) return res.status(400).json({ error: '학원이 연결되어 있지 않습니다.' });
  const { data } = await supabaseAdmin
    .from('academy_teacher_invites')
    .select('code')
    .eq('academy_id', req.academyId)
    .maybeSingle();
  const code = data?.code ?? (await upsertTeacherInvite(req.academyId));
  if (!code) return res.status(500).json({ error: '초대 코드 발급에 실패했습니다.' });
  res.json({ code });
});

// POST /api/owner/teacher-invite/regenerate — 코드 재발급(기존 코드는 즉시 무효)
router.post('/teacher-invite/regenerate', async (req: AuthedRequest, res) => {
  if (!req.academyId) return res.status(400).json({ error: '학원이 연결되어 있지 않습니다.' });
  const code = await upsertTeacherInvite(req.academyId);
  if (!code) return res.status(500).json({ error: '초대 코드 발급에 실패했습니다.' });
  res.json({ code });
});

async function upsertTeacherInvite(academyId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { error } = await supabaseAdmin
      .from('academy_teacher_invites')
      .upsert({ academy_id: academyId, code, created_at: new Date().toISOString() }, { onConflict: 'academy_id' });
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message)) return null;
  }
  return null;
}

export default router;
