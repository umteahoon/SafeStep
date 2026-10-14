import { Link } from 'react-router-dom';
import { useAuth, signOut } from '../../hooks/useAuth';
import { homeForRole } from '../../lib/navigation';

export default function UnauthorizedPage() {
  const { profile } = useAuth();
  const homeTo = profile ? homeForRole(profile.role) : '/';

  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">접근 권한이 없습니다.</h1>
        <p className="mt-2 text-sm text-gray-400">이 계정으로는 요청한 페이지를 열 수 없습니다.</p>
        <div className="mt-6 flex items-center justify-center gap-4 text-sm font-medium">
          <Link to={homeTo} className="text-indigo-600 hover:text-indigo-700">
            내 페이지로 이동
          </Link>
          <button onClick={() => signOut()} className="text-gray-400 hover:text-gray-600">
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
