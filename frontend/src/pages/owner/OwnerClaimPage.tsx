import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { refreshProfile, signOut, useAuth } from '../../hooks/useAuth';
import type { Academy } from '../../types';

interface AssignedInvite {
  code: string;
  academies: { name: string } | { name: string }[] | null;
}

export default function OwnerClaimPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-900">학원 등록</h1>
        <p className="mb-4 mt-1 text-sm text-gray-400">
          SafeStep 플랫폼팀이 발급한 <strong>8자리 등록 코드</strong>를 입력하면
          해당 지점의 원장 계정으로 연결됩니다.
        </p>

        {!isChecking && assigned && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-700">
              🔔 {assigned.academyName ? `${assigned.academyName} 지점의 ` : ''}
              등록 코드가 발급되었습니다
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-widest text-blue-900">
              {assigned.code}
            </p>
            <button
              type="button"
              onClick={() => claim(assigned.code)}
              disabled={isSubmitting}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? '연결 중...' : '이 코드로 바로 연결하기'}
            </button>
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-gray-700">
          등록 코드 직접 입력
        </label>
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

        {!isChecking && !assigned && (
          <p className="mt-4 text-center text-xs text-gray-400">
            코드를 아직 못 받으셨나요? 플랫폼 운영팀이 승인하면 이 페이지에 코드가
            자동으로 표시됩니다.
          </p>
        )}

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="mt-3 w-full text-center text-sm text-gray-400"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
