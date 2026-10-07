import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Button, Card, Empty, Loading, Muted, Screen } from '../../components/ui';
import { colors } from '../../theme';

interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const SUSPICIOUS_WINDOW_MIN = 60;
const SUSPICIOUS_THRESHOLD = 3;

function Inner() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setCheckedAt(Date.now());
    setAttempts((data as LoginAttempt[]) ?? []);
    setError(e?.message ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 최근 SUSPICIOUS_WINDOW_MIN분 내 같은 이메일로 SUSPICIOUS_THRESHOLD회 이상 실패 → 의심 신호
  const suspiciousEmails = useMemo(() => {
    const cutoff = checkedAt - SUSPICIOUS_WINDOW_MIN * 60_000;
    const failCount = new Map<string, number>();
    for (const a of attempts) {
      if (a.success) continue;
      if (new Date(a.created_at).getTime() < cutoff) continue;
      failCount.set(a.email, (failCount.get(a.email) ?? 0) + 1);
    }
    return new Set([...failCount.entries()].filter(([, c]) => c >= SUSPICIOUS_THRESHOLD).map(([email]) => email));
  }, [attempts, checkedAt]);

  const visible = onlyFailed ? attempts.filter((a) => !a.success) : attempts;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button
          title={onlyFailed ? '실패만 보는 중' : '실패만 보기'}
          variant={onlyFailed ? 'danger' : 'secondary'}
          small
          onPress={() => setOnlyFailed((v) => !v)}
        />
        <Button title="새로고침" variant="secondary" small onPress={load} />
      </View>

      <Banner kind="error">{error ?? undefined}</Banner>

      {suspiciousEmails.size > 0 && (
        <Banner kind="error">
          최근 {SUSPICIOUS_WINDOW_MIN}분 내 {SUSPICIOUS_THRESHOLD}회 이상 로그인 실패한 계정: {[...suspiciousEmails].join(', ')}
        </Banner>
      )}

      {isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>기록이 없습니다.</Empty>
      ) : (
        visible.map((a) => (
          <Card key={a.id} style={suspiciousEmails.has(a.email) ? { backgroundColor: colors.dangerSoft } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>
                {a.email}
              </Text>
              {suspiciousEmails.has(a.email) && <Badge text="반복 실패" bg={colors.dangerSoft} fg={colors.dangerText} />}
              <Badge text={a.success ? '성공' : '실패'} bg={a.success ? colors.primarySoft : colors.dangerSoft} fg={a.success ? colors.primary : colors.dangerText} />
            </View>
            <Muted style={{ marginTop: 4 }}>{new Date(a.created_at).toLocaleString('ko-KR')}</Muted>
            <Muted>IP {a.ip_address ?? '—'}</Muted>
            {a.user_agent && (
              <Muted numberOfLines={1}>{a.user_agent}</Muted>
            )}
          </Card>
        ))
      )}

      <Muted style={{ marginTop: 4, lineHeight: 18 }}>
        최근 200건만 표시됩니다. 같은 이메일로 {SUSPICIOUS_WINDOW_MIN}분 내 {SUSPICIOUS_THRESHOLD}회 이상 실패하면 자동으로
        표시됩니다.
      </Muted>
    </Screen>
  );
}

export default function AdminLogsScreen() {
  return (
    <RequireRole roles={['SUPER_ADMIN']}>
      <Inner />
    </RequireRole>
  );
}
