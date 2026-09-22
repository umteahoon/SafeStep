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
    ├── migration_login_attempts.sql            기존 프로젝트 추가 마이그레이션 (로그인 시도 기록, §1 참고)
    ├── migration_03_chat.sql                   기존 프로젝트 추가 마이그레이션 (반 채팅/공지방, §1 참고)
    ├── migration_04_realtime.sql               기존 프로젝트 추가 마이그레이션 (채팅/출결 Realtime 활성화, §1 참고)
    ├── migration_05_chat_upgrades.sql          기존 프로젝트 추가 마이그레이션 (채팅 이미지첨부/삭제·수정/안읽음, §1 참고)
    ├── migration_teams_chat.sql                기존 프로젝트 추가 마이그레이션 (팀 만들기/참가/초대·팀 채팅, §1 참고)
    ├── seed.sql                                샘플 학원 2곳
    ├── seed_floorplan.sql                      존별 좌석 배치 샘플
    └── seed_demo_accounts.mjs                  랜딩페이지 "데모 체험하기" 버튼용 계정 생성 스크립트
```

> ⚠️ 아래 체크리스트는 이 저장소에 **실제로 존재하는 코드 기준**입니다.
> 다른 곳에서 작성된 기획 문서를 참고할 때는 이 표와 대조해서 실제 구현 여부를 확인하세요.

## 구현 현황 체크리스트

### ✅ 완료
| 영역 | 내용 |
|---|---|
| 인증/RBAC | 회원가입(역할별 분기, 이메일 인증 없이 즉시 로그인) · 로그인 · 강사 승인 대기 · 슈퍼관리자 수동 승격 |
| 학원 온보딩 | 슈퍼관리자가 `/admin`에서 지점 생성 → 좌석 자동 배치 + **8자리 등록 코드** 발급 → 원장이 `/owner/claim`에서 코드 입력해 연결 |
| 지도/좌석/키오스크 | 네이버 지도 실시간 잔여석, 존별 좌석 도면(Realtime), 핀코드/QR 키오스크(입실·외출·복귀·퇴실·**자리 이동**). 랜딩의 "키오스크 데모"(`/kiosk?demo=1`)는 핀코드 없이 QR 스캔만 노출 |
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
| 관리자 접속 로그 | 로그인 성공/실패를 `login_attempts`에 기록, `/admin/logs`에서 조회 (60분 내 3회 이상 실패 시 자동 하이라이트) |
| 데모 체험 계정 | 랜딩 페이지에서 로그인 없이 이용자/키오스크 화면 바로가기 + 원장/강사 데모 계정 원클릭 로그인 (`supabase/seed_demo_accounts.mjs`로 계정 생성). 로그인은 백엔드 `POST /api/auth/demo-login`이 발급하는 1회용 매직링크 토큰으로 처리되어 **비밀번호가 프론트 번들에 존재하지 않음**, `DEMO_LOGIN_ENABLED=false`로 운영 배포 시 API 자체를 차단 가능. 이미 다른 계정으로 로그인 중이면 전환 전 확인창 표시 |
| 반 채팅 / 공지방 | 학원 공지방(전원 읽기, 발신은 직원) + 반별 채팅방(담당직원·수강생 양방향, 학부모 읽기전용), Realtime 메시지. 강사가 채팅방에서 **직접 출석 체크 시작(하루 1회 알림) → 별도 패널에서 학생별 출석/지각/결석/사유결석 처리** (학생이 스스로 누르는 방식이 아니라 강사/원장이 확인 후 처리 — 자기 출석 조작 방지). 정상 출석은 채팅에 안 남기고 지각·결석·사유결석만 알림처럼 표시 |
| 채팅 목록/UX | 방별 마지막 메시지 미리보기·시간, 최근 활동순 정렬, 안읽음 표시(●), 메시지 시간·날짜 구분선 |
| 채팅 참여자 보기 | 반 채팅방에서 담당 강사·수강생 명단(오늘 출결 상태 포함) 확인 |
| 채팅 이미지 첨부 | Supabase Storage(`chat-uploads`) 업로드, 방별 폴더로 발신 권한 제한 |
| 채팅 메시지 수정/삭제 | 본인 TEXT 메시지만 수정 가능(수정됨 표시), 삭제는 본인 또는 학원 직원 |
| 공지 Web Push | 공지방에 직원이 글을 쓰면 그 학원 학생들의 구독자(주로 학부모)에게 Web Push 발송 (`backend/src/routes/chat.ts` `POST /api/chat/announce`) |
| 팀 만들기/참가/초대 | 학원 소속 원장·승인 강사·학생 전용. 팀 생성 시 알파벳+숫자 조합 8자리 참가 코드 자동 발급(헷갈리는 I/O/0/1 제외), 참가 코드 또는 초대 링크(`/teams/join/:code`)로 같은 학원 소속만 참가 가능. 비로그인 상태로 초대 링크를 열면 로그인 후 그 초대로 복귀(`?next=`) |
| 팀 채팅 | 팀마다 단체 채팅방 자동 생성 + 멤버 클릭으로 시작하는 1:1 개인 채팅, Realtime 메시지. 반 채팅(`chat_rooms`/`chat_messages`)과는 별개 테이블(`team_chat_rooms`/`team_chat_messages`)로 분리되어 있음 |
| 도입 문의 / 시작 가이드 | 랜딩의 "학원·카페 도입 문의" → `/inquiry`(문의 폼, `inquiries` 테이블에 저장, 슈퍼관리자만 조회), "무료로 시작하기" → `/start`(4단계 가이드, 원장으로 로그인 중이면 온보딩/대시보드로 바로 안내) |

### ⏳ 미구현 (코드 자체가 아직 없음 — 외부 계정 설정과 무관하게 개발이 필요한 항목)
| 항목 | 비고 |
|---|---|
| 학생 개인 이용권(시간권/기간권) 결제 | `student_passes` 테이블, 결제 연동, 키오스크 차감 로직 미구현 |
| 이용권 하드 게이팅 | 위 이용권 기능이 없어 종속적으로 미구현 |
| 학생 계정 ↔ 명부 자가 연동 | 학생이 스스로 `students` 레코드에 연결하는 기능 없음. 현재는 원장이 학생관리에서 직접 등록 |
| 안드로이드 뒤로가기 차단 | `@capacitor/app` 미설치, 관련 코드 없음 |
| 브랜드 아이콘/파비콘 세트 | 파비콘은 SafeStep 로고 기반 SVG로 교체됨. mipmap 등 안드로이드 아이콘 세트는 아직 미생성 |
| 팀 삭제/멤버 추방·역할 변경 | 현재는 만들기·참가·나가기만 가능. 팀장이 팀을 삭제하거나 멤버를 내보내는 기능은 없음 |

### 🚧 코드는 만들 수 있지만 외부 서비스 가입/승인이 필요해 보류 중
| 항목 | 필요한 외부 설정 |
|---|---|
| 카카오 알림톡(Solapi) | Solapi 계정, 발신번호 등록, 카카오 비즈니스 채널 연동, 템플릿 심사 |
| 네이티브 푸시(FCM) | Firebase 프로젝트 생성, `google-services.json`, 서버 키 |
| 토스 결제위젯 인앱(WebView) 동작 검증 | 실기기 필요 — 딥링크 복귀 구조는 검증 없이 만들면 오히려 위험 |

원하시면 위 미구현 항목 중 우선순위를 정해 이어서 만들어 드립니다.

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
6. 팀/팀 채팅 기능을 쓰려면 `supabase/migration_teams_chat.sql`도 실행하세요 (신규 프로젝트도 `schema.sql`엔 아직 포함되어 있지 않으므로 별도 실행 필요).

### 이미 schema.sql을 실행한 기존 프로젝트
아래 마이그레이션을 SQL Editor에서 추가로 실행하세요 (순서 무관, 서로 독립적):
- `supabase/migration_02_owner_invites_seat_admin.sql` — 원장 등록 코드 테이블, 좌석 추가/삭제 권한, 신고 처리 상태 컬럼 (**없으면 학원 생성/원장 연결/좌석 에디터/신고 처리 화면이 동작하지 않습니다**)
- `supabase/migration_login_attempts.sql` — 로그인 시도 기록 테이블 (**없으면 `/admin/logs` 접속 로그 화면이 동작하지 않습니다**, 로그인 자체는 정상 동작)
- `supabase/migration_03_chat.sql` — 채팅방/메시지 테이블 + 권한 함수 (**없으면 `/chat` 화면이 동작하지 않습니다**)
- `supabase/migration_04_realtime.sql` — `chat_messages`/`class_attendance_records`를 Realtime 발행 목록에 추가 (**없으면 메시지·출결 처리가 새로고침 전까지 안 보입니다**)
- `supabase/migration_05_chat_upgrades.sql` — 채팅 이미지 첨부(Storage 버킷)·메시지 수정/삭제·안읽음 표시 (**없으면 이미지 첨부/수정/삭제 버튼이 에러 납니다**)
- `supabase/migration_teams_chat.sql` — 팀/팀 멤버/팀 채팅방·메시지 테이블 + RLS + RPC + Realtime (**없으면 `/teams` 화면이 오류를 표시하고 `/inquiry` 문의 접수도 실패합니다**)

### 데모 체험 계정 만들기 (선택)
랜딩 페이지의 "원장 데모 체험하기" / "강사 데모 체험하기" 버튼이 로그인할 계정을 생성합니다.
`schema.sql` + `seed.sql` 을 먼저 적용한 뒤 실행하세요:
```bash
cd backend
node ../supabase/seed_demo_accounts.mjs
```
여러 번 실행해도 안전합니다(이미 있으면 건너뜀). 실제 로그인은 백엔드가 발급하는 1회용 매직링크 토큰으로 처리되며(`POST /api/auth/demo-login`), 이 계정의 비밀번호 자체는 프론트 어디에도 노출되지 않습니다. `backend/.env`의 `DEMO_LOGIN_ENABLED=false`로 이 API 자체를 언제든 차단할 수 있습니다.

### 학원 생성 & 원장 계정 연결 (신규 플로우)
`academies` 테이블 INSERT는 RLS상 `SUPER_ADMIN`만 가능합니다. 원장이 임의로 기존 학원의 `academy_id`를 지정해 관리자 권한을 얻는 취약점을 막기 위해, 회원가입 화면에서는 원장이 `academy_id`를 직접 고를 수 없습니다. 대신:

1. **슈퍼관리자**가 `/admin`에서 지점명·주소·좌석 수를 입력해 지점 생성 → `backend/src/routes/admin.ts`(`POST /api/admin/academies`)가 학원을 만들고 좌석을 자동 배치한 뒤 **8자리 등록 코드**를 화면에 표시(이때만 확인 가능, 분실 시 "등록코드 재발급" 버튼으로 재발급)
2. 이 코드를 전달받은 **원장**이 STUDENT/PARENT와 동일하게 회원가입(가입 시점엔 `academy_id` 없음) → `/owner/claim` 화면에서 코드 입력 → `backend/src/routes/owner.ts`(`POST /api/owner/claim`)가 서비스 롤로 `profiles.academy_id`를 연결
3. `academy_id`가 없는 원장 계정은 `ProtectedRoute`가 자동으로 `/owner/claim`으로 리다이렉트합니다.

등록 코드는 `academy_owner_invites` 테이블에 저장되며, 이 테이블에는 **의도적으로 RLS 정책을 하나도 만들지 않았습니다** — `academies`처럼 공개 읽기 정책을 두면 코드가 노출되므로, `SUPABASE_SERVICE_ROLE_KEY`(백엔드)로만 접근 가능해야 합니다.

### 팀 만들기/참가/채팅 (선택 기능)
`supabase/migration_teams_chat.sql` 실행 후 바로 사용할 수 있습니다. 학원에 소속된 원장·승인 강사·학원에 등록된 학생만 팀을 만들거나 참가할 수 있고(`current_user_team_academy_id()` 헬퍼로 판별), 모든 쓰기는 `create_team`/`join_team_by_code`/`start_direct_chat` 등 `SECURITY DEFINER` RPC 함수를 통해서만 이루어집니다. 참가 코드는 팀당 하나이며 재사용/무기한 유효 — 코드 재발급 기능은 아직 없습니다.

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

`DEMO_LOGIN_ENABLED`(기본 `true`)를 `false`로 두면 데모 로그인 API(`POST /api/auth/demo-login`)가 차단됩니다 — 실서비스 배포 시 권장.

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
| `/map`, `/seats/:id`, `/kiosk` | 지도, 좌석 도면, 키오스크 (`/kiosk?demo=1`은 QR 전용 데모 모드) | 공개(로그인 불필요) |
| `/login`, `/register` | 로그인/회원가입 (`/login?next=경로`로 로그인 후 복귀 위치 지정 가능) | 공개 |
| `/inquiry` | 학원·카페 도입 문의 폼 + 요금/기능 안내 | 공개 |
| `/start` | 무료로 시작하기 가이드 (원장 로그인 시 온보딩/대시보드로 안내) | 공개 |
| `/teams/join/:code` | 팀 초대 링크 진입 (비로그인이면 로그인 후 복귀) | 공개 |
| `/owner/claim` | 원장 등록 코드 입력 | ACADEMY_ADMIN (학원 미연결 시 자동 이동) |
| `/dashboard` | 원장 대시보드 | ACADEMY_ADMIN |
| `/students` | 학생 관리 | ACADEMY_ADMIN, TEACHER(승인) |
| `/teachers` | 강사 승인 관리 | ACADEMY_ADMIN |
| `/classes`, `/classes/schedule`, `/attendance` | 반/시간표/출석부 | ACADEMY_ADMIN, TEACHER(승인) |
| `/admin/reports` | 신고 관제 | ACADEMY_ADMIN, TEACHER(승인) |
| `/admin/seats/editor` | 좌석 배치 에디터 | ACADEMY_ADMIN, TEACHER(승인) |
| `/billing` | 이용권 결제(학원 SaaS 구독) | ACADEMY_ADMIN |
| `/admin` | 플랫폼 관리자(지점 생성, 매출) | SUPER_ADMIN |
| `/admin/logs` | 로그인 접속 로그 | SUPER_ADMIN |
| `/student/qr` | 학생 본인 QR | STUDENT |
| `/parent/report` | 학부모 리포트 | PARENT |
| `/chat`, `/chat/:roomId` | 채팅(공지방/반 채팅방) | ACADEMY_ADMIN, TEACHER(승인), STUDENT, PARENT(읽기전용) |
| `/teams`, `/teams/:teamId` | 팀 목록·만들기·참가 / 팀 채팅방(단체+1:1) | ACADEMY_ADMIN, TEACHER(승인), STUDENT |

## 7. 다음 개발 순서 제안

우선순위 순 (전부 위 "미구현" 표에서 가져온 항목):

1. **학생 개인 이용권 결제** — `student_passes` 테이블, 결제 연동, 키오스크 퇴실 시 자동 차감
2. **학생 계정 자가 연동** — 회원가입 시 선택한 학원 기준으로 `students` 레코드와 연결
3. **안드로이드 뒤로가기 차단** — `@capacitor/app` 설치 후 키오스크 화면에 적용
4. **팀 관리 기능 보강** — 팀장의 멤버 추방/팀 삭제, 참가 코드 재발급
5. 카카오 알림톡 / 네이티브 푸시(FCM) — 외부 계정 준비되면 진행
