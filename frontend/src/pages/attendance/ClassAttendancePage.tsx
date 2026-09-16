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
  const [reasonModal, setReasonModal] = useState<{
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

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

  const mark = async (studentId: string, status: AttendanceStatus, reasonOverride?: string | null) => {
    setBusyStudent(studentId);
    setMessage(null);
    setError(null);
    try {
      const req = requests.find((r) => r.student_id === studentId);
      const reason =
        reasonOverride !== undefined
          ? reasonOverride
          : status === 'EXCUSED' || status === 'ABSENT'
          ? req?.reason ?? null
          : null;
      const res = await apiFetch<{ alertSent: boolean }>('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          classId,
          studentId,
          date,
          status,
          reason,
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

  const handleStatusClick = (studentId: string, studentName: string, status: AttendanceStatus) => {
    if (status === 'EXCUSED') {
      const req = requests.find((r) => r.student_id === studentId);
      const rec = records[studentId];
      setReasonText((rec?.status === 'EXCUSED' ? rec.reason : req?.reason) ?? '');
      setReasonModal({ studentId, studentName, status });
      return;
    }
    mark(studentId, status);
  };

  const confirmReasonModal = async () => {
    if (!reasonModal) return;
    const trimmed = reasonText.trim();
    setReasonModal(null);
    await mark(reasonModal.studentId, reasonModal.status, trimmed || null);
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
                        onClick={() => handleStatusClick(s.id, s.name, st.value)}
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

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              사유결석 사유 입력
            </h3>
            <p className="mb-3 text-sm text-gray-500">{reasonModal.studentName} 학생</p>
            <textarea
              autoFocus
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="사유를 입력하세요 (예: 병원 진료)"
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReasonModal(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={confirmReasonModal}
                className="rounded-lg bg-gray-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {busyStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-lg">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <span className="text-sm font-medium text-gray-700">저장 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}
