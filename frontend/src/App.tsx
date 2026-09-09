import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthListener } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { isNativeApp } from './lib/platform';
import { AppShell } from './components/common/AppShell';
import { AdminLayout } from './components/admin/AdminLayout';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import TeacherPendingPage from './pages/auth/TeacherPendingPage';

import MapSearchPage from './pages/map/MapSearchPage';
import SeatFloorPlanPage from './pages/seats/SeatFloorPlanPage';
import KioskPage from './pages/kiosk/KioskPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import StudentManagementPage from './pages/students/StudentManagementPage';
import TeacherManagementPage from './pages/teachers/TeacherManagementPage';
import ClassListPage from './pages/classes/ClassListPage';
import ClassSchedulePage from './pages/classes/ClassSchedulePage';
import ClassAttendancePage from './pages/attendance/ClassAttendancePage';
import SubscriptionPage from './pages/billing/SubscriptionPage';
import SuperAdminDashboardPage from './pages/admin/SuperAdminDashboardPage';
import AdminAccessLogsPage from './pages/admin/AdminAccessLogsPage';
import StudentQrPage from './pages/student/StudentQrPage';
import ParentReportPage from './pages/parent/ParentReportPage';

function App() {
  // 세션/프로필 구독은 앱 최상단에서 한 번만
  useAuthListener();

  return (
    <BrowserRouter>
      <AppShell>
      <Routes>
        {/* 공개 라우트 (로그인 불필요) */}
        <Route
          path="/"
          element={isNativeApp ? <Navigate to="/map" replace /> : <LandingPage />}
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/teacher/pending" element={<TeacherPendingPage />} />

        {/* 스터디카페 이용자용 공개 화면 */}
        <Route path="/map" element={<MapSearchPage />} />
        <Route path="/seats/:id" element={<SeatFloorPlanPage />} />
        <Route path="/kiosk" element={<KioskPage />} />

        {/* 슈퍼 관리자 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<SuperAdminDashboardPage />} />
            <Route path="/admin/logs" element={<AdminAccessLogsPage />} />
          </Route>
        </Route>

        {/* 원장 + 강사(승인시) */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['ACADEMY_ADMIN', 'TEACHER']} />
          }
        >
          <Route path="/students" element={<StudentManagementPage />} />
          <Route path="/classes" element={<ClassListPage />} />
          <Route path="/classes/schedule" element={<ClassSchedulePage />} />
          <Route path="/attendance" element={<ClassAttendancePage />} />
        </Route>

        {/* 원장 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['ACADEMY_ADMIN']} />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/teachers" element={<TeacherManagementPage />} />
          <Route path="/billing" element={<SubscriptionPage />} />
        </Route>

        {/* 학생 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student/qr" element={<StudentQrPage />} />
        </Route>

        {/* 학부모 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
          <Route path="/parent/report" element={<ParentReportPage />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isNativeApp ? '/map' : '/'} replace />}
        />
      </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
