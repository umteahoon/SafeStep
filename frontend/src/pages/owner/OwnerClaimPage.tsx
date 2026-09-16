import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { refreshProfile, signOut } from '../../hooks/useAuth';
import type { Academy } from '../../types';

export default function OwnerClaimPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ academy: Academy }>('/api/owner/claim', {
        method: 'POST',
        body: JSON.stringify({ code }),
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-900">학원 등록</h1>
        <p className="mb-6 mt-1 text-sm text-gray-400">
          SafeStep 플랫폼팀이 발급한 <strong>8자리 등록 코드</strong>를 입력하면
          해당 지점의 원장 계정으로 연결됩니다.
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          등록 코드
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

        <p className="mt-4 text-center text-xs text-gray-400">
          코드를 아직 못 받으셨나요? 플랫폼 운영팀에 문의해 지점을 먼저 등록해주세요.
        </p>

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
