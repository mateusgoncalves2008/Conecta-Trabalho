const CACHE_NAME = 'conectatrabalho-pwa-v22';
const APP_SHELL = [
  '/',
  '/pages/aplicativo.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/css/global.css',
  '/css/aplicativo.css',
  '/css/offline.css',
  '/js/main.js',
  '/img/logo-conectatrabalho.svg',
  '/img/pwa-192.svg',
  '/img/pwa-512.svg',
  '/img/institucional/mobile.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('conectatrabalho-pwa-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok && (url.pathname === '/' || url.pathname === '/pages/aplicativo.html')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match('/offline.html');
      })
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
  }
});
