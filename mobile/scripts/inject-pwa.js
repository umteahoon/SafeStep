// expo export -p web 가 만든 dist/index.html은 매번 새로 생성되는 파일이라
// (스크립트 해시가 빌드마다 바뀜) 직접 고쳐 쓸 수 없습니다. 그래서 빌드 후
// manifest·PWA 메타 태그·서비스워커 등록 스크립트를 자동으로 끼워 넣습니다.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const headInject = `
    <meta name="theme-color" content="#2563EB" />
    <meta name="description" content="대림대학교 컴퓨터정보학부 2026학년도 2학기 캡스톤디자인 작품 · 팀 육전 — 스터디카페 좌석 관제와 학원 스마트 출결을 하나로 관리하는 SafeStep" />
    <meta property="og:title" content="SafeStep 모바일" />
    <meta property="og:description" content="대림대학교 컴퓨터정보학부 2026학년도 2학기 캡스톤디자인 작품 · 팀 육전 — 스터디카페 좌석 관제와 학원 스마트 출결을 하나로 관리하는 SafeStep" />
    <meta property="og:type" content="website" />
    <meta name="author" content="대림대학교 컴퓨터정보학부 팀 육전 (이주환 · 엄태훈 · 이동교 · 최원재)" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="SafeStep" />
    <script>
      // 데스크톱 브라우저로 이 모바일 사이트에 들어오면 웹(데스크톱) 사이트로 보냅니다.
      // 홈 화면에 설치된 PWA는 건드리지 않고, ?site=mobile 로 고른 경우는 지금 탭에서만 기억합니다
      // (예전처럼 영구 저장하면 그 컴퓨터는 다시는 웹 화면으로 자동 이동하지 않았음).
      (function () {
        var DESKTOP_SITE = 'https://safestep-kr.netlify.app';
        var PREF_KEY = 'safestep:site-pref';
        try { localStorage.removeItem(PREF_KEY); } catch (e) {}
        var params = new URLSearchParams(window.location.search);
        if (params.get('site') === 'mobile') {
          try { sessionStorage.setItem(PREF_KEY, 'mobile'); } catch (e) {}
          return;
        }
        var isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true;
        if (isStandalone) return;
        var pref = null;
        try { pref = sessionStorage.getItem(PREF_KEY); } catch (e) {}
        if (pref === 'mobile') return;
        var isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobileUA) {
          window.location.replace(DESKTOP_SITE + '/?site=desktop');
        }
      })();
    </script>
  </head>`;

const bodyInject = `
  <!-- '데스크톱 버전으로 보기'는 화면을 가리지 않도록 내 정보 화면 메뉴로 옮김 (MeScreen) -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  </script>
</body>`;

html = html.replace('</head>', headInject).replace('</body>', bodyInject);
fs.writeFileSync(indexPath, html);
console.log('[inject-pwa] manifest/meta/서비스워커 등록 스크립트를 dist/index.html에 추가했습니다.');
