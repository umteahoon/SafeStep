import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { TossPaymentModal, tossConfigured } from '../../components/TossPayment';
import { Banner, Button, Card, Muted, Screen, SectionTitle, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { Academy, Subscription } from '../../types';

const AMOUNT = 10000;
const ORDER_NAME = 'SafeStep 30일 이용권';

function Inner() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [academy, setAcademy] = useState<Academy | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [orderId, setOrderId] = useState('');

  const loadAcademy = useCallback(async () => {
    if (!academyId) return;
    const [{ data: a }, { data: subs }] = await Promise.all([
      supabase.from('academies').select('*').eq('id', academyId).single(),
      supabase.from('subscriptions').select('*').eq('academy_id', academyId).order('created_at', { ascending: false }),
    ]);
    setAcademy((a as Academy) ?? null);
    setHistory((subs as Subscription[]) ?? []);
  }, [academyId]);

  useEffect(() => {
    loadAcademy();
  }, [loadAcademy]);

  const startPay = () => {
    if (!academyId) return;
    setError(null);
    setMessage(null);
    const id = `safestep_${academyId.slice(0, 8)}_${Date.now()}`;
    setOrderId(id);
    // 미리보기 모드: 실결제 없이 구매 완료로 처리
    if (PREVIEW_MODE) {
      confirmPayment({ paymentKey: 'preview-payment', orderId: id, amount: AMOUNT });
      return;
    }
    setPayOpen(true);
  };

  const confirmPayment = async (r: { paymentKey: string; orderId: string; amount: number }) => {
    setPayOpen(false);
    setIsConfirming(true);
    try {
      const res = await apiFetch<{ expiresAt: string }>('/api/payments/confirm', {
        method: 'POST',
        body: JSON.stringify(r),
      });
      setMessage(`결제가 완료되었습니다. 이용 기간: ${new Date(res.expiresAt).toLocaleDateString('ko-KR')}까지`);
      await loadAcademy();
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 승인 실패');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Screen>
      <Title>이용권 결제</Title>
      <Muted style={{ marginBottom: 16 }}>SafeStep 30일 이용권</Muted>

      {isConfirming && <Banner kind="info">결제 승인 처리 중...</Banner>}
      <Banner kind="success">{message ?? undefined}</Banner>
      <Banner kind="error">{error ?? undefined}</Banner>

      {academy && (
        <Card>
          <Muted>현재 상태</Muted>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{academy.subscription_status}</Text>
          <Muted style={{ fontSize: 14 }}>
            만료일: {academy.subscription_expires_at ? new Date(academy.subscription_expires_at).toLocaleDateString('ko-KR') : '—'}
          </Muted>
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontWeight: '500', color: colors.text }}>{ORDER_NAME}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{AMOUNT.toLocaleString()}원</Text>
        </View>
        {tossConfigured || PREVIEW_MODE ? (
          <Button title="결제하기" onPress={startPay} />
        ) : (
          <Banner kind="error">EXPO_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다.</Banner>
        )}
      </Card>

      {history.length > 0 && (
        <>
          <SectionTitle>결제 내역</SectionTitle>
          <Card style={{ padding: 0 }}>
            {history.map((h, i) => (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.graySoft,
                }}
              >
                <Muted style={{ fontSize: 13 }}>
                  {h.paid_at?.slice(0, 10)} · {h.status}
                </Muted>
                <Text style={{ fontWeight: '500', color: colors.text }}>{h.amount.toLocaleString()}원</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {academyId && !PREVIEW_MODE && (
        <TossPaymentModal
          visible={payOpen}
          customerKey={academyId}
          orderId={orderId}
          orderName={ORDER_NAME}
          amount={AMOUNT}
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

export default function BillingScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN']}>
      <Inner />
    </RequireRole>
  );
}
