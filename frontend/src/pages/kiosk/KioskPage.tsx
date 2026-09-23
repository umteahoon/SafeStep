import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { QrScanner } from '../../components/kiosk/QrScanner';
import {
  enqueueKioskAction,
  flushKioskQueue,
  queuedActionCount,
} from '../../utils/offlineQueue';
import { useBlockBackButton } from '../../hooks/useBlockBackButton';
import { useAuth } from '../../hooks/useAuth';
import type { Academy, Seat } from '../../types';

interface VerifyResult {
  student: { id: string; name: string; academy_id: string };
  currentSeat: Seat | null;
  hasValidPass: boolean;
}

type Mode = 'PIN' | 'QR';

const IDLE_TIMEOUT_MS = 60_000;
// 오프라인 중에도 안전하게 큐잉 가능한 액션 (이미 배정된 좌석만 바꾸는 동작)
const QUEUEABLE_ACTIONS = { 'check-out': '퇴실', away: '외출', return: '복귀' } as const;

export default function KioskPage() {
  useBlockBackButton();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryAcademyId = searchParams.get('academy');
  // 랜딩의 "키오스크 데모"로 들어온 경우: 핀코드 없이 QR 스캔만 제공
  const isDemo = searchParams.get('demo') === '1';
  // 학생이 본인 스터디카페 화면에서 "출석 체크인" 버튼으로 들어온 경우:
  // 핀코드/카메라 스캔 없이 로그인된 본인 QR 토큰으로 자동 인증
  const isSelf = searchParams.get('self') === '1';

  const [academyId, setAcademyId] = useState<string | null>(queryAcademyId);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [isLoadingAcademies, setIsLoadingAcademies] = useState(true);
  const [mode, setMode] = useState<Mode>(isDemo ? 'QR' : 'PIN');
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState<VerifyResult | null>(null);
  const [emptySeats, setEmptySeats] = useState<Seat[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(queuedActionCount());
  const [selfLinkError, setSelfLinkError] = useState<string | null>(null);

  const lastActivityRef = useRef(Date.now());
  const bumpActivity = () => {
    lastActivityRef.current = Date.now();
  };

  const resetToIdle = useCallback(() => {
    setPin('');
    setVerified(null);
    setEmptySeats([]);
    setIsMoving(false);
  }, []);

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
    const handleOnline = async () => {
      setIsOffline(false);
      const { sent, remaining } = await flushKioskQueue();
      setPendingCount(remaining);
      if (sent > 0) {
        showMessage('success', `오프라인 중 처리 ${sent}건을 재전송했습니다.`);
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) handleOnline();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const showMessage = (type: 'error' | 'success', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

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
      const result = await apiFetch<VerifyResult>(
        `/api/kiosk/${academyId}/verify-pin`,
        { method: 'POST', body: JSON.stringify({ code: pin }), auth: false }
      );
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
    if (!academyId || isBusy) return;
    setIsBusy(true);
    try {
      const result = await apiFetch<VerifyResult>(
        `/api/kiosk/${academyId}/verify-qr`,
        { method: 'POST', body: JSON.stringify({ qrToken }), auth: false }
      );
      setVerified(result);
      if (!result.currentSeat) await loadEmptySeats(academyId);
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'QR 인식 실패');
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
        body: JSON.stringify({
          studentId: verified.student.id,
          seatNumber,
          method: mode,
        }),
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
        body: JSON.stringify({ studentId: verified.student.id, seatNumber }),
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
    const body = { studentId: verified.student.id };
    const label = QUEUEABLE_ACTIONS[action];

    if (isOffline) {
      enqueueKioskAction(path, body, label);
      setPendingCount(queuedActionCount());
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
      enqueueKioskAction(path, body, label);
      setPendingCount(queuedActionCount());
      showMessage('error', e instanceof Error ? e.message : `${label} 처리 실패 — 재시도 대기열에 저장했습니다.`);
      resetToIdle();
    } finally {
      setIsBusy(false);
    }
  };

  // 학원 미지정: 선택 화면
  if (!academyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6">
          <h1 className="mb-4 text-lg font-bold text-gray-900">키오스크 지점 선택</h1>
          {isLoadingAcademies ? (
            <p className="text-sm text-gray-400">불러오는 중...</p>
          ) : academies.length === 0 ? (
            <p className="text-sm text-gray-400">
              등록된 지점이 없습니다. Supabase 프로젝트 연결(frontend/.env)과
              academies 데이터를 확인해주세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {academies.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setAcademyId(a.id)}
                    className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-blue-400"
                  >
                    {a.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={bumpActivity}
      onKeyDown={bumpActivity}
      className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-6"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">
            {isSelf ? '출석 체크인' : `SafeStep 키오스크${isDemo ? ' 데모' : ''}`}
          </h1>
          {(isOffline || pendingCount > 0) && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              {isOffline ? '오프라인' : `대기열 ${pendingCount}건`}
            </span>
          )}
        </div>
        {isSelf ? (
          <button
            type="button"
            onClick={() => navigate(`/seats/${academyId}`)}
            className="mb-4 text-xs text-gray-400 hover:text-gray-600"
          >
            ← 좌석 도면으로 돌아가기
          </button>
        ) : isDemo && !verified ? (
          <p className="mb-4 text-center text-xs text-gray-400">
            학생 앱의 출결 QR 코드를 카메라에 비춰주세요.
          </p>
        ) : (
          <div className="mb-3" />
        )}

        {message && (
          <p
            className={`mb-4 rounded-lg p-2 text-center text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            {message.text}
          </p>
        )}

        {!verified && isSelf && (
          <div className="py-6 text-center">
            {selfLinkError ? (
              <>
                <p className="mb-3 text-sm text-red-500">{selfLinkError}</p>
                <Link to="/student/qr" className="text-sm font-medium text-blue-600">
                  학생 명부 연동하러 가기 →
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-400">본인 확인 중...</p>
            )}
          </div>
        )}

        {!verified && !isSelf && (
          <>
            {!isDemo && (
            <div className="mb-4 flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setMode('PIN')}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${
                  mode === 'PIN' ? 'bg-white shadow' : 'text-gray-400'
                }`}
              >
                핀코드
              </button>
              <button
                onClick={() => setMode('QR')}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${
                  mode === 'QR' ? 'bg-white shadow' : 'text-gray-400'
                }`}
              >
                QR 스캔
              </button>
            </div>
            )}

            {mode === 'PIN' && !isDemo ? (
              <>
                <div className="mb-4 rounded-lg border border-gray-200 p-3 text-center text-2xl tracking-[0.5em] text-gray-900">
                  {pin.padEnd(6, '·')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPin((p) => (p.length < 6 ? p + n : p))}
                      className="rounded-lg bg-gray-100 py-3 text-lg font-medium hover:bg-gray-200"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="rounded-lg bg-gray-100 py-3 text-sm font-medium hover:bg-gray-200"
                  >
                    지우기
                  </button>
                  <button
                    onClick={() => setPin((p) => (p.length < 6 ? p + '0' : p))}
                    className="rounded-lg bg-gray-100 py-3 text-lg font-medium hover:bg-gray-200"
                  >
                    0
                  </button>
                  <button
                    onClick={verifyByPin}
                    disabled={pin.length < 4 || isBusy}
                    className="rounded-lg bg-blue-600 py-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <QrScanner isActive={mode === 'QR'} onScan={verifyByQr} />
            )}
          </>
        )}

        {verified && (
          <div>
            <p className="mb-4 text-center text-lg font-semibold text-gray-900">
              {verified.student.name}님 안녕하세요
            </p>

            {!verified.currentSeat && !verified.hasValidPass && (
              <p className="rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-700">
                이용 가능한 이용권이 없습니다. 학생 앱의 "이용권"에서 구매한 후 다시 이용해주세요.
              </p>
            )}

            {!verified.currentSeat && verified.hasValidPass && (
              <>
                <p className="mb-2 text-sm text-gray-500">좌석을 선택해주세요</p>
                <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto">
                  {emptySeats.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => checkIn(s.seat_number)}
                      disabled={isBusy}
                      className="rounded-lg border border-gray-200 py-2 text-sm font-medium hover:border-blue-400 disabled:opacity-40"
                    >
                      {s.seat_number}
                    </button>
                  ))}
                  {emptySeats.length === 0 && (
                    <p className="col-span-4 py-4 text-center text-sm text-gray-400">
                      빈 좌석이 없습니다.
                    </p>
                  )}
                </div>
              </>
            )}

            {verified.currentSeat?.status === 'OCCUPIED' && !isMoving && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setIsMoving(true);
                    if (academyId) loadEmptySeats(academyId);
                  }}
                  disabled={isBusy || isOffline}
                  className="rounded-lg bg-gray-700 py-3 text-sm font-medium text-white disabled:opacity-40"
                >
                  자리 이동
                </button>
                <button
                  onClick={() => doAction('away')}
                  disabled={isBusy}
                  className="rounded-lg bg-amber-400 py-3 font-medium text-white disabled:opacity-40"
                >
                  외출
                </button>
                <button
                  onClick={() => doAction('check-out')}
                  disabled={isBusy}
                  className="rounded-lg bg-red-500 py-3 font-medium text-white disabled:opacity-40"
                >
                  퇴실
                </button>
              </div>
            )}

            {verified.currentSeat?.status === 'OCCUPIED' && isMoving && (
              <>
                <p className="mb-2 text-sm text-gray-500">이동할 좌석을 선택해주세요</p>
                <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto">
                  {emptySeats.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => moveSeat(s.seat_number)}
                      disabled={isBusy}
                      className="rounded-lg border border-gray-200 py-2 text-sm font-medium hover:border-blue-400 disabled:opacity-40"
                    >
                      {s.seat_number}
                    </button>
                  ))}
                  {emptySeats.length === 0 && (
                    <p className="col-span-4 py-4 text-center text-sm text-gray-400">
                      빈 좌석이 없습니다.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsMoving(false)}
                  className="mt-2 w-full text-center text-sm text-gray-400"
                >
                  취소
                </button>
              </>
            )}

            {verified.currentSeat?.status === 'AWAY' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => doAction('return')}
                  disabled={isBusy}
                  className="rounded-lg bg-blue-600 py-3 font-medium text-white disabled:opacity-40"
                >
                  복귀
                </button>
                <button
                  onClick={() => doAction('check-out')}
                  disabled={isBusy}
                  className="rounded-lg bg-red-500 py-3 font-medium text-white disabled:opacity-40"
                >
                  퇴실
                </button>
              </div>
            )}

            <button
              onClick={resetToIdle}
              className="mt-4 w-full text-center text-sm text-gray-400"
            >
              취소하고 처음으로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
