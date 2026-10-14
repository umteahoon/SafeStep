import { Capacitor } from '@capacitor/core';

/** 실제 Capacitor 네이티브(안드로이드/iOS) 런타임인지 */
export const isRealNative = Capacitor.isNativePlatform();

/**
 * 홈 화면에 설치된 PWA로 실행 중인지 (QR로 설치 후 아이콘으로 열었을 때).
 * - 대부분 브라우저: display-mode: standalone 미디어 쿼리
 * - iOS Safari: navigator.standalone (display-mode를 지원하지 않음)
 */
export const isStandalonePwa =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

/** iframe 안에서 렌더되는가 (웹 앱 미리보기의 폰 목업 내부) */
export const isInIframe =
  typeof window !== 'undefined' && window.self !== window.top;

/**
 * 웹 브라우저에서 앱 화면을 미리보기 하는 모드.
 * - 주소에 `?app=` 파라미터가 없으면 항상 웹(데스크톱) 화면.
 * - `?app=0` 또는 `?app=1`이 있으면 모바일 미리보기.
 * - 또는 빌드시 VITE_APP_MODE=native
 * - 저장/유지되는 상태가 없어서(요청마다 URL만 보고 판단) "한번 켜지면 계속
 *   모바일로 고정되는" 문제가 생기지 않습니다.
 */
function resolveAppPreview(): boolean {
  if (isRealNative || typeof window === 'undefined') return false;
  if (import.meta.env.VITE_APP_MODE === 'native') return true;
  const q = new URLSearchParams(window.location.search).get('app');
  return q === '0' || q === '1';
}

export const isAppPreview = resolveAppPreview();

/** 네이티브 앱처럼 동작해야 하는가 (실제 네이티브 + 설치된 PWA + 웹 미리보기 포함) */
export const isNativeApp = isRealNative || isStandalonePwa || isAppPreview;

/** 바깥 창에서 폰 목업 프레임을 씌워야 하는가 (설치된 PWA는 이미 실제 폰이라 제외) */
export const showPhoneMockup =
  isAppPreview && !isRealNative && !isStandalonePwa && !isInIframe;
