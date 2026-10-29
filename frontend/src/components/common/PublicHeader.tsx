import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { homeForRole } from '../../lib/navigation';
import { MOBILE_SITE_URL } from '../../lib/deviceRedirect';
import logo from '../../assets/logo.png';

/** 랜딩에서 이어지는 공개 안내 페이지(/inquiry, /start)의 상단 바 */
export function PublicHeader() {
  const { user, profile } = useAuth();
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/">
          <img src={logo} alt="SafeStep" className="h-7 w-auto shrink-0 sm:h-8" />
        </Link>
        <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm sm:gap-2">
          <a
            href={`${MOBILE_SITE_URL}/?site=mobile`}
            className="hidden rounded-lg px-3 py-2 text-gray-400 hover:bg-gray-50 sm:inline-block"
          >
            📱 모바일 버전
          </a>
          <Link to="/map" className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">
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
