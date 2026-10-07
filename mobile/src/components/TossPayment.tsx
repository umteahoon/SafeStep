import { useMemo, useRef } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const CLIENT_KEY = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY as string | undefined;

// 위젯이 결제 후 이동하려는 주소. 실제로 로드되지 않고 WebView 안에서 가로채서 앱이 직접 처리합니다.
const SUCCESS_URL = 'https://safestep.app/payment/success';
const FAIL_URL = 'https://safestep.app/payment/fail';

export const tossConfigured = !!CLIENT_KEY;

interface Props {
  visible: boolean;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  onSuccess: (r: { paymentKey: string; orderId: string; amount: number }) => void;
  onFail: (message: string) => void;
  onClose: () => void;
}

function buildHtml(p: Pick<Props, 'customerKey' | 'orderId' | 'orderName' | 'amount'>) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://js.tosspayments.com/v1/payment-widget"></script>
<style>body{margin:0;padding:12px;font-family:-apple-system,sans-serif}
#pay{width:100%;margin-top:12px;padding:14px;border:0;border-radius:8px;background:#2563EB;color:#fff;font-size:16px;font-weight:600}
#pay[disabled]{opacity:.5}</style></head><body>
<div id="payment-method"></div><div id="agreement"></div>
<button id="pay" disabled>결제하기</button>
<script>
  function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  try {
    var widget = PaymentWidget(${JSON.stringify(CLIENT_KEY)}, ${JSON.stringify(p.customerKey)});
    widget.renderPaymentMethods('#payment-method', { value: ${p.amount} });
    widget.renderAgreement('#agreement');
    var btn = document.getElementById('pay'); btn.disabled = false;
    btn.onclick = function(){
      widget.requestPayment({
        orderId: ${JSON.stringify(p.orderId)},
        orderName: ${JSON.stringify(p.orderName)},
        successUrl: ${JSON.stringify(SUCCESS_URL)},
        failUrl: ${JSON.stringify(FAIL_URL)}
      }).catch(function(e){ post({type:'error', message: (e && e.message) || '결제 요청 실패'}); });
    };
  } catch(e){ post({type:'error', message: '결제 모듈 로드 실패'}); }
</script></body></html>`;
}

/**
 * 토스페이먼츠 결제위젯을 WebView 모달로 띄웁니다.
 * 주의: 실기기에서 결제(특히 카드사 앱 전환/복귀) 동작은 아직 검증되지 않았습니다 (README 참고).
 */
export function TossPaymentModal({
  visible,
  customerKey,
  orderId,
  orderName,
  amount,
  onSuccess,
  onFail,
  onClose,
}: Props) {
  const handled = useRef(false);
  const html = useMemo(
    () => buildHtml({ customerKey, orderId, orderName, amount }),
    [customerKey, orderId, orderName, amount]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>{orderName}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>
        {visible && (
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://safestep.app' }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={(e) => {
              try {
                const m = JSON.parse(e.nativeEvent.data);
                if (m.type === 'error') onFail(m.message);
              } catch {
                /* 무시 */
              }
            }}
            onShouldStartLoadWithRequest={(req) => {
              const url = req.url;
              if (url.startsWith(SUCCESS_URL)) {
                if (!handled.current) {
                  handled.current = true;
                  const q = new URLSearchParams(url.split('?')[1] ?? '');
                  onSuccess({
                    paymentKey: q.get('paymentKey') ?? '',
                    orderId: q.get('orderId') ?? '',
                    amount: Number(q.get('amount') ?? 0),
                  });
                  setTimeout(() => {
                    handled.current = false;
                  }, 2000);
                }
                return false;
              }
              if (url.startsWith(FAIL_URL)) {
                const q = new URLSearchParams(url.split('?')[1] ?? '');
                onFail(q.get('message') ?? '결제가 취소되었거나 실패했습니다.');
                return false;
              }
              // 카드사/간편결제 앱 호출용 커스텀 스킴은 OS에 넘김
              if (!/^(https?:|about:|data:)/i.test(url)) {
                Linking.openURL(url).catch(() => onFail('결제 앱을 열 수 없습니다.'));
                return false;
              }
              return true;
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  close: { fontSize: 15, color: colors.primary, fontWeight: '600' },
});
