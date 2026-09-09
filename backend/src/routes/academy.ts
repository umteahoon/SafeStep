import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

interface SeatRow {
  academy_id: string;
  seat_number: number;
  zone_type: string;
  grid_x: number;
  grid_y: number;
  status: 'EMPTY';
}

/** 총 좌석 수를 존별로 나눠 그리드 좌표를 매긴 좌석 목록 생성 */
function buildSeatLayout(academyId: string, total: number): SeatRow[] {
  const focus = Math.max(1, Math.round(total * 0.4));
  const open = Math.max(0, Math.round(total * 0.3));
  const laptop = Math.max(0, Math.round(total * 0.15));
  let rest = total - focus - open - laptop;
  const roomA = rest > 0 ? Math.ceil(rest / 2) : 0;
  const roomB = rest > 0 ? rest - roomA : 0;

  const zones: { zone: string; count: number; cols: number }[] = [
    { zone: 'FOCUS', count: focus, cols: 6 },
    { zone: 'OPEN', count: open, cols: 4 },
    { zone: 'LAPTOP', count: laptop, cols: 4 },
    { zone: 'ROOM_A', count: roomA, cols: roomA },
    { zone: 'ROOM_B', count: roomB, cols: roomB },
  ];

  const seats: SeatRow[] = [];
  let n = 1;
  for (const { zone, count, cols } of zones) {
    for (let i = 0; i < count; i += 1) {
      seats.push({
        academy_id: academyId,
        seat_number: n,
        zone_type: zone,
        grid_x: cols > 0 ? i % cols : i,
        grid_y: cols > 0 ? Math.floor(i / cols) : 0,
        status: 'EMPTY',
      });
      n += 1;
    }
  }
  return seats;
}

router.use(requireAuth);

// GET /api/academy  — 현재 로그인한 직원의 소속 학원
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

// POST /api/academy/onboard  { name, address, latitude, longitude, totalSeats }
// 아직 학원이 없는 원장이 자기 학원을 생성하고 자신을 연결 + 좌석 자동 생성
router.post(
  '/onboard',
  requireRole('ACADEMY_ADMIN'),
  async (req: AuthedRequest, res) => {
    if (req.academyId) {
      return res.status(409).json({ error: '이미 학원이 연결되어 있습니다.' });
    }

    const {
      name,
      address,
      latitude = 37.5665,
      longitude = 126.978,
      totalSeats = 20,
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

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ academy_id: academy.id })
      .eq('id', req.userId);

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    const seats = buildSeatLayout(academy.id, seatCount);
    if (seats.length > 0) {
      await supabaseAdmin.from('seats').insert(seats);
    }

    res.json({ success: true, academy });
  }
);

export default router;
