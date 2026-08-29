/* Satoru Service Worker — офлайн app-shell + push-уведомления (#10/#11).
   App shell: network-first. Art/media: cache-first. /api/: always live network.
   Bump CACHE whenever the shell or a stable asset URL changes. */
const CACHE = 'satoru-v202';
const SHELL = [
  'inspiration-import-v1.js', 'browser-companion-discovery-v1.js', 'browser-companion.html', 'browser-companion.css', 'browser-companion-landing-v1.js', 'browser-companion-icon-v1.png',
  'pwa-lifecycle-v1.js',
  './', 'index.html', 'app.js', 'sound-engine-v1.js', 'account-data-v1.js', 'attention-policy-v1.js', 'attention-session-v1.js', 'attention-episode-v1.js', 'attention-controller-v1.js', 'attention-ui-v1.js', 'inspiration-profile-v1.js', 'inspiration-catalog-v1.js', 'return-shelf-v1.js', 'return-shelf-ui-v1.js', 'assistant-actions-v1.js', 'assistant-wake-v1.js', 'goals-initiatives-v1.js', 'guide-v3.js', 'guide-v3-copy-ru.js', 'guide-v3-copy-en.js', 'guide-v3-copy-de.js', 'guide-v3-copy-uk.js', 'guide-v3-copy-es.js', 'guide-presenter-v1.js', 'guide-surface-v1.js', 'canon-domains.js', 'den-stage-v1.js', 'den-life-v1.js', 'den-resident-life-v1.js', 'den-pet-pair-v1.js', 'body-toad-v1.js', 'recovery-slug-v1.js', 'resources-penguin-v1.js', 'profile-memory-v1.js', 'day-observation-v1.js', 'stuck-task-v1.js', 'fights-v1.js', 'board-v1.js', 'board-v2.js', 'board-v2-catalog.js', 'board-v2-pacing.js', 'board-v2-offers.js', 'board-v2-completion.js', 'board-v2-completion-ui.js', 'board-v2-issuer.js', 'board-v2-discovery.js', 'board-v2-local-issuer.js', 'board-v2-local-ui.js', 'board-v2-wildcard-catalog.js', 'board-v2-wildcard-issuer.js', 'board-v2-runtime.js', 'board-pool-v1.js', 'board-taste-v1.js', 'failure-context-v1.js', 'after-lapse-v1.js', 'chest-reveal-v1.js', 'sphere-search-v1.js', 'chart-labels-v1.js', 'md-lite-v1.js', 'voice-input-v1.js', 'sky-events-v1.js', 'day-load-v1.js', 'founder-pass-v1.js', 'traveller-appearance-v1.js', 'traveller-motion-v3.js', 'traveller-room-v4.js', 'styles.css', 'fonts/podkova/Podkova-wght.woff2', 'shadow-rig-v2.js', 'shadow-den-v1.js', 'shadow-voice-v2.js', 'shadow-rig-v2-demo.html', 'den-scene-v4.js',
  'avatar-forge-v1.html', 'avatar-forge-v1.css', 'avatar-forge-v1.js',
  'art/icons/icon-registry.js', 'art/icons/scenes/day-summary-fisher.png',
  'art/rewards/reward-atlas-v1.png',
  'art/ui/boot/ouroboros-body.png',
  'art/ui/boot/ouroboros-jaw.png',
  'art/gear/inventory/w1-training-blade.png',
  'art/companions/shadow-v3-20260730/shadow-spark-calm.png',
  'art/companions/shadow-v3-20260730/shadow-spirit-calm.png',
  'art/companions/shadow-v3-20260730/shadow-guardian-calm.png',
  'art/companions/shadow-v3-20260730/shadow-keeper-calm.png',
  'art/companions/shadow-den-v1/pair-v1/attune-spark.png',
  'art/companions/shadow-den-v1/pair-v1/attune-spirit.png',
  'art/companions/shadow-den-v1/pair-v1/attune-guardian.png',
  'art/companions/shadow-den-v1/pair-v1/attune-keeper.png',
  'art/pets/den-pet-pairs-v1/body-recovery/body-recovery-stretch-a.png',
  'art/pets/den-pet-pairs-v1/body-recovery/body-recovery-stretch-b.png',
  'art/den/v3/den-v3-runtime-1536x864.png',
  'art/den/v3/furniture/wall-map.png',
  'art/den/v3/furniture/seat-cushion.png',
  'art/den/v3/furniture/surface-crate.png',
  'art/den/v3/furniture/comfort-bonsai.png',
  'art/den/v3/furniture/light-lantern.png',
  'art/den/v3/furniture/keepsake-blades.png',
  'art/den/v3/furniture/floor-traveller.png',
  'art/den/v4/ambient/fireplace-grate-logs-runtime.png',
  'art/den/v5/den-day.jpg',
  'art/den/v5/den-night-lantern.jpg',
  'art/den/actors/prop-portal-rim.png',
  'art/den/actors/prop-portal-core.png',
  'art/den/actors/traveller-portal-reach.png',
  'art/pets/body-toad-v1/motion-v4/idle-blink.png',
  'art/pets/body-toad-v1/motion-v4/hop-crouch.png',
  'art/pets/body-toad-v1/motion-v4/hop-air.png',
  'art/pets/body-toad-v1/motion-v4/solo-stretch.png',
  'art/pets/body-toad-v1/motion-v4/solo-stretch-up.png',
  'art/pets/body-toad-v1/motion-v4/bench-sleep.png',
  'art/pets/body-toad-v1/pair-v4/greet-contact.png',
  'art/pets/body-toad-v1/pair-v4/train-low.png',
  'art/pets/body-toad-v1/pair-v4/train-high.png',
  'art/pets/body-toad-v1/pair-v4/rest-contact.png',
  'art/pets/body-toad-v1/pair-v4/rest-pet.png',
  'art/pets/body-toad-v1/pair-v4/pushup-down.png',
  'art/pets/body-toad-v1/pair-v4/pushup-up.png',
  'art/pets/body-toad-v1/pair-v4/stretch-a.png',
  'art/pets/body-toad-v1/pair-v4/stretch-b.png',
  'art/pets/body-toad-v1/pair-v4/whistle-a.png',
  'art/pets/body-toad-v1/pair-v4/whistle-b.png',
  'art/pets/body-toad-v1/pair-v4/whistle-c.png',
  'art/pets/body-toad-v1/pair-v4/whistle-d.png',
  'art/pets/body-toad-v1/pair-v3/pushup-down.png',
  'art/pets/body-toad-v1/pair-v3/pushup-up.png',
  'art/pets/body-toad-v1/pair-v3/stretch-a.png',
  'art/pets/body-toad-v1/pair-v3/stretch-b.png',
  'art/pets/body-toad-v1/pair-v3/whistle-a.png',
  'art/pets/body-toad-v1/pair-v3/whistle-b.png',
  'art/pets/body-toad-v1/states/calm.png',
  'art/pets/body-toad-v1/states/thriving.png',
  'art/pets/body-toad-v1/states/strained.png',
  'art/pets/body-toad-v1/states/restoring.png',
  'art/pets/recovery-slug-v1/states/calm.png',
  'art/pets/recovery-slug-v1/states/thriving.png',
  'art/pets/recovery-slug-v1/states/strained.png',
  'art/pets/recovery-slug-v1/states/restoring.png',
  'art/pets/recovery-slug-v1/motion-v2/glide-compress.png',
  'art/pets/recovery-slug-v1/motion-v2/glide-extend.png',
  'art/pets/recovery-slug-v1/motion-v2/stretch-up.png',
  'art/pets/recovery-slug-v1/motion-v2/cushion-sleep.png',
  'art/pets/recovery-slug-v1/motion-v2/helpers.png',
  'art/pets/recovery-slug-v1/pair-v2/greet-contact.png',
  'art/pets/recovery-slug-v1/pair-v2/breathe-in.png',
  'art/pets/recovery-slug-v1/pair-v2/breathe-out.png',
  'art/pets/recovery-slug-v1/pair-v2/restore-contact.png',
  'art/pets/recovery-slug-v1/pair-v2/stretch-a.png',
  'art/pets/recovery-slug-v1/pair-v3/stretch-soft-b-v155.png',
  'art/pets/resources-penguin-v1/states/calm.png',
  'art/pets/resources-penguin-v1/states/thriving.png',
  'art/pets/resources-penguin-v1/states/strained.png',
  'art/pets/resources-penguin-v1/states/restoring.png',
  'art/pets/resources-penguin-v1/motion/idle-blink.png',
  'art/pets/resources-penguin-v1/solo/waddle-left.png',
  'art/pets/resources-penguin-v1/solo/waddle-right.png',
  'art/pets/resources-penguin-v1/solo/coin-sort-a.png',
  'art/pets/resources-penguin-v1/solo/coin-sort-b.png',
  'art/pets/resources-penguin-v1/solo/coin-sort-c.png',
  'art/pets/resources-penguin-v1/solo/stash-open.png',
  'art/pets/resources-penguin-v1/solo/stash-place.png',
  'art/pets/resources-penguin-v1/solo/stash-closed.png',
  'art/pets/resources-penguin-v1/solo/ledger-read.png',
  'art/pets/resources-penguin-v1/solo/ledger-mark.png',
  'art/pets/resources-penguin-v1/solo/jacket-reset.png',
  'art/pets/resources-penguin-v1/solo/quiet-rest.png',
  'art/pets/resources-penguin-v1/pair-v1/greet-contact.png',
  'art/pets/resources-penguin-v1/pair-v1/budget-point.png',
  'art/pets/resources-penguin-v1/pair-v1/budget-reserve.png',
  'art/pets/resources-penguin-v1/pair-v1/count-pass.png',
  'art/pets/resources-penguin-v1/pair-v1/count-place.png',
  'art/pets/resources-penguin-v1/pair-v1/count-stack.png',
  'art/pets/resources-penguin-v1/pair-v1/reserve-offer.png',
  'art/pets/resources-penguin-v1/pair-v1/reserve-accept.png',
  'art/pets/resources-penguin-v1/pair-v1/focus-work.png',
  'art/pets/resources-penguin-v1/pair-v1/focus-check.png',
  'art/pets/resources-penguin-v1/pair-v1/focus-nod.png',
  'art/pets/resources-penguin-v1/pair-v1/close-stamp.png',
  'art/pets/body-toad-v1/pair-v2/manifest.json',
  'art/pets/body-toad-v1/pair-v2/greet-contact.png',
  'art/pets/body-toad-v1/pair-v2/train-low.png',
  'art/pets/body-toad-v1/pair-v2/train-high.png',
  'art/pets/body-toad-v1/pair-v2/rest-contact.png',
  'art/pets/body-toad-v1/pair-v2/rest-pet.png',
  'art/avatars/traveller-core-v1/manifest.json',
  'art/avatars/traveller-core-v1/male/poses/idle.png',
  'art/avatars/traveller-core-v1/male/poses/arms-up.png',
  'art/avatars/traveller-core-v1/male/poses/seated.png',
  'art/avatars/traveller-core-v1/male/poses/window-back.png',
  'art/avatars/traveller-core-v1/male/motion-v3/manifest.json',
  'art/avatars/traveller-core-v1/male/motion-v3/idle-blink.png',
  'art/avatars/traveller-core-v1/male/motion-v3/walk-a.png',
  'art/avatars/traveller-core-v1/male/motion-v3/walk-b.png',
  'art/avatars/traveller-core-v1/male/room-actions-v4/manifest.json',
  'art/avatars/traveller-core-v1/male/room-actions-v4/bench-rest.png',
  'art/avatars/traveller-core-v1/male/room-actions-v4/bench-read-a.png',
  'art/avatars/traveller-core-v1/male/room-actions-v4/bench-read-b.png',
  'art/avatars/traveller-core-v1/male/room-actions-v4/bench-portal-reach.png',
  'art/avatars/traveller-core-v1/female/f2-v1/manifest.json',
  'art/avatars/traveller-core-v1/female/f2-v1/poses/idle.png',
  'art/avatars/traveller-core-v1/female/f2-v1/poses/arms-up.png',
  'art/avatars/traveller-core-v1/female/f2-v1/poses/seated.png',
  'art/avatars/traveller-core-v1/female/f2-v1/poses/window-back.png',
  'art/avatars/traveller-core-v1/female/f2-v1/motion-v3/idle-blink.png',
  'art/avatars/traveller-core-v1/female/f2-v1/motion-v3/walk-a.png',
  'art/avatars/traveller-core-v1/female/f2-v1/motion-v3/walk-b.png',
  'art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-rest.png',
  'art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-read-a.png',
  'art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-read-b.png',
  'art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-portal-reach.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/greet-contact.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/train-low.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/train-high.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/whistle-a.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/whistle-b.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/whistle-c.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/whistle-d.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/pushup-down.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/pushup-up.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/stretch-a.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/stretch-b-v183.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/rest-contact.png',
  'art/pets/body-toad-v1/pair-v4/female/f2-v1/rest-pet.png',
  'art/pets/recovery-slug-v1/pair-v2/female/f2-v1/greet-contact.png',
  'art/pets/recovery-slug-v1/pair-v2/female/f2-v1/breathe-in.png',
  'art/pets/recovery-slug-v1/pair-v2/female/f2-v1/breathe-out.png',
  'art/pets/recovery-slug-v1/pair-v2/female/f2-v1/restore-contact.png',
  'art/pets/recovery-slug-v1/pair-v2/female/f2-v1/stretch-a.png',
  'art/pets/recovery-slug-v1/pair-v3/female/f2-v1/stretch-soft-b-v183.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/greet-contact.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/budget-point.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/budget-reserve.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/count-pass.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/count-place.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/count-stack.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/reserve-offer.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/reserve-accept.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/focus-work.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/focus-check.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/focus-nod.png',
  'art/pets/resources-penguin-v1/pair-v1/female/f2-v1/close-stamp.png',
  'art/companions/shadow-den-v1/pair-v1/female/f2-v1/attune-spark.png',
  'art/companions/shadow-den-v1/pair-v1/female/f2-v1/attune-spirit.png',
  'art/companions/shadow-den-v1/pair-v1/female/f2-v1/attune-guardian.png',
  'art/companions/shadow-den-v1/pair-v1/female/f2-v1/attune-keeper.png',
  'art/avatars/avatar-forge-v1/art-manifest.json',
  'art/avatars/avatar-forge-v1/runtime/512/mannequin-base-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/hair-traveller-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/hair-scholar-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/hair-bob-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/headphones-soft-noise-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-outerwear-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-scarf-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-goggles-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-backpack-back-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-backpack-front-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-pouch-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/traveller-lantern-hand-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-outerwear-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-hat-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-glasses-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-backpack-back-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-backpack-front-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-pendant-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-waist-kit-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/scholar-journal-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/traveller/traveller-outerwear-teal-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/traveller/traveller-outerwear-blue-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/traveller/traveller-outerwear-violet-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/traveller/traveller-outerwear-crimson-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/traveller/traveller-outerwear-forest-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/scholar/scholar-outerwear-teal-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/scholar/scholar-outerwear-blue-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/scholar/scholar-outerwear-violet-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/scholar/scholar-outerwear-crimson-alpha.png',
  'art/avatars/avatar-forge-v1/runtime/512/colorways/scholar/scholar-outerwear-forest-alpha.png',
  'audio/ambient/rain-natural-v1.mp3',
  'audio/ambient/fire-natural-v1.mp3',
  'audio/ambient/birds-natural-v1.mp3',
  'manifest.webmanifest', 'icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then((clients) => clients.forEach((client) => client.postMessage({ type: 'satoru:worker-version', version: CACHE }))));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'satoru:version-request' && e.source) {
    e.source.postMessage({ type: 'satoru:worker-version', version: CACHE });
  }
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
async function matchShell(req) {
  // index.html pins every critical asset with ?v=. The install list keeps
  // canonical filenames so releases stay auditable; ignoreSearch is the
  // deliberate bridge that lets an already-open tab reload offline after
  // skipWaiting has removed the previous cache.
  return (await caches.match(req)) || caches.match(req, { ignoreSearch: true });
}
async function cacheFirst(req) {
  const cached = await matchShell(req);
  if (cached) return { response: cached, cacheTask: null };
  const response = await fetch(req);
  return { response, cacheTask: cacheTaskFor(req, response) };
}
async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (!resp || !resp.ok) {
      const cached = await matchShell(req);
      return { response: cached || resp, cacheTask: null };
    }
    return { response: resp, cacheTask: cacheTaskFor(req, resp) };
  } catch {
    const cached = await matchShell(req);
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
const PUSH_LANGS = new Set(['ru', 'en', 'de', 'uk', 'es']);
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: (e.data && e.data.text()) || '' }; }
  const title = data.title || 'Satoru';
  const notificationLang = PUSH_LANGS.has(data.lang) ? data.lang : 'ru';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '', icon: 'icon.svg', badge: 'icon.svg', lang: notificationLang,
    tag: data.tag || 'gojo', renotify: false, data: { url: data.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const rawTarget = (e.notification.data && e.notification.data.url) || './';
  let target = new URL('./', self.location.origin).href;
  try { const parsed = new URL(rawTarget, self.location.origin); if (parsed.origin === self.location.origin) target = parsed.href; } catch {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) {
      if (!('focus' in c)) continue;
      if ('navigate' in c) return c.navigate(target).then((next) => (next || c).focus());
      return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
