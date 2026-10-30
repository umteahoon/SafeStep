import { isAppPreview, isRealNative, isStandalonePwa } from './platform';

// 모바일 웹(react-native-web으로 내보낸 실제 앱)이 배포된 주소.
// "모바일 버전으로 보기" 링크(PublicHeader 등)에서도 재사용합니다.
export const MOBILE_SITE_URL = 'https://safestep-mobile-web.netlify.app';

// 'mobile' | 'desktop' | null(자동 판단). 지금 탭에서만 기억 — 예전처럼 영구 저장하면
// 한 번 ?site=desktop 링크를 연 휴대폰은 다시는 모바일 화면으로 자동 이동하지 않았음
const PREF_KEY = 'safestep:site-pref';

function isMobileUA(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * 모바일 기기로 이 웹사이트(데스크톱 버전)에 들어오면, react-native-web으로
 * 배포한 모바일 앱 사이트로 자동 이동시킵니다.
 * - 설치된 앱(Capacitor)·설치된 PWA·웹 미리보기(`?app=`)는 건드리지 않음
 *   (이미 그 자체로 올바른 모바일 화면이라 리다이렉트하면 오히려 끊어짐)
 * - `?site=desktop`으로 들어오면 지금 탭에서는 그 선택을 기억해서 안 보냄
 *   (모바일 사이트의 "데스크톱 버전으로 보기" 링크가 이 파라미터를 붙여서 보냄).
 *   새로 접속하면 다시 기기 기준으로 자동 판단
 */
export function maybeRedirectToMobileSite(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.removeItem(PREF_KEY); // 예전 버전이 영구 저장한 선택 정리
  } catch {
    /* 저장소 차단 시 무시 */
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('site') === 'desktop') {
    try {
      sessionStorage.setItem(PREF_KEY, 'desktop');
    } catch {
      /* 저장소 차단 시 무시 */
    }
    return false;
  }

  if (isRealNative || isStandalonePwa || isAppPreview) return false;
  let pref: string | null = null;
  try {
    pref = sessionStorage.getItem(PREF_KEY);
  } catch {
    /* 저장소 차단 시 무시 */
  }
  if (pref === 'desktop') return false;
  if (!isMobileUA()) return false;

  window.location.replace(MOBILE_SITE_URL);
  return true;
}
