import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Button, Card, Empty, Field, Input, Loading, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Team } from '../../types';

type Panel = 'create' | 'join' | null;

interface MyTeamRow {
  role: 'OWNER' | 'MEMBER';
  teams: Team | null;
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user } = useAuth();

  const [teams, setTeams] = useState<MyTeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    const { data, error: loadError } = await supabase
      .from('team_members')
      .select('role, teams(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    if (loadError) {
      setError(
        '팀 목록을 불러오지 못했습니다. (DB 마이그레이션 supabase/migration_teams_chat.sql 적용 여부를 확인하세요)'
      );
    } else {
      setTeams((data as unknown as MyTeamRow[]) ?? []);
    }
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [loadTeams])
  );

  const openPanel = (next: Panel) => {
    setPanel((p) => (p === next ? null : next));
    setError(null);
  };

  const createTeam = async () => {
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('create_team', {
      p_name: name.trim(),
      p_description: description.trim() || null,
    });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 생성에 실패했습니다.');
      return;
    }
    setName('');
    setDescription('');
    setPanel(null);
    navigation.navigate('TeamRoom', { teamId: (data as Team).id });
  };

  const joinTeam = async () => {
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('join_team_by_code', { p_code: code });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 참가에 실패했습니다.');
      return;
    }
    setCode('');
    setPanel(null);
    navigation.navigate('TeamRoom', { teamId: data as string });
  };

  const myTeams = teams.filter((t) => t.teams);

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>같은 학원 사람들과 팀을 만들고 채팅하세요</Muted>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button
          title="팀 만들기"
          variant="indigo"
          onPress={() => openPanel('create')}
          style={{ flex: 1 }}
        />
        <Button title="팀 참가" variant="secondary" onPress={() => openPanel('join')} style={{ flex: 1 }} />
      </View>

      {panel === 'create' && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>새 팀 만들기</Text>
          <Muted style={{ marginBottom: 14, marginTop: 2 }}>
            만들면 알파벳+숫자 조합의 참가 코드가 자동으로 발급됩니다.
          </Muted>
          <Field label="팀 이름">
            <Input value={name} onChangeText={setName} maxLength={50} placeholder="예: 중3 수학 스터디" />
          </Field>
          <Field label="설명 (선택)">
            <Input value={description} onChangeText={setDescription} maxLength={200} placeholder="팀 소개" />
          </Field>
          <Button title="팀 만들기" variant="indigo" onPress={createTeam} loading={isBusy} disabled={!name.trim()} />
        </Card>
      )}

      {panel === 'join' && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>참가 코드로 팀 참가</Text>
          <Muted style={{ marginBottom: 14, marginTop: 2 }}>
            팀장에게 받은 8자리 코드를 입력하세요. 초대 링크를 받았다면 링크를 바로 여세요.
          </Muted>
          <Input
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AB12CD34"
            style={{ fontSize: 20, letterSpacing: 4, marginBottom: 14 }}
          />
          <Button
            title="참가하기"
            variant="indigo"
            onPress={joinTeam}
            loading={isBusy}
            disabled={code.trim().length < 8}
          />
        </Card>
      )}

      <Banner kind="error">{error ?? undefined}</Banner>

      <SectionTitle>내 팀</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : myTeams.length === 0 ? (
        <Empty>아직 참가한 팀이 없습니다. 팀을 만들거나 참가 코드로 들어와보세요.</Empty>
      ) : (
        myTeams.map((row) => (
          <Pressable
            key={row.teams!.id}
            onPress={() => navigation.navigate('TeamRoom', { teamId: row.teams!.id })}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.white,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                marginBottom: 8,
                gap: 10,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                {row.teams!.name}
              </Text>
              {row.teams!.description && (
                <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>
                  {row.teams!.description}
                </Text>
              )}
            </View>
            <Badge
              text={row.role === 'OWNER' ? '팀장' : '멤버'}
              bg={row.role === 'OWNER' ? colors.indigoSoft : colors.graySoft}
              fg={row.role === 'OWNER' ? colors.indigo : colors.gray}
            />
          </Pressable>
        ))
      )}
    </Screen>
  );
}

export default function TeamsScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}
