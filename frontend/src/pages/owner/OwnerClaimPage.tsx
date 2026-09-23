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

interface AssignedCode {
  code: string;
  academyName: string;
}

function NotificationBell({
  assigned,
  isChecking,
  isSubmitting,
  onClaim,
}: {
  assigned: AssignedCode | null;
  isChecking: boolean;
  isSubmitting: boolean;
  onClaim: (code: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const hasUnread = !!assigned && !hasSeen;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((v) => !v);
          if (assigned) setHasSeen(true);
        }}
        aria-label="알림"
        className="relative rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
      >
        🔔
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        )}
      </button>

      {isOpen && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <p className="mb-2 text-xs font-semibold text-gray-400">알림</p>
            {isChecking ? (
              <p className="py-4 text-center text-sm text-gray-400">확인 중...</p>
            ) : assigned ? (
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-700">
                  {assigned.academyName ? `${assigned.academyName} 지점의 ` : ''}
                  등록 코드가 발급되었습니다
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-widest text-blue-900">
                  {assigned.code}
                </p>
                <button
                  type="button"
                  onClick={() => onClaim(assigned.code)}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? '연결 중...' : '이 코드로 바로 연결하기'}
                </button>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">
                아직 새로운 알림이 없습니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function OwnerClaimPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 슈퍼관리자가 나에게 배정해준, 아직 안 쓴 등록 코드가 있는지 확인 (알림 벨로 노출)
  const [assigned, setAssigned] = useState<AssignedCode | null>(null);
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
        right={
          <NotificationBell
            assigned={assigned}
            isChecking={isChecking}
            isSubmitting={isSubmitting}
            onClaim={claim}
          />
        }
      />

      <div className="mx-auto max-w-sm p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {!isChecking && assigned ? (
            <>
              <h2 className="font-semibold text-gray-900">🔔 새 알림이 있어요</h2>
              <p className="mt-1 text-sm text-gray-400">
                학원 등록 코드가 발급됐습니다. 오른쪽 위 알림 버튼을 눌러 확인하고
                바로 연결하세요.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900">학원 등록을 기다리는 중이에요</h2>
              <p className="mt-1 text-sm text-gray-400">
                SafeStep 플랫폼팀이 지점을 등록하면, 원장님 전용{' '}
                <strong>8자리 등록 코드</strong>가 알림으로 도착합니다.
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
