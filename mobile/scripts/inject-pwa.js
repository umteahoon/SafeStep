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
  </head>`;

const bodyInject = `
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
