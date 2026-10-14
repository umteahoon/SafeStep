import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { TeamActions } from '../../components/TeamActions';
import { Badge, Banner, Empty, Loading, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Team } from '../../types';

interface MyTeamRow {
  role: 'OWNER' | 'MEMBER';
  teams: Team | null;
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user, isMember } = useAuth();

  const [teams, setTeams] = useState<MyTeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const myTeams = teams.filter((t) => t.teams);

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>친구가 만든 팀 코드로 스터디 팀 채팅방에 들어올 수 있어요</Muted>
      <TeamActions canCreate={isMember} />

      <Banner kind="error">{error ?? undefined}</Banner>

      <SectionTitle>참가 중인 팀 채팅방</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : myTeams.length === 0 ? (
        <Empty>아직 참가한 팀 채팅방이 없습니다. 참가 코드를 입력해 들어와보세요.</Empty>
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
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT']}>
      <Inner />
    </RequireRole>
  );
}
