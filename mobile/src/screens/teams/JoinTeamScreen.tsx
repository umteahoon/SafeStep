import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { canUseTeams } from '../../lib/teams';
import { Banner, Button, Card, Loading, Muted, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';

interface Preview {
  team_id: string;
  team_name: string;
  description: string | null;
  member_count: number;
  same_academy: boolean;
  already_member: boolean;
}

/** 초대 링크(safestep://teams/join/CODE) 진입 화면. 비로그인이면 로그인 후 이 화면으로 돌아옵니다. */
export default function JoinTeamScreen() {
  const navigation = useNavigation<RootNav>();
  const { code } = useRoute<RouteProp<RootStackParamList, 'JoinTeam'>>().params;
  const { user, profile, isLoading: authLoading } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const eligible = canUseTeams(profile?.role);

  useEffect(() => {
    if (authLoading || !user || !eligible) return;
    supabase.rpc('team_preview_by_code', { p_code: code }).then(({ data, error: rpcError }) => {
      if (rpcError) setError(rpcError.message);
      setPreview(((data as Preview[]) ?? [])[0] ?? null);
      setIsChecking(false);
    });
  }, [authLoading, user, eligible, code]);

  const join = async () => {
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('join_team_by_code', { p_code: code });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 참가에 실패했습니다.');
      return;
    }
    navigation.replace('TeamRoom', { teamId: data as string });
  };

  let body;
  if (authLoading || (user && eligible && isChecking)) {
    body = <Loading text="확인 중..." />;
  } else if (!user) {
    body = (
      <>
        <Muted style={{ fontSize: 14, marginBottom: 16 }}>
          팀에 참가하려면 먼저 로그인해주세요. 로그인하면 이 초대로 돌아옵니다.
        </Muted>
        <Button
          title="로그인하고 참가하기"
          variant="indigo"
          onPress={() => navigation.navigate('Login', { next: { name: 'JoinTeam', params: { code } } })}
        />
        <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: 12 }}>
          계정이 없다면{' '}
          <Text style={{ color: colors.indigo, fontWeight: '600' }} onPress={() => navigation.navigate('Register')}>
            회원가입
          </Text>
        </Text>
      </>
    );
  } else if (!eligible) {
    body = <Banner kind="error">팀 기능은 학원에 소속된 원장·강사·학생만 사용할 수 있습니다.</Banner>;
  } else if (!preview) {
    body = <Banner kind="error">{error ?? '유효하지 않은 초대 코드입니다. 코드를 다시 확인해주세요.'}</Banner>;
  } else {
    body = (
      <>
        <Title>{preview.team_name}</Title>
        {preview.description && <Muted style={{ fontSize: 14 }}>{preview.description}</Muted>}
        <Muted style={{ marginTop: 8 }}>멤버 {preview.member_count}명</Muted>

        <View style={{ marginTop: 20 }}>
          {preview.already_member ? (
            <Button
              title="이미 참가한 팀 — 채팅방 열기"
              variant="indigo"
              onPress={() => navigation.replace('TeamRoom', { teamId: preview.team_id })}
            />
          ) : !preview.same_academy ? (
            <Banner kind="warn">같은 학원에 소속된 사람만 참가할 수 있는 팀입니다.</Banner>
          ) : (
            <Button title="팀 참가하기" variant="indigo" onPress={join} loading={isBusy} />
          )}
        </View>
        <Banner kind="error">{error ?? undefined}</Banner>
      </>
    );
  }

  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.indigo, marginBottom: 4 }}>
          SafeStep 팀 초대
        </Text>
        <Text style={{ fontFamily: 'Courier', fontSize: 14, letterSpacing: 3, color: colors.textMuted, marginBottom: 16 }}>
          {code.toUpperCase()}
        </Text>
        {body}
      </Card>
    </Screen>
  );
}
