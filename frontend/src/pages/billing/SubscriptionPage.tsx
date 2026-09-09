import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Academy, Subscription } from '../../types';

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;
const WIDGET_SRC = 'https://js.tosspayments.com/v1/payment-widget';
const AMOUNT = 10000;
const ORDER_NAME = 'SafeStep 30일 이용권';

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

export default function SubscriptionPage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  const [academy, setAcademy] = useState<Academy | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const widgetRef = useRef<any>(null);

  const loadAcademy = async () => {
    if (!academyId) return;
    const [{ data: a }, { data: subs }] = await Promise.all([
      supabase.from('academies').select('*').eq('id', academyId).single(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false }),
    ]);
    setAcademy((a as Academy) ?? null);
    setHistory((subs as Subscription[]) ?? []);
  };

  useEffect(() => {
    loadAcademy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  // 결제 성공 리다이렉트 처리
  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    if (!paymentKey || !orderId || !amount) return;

    setIsConfirming(true);
    apiFetch<{ expiresAt: string }>('/api/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then((res) => {
        setMessage(
          `결제가 완료되었습니다. 이용 기간: ${new Date(
            res.expiresAt
          ).toLocaleDateString()}까지`
        );
        return loadAcademy();
      })
      .catch((e) => setError(e instanceof Error ? e.message : '결제 승인 실패'))
      .finally(() => {
        setIsConfirming(false);
        setSearchParams({}, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 결제 위젯 초기화
  useEffect(() => {
    if (!academyId || !CLIENT_KEY) return;
    let cancelled = false;
    loadWidgetScript()
      .then(async () => {
        if (cancelled || !window.PaymentWidget) return;
        const widget = window.PaymentWidget(CLIENT_KEY, academyId);
        widget.renderPaymentMethods('#payment-method', { value: AMOUNT });
        widget.renderAgreement('#agreement');
        widgetRef.current = widget;
        setIsWidgetReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '결제 모듈 로드 실패'));
    return () => {
      cancelled = true;
    };
  }, [academyId]);

  const pay = async () => {
    if (!widgetRef.current || !academyId) return;
    setError(null);
    const orderId = `safestep_${academyId.slice(0, 8)}_${Date.now()}`;
    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName: ORDER_NAME,
        successUrl: `${window.location.origin}/billing`,
        failUrl: `${window.location.origin}/billing`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 요청 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="이용권 결제" subtitle="SafeStep 30일 이용권" backTo="/dashboard" />

      <div className="mx-auto max-w-lg space-y-6 p-6">
        {isConfirming && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-600">
            결제 승인 처리 중...
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">{message}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {academy && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-400">현재 상태</p>
            <p className="text-lg font-bold text-gray-900">
              {academy.subscription_status}
            </p>
            <p className="text-sm text-gray-500">
              만료일:{' '}
              {academy.subscription_expires_at
                ? new Date(academy.subscription_expires_at).toLocaleDateString()
                : '—'}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-gray-900">{ORDER_NAME}</span>
            <span className="text-lg font-bold text-gray-900">
              {AMOUNT.toLocaleString()}원
            </span>
          </div>

          {!CLIENT_KEY ? (
            <p className="text-sm text-red-500">
              VITE_TOSS_CLIENT_KEY가 설정되지 않았습니다.
            </p>
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

        {history.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
              결제 내역
            </h2>
            <ul className="divide-y divide-gray-100 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between px-4 py-3">
                  <span className="text-gray-500">
                    {h.paid_at?.slice(0, 10)} · {h.status}
                  </span>
                  <span className="font-medium text-gray-900">
                    {h.amount.toLocaleString()}원
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
