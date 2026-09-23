import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { refreshProfile, useAuth } from '../../hooks/useAuth';
import type { Academy } from '../../types';

interface AssignedInvite {
  code: string;
  academies: { name: string } | { name: string }[] | null;
}

export default function OwnerClaimPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 슈퍼관리자가 나에게 배정해준, 아직 안 쓴 등록 코드가 있는지 확인 (알림처럼 보여줌)
  const [assigned, setAssigned] = useState<{ code: string; academyName: string } | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('academy_owner_invites')
      .select('code, academies(name)')
      .eq('assigned_user_id', user.id)
      .is('used_at', null)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as AssignedInvite | null;
        if (row) {
          const academy = Array.isArray(row.academies) ? row.academies[0] : row.academies;
          setAssigned({ code: row.code, academyName: academy?.name ?? '' });
        }
        setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const claim = async (claimCode: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ academy: Academy }>('/api/owner/claim', {
        method: 'POST',
        body: JSON.stringify({ code: claimCode }),
      });
      await refreshProfile();
      navigate('/dashboard');
      // eslint-disable-next-line no-console
      console.log('연결된 학원:', res.academy?.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    claim(code);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="내 페이지"
        subtitle={profile ? `${profile.name}님, 학원 등록 대기 중입니다` : undefined}
      />

      <div className="mx-auto max-w-sm p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {!isChecking && assigned ? (
            <>
              <p className="text-sm font-medium text-blue-700">
                🔔 {assigned.academyName ? `${assigned.academyName} 지점의 ` : ''}
                등록 코드가 발급되었습니다
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-blue-900">
                {assigned.code}
              </p>
              <button
                type="button"
                onClick={() => claim(assigned.code)}
                disabled={isSubmitting}
                className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? '연결 중...' : '이 코드로 바로 연결하기'}
              </button>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900">학원 등록을 기다리는 중이에요</h2>
              <p className="mt-1 text-sm text-gray-400">
                SafeStep 플랫폼팀이 지점을 등록하면, 원장님 전용{' '}
                <strong>8자리 등록 코드</strong>가 이 페이지에 알림으로 자동 표시됩니다.
              </p>
            </>
          )}
        </div>

        <form onSubmit={submit} className="mt-4 rounded-2xl border border-gray-200 bg-white p-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            등록 코드 직접 입력
          </label>
          <p className="mb-3 text-xs text-gray-400">
            플랫폼 운영팀에게 코드를 따로 전달받았다면 여기에 입력하세요.
          </p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="예: 7F3KQ9ZT"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-blue-500"
          />

          {error && (
            <p className="mb-4 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '확인 중...' : '등록하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
