import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { apiFetch } from '../../lib/api';
import { exportWorkbook } from '../../lib/excel';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Empty, Loading, MonthStepper, Muted, Screen, SectionTitle, Stat, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';

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

const LINKS: { label: string; to: keyof RootStackParamList }[] = [
  { label: '학생 관리', to: 'Students' },
  { label: '강사 관리', to: 'Teachers' },
  { label: '반 · 시간표', to: 'Classes' },
  { label: '출석부', to: 'Attendance' },
  { label: '이용권 결제', to: 'Billing' },
  { label: '신고 관제', to: 'Reports' },
];

function Inner() {
  const navigation = useNavigation<RootNav>();
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
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [s, a, ss] = await Promise.all([
          apiFetch<{ data: StudentRow[] }>('/api/export/students'),
          apiFetch<{ data: AttendanceRow[] }>(`/api/export/attendance?month=${month}`),
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
    })();
    return () => {
      mounted = false;
    };
  }, [month]);

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((r) => r.status === 'PRESENT').length;
    const absent = attendance.filter((r) => r.status === 'ABSENT').length;
    const late = attendance.filter((r) => r.status === 'LATE').length;
    const totalStudyMinutes = sessions.reduce((sum, s) => sum + (s.stay_duration_minutes ?? 0), 0);
    return {
      studentCount: students.length,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
      absent,
      late,
      studyHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
    };
  }, [students, attendance, sessions]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      await exportWorkbook(`safestep_${profile?.name ?? '학원'}_${month}`, [
        { name: '학생목록', rows: students },
        { name: `출석기록_${month}`, rows: attendance },
        { name: '학습세션', rows: sessions },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '엑셀 생성 실패');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Screen>
      <Title>원장 대시보드</Title>
      {profile && <Muted style={{ marginBottom: 12 }}>{profile.name}</Muted>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {LINKS.map((l) => (
          <Button
            key={l.to}
            title={l.label}
            variant="secondary"
            small
            onPress={() => navigation.navigate(l.to as any)}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <MonthStepper value={month} onChange={setMonth} />
        <Button title="엑셀 추출" variant="primary" small onPress={handleExport} loading={isExporting} disabled={isLoading} />
      </View>

      <Banner kind="error">{error ?? undefined}</Banner>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Stat label="전체 학생" value={`${stats.studentCount}명`} />
        <Stat label={`${month} 출석률`} value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`} />
        <Stat label="결석 / 지각" value={`${stats.absent} / ${stats.late}`} />
        <Stat label="총 학습시간" value={`${stats.studyHours}h`} />
      </View>

      <SectionTitle>학생 목록</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : students.length === 0 ? (
        <Empty>등록된 학생이 없습니다.</Empty>
      ) : (
        <Card style={{ padding: 0 }}>
          {students.map((s, i) => (
            <View
              key={s.attendance_code + i}
              style={{ padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.graySoft }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{s.name}</Text>
                <Muted>{s.created_at?.slice(0, 10)}</Muted>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 4 }}>
                출결코드 {s.attendance_code} · 연동코드{' '}
                <Text style={{ fontFamily: 'Courier', color: colors.primary }}>{s.link_code}</Text>
              </Text>
              <Muted>보호자 {s.parent_phone}</Muted>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function DashboardScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN']}>
      <Inner />
    </RequireRole>
  );
}
