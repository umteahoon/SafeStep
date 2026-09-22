import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import type { Academy, Subscription } from '../../types';

export default function SuperAdminDashboardPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('37.5665');
  const [longitude, setLongitude] = useState('126.9780');
  const [totalSeats, setTotalSeats] = useState(20);
  const [isCreating, setIsCreating] = useState(false);

  // 방금 발급된 등록 코드(한 번만 보여줌)
  const [issued, setIssued] = useState<{ academyName: string; code: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data: a }, { data: s }, { count }] = await Promise.all([
      supabase.from('academies').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    setAcademies((a as Academy[]) ?? []);
    setSubs((s as Subscription[]) ?? []);
    setUserCount(count ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const res = await apiFetch<{ academy: Academy; inviteCode: string }>(
        '/api/admin/academies',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            address: address.trim(),
            latitude: Number(latitude),
            longitude: Number(longitude),
            totalSeats,
          }),
        }
      );
      setIssued({ academyName: res.academy.name, code: res.inviteCode });
      setName('');
      setAddress('');
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
      const res = await apiFetch<{ inviteCode: string }>(
        `/api/admin/academies/${academy.id}/invite`,
        { method: 'POST' }
      );
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
      monthRevenue: paid
        .filter((x) => x.paid_at?.startsWith(thisMonth))
        .reduce((sum, x) => sum + x.amount, 0),
    };
  }, [academies, subs]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="플랫폼 관리자" subtitle="가입 학원 · 매출 집계" />

      <div className="mx-auto max-w-4xl p-6">
        {issued && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div>
              <p className="text-sm text-blue-700">
                <strong>{issued.academyName}</strong> 원장 등록 코드가 발급됐습니다.
                이 코드는 지금만 확인 가능하니 원장에게 바로 전달하세요.
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-blue-900">
                {issued.code}
              </p>
            </div>
            <button
              onClick={() => setIssued(null)}
              className="text-sm text-blue-400 hover:text-blue-600"
            >
              닫기
            </button>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat label="가입 학원" value={`${stats.academyCount}곳`} />
              <Stat
                label="유료 / 체험"
                value={`${stats.activeCount} / ${stats.trialCount}`}
              />
              <Stat label="전체 가입자" value={userCount === null ? '—' : `${userCount}명`} />
              <Stat
                label="이번 달 매출"
                value={`${stats.monthRevenue.toLocaleString()}원`}
              />
              <Stat
                label="누적 매출"
                value={`${stats.totalRevenue.toLocaleString()}원`}
              />
            </div>

            <form
              onSubmit={createAcademy}
              className="mt-6 rounded-xl border border-gray-200 bg-white p-4"
            >
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                학원 추가 (좌석 자동 생성 + 원장 등록 코드 발급)
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-gray-400">이름</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-gray-400">주소</label>
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-xs text-gray-400">좌석</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-gray-400">위도</label>
                  <input
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-gray-400">경도</label>
                  <input
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? '생성 중...' : '추가'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                생성 즉시 원장 등록 코드가 발급됩니다. 원장은 회원가입 후{' '}
                <code>/owner/claim</code> 에서 이 코드를 입력해 자기 지점에 연결합니다.
              </p>
            </form>

            <div className="mt-6 rounded-xl border border-gray-200 bg-white">
              <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
                학원 목록
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-400">
                  <tr>
                    <th className="px-4 py-2">이름</th>
                    <th className="px-4 py-2">주소</th>
                    <th className="px-4 py-2">상태</th>
                    <th className="px-4 py-2">만료일</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {academies.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-2 text-gray-500">{a.address}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {a.subscription_status}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {a.subscription_expires_at?.slice(0, 10)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => reissueCode(a)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          등록코드 재발급
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
