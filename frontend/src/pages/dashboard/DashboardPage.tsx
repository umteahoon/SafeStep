import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { exportWorkbook } from '../../utils/excelExporter';
import { useAuth } from '../../hooks/useAuth';

interface StudentRow {
  name: string;
  attendance_code: string;
  parent_phone: string;
  created_at: string;
}
interface AttendanceRow {
  date: string;
  status: string;
  reason: string | null;
  note: string | null;
  student_id: string;
  class_id: string;
}
interface StudySessionRow {
  student_id: string;
  seat_number: number | null;
  type: string;
  logged_at: string;
  stay_duration_minutes: number;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [s, a, ss] = await Promise.all([
          apiFetch<{ data: StudentRow[] }>('/api/export/students'),
          apiFetch<{ data: AttendanceRow[] }>(
            `/api/export/attendance?month=${month}`
          ),
          apiFetch<{ data: StudySessionRow[] }>('/api/export/study-sessions'),
        ]);
        if (!mounted) return;
        setStudents(s.data ?? []);
        setAttendance(a.data ?? []);
        setSessions(ss.data ?? []);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : '데이터 조회 실패');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [month]);

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((r) => r.status === 'PRESENT').length;
    const absent = attendance.filter((r) => r.status === 'ABSENT').length;
    const late = attendance.filter((r) => r.status === 'LATE').length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
    const totalStudyMinutes = sessions.reduce(
      (sum, s) => sum + (s.stay_duration_minutes ?? 0),
      0
    );
    return {
      studentCount: students.length,
      attendanceRate,
      absent,
      late,
      studyHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
    };
  }, [students, attendance, sessions]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      exportWorkbook(`safestep_${profile?.name ?? '학원'}_${month}`, [
        { name: '학생목록', rows: students },
        { name: `출석기록_${month}`, rows: attendance },
        { name: '학습세션', rows: sessions },
      ]);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="원장 대시보드"
        subtitle={profile?.name ?? undefined}
        right={
          <button
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isExporting ? '엑셀 생성 중...' : '엑셀 추출'}
          </button>
        }
      />

      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            to="/students"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
          >
            학생 관리
          </Link>
          <Link
            to="/teachers"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
          >
            강사 관리
          </Link>
          <Link
            to="/classes"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
          >
            반 · 시간표
          </Link>
          <Link
            to="/attendance"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
          >
            출석부
          </Link>
          <Link
            to="/billing"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
          >
            이용권 결제
          </Link>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="전체 학생" value={`${stats.studentCount}명`} />
          <StatCard
            label={`${month} 출석률`}
            value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
          />
          <StatCard
            label="결석 / 지각"
            value={`${stats.absent} / ${stats.late}`}
          />
          <StatCard label="총 학습시간" value={`${stats.studyHours}h`} />
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            학생 목록
          </h2>
          {isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : students.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">등록된 학생이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-4 py-2">이름</th>
                  <th className="px-4 py-2">출결코드</th>
                  <th className="px-4 py-2">보호자 연락처</th>
                  <th className="px-4 py-2">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.attendance_code}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {s.name}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {s.attendance_code}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{s.parent_phone}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {s.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
