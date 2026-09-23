import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { isRealNative } from '../lib/platform';

/**
 * 안드로이드 하드웨어 뒤로가기를 무시합니다. 공용 키오스크 태블릿에서
 * 뒤로가기로 앱이 종료되거나 이전 화면(학원 선택 등)으로 새면 안 되기 때문에,
 * 키오스크 화면이 떠 있는 동안 리스너를 등록해 기본 동작(앱 종료/뒤로 이동)을 막습니다.
 */
export function useBlockBackButton() {
  useEffect(() => {
    if (!isRealNative) return;
    const listenerPromise = App.addListener('backButton', () => {
      // 아무 동작도 하지 않음 — 뒤로가기 무시
    });
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);
}
