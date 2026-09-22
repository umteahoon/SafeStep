import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { canUseTeams } from '../../lib/teams';

/**
 * 팀 참가 / 팀 만들기 버튼.
 * 비로그인: 누르면 로그인으로 이동 (팀 페이지가 로그인 필요) / 로그인: 팀 기능 사용 가능한 역할에게만 표시
 */
export function TeamActionButtons() {
  const { user, profile } = useAuth();
  if (user && profile && !canUseTeams(profile.role)) return null;

  return (
    <div className="flex items-center gap-1.5">
      {user && (
        <Link
          to="/teams"
          className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          내 팀
        </Link>
      )}
      <Link
        to="/teams?action=join"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        팀 참가
      </Link>
      <Link
        to="/teams?action=create"
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        팀 만들기
      </Link>
    </div>
  );
}
