import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Field, Input, Loading, Muted, Screen, SectionTitle, Stat } from '../../components/ui';
import { colors } from '../../theme';
import type { Academy, Subscription } from '../../types';

interface PendingOwner {
  id: string;
  name: string;
  email: string;
  created_at: string;
  pendingInvite: { code: string; academyName: string } | null;
}

function Inner() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [pendingOwners, setPendingOwners] = useState<PendingOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetOwner, setTargetOwner] = useState<PendingOwner | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('37.5665');
  const [longitude, setLongitude] = useState('126.9780');
  const [totalSeats, setTotalSeats] = useState('20');
  const [isCreating, setIsCreating] = useState(false);

  // 방금 발급된 등록 코드(한 번만 보여줌)
  const [issued, setIssued] = useState<{ academyName: string; code: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data: a }, { data: s }, { count }, owners] = await Promise.all([
      supabase.from('academies').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      apiFetch<{ data: PendingOwner[] }>('/api/admin/owner-signups').catch(() => ({ data: [] as PendingOwner[] })),
    ]);
    setAcademies((a as Academy[]) ?? []);
    setSubs((s as Subscription[]) ?? []);
    setUserCount(count ?? null);
    setPendingOwners(owners.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startAcademyFor = (owner: PendingOwner) => {
    setTargetOwner(owner);
    setName(`${owner.name} 원장 지점`);
  };

  const createAcademy = async () => {
    setError(null);
    setIsCreating(true);
    try {
      const res = await apiFetch<{ academy: Academy; inviteCode: string }>('/api/admin/academies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          totalSeats: Number(totalSeats),
          ownerId: targetOwner?.id,
        }),
      });
      setIssued({ academyName: res.academy.name, code: res.inviteCode });
      setName('');
      setAddress('');
      setTargetOwner(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '학원 생성 실패');
    } finally {
      setIsCreating(false);
    }
  };

  const reissueCode = async (academy: Academy) => {
    setError(null);
    try {
      const res = await apiFetch<{ inviteCode: string }>(`/api/admin/academies/${academy.id}/invite`, { method: 'POST' });
      setIssued({ academyName: academy.name, code: res.inviteCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : '재발급 실패');
    }
  };

  const stats = useMemo(() => {
    const thisMonth = format(new Date(), 'yyyy-MM');
    const paid = subs.filter((x) => x.status === 'PAID');
    return {
      academyCount: academies.length,
      activeCount: academies.filter((x) => x.subscription_status === 'ACTIVE').length,
      trialCount: academies.filter((x) => x.subscription_status === 'TRIAL').length,
      totalRevenue: paid.reduce((sum, x) => sum + x.amount, 0),
      monthRevenue: paid.filter((x) => x.paid_at?.startsWith(thisMonth)).reduce((sum, x) => sum + x.amount, 0),
    };
  }, [academies, subs]);

  if (isLoading) return <Loading />;

  const canCreate = name.trim() && address.trim() && Number(totalSeats) > 0;

  return (
    <Screen>
      {issued && (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: '#BFDBFE' }}>
          <Text style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 19 }}>
            <Text style={{ fontWeight: '700' }}>{issued.academyName}</Text> 원장 등록 코드가 발급됐습니다. 대상 원장을
            지정했다면 그 원장의 내 페이지(등록 화면)에 자동으로 표시됩니다. 지정하지 않았다면 이 코드를 직접
            전달해주세요.
          </Text>
          <Text style={{ fontFamily: 'Courier', fontSize: 26, fontWeight: '700', letterSpacing: 4, color: '#1E3A8A', marginVertical: 8 }} selectable>
            {issued.code}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 13 }} onPress={() => setIssued(null)}>
            닫기
          </Text>
        </Card>
      )}

      <Banner kind="error">{error ?? undefined}</Banner>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Stat label="가입 학원" value={`${stats.academyCount}곳`} />
        <Stat label="유료 / 체험" value={`${stats.activeCount} / ${stats.trialCount}`} />
        <Stat label="전체 가입자" value={userCount === null ? '—' : `${userCount}명`} />
        <Stat label="이번 달 매출" value={`${stats.monthRevenue.toLocaleString()}원`} />
        <Stat label="누적 매출" value={`${stats.totalRevenue.toLocaleString()}원`} />
      </View>

      <SectionTitle>승인 대기 원장 {pendingOwners.length > 0 && `(${pendingOwners.length})`}</SectionTitle>
      {pendingOwners.length === 0 ? (
        <Card>
          <Muted style={{ textAlign: 'center' }}>학원 연결을 기다리는 원장이 없습니다.</Muted>
        </Card>
      ) : (
        pendingOwners.map((owner) => (
          <Card key={owner.id}>
            <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>{owner.name}</Text>
            <Muted>
              {owner.email} · {owner.created_at.slice(0, 10)} 가입
            </Muted>
            <View style={{ marginTop: 10 }}>
              {owner.pendingInvite ? (
                <View>
                  <Muted>{owner.pendingInvite.academyName} 코드 발급됨</Muted>
                  <Text style={{ fontFamily: 'Courier', fontSize: 16, fontWeight: '700', letterSpacing: 3, color: '#1D4ED8' }} selectable>
                    {owner.pendingInvite.code}
                  </Text>
                </View>
              ) : (
                <Button title="학원 만들고 승인" small onPress={() => startAcademyFor(owner)} />
              )}
            </View>
          </Card>
        ))
      )}

      <SectionTitle>학원 추가 (좌석 자동 생성 + 원장 등록 코드 발급)</SectionTitle>
      <Card>
        {targetOwner && (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#1D4ED8' }}>
              <Text style={{ fontWeight: '700' }}>{targetOwner.name}</Text> 원장님에게 코드가 자동 배정됩니다 (내 페이지에
              알림으로 표시됨).
            </Text>
            <Text style={{ fontSize: 12, color: colors.primary, marginTop: 4 }} onPress={() => setTargetOwner(null)}>
              선택 해제
            </Text>
          </View>
        )}
        <Field label="이름">
          <Input value={name} onChangeText={setName} />
        </Field>
        <Field label="주소">
          <Input value={address} onChangeText={setAddress} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="좌석 수">
              <Input value={totalSeats} onChangeText={(t) => setTotalSeats(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="위도">
              <Input value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="경도">
              <Input value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
        </View>
        <Button title="추가" onPress={createAcademy} loading={isCreating} disabled={!canCreate} />
        <Muted style={{ marginTop: 8, lineHeight: 18 }}>
          생성 즉시 원장 등록 코드가 발급됩니다. 원장은 회원가입 후 학원 등록 화면에서 이 코드를 입력해 자기 지점에
          연결합니다.
        </Muted>
      </Card>

      <SectionTitle>학원 목록</SectionTitle>
      {academies.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>{a.name}</Text>
          <Muted>{a.address}</Muted>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Muted>
              {a.subscription_status} · {a.subscription_expires_at?.slice(0, 10) ?? '—'}
            </Muted>
            <Text style={{ color: colors.primary, fontSize: 13 }} onPress={() => reissueCode(a)}>
              등록코드 재발급
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export default function SuperAdminScreen() {
  return (
    <RequireRole roles={['SUPER_ADMIN']}>
      <Inner />
    </RequireRole>
  );
}
