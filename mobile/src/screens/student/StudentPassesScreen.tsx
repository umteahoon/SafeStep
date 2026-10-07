import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { TossPaymentModal, tossConfigured } from '../../components/TossPayment';
import { Badge, Banner, Button, Card, Muted, Screen, SectionTitle, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { PassPlan, StudentPass } from '../../types';

function formatPassDetail(pass: StudentPass): string {
  if (pass.pass_type === 'TIME') {
    const hours = Math.floor((pass.remaining_minutes ?? 0) / 60);
    const minutes = (pass.remaining_minutes ?? 0) % 60;
    return `잔여 ${hours}시간 ${minutes}분`;
  }
  return pass.expires_at ? `${new Date(pass.expires_at).toLocaleDateString('ko-KR')}까지` : '';
}

const STATUS_LABEL: Record<StudentPass['status'], string> = {
  ACTIVE: '이용 중',
  DEPLETED: '소진됨',
  EXPIRED: '만료됨',
};

function Inner() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PassPlan[]>([]);
  const [passes, setPasses] = useState<StudentPass[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [orderId, setOrderId] = useState('');

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const loadPasses = useCallback(async () => {
    if (!user) return;
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!student) return;
    const { data } = await supabase
      .from('student_passes')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    setPasses((data as StudentPass[]) ?? []);
  }, [user]);

  useEffect(() => {
    apiFetch<{ plans: PassPlan[] }>('/api/student-passes/plans')
      .then((res) => setPlans(res.plans))
      .catch((e) => setError(e instanceof Error ? e.message : '이용권 목록을 불러오지 못했습니다.'));
    loadPasses();
  }, [loadPasses]);

  const startPay = () => {
    if (!selectedPlan || !user) return;
    setError(null);
    setMessage(null);
    const id = `safestep_pass_${user.id.slice(0, 8)}_${Date.now()}`;
    setOrderId(id);
    // 미리보기 모드: 실결제 없이 구매 완료로 처리
    if (PREVIEW_MODE) {
      confirmPayment({ paymentKey: 'preview-payment', orderId: id, amount: selectedPlan.amount });
      return;
    }
    setPayOpen(true);
  };

  const confirmPayment = async (r: { paymentKey: string; orderId: string; amount: number }) => {
    if (!selectedPlan) return;
    setPayOpen(false);
    setIsConfirming(true);
    try {
      const res = await apiFetch<{ pass: StudentPass }>('/api/student-passes/confirm', {
        method: 'POST',
        body: JSON.stringify({ ...r, planId: selectedPlan.id }),
      });
      setMessage(`${res.pass.product_name} 결제가 완료되었습니다.`);
      setSelectedPlanId(null);
      await loadPasses();
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 승인 실패');
    } finally {
      setIsConfirming(false);
    }
  };

  const renderPlan = (plan: PassPlan) => (
    <Pressable
      key={plan.id}
      onPress={() => setSelectedPlanId(plan.id)}
      style={{
        borderWidth: 1,
        borderColor: selectedPlanId === plan.id ? colors.indigo : colors.border,
        backgroundColor: selectedPlanId === plan.id ? colors.indigoSoft : colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontWeight: '500', color: colors.text }}>{plan.name}</Text>
      <Text style={{ fontWeight: '700', color: colors.text }}>{plan.amount.toLocaleString()}원</Text>
    </Pressable>
  );

  const timePlans = plans.filter((p) => p.passType === 'TIME');
  const periodPlans = plans.filter((p) => p.passType === 'PERIOD');

  return (
    <Screen>
      <Title>이용권</Title>
      <Muted style={{ marginBottom: 16 }}>시간권/기간권 구매 및 잔여 현황</Muted>

      {isConfirming && <Banner kind="info">결제 승인 처리 중...</Banner>}
      <Banner kind="success">{message ?? undefined}</Banner>
      <Banner kind="error">{error ?? undefined}</Banner>

      {passes.length > 0 && (
        <>
          <SectionTitle>내 이용권</SectionTitle>
          <Card style={{ padding: 0 }}>
            {passes.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.graySoft,
                }}
              >
                <View>
                  <Text style={{ fontWeight: '500', color: colors.text }}>{p.product_name}</Text>
                  <Muted>{formatPassDetail(p)}</Muted>
                </View>
                <Badge
                  text={STATUS_LABEL[p.status]}
                  bg={p.status === 'ACTIVE' ? colors.indigoSoft : colors.graySoft}
                  fg={p.status === 'ACTIVE' ? colors.indigo : colors.gray}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {timePlans.length > 0 && (
        <>
          <SectionTitle>시간권</SectionTitle>
          {timePlans.map(renderPlan)}
        </>
      )}
      {periodPlans.length > 0 && (
        <>
          <SectionTitle>기간권</SectionTitle>
          {periodPlans.map(renderPlan)}
        </>
      )}

      {selectedPlan &&
        (tossConfigured || PREVIEW_MODE ? (
          <Button
            title={`${selectedPlan.amount.toLocaleString()}원 결제하기`}
            onPress={startPay}
            style={{ marginTop: 8 }}
          />
        ) : (
          <Banner kind="error">EXPO_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다.</Banner>
        ))}

      {selectedPlan && user && !PREVIEW_MODE && (
        <TossPaymentModal
          visible={payOpen}
          customerKey={user.id}
          orderId={orderId}
          orderName={selectedPlan.name}
          amount={selectedPlan.amount}
          onSuccess={confirmPayment}
          onFail={(m) => {
            setPayOpen(false);
            setError(m);
          }}
          onClose={() => setPayOpen(false)}
        />
      )}
    </Screen>
  );
}

export default function StudentPassesScreen() {
  return (
    <RequireRole roles={['STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}
