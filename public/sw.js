/* Satoru Service Worker — офлайн app-shell + push-уведомления (#10/#11).
   App shell: network-first. Art/media: cache-first. /api/: always live network.
   Bump CACHE whenever the shell or a stable asset URL changes. */
const CACHE = 'satoru-v78';
const SHELL = [
  './', 'index.html', 'app.js', 'styles.css', 'shadow-rig-v2.js', 'shadow-voice-v2.js', 'shadow-rig-v2-demo.html', 'den-scene-v4.js',
  'art/icons/icon-registry.js', 'art/icons/scenes/day-summary-fisher.png',
  'art/gear/inventory/w1-training-blade.png',
  'art/companions/shadow-v3-20260730/shadow-spark-calm.png',
  'art/companions/shadow-v3-20260730/shadow-spirit-calm.png',
  'art/companions/shadow-v3-20260730/shadow-guardian-calm.png',
  'art/companions/shadow-v3-20260730/shadow-keeper-calm.png',
  'art/den/v3/den-v3-runtime-1536x864.png',
  'art/den/v3/furniture/wall-map.png',
  'art/den/v3/furniture/seat-cushion.png',
  'art/den/v3/furniture/surface-crate.png',
  'art/den/v3/furniture/comfort-bonsai.png',
  'art/den/v3/furniture/light-lantern.png',
  'art/den/v3/furniture/keepsake-blades.png',
  'art/den/v3/furniture/floor-traveller.png',
  'art/den/v4/ambient/fireplace-grate-logs-runtime.png',
  'art/den/v4/ambient/fireplace-flame-runtime.png',
  'art/den/v4/ambient/window-robin-runtime.png',
  'art/den/v4/ambient/traveller-headphones-runtime.png',
  'audio/ambient/rain-natural-v1.mp3',
  'audio/ambient/fire-natural-v1.mp3',
  'audio/ambient/birds-natural-v1.mp3',
  'manifest.webmanifest', 'icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const MEDIA_PATH_RE = /\.(?:avif|gif|ico|jpe?g|m4a|mp3|mp4|ogg|opus|png|svg|wav|webm|webp|woff2?)(?:$|\?)/i;
function isCacheFirstAsset(req, url) {
  return url.pathname.startsWith('/art/') ||
    ['audio', 'font', 'image', 'video'].includes(req.destination) ||
    MEDIA_PATH_RE.test(url.pathname);
}
function cacheTaskFor(req, resp) {
  if (!resp || !resp.ok || resp.status !== 200) return null;
  const copy = resp.clone();
  return caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
}
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return { response: cached, cacheTask: null };
  const response = await fetch(req);
  return { response, cacheTask: cacheTaskFor(req, response) };
}
async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (!resp || !resp.ok) {
      const cached = await caches.match(req);
      return { response: cached || resp, cacheTask: null };
    }
    return { response: resp, cacheTask: cacheTaskFor(req, resp) };
  } catch {
    const cached = await caches.match(req);
    if (cached) return { response: cached, cacheTask: null };
    if (req.mode === 'navigate') {
      return { response: (await caches.match('index.html')) || Response.error(), cacheTask: null };
    }
    return { response: Response.error(), cacheTask: null };
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // сторонние — как есть
  if (url.pathname.startsWith('/api/')) return;           // API — мимо SW (живые данные)
  // Range responses (usually video/audio) are partial 206 responses and cannot
  // be safely stored with Cache.put. Let the browser/server handle the range.
  if (req.headers.has('range')) { e.respondWith(fetch(req)); return; }
  const operation = isCacheFirstAsset(req, url) ? cacheFirst(req) : networkFirst(req);
  e.respondWith(operation.then((result) => result.response));
  e.waitUntil(operation.then((result) => result.cacheTask).catch(() => {}));
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
