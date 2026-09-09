import { Capacitor } from '@capacitor/core';

/** 실제 Capacitor 네이티브(안드로이드/iOS) 런타임인지 */
export const isRealNative = Capacitor.isNativePlatform();

/** iframe 안에서 렌더되는가 (웹 앱 미리보기의 폰 목업 내부) */
export const isInIframe =
  typeof window !== 'undefined' && window.self !== window.top;

/**
 * 웹 브라우저에서 앱 화면을 미리보기 하는 모드.
 * - URL `?app=1` 로 켜고 `?app=0` 으로 끔 (localStorage 에 유지)
 * - 또는 빌드시 VITE_APP_MODE=native
 */
function resolveAppPreview(): boolean {
  if (isRealNative || typeof window === 'undefined') return false;
  if (import.meta.env.VITE_APP_MODE === 'native') return true;
  try {
    const q = new URLSearchParams(window.location.search).get('app');
    if (q === '1') {
      localStorage.setItem('safestep:appPreview', '1');
      return true;
    }
    if (q === '0') {
      localStorage.removeItem('safestep:appPreview');
      return false;
    }
    return localStorage.getItem('safestep:appPreview') === '1';
  } catch {
    return false;
  }
}

export const isAppPreview = resolveAppPreview();

/** 네이티브 앱처럼 동작해야 하는가 (실제 네이티브 + 웹 미리보기 포함) */
export const isNativeApp = isRealNative || isAppPreview;

/** 바깥 창에서 폰 목업 프레임을 씌워야 하는가 */
export const showPhoneMockup = isAppPreview && !isRealNative && !isInIframe;
