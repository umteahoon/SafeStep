import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// 🔒 학부모(PARENT) 전용
router.use(requireAuth, requireRole('PARENT'));

// POST /api/parent/link  { linkCode }
// 6자리 연동 코드로 자녀를 학부모 계정에 연결
router.post('/link', async (req: AuthedRequest, res) => {
  const linkCode = String(req.body.linkCode ?? '').trim();
  if (!/^\d{6}$/.test(linkCode)) {
    return res.status(400).json({ error: '6자리 숫자 코드를 입력해주세요.' });
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('id, name, parent_user_id')
    .eq('link_code', linkCode)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!student) return res.status(404).json({ error: '일치하는 학생이 없습니다.' });

  if (student.parent_user_id && student.parent_user_id !== req.userId) {
    return res.status(409).json({ error: '이미 다른 보호자와 연동된 학생입니다.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ parent_user_id: req.userId })
    .eq('id', student.id);

  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ success: true, student: { id: student.id, name: student.name } });
});

// GET /api/parent/children
router.get('/children', async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, name, academy_id, attendance_code, status')
    .eq('parent_user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// POST /api/parent/push-subscribe  { studentId, subscription }
router.post('/push-subscribe', async (req: AuthedRequest, res) => {
  const { studentId, subscription } = req.body;
  if (!studentId || !subscription?.endpoint || !subscription?.keys) {
    return res.status(400).json({ error: '구독 정보가 올바르지 않습니다.' });
  }

  const owns = await parentOwnsStudent(req.userId!, studentId);
  if (!owns) return res.status(403).json({ error: '연동되지 않은 학생입니다.' });

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      student_id: studentId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,endpoint' }
  );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/parent/report?studentId=&weekOf=YYYY-MM-DD
// 최근 7일(또는 weekOf 기준 7일) 출석률 + 총 학습시간 리포트
router.get('/report', async (req: AuthedRequest, res) => {
  const studentId = String(req.query.studentId ?? '');
  if (!studentId) return res.status(400).json({ error: 'studentId가 필요합니다.' });

  const owns = await parentOwnsStudent(req.userId!, studentId);
  if (!owns) return res.status(403).json({ error: '연동되지 않은 학생입니다.' });

  const base = req.query.weekOf ? new Date(String(req.query.weekOf)) : new Date();
  const from = new Date(base.getTime() - 6 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  const to = base.toISOString().slice(0, 10);

  const { data: records } = await supabaseAdmin
    .from('class_attendance_records')
    .select('date, status, reason')
    .eq('student_id', studentId)
    .gte('date', from)
    .lte('date', to)
    .order('date');

  const { data: sessions } = await supabaseAdmin
    .from('attendance_logs')
    .select('type, logged_at, stay_duration_minutes')
    .eq('student_id', studentId)
    .gte('logged_at', from);

  const total = records?.length ?? 0;
  const present = records?.filter((r) => r.status === 'PRESENT').length ?? 0;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
  const totalStudyMinutes =
    sessions?.reduce((sum, s) => sum + (s.stay_duration_minutes ?? 0), 0) ?? 0;

  res.json({
    range: { from, to },
    attendanceRate,
    totalStudyMinutes,
    records: records ?? [],
  });
});

async function parentOwnsStudent(userId: string, studentId: string) {
  const { data } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('parent_user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

export default router;
