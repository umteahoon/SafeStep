import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import type { UserRole } from '../../types';

// 슈퍼관리자는 셀프 회원가입 대상에서 제외 (플랫폼 운영자가 직접 DB에서 부여)
const SELF_SIGNUP_ROLES: { value: Exclude<UserRole, 'SUPER_ADMIN'>; label: string }[] = [
  { value: 'STUDENT', label: '학생' },
  { value: 'PARENT', label: '학부모' },
  { value: 'TEACHER', label: '학원 강사 (원장 승인 필요)' },
  { value: 'ACADEMY_ADMIN', label: '학원 원장' },
];

interface AcademyOption {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'SUPER_ADMIN'>>('STUDENT');
  const [academyId, setAcademyId] = useState('');
  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsAcademy = role === 'TEACHER';

  useEffect(() => {
    if (!needsAcademy) return;
    supabase
      .from('academies')
      .select('id, name')
      .order('name')
      .then(({ data }) => setAcademies((data as AcademyOption[]) ?? []));
  }, [needsAcademy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (needsAcademy && !academyId) {
      setError('소속 학원을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 백엔드가 이메일 인증 없이 계정+프로필을 즉시 생성
      await apiFetch('/api/auth/register', {
        auth: false,
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          role,
          academyId: needsAcademy ? academyId : null,
        }),
      });
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
      return;
    }

    // 바로 로그인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError('계정은 생성됐지만 자동 로그인에 실패했습니다. 로그인 페이지에서 시도해주세요.');
      navigate('/login');
      return;
    }

    if (role === 'TEACHER') {
      navigate('/teacher/pending');
    } else if (role === 'ACADEMY_ADMIN') {
      navigate('/owner/claim');
    } else {
      navigate('/map');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600"
          >
            ← 뒤로
          </button>
          <Link to="/" className="text-gray-400 hover:text-gray-600">
            홈으로
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold text-gray-900">SafeStep 회원가입</h1>

        <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">가입 유형</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        >
          {SELF_SIGNUP_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {needsAcademy && (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              소속 학원 (원장 승인 필요)
            </label>
            <select
              value={academyId}
              onChange={(e) => setAcademyId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="">학원 선택</option>
              {academies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </>
        )}

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
          {isSubmitting ? '가입 처리 중...' : '회원가입'}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-medium text-blue-600">
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
