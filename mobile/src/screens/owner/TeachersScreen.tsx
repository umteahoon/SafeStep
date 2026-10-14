import { useCallback, useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { confirmAsync } from '../../lib/confirm';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Empty, Loading, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

function Inner() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id;
  const [pending, setPending] = useState<Teacher[]>([]);
  const [approved, setApproved] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{ data: Teacher[] }>('/api/teachers/pending');
      setPending(res.data ?? []);
      if (academyId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, phone')
          .eq('academy_id', academyId)
          .eq('role', 'TEACHER')
          .eq('approval_status', 'APPROVED');
        setApproved((data as Teacher[]) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<{ code: string }>('/api/owner/teacher-invite')
      .then((r) => setInviteCode(r.code))
      .catch(() => setInviteCode(null));
  }, []);

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setInviteMsg('초대 코드를 복사했어요');
    } catch {
      setInviteMsg('복사하지 못했어요. 코드를 직접 입력해 전달해 주세요.');
    }
  };

  const shareInvite = () =>
    inviteCode &&
    Share.share({ message: `SafeStep 강사 초대 코드: ${inviteCode}\n앱에서 강사로 가입한 뒤 "학원 합류"에 입력하세요.` });

  const regenerate = async () => {
    const ok = await confirmAsync('초대 코드를 다시 만들까요?', '이전 코드는 바로 사용할 수 없게 돼요.', '다시 만들기');
    if (!ok) return;
    try {
      const r = await apiFetch<{ code: string }>('/api/owner/teacher-invite/regenerate', { method: 'POST' });
      setInviteCode(r.code);
      setInviteMsg('새 초대 코드를 만들었어요');
    } catch (e) {
      setError(e instanceof Error ? e.message : '재발급 실패');
    }
  };

  const act = async (teacherId: string, action: 'approve' | 'reject') => {
    setBusyId(teacherId);
    try {
      await apiFetch(`/api/teachers/${teacherId}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <Banner kind="error">{error ?? undefined}</Banner>

      <Card>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>강사 초대 코드</Text>
        <Muted style={{ marginTop: 2 }}>강사가 가입한 뒤 이 코드를 입력하면 바로 우리 학원 소속이 돼요.</Muted>
        <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: 5, color: colors.primaryDark, textAlign: 'center', marginVertical: 14 }} selectable>
          {inviteCode ?? '------'}
        </Text>
        <Banner kind="success">{inviteMsg ?? undefined}</Banner>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="복사" variant="secondary" small onPress={copyInvite} disabled={!inviteCode} style={{ flex: 1 }} />
          <Button title="공유" small onPress={shareInvite} disabled={!inviteCode} style={{ flex: 1 }} />
          <Button title="재발급" variant="secondary" small onPress={regenerate} disabled={!inviteCode} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionTitle>승인 대기 ({pending.length})</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : pending.length === 0 ? (
        <Empty>대기 중인 강사가 없습니다.</Empty>
      ) : (
        pending.map((t) => (
          <Card key={t.id}>
            <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>{t.name}</Text>
            <Muted style={{ marginBottom: 12 }}>
              {t.email}
              {t.phone ? ` · ${t.phone}` : ''}
            </Muted>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="승인" onPress={() => act(t.id, 'approve')} disabled={busyId === t.id} style={{ flex: 1 }} small />
              <Button title="반려" variant="secondary" onPress={() => act(t.id, 'reject')} disabled={busyId === t.id} style={{ flex: 1 }} small />
            </View>
          </Card>
        ))
      )}

      <SectionTitle>소속 강사 ({approved.length})</SectionTitle>
      {approved.length === 0 ? (
        <Empty>승인된 강사가 없습니다.</Empty>
      ) : (
        approved.map((t) => (
          <Card key={t.id}>
            <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>{t.name}</Text>
            <Muted>
              {t.email}
              {t.phone ? ` · ${t.phone}` : ''}
            </Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function TeachersScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN']}>
      <Inner />
    </RequireRole>
  );
}
