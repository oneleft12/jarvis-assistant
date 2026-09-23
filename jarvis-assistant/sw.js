// П.15 плана: Service Worker — офлайн-кэш для J.A.R.V.I.S.
const CACHE = 'jarvis-v1';
const CORE = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API — всегда живая сеть (никакого кэша для данных)
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;

  // Навигация: сеть → сохраняем; офлайн → /index.html из кэша
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return r;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Статика: кэш → сеть (с сохранением ответа)
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          if (r.ok && url.origin === self.location.origin) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
    )
  );
});
