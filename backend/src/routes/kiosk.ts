import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router({ mergeParams: true });

interface StudentRow {
  id: string;
  name: string;
  academy_id: string;
}

async function findCurrentSeat(academyId: string, studentId: string) {
  const { data } = await supabaseAdmin
    .from('seats')
    .select('*')
    .eq('academy_id', academyId)
    .eq('current_student_id', studentId)
    .maybeSingle();
  return data;
}

// 이용 가능한 이용권(시간권: 잔여 시간 > 0 / 기간권: 만료 전) 보유 여부
async function hasValidPass(studentId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('student_passes')
    .select('id')
    .eq('student_id', studentId)
    .eq('status', 'ACTIVE')
    .or(`and(pass_type.eq.TIME,remaining_minutes.gt.0),and(pass_type.eq.PERIOD,expires_at.gt.${nowIso})`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// POST /api/kiosk/:academyId/verify-pin  { code }
router.post('/:academyId/verify-pin', async (req, res) => {
  const { academyId } = req.params;
  const { code } = req.body;

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('id, name, academy_id')
    .eq('academy_id', academyId)
    .eq('attendance_code', code)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!student) return res.status(404).json({ error: '등록되지 않은 코드입니다.' });

  const seat = await findCurrentSeat(academyId, student.id);
  const hasPass = await hasValidPass(student.id);
  res.json({ student, currentSeat: seat ?? null, hasValidPass: hasPass });
});

// POST /api/kiosk/:academyId/verify-qr  { qrToken }
router.post('/:academyId/verify-qr', async (req, res) => {
  const { academyId } = req.params;
  const { qrToken } = req.body;

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('id, name, academy_id')
    .eq('academy_id', academyId)
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!student) return res.status(404).json({ error: '유효하지 않은 QR입니다.' });

  const seat = await findCurrentSeat(academyId, student.id);
  const hasPass = await hasValidPass(student.id);
  res.json({ student, currentSeat: seat ?? null, hasValidPass: hasPass });
});

// POST /api/kiosk/:academyId/check-in  { studentId, seatNumber }
router.post('/:academyId/check-in', async (req, res) => {
  const { academyId } = req.params;
  const { studentId, seatNumber } = req.body;

  if (!(await hasValidPass(studentId))) {
    return res.status(402).json({
      error: '이용 가능한 이용권이 없습니다. 이용권을 구매한 후 다시 시도해주세요.',
    });
  }

  const { data: seat, error: seatError } = await supabaseAdmin
    .from('seats')
    .update({
      status: 'OCCUPIED',
      current_student_id: studentId,
      occupied_at: new Date().toISOString(),
      away_at: null,
    })
    .eq('academy_id', academyId)
    .eq('seat_number', seatNumber)
    .eq('status', 'EMPTY') // 🔒 이미 사용중인 좌석은 배정 불가 (동시성 방지)
    .select()
    .maybeSingle();

  if (seatError) return res.status(500).json({ error: seatError.message });
  if (!seat) {
    return res.status(409).json({ error: '이미 사용 중이거나 존재하지 않는 좌석입니다.' });
  }

  await supabaseAdmin.from('attendance_logs').insert({
    academy_id: academyId,
    student_id: studentId,
    seat_number: seatNumber,
    type: 'CHECK_IN',
    check_method: req.body.method === 'QR' ? 'QR' : 'KEYPAD',
  });

  res.json({ success: true, seat });
});

// POST /api/kiosk/:academyId/check-out  { studentId }
router.post('/:academyId/check-out', async (req, res) => {
  const { academyId } = req.params;
  const { studentId } = req.body;

  const seat = await findCurrentSeat(academyId, studentId);
  if (!seat) return res.status(404).json({ error: '입실 중인 좌석이 없습니다.' });

  const occupiedAt = seat.occupied_at ? new Date(seat.occupied_at) : new Date();
  const stayMinutes = Math.max(
    0,
    Math.round((Date.now() - occupiedAt.getTime()) / 60000)
  );

  await supabaseAdmin
    .from('seats')
    .update({
      status: 'EMPTY',
      current_student_id: null,
      occupied_at: null,
      away_at: null,
    })
    .eq('id', seat.id);

  await supabaseAdmin.from('attendance_logs').insert({
    academy_id: academyId,
    student_id: studentId,
    seat_number: seat.seat_number,
    type: 'CHECK_OUT',
    stay_duration_minutes: stayMinutes,
  });

  // 시간권 보유 시 이용 시간만큼 차감 (기간권/미보유 학생은 영향 없음)
  const { error: deductError } = await supabaseAdmin.rpc('deduct_time_pass', {
    p_student: studentId,
    p_minutes: stayMinutes,
  });
  if (deductError) {
    // eslint-disable-next-line no-console
    console.error('[kiosk] 시간권 차감 실패:', deductError.message);
  }

  res.json({ success: true, stayMinutes });
});

// POST /api/kiosk/:academyId/move  { studentId, seatNumber }
// 입실 중인 학생을 다른 빈 좌석으로 이동 (최초 입실 시각은 유지 → 총 이용시간 정확히 계산)
router.post('/:academyId/move', async (req, res) => {
  const { academyId } = req.params;
  const { studentId, seatNumber } = req.body;

  const oldSeat = await findCurrentSeat(academyId, studentId);
  if (!oldSeat) return res.status(404).json({ error: '입실 중인 좌석이 없습니다.' });
  if (oldSeat.seat_number === seatNumber) {
    return res.status(400).json({ error: '같은 좌석으로는 이동할 수 없습니다.' });
  }

  const { data: newSeat, error: newSeatError } = await supabaseAdmin
    .from('seats')
    .update({
      status: 'OCCUPIED',
      current_student_id: studentId,
      occupied_at: oldSeat.occupied_at, // 최초 입실 시각 유지
      away_at: null,
    })
    .eq('academy_id', academyId)
    .eq('seat_number', seatNumber)
    .eq('status', 'EMPTY') // 🔒 동시성: 이미 사용중인 좌석으로는 이동 불가
    .select()
    .maybeSingle();

  if (newSeatError) return res.status(500).json({ error: newSeatError.message });
  if (!newSeat) {
    return res.status(409).json({ error: '이미 사용 중이거나 존재하지 않는 좌석입니다.' });
  }

  await supabaseAdmin
    .from('seats')
    .update({ status: 'EMPTY', current_student_id: null, occupied_at: null, away_at: null })
    .eq('id', oldSeat.id);

  await supabaseAdmin.from('attendance_logs').insert({
    academy_id: academyId,
    student_id: studentId,
    seat_number: seatNumber,
    type: 'MOVE',
  });

  res.json({ success: true, seat: newSeat });
});

// POST /api/kiosk/:academyId/away  { studentId }
router.post('/:academyId/away', async (req, res) => {
  const { academyId } = req.params;
  const { studentId } = req.body;

  const seat = await findCurrentSeat(academyId, studentId);
  if (!seat) return res.status(404).json({ error: '입실 중인 좌석이 없습니다.' });

  await supabaseAdmin
    .from('seats')
    .update({ status: 'AWAY', away_at: new Date().toISOString() })
    .eq('id', seat.id);

  await supabaseAdmin.from('attendance_logs').insert({
    academy_id: academyId,
    student_id: studentId,
    seat_number: seat.seat_number,
    type: 'AWAY',
  });

  res.json({ success: true });
});

// POST /api/kiosk/:academyId/return  { studentId }
router.post('/:academyId/return', async (req, res) => {
  const { academyId } = req.params;
  const { studentId } = req.body;

  const seat = await findCurrentSeat(academyId, studentId);
  if (!seat) return res.status(404).json({ error: '외출 중인 좌석이 없습니다.' });

  await supabaseAdmin
    .from('seats')
    .update({ status: 'OCCUPIED', away_at: null })
    .eq('id', seat.id);

  await supabaseAdmin.from('attendance_logs').insert({
    academy_id: academyId,
    student_id: studentId,
    seat_number: seat.seat_number,
    type: 'RETURN',
  });

  res.json({ success: true });
});

export default router;
