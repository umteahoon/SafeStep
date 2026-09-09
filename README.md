# 📋 SafeStep (네이버 지도 스터디카페 좌석 관제, 학원 강사 승인/스마트 출결 & SaaS 플랫폼) 종합 개발 명세서

## 1. 프로젝트 개요

- **서비스명**: SafeStep (세이프스텝)
- **목적**:
  1. **스터디카페 관제 모드**: 네이버 지도 기반 주변 탐색, 실시간 좌석/도면 확인, 키패드/QR 키오스크 입·퇴실 좌석 배정 및 **외출/자리비움(60분 타임아웃)**, **익명 소음/좌석독점 신고 벨**, 누적 공부 시간 통계.
  2. **학원 출결 및 수업 관리 모드 (B2B SaaS)**: 토스페이먼츠 월 10,000원 이용권 결제 시 활성화.
     - **원장 전용 학원 데이터 일괄 내보내기**: 원장은 본인이 운영하는 학원의 출석부, 학생 명단, 수업 이력, 이용 통계를 **엑셀(Excel) 및 CSV로 즉시 다운로드/추출** 가능.
     - **원장 & 강사 협업 워크플로우**: 강사는 회원가입 후 학원 원장의 승인을 받아 출석부 및 수업 일정을 위임받아 실무 관리.
     - **수업(Class) & 시간표 관리**: 반(클래스) 생성, 담당 강사 지정, 요일/시간별 수업 일정 등록.
     - **스마트 출석부 & 결석 사유 관리**: 반별 수강생 배정, 원클릭 출석/결석/지각 체크, 결석 사유(병결/공결/무단) 및 특이사항 메모.
     - **학부모 사전 결석/지각 신청**: 학부모가 앱에서 사전에 사유를 제출하면 선생님 출석부에 '사전 승인' 상태로 선반영.
     - **스마트 알림 정책**: 정상 출석 시 무음(비용/피로도 0), **결석 체크 시에만 학부모에게 긴급 안심 알림(Web Push/가상 시뮬레이터) 즉시 발송**.
     - **학부모 온보딩 & 주간 리포트**: 자녀 전용 6자리 연동 코드(`link_code`), 주간 출석률 및 총 누적 공부 시간 요약 리포트 제공.
- **5단계 권한 체계 & 🔒 엄격한 개인정보/데이터 분리 정책 (Strict Privacy RBAC)**:
  1. **슈퍼 관리자 (`SUPER_ADMIN`) - 플랫폼 운영 관제 전용 (개인정보 열람 불가)**:
     - **금지 구역**: 학원 내부 수업 목록, 출석부 내역, 학생 이름 및 개인 식별 데이터는 **절대 열람 불가 (DB RLS 및 프론트 차단)**.
     - **허용 구역**: 서비스 전체 가입자 수(학원 수, 학부모 수, 학생 수 카운트), 입점 학원/스터디카페 가맹 정보, 토스 월간 매출 통계, 시스템 작동 상태 모니터링만 전담.
  2. **학원 원장 (`ACADEMY_ADMIN`) - 학원 독립 오너**:
     - 원장 전용 대시보드, 강사 가입 승인/반려, 토스 결제(월 10,000원), 좌석 도면 세팅, 전체 출석부 관리.
     - **🌟 자사 데이터 추출(Export)**: 본인 학원의 학생 명부, 월간 출석부, 수업 통계 엑셀 다운로드(`xlsx`). (타 학원 데이터 및 슈퍼관리자 페이지 접근 차단)
  3. **학원 강사 (`TEACHER`)**:
     - 원장 승인 후 활성화. 배정된 반의 시간표 등록, 출석부 작성 및 결석 알림 발송. (결제/원장 고유 설정 및 타 학원 데이터 차단)
  4. **학생 (`STUDENT`)**:
     - 네이버 지도 탐색, 실시간 잔여석 확인, 개인 모바일 QR 출결 코드, 본인 시간표 및 공부시간 이력 조회, 스터디카페 소음/불편 신고. (출석부 수정 및 관리자 페이지 접근 차단)
  5. **학부모 (`PARENT`)**:
     - 6자리 코드로 자녀 연동, 사전 결석 신청, 결석 긴급 푸시 알림 수신, 전용 웹 뷰어로 자녀 출결 및 주간 리포트 확인. (타 학생 및 학원 운영 화면 접근 차단)
- **배포 및 인프라 (전액 0원 무료)**:
  - Web: Netlify (Free)
  - Backend API: Render Web Service (Free)
  - Database & Auth: Supabase (PostgreSQL, Realtime, RLS, Free)
  - Map API: Naver Cloud Platform Web Dynamic Map (월 1,000만 건 무료)
  - Payment: 토스페이먼츠 결제 위젯 (30일 월 이용권 갱신 방식, 테스트 환경 0원 연동)
  - Mobile App: Capacitor 6+ -> Android Studio APK 빌드

---

## 2. 기술 스택 (Tech Stack)

### Frontend & Mobile App (Single Codebase)

- **Framework / Build**: React 18+, Vite, TypeScript
- **Styling**: Tailwind CSS, Lucide React (아이콘)
- **Data Export & Processing**: `xlsx` (원장 전용 학원 데이터 엑셀 추출 및 대량 등록), `file-saver`
- **QR Scanner / Generator**: `html5-qrcode` (태블릿 카메라 QR 스캔), `qrcode.react` (학생 모바일 QR 생성)
- **Calendar / Schedule UI**: 주간 타임테이블 UI 컴포넌트, `date-fns`
- **Map SDK**: Naver Maps JavaScript API v3 (NCP Web Dynamic Map)
- **Payment SDK**: `@tosspayments/payment-widget-sdk` (토스 결제위젯)
- **Mobile Hybrid**: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- **PWA & Web Push**: Service Worker (`sw.js`), Web Push API
- **State & Data**: TanStack Query v5, Zustand, `@supabase/supabase-js`

### Backend

- **Runtime / Framework**: Node.js (v20+), Express, TypeScript
- **Push Notification (0원)**: `web-push` (VAPID 기반 무제한 무료 웹 푸시)
- **Payment API**: TossPayments Server API (승인 `POST /v1/payments/confirm`)
- **Cron (`node-cron`)**:
  - 매 10분: 스터디카페 외출(`AWAY`) 후 60분 초과 좌석 자동 강제 퇴실 및 반납
  - 매주 일요일 21:00: 학부모 주간 학습 리포트 데이터 집계
  - 자정: 미퇴실자 자동 정리 및 30일 이용권 만료 학원 비활성화
- **Deployment**: Render (무료 티어 Cold Start 대응 핑 적용)

---

## 3. 디렉토리 구조 (Repository Layout)

```text
safestep/
├── DEVELOPMENT.md
├── README.md
├── frontend/
│   ├── android/               # Capacitor 생성 Android Studio 프로젝트
│   ├── public/
│   │   ├── sw.js              # 결석 긴급 알림 푸시 Service Worker
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/        # Button, Modal, Input, Badge, ProtectedRoute, BranchSelector
│   │   │   ├── export/        # 🌟 원장 전용 학원 데이터 추출 버튼(ExportDataModal.tsx)
│   │   │   ├── map/           # 네이버 지도, 실시간 잔여석 마커
│   │   │   ├── seat/          # 스터디카페 내부 도면(Floor Plan Grid), 소음 신고 모달
│   │   │   ├── kiosk/         # 키패드, 카메라 QR 스캐너, 외출/복귀 모달
│   │   │   ├── teachers/      # 원장용 강사 승인/반려/목록 관리 모달
│   │   │   ├── classes/       # 반 생성, 주간 시간표, 담당 강사 지정
│   │   │   ├── attendance/    # 반별 출석부, 학부모 사전 결석 승인 탭
│   │   │   ├── parent/        # 자녀 연동(6자리 코드), 사전 결석 신청서, 주간 리포트
│   │   │   ├── payment/       # 토스 결제위젯 컴포넌트
│   │   │   ├── admin/         # [시연용] 가상 데모 데이터 1초 생성기 버튼
│   │   │   └── simulator/     # [시연용] 가상 카카오톡 결석 알림 모달
│   │   ├── pages/
│   │   │   ├── auth/          # LoginPage.tsx, RegisterPage.tsx, TeacherPendingPage.tsx, UnauthorizedPage.tsx
│   │   │   ├── map/           # MapSearchPage.tsx (네이버 지도 탐색)
│   │   │   ├── kiosk/         # KioskPage.tsx (태블릿 키패드 + QR 스캔 + 외출)
│   │   │   ├── dashboard/     # 원장 대시보드 (학원 데이터 엑셀 내보내기 버튼 탑재)
│   │   │   ├── teachers/      # TeacherManagementPage.tsx (원장 전용 강사 승인 관리)
│   │   │   ├── classes/       # ClassListPage.tsx, ClassSchedulePage.tsx
│   │   │   ├── attendance/    # ClassAttendancePage.tsx (반별 출석부)
│   │   │   ├── billing/       # SubscriptionPage.tsx (토스 30일 이용권 결제)
│   │   │   ├── admin/         # SuperAdminDashboardPage.tsx (🔒 입점 학원/가입자 통계/매출만 표출)
│   │   │   ├── student/       # StudentQrPage.tsx (학생 모바일 출결 QR)
│   │   │   └── parent/        # ParentReportPage.tsx (학부모 안심 리포트 & 사전 결석 신청)
│   │   ├── utils/             # excelExporter.ts (원장 전용 엑셀 추출 유틸)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── capacitor.config.ts
│   └── vite.config.ts
│
└── backend/
    ├── src/
    │   ├── controllers/       # auth, teacher, class, attendance, payment, report, exportController
    │   ├── cron/              # autoCheckout.ts, awayTimeout.ts, weeklyReport.ts
    │   ├── routes/            # teacher, class, attendance, payment, parent, exportRoutes
    │   ├── services/          # PushService, TossPaymentService, ExportService
    │   └── index.ts
    └── package.json
```

---

## 4. 데이터베이스 스키마 & RLS 보안 정책 (슈퍼관리자 조회 차단)

### 4.1 핵심 테이블 설계

```sql
-- 1. 사용자 역할 열거형
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT');

-- 2. 강사 승인 상태 열거형
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 3. 학원/스터디카페 지점 테이블 (슈퍼관리자 열람 가능)
CREATE TABLE academies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    total_seats INT DEFAULT 30,
    subscription_status VARCHAR(20) DEFAULT 'TRIAL', -- 'TRIAL', 'ACTIVE', 'EXPIRED'
    subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 통합 프로필 테이블 (슈퍼관리자는 시스템 사용자 통계 수량 및 기본 메타데이터만 열람)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
    approval_status approval_status DEFAULT 'APPROVED',
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 토스 30일 이용권 결제 이력 (슈퍼관리자 매출 집계 열람 가능)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    payment_key VARCHAR(100),
    order_id VARCHAR(100) NOT NULL UNIQUE,
    amount INT NOT NULL DEFAULT 10000,
    status VARCHAR(20) NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 🔒 반/수업(Class) 테이블 (슈퍼관리자 열람 불가)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    color_code VARCHAR(10) DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 🔒 반별 수업 일정(시간표) 테이블 (슈퍼관리자 열람 불가)
CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 🔒 학생 테이블 (슈퍼관리자 열람 불가, 원장/소속 강사/학부모만 접근)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    attendance_code VARCHAR(10) NOT NULL,
    qr_token UUID DEFAULT gen_random_uuid(),
    parent_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    parent_phone VARCHAR(20) NOT NULL,
    link_code VARCHAR(6) NOT NULL DEFAULT LPAD(FLOOR(RANDOM()*1000000)::TEXT, 6, '0'),
    parent_view_token UUID DEFAULT gen_random_uuid(),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_academy_attendance_code UNIQUE(academy_id, attendance_code)
);

-- 9. 🔒 반별 수강생 배정 테이블 (슈퍼관리자 열람 불가)
CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_class_student UNIQUE(class_id, student_id)
);

-- 10. 🔒 반별 일일 출석부 테이블 (슈퍼관리자 열람 불가)
CREATE TABLE class_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(100),
    note TEXT,
    alert_sent BOOLEAN DEFAULT FALSE,
    recorded_by UUID REFERENCES profiles(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_class_attendance UNIQUE(class_id, student_id, date)
);

-- 11. 스터디카페 좌석 테이블 (공개)
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    zone_type VARCHAR(20) DEFAULT 'FOCUS',
    grid_x INT NOT NULL,
    grid_y INT NOT NULL,
    status VARCHAR(20) DEFAULT 'EMPTY',
    current_student_id UUID,
    occupied_at TIMESTAMPTZ,
    away_at TIMESTAMPTZ,
    CONSTRAINT unique_seat_per_academy UNIQUE(academy_id, seat_number)
);

-- 12. 키오스크 출결 로그 (학생 본인/원장/학부모만 접근)
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    seat_number INT,
    type VARCHAR(20) NOT NULL,
    check_method VARCHAR(10) DEFAULT 'KEYPAD',
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    stay_duration_minutes INT DEFAULT 0,
    notification_status VARCHAR(20) DEFAULT 'PENDING'
);

-- 13. 학부모 Web Push 구독 정보
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_endpoint UNIQUE(student_id, endpoint)
);
```

### 4.2 RLS 보안 정책 (슈퍼관리자의 학원 내부 데이터 접근 원천 차단)

```sql
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1) 슈퍼 관리자: 학원 목록, 가입 통계(카운트), 결제 매출만 접근 허용
CREATE POLICY "SuperAdmin Academies Policy" ON academies
    FOR ALL TO authenticated
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN' OR true);

CREATE POLICY "SuperAdmin Subscriptions Policy" ON subscriptions
    FOR ALL TO authenticated
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR academy_id IN (SELECT academy_id FROM profiles WHERE id = auth.uid() AND role = 'ACADEMY_ADMIN'));

-- 2) 🔒 수업(classes): 슈퍼관리자 차단! 오직 해당 학원 원장 및 승인 강사만 접근 허용
CREATE POLICY "Classes Strict Academy Access" ON classes
    FOR ALL TO authenticated
    USING (
        academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'ACADEMY_ADMIN'
        )
        OR academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'TEACHER' AND approval_status = 'APPROVED'
        )
    );

-- 3) 🔒 출석부(class_attendance_records): 슈퍼관리자 차단! 원장 및 승인 강사만 접근
CREATE POLICY "Attendance Records Strict Access" ON class_attendance_records
    FOR ALL TO authenticated
    USING (
        academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'ACADEMY_ADMIN'
        )
        OR academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'TEACHER' AND approval_status = 'APPROVED'
        )
    );

-- 4) 🔒 학생 정보(students): 슈퍼관리자 차단! 원장, 승인 강사, 본인, 부모만 접근
CREATE POLICY "Students Strict Access" ON students
    FOR ALL TO authenticated
    USING (
        academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'ACADEMY_ADMIN'
        )
        OR academy_id IN (
            SELECT academy_id FROM profiles
            WHERE id = auth.uid() AND role = 'TEACHER' AND approval_status = 'APPROVED'
        )
        OR parent_user_id = auth.uid()
        OR user_id = auth.uid()
    );

-- 5) 네이버 지도 및 좌석 도면 (공개 읽기)
CREATE POLICY "Public Read Academies" ON academies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Read Seats" ON seats FOR SELECT TO anon, authenticated USING (true);
```

---

## 5. 프론트엔드 라우팅 및 역할별 엄격한 접근 제어 (ProtectedRoute)

### 5.1 라우트 권한 매트릭스

| 라우트 경로      | 페이지 설명                                        | SUPER_ADMIN | ACADEMY_ADMIN |    TEACHER     | STUDENT | PARENT |
| :--------------- | :------------------------------------------------- | :---------: | :-----------: | :------------: | :-----: | :----: |
| `/admin`         | 플랫폼 관제 (가맹 학원, 전체 이용자 수 통계, 매출) |    **O**    |       X       |       X        |    X    |   X    |
| `/dashboard`     | 원장 대시보드 (원생 엑셀 추출, 강사 승인)          |  X (차단)   |     **O**     |       X        |    X    |   X    |
| `/classes`       | 반 개설 & 주간 시간표 관리                         |  X (차단)   |     **O**     | **O (승인시)** |    X    |   X    |
| `/attendance`    | 반별 원클릭 출석부 (결석 알림)                     |  X (차단)   |     **O**     | **O (승인시)** |    X    |   X    |
| `/billing`       | 토스 30일 이용권 구독 결제                         |  X (차단)   |     **O**     |       X        |    X    |   X    |
| `/map`           | 네이버 지도 주변 스터디카페 탐색                   |    **O**    |     **O**     |     **O**      |  **O**  | **O**  |
| `/seats/:id`     | 매장 내부 도면 & 잔여석 확인                       |    **O**    |     **O**     |     **O**      |  **O**  | **O**  |
| `/kiosk`         | 태블릿 키패드/QR 출결 화면                         |    **O**    |     **O**     |     **O**      |  **O**  | **O**  |
| `/student/qr`    | 학생 개인 모바일 QR 출결 코드                      |      X      |       X       |       X        |  **O**  |   X    |
| `/parent/report` | 학부모 안심 출결 리포트 & 사전 결석                |      X      |       X       |       X        |    X    | **O**  |

### 5.2 React `ProtectedRoute.tsx` 구현 가이드

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { UserRole } from "../../types";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">인증 확인 중...</div>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  // 🔒 엄격한 권한 체크: 허용된 역할이 아니면 무조건 차단 (슈퍼관리자도 학원 내부 페이지 진입 불가)
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 강사의 경우 승인(APPROVED) 상태 체크
  if (profile.role === "TEACHER" && profile.approval_status !== "APPROVED") {
    return <Navigate to="/teacher/pending" replace />;
  }

  return <Outlet />;
};
```

---

## 6. 핵심 비즈니스 로직

### 6.1 📊 원장 전용 자사 데이터 엑셀/CSV 추출 기능 (`ExportDataModal.tsx`)

- **목적**: 학원 원장이 본인이 운영하는 학원의 원생 및 출결 데이터를 자유롭게 소유/백업할 수 있도록 보장.
- **추출 항목**:
  1. **원생 명부 (`students_list.xlsx`)**: 학생명, 출결 핀코드, 학부모 연락처, 소속 반, 등록일.
  2. **월간 출석부 (`monthly_attendance.xlsx`)**: 선택한 월의 일자별 출석/결석/지각 현황 및 결석 사유/메모.
  3. **스터디카페 이용 내역 (`study_session_logs.xlsx`)**: 입·퇴실 일시, 이용 좌석, 총 체류 시간.
- **구현 유틸 (`excelExporter.ts`)**:
  - `xlsx` 라이브러리를 통해 브라우저에서 즉시 Excel 워크북 생성 및 자동 다운로드 트리거.

### 6.2 🛡️ 슈퍼 관리자 전용 대시보드 (`/admin`)

- 학원 내부의 민감한 출석/학생 개인정보는 일체 배제하고, **순수 시스템 운영 데이터만 표출**:
  - **입점 학원 및 스터디카페 현황**: 학원명, 지점 주소, 이용권 상태(`ACTIVE`/`TRIAL`), 가입일.
  - **플랫폼 전체 이용자 통계**: 활성 학원 수, 등록된 전체 강사 수, 전체 학생 수, 전체 학부모 수 (집계 수치 카운트만 표시).
  - **토스페이먼츠 월 매출 현황**: 이번 달 총 결제 금액, 월별 매출 그래프, 결제 성공/실패 로그.

### 6.3 QR 코드 및 키패드 이중 출결 모드

1. **핀코드 모드**: 4~6자리 번호 입력 후 입·퇴실/외출 처리.
2. **모바일 QR 스캔 모드 (`html5-qrcode`)**:
   - 학생 앱 `[내 출결 QR]`을 키오스크 태블릿 전면 카메라에 비추면 `verify_kiosk_qr` RPC 호출 -> 0.5초 만에 출결 완료.

### 6.4 학부모 사전 결석 신청 & 출석부 연동

1. 학부모가 앱에서 **`[사전 결석/지각 신청]`** 제출 (`absence_requests` 테이블).
2. 선생님 출석부 화면에 `[사전 병결 신청]` 뱃지 표출 -> 원클릭 승인 시 출석부에 사유 자동 반영.

### 6.5 스터디카페 외출(자리비움) & 익명 소음 신고

1. **외출(AWAY) 모드**: 키오스크에서 `[외출]` 클릭 -> 60분 초과 시 Cron(`awayTimeout.ts`)이 자동 퇴실 처리.
2. **익명 소음 신고**: 모바일 좌석 도면에서 특정 좌석 신고 -> 원장 대시보드 알림 팝업.

---

## 7. 환경 변수 명세 (.env)

### Frontend (`frontend/.env`)

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=https://safestep-backend.onrender.com/api
VITE_NAVER_MAP_CLIENT_ID=your-naver-cloud-client-id
VITE_TOSS_CLIENT_KEY=test_ck_your_toss_client_key
VITE_VAPID_PUBLIC_KEY=your-generated-vapid-public-key
```

### Backend (`backend/.env`)

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

---

## 8. 단계별 작업 지시 가이드 (Claude Code Prompting)

### Phase 1: 역할별 엄격한 ProtectedRoute & 슈퍼 관리자 플랫폼 관제

- [ ] Supabase Auth 5단계 역할(`SUPER_ADMIN`, `ACADEMY_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`) 구현
- [ ] `ProtectedRoute.tsx`: 슈퍼 관리자도 학원 내부 페이지 진입을 엄격히 차단하도록 구현
- [ ] 슈퍼 관리자 전용 대시보드(`/admin`): 가맹 학원 목록, 가입자 카운트 통계, 토스 결제 매출만 표출

### Phase 2: 원장 전용 학원 데이터 엑셀 추출(Export) & 수업 관리

- [ ] 원장 대시보드 내 원생 명부 및 월간 출석부 엑셀 추출 기능(`excelExporter.ts`) 구현
- [ ] 반(Class) CRUD 및 주간 시간표 UI(`WeeklyTimetable.tsx`) 작성
- [ ] 학부모 `사전 결석/지각 신청 모달` 및 일일 출석부 연동

### Phase 3: 네이버 지도 스터디카페 좌석 관제, 외출 & 소음 신고

- [ ] Naver Maps API 연동 및 매장 내부 좌석 도면(Grid) 렌더링
- [ ] 키오스크 핀코드 + 모바일 QR 출결(`html5-qrcode`) 이중화 구현
- [ ] 키오스크 `외출 / 자리비움(AWAY)` 및 60분 타임아웃 Cron(`awayTimeout.ts`) 작성

### Phase 4: 토스페이먼츠 30일 이용권 결제 & 다중 지점 전환 UI

- [ ] 토스 결제위젯 연동 (월 10,000원 이용권) 및 백엔드 승인 API (`POST /api/payments/confirm`)
- [ ] 상단 `BranchSelector` 컴포넌트(복수 학원/카페 전환) 구현

### Phase 5: Capacitor APK 빌드 및 프로덕션 배포

- [ ] Capacitor 6+ Android Studio 연동 및 태블릿/스마트폰용 APK 빌드
- [ ] Netlify(프론트) 및 Render(백엔드) 무료 티어 배포 및 시연 리허설
