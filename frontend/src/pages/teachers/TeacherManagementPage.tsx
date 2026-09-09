import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface PendingTeacher {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}
interface ApprovedTeacher {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export default function TeacherManagementPage() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [approved, setApproved] = useState<ApprovedTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: PendingTeacher[] }>(
        '/api/teachers/pending'
      );
      setPending(res.data ?? []);

      if (profile?.academy_id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, phone')
          .eq('academy_id', profile.academy_id)
          .eq('role', 'TEACHER')
          .eq('approval_status', 'APPROVED');
        setApproved((data as ApprovedTeacher[]) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.academy_id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (teacherId: string, action: 'approve' | 'reject') => {
    setBusyId(teacherId);
    try {
      await apiFetch(`/api/teachers/${teacherId}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="강사 관리" subtitle="승인 대기 / 소속 강사" backTo="/dashboard" />

      <div className="mx-auto max-w-3xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            승인 대기 ({pending.length})
          </h2>
          {isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">대기 중인 강사가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pending.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-400">
                      {t.email}
                      {t.phone ? ` · ${t.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(t.id, 'approve')}
                      disabled={busyId === t.id}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => act(t.id, 'reject')}
                      disabled={busyId === t.id}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
                    >
                      반려
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            소속 강사 ({approved.length})
          </h2>
          {approved.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">승인된 강사가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {approved.map((t) => (
                <li key={t.id} className="p-4">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-400">
                    {t.email}
                    {t.phone ? ` · ${t.phone}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
