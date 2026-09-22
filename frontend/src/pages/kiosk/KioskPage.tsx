import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { QrScanner } from '../../components/kiosk/QrScanner';
import type { Academy, Seat } from '../../types';

interface VerifyResult {
  student: { id: string; name: string; academy_id: string };
  currentSeat: Seat | null;
}

type Mode = 'PIN' | 'QR';

export default function KioskPage() {
  const [searchParams] = useSearchParams();
  const queryAcademyId = searchParams.get('academy');
  // 랜딩의 "키오스크 데모"로 들어온 경우: 핀코드 없이 QR 스캔만 제공
  const isDemo = searchParams.get('demo') === '1';

  const [academyId, setAcademyId] = useState<string | null>(queryAcademyId);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [mode, setMode] = useState<Mode>(isDemo ? 'QR' : 'PIN');
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState<VerifyResult | null>(null);
  const [emptySeats, setEmptySeats] = useState<Seat[]>([]);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // 학원 미지정 시 선택 목록 로드
  useEffect(() => {
    if (academyId) return;
    supabase
      .from('academies')
      .select('*')
      .then(({ data }) => setAcademies((data as Academy[]) ?? []));
  }, [academyId]);

  const resetToIdle = () => {
    setPin('');
    setVerified(null);
    setEmptySeats([]);
  };

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

  const checkIn = async (seatNumber: number) => {
    if (!academyId || !verified) return;
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

  const doAction = async (action: 'check-out' | 'away' | 'return') => {
    if (!academyId || !verified) return;
    setIsBusy(true);
    try {
      await apiFetch(`/api/kiosk/${academyId}/${action}`, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ studentId: verified.student.id }),
      });
      const labels = { 'check-out': '퇴실', away: '외출', return: '복귀' };
      showMessage('success', `${labels[action]} 처리되었습니다.`);
      resetToIdle();
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : '처리 실패');
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="mb-1 text-center text-lg font-bold text-gray-900">
          SafeStep 키오스크{isDemo && ' 데모'}
        </h1>
        {isDemo && !verified && (
          <p className="mb-4 text-center text-xs text-gray-400">
            학생 앱의 출결 QR 코드를 카메라에 비춰주세요.
          </p>
        )}
        {!isDemo && <div className="mb-3" />}

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

        {!verified && (
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

            {!verified.currentSeat && (
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

            {verified.currentSeat?.status === 'OCCUPIED' && (
              <div className="grid grid-cols-2 gap-2">
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
