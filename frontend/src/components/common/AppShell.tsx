import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isNativeApp, showPhoneMockup } from '../../lib/platform';
import { useAuth } from '../../hooks/useAuth';
import { homeForRole } from '../../pages/LandingPage';

const TABS = [
  { to: '/map', label: '지도', icon: '🗺️' },
  { to: '/kiosk', label: '키오스크', icon: '🪑' },
  { to: '__me__', label: '내 정보', icon: '👤' },
];

function BottomTabBar() {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const meTo = user && profile ? homeForRole(profile.role) : '/login';

  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white/95 backdrop-blur">
      {TABS.map((t) => {
        const to = t.to === '__me__' ? meTo : t.to;
        const active =
          t.to === '__me__'
            ? !['/map', '/kiosk', '/seats'].some((p) => pathname.startsWith(p))
            : pathname.startsWith(t.to);
        return (
          <Link
            key={t.label}
            to={to}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * - 웹 일반 모드: children 그대로
 * - 웹 앱 미리보기(바깥 창): 폰 목업 + 내부 iframe (iframe 이 390px 뷰포트를 가져 모바일 레이아웃이 정확히 적용됨)
 * - iframe 내부 / 실제 네이티브: 하단 탭바 + 전체화면
 */
export function AppShell({ children }: { children: ReactNode }) {
  if (showPhoneMockup) {
    const src = `${window.location.origin}/map?app=1`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-4">
        <div className="relative h-[844px] max-h-[94vh] w-[390px] max-w-full overflow-hidden rounded-[2.2rem] border-[10px] border-neutral-800 bg-white shadow-2xl">
          <div className="absolute left-1/2 top-0 z-30 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
          <iframe
            title="SafeStep 앱 미리보기"
            src={src}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  if (!isNativeApp) return <>{children}</>;

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="h-full overflow-y-auto pb-14">{children}</div>
      <BottomTabBar />
    </div>
  );
}
