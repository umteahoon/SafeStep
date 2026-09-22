import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, useAuth } from '../../hooks/useAuth';
import { isNativeApp } from '../../lib/platform';
import { TeamActionButtons } from '../team/TeamActionButtons';
import logo from '../../assets/logo.png';

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

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center gap-4">
        <Link to={homeTo} title="홈으로" className="shrink-0">
          <img src={logo} alt="SafeStep" className="h-6 w-auto" />
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
