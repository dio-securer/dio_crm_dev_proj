const CACHE_VERSION = 'dio-crm-shell-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/dio-crm.svg', '/icons/dio-crm-maskable.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put('/', response.clone()));
          return response;
        })
        .catch(() => caches.match('/').then(cached => cached || Response.error()))
    );
    return;
  }

  if (/\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => cached || Response.error());
        return cached || network;
      })
    );
  }
});
