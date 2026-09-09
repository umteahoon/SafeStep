import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.png';

// 로그인 없이 원장/강사 화면을 바로 체험할 수 있는 데모 전용 계정.
// 시드 데이터(SafeStep 강남점, "중3 수학 데모반")에 연결되어 있습니다.
// ⚠️ 프론트에 하드코딩된 공개 데모 계정입니다 — 실제 서비스 데이터가 섞인
// 프로덕션 DB에는 절대 이 방식을 그대로 쓰지 마세요.
const DEMO_ACCOUNTS: Record<
  'admin' | 'teacher',
  { email: string; password: string; redirect: string; label: string }
> = {
  admin: {
    email: 'demo-admin@safestep.local',
    password: 'safestepdemo',
    redirect: '/dashboard',
    label: '원장 데모 체험하기',
  },
  teacher: {
    email: 'demo-teacher@safestep.local',
    password: 'safestepdemo',
    redirect: '/attendance',
    label: '강사 데모 체험하기',
  },
};

const CONSUMER_FEATURES = [
  {
    title: '실시간 잔여석',
    desc: '네이버 지도에서 주변 스터디카페의 빈자리를 실시간으로 확인하고 이동하세요.',
  },
  {
    title: '좌석 도면 & 익명 신고',
    desc: '자리별 사용 현황을 한눈에. 소음·자리 독점은 익명으로 신고할 수 있습니다.',
  },
  {
    title: 'QR·핀코드 출입',
    desc: '키오스크에서 QR 또는 6자리 핀코드로 입실·외출·퇴실을 처리합니다.',
  },
];

const BUSINESS_FEATURES = [
  {
    title: '스마트 출결',
    desc: '반별 원클릭 출석 체크. 결석·지각은 보호자에게 즉시 알림이 발송됩니다.',
  },
  {
    title: '강사 승인 & 권한 분리',
    desc: '원장이 강사 가입을 승인하고, 역할별로 접근 가능한 화면이 엄격히 분리됩니다.',
  },
  {
    title: '대시보드 & 엑셀 추출',
    desc: '출석률·학습시간 통계를 보고 학생·출결 데이터를 엑셀로 내려받습니다.',
  },
  {
    title: '학부모 리포트',
    desc: '6자리 코드로 자녀를 연동하고 주간 리포트, 사전 결석 신청을 제공합니다.',
  },
];

export default function LandingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState<'admin' | 'teacher' | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const tryDemo = async (kind: 'admin' | 'teacher') => {
    setDemoError(null);
    setDemoLoading(kind);
    const { email, password, redirect } = DEMO_ACCOUNTS[kind];
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setDemoLoading(null);
    if (error) {
      setDemoError('데모 계정 접속에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    navigate(redirect);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src={logo} alt="SafeStep" className="h-8 w-auto" />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/map"
              className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
            >
              스터디카페 찾기
            </Link>
            {user && profile ? (
              <Link
                to={homeForRole(profile.role)}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                내 페이지
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
                >
                  로그인
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  시작하기
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* 히어로 */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-semibold text-blue-600">
            스터디카페 좌석 관제 + 학원 스마트 출결
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            자리도, 출결도
            <br />
            한 곳에서 관리하세요
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            이용자는 빈자리를 실시간으로 찾고, 사장님은 출결·강사·정산을
            자동화합니다. 웹과 앱에서 동일하게 동작하는 SafeStep.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/map"
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              지도에서 빈자리 찾기
            </Link>
            <Link
              to="/register"
              className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              학원·카페 도입 문의
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <img src={logo} alt="SafeStep" className="w-full max-w-lg" />

          {/* 데모 체험하기 한 줄 */}
          <div className="mt-6 grid w-full max-w-lg grid-cols-4 gap-2">
            <Link
              to="/map"
              className="rounded-lg border border-gray-300 px-2 py-2.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              이용자 데모
            </Link>
            <Link
              to="/kiosk"
              className="rounded-lg border border-gray-300 px-2 py-2.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              키오스크 데모
            </Link>
            <button
              onClick={() => tryDemo('admin')}
              disabled={demoLoading !== null}
              className="rounded-lg border border-gray-300 px-2 py-2.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {demoLoading === 'admin' ? '접속 중...' : '원장 데모'}
            </button>
            <button
              onClick={() => tryDemo('teacher')}
              disabled={demoLoading !== null}
              className="rounded-lg border border-gray-300 px-2 py-2.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {demoLoading === 'teacher' ? '접속 중...' : '강사 데모'}
            </button>
          </div>
          {demoError && <p className="mt-2 text-sm text-red-500">{demoError}</p>}
          <p className="mt-2 max-w-lg whitespace-nowrap text-center text-xs text-gray-400">
            원장/강사 데모는 예시 데이터를 함께 쓰는 공용 체험 계정입니다.
          </p>
        </div>
      </section>

      {/* 이용자용 */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold">스터디카페 이용자</h2>
          <p className="mt-2 text-gray-500">로그인 없이 바로 사용할 수 있습니다.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {CONSUMER_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 bg-white p-6"
              >
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 사장님용 */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold">학원·스터디카페 운영자</h2>
          <p className="mt-2 text-gray-500">
            원장·강사·학부모 권한이 분리된 SaaS 관리 도구.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {BUSINESS_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 p-6"
              >
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/register"
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} SafeStep
      </footer>
    </div>
  );
}

export function homeForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'ACADEMY_ADMIN':
      return '/dashboard';
    case 'TEACHER':
      return '/attendance';
    case 'PARENT':
      return '/parent/report';
    case 'STUDENT':
      return '/student/qr';
    default:
      return '/map';
  }
}
