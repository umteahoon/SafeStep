import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/** 비밀번호 찾기: 가입한 이메일로 재설정 링크 발송 → /reset-password 에서 새 비밀번호 설정 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    // 가입 여부를 알려주지 않기 위해, 존재하지 않는 이메일이어도 같은 안내를 보여줌
    if (err && !/not found|user/i.test(err.message)) {
      setError(/rate|seconds/i.test(err.message) ? '잠시 후 다시 시도해 주세요.' : '메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 text-sm">
          <Link to="/login" className="text-gray-400 hover:text-gray-600">← 로그인으로</Link>
        </div>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">비밀번호 찾기</h1>
        {sent ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              <b>{email}</b> 로 가입되어 있다면 비밀번호 재설정 링크를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.
            </p>
            <Link to="/login" className="mt-6 block w-full rounded-lg bg-blue-600 py-2.5 text-center font-medium text-white hover:bg-blue-700">
              로그인으로 돌아가기
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-gray-500">가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
            <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
            {error && <p className="mb-4 text-sm text-red-500" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? '보내는 중...' : '재설정 링크 보내기'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
