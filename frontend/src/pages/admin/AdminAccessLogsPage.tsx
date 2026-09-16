import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';

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

export default function AdminAccessLogsPage() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: e } = await supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setAttempts((data as LoginAttempt[]) ?? []);
    setError(e?.message ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 최근 SUSPICIOUS_WINDOW_MIN분 내 같은 이메일로 SUSPICIOUS_THRESHOLD회 이상 실패 → 의심 신호
  const suspiciousEmails = useMemo(() => {
    const cutoff = Date.now() - SUSPICIOUS_WINDOW_MIN * 60_000;
    const failCount = new Map<string, number>();
    for (const a of attempts) {
      if (a.success) continue;
      if (new Date(a.created_at).getTime() < cutoff) continue;
      failCount.set(a.email, (failCount.get(a.email) ?? 0) + 1);
    }
    return new Set(
      [...failCount.entries()]
        .filter(([, count]) => count >= SUSPICIOUS_THRESHOLD)
        .map(([email]) => email)
    );
  }, [attempts]);

  const visible = onlyFailed ? attempts.filter((a) => !a.success) : attempts;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="접속 로그"
        subtitle="로그인 시도 내역 · 반복 실패 자동 감지"
        right={
          <button
            onClick={() => setOnlyFailed((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              onlyFailed
                ? 'border-red-300 bg-red-50 text-red-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {onlyFailed ? '실패만 보는 중' : '실패만 보기'}
          </button>
        }
      />

      <div className="mx-auto max-w-4xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {suspiciousEmails.size > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            ⚠️ 최근 {SUSPICIOUS_WINDOW_MIN}분 내 {SUSPICIOUS_THRESHOLD}회 이상 로그인
            실패한 계정: <span className="font-medium">{[...suspiciousEmails].join(', ')}</span>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="px-4 py-2">시간</th>
                <th className="px-4 py-2">이메일</th>
                <th className="px-4 py-2">결과</th>
                <th className="px-4 py-2">IP</th>
                <th className="px-4 py-2">기기/브라우저</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                visible.map((a) => (
                  <tr
                    key={a.id}
                    className={suspiciousEmails.has(a.email) ? 'bg-red-50/60' : ''}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-gray-400">
                      {new Date(a.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {a.email}
                      {suspiciousEmails.has(a.email) && (
                        <span className="ml-1" title="반복 로그인 실패">
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.success
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {a.success ? '성공' : '실패'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{a.ip_address ?? '—'}</td>
                    <td
                      className="max-w-[220px] truncate px-4 py-2 text-gray-400"
                      title={a.user_agent ?? ''}
                    >
                      {a.user_agent ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          최근 200건만 표시됩니다. 같은 이메일로 {SUSPICIOUS_WINDOW_MIN}분 내{' '}
          {SUSPICIOUS_THRESHOLD}회 이상 실패하면 자동으로 표시됩니다.
        </p>
      </div>
    </div>
  );
}
