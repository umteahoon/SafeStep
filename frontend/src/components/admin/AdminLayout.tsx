import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin', label: '개요', icon: LayoutDashboard, end: true },
  { to: '/admin/logs', label: '접속 로그', icon: ShieldAlert, end: false },
];

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-bold text-gray-900">SafeStep</p>
          <p className="text-xs text-gray-400">플랫폼 관리자</p>
        </div>
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
