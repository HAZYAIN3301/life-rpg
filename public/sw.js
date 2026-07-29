/* Satoru Service Worker — офлайн app-shell + push-уведомления (#10/#11).
   Стратегия: network-first для статики (всегда свежий код онлайн, офлайн — из кэша),
   /api/ — мимо SW (живые данные). Бамп CACHE при изменении набора шелла. */
const CACHE = 'satoru-v70';
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'shadow-rig-v2.js', 'shadow-rig-v2-demo.html', 'art/icons/icon-registry.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // сторонние — как есть
  if (url.pathname.includes('/api/')) return;             // API — мимо SW (живые данные)
  // network-first: свежий код онлайн, офлайн — из кэша
  e.respondWith(
    fetch(req).then((resp) => {
      if (resp && resp.ok) { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return resp;
    }).catch(() => caches.match(req).then((m) => m || caches.match('index.html')))
  );
});
// ---- Push (Web Push) ----
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: (e.data && e.data.text()) || '' }; }
  const title = data.title || 'Satoru';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '', icon: 'icon.svg', badge: 'icon.svg', lang: 'ru',
    tag: data.tag || 'gojo', renotify: false, data: { url: data.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
