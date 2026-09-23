import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// 🔒 원장(ACADEMY_ADMIN) 전용. 반드시 본인 academy_id로만 스코프.
router.use(requireAuth, requireRole('ACADEMY_ADMIN'));

router.get('/students', async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('name, attendance_code, link_code, parent_phone, academy_id, created_at')
    .eq('academy_id', req.academyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.get('/attendance', async (req: AuthedRequest, res) => {
  const { month } = req.query; // 'YYYY-MM'
  let query = supabaseAdmin
    .from('class_attendance_records')
    .select('date, status, reason, note, student_id, class_id')
    .eq('academy_id', req.academyId);

  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split('-').map(Number);
    // mon은 1~12(예: 9월='09') 그대로 Date.UTC에 넘기면 자동으로 다음 달 1일이 됨
    // (Date.UTC의 month는 0-indexed라 12월도 다음 해 1월로 자연스럽게 넘어감)
    const nextMonthStart = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);
    query = query.gte('date', `${month}-01`).lt('date', nextMonthStart);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.get('/study-sessions', async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('attendance_logs')
    .select('student_id, seat_number, type, logged_at, stay_duration_minutes')
    .eq('academy_id', req.academyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
