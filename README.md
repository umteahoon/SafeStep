# SafeStep

네이버 지도 스터디카페 좌석 관제 + 학원 강사 승인/스마트 출결 SaaS 플랫폼.

## 폴더 구조

```
safestep/
├── frontend/    React + Vite + TypeScript + Capacitor (웹 + 안드로이드 앱 단일 코드베이스)
├── backend/     Express + TypeScript API 서버
└── supabase/
    └── schema.sql   전체 DB 스키마 + RLS 정책 (원본 명세서의 RLS 버그 수정 포함)
```

현재 구현 상태: **Phase 1~4 전 범위**가 실제 동작 코드로 연결됨.
- Phase 1 인증/RBAC, Phase 3 지도/좌석/키오스크 (기존)
- Phase 2 학원 운영 UI: 원장 대시보드+엑셀 추출, 강사 승인/반려, 반·수강생 CRUD,
  주간 시간표, 반별 원클릭 출석부(결석/지각 시 보호자 Web Push)
- Phase 5 학부모: 6자리 코드 자녀 연동, 주간 리포트, 사전 결석/지각 신청, Web Push 구독
- Phase 4 결제: 토스 결제위젯 연동 + 승인/이용권 갱신
- 학생 QR 발급 화면, 플랫폼 관리자(매출 집계) 대시보드

### 웹 / 앱 화면 분기
- **웹 브라우저**: `/` 접속 시 마케팅 랜딩 페이지(`pages/LandingPage.tsx`). 지도·좌석·키오스크는 로그인 없이 열람 가능.
- **네이티브 앱(Capacitor)**: `lib/platform.ts`의 `isNativeApp`으로 감지해 `/`에서 바로 지도(`/map`)로 진입.
- 로그인 후에는 역할별 홈으로 이동(`homeForRole`): 원장→`/dashboard`, 강사→`/attendance`, 학부모→`/parent/report`, 학생→`/student/qr`, 슈퍼관리자→`/admin`.

### Phase 3 상세 구현 내용
- `pages/map/MapSearchPage.tsx` — 네이버 지도에 학원/카페 마커 표시, 실시간 잔여석 카운트(Supabase Realtime), 클릭 시 좌석 도면으로 이동
- `pages/seats/SeatFloorPlanPage.tsx` + `components/seat/FloorPlanGrid.tsx` — 좌석 그리드를 Realtime으로 구독해 입/퇴실·외출 상태 즉시 반영, 좌석 클릭 시 익명 소음/독점 신고 모달
- `pages/kiosk/KioskPage.tsx` — 핀코드 키패드 + QR 스캔(`html5-qrcode`) 이중 인증, 인증 후 상태에 따라 [빈좌석 선택 → 입실] / [외출·퇴실] / [복귀·퇴실] 버튼 자동 분기
- `backend/src/routes/kiosk.ts` — 키오스크 태블릿은 로그인 세션이 없으므로 `SUPABASE_SERVICE_ROLE_KEY`로 RLS를 우회하는 전용 API로 처리 (좌석 동시 배정 방지를 위해 `status='EMPTY'` 조건부 업데이트 사용)

키오스크 페이지 접속 시 `/kiosk?academy=<academy_id>` 형태로 지점을 지정하거나,
academy 파라미터 없이 접속하면 지점 선택 화면이 먼저 뜹니다.
실제 키오스크 태블릿에는 URL을 지점별로 고정해서 즐겨찾기/바탕화면에 등록하는 것을 권장합니다.


---

## 1. Supabase 프로젝트 설정

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성 (무료 플랜)
2. 좌측 메뉴 **SQL Editor** → `supabase/schema.sql` 파일 내용 전체 복사 후 실행
3. (선택) 테스트 데이터를 바로 넣고 싶다면 `supabase/seed.sql`도 이어서 실행
   — 샘플 학원 2곳, 좌석, 테스트용 학생(핀코드 `111111`)이 생성됩니다.
3. **Project Settings → API** 에서 다음 값을 확인:
   - `Project URL` → `VITE_SUPABASE_URL`, `SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 프론트엔드에 노출 금지, 백엔드 `.env`에만 사용)
4. 첫 슈퍼 관리자 계정은 회원가입 화면에서 만들 수 없습니다(의도된 설계).
   Supabase Dashboard → Table Editor → `profiles` 테이블에서 가입된 계정의
   `role` 값을 수동으로 `SUPER_ADMIN`으로 바꿔주세요.

---

## 2. 로컬 실행 (Frontend)

```bash
cd frontend
npm install
cp .env.example .env   # 값 채우기
npm run dev             # http://localhost:5173
```

## 3. 로컬 실행 (Backend)

```bash
cd backend
npm install
cp .env.example .env   # 값 채우기
npm run dev             # http://localhost:5000
```

VAPID 키(Web Push용)는 아래 명령으로 생성할 수 있습니다:
```bash
npx web-push generate-vapid-keys
```

토스페이먼츠 테스트 키는 [토스페이먼츠 개발자센터](https://developers.tosspayments.com)에서
"테스트 상점"을 생성하면 무료로 발급됩니다 (`test_ck_...`, `test_sk_...`).

---

## 4. 안드로이드 앱(APK) 빌드 — Capacitor

핵심 원칙: **frontend 웹 코드를 수정 → 빌드 → 앱에 동기화**, 이 3단계만 반복하면 됩니다.

```bash
cd frontend
npm run build          # dist/ 생성
npx cap sync android    # dist/ 내용을 android 네이티브 프로젝트로 복사
npx cap open android    # Android Studio 실행
```

Android Studio가 열리면:
1. 상단 메뉴 **Build → Generate Signed Bundle / APK**
2. 테스트용이면 그냥 **Build → Build APK(s)** (디버그 서명)로 충분
3. `android/app/build/outputs/apk/debug/app-debug.apk` 생성됨 → 태블릿/폰에 설치

카메라(QR 스캔)·푸시 알림 권한은 이미 아래 플러그인이 설치되어 있습니다:
`@capacitor/camera`, `@capacitor/push-notifications`
(단, 실제 권한 요청 코드는 각 화면 구현 시 추가해야 합니다.)

> Android SDK/Android Studio는 로컬 PC에 설치되어 있어야 합니다.
> (Android Studio 설치 시 SDK가 함께 설치됩니다.)

---

## 5. 배포

### Frontend → Netlify (무료)
1. GitHub에 이 저장소 push
2. Netlify → **Add new site → Import from Git**
3. Base directory: `frontend`, Build command: `npm run build`, Publish directory: `frontend/dist`
4. 환경변수(Site settings → Environment variables)에 `.env.example`의 `VITE_*` 값 등록

### Backend → Render (무료 티어)
1. Render → **New → Web Service** → 이 저장소 연결
2. Root Directory: `backend`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. 환경변수(Environment)에 `.env.example`의 값 등록
6. 무료 티어는 15분 미사용 시 슬립되므로, [UptimeRobot](https://uptimerobot.com) 등으로
   `/health` 엔드포인트를 주기적으로 핑하면 Cold Start를 줄일 수 있습니다.

### 네이버 지도 API
[Naver Cloud Platform](https://www.ncloud.com) → Application → Maps 서비스 신청 후
`VITE_NAVER_MAP_CLIENT_ID` 발급. Web Dynamic Map은 월 1,000만 건까지 무료입니다.

---

## 6. 다음 개발 순서 제안

1. ~~`MapSearchPage.tsx` / 좌석 도면 / 키오스크~~ — 완료
2. ~~`DashboardPage.tsx` — 원장 대시보드 + 엑셀 추출(`utils/excelExporter.ts`)~~ — 완료
3. ~~`TeacherManagementPage.tsx` — 강사 승인/반려 UI~~ — 완료
4. ~~`pages/classes/`, `attendance/` — 반 CRUD, 주간 시간표, 반별 출석부~~ — 완료
5. ~~`ParentReportPage.tsx` — 자녀 연동, 사전 결석 신청, 주간 리포트, Web Push 구독~~ — 완료
   (백엔드 `backend/src/routes/parent.ts` 추가: `/link`, `/children`, `/push-subscribe`, `/report`)
6. ~~`SubscriptionPage.tsx` — 토스 결제위젯 연동~~ — 완료
7. ~~좌석/학원 시드 스크립트~~ — `supabase/seed.sql` 로 완료
8. Capacitor APK 최종 빌드 및 실기기 테스트 (카메라 권한 요청 코드 추가 필요 — QrScanner는 브라우저 getUserMedia 권한 프롬프트에 의존 중)

### 원장 온보딩 / 학생·학원 관리 (완료)
- 원장 가입 → `/onboarding`(`pages/onboarding/OnboardingPage.tsx`)에서 학원 생성 → 좌석 자동 생성 → 프로필에 `academy_id` 연결.
  백엔드 `backend/src/routes/academy.ts`: `POST /onboard`(존별 좌석 자동 배치), `GET /` (내 학원).
  `ProtectedRoute`가 학원 없는 원장을 자동으로 온보딩 화면으로 보냄.
- 학생 관리 `/students`(`pages/students/StudentManagementPage.tsx`) — 학생 추가/중지/삭제, 출결코드·보호자 연동코드 발급 (원장·강사).
- 슈퍼관리자 대시보드에 학원 추가 폼.

### 남은 작업 / 참고
- 학생 회원가입 프로필과 `students.user_id` 연결 UI는 아직 없음 (학부모는 `link_code` 6자리로 연동 가능).
- Web Push는 `frontend/public/sw.js` 서비스워커 + `VITE_VAPID_PUBLIC_KEY` 필요.
- 토스 결제위젯은 `VITE_TOSS_CLIENT_KEY`(프론트) / `TOSS_SECRET_KEY`(백엔드) 필요.
  성공/실패 리다이렉트 URL은 `/billing` 로 고정되어 쿼리 파라미터로 승인 처리.
