# SafeStep

네이버 지도 스터디카페 좌석 관제 + 학원 강사 승인/스마트 출결 SaaS 플랫폼.

## 폴더 구조

```
safestep/
├── frontend/    React + Vite + TypeScript + Capacitor (웹 + 안드로이드 앱 단일 코드베이스)
├── backend/     Express + TypeScript API 서버
└── supabase/
    ├── schema.sql                              전체 DB 스키마 + RLS 정책 (신규 프로젝트용)
    ├── migration_02_owner_invites_seat_admin.sql  기존 프로젝트 추가 마이그레이션 (아래 §1 참고)
    ├── seed.sql                                샘플 학원 2곳
    └── seed_floorplan.sql                      존별 좌석 배치 샘플
```

> ⚠️ 아래 체크리스트는 이 저장소에 **실제로 존재하는 코드 기준**입니다.
> 다른 곳에서 작성된 기획 문서를 참고할 때는 이 표와 대조해서 실제 구현 여부를 확인하세요.

## 구현 현황 체크리스트

### ✅ 완료
| 영역 | 내용 |
|---|---|
| 인증/RBAC | 회원가입(역할별 분기, 이메일 인증 없이 즉시 로그인) · 로그인 · 강사 승인 대기 · 슈퍼관리자 수동 승격 |
| 학원 온보딩 | 슈퍼관리자가 `/admin`에서 지점 생성 → 좌석 자동 배치 + **8자리 등록 코드** 발급 → 원장이 `/owner/claim`에서 코드 입력해 연결 |
| 지도/좌석/키오스크 | 네이버 지도 실시간 잔여석, 존별 좌석 도면(Realtime), 핀코드/QR 키오스크(입실·외출·복귀·퇴실·**자리 이동**) |
| 키오스크 운영 | 60초 무조작 시 자동 초기화, **오프라인 큐잉**(외출/퇴실/복귀는 재연결 시 자동 재전송, 입실/이동은 동시성 문제로 오프라인 중 차단) |
| 원장 대시보드 | 학생 수·출석률·결석/지각·학습시간 KPI, 학생 목록, 엑셀 추출(`utils/excelExporter.ts`) |
| 학생 관리 | 원장/강사가 학생 추가·중지·삭제, 출결코드·보호자 연동코드 발급 |
| 강사 관리 | 승인/반려 UI |
| 반/시간표/출결 | 반 생성·삭제·강사 배정·수강생 배정, 주간 시간표, 원클릭 출석 체크, **지각/무단결석 자동 감지**(5분 주기 크론, 시작 10분 후 미체크 시 LATE → 종료 후에도 미체크면 ABSENT로 승격) |
| 관제 도구 | 신고 관제 페이지(`/admin/reports`, 익명 신고 처리·강제 퇴실), 좌석 배치 에디터(`/admin/seats/editor`) |
| 학부모 기능 | 6자리 코드 자녀 연동, 사전 결석/지각 신청, 주간 리포트, Web Push 구독 |
| 학생 기능 | 본인 QR 코드 표시(`qrcode.react`) |
| 결제 | 학원 SaaS 구독 결제(토스페이먼츠 결제위젯) |
| 알림 | 결석·지각 시 Web Push 발송(`public/sw.js`) |
| 웹/앱 분리 | 웹은 랜딩 페이지, 앱(Capacitor)은 지도로 바로 진입. `?app=1`로 브라우저에서 앱 화면 미리보기(폰 목업+하단 탭바) 가능 |

### ⏳ 미구현 (코드 자체가 아직 없음 — 외부 계정 설정과 무관하게 개발이 필요한 항목)
| 항목 | 비고 |
|---|---|
| 반 채팅 | 채팅방/실시간 메시지/채팅 내 셀프 출석체크/이미지 첨부/안읽음 표시 — 전부 미구현 |
| 학생 개인 이용권(시간권/기간권) 결제 | `student_passes` 테이블, 결제 연동, 키오스크 차감 로직 미구현 |
| 이용권 하드 게이팅 | 위 이용권 기능이 없어 종속적으로 미구현 |
| 학생 계정 ↔ 명부 자가 연동 | 학생이 스스로 `students` 레코드에 연결하는 기능 없음. 현재는 원장이 학생관리에서 직접 등록 |
| 안드로이드 뒤로가기 차단 | `@capacitor/app` 미설치, 관련 코드 없음 |
| 브랜드 아이콘/파비콘 세트 | mipmap 아이콘 등 미생성 |

### 🚧 코드는 만들 수 있지만 외부 서비스 가입/승인이 필요해 보류 중
| 항목 | 필요한 외부 설정 |
|---|---|
| 카카오 알림톡(Solapi) | Solapi 계정, 발신번호 등록, 카카오 비즈니스 채널 연동, 템플릿 심사 |
| 네이티브 푸시(FCM) | Firebase 프로젝트 생성, `google-services.json`, 서버 키 |
| 토스 결제위젯 인앱(WebView) 동작 검증 | 실기기 필요 — 딥링크 복귀 구조는 검증 없이 만들면 오히려 위험 |

원하시면 위 미구현 항목 중 우선순위를 정해 이어서 만들어 드립니다 (반 채팅이 가장 큰 항목입니다).

---

## 1. Supabase 프로젝트 설정

### 신규 프로젝트
1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성 (무료 플랜)
2. **SQL Editor** → `supabase/schema.sql` 전체 실행
3. (선택) `supabase/seed.sql` → `supabase/seed_floorplan.sql` 순서로 실행 — 샘플 학원 2곳 + 존별 좌석 + 테스트 학생(핀코드 `111111`) 생성
4. **Project Settings → API Keys** 에서 값 확인:
   - `Project URL` → `VITE_SUPABASE_URL`, `SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 프론트엔드에 노출 금지)
5. 첫 슈퍼 관리자 계정은 회원가입으로 만들 수 없습니다(의도된 설계). 아무 역할로 가입 후
   **Table Editor → `profiles`** 에서 `role` 을 `SUPER_ADMIN` 으로 수동 변경하세요.

### 이미 schema.sql을 실행한 기존 프로젝트
`supabase/migration_02_owner_invites_seat_admin.sql` 을 SQL Editor에서 추가로 실행하세요.
(원장 등록 코드 테이블, 좌석 추가/삭제 권한, 신고 처리 상태 컬럼이 추가됩니다 — **이 마이그레이션 없이는 학원 생성/원장 연결/좌석 에디터/신고 처리 화면이 동작하지 않습니다**.)

### 학원 생성 & 원장 계정 연결 (신규 플로우)
`academies` 테이블 INSERT는 RLS상 `SUPER_ADMIN`만 가능합니다. 원장이 임의로 기존 학원의 `academy_id`를 지정해 관리자 권한을 얻는 취약점을 막기 위해, 회원가입 화면에서는 원장이 `academy_id`를 직접 고를 수 없습니다. 대신:

1. **슈퍼관리자**가 `/admin`에서 지점명·주소·좌석 수를 입력해 지점 생성 → `backend/src/routes/admin.ts`(`POST /api/admin/academies`)가 학원을 만들고 좌석을 자동 배치한 뒤 **8자리 등록 코드**를 화면에 표시(이때만 확인 가능, 분실 시 "등록코드 재발급" 버튼으로 재발급)
2. 이 코드를 전달받은 **원장**이 STUDENT/PARENT와 동일하게 회원가입(가입 시점엔 `academy_id` 없음) → `/owner/claim` 화면에서 코드 입력 → `backend/src/routes/owner.ts`(`POST /api/owner/claim`)가 서비스 롤로 `profiles.academy_id`를 연결
3. `academy_id`가 없는 원장 계정은 `ProtectedRoute`가 자동으로 `/owner/claim`으로 리다이렉트합니다.

등록 코드는 `academy_owner_invites` 테이블에 저장되며, 이 테이블에는 **의도적으로 RLS 정책을 하나도 만들지 않았습니다** — `academies`처럼 공개 읽기 정책을 두면 코드가 노출되므로, `SUPABASE_SERVICE_ROLE_KEY`(백엔드)로만 접근 가능해야 합니다.

---

## 2. 로컬 실행 (Frontend)

```bash
cd frontend
npm install
cp .env.example .env   # 값 채우기
npm run dev             # http://localhost:5173
```

`VITE_API_BASE_URL` 은 끝에 `/api` 를 붙이지 마세요 (예: `http://localhost:5001`). 코드의 모든 API 호출이 이미 경로 앞에 `/api`를 붙이므로, 여기에 `/api`를 또 붙이면 `/api/api/...` 가 되어 전부 404가 납니다.

## 3. 로컬 실행 (Backend)

```bash
cd backend
npm install
cp .env.example .env   # 값 채우기
npm run dev             # http://localhost:5001
```

> macOS에서 포트 5000은 ControlCenter(AirPlay 수신)가 기본 점유하는 경우가 많습니다. 충돌하면 `PORT`를 5001 등으로 바꾸고 프론트 `VITE_API_BASE_URL`도 맞춰주세요.

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
(단, 실제 권한 요청 코드는 각 화면 구현 시 추가해야 합니다. 뒤로가기 차단은 아직 미구현.)

> Android SDK/Android Studio는 로컬 PC에 설치되어 있어야 합니다.

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

## 6. 페이지 요약

| 경로 | 설명 | 접근 |
|---|---|---|
| `/` | 웹: 랜딩 페이지 · 앱: 지도로 리다이렉트 | 공개 |
| `/map`, `/seats/:id`, `/kiosk` | 지도, 좌석 도면, 키오스크 | 공개(로그인 불필요) |
| `/login`, `/register` | 로그인/회원가입 | 공개 |
| `/owner/claim` | 원장 등록 코드 입력 | ACADEMY_ADMIN (학원 미연결 시 자동 이동) |
| `/dashboard` | 원장 대시보드 | ACADEMY_ADMIN |
| `/students` | 학생 관리 | ACADEMY_ADMIN, TEACHER(승인) |
| `/teachers` | 강사 승인 관리 | ACADEMY_ADMIN |
| `/classes`, `/classes/schedule`, `/attendance` | 반/시간표/출석부 | ACADEMY_ADMIN, TEACHER(승인) |
| `/admin/reports` | 신고 관제 | ACADEMY_ADMIN, TEACHER(승인) |
| `/admin/seats/editor` | 좌석 배치 에디터 | ACADEMY_ADMIN, TEACHER(승인) |
| `/billing` | 이용권 결제(학원 SaaS 구독) | ACADEMY_ADMIN |
| `/admin` | 플랫폼 관리자(지점 생성, 매출) | SUPER_ADMIN |
| `/student/qr` | 학생 본인 QR | STUDENT |
| `/parent/report` | 학부모 리포트 | PARENT |

## 7. 다음 개발 순서 제안

우선순위 순 (전부 위 "미구현" 표에서 가져온 항목):

1. **반 채팅** — `chat_rooms`/`chat_messages` 테이블 + RLS, 반별/공지 채팅방, Realtime 메시지, 채팅 내 셀프 출석체크
2. **학생 개인 이용권 결제** — `student_passes` 테이블, 결제 연동, 키오스크 퇴실 시 자동 차감
3. **학생 계정 자가 연동** — 회원가입 시 선택한 학원 기준으로 `students` 레코드와 연결
4. **안드로이드 뒤로가기 차단** — `@capacitor/app` 설치 후 키오스크 화면에 적용
5. 카카오 알림톡 / 네이티브 푸시(FCM) — 외부 계정 준비되면 진행
