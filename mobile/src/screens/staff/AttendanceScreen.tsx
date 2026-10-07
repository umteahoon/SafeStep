import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Button, Card, DayStepper, Empty, Input, Loading, ModalCard, Muted, Screen, Select } from '../../components/ui';
import { colors } from '../../theme';
import type { AbsenceRequest, AttendanceStatus, Class, ClassAttendanceRecord, ClassEnrollment, Student } from '../../types';

const STATUSES: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: '출석', color: colors.primary },
  { value: 'LATE', label: '지각', color: '#FBBF24' },
  { value: 'ABSENT', label: '결석', color: colors.danger },
  { value: 'EXCUSED', label: '사유결석', color: colors.gray },
];

function Inner() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, ClassAttendanceRecord>>({});
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyStudent, setBusyStudent] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ studentId: string; studentName: string; status: AttendanceStatus } | null>(null);
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
        setClassId((cur) => cur || list[0]?.id || '');
        if (list.length === 0) setIsLoading(false);
      });
  }, [academyId]);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setError(null);
    const { data: enrolls } = await supabase.from('class_enrollments').select('*').eq('class_id', classId);
    const studentIds = ((enrolls as ClassEnrollment[]) ?? []).map((e) => e.student_id);

    if (studentIds.length === 0) {
      setStudents([]);
      setRecords({});
      setRequests([]);
      setIsLoading(false);
      return;
    }

    const [{ data: sts }, { data: recs }, { data: reqs }] = await Promise.all([
      supabase.from('students').select('*').in('id', studentIds).order('name'),
      supabase.from('class_attendance_records').select('*').eq('class_id', classId).eq('date', date),
      supabase.from('absence_requests').select('*').in('student_id', studentIds).eq('date', date),
    ]);

    setStudents((sts as Student[]) ?? []);
    const recMap: Record<string, ClassAttendanceRecord> = {};
    ((recs as ClassAttendanceRecord[]) ?? []).forEach((r) => {
      recMap[r.student_id] = r;
    });
    setRecords(recMap);
    setRequests((reqs as AbsenceRequest[]) ?? []);
    setIsLoading(false);
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
            ? (req?.reason ?? null)
            : null;
      const res = await apiFetch<{ alertSent: boolean }>('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({ classId, studentId, date, status, reason }),
      });
      await loadRoster();
      if (res.alertSent) setMessage('보호자에게 알림을 발송했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusyStudent(null);
    }
  };

  const handleStatusPress = (studentId: string, studentName: string, status: AttendanceStatus) => {
    if (status === 'EXCUSED') {
      const req = requests.find((r) => r.student_id === studentId);
      const rec = records[studentId];
      setReasonText((rec?.status === 'EXCUSED' ? rec.reason : req?.reason) ?? '');
      setReasonModal({ studentId, studentName, status });
      return;
    }
    mark(studentId, status);
  };

  const confirmReason = async () => {
    if (!reasonModal) return;
    const trimmed = reasonText.trim();
    const target = reasonModal;
    setReasonModal(null);
    await mark(target.studentId, target.status, trimmed || null);
  };

  const markAllPresent = async () => {
    for (const s of students) {
      if (!records[s.id]) await mark(s.id, 'PRESENT');
    }
  };

  if (isLoading && classes.length > 0 && students.length === 0 && !classId) return <Loading />;

  return (
    <Screen>
      {classes.length === 0 ? (
        <Empty>먼저 반을 생성해주세요.</Empty>
      ) : (
        <>
          <View style={{ marginBottom: 12, gap: 10 }}>
            <Select value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
            <DayStepper value={date} onChange={setDate} />
            <Button title="미체크 전원 출석" small onPress={markAllPresent} disabled={students.length === 0 || !!busyStudent} />
          </View>

          <Banner kind="success">{message ?? undefined}</Banner>
          <Banner kind="error">{error ?? undefined}</Banner>

          {students.length === 0 ? (
            <Empty>이 반에 배정된 수강생이 없습니다. (반 관리 → 수강생)</Empty>
          ) : (
            students.map((s) => {
              const rec = records[s.id];
              const req = requests.find((r) => r.student_id === s.id);
              return (
                <Card key={s.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{s.name}</Text>
                    {req && (
                      <Badge
                        text={`사전신청: ${req.type === 'LATE' ? '지각' : '결석'}${req.reason ? ` (${req.reason})` : ''}`}
                        bg={colors.warnSoft}
                        fg={colors.warnText}
                      />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {STATUSES.map((st) => (
                      <Pressable
                        key={st.value}
                        onPress={() => handleStatusPress(s.id, s.name, st.value)}
                        disabled={busyStudent === s.id}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: rec?.status === st.value ? st.color : colors.border,
                          backgroundColor: rec?.status === st.value ? st.color : colors.white,
                          opacity: busyStudent === s.id ? 0.4 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: rec?.status === st.value ? colors.white : colors.textSub }}>
                          {st.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {rec?.status === 'EXCUSED' && rec.reason ? <Muted style={{ marginTop: 8 }}>사유: {rec.reason}</Muted> : null}
                </Card>
              );
            })
          )}
        </>
      )}

      <ModalCard visible={!!reasonModal} onClose={() => setReasonModal(null)}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>사유결석 사유 입력</Text>
        <Muted style={{ marginBottom: 12 }}>{reasonModal?.studentName} 학생</Muted>
        <Input value={reasonText} onChangeText={setReasonText} multiline placeholder="사유를 입력하세요 (예: 병원 진료)" autoFocus />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button title="취소" variant="secondary" style={{ flex: 1 }} onPress={() => setReasonModal(null)} />
          <Button title="저장" variant="dark" style={{ flex: 1 }} onPress={confirmReason} />
        </View>
      </ModalCard>

      {busyStudent && (
        <View style={{ position: 'absolute', top: 12, alignSelf: 'center' }}>
          <Badge text="저장 중..." bg={colors.dark} fg={colors.white} />
        </View>
      )}
    </Screen>
  );
}

export default function AttendanceScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER']}>
      <Inner />
    </RequireRole>
  );
}
