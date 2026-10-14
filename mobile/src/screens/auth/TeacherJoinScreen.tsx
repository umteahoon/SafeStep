import { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { Banner, Button, Card, Input, Loading, Muted, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';

/** 강사: 원장에게 받은 초대 코드로 학원에 합류 (코드가 곧 원장의 승인이라 바로 사용 가능) */
export default function TeacherJoinScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loading />;
  if (!user || profile?.role !== 'TEACHER') {
    return (
      <Screen>
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>강사 계정 전용 화면이에요</Text>
          <Muted style={{ marginTop: 4 }}>강사로 가입한 계정으로 로그인하면 초대 코드를 입력할 수 있어요.</Muted>
        </Card>
      </Screen>
    );
  }

  const join = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/api/teacher-invite/join', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      await refreshProfile();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : '학원에 합류하지 못했어요.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>학원에 합류하기</Text>
        <Muted style={{ marginTop: 4, marginBottom: 14, lineHeight: 19 }}>
          원장님께 받은 8자리 강사 초대 코드를 입력하면 바로 학원에 소속돼요.
        </Muted>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 8))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="예: 7F3KQ9ZT"
          style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, marginBottom: 12 }}
        />
        <Banner kind="error">{error ?? undefined}</Banner>
        <Button title="합류하기" onPress={join} loading={busy} disabled={code.trim().length < 6} />
      </Card>
    </Screen>
  );
}
