import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
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
    const { error: insErr } = await supabase.from('academies').insert({
      name: name.trim(),
      address: address.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      total_seats: totalSeats,
      subscription_status: 'TRIAL',
    });
    if (insErr) return setError(insErr.message);
    setName('');
    setAddress('');
    await load();
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
              <h2 className="mb-3 text-sm font-semibold text-gray-700">학원 추가</h2>
              {error && (
                <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">
                  {error}
                </p>
              )}
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
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                좌석 도면은 원장이 온보딩하거나 seed_floorplan.sql 로 생성됩니다.
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
