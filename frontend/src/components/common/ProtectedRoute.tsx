import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        인증 확인 중...
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // 🔒 엄격한 권한 체크: 슈퍼관리자도 학원 내부 페이지 진입 불가
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 강사는 원장 승인이 완료되어야 접근 가능
  if (profile.role === 'TEACHER' && profile.approval_status !== 'APPROVED') {
    return <Navigate to="/teacher/pending" replace />;
  }

  // 원장인데 아직 학원이 없으면 온보딩으로
  if (
    profile.role === 'ACADEMY_ADMIN' &&
    !profile.academy_id &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};
