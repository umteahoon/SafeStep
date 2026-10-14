import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, format } from 'date-fns';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, DayStepper, Input, Loading, Screen } from '../../components/ui';
import { colors, radius } from '../../theme';

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
const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  PRESENT: { fg: '#12A150', bg: '#E7F6EC' },
  LATE: { fg: '#B54708', bg: '#FFF1D6' },
  ABSENT: { fg: '#D92D20', bg: '#FDECEA' },
  EXCUSED: { fg: '#475467', bg: '#F2F4F7' },
};
const REASONS = ['몸이 아파요', '병원 진료', '가족 행사', '학교 행사'];
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function dateLabel(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

function Inner() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 사전 결석/지각 신청
  const [absenceDate, setAbsenceDate] = useState(ymd(new Date()));
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
      setShowLink(false);
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
    const { error: insErr } = await supabase.from('absence_requests').insert({
      academy_id: child.academy_id,
      student_id: child.id,
      date: absenceDate,
      type: absenceType,
      reason: absenceReason.trim() || null,
      requested_by: user?.id ?? null,
    });
    if (insErr) {
      setError(insErr.message.includes('unique') ? '해당 날짜에 이미 신청 내역이 있습니다.' : insErr.message);
      return;
    }
    setMessage(`${dateLabel(absenceDate)} ${absenceType === 'ABSENCE' ? '결석' : '지각'} 신청이 접수되었어요.`);
    setAbsenceReason('');
  };

  const selectedChild = children.find((c) => c.id === selectedId);
  const today = new Date();
  const quickDates = [
    { label: '오늘', value: ymd(today) },
    { label: '내일', value: ymd(addDays(today, 1)) },
    { label: '모레', value: ymd(addDays(today, 2)) },
  ];

  const linkForm = (
    <View style={s.linkBox}>
      <Text style={s.linkHint}>학원에서 받은 6자리 코드를 입력하세요</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input
          value={linkCode}
          onChangeText={(t) => setLinkCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          style={{ flex: 1, letterSpacing: 4, fontSize: 18 }}
        />
        <Button title="연동" onPress={linkChild} disabled={linkCode.length < 6} />
      </View>
    </View>
  );

  return (
    <Screen>
      <Banner kind="success">{message ?? undefined}</Banner>
      <Banner kind="error">{error ?? undefined}</Banner>

      {isLoading ? (
        <Loading />
      ) : children.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>자녀를 연동해 주세요</Text>
          <Text style={s.emptySub}>연동하면 출결과 학습시간을 바로 볼 수 있어요</Text>
          {linkForm}
        </View>
      ) : (
        <>
          {/* 자녀 선택 */}
          <View style={s.childRow}>
            {children.map((c) => (
              <Pressable key={c.id} onPress={() => setSelectedId(c.id)} style={[s.childChip, c.id === selectedId && s.childChipOn]}>
                <Text style={[s.childChipText, c.id === selectedId && { color: colors.white }]}>{c.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowLink((v) => !v)} style={s.childAdd}>
              <Text style={s.childAddText}>+ 자녀 추가</Text>
            </Pressable>
          </View>
          {showLink && linkForm}

          {/* 이번 주 */}
          <Text style={s.h2}>이번 주 {selectedChild?.name ?? ''} 학생</Text>
          {!report ? (
            <Loading />
          ) : (
            <>
              <View style={s.statRow}>
                <View style={s.stat}>
                  <Text style={s.statLabel}>출석률</Text>
                  <Text style={s.statValue}>{report.attendanceRate === null ? '—' : `${report.attendanceRate}%`}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statLabel}>공부한 시간</Text>
                  <Text style={s.statValue}>{Math.round((report.totalStudyMinutes / 60) * 10) / 10}시간</Text>
                </View>
              </View>
              <Text style={s.range}>
                {report.range.from} ~ {report.range.to}
              </Text>
              {report.records.length === 0 ? (
                <Text style={s.muted}>이번 주 출석 기록이 없어요</Text>
              ) : (
                report.records.map((r, i) => {
                  const c = STATUS_COLOR[r.status] ?? STATUS_COLOR.EXCUSED;
                  return (
                    <View key={i} style={[s.recRow, i > 0 && s.recBorder]}>
                      <Text style={s.recDate}>{dateLabel(r.date)}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={[s.badge, { backgroundColor: c.bg }]}>
                          <Text style={[s.badgeText, { color: c.fg }]}>{STATUS_LABEL[r.status] ?? r.status}</Text>
                        </View>
                        {!!r.reason && <Text style={s.reason}>{r.reason}</Text>}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}

          {/* 사전 신청 */}
          <Text style={[s.h2, { marginTop: 36 }]}>미리 알리기</Text>
          <Text style={s.muted}>학원에 못 가거나 늦는 날을 미리 알려 주세요</Text>

          <Text style={s.label}>언제인가요?</Text>
          <View style={s.chipRow}>
            {quickDates.map((q) => (
              <Pressable key={q.label} onPress={() => setAbsenceDate(q.value)} style={[s.chip, absenceDate === q.value && s.chipOn]}>
                <Text style={[s.chipText, absenceDate === q.value && s.chipTextOn]}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.picked}>{dateLabel(absenceDate)}</Text>
          <DayStepper value={absenceDate} onChange={setAbsenceDate} />

          <Text style={s.label}>어떤 일인가요?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(
              [
                ['ABSENCE', '결석해요'],
                ['LATE', '늦어요'],
              ] as const
            ).map(([v, l]) => (
              <Pressable key={v} onPress={() => setAbsenceType(v)} style={[s.typeBtn, absenceType === v && s.typeBtnOn]}>
                <Text style={[s.typeText, absenceType === v && { color: colors.white }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>이유 (선택)</Text>
          <View style={s.chipRow}>
            {REASONS.map((r) => (
              <Pressable key={r} onPress={() => setAbsenceReason(r)} style={[s.chip, absenceReason === r && s.chipOn]}>
                <Text style={[s.chipText, absenceReason === r && s.chipTextOn]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Input value={absenceReason} onChangeText={setAbsenceReason} placeholder="직접 입력할 수도 있어요" style={{ marginTop: 10 }} />

          <View style={{ marginTop: 20 }}>
            <Button title={`${dateLabel(absenceDate)} ${absenceType === 'ABSENCE' ? '결석' : '지각'} 알리기`} onPress={requestAbsence} />
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  childChip: { backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  childChipOn: { backgroundColor: colors.primary },
  childChipText: { fontSize: 16, fontWeight: '800', color: colors.text },
  childAdd: { paddingHorizontal: 8, paddingVertical: 11 },
  childAddText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  linkBox: { backgroundColor: '#EEF4FF', borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 10 },
  linkHint: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  emptyBox: { paddingVertical: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 15, color: colors.textSub, marginTop: 6 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 28, marginBottom: 14, letterSpacing: -0.4 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: '#F7F8FA', borderRadius: radius.lg, padding: 18 },
  statLabel: { fontSize: 14, color: colors.textSub, fontWeight: '600' },
  statValue: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 6, letterSpacing: -0.8 },
  range: { fontSize: 13, color: colors.textMuted, marginTop: 10, marginBottom: 6 },
  muted: { fontSize: 14, color: colors.textSub },
  recRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  recBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  recDate: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontSize: 14, fontWeight: '800' },
  reason: { fontSize: 12, color: colors.textSub, marginTop: 4 },
  label: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.white },
  picked: { fontSize: 15, color: colors.textSub, marginTop: 12, marginBottom: 4 },
  typeBtn: { flex: 1, backgroundColor: '#F3F5F8', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  typeBtnOn: { backgroundColor: colors.primary },
  typeText: { fontSize: 17, fontWeight: '800', color: colors.text },
});

export default function ParentReportScreen() {
  return (
    <RequireRole roles={['PARENT']}>
      <Inner />
    </RequireRole>
  );
}
