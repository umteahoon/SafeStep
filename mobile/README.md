# SafeStep Mobile (React Native / Expo)

`frontend/`(웹, Capacitor 안드로이드 앱)와는 별개의 **네이티브 모바일 앱**입니다. `backend/`, `supabase/`와 **같은 Supabase 프로젝트**를 그대로 공유하므로, 웹에서 만든 계정으로 이 앱에도 바로 로그인할 수 있고 DB/RLS/Realtime도 동일하게 적용됩니다.

## 왜 별도 앱인가
`frontend/`는 이미 Capacitor로 안드로이드 앱을 빌드하고 있습니다(`npx cap sync android`). 이 `mobile/` 폴더는 그것과 무관한 **완전히 새로운 React Native(Expo) 코드베이스**로, 웹 코드를 공유하지 않고 화면을 새로 만듭니다. 대신 아래 두 가지는 웹과 반드시 맞춰야 합니다:
- **Supabase 프로젝트**: `.env`에 `frontend/.env` / `backend/.env`와 **동일한 Supabase URL/anon key**를 넣으세요. DB 스키마·RLS가 그대로 적용되므로 웹에서 실행한 모든 `supabase/migration_*.sql`이 이 앱에도 그대로 적용된 상태여야 합니다.
- **타입**: `src/types/index.ts`는 `frontend/src/types/index.ts`를 손으로 옮긴 것입니다. DB 컬럼을 바꾸면 양쪽 다 수정하세요.

## 현재 상태 (이번 스캐폴딩 범위)
- Expo(React Native + TypeScript) 프로젝트 골격
- `src/lib/supabase.ts` — 웹과 같은 Supabase 프로젝트에 연결(세션은 AsyncStorage에 저장되어 앱 재실행 후에도 로그인 유지)
- `src/lib/useAuth.ts` — 세션 구독 + `profiles` 조회 (웹의 `useAuthListener`와 동일한 역할)
- 로그인 화면(`src/screens/LoginScreen.tsx`) → 로그인 성공 시 `profiles`를 읽어와 홈 화면(`src/screens/HomeScreen.tsx`)에 이름/역할 표시, 로그아웃 버튼

지도·키오스크·대시보드 등 실제 화면은 아직 없습니다. 웹의 해당 페이지(`frontend/src/pages/...`) 로직을 참고해 화면 단위로 이어서 만들면 됩니다.

## 실행하기

```bash
cd mobile
npm install
cp .env.example .env   # 값 채우기 — frontend/.env 와 같은 Supabase URL/anon key
npm start                # Expo 개발 서버 실행, QR코드를 Expo Go 앱으로 스캔하면 실기기에서 바로 확인 가능
```

- `npm run android` / `npm run ios` — 에뮬레이터/시뮬레이터로 실행 (Android Studio / Xcode 필요)
- `npm run web` — 브라우저에서 미리보기 (React Native Web)
- 환경변수는 `EXPO_PUBLIC_` 접두사가 붙어야 앱 번들에 포함됩니다(Expo SDK 49+ 기본 지원, 별도 설정 불필요).

## 백엔드 API를 쓰려면
`backend/`의 Express API(`/api/kiosk/*`, `/api/owner/claim` 등 service-role이 필요한 엔드포인트)를 호출할 때는 `EXPO_PUBLIC_API_BASE_URL`을 쓰세요. 웹의 `frontend/src/lib/api.ts`(`Authorization: Bearer <supabase access token>` 첨부)와 같은 패턴으로 `fetch` 래퍼를 만들면 됩니다.
