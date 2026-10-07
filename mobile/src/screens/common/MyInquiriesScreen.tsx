import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Badge, Card, Empty, Loading, Muted, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { Inquiry } from '../../types';

function Inner() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('inquiries')
      .select('*')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInquiries((data as Inquiry[]) ?? []);
        setIsLoading(false);
      });
  }, [user]);

  return (
    <Screen>
      <Title>내 문의 내역</Title>
      <Muted style={{ marginBottom: 16 }}>
        로그인 상태로 남긴 "학원·스터디카페 도입 문의"만 표시됩니다.
      </Muted>
      {isLoading ? (
        <Loading />
      ) : inquiries.length === 0 ? (
        <Empty>아직 남긴 문의가 없습니다.</Empty>
      ) : (
        inquiries.map((q) => (
          <Card key={q.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>
                {q.business_name || q.business_type || '문의'}
              </Text>
              <Badge text="접수됨" />
            </View>
            <Muted style={{ marginTop: 4 }}>{new Date(q.created_at).toLocaleString('ko-KR')}</Muted>
            {q.message && (
              <Text style={{ marginTop: 8, fontSize: 14, color: colors.textSub }}>{q.message}</Text>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function MyInquiriesScreen() {
  return (
    <RequireRole roles={['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
      <Inner />
    </RequireRole>
  );
}
