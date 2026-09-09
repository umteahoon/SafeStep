import { useEffect, useState } from 'react';

declare global {
  interface Window {
    naver: any;
  }
}

let loadPromise: Promise<void> | null = null;

function loadNaverMapScript(clientId: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('네이버 지도 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useNaverMaps() {
  const [isLoaded, setIsLoaded] = useState(!!window.naver?.maps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) return;
    const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      setError('VITE_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다.');
      return;
    }
    loadNaverMapScript(clientId)
      .then(() => setIsLoaded(true))
      .catch((e) => setError(e.message));
  }, [isLoaded]);

  return { isLoaded, error };
}
