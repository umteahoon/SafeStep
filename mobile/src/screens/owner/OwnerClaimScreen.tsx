import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Icon, Input, Loading, Muted, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Academy } from '../../types';

interface AssignedInvite {
  code: string;
  academies: { name: string } | { name: string }[] | null;
}

interface AssignedCode {
  code: string;
  academyName: string;
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user, profile, refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 슈퍼관리자가 나에게 배정해준, 아직 안 쓴 등록 코드가 있는지 확인 (알림 벨로 노출)
  const [assigned, setAssigned] = useState<AssignedCode | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const hasUnread = !!assigned && !hasSeen;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('academy_owner_invites')
      .select('code, academies(name)')
      .eq('assigned_user_id', user.id)
      .is('used_at', null)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as AssignedInvite | null;
        if (row) {
          const academy = Array.isArray(row.academies) ? row.academies[0] : row.academies;
          setAssigned({ code: row.code, academyName: academy?.name ?? '' });
        }
        setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const claim = async (claimCode: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch<{ academy: Academy }>('/api/owner/claim', {
        method: 'POST',
        body: JSON.stringify({ code: claimCode }),
      });
      await refreshProfile();
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'Dashboard' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Title>내 페이지</Title>
          {profile && <Muted>{profile.name}님, 학원 등록 대기 중입니다</Muted>}
        </View>
        <Pressable
          accessibilityLabel="알림"
          onPress={() => {
            setBellOpen((v) => !v);
            if (assigned) setHasSeen(true);
          }}
          style={styles.bell}
        >
          <Icon name={hasUnread ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
          {hasUnread && <View style={styles.badge} />}
        </Pressable>
      </View>

      {bellOpen && (
        <Card>
          <Text style={styles.cardLabel}>알림</Text>
          {isChecking ? (
            <Loading text="확인 중..." />
          ) : assigned ? (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, padding: 12 }}>
              <Text style={{ color: '#1D4ED8', fontWeight: '600', fontSize: 14 }}>
                {assigned.academyName ? `${assigned.academyName} 지점의 ` : ''}등록 코드가 발급되었습니다
              </Text>
              <Text style={styles.code}>{assigned.code}</Text>
              <Button
                title="이 코드로 바로 연결하기"
                onPress={() => claim(assigned.code)}
                loading={isSubmitting}
              />
            </View>
          ) : (
            <Muted style={{ textAlign: 'center', paddingVertical: 12 }}>아직 새로운 알림이 없습니다.</Muted>
          )}
        </Card>
      )}

      <Card>
        {!isChecking && assigned ? (
          <>
            <Text style={styles.h2}>새 알림이 있어요</Text>
            <Muted style={{ marginTop: 4, lineHeight: 19 }}>
              학원 등록 코드가 발급됐습니다. 오른쪽 위 알림 버튼을 눌러 확인하고 바로 연결하세요.
            </Muted>
          </>
        ) : (
          <>
            <Text style={styles.h2}>학원 등록을 기다리는 중이에요</Text>
            <Muted style={{ marginTop: 4, lineHeight: 19 }}>
              SafeStep 플랫폼팀이 지점을 등록하면, 원장님 전용 8자리 등록 코드가 알림으로 도착합니다.
            </Muted>
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.h2}>등록 코드 직접 입력</Text>
        <Muted style={{ marginTop: 2, marginBottom: 12 }}>
          플랫폼 운영팀에게 코드를 따로 전달받았다면 여기에 입력하세요.
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
        <Button title="등록하기" onPress={() => claim(code)} loading={isSubmitting} disabled={!code.trim()} />
      </Card>
    </Screen>
  );
}

export default function OwnerClaimScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN']} allowNoAcademy>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '600', color: colors.text },
  code: {
    fontFamily: 'Courier',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#1E3A8A',
    marginVertical: 8,
  },
});
