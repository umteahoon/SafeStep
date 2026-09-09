# 📋 SafeStep (네이버 지도 스터디카페 좌석 관제, 학원 강사 승인/스마트 출결 & SaaS 플랫폼) 종합 개발 명세서

> 이 문서는 실제 `frontend/`, `backend/`, `supabase/` 코드와 대조하여 검증한 **현재 구현 기준** 명세서입니다. 코드에 없는 내용은 문서에 넣지 않고, 아직 구현되지 않은 기능은 [11. 계획된 기능 (미구현)](#11-계획된-기능-미구현)에 별도로 표시합니다.

## 1. 프로젝트 개요

- **서비스명**: SafeStep (세이프스텝)
- **목적**:
  1. **스터디카페 관제 모드**: 네이버 지도 기반 주변 탐색, 실시간 좌석/도면 확인, 키패드/QR 키오스크 입·퇴실 좌석 배정 및 **외출/자리비움(60분 타임아웃)**, **익명 소음/좌석독점 신고**, 누적 공부 시간 통계.
  2. **학원 출결 및 수업 관리 모드 (B2B SaaS)**: 토스페이먼츠 월 10,000원 이용권 결제 시 활성화.
     - **원장 전용 학원 데이터 일괄 내보내기**: 원장은 본인이 운영하는 학원의 출석부, 학생 명단, 스터디카페 이용 통계를 **엑셀(xlsx)로 즉시 다운로드/추출** 가능.
     - **원장 온보딩**: 원장이 가입 직후 학원 이름/주소/좌표/총 좌석 수를 입력하면 학원이 생성되고, 지정한 좌석 수에 맞춰 존(FOCUS/OPEN/LAPTOP/ROOM_A/ROOM_B)별 좌석이 자동 배치됩니다.
     - **원장 & 강사 협업 워크플로우**: 강사는 회원가입 시 소속 학원을 선택하고, 원장의 승인을 받아야 활성화됩니다.
     - **수업(Class) & 시간표 관리**: 반(클래스) 생성, 담당 강사 지정, 요일/시간별 수업 일정 등록.
     - **스마트 출석부 & 결석 사유 관리**: 반별 원클릭 출석/결석/지각 체크, 결석 사유 및 메모.
     - **학부모 사전 결석/지각 신청**: 학부모가 앱에서 사전에 사유를 제출(`absence_requests`)하면 학원 직원이 조회/승인.
     - **스마트 알림 정책**: 정상 출석 시 무음, **결석/지각 체크 시에만 학부모에게 Web Push 알림 즉시 발송**.
     - **학부모 온보딩 & 주간 리포트**: 6자리 연동 코드(`link_code`)로 자녀 연동, 최근 7일 출석률 및 누적 학습 시간 리포트 제공.
- **5단계 권한 체계 & 🔒 엄격한 개인정보/데이터 분리 정책 (Strict Privacy RBAC)**:
  1. **슈퍼 관리자 (`SUPER_ADMIN`)**: 학원 내부 수업/출석부/학생 개인정보는 RLS로 원천 차단. 학원 목록(공개 정보), 매출 집계, 가입자 수 통계만 접근 가능.
  2. **학원 원장 (`ACADEMY_ADMIN`)**: 학원 온보딩, 원장 대시보드, 강사 승인/반려, 토스 결제, 반/시간표/출석부 관리, 자사 데이터 엑셀 추출. (타 학원 데이터 및 슈퍼관리자 페이지 접근 차단)
  3. **학원 강사 (`TEACHER`)**: 원장 승인 후 활성화. 배정된 반의 시간표 등록, 출석부 작성. (결제/원장 고유 설정 및 타 학원 데이터 차단)
  4. **학생 (`STUDENT`)**: 네이버 지도 탐색, 실시간 잔여석 확인, 개인 모바일 QR 출결 코드, 좌석 소음/불편 신고.
  5. **학부모 (`PARENT`)**: 6자리 코드로 자녀 연동, 사전 결석 신청, 결석 Web Push 수신, 주간 리포트 확인.
- **배포 및 인프라 (전액 0원 무료)**:
  - Web: Netlify (Free)
  - Backend API: Render Web Service (Free)
  - Database & Auth: Supabase (PostgreSQL, Realtime, RLS, Free)
  - Map API: Naver Cloud Platform Web Dynamic Map (월 1,000만 건 무료)
  - Payment: 토스페이먼츠 결제위젯 (`js.tosspayments.com` 스크립트 로드 방식, 테스트 환경 0원 연동)
  - Mobile App: Capacitor 8 -> Android Studio APK 빌드

---

## 2. 기술 스택 (Tech Stack)

### Frontend & Mobile App (`frontend/package.json` 기준)
- **Framework / Build**: React 19, Vite 8, TypeScript
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite`)
- **Data Export**: `xlsx`, `file-saver`
- **QR Scanner / Generator**: `html5-qrcode` (키오스크 카메라 QR 스캔), `qrcode.react` (학생 모바일 QR 생성)
- **Calendar / Schedule**: `date-fns`
- **Map SDK**: Naver Maps JavaScript API v3 (NCP Web Dynamic Map, `useNaverMaps.ts` 훅으로 스크립트 로드)
- **Payment**: 토스페이먼츠 결제위젯을 `<script src="https://js.tosspayments.com/v1/payment-widget">` 동적 로드 방식으로 연동 (별도 SDK 패키지 미사용)
- **Mobile Hybrid**: `@capacitor/core`, `@capacitor/android`, `@capacitor/camera`, `@capacitor/push-notifications`
- **PWA & Web Push**: Service Worker (`public/sw.js`), Web Push API
- **State & Data**: TanStack Query v5, Zustand, `@supabase/supabase-js`
- **Routing**: `react-router-dom` v7

### Backend (`backend/package.json` 기준)
- **Runtime / Framework**: Node.js, Express 5, TypeScript (`ts-node-dev`)
- **Push Notification (0원)**: `web-push` (VAPID 기반 무료 웹 푸시, `services/PushService.ts`)
- **Payment API**: TossPayments Server REST API를 `fetch`로 직접 호출 (승인 `POST /v1/payments/confirm`)
- **Cron (`node-cron`)**:
  - 매 10분: 스터디카페 외출(`AWAY`) 후 60분 초과 좌석 자동 반납 (`cron/awayTimeout.ts`)
  - 자정: 미퇴실자 자동 정리 (`cron/autoCheckout.ts`)
  - 주간: 학부모 리포트 관련 배치 (`cron/weeklyReport.ts`)
- **인증**: Express 미들웨어(`middleware/auth.ts`)가 `Authorization: Bearer <supabase access token>`을 검증하고 `profiles`에서 role/academy_id를 조회해 요청에 첨부
- **Deployment**: Render (무료 티어)

### Database
- Supabase (PostgreSQL 15+), Row Level Security, `SECURITY DEFINER` 헬퍼 함수 기반 정책 (자세한 내용은 4장 참고)

---

## 3. 디렉토리 구조 (Repository Layout)

```text
safestep/
├── README.md
├── frontend/
│   ├── android/                # Capacitor 8 Android Studio 프로젝트
│   ├── public/
│   │   ├── sw.js               # Web Push Service Worker
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── assets/              # logo.png, hero.png 등
│   │   ├── components/
│   │   │   ├── common/          # AppShell, PageHeader, ProtectedRoute
│   │   │   ├── admin/           # AdminLayout.tsx (슈퍼관리자 좌측 사이드바)
│   │   │   ├── kiosk/           # QrScanner.tsx
│   │   │   └── seat/            # FloorPlanGrid.tsx, SeatCell.tsx, NoiseReportModal.tsx
│   │   ├── hooks/                # useAuth.ts, useNaverMaps.ts
│   │   ├── lib/                  # api.ts(백엔드 fetch 래퍼), platform.ts, push.ts, supabase.ts
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx          # 공개 랜딩 페이지
│   │   │   ├── auth/                    # LoginPage, RegisterPage, TeacherPendingPage, UnauthorizedPage
│   │   │   ├── map/                     # MapSearchPage.tsx (네이버 지도 탐색)
│   │   │   ├── seats/                   # SeatFloorPlanPage.tsx (도면 & 잔여석)
│   │   │   ├── kiosk/                   # KioskPage.tsx (키패드 + QR 스캔 + 외출)
│   │   │   ├── onboarding/              # OnboardingPage.tsx (원장 최초 학원 등록)
│   │   │   ├── dashboard/               # DashboardPage.tsx (원장 대시보드 + 엑셀 추출)
│   │   │   ├── students/                # StudentManagementPage.tsx (학생 등록/관리)
│   │   │   ├── teachers/                # TeacherManagementPage.tsx (강사 승인/반려)
│   │   │   ├── classes/                 # ClassListPage.tsx, ClassSchedulePage.tsx
│   │   │   ├── attendance/              # ClassAttendancePage.tsx (반별 출석부)
│   │   │   ├── billing/                 # SubscriptionPage.tsx (토스 30일 이용권)
│   │   │   ├── admin/                   # SuperAdminDashboardPage.tsx, AdminAccessLogsPage.tsx (접속 로그)
│   │   │   ├── student/                 # StudentQrPage.tsx (학생 모바일 QR)
│   │   │   └── parent/                  # ParentReportPage.tsx (자녀 연동, 사전결석, 리포트)
│   │   ├── types/index.ts
│   │   ├── utils/excelExporter.ts
│   │   ├── App.tsx                # 전체 라우팅 정의
│   │   └── main.tsx
│   ├── capacitor.config.ts
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── routes/            # academy, attendance, auth, export, kiosk, parent, payment, teacher
│   │   ├── cron/               # autoCheckout.ts, awayTimeout.ts, weeklyReport.ts
│   │   ├── services/           # PushService.ts
│   │   ├── middleware/         # auth.ts (requireAuth, requireRole)
│   │   ├── lib/                # supabaseAdmin.ts (service role 클라이언트)
│   │   └── index.ts
│   └── package.json
│
└── supabase/
    ├── schema.sql                    # 전체 스키마 + RLS 정책 (4장의 원본)
    ├── seed.sql                      # 데모 데이터
    ├── seed_floorplan.sql            # 좌석 도면 데모 재배치 스크립트
    ├── migration_login_attempts.sql  # login_attempts 테이블 추가 마이그레이션
    └── seed_demo_accounts.mjs        # 원장/강사 데모 로그인 계정 생성 스크립트 (9.1 참고)
```

> **아키텍처 메모**: 학생/반/시간표 등 `students`, `classes`, `class_schedules`, `class_attendance_records`, `absence_requests`, `seats(읽기)` 같은 RLS로 보호되는 데이터는 프론트엔드가 `@supabase/supabase-js`로 **직접** 읽고 씁니다. Express 백엔드는 (1) 서비스 롤 권한이 필요한 작업(키오스크 익명 체크인, 온보딩 시 좌석 자동 생성), (2) 외부 API 연동(토스 결제 승인, Web Push 발송), (3) 여러 테이블을 조합하는 집계/추출(엑셀 데이터, 강사 승인)에만 사용됩니다.

---

## 4. 데이터베이스 스키마 & RLS 보안 정책

> 아래 내용은 `supabase/schema.sql`을 그대로 옮긴 것입니다. Supabase SQL Editor에서 이 파일을 실행하세요.

### 4.1 ENUM 타입

```sql
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
```

### 4.2 핵심 테이블

| 테이블 | 설명 |
| --- | --- |
| `academies` | 학원/스터디카페 지점. `subscription_status`(TRIAL/ACTIVE/EXPIRED), 가입 시 14일 무료 체험 |
| `profiles` | 통합 사용자 프로필 (역할, 소속 학원, 강사 승인 상태) |
| `subscriptions` | 토스 30일 이용권 결제 이력 |
| `classes` | 🔒 반/수업 (슈퍼관리자 열람 불가) |
| `class_schedules` | 🔒 반별 요일/시간 시간표 |
| `students` | 🔒 학생 (출결코드, QR 토큰, 학부모 연동 코드/토큰) |
| `class_enrollments` | 🔒 반별 수강생 배정 |
| `class_attendance_records` | 🔒 반별 일일 출석부 |
| `seats` | 스터디카페 좌석 (공개 읽기) |
| `attendance_logs` | 키오스크 입/퇴실/외출/복귀 로그 |
| `absence_requests` | 학부모 사전 결석/지각 신청 |
| `push_subscriptions` | 학부모 Web Push 구독 정보 |
| `seat_reports` | 익명 소음/좌석독점 신고 (신고자 식별 정보 미저장) |
| `login_attempts` | 로그인 시도 기록 (성공/실패, IP, User-Agent) — 슈퍼관리자 접속 로그용 |

전체 컬럼 정의는 `supabase/schema.sql` 참고. 핵심 제약:
- `students.qr_token`, `students.parent_view_token`: `gen_random_uuid()` 기반 (예측 불가, 단 재발급/만료 기능은 없음 — 11장 참고)
- `students.link_code`: 6자리 숫자, `class_attendance_records`는 `(class_id, student_id, date)` 유니크
- `absence_requests`는 `(student_id, date)` 유니크 (하루 1건)

### 4.3 RLS 헬퍼 함수

매 정책마다 서브쿼리를 반복하지 않도록 `SECURITY DEFINER` 함수로 분리했습니다.

```sql
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_user_academy_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_approved_staff_of(target_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND academy_id = target_academy_id
      AND (role = 'ACADEMY_ADMIN' OR (role = 'TEACHER' AND approval_status = 'APPROVED'))
  );
$$;
```

### 4.4 RLS 정책 요약

| 테이블 | 읽기 | 쓰기 |
| --- | --- | --- |
| `academies` | 전체 공개 | INSERT: `SUPER_ADMIN`만 · UPDATE: `SUPER_ADMIN` 또는 본인 학원 원장 · DELETE: `SUPER_ADMIN`만 |
| `profiles` | 본인 + 같은 학원 직원(최소 정보) + `SUPER_ADMIN`(카운트 집계용) | 본인만 |
| `subscriptions` | `SUPER_ADMIN` 또는 본인 학원 원장 | 없음 (백엔드가 service role로만 기록) |
| `classes` / `class_schedules` / `class_enrollments` | 해당 학원 원장/승인 강사만 (슈퍼관리자 차단) | 동일 |
| `class_attendance_records` | 해당 학원 원장/승인 강사 + 본인 자녀(학부모/학생) | 원장/승인 강사만 |
| `students` | 원장/승인 강사 + 본인(학생) + 학부모 | 원장/승인 강사만 |
| `seats` | 전체 공개 | 원장/승인 강사(UPDATE). 키오스크의 실제 입·퇴실 처리는 백엔드가 **service role**로 RLS 우회 |
| `attendance_logs` | 원장/승인 강사 + 본인 자녀(학부모/학생) | 백엔드(service role)만 |
| `absence_requests` | 원장/승인 강사 + 신청한 학부모 본인 | INSERT: 학부모 본인 · UPDATE(승인/반려): 원장/승인 강사 |
| `push_subscriptions` | 학부모 본인 자녀 것만 | 학부모 본인만 |
| `seat_reports` | 원장/승인 강사만 | 인증된 사용자 누구나 INSERT(익명 신고) |
| `login_attempts` | `SUPER_ADMIN`만 | 백엔드(service role)만 |

> ⚠️ **이전 버전 대비 수정 이력**: 초기 명세서에는 `academies` 정책에 `USING (... = 'SUPER_ADMIN' OR true)`로 작성되어 있어, `OR true` 때문에 로그인한 사용자 누구나 학원 데이터를 쓸 수 있는 심각한 보안 결함이 있었습니다. 현재 `supabase/schema.sql`은 공개 읽기(SELECT)와 쓰기(INSERT/UPDATE/DELETE)를 역할별로 분리해 이를 수정했습니다. 또한 `class_schedules`/`class_enrollments`/`attendance_logs`/`push_subscriptions`/`seat_reports`는 RLS만 켜고 정책이 없으면 전체 접근이 차단되는 Postgres 기본 동작 때문에 정상 동작하지 않았던 것도 함께 수정되었습니다.

---

## 5. 프론트엔드 라우팅 및 역할별 접근 제어

### 5.1 라우트 권한 매트릭스 (`frontend/src/App.tsx` 기준)

| 라우트 | 페이지 | 공개 | SUPER_ADMIN | ACADEMY_ADMIN | TEACHER(승인시) | STUDENT | PARENT |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/` | LandingPage (웹) / `/map`으로 리다이렉트 (앱) | **O** | | | | | |
| `/login`, `/register` | 로그인 / 회원가입 | **O** | | | | | |
| `/unauthorized`, `/teacher/pending` | 권한 없음 / 강사 승인 대기 | **O** | | | | | |
| `/map` | 네이버 지도 주변 스터디카페 탐색 | **O** | | | | | |
| `/seats/:id` | 매장 내부 도면 & 잔여석 | **O** | | | | | |
| `/kiosk` | 태블릿 키패드/QR 출결 | **O** | | | | | |
| `/admin` | 슈퍼 관리자 대시보드 (좌측 사이드바: 개요/접속 로그) | | **O** | | | | |
| `/admin/logs` | 접속 로그 (로그인 성공/실패, 반복 실패 자동 감지) | | **O** | | | | |
| `/students` | 학생 등록/관리 | | | **O** | **O** | | |
| `/classes`, `/classes/schedule` | 반 개설 & 시간표 | | | **O** | **O** | | |
| `/attendance` | 반별 출석부 | | | **O** | **O** | | |
| `/onboarding` | 원장 최초 학원 등록 | | | **O** | | | |
| `/dashboard` | 원장 대시보드 (엑셀 추출) | | | **O** | | | |
| `/teachers` | 강사 승인/반려 관리 | | | **O** | | | |
| `/billing` | 토스 30일 이용권 결제 | | | **O** | | | |
| `/student/qr` | 학생 개인 모바일 QR | | | | | **O** | |
| `/parent/report` | 자녀 연동/사전결석/주간 리포트 | | | | | | **O** |

### 5.2 `ProtectedRoute.tsx` (실제 구현)

```tsx
// frontend/src/components/common/ProtectedRoute.tsx
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
```

---

## 6. 백엔드 API 엔드포인트 명세

대부분의 라우트는 `requireAuth` 미들웨어로 `Authorization: Bearer <supabase access token>`을 검증합니다. `/api/auth/register`, `/api/auth/login-log`, `/api/kiosk/*`는 로그인 전/실패 시에도 호출돼야 하므로 공개(무인증) 상태입니다.

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 공개 | 이메일 인증 없이 계정+프로필 즉시 생성. 강사는 `academyId` 필수, 승인 대기(`PENDING`)로 시작 |
| POST | `/api/auth/login-log` | 공개 | 로그인 성공/실패를 `login_attempts`에 기록 (IP, User-Agent 포함). `LoginPage.tsx`가 로그인 시도 직후 호출 |
| GET | `/api/academy` | 로그인 | 현재 사용자의 소속 학원 정보 조회 |
| POST | `/api/academy/onboard` | ACADEMY_ADMIN | 학원 최초 생성 + 프로필 연결 + 지정 좌석 수만큼 존별 좌석 자동 생성 |
| GET | `/api/teachers/pending` | ACADEMY_ADMIN | 본인 학원 소속 승인 대기 강사 목록 |
| POST | `/api/teachers/:teacherId/approve` | ACADEMY_ADMIN | 강사 승인 (타 학원 강사 승인 방지) |
| POST | `/api/teachers/:teacherId/reject` | ACADEMY_ADMIN | 강사 반려 |
| PUT | `/api/attendance` | ACADEMY_ADMIN, TEACHER | 출석 upsert. `ABSENT`/`LATE`일 때만 학부모 Web Push 발송 |
| POST | `/api/kiosk/:academyId/verify-pin` | 공개 | 핀코드로 학생 조회 |
| POST | `/api/kiosk/:academyId/verify-qr` | 공개 | QR 토큰으로 학생 조회 |
| POST | `/api/kiosk/:academyId/check-in` | 공개 | 좌석 배정 + 출결 로그 기록 (동시성 방지: `status='EMPTY'` 조건부 UPDATE) |
| POST | `/api/kiosk/:academyId/check-out` | 공개 | 퇴실 처리 + 체류 시간 계산 |
| POST | `/api/kiosk/:academyId/away` | 공개 | 외출 처리 |
| POST | `/api/kiosk/:academyId/return` | 공개 | 외출 복귀 처리 |
| POST | `/api/parent/link` | PARENT | 6자리 코드로 자녀 연동 |
| GET | `/api/parent/children` | PARENT | 연동된 자녀 목록 |
| POST | `/api/parent/push-subscribe` | PARENT | Web Push 구독 등록 |
| GET | `/api/parent/report` | PARENT | 최근 7일 출석률/학습시간 리포트 |
| POST | `/api/payments/confirm` | ACADEMY_ADMIN | 토스 결제 승인 + `subscriptions` 기록 + `academies.subscription_status`를 `ACTIVE`로 동기화 |
| GET | `/api/export/students` | ACADEMY_ADMIN | 원생 명부 (엑셀 추출용) |
| GET | `/api/export/attendance?month=` | ACADEMY_ADMIN | 월간 출석부 |
| GET | `/api/export/study-sessions` | ACADEMY_ADMIN | 스터디카페 이용 로그 |
| GET | `/health` | 공개 | 헬스체크 |

> 키오스크(`/api/kiosk/*`)는 태블릿에 로그인 세션이 없는 것을 전제로 인증 없이 열려 있고, 서버가 `SUPABASE_SERVICE_ROLE_KEY`로 RLS를 우회해 좌석/로그를 기록합니다. 학원별 접근 제한이 필요하다면 별도의 키오스크 기기 인증(고정 API 키 등)을 추가해야 합니다 — 현재는 미구현입니다.

---

## 7. 핵심 비즈니스 로직

### 7.1 원장 온보딩 & 좌석 자동 배치
- 원장이 회원가입 후 처음 로그인하면 `ProtectedRoute`가 `/onboarding`으로 강제 이동시킵니다.
- 학원명/주소/좌표/총 좌석 수를 입력하면 `POST /api/academy/onboard`가 학원을 생성하고, 좌석 수를 40%(FOCUS)/30%(OPEN)/15%(LAPTOP)/나머지(ROOM_A, ROOM_B) 비율로 자동 분배해 `seats`를 채웁니다.
- 특정 좌석의 위치를 세밀하게 재배치하려면 관리자 UI가 아직 없어 `supabase/seed_floorplan.sql` 같은 SQL을 직접 실행해야 합니다 (11장 참고).

### 7.2 QR 코드 및 키패드 이중 출결 모드
1. **핀코드 모드**: `attendance_code`(4~6자리) 입력 후 `/api/kiosk/:academyId/verify-pin` 호출.
2. **모바일 QR 스캔 모드**: 학생 앱의 `qr_token`을 키오스크 카메라(`html5-qrcode`)로 스캔 → `/api/kiosk/:academyId/verify-qr`.
3. 좌석 선택 시 `check-in`, 퇴실 시 `check-out`, 외출/복귀는 `away`/`return`을 호출하며 모두 `attendance_logs`에 기록됩니다.

### 7.3 외출(자리비움) 자동 반납 & 익명 신고
- `cron/awayTimeout.ts`가 10분마다 `status='AWAY'`이고 `away_at`이 60분 이상 지난 좌석을 자동으로 `EMPTY`로 반납합니다.
- `seat_reports`에 좌석 번호와 사유(`NOISE`/`MONOPOLY`/`OTHER`)만 저장하고 신고자 식별 정보는 저장하지 않아 익명성을 보장합니다.

### 7.4 학부모 사전 결석 신청 & 출석부 연동
1. 학부모가 `absence_requests`에 직접 INSERT (RLS: 본인 자녀에 대해서만 허용).
2. 원장/강사가 출석부 화면(`ClassAttendancePage.tsx`)에서 조회 후 승인/반려(`UPDATE`)하며, 실제 출석 상태 반영은 `PUT /api/attendance`로 별도 처리합니다.

### 7.5 결석/지각 스마트 알림
- `PUT /api/attendance`에서 상태가 `ABSENT`/`LATE`일 때만 `PushService.sendAbsenceAlert()`를 호출해 해당 학생의 `push_subscriptions` 전체에 Web Push를 발송합니다. `PRESENT`는 무음(비용/피로도 0).

### 7.6 원장 전용 데이터 엑셀 추출
- `DashboardPage.tsx`가 `/api/export/students`, `/api/export/attendance`, `/api/export/study-sessions`를 병렬 호출해 학생 수/출석률/학습시간 통계를 계산하고, "엑셀 추출" 클릭 시 `utils/excelExporter.ts`(`xlsx`)로 워크북 3개 시트를 즉시 다운로드합니다.

### 7.7 결제-구독 동기화
- `POST /api/payments/confirm`이 토스 승인 API 호출 성공 시 `subscriptions`에 결제 이력을 남기고, 같은 트랜잭션에서 `academies.subscription_status`를 `ACTIVE`로, `subscription_expires_at`을 30일 뒤로 갱신합니다.
- 결제 취소/환불 웹훅 처리는 아직 없습니다 (11장 참고).

### 7.8 주간 리포트 배치 (⚠️ 부분 구현)
- `cron/weeklyReport.ts`가 매주 일요일 21:00 전체 학생의 출석률/학습시간을 계산하지만, 코드 주석에 명시된 대로 **저장 테이블이 없어 `console.log`로만 출력**하고 끝납니다. 실제 부모용 주간 리포트는 `ParentReportPage.tsx`가 `/api/parent/report`를 그때그때 호출해 즉석 계산하는 방식으로 동작하므로 기능 자체는 정상이지만, 이 Cron은 사실상 아무 효과가 없는 상태입니다 (11.7 참고).

### 7.9 🛡️ 슈퍼 관리자 대시보드
- 학원 내부의 민감한 출석/학생 개인정보는 RLS로 원천 차단하고, 학원 목록·가입자 통계·매출 집계만 표출합니다.
- 좌측 사이드바(`AdminLayout.tsx`)로 "개요"(`/admin`)와 "접속 로그"(`/admin/logs`)를 오갈 수 있습니다.

### 7.10 접속 로그 & 반복 로그인 실패 감지
- `LoginPage.tsx`가 `supabase.auth.signInWithPassword()` 결과(성공/실패)를 즉시 `POST /api/auth/login-log`로 보내고, 백엔드가 IP(`req.ip`)와 User-Agent를 붙여 `login_attempts`에 기록합니다.
- `AdminAccessLogsPage.tsx`(`/admin/logs`)가 최근 200건을 조회해 표로 보여주고, **같은 이메일이 최근 60분 내 3회 이상 로그인에 실패하면** 상단 배너와 해당 행에 자동으로 경고 표시를 합니다.
- 이 테이블은 RLS로 `SUPER_ADMIN`만 조회 가능하고, 쓰기는 백엔드 service role로만 이루어집니다.

---

## 8. 환경 변수 명세 (.env)

### Frontend (`frontend/.env`, `.env.example` 기준)

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=https://safestep-backend.onrender.com
VITE_NAVER_MAP_CLIENT_ID=your-naver-cloud-client-id
VITE_TOSS_CLIENT_KEY=test_ck_your_toss_client_key
VITE_VAPID_PUBLIC_KEY=your-generated-vapid-public-key
```

> `VITE_API_BASE_URL`은 `/api` 접미사 없이 오리진만 넣습니다. `lib/api.ts`가 요청 시 `/api/...` 경로를 붙입니다.

### Backend (`backend/.env`, `.env.example` 기준)

```env
PORT=5000
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
TOSS_SECRET_KEY=test_sk_your_toss_secret_key
VAPID_PUBLIC_KEY=your-generated-vapid-public-key
VAPID_PRIVATE_KEY=your-generated-vapid-private-key
VAPID_SUBJECT=mailto:admin@safestep.local
CORS_ORIGIN=https://safestep.netlify.app
FRONTEND_URL=https://safestep.netlify.app
```

> VAPID 키가 비어 있어도 백엔드는 정상 기동하며(경고 로그만 출력), Web Push만 비활성화됩니다.

---

## 9. 로컬 개발 환경 설치 및 실행

```bash
# 1) Supabase 프로젝트에 스키마 적용 (Supabase SQL Editor에서 순서대로, 각각 별도 실행)
#    supabase/schema.sql → supabase/seed.sql → (선택) supabase/seed_floorplan.sql
#    이미 schema.sql을 예전 버전으로 적용한 프로젝트라면 supabase/migration_login_attempts.sql 도 추가 실행

# 2) 백엔드
cd backend
cp .env.example .env   # 값 채우기
npm install
npm run dev             # http://localhost:5000

# 3) 프론트엔드 (새 터미널)
cd frontend
cp .env.example .env    # 값 채우기 (VITE_API_BASE_URL=http://localhost:5000)
npm install
npm run dev              # http://localhost:5173
```

- 모바일 앱 빌드: `cd frontend && npx cap sync android && npx cap open android`

### 9.1 원장/강사 데모 계정 (랜딩 페이지 "데모 체험하기" 버튼용)

랜딩 페이지 하단의 "원장 데모 체험하기" / "강사 데모 체험하기" 버튼이 로그인할 계정을 아래 스크립트로 생성합니다 (`schema.sql` + `seed.sql` 적용 후 1회 실행, 여러 번 실행해도 안전).

```bash
cd backend
node ../supabase/seed_demo_accounts.mjs
```

- `demo-admin@safestep.local` / `demo-teacher@safestep.local`, 비밀번호 둘 다 `safestepdemo`
- `SafeStep 강남점`의 `ACADEMY_ADMIN`/`TEACHER`로 연결되고, "중3 수학 데모반"(시간표 2슬롯 + 시드 학생 "홍길동" 수강 등록)이 함께 생성됩니다.
- ⚠️ 이 계정 정보는 `frontend/src/pages/LandingPage.tsx`에 그대로 하드코딩되어 있는 **공개 데모 계정**입니다. 로컬/데모 환경에서만 사용하고, 실제 회원 데이터가 있는 프로덕션 DB에는 이 방식을 쓰지 마세요.

---

## 10. 구현 현황 체크리스트

### ✅ 구현 완료
- [x] Supabase Auth 5단계 역할 + `ProtectedRoute`(슈퍼관리자도 학원 내부 차단, 강사 승인 대기, 원장 온보딩 강제 이동)
- [x] 슈퍼 관리자 대시보드(`/admin`) + 좌측 사이드바(`AdminLayout`) + 접속 로그(`/admin/logs`, 반복 로그인 실패 자동 감지)
- [x] 원장 온보딩(`/onboarding`) + 좌석 자동 생성
- [x] 학생 관리(`/students`), 반/시간표(`/classes`, `/classes/schedule`), 출석부(`/attendance`)
- [x] 원장 전용 엑셀 추출(`/dashboard` + `/api/export/*`)
- [x] 강사 승인/반려(`/teachers` + `/api/teachers/*`)
- [x] 네이버 지도 탐색(`/map`), 좌석 도면(`/seats/:id`), 익명 소음 신고
- [x] 키오스크 핀코드/QR 이중 출결 + 외출/복귀 + 60분 자동 반납 Cron
- [x] 학생 모바일 QR(`/student/qr`)
- [x] 학부모 자녀 연동, 사전 결석 신청, 주간 리포트, Web Push 알림(`/parent/report`)
- [x] 토스페이먼츠 30일 이용권 결제 + 구독 상태 동기화(`/billing`)
- [x] Capacitor Android 프로젝트 스캐폴딩

### 🟡 부분 구현 / 수동 운영
- [~] **좌석 도면 편집**: 온보딩 시 좌석 수 기준 자동 배치만 지원. 개별 좌석 위치를 세밀하게 조정하는 관리자 UI는 없고 `seed_floorplan.sql` SQL 스크립트로만 재배치 가능.
- [~] **주간 리포트 Cron**: 통계는 계산하지만 저장 테이블이 없어 서버 로그로만 출력됨 (7.8 참고). 학부모용 리포트 자체는 `/api/parent/report`의 실시간 계산으로 정상 동작.
- [~] **`TeacherPendingPage`/`UnauthorizedPage`**: 화면은 있지만 안내 문구만 있고 로그아웃/뒤로가기 등 후속 동작 버튼이 없는 최소 구현 상태.
- [~] **Netlify/Render 실배포**: 코드/설정은 준비되어 있으나 실제 배포 여부는 이 저장소만으로는 확인 불가.

### 🔎 페이지 연결(라우팅) 검증
`frontend/src/App.tsx`에 등록된 모든 라우트와 각 페이지 내 `Link`/`navigate()` 대상 전체를 대조한 결과, **깨진 링크나 존재하지 않는 경로로 이동하는 코드는 없었습니다.** `homeForRole()`(역할별 홈 라우트)도 5개 역할 전부 유효한 라우트를 반환합니다.

---

## 11. 계획된 기능 (미구현)

아래 항목들은 설계 문서/논의만 있고 **실제 코드는 아직 없습니다.** 구현 시 이 표를 체크리스트로 사용하세요.

### 11.1 📢 접이식 배너 공지사항 시스템 (Notice Banner)
- **현재 상태**: `notices` 테이블, RLS 정책, `/api/notices/*`, `CollapsibleNoticeBanner.tsx` 등 프론트/백엔드/DB 어디에도 존재하지 않음.
- **설계 개요**: 학원 원장(전체/이벤트 공지), 강사(담당 반 일정 공지)가 발행하고, 상단 헤더 아래 아코디언 배너로 노출. "오늘 하루 보지 않기"는 `localStorage` 저장.
- **구현 시 필요한 작업**:
  1. `supabase/schema.sql`에 `notice_type` ENUM + `notices` 테이블 추가 (반드시 `classes` 테이블 **이후**에 정의 — `class_id` FK 때문).
  2. `notices` 테이블 RLS: 읽기(같은 학원 소속 전체, `is_active=true`), 쓰기(원장 전체, 강사는 본인 반만) — `is_approved_staff_of()` 헬퍼 재사용 가능.
  3. 백엔드에 `noticeController`/`noticeRoutes` 또는 프론트에서 RLS를 통해 직접 `supabase-js`로 CRUD (다른 기능들과 일관되게 후자를 권장).
  4. `frontend/src/components/notice/CollapsibleNoticeBanner.tsx`, `NoticeFormModal.tsx`, `NoticeListModal.tsx` 신규 작성 후 `AppShell.tsx`에 삽입.
  5. 여러 공지가 동시에 활성화된 경우를 위한 다음/이전 네비게이션과 `is_pinned` 우선 정렬 로직 포함 (초기 설계 초안에 있던 `currentIndex` state는 변경 UI가 없어 실질적으로 항상 첫 번째 공지만 보이는 문제가 있었으므로 유의).

### 11.2 좌석 도면(Floor Plan) 관리자 편집 UI
- 원장이 좌석을 추가/삭제/드래그로 재배치할 수 있는 화면. 현재는 온보딩 시 자동 생성 또는 SQL 스크립트뿐.

### 11.3 결제 취소/환불 웹훅
- 토스페이먼츠 결제 취소 시 `subscriptions.status`/`academies.subscription_status`를 되돌리는 처리가 없음.

### 11.4 구독 만료 임박 알림
- 만료 후 비활성화 로직은 있으나(자정 Cron), 만료 D-3 같은 사전 안내 알림은 없음.

### 11.5 키오스크 기기 인증
- `/api/kiosk/*`가 완전히 공개(인증 없음) 상태. 학원별 키오스크 기기 식별/인증이 필요하면 추가 설계 필요.

### 11.6 토큰 재발급/만료 정책
- `students.qr_token`, `students.parent_view_token`, `students.link_code`에 대한 재발급이나 만료 기능이 없음 (유출 시 회수 불가).

### 11.7 주간 리포트 영속화 & 실제 발송
- `cron/weeklyReport.ts`가 계산한 출석률/학습시간을 저장할 테이블(예: `weekly_reports`)이 없어 `console.log`로만 남고 사라짐. 학부모에게 "리포트가 나왔다"는 Web Push 발송도 없음(현재는 학부모가 직접 `/parent/report`에 들어와야 확인 가능).

### 11.8 접속 로그 고도화
현재 `/admin/logs`는 "같은 이메일이 60분 내 3회 이상 실패"만 감지하는 단순 휴리스틱입니다. 아래는 아직 없음:
- 로그인 시도 자체를 막는 잠금/쓰로틀링(현재는 감지만 하고 차단하지 않음)
- 여러 이메일에 대한 분산 시도(같은 IP가 다른 계정을 순차 시도하는 크리덴셜 스터핑) 탐지
- 의심 탐지 시 관리자에게 알림(현재는 대시보드에 직접 들어와야 확인 가능)
- `login_attempts` 오래된 행 자동 정리(Cron 없음 — 계속 쌓임)

### 11.9 데모 계정 보안
- `demo-admin@safestep.local` / `demo-teacher@safestep.local` 비밀번호가 `LandingPage.tsx` 소스에 평문으로 노출되어 있음 (누구나 로그인해서 시드 데이터를 수정/삭제 가능). 로컬/데모용으로만 의도됨 — 실 서비스 배포 시 반드시 제거하거나 읽기 전용 데모 DB로 분리해야 함.
- 데모 로그인 버튼을 누르면 **현재 로그인된 세션이 데모 계정으로 즉시 교체**됩니다(로그아웃 확인 없음).

---

## 12. 변경 이력 (Changelog)

> 날짜순으로 최신이 위에 오도록 기록합니다. 새로 작업할 때마다 이 섹션에 이어서 추가해주세요.

### 2026-09-09
- **README 전면 재작성**: 실제 `frontend/`/`backend`/`supabase` 코드를 페이지·라우트·API 단위로 전부 대조 검증하고, 명세서 내용을 구현 기준으로 100% 정합화. 미구현 기능은 11장으로 분리.
  - 발견 & 문서화한 이슈: 초기 명세서의 RLS `OR true` 보안 버그(실제 코드에서는 이미 수정돼 있었음), `notices`(공지 배너) 테이블 생성 순서 버그, `absence_requests` 스키마 누락, 라우트 매트릭스 누락 항목, `weeklyReport` Cron이 로그만 찍고 저장/발송을 안 하는 점 등.
  - "5. 페이지 연결(라우팅) 검증": 전체 `Link`/`navigate()` 대상과 `App.tsx` 라우트를 대조해 깨진 링크가 없음을 확인.
- **로컬 개발 환경 세팅**: `frontend/.env`, `backend/.env` 생성 및 실제 Supabase 프로젝트(URL/anon key/service_role key) 연결. `VITE_API_BASE_URL`/`CORS_ORIGIN`을 로컬(`localhost`) 기준으로 조정.
- **DB 시드 가이드 보강**: `seed.sql`을 `seed_floorplan.sql`보다 반드시 먼저(그리고 각각 별도로) 실행해야 하는 이유와 순서를 9장에 명확히 함.
- **관리자 계정 승격**: `am2869@naver.com` 프로필을 `SUPER_ADMIN`으로 변경 (Supabase REST API로 직접 반영).
- **[신규 기능] 슈퍼 관리자 접속 로그**:
  - `login_attempts` 테이블 추가 (`supabase/migration_login_attempts.sql`, `schema.sql`에도 반영) — 로그인 성공/실패, IP, User-Agent 기록. RLS로 `SUPER_ADMIN`만 조회 가능.
  - 백엔드 `POST /api/auth/login-log` 추가, `LoginPage.tsx`가 로그인 시도 직후 호출.
  - 프론트 `AdminLayout.tsx`(좌측 사이드바: 개요/접속 로그) + `AdminAccessLogsPage.tsx`(`/admin/logs`) 신규 — 같은 이메일이 60분 내 3회 이상 로그인 실패하면 자동 경고 표시.
- 랜딩 페이지에 폰 목업 iframe 데모 섹션을 시도했다가, 사이트 전체가 모바일 모드로 고정되는 부작용이 있어 되돌림 (`LandingPage.tsx`, `lib/platform.ts` 모두 원상복구).
- **[신규] 랜딩 페이지 푸터에 데모 링크 추가**: iframe 임베드 대신, 클릭하면 실제 페이지로 이동하는 단순 링크(`이용자 데모 보기` → `/map`, `키오스크 데모 보기` → `/kiosk`)로 교체 (`LandingPage.tsx`).
- **`lib/platform.ts` 모바일 미리보기 로직 재설계**: `localStorage`에 상태를 남기지 않고 매 요청마다 URL의 `?app=` 파라미터만으로 판단하도록 변경. `?app` 파라미터가 없으면 항상 웹(데스크톱), `?app=0` 또는 `?app=1`이면 모바일 미리보기. 예전처럼 한번 모바일 모드로 들어가면 계속 고정되는 문제가 구조적으로 사라짐.
- **[신규] 원장/강사 데모 체험하기**: 로그인 없이 원장·강사 화면을 둘러볼 수 있도록 데모 전용 계정(`demo-admin@safestep.local`, `demo-teacher@safestep.local`)과 데모 반("중3 수학 데모반")을 생성하고, 랜딩 페이지에 원클릭 로그인 버튼 추가. 재현용 스크립트 `supabase/seed_demo_accounts.mjs` 신규 (9.1 참고).
- **랜딩 페이지 데모 진입점 정리**: 사장님용 섹션 버튼 + 푸터 링크로 흩어져 있던 데모 4종(이용자/키오스크/원장/강사)을 히어로 로고 바로 아래 한 줄(4열)로 통합, 라벨과 안내 문구도 한 줄에 맞게 축약 (`LandingPage.tsx`).
- **버그 수정 — 원장 대시보드 월별 출석부 조회 에러**: `GET /api/export/attendance?month=`가 "이번 달 끝"을 `${month}-32`(예: `2026-09-32`) 같은 존재하지 않는 날짜 문자열로 만들어 비교했는데, PostgreSQL이 이를 유효하지 않은 date로 거부해 `date/time field value out of range` 에러가 났음(원장 데모 계정으로 `/dashboard` 접속 시 실제로 발생 확인). `Date.UTC()`로 "다음 달 1일"을 정확히 계산하도록 수정 (`backend/src/routes/export.ts`).
