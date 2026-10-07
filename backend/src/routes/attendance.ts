import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireApprovedStaff, requireAuth, requireRole } from '../middleware/auth';
import { sendAbsenceAlert } from '../services/PushService';

const router = Router();

const ALLOWED_STATUS = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

router.use(requireAuth, requireRole('ACADEMY_ADMIN', 'TEACHER'), requireApprovedStaff);

// PUT /api/attendance  { classId, studentId, date, status, reason?, note? }
// 스마트 알림 정책: 정상 출석(PRESENT)은 무음, 결석/지각 계열만 즉시 발송
router.put('/', async (req: AuthedRequest, res) => {
  const { classId, studentId, date, status, reason, note } = req.body ?? {};

  if (!classId || !studentId || !date || !ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: '출석 정보가 올바르지 않습니다.' });
  }

  // 🔒 반이 본인 학원 소속인지 확인 (다른 학원 반에 기록 삽입 방지)
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('academy_id', req.academyId)
    .maybeSingle();
  if (!classRow) {
    return res.status(404).json({ error: '해당 학원의 반을 찾을 수 없습니다.' });
  }

  // 🔒 학생이 본인 학원 소속이고, 그 반에 실제로 배정돼 있는지 확인
  const { data: enrollment } = await supabaseAdmin
    .from('class_enrollments')
    .select('student_id, students!inner(academy_id)')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .eq('students.academy_id', req.academyId)
    .maybeSingle();
  if (!enrollment) {
    return res.status(404).json({ error: '이 반에 배정되지 않은 학생입니다.' });
  }

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
