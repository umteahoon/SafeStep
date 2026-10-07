import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { enqueueKioskAction, flushKioskQueue, queuedActionCount } from '../../lib/offlineQueue';
import { Button, Icon, Loading } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { Academy, Seat } from '../../types';

interface VerifyResult {
  student: { id: string; name: string; academy_id: string };
  currentSeat: Seat | null;
  hasValidPass: boolean;
  verifyToken: string;
}

type Mode = 'PIN' | 'QR';

const IDLE_TIMEOUT_MS = 60_000;
// 오프라인 중에도 안전하게 큐잉 가능한 액션 (이미 배정된 좌석만 바꾸는 동작)
const QUEUEABLE_ACTIONS = { 'check-out': '퇴실', away: '외출', return: '복귀' } as const;

export default function KioskScreen() {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Kiosk'>>();
  const { user } = useAuth();
  const params = route.params;
  // 탭이 아니라 스택으로 열린 경우(좌석 도면 등)에만 돌아갈 곳이 있음
  const canGoBack = navigation.canGoBack();

  // 랜딩의 "키오스크 데모"처럼 핀코드 없이 QR 스캔만 제공
  const isDemo = !!params?.demo;
  // 학생이 본인 스터디카페 화면에서 "출석 체크인"으로 들어온 경우: 로그인된 본인 QR 토큰으로 자동 인증
  const isSelf = !!params?.self;

  const [academyId, setAcademyId] = useState<string | null>(params?.academyId ?? null);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [isLoadingAcademies, setIsLoadingAcademies] = useState(true);
  const [mode, setMode] = useState<Mode>(isDemo ? 'QR' : 'PIN');
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState<VerifyResult | null>(null);
  const [emptySeats, setEmptySeats] = useState<Seat[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selfLinkError, setSelfLinkError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const busyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const bumpActivity = () => {
    lastActivityRef.current = Date.now();
  };

  const showMessage = useCallback((type: 'error' | 'success', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const resetToIdle = useCallback(() => {
    setPin('');
    setVerified(null);
    setEmptySeats([]);
    setIsMoving(false);
    busyRef.current = false;
  }, []);

  // 공용 단말에서 하드웨어 뒤로가기로 앱이 종료/이탈되지 않도록 차단 (셀프 체크인 제외)
  useFocusEffect(
    useCallback(() => {
      // 탭으로 쓰는 공용 단말에서만 차단. 다른 화면에서 열린 경우엔 자연스럽게 뒤로 가기
      if (canGoBack) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [canGoBack])
  );

  // 60초간 조작이 없으면 자동으로 핀코드 입력 화면으로 리셋 (키오스크 공용 화면 보호)
  useEffect(() => {
    bumpActivity();
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        resetToIdle();
        bumpActivity();
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [resetToIdle, pin, verified, isMoving]);

  // 오프라인/온라인 감지 + 재연결 시 큐 재전송
  useEffect(() => {
    queuedActionCount().then(setPendingCount);
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!state.isConnected;
      setIsOffline(!online);
      if (online) {
        const { sent, remaining } = await flushKioskQueue();
        setPendingCount(remaining);
        if (sent > 0) showMessage('success', `오프라인 중 처리 ${sent}건을 재전송했습니다.`);
      }
    });
    return unsubscribe;
  }, [showMessage]);

  // 학원 미지정 시 선택 목록 로드
  useEffect(() => {
    if (academyId) return;
    supabase
      .from('academies')
      .select('*')
      .then(({ data }) => {
        setAcademies((data as Academy[]) ?? []);
        setIsLoadingAcademies(false);
      });
  }, [academyId]);

  const loadEmptySeats = async (id: string) => {
    const { data } = await supabase
      .from('seats')
      .select('*')
      .eq('academy_id', id)
      .eq('status', 'EMPTY')
      .order('seat_number');
    setEmptySeats((data as Seat[]) ?? []);
  };

  const verifyByPin = async () => {
    if (!academyId || pin.length < 4) return;
    setIsBusy(true);
    try {
      const result = await apiFetch<VerifyResult>(`/api/kiosk/${academyId}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ code: pin }),
        auth: false,
      });
      setVerified(result);
      if (!result.currentSeat) await loadEmptySeats(academyId);
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : '조회 실패');
      setPin('');
    } finally {
      setIsBusy(false);
    }
  };

  const verifyByQr = async (qrToken: string) => {
    // 카메라가 같은 QR을 프레임마다 연속 인식하므로 ref로 중복 호출 차단
    if (!academyId || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const result = await apiFetch<VerifyResult>(`/api/kiosk/${academyId}/verify-qr`, {
        method: 'POST',
        body: JSON.stringify({ qrToken }),
        auth: false,
      });
      setVerified(result);
      if (!result.currentSeat) await loadEmptySeats(academyId);
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'QR 인식 실패');
      // 실패 후 잠깐 쉬었다가 다시 스캔 허용
      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    } finally {
      setIsBusy(false);
    }
  };

  // 셀프 체크인: 본인 QR 토큰으로 카메라 스캔/핀코드 없이 자동 인증
  useEffect(() => {
    if (!isSelf || !academyId || !user || verified || isBusy) return;
    let cancelled = false;
    (async () => {
      const { data: own } = await supabase
        .from('students')
        .select('qr_token, academy_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!own) {
        setSelfLinkError('아직 학원 명부와 연동되지 않았습니다.');
        return;
      }
      if (own.academy_id !== academyId) {
        setSelfLinkError('이 학원에 연동된 계정이 아닙니다.');
        return;
      }
      await verifyByQr(own.qr_token);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf, academyId, user, verified]);

  // 입실/자리이동: 동시성 민감 액션 — 오프라인이면 아예 막음 (큐잉 대상 아님)
  const checkIn = async (seatNumber: number) => {
    if (!academyId || !verified) return;
    if (isOffline) {
      showMessage('error', '오프라인 상태에서는 입실 처리를 할 수 없습니다.');
      return;
    }
    setIsBusy(true);
    try {
      await apiFetch(`/api/kiosk/${academyId}/check-in`, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ verifyToken: verified.verifyToken, seatNumber, method: mode }),
      });
      showMessage('success', `${seatNumber}번 좌석에 입실했습니다.`);
      resetToIdle();
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : '입실 처리 실패');
    } finally {
      setIsBusy(false);
    }
  };

  const moveSeat = async (seatNumber: number) => {
    if (!academyId || !verified) return;
    if (isOffline) {
      showMessage('error', '오프라인 상태에서는 자리 이동을 할 수 없습니다.');
      return;
    }
    setIsBusy(true);
    try {
      await apiFetch(`/api/kiosk/${academyId}/move`, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ verifyToken: verified.verifyToken, seatNumber }),
      });
      showMessage('success', `${seatNumber}번 좌석으로 이동했습니다.`);
      resetToIdle();
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : '자리 이동 실패');
    } finally {
      setIsBusy(false);
    }
  };

  // 외출/퇴실/복귀: 오프라인이면 큐에 쌓아뒀다가 재연결 시 자동 재전송
  const doAction = async (action: keyof typeof QUEUEABLE_ACTIONS) => {
    if (!academyId || !verified) return;
    const path = `/api/kiosk/${academyId}/${action}`;
    const body = { verifyToken: verified.verifyToken };
    const label = QUEUEABLE_ACTIONS[action];

    if (isOffline) {
      await enqueueKioskAction(path, body, label);
      setPendingCount(await queuedActionCount());
      showMessage('success', `오프라인 상태 — 재연결되면 자동으로 ${label} 처리됩니다.`);
      resetToIdle();
      return;
    }

    setIsBusy(true);
    try {
      await apiFetch(path, { method: 'POST', auth: false, body: JSON.stringify(body) });
      showMessage('success', `${label} 처리되었습니다.`);
      resetToIdle();
    } catch (e) {
      // 요청 중 갑자기 끊긴 경우도 큐에 넣어 유실 방지
      await enqueueKioskAction(path, body, label);
      setPendingCount(await queuedActionCount());
      showMessage('error', e instanceof Error ? e.message : `${label} 처리 실패 — 재시도 대기열에 저장했습니다.`);
      resetToIdle();
    } finally {
      setIsBusy(false);
    }
  };

  // ── 학원 미지정: 선택 화면 ─────────────────────────
  if (!academyId) {
    return (
      <SafeAreaView style={styles.dark} edges={['top', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <Text style={styles.h1}>키오스크 지점 선택</Text>
            {isLoadingAcademies ? (
              <Loading />
            ) : academies.length === 0 ? (
              <Text style={styles.muted}>
                등록된 지점이 없습니다. Supabase 프로젝트 연결(mobile/.env)과 academies 데이터를
                확인해주세요.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {academies.map((a) => (
                  <Pressable key={a.id} onPress={() => setAcademyId(a.id)} style={styles.academyBtn}>
                    <Text style={{ fontSize: 15, color: colors.text }}>{a.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const seatGrid = (onPick: (n: number) => void) => (
    <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
      <View style={styles.seatGrid}>
        {emptySeats.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPick(s.seat_number)}
            disabled={isBusy}
            style={[styles.seatBtn, isBusy && { opacity: 0.4 }]}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{s.seat_number}</Text>
          </Pressable>
        ))}
        {emptySeats.length === 0 && <Text style={[styles.muted, { padding: 16 }]}>빈 좌석이 없습니다.</Text>}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.dark} edges={['top', 'left', 'right']}>
      {canGoBack && (
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Icon name="chevron-back" size={20} color={colors.white} />
          <Text style={styles.backBtnText}>뒤로</Text>
        </Pressable>
      )}
      <ScrollView
        contentContainerStyle={styles.centerWrap}
        keyboardShouldPersistTaps="handled"
        onTouchStart={bumpActivity}
      >
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.h1}>
              {isSelf ? '출석 체크인' : `SafeStep 키오스크${isDemo ? ' 데모' : ''}`}
            </Text>
            {(isOffline || pendingCount > 0) && (
              <View style={styles.offlineBadge}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.warnText }}>
                  {isOffline ? '오프라인' : `대기열 ${pendingCount}건`}
                </Text>
              </View>
            )}
          </View>

          {isSelf ? (
            <View style={{ height: 6 }} />
          ) : !params?.academyId ? (
            <Text style={styles.backLink} onPress={() => { resetToIdle(); setAcademyId(null); }}>
              지점 다시 선택
            </Text>
          ) : isDemo && !verified ? (
            <Text style={[styles.muted, { textAlign: 'center', marginBottom: 12 }]}>
              학생 앱의 출결 QR 코드를 카메라에 비춰주세요.
            </Text>
          ) : (
            <View style={{ height: 12 }} />
          )}

          {message && (
            <Text
              style={[
                styles.message,
                message.type === 'error'
                  ? { backgroundColor: colors.dangerSoft, color: colors.dangerText }
                  : { backgroundColor: colors.successSoft, color: colors.success },
              ]}
            >
              {message.text}
            </Text>
          )}

          {/* 셀프 체크인 대기 */}
          {!verified && isSelf && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              {selfLinkError ? (
                <>
                  <Text style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{selfLinkError}</Text>
                  <Text
                    style={{ color: colors.primary, fontWeight: '600' }}
                    onPress={() => navigation.navigate('StudentQr')}
                  >
                    학생 명부 연동하러 가기
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>본인 확인 중...</Text>
              )}
            </View>
          )}

          {/* 인증 전: 핀코드 / QR */}
          {!verified && !isSelf && (
            <>
              {!isDemo && (
                <View style={styles.tabs}>
                  {(['PIN', 'QR'] as Mode[]).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        busyRef.current = false;
                        setMode(m);
                      }}
                      style={[styles.tab, mode === m && styles.tabActive]}
                    >
                      <Text style={[styles.tabText, mode === m && { color: colors.text }]}>
                        {m === 'PIN' ? '핀코드' : 'QR 스캔'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {mode === 'PIN' && !isDemo ? (
                <>
                  <View style={styles.pinDisplay}>
                    <Text style={styles.pinText}>{pin.padEnd(6, '·').split('').join(' ')}</Text>
                  </View>
                  <View style={styles.pad}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setPin((p) => (p.length < 6 ? p + n : p))}
                        style={styles.padKey}
                      >
                        <Text style={styles.padKeyText}>{n}</Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => setPin((p) => p.slice(0, -1))} style={styles.padKey}>
                      <Text style={[styles.padKeyText, { fontSize: 14 }]}>지우기</Text>
                    </Pressable>
                    <Pressable onPress={() => setPin((p) => (p.length < 6 ? p + '0' : p))} style={styles.padKey}>
                      <Text style={styles.padKeyText}>0</Text>
                    </Pressable>
                    <Pressable
                      onPress={verifyByPin}
                      disabled={pin.length < 4 || isBusy}
                      style={[styles.padKey, { backgroundColor: colors.primary }, (pin.length < 4 || isBusy) && { opacity: 0.4 }]}
                    >
                      <Text style={[styles.padKeyText, { color: colors.white, fontSize: 14 }]}>확인</Text>
                    </Pressable>
                  </View>
                </>
              ) : !permission ? (
                <Loading />
              ) : !permission.granted ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={[styles.muted, { textAlign: 'center', marginBottom: 12 }]}>
                    QR 스캔을 위해 카메라 권한이 필요합니다.
                  </Text>
                  <Button title="카메라 권한 허용" onPress={requestPermission} />
                </View>
              ) : (
                <View style={styles.cameraBox}>
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={(r) => verifyByQr(r.data)}
                  />
                </View>
              )}
            </>
          )}

          {/* 인증 후 */}
          {verified && (
            <View>
              <Text style={styles.hello}>{verified.student.name}님 안녕하세요</Text>

              {!verified.currentSeat && !verified.hasValidPass && (
                <Text style={styles.noPass}>
                  이용 가능한 이용권이 없습니다. 학생 앱의 "이용권"에서 구매한 후 다시 이용해주세요.
                </Text>
              )}

              {!verified.currentSeat && verified.hasValidPass && (
                <>
                  <Text style={styles.sub}>좌석을 선택해주세요</Text>
                  {seatGrid(checkIn)}
                </>
              )}

              {verified.currentSeat?.status === 'OCCUPIED' && !isMoving && (
                <View style={styles.actionRow}>
                  <Button
                    title="자리 이동"
                    variant="dark"
                    disabled={isBusy || isOffline}
                    style={{ flex: 1 }}
                    onPress={() => {
                      setIsMoving(true);
                      if (academyId) loadEmptySeats(academyId);
                    }}
                  />
                  <Button title="외출" variant="warn" disabled={isBusy} style={{ flex: 1 }} onPress={() => doAction('away')} />
                  <Button title="퇴실" variant="danger" disabled={isBusy} style={{ flex: 1 }} onPress={() => doAction('check-out')} />
                </View>
              )}

              {verified.currentSeat?.status === 'OCCUPIED' && isMoving && (
                <>
                  <Text style={styles.sub}>이동할 좌석을 선택해주세요</Text>
                  {seatGrid(moveSeat)}
                  <Text style={styles.cancel} onPress={() => setIsMoving(false)}>
                    취소
                  </Text>
                </>
              )}

              {verified.currentSeat?.status === 'AWAY' && (
                <View style={styles.actionRow}>
                  <Button title="복귀" disabled={isBusy} style={{ flex: 1 }} onPress={() => doAction('return')} />
                  <Button title="퇴실" variant="danger" disabled={isBusy} style={{ flex: 1 }} onPress={() => doAction('check-out')} />
                </View>
              )}

              <Text style={styles.cancel} onPress={resetToIdle}>
                취소하고 처음으로
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#111827' },
  centerWrap: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 22 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  muted: { fontSize: 13, color: colors.textMuted },
  backLink: { fontSize: 13, color: colors.primary, fontWeight: '600', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  backBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  offlineBadge: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  message: { borderRadius: 8, padding: 10, textAlign: 'center', fontSize: 14, marginBottom: 12, overflow: 'hidden' },
  academyBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, marginTop: 8 },
  tabs: { flexDirection: 'row', backgroundColor: colors.graySoft, borderRadius: 8, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  pinDisplay: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 14 },
  pinText: { fontSize: 26, letterSpacing: 4, color: colors.text },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  padKey: {
    width: '31.5%',
    backgroundColor: colors.graySoft,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  padKeyText: { fontSize: 20, fontWeight: '500', color: colors.text },
  cameraBox: { height: 300, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  hello: { textAlign: 'center', fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 },
  noPass: {
    backgroundColor: colors.warnSoft,
    color: colors.warnText,
    borderRadius: 8,
    padding: 14,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    overflow: 'hidden',
  },
  sub: { fontSize: 14, color: colors.textSub, marginBottom: 8 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seatBtn: {
    width: '22%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  cancel: { textAlign: 'center', fontSize: 14, color: colors.textMuted, marginTop: 16 },
});
