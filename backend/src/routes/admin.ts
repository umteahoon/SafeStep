import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { buildSeatLayout, generateInviteCode } from '../utils/seatLayout';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN'));

// GET /api/admin/owner-signups
// 학원 미연결 상태로 대기 중인 원장(ACADEMY_ADMIN) 목록. 각 원장에게 이미 발급된(아직
// 미사용) 등록 코드가 있는지도 함께 내려줘서, 관리자 화면에서 중복 발급을 막습니다.
router.get('/owner-signups', async (_req: AuthedRequest, res) => {
  const { data: owners, error: ownersError } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, created_at')
    .eq('role', 'ACADEMY_ADMIN')
    .is('academy_id', null)
    .order('created_at', { ascending: true });
  if (ownersError) return res.status(500).json({ error: ownersError.message });

  const ownerIds = (owners ?? []).map((o) => o.id);
  let assignedByOwner: Record<string, { code: string; academyName: string }> = {};
  if (ownerIds.length > 0) {
    const { data: invites } = await supabaseAdmin
      .from('academy_owner_invites')
      .select('assigned_user_id, code, academies(name)')
      .in('assigned_user_id', ownerIds)
      .is('used_at', null);
    assignedByOwner = Object.fromEntries(
      (invites ?? []).map((i) => {
        const academy = Array.isArray(i.academies) ? i.academies[0] : i.academies;
        return [
          i.assigned_user_id as string,
          { code: i.code as string, academyName: (academy as { name?: string } | null)?.name ?? '' },
        ];
      })
    );
  }

  res.json({
    data: (owners ?? []).map((o) => ({ ...o, pendingInvite: assignedByOwner[o.id] ?? null })),
  });
});

// POST /api/admin/academies  { name, address, latitude, longitude, totalSeats, ownerId? }
// 지점 생성 + 좌석 자동 배치 + 원장 등록 코드 발급. ownerId가 있으면 그 원장에게 코드를
// 배정해 /owner/claim 페이지에 알림처럼 바로 보이게 합니다(없으면 기존처럼 관리자가
// 화면에서 코드를 확인해 직접 전달).
router.post('/academies', async (req: AuthedRequest, res) => {
  const {
    name,
    address,
    latitude = 37.5665,
    longitude = 126.978,
    totalSeats = 20,
    ownerId,
  } = req.body ?? {};

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

  const invite = await createInvite(academy.id, ownerId ? String(ownerId) : null);
  if (!invite) {
    return res.status(500).json({ error: '등록 코드 발급에 실패했습니다.' });
  }

  res.json({ success: true, academy, inviteCode: invite.code });
});

// POST /api/admin/academies/:id/invite  { ownerId? } — 등록 코드 재발급(분실 시)
router.post('/academies/:id/invite', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const ownerId = req.body?.ownerId ? String(req.body.ownerId) : null;
  const { data: academy } = await supabaseAdmin
    .from('academies')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

  const invite = await createInvite(id, ownerId);
  if (!invite) return res.status(500).json({ error: '등록 코드 발급에 실패했습니다.' });
  res.json({ success: true, inviteCode: invite.code });
});

async function createInvite(academyId: string, ownerId: string | null = null) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { data, error } = await supabaseAdmin
      .from('academy_owner_invites')
      .insert({ academy_id: academyId, code, assigned_user_id: ownerId })
      .select()
      .single();
    if (!error) return data;
    if (!/duplicate|unique/i.test(error.message)) return null;
  }
  return null;
}

export default router;
