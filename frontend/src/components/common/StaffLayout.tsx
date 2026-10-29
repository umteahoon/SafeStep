import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  Armchair,
  UserCog,
  Users,
  UserRound,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { signOut, useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { UserRole } from '../../types';
import logo from '../../assets/logo.png';
import { InStaffShell } from './staffShellContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[]; // 없으면 원장 · 강사 모두
  studyCafeOnly?: boolean; // 스터디카페 전용 기능 (학원이면 숨김)
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard, roles: ['ACADEMY_ADMIN'] },
  { to: '/chat', label: '학생 소통 · 공지', icon: MessageCircle },
  { to: '/consult', label: '학부모 소통', icon: MessagesSquare },
  { to: '/attendance', label: '출결 관리', icon: ClipboardCheck },
  { to: '/students', label: '학생 관리', icon: Users },
  { to: '/classes', label: '반 · 시간표', icon: BookOpen },
  { to: '/teachers', label: '강사 관리', icon: UserCog, roles: ['ACADEMY_ADMIN'] },
  { to: '/billing', label: '이용권 결제', icon: CreditCard, roles: ['ACADEMY_ADMIN'] },
  { to: '/admin/reports', label: '신고 관제', icon: ShieldAlert, studyCafeOnly: true },
  { to: '/admin/seats/editor', label: '좌석 배치', icon: Armchair, studyCafeOnly: true },
];

const STAFF_ROLES: UserRole[] = ['ACADEMY_ADMIN', 'TEACHER'];


/**
 * 원장 · 강사 화면 공통 틀(라우트 레이아웃): 왼쪽 사이드바 + 오른쪽 <Outlet />.
 * 채팅처럼 학생 · 학부모도 쓰는 화면은 직원일 때만 사이드바를 붙이고, 아니면 그대로 보여줌.
 */
export function StaffShell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role;
  const isStaff = !!role && STAFF_ROLES.includes(role);
  const academyId = profile?.academy_id ?? null;
  // 지점 종류: 학원(ACADEMY)이면 좌석 · 신고 같은 스터디카페 전용 메뉴를 숨김 (값이 없으면 기존처럼 모두 표시)
  const [kind, setKind] = useState<{ id: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!academyId || !isStaff) return;
    let mounted = true;
    supabase
      .from('academies')
      .select('kind')
      .eq('id', academyId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setKind({ id: academyId, value: (data?.kind as string | null) ?? null });
      });
    return () => {
      mounted = false;
    };
  }, [academyId, isStaff]);

  if (!isStaff) return <Outlet />;

  const isAcademy = kind?.id === academyId && kind?.value === 'ACADEMY';
  const items = NAV.filter(
    (n) => (!n.roles || (role && n.roles.includes(role))) && !(n.studyCafeOnly && isAcademy)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link to="/" className="flex items-center gap-2 px-6 pb-4 pt-6" title="홈으로">
          <img src={logo} alt="SafeStep" className="h-7 w-auto" />
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="관리 메뉴">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-3 py-3">
          <NavLink
            to="/teams"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <Megaphone size={18} aria-hidden="true" />내 팀
          </NavLink>
          <NavLink
            to="/me/edit"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <UserRound size={18} aria-hidden="true" />
            {profile?.name ?? '내 정보'}
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            <LogOut size={18} aria-hidden="true" />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* 좁은 화면: 사이드바 대신 가로 스크롤 메뉴 */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden" aria-label="관리 메뉴">
          {items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <InStaffShell.Provider value={true}>
          <Outlet />
        </InStaffShell.Provider>
      </div>
    </div>
  );
}

interface StaffLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** 셸 안의 한 화면: 제목 줄 + 본문 (사이드바는 StaffShell 이 그림) */
export function StaffLayout({ title, subtitle, actions, children }: StaffLayoutProps) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 md:px-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <main className="px-6 py-6 md:px-8">{children}</main>
    </>
  );
}
