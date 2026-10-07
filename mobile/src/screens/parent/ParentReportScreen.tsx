import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { format } from 'date-fns';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, DayStepper, Empty, Field, Input, Loading, Muted, Screen, Segmented, Select, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';

interface Child {
  id: string;
  name: string;
  academy_id: string;
  attendance_code: string;
  status: string;
}
interface Report {
  range: { from: string; to: string };
  attendanceRate: number | null;
  totalStudyMinutes: number;
  records: { date: string; status: string; reason: string | null }[];
}

const STATUS_LABEL: Record<string, string> = { PRESENT: '출석', LATE: '지각', ABSENT: '결석', EXCUSED: '사유결석' };

function Inner() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 사전 결석/지각 신청
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [absenceType, setAbsenceType] = useState<'ABSENCE' | 'LATE'>('ABSENCE');
  const [absenceReason, setAbsenceReason] = useState('');

  const loadChildren = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Child[] }>('/api/parent/children');
      setChildren(res.data ?? []);
      setSelectedId((cur) => cur || res.data?.[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '자녀 목록 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (!selectedId) return;
    setReport(null);
    apiFetch<Report>(`/api/parent/report?studentId=${selectedId}`)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : '리포트 조회 실패'));
  }, [selectedId]);

  const linkChild = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ student: { id: string; name: string } }>('/api/parent/link', {
        method: 'POST',
        body: JSON.stringify({ linkCode }),
      });
      setMessage(`${res.student.name} 학생이 연동되었습니다.`);
      setLinkCode('');
      setSelectedId(res.student.id);
      await loadChildren();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연동 실패');
    }
  };

  const requestAbsence = async () => {
    setError(null);
    setMessage(null);
    const child = children.find((c) => c.id === selectedId);
    if (!child) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(absenceDate)) {
      setError('날짜 형식이 올바르지 않습니다.');
      return;
    }
    const { error: insErr } = await supabase.from('absence_requests').insert({
      academy_id: child.academy_id,
      student_id: child.id,
      date: absenceDate,
      type: absenceType,
      reason: absenceReason || null,
      requested_by: user?.id ?? null,
    });
    if (insErr) {
      setError(insErr.message.includes('unique') ? '해당 날짜에 이미 신청 내역이 있습니다.' : insErr.message);
      return;
    }
    setMessage('사전 신청이 접수되었습니다.');
    setAbsenceReason('');
  };

  const selectedChild = children.find((c) => c.id === selectedId);

  return (
    <Screen>
      <Banner kind="success">{message ?? undefined}</Banner>
      <Banner kind="error">{error ?? undefined}</Banner>

      <SectionTitle>자녀 연동</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input
            value={linkCode}
            onChangeText={(t) => setLinkCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="학원에서 받은 6자리 코드"
            style={{ flex: 1, letterSpacing: 2 }}
          />
          <Button title="연동" onPress={linkChild} disabled={linkCode.length < 6} />
        </View>
      </Card>

      <Muted style={{ marginBottom: 12 }}>
        ※ 출결 푸시 알림은 현재 웹 버전에서만 지원됩니다. (앱 푸시는 FCM 설정 후 제공 예정)
      </Muted>

      {isLoading ? (
        <Loading />
      ) : children.length === 0 ? (
        <Empty>아직 연동된 자녀가 없습니다. 위에서 코드를 입력해주세요.</Empty>
      ) : (
        <>
          <Select value={selectedId} onChange={setSelectedId} options={children.map((c) => ({ value: c.id, label: c.name }))} />

          <SectionTitle>
            {'\n'}주간 리포트{report ? ` (${report.range.from} ~ ${report.range.to})` : ''}
          </SectionTitle>
          <Card>
            {!report ? (
              <Loading />
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 8, padding: 12 }}>
                    <Muted>출석률</Muted>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
                      {report.attendanceRate === null ? '—' : `${report.attendanceRate}%`}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 8, padding: 12 }}>
                    <Muted>총 학습시간</Muted>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
                      {Math.round((report.totalStudyMinutes / 60) * 10) / 10}h
                    </Text>
                  </View>
                </View>
                {report.records.length === 0 ? (
                  <Muted>이번 주 출석 기록이 없습니다.</Muted>
                ) : (
                  report.records.map((r, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.graySoft,
                      }}
                    >
                      <Text style={{ color: colors.textSub }}>{r.date}</Text>
                      <Text style={{ fontWeight: '500', color: colors.text }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}
          </Card>

          <SectionTitle>사전 결석 / 지각 신청{selectedChild ? ` · ${selectedChild.name}` : ''}</SectionTitle>
          <Card>
            <Field label="날짜">
              <DayStepper value={absenceDate} onChange={setAbsenceDate} />
            </Field>
            <Field label="유형">
              <Segmented
                value={absenceType}
                onChange={setAbsenceType}
                options={[
                  { value: 'ABSENCE', label: '결석' },
                  { value: 'LATE', label: '지각' },
                ]}
              />
            </Field>
            <Field label="사유 (선택)">
              <Input value={absenceReason} onChangeText={setAbsenceReason} multiline />
            </Field>
            <Button title="신청하기" onPress={requestAbsence} />
          </Card>
        </>
      )}
    </Screen>
  );
}

export default function ParentReportScreen() {
  return (
    <RequireRole roles={['PARENT']}>
      <Inner />
    </RequireRole>
  );
}
