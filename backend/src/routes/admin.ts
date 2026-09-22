import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { buildSeatLayout, generateInviteCode } from '../utils/seatLayout';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN'));

// POST /api/admin/academies  { name, address, latitude, longitude, totalSeats }
// 지점 생성 + 좌석 자동 배치 + 원장 등록 코드 발급 (원장은 이 코드를 /owner/claim 에서 입력)
router.post('/academies', async (req: AuthedRequest, res) => {
  const { name, address, latitude = 37.5665, longitude = 126.978, totalSeats = 20 } =
    req.body ?? {};

  if (!name || !address) {
    return res.status(400).json({ error: '학원 이름과 주소는 필수입니다.' });
  }
  const seatCount = Math.min(200, Math.max(1, Number(totalSeats) || 20));

  const { data: academy, error: academyError } = await supabaseAdmin
    .from('academies')
    .insert({
      name,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      total_seats: seatCount,
      subscription_status: 'TRIAL',
    })
    .select()
    .single();

  if (academyError) return res.status(500).json({ error: academyError.message });

  const seats = buildSeatLayout(academy.id, seatCount);
  if (seats.length > 0) {
    await supabaseAdmin.from('seats').insert(seats);
  }

  const invite = await createInvite(academy.id);
  if (!invite) {
    return res.status(500).json({ error: '등록 코드 발급에 실패했습니다.' });
  }

  res.json({ success: true, academy, inviteCode: invite.code });
});

// POST /api/admin/academies/:id/invite  — 등록 코드 재발급(분실 시)
router.post('/academies/:id/invite', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { data: academy } = await supabaseAdmin
    .from('academies')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

  const invite = await createInvite(id);
  if (!invite) return res.status(500).json({ error: '등록 코드 발급에 실패했습니다.' });
  res.json({ success: true, inviteCode: invite.code });
});

async function createInvite(academyId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { data, error } = await supabaseAdmin
      .from('academy_owner_invites')
      .insert({ academy_id: academyId, code })
      .select()
      .single();
    if (!error) return data;
    if (!/duplicate|unique/i.test(error.message)) return null;
  }
  return null;
}

export default router;
