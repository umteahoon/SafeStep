import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, useAuth } from '../../hooks/useAuth';
import { isNativeApp } from '../../lib/platform';
import { TeamActionButtons } from '../team/TeamActionButtons';
import { BrandLogo } from './BrandLogo';
import { useInStaffShell } from './staffShellContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, right }: PageHeaderProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  // 웹: 랜딩 페이지로 / 앱: 지도(App.tsx 라우팅이 "/"를 "/map"으로 자동 리다이렉트)
  const homeTo = isNativeApp ? '/map' : '/';
  const canChat = profile && profile.role !== 'SUPER_ADMIN';
  // 원장 · 강사 사이드바 셸 안: 로고 · 팀 · 채팅 · 내 정보 · 로그아웃은 사이드바에 있으므로 제목과 페이지 버튼만
  const inShell = useInStaffShell();
  if (inShell) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 md:px-8">
        <div>
          {backTo && (
            <button onClick={() => navigate(backTo)} className="text-sm text-slate-400 hover:text-slate-600">
              ← 뒤로
            </button>
          )}
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>}
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center gap-4">
        <Link to={homeTo} title="홈으로" className="shrink-0">
          <BrandLogo />
        </Link>
        <div>
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 뒤로
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TeamActionButtons />
        {right}
        {canChat && (
          <Link
            to="/chat"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            💬 채팅
          </Link>
        )}
        {profile && (
          <Link
            to="/me/edit"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            👤 내 정보
          </Link>
        )}
        {profile && (
          <Link
            to="/my/inquiries"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            📩 문의내역
          </Link>
        )}
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
