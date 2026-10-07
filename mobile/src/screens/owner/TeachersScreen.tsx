import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
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
