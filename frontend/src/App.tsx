import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthListener } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RequireStudentLink } from './components/common/RequireStudentLink';
import { isNativeApp } from './lib/platform';
import { AppShell } from './components/common/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AdminLayout } from './components/admin/AdminLayout';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const UnauthorizedPage = lazy(() => import('./pages/auth/UnauthorizedPage'));
const TeacherPendingPage = lazy(() => import('./pages/auth/TeacherPendingPage'));

const MapSearchPage = lazy(() => import('./pages/map/MapSearchPage'));
const SeatFloorPlanPage = lazy(() => import('./pages/seats/SeatFloorPlanPage'));
const KioskPage = lazy(() => import('./pages/kiosk/KioskPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const OwnerClaimPage = lazy(() => import('./pages/owner/OwnerClaimPage'));
const StudentManagementPage = lazy(() => import('./pages/students/StudentManagementPage'));
const TeacherManagementPage = lazy(() => import('./pages/teachers/TeacherManagementPage'));
const ClassListPage = lazy(() => import('./pages/classes/ClassListPage'));
const ClassSchedulePage = lazy(() => import('./pages/classes/ClassSchedulePage'));
const ClassAttendancePage = lazy(() => import('./pages/attendance/ClassAttendancePage'));
const SubscriptionPage = lazy(() => import('./pages/billing/SubscriptionPage'));
const SuperAdminDashboardPage = lazy(() => import('./pages/admin/SuperAdminDashboardPage'));
const AdminAccessLogsPage = lazy(() => import('./pages/admin/AdminAccessLogsPage'));
const StudentQrPage = lazy(() => import('./pages/student/StudentQrPage'));
const StudentPassPage = lazy(() => import('./pages/student/StudentPassPage'));
const ParentReportPage = lazy(() => import('./pages/parent/ParentReportPage'));
const InquiryPage = lazy(() => import('./pages/InquiryPage'));
const MyInquiriesPage = lazy(() => import('./pages/MyInquiriesPage'));
const StartGuidePage = lazy(() => import('./pages/StartGuidePage'));
const TeamsPage = lazy(() => import('./pages/teams/TeamsPage'));
const TeamRoomPage = lazy(() => import('./pages/teams/TeamRoomPage'));
const JoinTeamPage = lazy(() => import('./pages/teams/JoinTeamPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const SeatEditorPage = lazy(() => import('./pages/admin/SeatEditorPage'));
const ChatListPage = lazy(() => import('./pages/chat/ChatListPage'));
const ChatRoomPage = lazy(() => import('./pages/chat/ChatRoomPage'));

function App() {
  // 세션/프로필 구독은 앱 최상단에서 한 번만
  useAuthListener();

  return (
    <BrowserRouter>
      <AppShell>
      <ErrorBoundary>
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500"
          >
            페이지를 불러오는 중...
          </div>
        }
      >
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

        {/* 팀·채팅: 학원 소속 원장·강사·학생 (학생은 명부 연동 후에만 접근) */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT']} />
          }
        >
          <Route element={<RequireStudentLink />}>
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamRoomPage />} />
          </Route>
        </Route>

        {/* 학생 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student/qr" element={<StudentQrPage />} />
          <Route path="/student/passes" element={<StudentPassPage />} />
        </Route>

        {/* 학부모 전용 */}
        <Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
          <Route path="/parent/report" element={<ParentReportPage />} />
        </Route>

        {/* 채팅: 슈퍼관리자를 제외한 전체 역할 (학생은 명부 연동 후에만 접근) */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}
            />
          }
        >
          <Route element={<RequireStudentLink />}>
            <Route path="/chat" element={<ChatListPage />} />
            <Route path="/chat/:roomId" element={<ChatRoomPage />} />
          </Route>
        </Route>

        {/* 로그인한 전체 역할: 내 문의 내역 */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}
            />
          }
        >
          <Route path="/my/inquiries" element={<MyInquiriesPage />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isNativeApp ? '/map' : '/'} replace />}
        />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
