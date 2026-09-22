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
import OwnerClaimPage from './pages/owner/OwnerClaimPage';
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
import InquiryPage from './pages/InquiryPage';
import StartGuidePage from './pages/StartGuidePage';
import TeamsPage from './pages/teams/TeamsPage';
import TeamRoomPage from './pages/teams/TeamRoomPage';
import JoinTeamPage from './pages/teams/JoinTeamPage';
import ReportsPage from './pages/admin/ReportsPage';
import SeatEditorPage from './pages/admin/SeatEditorPage';
import ChatListPage from './pages/chat/ChatListPage';
import ChatRoomPage from './pages/chat/ChatRoomPage';

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
        <Route path="/inquiry" element={<InquiryPage />} />
        <Route path="/start" element={<StartGuidePage />} />
        <Route path="/teams/join/:code" element={<JoinTeamPage />} />
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
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="/admin/seats/editor" element={<SeatEditorPage />} />
        </Route>

        {/* 원장 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['ACADEMY_ADMIN']} />}>
          <Route path="/owner/claim" element={<OwnerClaimPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/teachers" element={<TeacherManagementPage />} />
          <Route path="/billing" element={<SubscriptionPage />} />
        </Route>

        {/* 팀·채팅: 학원 소속 원장·강사·학생 */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT']} />
          }
        >
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamRoomPage />} />
        </Route>

        {/* 학생 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student/qr" element={<StudentQrPage />} />
        </Route>

        {/* 학부모 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
          <Route path="/parent/report" element={<ParentReportPage />} />
        </Route>

        {/* 채팅: 슈퍼관리자를 제외한 전체 역할 */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}
            />
          }
        >
          <Route path="/chat" element={<ChatListPage />} />
          <Route path="/chat/:roomId" element={<ChatRoomPage />} />
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
