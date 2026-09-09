import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../../hooks/useAuth';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, right }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
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
      <div className="flex items-center gap-2">
        {right}
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
