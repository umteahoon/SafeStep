import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Input, Loading, Muted, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Student } from '../../types';

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user, refreshStudentLink } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const loadStudent = useCallback(() => {
    if (!user) return;
    supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setStudent((data as Student) ?? null);
        setIsLoading(false);
      });
  }, [user]);

  useEffect(loadStudent, [loadStudent]);

  const linkStudent = async () => {
    setLinkError(null);
    setIsLinking(true);
    try {
      await apiFetch('/api/student-link/link', {
        method: 'POST',
        body: JSON.stringify({ linkCode }),
      });
      setLinkCode('');
      await refreshStudentLink(); // 일반 회원 → 학생으로 전환(탭·홈이 바뀜)
      loadStudent();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : '연동에 실패했습니다.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Screen>
      <Title>{student || isLoading ? '내 출결 QR' : '학원·스터디카페 연동'}</Title>
      <Muted style={{ marginBottom: 16 }}>{student || isLoading ? '키오스크에 스캔하세요' : '연동하면 이용권, 출결 QR, 채팅, 팀을 쓸 수 있어요'}</Muted>

      {isLoading ? (
        <Loading />
      ) : !student ? (
        <Card>
          <Muted style={{ fontSize: 14, marginBottom: 14, lineHeight: 20 }}>
            아직 연동된 학원·스터디카페가 없어요. 다니는 곳에서 발급받은 6자리 연동코드를 입력해주세요.
          </Muted>
          <Input
            value={linkCode}
            onChangeText={(t) => setLinkCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            style={{ textAlign: 'center', fontSize: 20, letterSpacing: 6, marginBottom: 12 }}
          />
          <Banner kind="error">{linkError}</Banner>
          <Button
            title="연동하기"
            variant="indigo"
            onPress={linkStudent}
            loading={isLinking}
            disabled={linkCode.length < 6}
          />
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 }}>
            <QRCode value={student.qr_token} size={220} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{student.name}</Text>
          <Muted style={{ marginTop: 4 }}>
            핀코드 입력 시:{' '}
            <Text style={{ fontFamily: 'Courier', color: colors.text }}>{student.attendance_code}</Text>
          </Muted>
        </Card>
      )}

      {student && (
        <Button title="이용권 관리" icon="ticket-outline" variant="secondary" onPress={() => navigation.navigate('StudentPasses')} />
      )}
    </Screen>
  );
}

export default function StudentQrScreen() {
  return (
    <RequireRole roles={['STUDENT']}>
      <Inner />
    </RequireRole>
  );
}
