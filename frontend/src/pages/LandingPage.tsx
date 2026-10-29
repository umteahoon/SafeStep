import { homeForRole } from '../lib/navigation';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Flag,
  MapPin,
  QrCode,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MOBILE_SITE_URL } from '../lib/deviceRedirect';
import { BrandLogo } from '../components/common/BrandLogo';
import { DemoButtons } from '../components/common/DemoButtons';
import heroDashboard from '../assets/hero-dashboard.webp';
import heroMobile from '../assets/hero-mobile.webp';

const CONSUMER_FEATURES: { title: string; desc: string; icon: LucideIcon }[] = [
  {
    title: '실시간 잔여석',
    icon: MapPin,
    desc: '네이버 지도에서 주변 스터디카페의 빈자리를 실시간으로 확인하고 이동하세요.',
  },
  {
    title: '좌석 도면 & 익명 신고',
    icon: Flag,
    desc: '자리별 사용 현황을 한눈에. 소음·자리 독점은 익명으로 신고할 수 있습니다.',
  },
  {
    title: 'QR·핀코드 출입',
    icon: QrCode,
    desc: '키오스크에서 QR 또는 6자리 핀코드로 입실·외출·퇴실을 처리합니다.',
  },
];

const BUSINESS_FEATURES: { title: string; desc: string; icon: LucideIcon }[] = [
  {
    title: '스마트 출결',
    icon: Bell,
    desc: '반별 원클릭 출석 체크. 결석·지각은 보호자에게 즉시 알림이 발송됩니다.',
  },
  {
    title: '강사 승인 & 권한 분리',
    icon: ShieldCheck,
    desc: '원장이 강사 가입을 승인하고, 역할별로 접근 가능한 화면이 엄격히 분리됩니다.',
  },
  {
    title: '대시보드 & 엑셀 추출',
    icon: BarChart3,
    desc: '출석률·학습시간 통계를 보고 학생·출결 데이터를 엑셀로 내려받습니다.',
  },
  {
    title: '학부모 리포트',
    icon: Users,
    desc: '6자리 코드로 자녀를 연동하고 주간 리포트, 사전 결석 신청을 제공합니다.',
  },
];

export default function LandingPage() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <BrandLogo />
          <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm sm:gap-2">
            <a
              href={`${MOBILE_SITE_URL}/?site=mobile`}
              className="hidden rounded-lg px-3 py-2 text-gray-400 hover:bg-gray-50 sm:inline-block"
            >
              📱 모바일 버전
            </a>
            <Link
              to="/map"
              className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
            >
              <span className="hidden sm:inline">스터디카페 및 학원 찾기</span>
              <span className="sm:hidden">찾기</span>
            </Link>
            {user ? (
              <Link
                to={profile ? homeForRole(profile.role) : '/map'}
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
          <p className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            대림대학교 컴퓨터정보학부 캡스톤디자인 · 팀 육전
          </p>
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
              to="/inquiry"
              className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              학원·카페 도입 문의
            </Link>
          </div>
        </div>
        {/* 실제 서비스 화면: 웹 원장 대시보드 + 모바일 앱 홈 */}
        <div className="relative flex items-center justify-center pb-8 md:pb-0">
          <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-blue-900/10">
            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <span className="ml-2 truncate text-[11px] text-gray-400">safestep-kr.netlify.app/dashboard</span>
            </div>
            <img src={heroDashboard} alt="SafeStep 원장 대시보드 화면" className="block w-full" />
          </div>
          <div className="absolute -bottom-2 right-2 w-[28%] overflow-hidden rounded-[1.4rem] border-[5px] border-gray-900 bg-gray-900 shadow-2xl sm:right-4 md:-bottom-8 md:-right-4">
            <img src={heroMobile} alt="SafeStep 모바일 앱 홈 화면" className="block w-full rounded-[1rem]" />
          </div>
        </div>
      </section>

      {/* 로그인 없이 체험 */}
      <section className="border-t border-gray-100 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold">로그인 없이 바로 체험하기</h2>
          <p className="mt-2 text-gray-500">
            정식 서비스 전 체험판입니다. 역할을 고르면 예시 학원 데이터로 바로 들어가집니다.
          </p>
          <div className="mt-6">
            <DemoButtons />
          </div>
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
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <f.icon className="h-5 w-5" />
                </span>
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
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/start"
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10 text-center text-sm text-gray-400">
        <div className="mb-2 flex justify-center gap-4">
          <Link to="/terms" className="hover:text-gray-600">이용약관</Link>
          <Link to="/privacy" className="font-semibold text-gray-500 hover:text-gray-700">개인정보처리방침</Link>
          <Link to="/inquiry" className="hover:text-gray-600">문의하기</Link>
        </div>
        <p className="mb-1 text-gray-500">
          대림대학교 컴퓨터정보학부 · 2026학년도 2학기 캡스톤디자인 · 팀 육전
        </p>
        <p className="mb-3">
          지도교수 정호일 · 이주환 · 엄태훈 · 이동교 · 최원재 · 문의{' '}
          <a href="mailto:am2869@naver.com" className="hover:text-gray-600">am2869@naver.com</a> (엄태훈)
        </p>
        © {new Date().getFullYear()} SafeStep. All rights reserved.
      </footer>
    </div>
  );
}
