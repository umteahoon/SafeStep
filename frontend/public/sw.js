// SafeStep Web Push service worker
// PWA 설치(홈 화면에 추가) 가능 조건을 만족시키기 위해 fetch 핸들러를 두되,
// 오프라인 캐싱 없이 네트워크 요청을 그대로 통과시킵니다.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SafeStep', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SafeStep', {
      body: data.body || '',
      tag: data.tag,
      icon: '/favicon.svg',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/parent/report'));
});
