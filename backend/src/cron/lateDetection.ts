import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sendAbsenceAlert } from '../services/PushService';

const LATE_GRACE_MINUTES = 10; // 수업 시작 후 10분까지는 정상 체크인 유예
const AUTO_NOTE = 'AUTO_DETECTED';

interface ScheduleRow {
  class_id: string;
  day_of_week: number;
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  classes: { academy_id: string } | { academy_id: string }[] | null;
}

function todayAt(timeStr: string): Date {
  const [h, m, s] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  return d;
}

function academyIdOf(row: ScheduleRow): string | null {
  const c = row.classes;
  if (!c) return null;
  return Array.isArray(c) ? c[0]?.academy_id ?? null : c.academy_id;
}

/**
 * 반별 시간표를 기준으로, 수업 시작 후 일정 시간이 지나도 출석 체크가 안 된 학생을
 * 자동으로 LATE(지각)로, 수업 종료 후까지도 그대로면 ABSENT(무단결석)로 승격합니다.
 * 강사가 이미 수동으로 체크한 기록(AUTO_DETECTED 가 아닌 record)은 절대 건드리지 않습니다.
 */
async function detectLateAndAbsent() {
  const now = new Date();
  const todayDow = now.getDay();
  const today = now.toISOString().slice(0, 10);

  const { data: schedules, error } = await supabaseAdmin
    .from('class_schedules')
    .select('class_id, day_of_week, start_time, end_time, classes(academy_id)')
    .eq('day_of_week', todayDow);

  if (error || !schedules) {
    // eslint-disable-next-line no-console
    console.error('[lateDetection] 시간표 조회 실패:', error?.message);
    return;
  }

  for (const schedule of schedules as unknown as ScheduleRow[]) {
    const academyId = academyIdOf(schedule);
    if (!academyId) continue;

    const start = todayAt(schedule.start_time);
    const end = todayAt(schedule.end_time);
    const lateThreshold = new Date(start.getTime() + LATE_GRACE_MINUTES * 60_000);

    if (now < lateThreshold) continue; // 아직 지각 판정 시점도 안 됨

    const { data: enrollments } = await supabaseAdmin
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', schedule.class_id);
    const studentIds = (enrollments ?? []).map((e) => e.student_id);
    if (studentIds.length === 0) continue;

    const { data: records } = await supabaseAdmin
      .from('class_attendance_records')
      .select('id, student_id, status, note')
      .eq('class_id', schedule.class_id)
      .eq('date', today)
      .in('student_id', studentIds);

    const byStudent = new Map((records ?? []).map((r) => [r.student_id, r]));
    const pastEnd = now >= end;

    for (const studentId of studentIds) {
      const rec = byStudent.get(studentId);

      if (!pastEnd) {
        // 지각 판정 구간: 기록이 아예 없는 학생만 자동 LATE
        if (!rec) {
          await upsertAuto(academyId, schedule.class_id, studentId, today, 'LATE');
        }
        continue;
      }

      // 수업 종료 후: 기록이 없거나, 자동으로 찍힌 LATE 그대로면 ABSENT 로 승격
      if (!rec || (rec.status === 'LATE' && rec.note === AUTO_NOTE)) {
        await upsertAuto(academyId, schedule.class_id, studentId, today, 'ABSENT');
      }
    }
  }
}

async function upsertAuto(
  academyId: string,
  classId: string,
  studentId: string,
  date: string,
  status: 'LATE' | 'ABSENT'
) {
  const reason = status === 'LATE' ? '자동 감지(지각)' : '자동 감지(무단결석)';

  const { data: record, error } = await supabaseAdmin
    .from('class_attendance_records')
    .upsert(
      {
        academy_id: academyId,
        class_id: classId,
        student_id: studentId,
        date,
        status,
        reason,
        note: AUTO_NOTE,
        alert_sent: false,
      },
      { onConflict: 'class_id,student_id,date' }
    )
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[lateDetection] upsert 실패:', error.message);
    return;
  }

  if (!record.alert_sent) {
    await sendAbsenceAlert(studentId, status, reason);
    await supabaseAdmin
      .from('class_attendance_records')
      .update({ alert_sent: true })
      .eq('id', record.id);
  }
}

// 매 5분마다 실행
export function scheduleLateDetection() {
  cron.schedule('*/5 * * * *', detectLateAndAbsent);
}
