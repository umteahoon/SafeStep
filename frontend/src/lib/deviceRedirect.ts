import { isAppPreview, isRealNative, isStandalonePwa } from './platform';

// 모바일 웹(react-native-web으로 내보낸 실제 앱)이 배포된 주소.
// "모바일 버전으로 보기" 링크(PublicHeader 등)에서도 재사용합니다.
export const MOBILE_SITE_URL = 'https://safestep-mobile-web.netlify.app';

const PREF_KEY = 'safestep:site-pref'; // 'mobile' | 'desktop' | null(자동 판단)

function isMobileUA(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * 모바일 기기로 이 웹사이트(데스크톱 버전)에 들어오면, react-native-web으로
 * 배포한 모바일 앱 사이트로 자동 이동시킵니다.
 * - 설치된 앱(Capacitor)·설치된 PWA·웹 미리보기(`?app=`)는 건드리지 않음
 *   (이미 그 자체로 올바른 모바일 화면이라 리다이렉트하면 오히려 끊어짐)
 * - `?site=desktop`으로 들어오면 그 선택을 기억해서 다시는 안 보냄
 *   (모바일 사이트의 "데스크톱 버전으로 보기" 링크가 이 파라미터를 붙여서 보냄)
 */
export function maybeRedirectToMobileSite(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('site') === 'desktop') {
    localStorage.setItem(PREF_KEY, 'desktop');
    return false;
  }

  if (isRealNative || isStandalonePwa || isAppPreview) return false;
  if (localStorage.getItem(PREF_KEY) === 'desktop') return false;
  if (!isMobileUA()) return false;

  window.location.replace(MOBILE_SITE_URL);
  return true;
}
