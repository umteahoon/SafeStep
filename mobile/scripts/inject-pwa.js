// expo export -p web 가 만든 dist/index.html은 매번 새로 생성되는 파일이라
// (스크립트 해시가 빌드마다 바뀜) 직접 고쳐 쓸 수 없습니다. 그래서 빌드 후
// manifest·PWA 메타 태그·서비스워커 등록 스크립트를 자동으로 끼워 넣습니다.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const headInject = `
    <meta name="theme-color" content="#2563EB" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="SafeStep" />
    <script>
      // 데스크톱 브라우저로 이 모바일 사이트에 들어오면 웹(데스크톱) 사이트로 보냅니다.
      // 홈 화면에 설치된 PWA는 건드리지 않고, 사용자가 명시적으로 선택한 경우도 기억합니다.
      (function () {
        var DESKTOP_SITE = 'https://safestep-kr.netlify.app';
        var PREF_KEY = 'safestep:site-pref';
        var params = new URLSearchParams(window.location.search);
        if (params.get('site') === 'mobile') {
          localStorage.setItem(PREF_KEY, 'mobile');
          return;
        }
        var isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true;
        if (isStandalone) return;
        if (localStorage.getItem(PREF_KEY) === 'mobile') return;
        var isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobileUA) {
          window.location.replace(DESKTOP_SITE + '/?site=desktop');
        }
      })();
    </script>
  </head>`;

const bodyInject = `
  <a href="https://safestep-kr.netlify.app/?site=desktop" style="position:fixed;right:10px;bottom:10px;z-index:9999;background:rgba(17,21,26,.7);color:#fff;font:12px -apple-system,sans-serif;padding:6px 10px;border-radius:999px;text-decoration:none;">💻 데스크톱 버전으로 보기</a>
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
