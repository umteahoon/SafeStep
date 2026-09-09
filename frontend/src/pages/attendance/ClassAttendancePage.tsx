import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type {
  AbsenceRequest,
  AttendanceStatus,
  Class,
  ClassAttendanceRecord,
  ClassEnrollment,
  Student,
} from '../../types';

const STATUSES: { value: AttendanceStatus; label: string; cls: string }[] = [
  { value: 'PRESENT', label: '출석', cls: 'bg-blue-600 text-white' },
  { value: 'LATE', label: '지각', cls: 'bg-amber-400 text-white' },
  { value: 'ABSENT', label: '결석', cls: 'bg-red-500 text-white' },
  { value: 'EXCUSED', label: '사유결석', cls: 'bg-gray-500 text-white' },
];

export default function ClassAttendancePage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, ClassAttendanceRecord>>({});
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyStudent, setBusyStudent] = useState<string | null>(null);

  useEffect(() => {
    if (!academyId) return;
    supabase
      .from('classes')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at')
      .then(({ data }) => {
        const list = (data as Class[]) ?? [];
        setClasses(list);
        if (list.length && !classId) setClassId(list[0].id);
      });
  }, [academyId, classId]);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setError(null);
    const { data: enrolls } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId);
    const studentIds = ((enrolls as ClassEnrollment[]) ?? []).map((e) => e.student_id);

    if (studentIds.length === 0) {
      setStudents([]);
      setRecords({});
      setRequests([]);
      return;
    }

    const [{ data: sts }, { data: recs }, { data: reqs }] = await Promise.all([
      supabase.from('students').select('*').in('id', studentIds).order('name'),
      supabase
        .from('class_attendance_records')
        .select('*')
        .eq('class_id', classId)
        .eq('date', date),
      supabase
        .from('absence_requests')
        .select('*')
        .in('student_id', studentIds)
        .eq('date', date),
    ]);

    setStudents((sts as Student[]) ?? []);
    const recMap: Record<string, ClassAttendanceRecord> = {};
    ((recs as ClassAttendanceRecord[]) ?? []).forEach((r) => {
      recMap[r.student_id] = r;
    });
    setRecords(recMap);
    setRequests((reqs as AbsenceRequest[]) ?? []);
  }, [classId, date]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const mark = async (studentId: string, status: AttendanceStatus) => {
    setBusyStudent(studentId);
    setMessage(null);
    setError(null);
    try {
      const req = requests.find((r) => r.student_id === studentId);
      const res = await apiFetch<{ alertSent: boolean }>('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          classId,
          studentId,
          date,
          status,
          reason: status === 'EXCUSED' || status === 'ABSENT' ? req?.reason ?? null : null,
        }),
      });
      await loadRoster();
      if (res.alertSent) setMessage('보호자에게 알림을 발송했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusyStudent(null);
    }
  };

  const markAllPresent = async () => {
    for (const s of students) {
      if (!records[s.id]) await mark(s.id, 'PRESENT');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="반별 출석부" subtitle="원클릭 출석 체크" backTo="/classes" />

      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={markAllPresent}
            disabled={students.length === 0}
            className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            미체크 전원 출석
          </button>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {classes.length === 0 ? (
          <p className="text-sm text-gray-400">먼저 반을 생성해주세요.</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-400">
            이 반에 배정된 수강생이 없습니다. (반 관리 → 수강생)
          </p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => {
              const rec = records[s.id];
              const req = requests.find((r) => r.student_id === s.id);
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    {req && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                        사전신청: {req.type === 'LATE' ? '지각' : '결석'}
                        {req.reason ? ` (${req.reason})` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((st) => (
                      <button
                        key={st.value}
                        onClick={() => mark(s.id, st.value)}
                        disabled={busyStudent === s.id}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                          rec?.status === st.value
                            ? st.cls
                            : 'border border-gray-200 text-gray-500'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
