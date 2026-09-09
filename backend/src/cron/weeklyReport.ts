import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabaseAdmin';

async function aggregateWeeklyReports() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);

  const { data: students, error } = await supabaseAdmin
    .from('students')
    .select('id, academy_id');

  if (error || !students) {
    // eslint-disable-next-line no-console
    console.error('[weeklyReport] 학생 목록 조회 실패:', error?.message);
    return;
  }

  for (const student of students) {
    const { data: records } = await supabaseAdmin
      .from('class_attendance_records')
      .select('status')
      .eq('student_id', student.id)
      .gte('date', weekAgo);

    const { data: sessions } = await supabaseAdmin
      .from('attendance_logs')
      .select('stay_duration_minutes')
      .eq('student_id', student.id)
      .gte('logged_at', weekAgo);

    const total = records?.length ?? 0;
    const present = records?.filter((r) => r.status === 'PRESENT').length ?? 0;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
    const totalStudyMinutes =
      sessions?.reduce((sum, s) => sum + (s.stay_duration_minutes ?? 0), 0) ?? 0;

    // 실제 저장 테이블(예: weekly_reports)이 있다면 여기서 upsert
    // eslint-disable-next-line no-console
    console.log(
      `[weeklyReport] student=${student.id} attendanceRate=${attendanceRate} studyMinutes=${totalStudyMinutes}`
    );
  }
}

// 매주 일요일 21:00 실행
export function scheduleWeeklyReport() {
  cron.schedule('0 21 * * 0', aggregateWeeklyReports);
}
