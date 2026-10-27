import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { maybeRedirectToMobileSite } from './lib/deviceRedirect';

// 모바일 기기로 데스크톱 웹에 들어오면 모바일 전용 사이트로 바로 보냅니다.
// 리다이렉트가 걸리면 React를 그릴 필요가 없으니 렌더 자체를 건너뜁니다.
const isRedirecting = maybeRedirectToMobileSite();

if (!isRedirecting) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
}

// PWA 설치(홈 화면에 추가)가 가능하려면 서비스 워커가 미리 등록돼 있어야 해서,
// 푸시 알림 신청 여부와 상관없이 앱 시작 시 한 번 등록해 둡니다.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록 실패해도 앱은 정상 동작 (설치 배너만 안 뜸) */
    });
  });
}
