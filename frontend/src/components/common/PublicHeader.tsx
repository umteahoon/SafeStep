import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { homeForRole } from '../../pages/LandingPage';
import logo from '../../assets/logo.png';

/** 랜딩에서 이어지는 공개 안내 페이지(/inquiry, /start)의 상단 바 */
export function PublicHeader() {
  const { user, profile } = useAuth();
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link to="/">
          <img src={logo} alt="SafeStep" className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/map" className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">
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
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
