import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/** 메일의 재설정 링크로 들어오면 Supabase 가 임시 세션을 만들어 줌 → 새 비밀번호 저장 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && !settled)) {
        settled = true;
        setReady('ok');
      }
    });
    // 링크의 토큰이 이미 처리됐을 수도 있으니 현재 세션도 확인, 몇 초 안에 세션이 없으면 만료된 링크
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setReady('ok');
      }
    });
    const t = setTimeout(() => {
      if (!settled) setReady('invalid');
    }, 4000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.');
    if (password !== confirm) return setError('두 비밀번호가 서로 다릅니다.');
    setIsSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (err) return setError(/same|different/i.test(err.message) ? '이전과 다른 비밀번호를 입력해 주세요.' : '비밀번호를 바꾸지 못했습니다. 링크를 다시 받아 주세요.');
    setDone(true);
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">새 비밀번호 설정</h1>
        {done ? (
          <>
            <p className="mt-3 text-sm text-gray-600">비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.</p>
            <button onClick={() => navigate('/login')} className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700">
              로그인하기
            </button>
          </>
        ) : ready === 'checking' ? (
          <p className="mt-3 text-sm text-gray-400">링크를 확인하는 중...</p>
        ) : ready === 'invalid' ? (
          <>
            <p className="mt-3 text-sm text-gray-600">링크가 만료되었거나 올바르지 않습니다. 비밀번호 찾기를 다시 진행해 주세요.</p>
            <Link to="/forgot-password" className="mt-6 block w-full rounded-lg bg-blue-600 py-2.5 text-center font-medium text-white hover:bg-blue-700">
              비밀번호 찾기
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <label htmlFor="new-pw" className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호 (8자 이상)</label>
            <input id="new-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500" />
            <label htmlFor="new-pw2" className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
            <input id="new-pw2" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500" />
            {error && <p className="mb-4 text-sm text-red-500" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? '저장 중...' : '비밀번호 바꾸기'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
