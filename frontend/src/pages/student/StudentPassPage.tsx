import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { PassPlan, StudentPass } from '../../types';

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;
const WIDGET_SRC = 'https://js.tosspayments.com/v1/payment-widget';

declare global {
  interface Window {
    PaymentWidget?: (clientKey: string, customerKey: string) => any;
  }
}

function loadWidgetScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaymentWidget) return resolve();
    const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('결제 모듈 로드 실패')));
      return;
    }
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('결제 모듈 로드 실패'));
    document.head.appendChild(script);
  });
}

function formatPassDetail(pass: StudentPass): string {
  if (pass.pass_type === 'TIME') {
    const hours = Math.floor((pass.remaining_minutes ?? 0) / 60);
    const minutes = (pass.remaining_minutes ?? 0) % 60;
    return `잔여 ${hours}시간 ${minutes}분`;
  }
  return pass.expires_at ? `${new Date(pass.expires_at).toLocaleDateString()}까지` : '';
}

const STATUS_LABEL: Record<StudentPass['status'], string> = {
  ACTIVE: '이용 중',
  DEPLETED: '소진됨',
  EXPIRED: '만료됨',
};

export default function StudentPassPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<PassPlan[]>([]);
  const [passes, setPasses] = useState<StudentPass[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const widgetRef = useRef<any>(null);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const loadPasses = async () => {
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
  };

  useEffect(() => {
    apiFetch<{ plans: PassPlan[] }>('/api/student-passes/plans')
      .then((res) => setPlans(res.plans))
      .catch((e) => setError(e instanceof Error ? e.message : '이용권 목록을 불러오지 못했습니다.'));
    loadPasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 결제 성공 리다이렉트 처리
  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const planId = searchParams.get('planId');
    if (!paymentKey || !orderId || !amount || !planId) return;

    setIsConfirming(true);
    apiFetch<{ pass: StudentPass }>('/api/student-passes/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), planId }),
    })
      .then((res) => {
        setMessage(`${res.pass.product_name} 결제가 완료되었습니다.`);
        return loadPasses();
      })
      .catch((e) => setError(e instanceof Error ? e.message : '결제 승인 실패'))
      .finally(() => {
        setIsConfirming(false);
        setSearchParams({}, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이용권 선택 시 결제 위젯 초기화
  useEffect(() => {
    if (!selectedPlan || !user || !CLIENT_KEY) return;
    let cancelled = false;
    setIsWidgetReady(false);
    loadWidgetScript()
      .then(async () => {
        if (cancelled || !window.PaymentWidget) return;
        const widget = window.PaymentWidget(CLIENT_KEY, user.id);
        widget.renderPaymentMethods('#payment-method', { value: selectedPlan.amount });
        widget.renderAgreement('#agreement');
        widgetRef.current = widget;
        setIsWidgetReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '결제 모듈 로드 실패'));
    return () => {
      cancelled = true;
    };
  }, [selectedPlan, user]);

  const pay = async () => {
    if (!widgetRef.current || !selectedPlan || !user) return;
    setError(null);
    const orderId = `safestep_pass_${user.id.slice(0, 8)}_${Date.now()}`;
    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName: selectedPlan.name,
        successUrl: `${window.location.origin}/student/passes?planId=${selectedPlan.id}`,
        failUrl: `${window.location.origin}/student/passes`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 요청 실패');
    }
  };

  const timePlans = plans.filter((p) => p.passType === 'TIME');
  const periodPlans = plans.filter((p) => p.passType === 'PERIOD');

  const renderPlanCard = (plan: PassPlan) => (
    <button
      key={plan.id}
      onClick={() => setSelectedPlanId(plan.id)}
      className={`w-full rounded-xl border p-4 text-left ${
        selectedPlanId === plan.id
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{plan.name}</span>
        <span className="font-bold text-gray-900">{plan.amount.toLocaleString()}원</span>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="이용권" subtitle="시간권/기간권 구매 및 잔여 현황" backTo="/student/qr" />

      <div className="mx-auto max-w-lg space-y-6 p-6">
        {isConfirming && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-600">결제 승인 처리 중...</p>
        )}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        {passes.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
              내 이용권
            </h2>
            <ul className="divide-y divide-gray-100 text-sm">
              {passes.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{p.product_name}</p>
                    <p className="text-xs text-gray-400">{formatPassDetail(p)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'ACTIVE'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {timePlans.length > 0 && (
            <>
              <p className="px-1 text-sm font-semibold text-gray-500">시간권</p>
              {timePlans.map(renderPlanCard)}
            </>
          )}
          {periodPlans.length > 0 && (
            <>
              <p className="mt-4 px-1 text-sm font-semibold text-gray-500">기간권</p>
              {periodPlans.map(renderPlanCard)}
            </>
          )}
        </div>

        {selectedPlan && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            {!CLIENT_KEY ? (
              <p className="text-sm text-red-500">VITE_TOSS_CLIENT_KEY가 설정되지 않았습니다.</p>
            ) : (
              <>
                <div id="payment-method" />
                <div id="agreement" />
                <button
                  onClick={pay}
                  disabled={!isWidgetReady}
                  className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isWidgetReady ? '결제하기' : '결제 모듈 로딩 중...'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
