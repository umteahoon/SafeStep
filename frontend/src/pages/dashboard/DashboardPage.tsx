import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BellRing, CalendarCheck, Clock, Download, FileText, Megaphone, UserX, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StaffLayout } from '../../components/common/StaffLayout';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { exportWorkbook } from '../../utils/excelExporter';
import { useAuth } from '../../hooks/useAuth';

interface StudentRow {
  name: string;
  attendance_code: string;
  link_code: string;
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
/** supabase/migration_18_dashboard_notice_stats.sql 의 get_academy_notice_stats 결과 */
interface NoticeStat {
  kind: 'NOTICE' | 'ATTENDANCE';
  title: string;
  target: string;
  sent_at: string | null;
  sent: boolean;
  recipients: number;
  readers: number | null;
}
type NoticeTab = 'ALL' | 'NOTICE' | 'ATTENDANCE';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [notices, setNotices] = useState<NoticeStat[]>([]);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [tab, setTab] = useState<NoticeTab>('ALL');

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

  // 공지 · 알림 현황 (DB 함수가 아직 없으면 안내 문구만 표시)
  useEffect(() => {
    if (!profile?.academy_id) return;
    let mounted = true;
    supabase
      .rpc('get_academy_notice_stats', { p_academy_id: profile.academy_id, p_limit: 20 })
      .then(({ data, error: rpcError }) => {
        if (!mounted) return;
        if (rpcError) {
          setNoticeError(
            /function|schema cache/i.test(rpcError.message)
              ? 'Supabase에 migration_18_dashboard_notice_stats.sql 을 실행하면 공지 · 알림 현황이 표시됩니다.'
              : rpcError.message
          );
          setNotices([]);
        } else {
          setNoticeError(null);
          setNotices((data as NoticeStat[]) ?? []);
        }
        setNoticeLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profile?.academy_id]);

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
      checked: total,
      studyHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
    };
  }, [students, attendance, sessions]);

  const shownNotices = useMemo(
    () => (tab === 'ALL' ? notices : notices.filter((n) => n.kind === tab)),
    [notices, tab]
  );
  const noticeCount = notices.filter((n) => n.kind === 'NOTICE').length;
  const alertCount = notices.filter((n) => n.kind === 'ATTENDANCE').length;

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
    <StaffLayout
      title="대시보드"
      subtitle={profile?.name ? `${profile.name} · 학원 운영 현황` : '학원 운영 현황'}
      actions={
        <>
          <label className="sr-only" htmlFor="dashboard-month">조회 월</label>
          <input
            id="dashboard-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? '엑셀 생성 중...' : '엑셀 추출'}
          </button>
        </>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} tone="blue" label="전체 학생" value={`${stats.studentCount}명`} />
        <StatCard
          icon={CalendarCheck}
          tone="green"
          label={`${month} 출석률`}
          value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
          sub={`출결 기록 ${stats.checked}건`}
        />
        <StatCard
          icon={UserX}
          tone="amber"
          label="결석 / 지각"
          value={`${stats.absent} / ${stats.late}`}
          sub="자동 감지 포함"
        />
        <StatCard icon={Clock} tone="violet" label="총 학습시간" value={`${stats.studyHours}h`} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white" aria-labelledby="notice-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="notice-title" className="text-base font-bold text-slate-900">공지 · 알림 현황</h2>
            <p className="text-xs text-slate-500">공지 열람률과 보호자 출결 알림 발송 상태</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="알림 종류">
            {([
              ['ALL', `전체 ${notices.length}`],
              ['NOTICE', `공지 ${noticeCount}`],
              ['ATTENDANCE', `출결 알림 ${alertCount}`],
            ] as [NoticeTab, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {noticeLoading ? (
          <p className="p-5 text-sm text-slate-400">불러오는 중...</p>
        ) : noticeError ? (
          <p className="m-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{noticeError}</p>
        ) : shownNotices.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">
            아직 기록이 없습니다. 공지방에 글을 올리거나 지각 · 결석이 처리되면 여기에 표시됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-full px-5 py-2.5">제목</th>
                  <th className="whitespace-nowrap px-3 py-2.5">수신 대상</th>
                  <th className="whitespace-nowrap px-3 py-2.5">전송 시간</th>
                  <th className="whitespace-nowrap px-3 py-2.5">상태</th>
                  <th className="whitespace-nowrap px-5 py-2.5">열람률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownNotices.map((n, i) => (
                  <NoticeRow key={`${n.kind}-${n.sent_at}-${i}`} n={n} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white" aria-labelledby="students-title">
        <h2 id="students-title" className="border-b border-slate-100 px-5 py-4 text-base font-bold text-slate-900">
          학생 목록
        </h2>
        {isLoading ? (
          <p className="p-5 text-sm text-slate-400">불러오는 중...</p>
        ) : students.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">등록된 학생이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">이름</th>
                  <th className="px-3 py-2.5">출결코드</th>
                  <th className="px-3 py-2.5">연동코드</th>
                  <th className="px-3 py-2.5">보호자 연락처</th>
                  <th className="px-5 py-2.5">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.attendance_code}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-3 py-3 text-slate-500">{s.attendance_code}</td>
                    <td className="px-3 py-3 font-mono text-blue-600">{s.link_code}</td>
                    <td className="px-3 py-3 text-slate-500">{s.parent_phone}</td>
                    <td className="px-5 py-3 text-slate-400">{s.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StaffLayout>
  );
}

const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
} as const;

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function NoticeRow({ n }: { n: NoticeStat }) {
  const isNotice = n.kind === 'NOTICE';
  const rate = isNotice && n.recipients > 0 ? Math.round(((n.readers ?? 0) / n.recipients) * 100) : null;
  const Icon = isNotice ? FileText : BellRing;
  return (
    <tr>
      <td className="max-w-0 px-5 py-3" title={n.title}>
        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-900">
          <Icon size={16} className={`shrink-0 ${isNotice ? 'text-blue-600' : 'text-amber-600'}`} aria-hidden="true" />
          <span className="truncate">{n.title}</span>
        </span>
        <span className="ml-6 text-xs text-slate-400">{isNotice ? '공지' : '출결 알림'}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
        {n.target}
        <span className="ml-1 text-xs text-slate-400">{n.recipients}명</span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-500">
        {n.sent_at ? format(new Date(n.sent_at), 'yyyy.MM.dd HH:mm') : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {isNotice ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <Megaphone size={12} aria-hidden="true" />게시됨
          </span>
        ) : n.recipients === 0 ? (
          // 알림을 받을 연동된 보호자가 없으면 발송 표시와 관계없이 미연동으로 안내
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">보호자 미연동</span>
        ) : n.sent ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">전송 완료</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">미발송</span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-3">
        {rate === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-blue-600" style={{ width: `${rate}%` }} />
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {rate}% <span className="font-normal text-slate-400">({n.readers}/{n.recipients})</span>
            </span>
          </span>
        )}
      </td>
    </tr>
  );
}
