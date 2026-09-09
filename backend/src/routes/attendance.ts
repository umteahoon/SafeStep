import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { sendAbsenceAlert } from '../services/PushService';

const router = Router();

router.use(requireAuth, requireRole('ACADEMY_ADMIN', 'TEACHER'));

// PUT /api/attendance  { classId, studentId, date, status, reason?, note? }
// 스마트 알림 정책: 정상 출석(PRESENT)은 무음, 결석/지각 계열만 즉시 발송
router.put('/', async (req: AuthedRequest, res) => {
  const { classId, studentId, date, status, reason, note } = req.body;

  const { data: record, error } = await supabaseAdmin
    .from('class_attendance_records')
    .upsert(
      {
        academy_id: req.academyId,
        class_id: classId,
        student_id: studentId,
        date,
        status,
        reason: reason ?? null,
        note: note ?? null,
        recorded_by: req.userId,
      },
      { onConflict: 'class_id,student_id,date' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const shouldAlert = status === 'ABSENT' || status === 'LATE';
  if (shouldAlert) {
    await sendAbsenceAlert(studentId, status, reason);
    await supabaseAdmin
      .from('class_attendance_records')
      .update({ alert_sent: true })
      .eq('id', record.id);
  }

  res.json({ success: true, alertSent: shouldAlert });
});

export default router;
