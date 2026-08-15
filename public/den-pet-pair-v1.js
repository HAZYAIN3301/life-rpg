/* Satoru Den pet-pet scenes v1.
 *
 * Autonomous, authored resident interactions.  The module owns the one-scene
 * per visit/cooldown contract and the atomic pair plates; it never grants a
 * reward and never turns six resident pairs into six permanent buttons.
 */
(function exposeDenPetPair(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.DenPetPairV1 = api;
    if (root.document) api.prefetch().catch(() => {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenPetPair(root) {
  'use strict';

  const VERSION = '1.0.0';
  const ART_ROOT = '/art/pets/den-pet-pairs-v1/';
  const MIN_ENTRY_MS = 45_000;
  const COOLDOWN_MIN_MS = 8 * 60_000;
  const COOLDOWN_MAX_MS = 12 * 60_000;
  const RETRY_MS = 12_000;
  const SCENES = Object.freeze({
    'body-recovery': Object.freeze({
      id: 'body-recovery', participants: ['body', 'recovery'],
      label: 'После тренировки', duration: 8_400,
      frames: ['body-recovery-stretch-a', 'body-recovery-stretch-b'], ready: true,
    }),
    'body-resources': Object.freeze({
      id: 'body-resources', participants: ['body', 'resources'],
      label: 'Счёт повторов', duration: 8_000, frames: [], ready: false,
    }),
    'recovery-resources': Object.freeze({
      id: 'recovery-resources', participants: ['recovery', 'resources'],
      label: 'Укрыть Кацую', duration: 8_600, frames: [], ready: false,
    }),
    'shadow-body': Object.freeze({
      id: 'shadow-body', participants: ['shadow', 'body'],
      label: 'Тренировка реакции', duration: 8_200, frames: [], ready: false,
    }),
    'shadow-recovery': Object.freeze({
      id: 'shadow-recovery', participants: ['shadow', 'recovery'],
      label: 'Тихий огонь', duration: 9_000, frames: [], ready: false,
    }),
    'shadow-resources': Object.freeze({
      id: 'shadow-resources', participants: ['shadow', 'resources'],
      label: 'Свет для учёта', duration: 8_400, frames: [], ready: false,
    }),
  });

  const preloads = new Map();
  const pairControllers = new WeakMap();
  let director = null;
  let lastPlayedAt = 0;
  let cooldownUntil = 0;

  function sceneFor(value) { return SCENES[value] || null; }
  function frameSrc(sceneId, frame) { return `${ART_ROOT}${sceneId}/${frame}.png?v=20260815-1`; }

  function preload(src) {
    if (!src || typeof root.Image === 'undefined') return Promise.resolve(src);
    if (preloads.has(src)) return preloads.get(src);
    const ready = new Promise((resolve, reject) => {
      const image = new root.Image();
      image.onload = () => Promise.resolve(typeof image.decode === 'function' ? image.decode().catch(() => {}) : null).then(() => resolve(src));
      image.onerror = () => reject(new Error(`Den pet-pet asset failed: ${src}`));
      image.decoding = 'async';
      image.src = src;
    }).catch((error) => { preloads.delete(src); throw error; });
    preloads.set(src, ready);
    return ready;
  }

  function prefetch() {
    const sources = Object.values(SCENES).filter((scene) => scene.ready)
      .flatMap((scene) => scene.frames.map((frame) => frameSrc(scene.id, frame)));
    return Promise.allSettled(sources.map(preload));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pairMarkup(options) {
    const config = options || {};
    const classes = ['den-pet-pair-v1', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-den-pet-pair-v1 data-scene="body-recovery" aria-hidden="true"><span class="den-pet-pair-v1__stage"></span></span>`;
  }

  function imageFor(scene, frame, index) {
    const image = root.document.createElement('img');
    image.className = `den-pet-pair-v1__frame den-pet-pair-v1__frame--${index ? 'b' : 'a'}`;
    image.src = frameSrc(scene.id, frame);
    image.dataset.petPairFrame = frame;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.decoding = 'async';
    return image;
  }

  function setScene(pair, sceneId) {
    const scene = sceneFor(sceneId);
    if (!pair || !scene || !scene.ready || !scene.frames.length) return Promise.resolve(false);
    return Promise.all(scene.frames.map((frame) => preload(frameSrc(scene.id, frame)))).then(() => {
      if (!pair.isConnected) return false;
      const stage = pair.querySelector('.den-pet-pair-v1__stage');
      if (!stage) return false;
      stage.replaceChildren(...scene.frames.map((frame, index) => imageFor(scene, frame, index)));
      pair.dataset.scene = scene.id;
      return true;
    });
  }

  function cancelPair(scope) {
    const pair = scope && scope.querySelector ? scope.querySelector('[data-den-pet-pair-v1]') : null;
    if (!pair) return false;
    const controller = pairControllers.get(pair);
    if (controller && controller.timer) clearTimeout(controller.timer);
    pairControllers.delete(pair);
    pair.classList.remove('is-active');
    pair.setAttribute('aria-hidden', 'true');
    if (scope.classList) scope.classList.remove('is-pet-pair-active');
    return Boolean(controller);
  }

  function playPair(scope, sceneId, options) {
    const scene = sceneFor(sceneId);
    const pair = scope && scope.querySelector ? scope.querySelector('[data-den-pet-pair-v1]') : null;
    if (!scope || !pair || !scene || !scene.ready) return Promise.resolve(false);
    const config = options || {};
    const duration = Math.max(1_200, Number(config.duration) || scene.duration);
    cancelPair(scope);
    return setScene(pair, scene.id).then((ready) => {
      if (!ready || !scope.isConnected || !pair.isConnected) return false;
      pair.classList.remove('is-active');
      void pair.offsetWidth;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      scope.classList.add('is-pet-pair-active');
      const controller = { timer: 0 };
      controller.timer = setTimeout(() => {
        if (pairControllers.get(pair) !== controller) return;
        pairControllers.delete(pair);
        if (pair.isConnected) {
          pair.classList.remove('is-active');
          pair.setAttribute('aria-hidden', 'true');
        }
        if (scope.isConnected) scope.classList.remove('is-pet-pair-active');
      }, duration);
      pairControllers.set(pair, controller);
      return true;
    });
  }

  function actionCurrent(scope, config) {
    return Boolean(scope && scope.isConnected && (!config || typeof config.isCurrent !== 'function' || config.isCurrent() !== false));
  }
  function pause(scope, config, ms) {
    if (!actionCurrent(scope, config)) return Promise.resolve(false);
    return new Promise((resolve) => setTimeout(() => resolve(actionCurrent(scope, config)), Math.max(0, Number(ms) || 0)));
  }
  function nextFrame() {
    return new Promise((resolve) => {
      const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
      raf(() => raf(resolve));
    });
  }
  function clearApproach(scope) {
    if (!scope || !scope.classList) return;
    scope.classList.remove('is-pet-pair-approaching', 'is-pet-pair-at-meeting', 'is-pet-pair-returning');
  }

  async function approachPair(scope, sceneId, play, options) {
    const scene = sceneFor(sceneId);
    if (!scope || !scene || !scene.ready || typeof play !== 'function') return false;
    const config = options || {};
    const toad = scope.querySelector('[data-body-toad]');
    const slug = scope.querySelector('[data-recovery-slug]');
    if (!toad || !slug || !actionCurrent(scope, config)) return false;
    const approachMs = Math.max(900, Number(config.approachMs) || 2_200);
    const returnMs = Math.max(900, Number(config.returnMs) || 2_300);
    const contactMs = Math.max(1_200, Number(config.duration) || scene.duration);
    clearApproach(scope);
    try {
      if (root.BodyToadV1 && root.BodyToadV1.installHopFrames) await root.BodyToadV1.installHopFrames(toad, 'home');
      if (root.RecoverySlugV1 && root.RecoverySlugV1.installGlideFrames) await root.RecoverySlugV1.installGlideFrames(slug, 'meeting');
      if (!actionCurrent(scope, config)) return false;
      scope.classList.add('is-pet-pair-approaching');
      await nextFrame();
      if (!(await pause(scope, config, approachMs))) return false;
      scope.classList.remove('is-pet-pair-approaching');
      scope.classList.add('is-pet-pair-at-meeting');
      if (root.BodyToadV1 && root.BodyToadV1.clearHopFrames) await root.BodyToadV1.clearHopFrames(toad);
      if (root.RecoverySlugV1 && root.RecoverySlugV1.clearGlideFrames) await root.RecoverySlugV1.clearGlideFrames(slug);
      if (!actionCurrent(scope, config) || !(await play())) return false;
      if (!(await pause(scope, config, contactMs + 80))) return false;
      if (root.BodyToadV1 && root.BodyToadV1.installHopFrames) await root.BodyToadV1.installHopFrames(toad, 'meeting');
      if (root.RecoverySlugV1 && root.RecoverySlugV1.installGlideFrames) await root.RecoverySlugV1.installGlideFrames(slug, 'home');
      if (!actionCurrent(scope, config)) return false;
      scope.classList.add('is-pet-pair-returning');
      await nextFrame();
      scope.classList.remove('is-pet-pair-at-meeting');
      return await pause(scope, config, returnMs);
    } finally {
      clearApproach(scope);
      if (root.BodyToadV1 && root.BodyToadV1.clearHopFrames) await root.BodyToadV1.clearHopFrames(toad).catch(() => {});
      if (root.RecoverySlugV1 && root.RecoverySlugV1.clearGlideFrames) await root.RecoverySlugV1.clearGlideFrames(slug).catch(() => {});
      cancelPair(scope);
    }
  }

  function available(scene, context) {
    const residents = new Set((context && context.residents) || []);
    return scene.ready && scene.participants.every((participant) => residents.has(participant));
  }

  function score(scene, context) {
    if (!available(scene, context)) return -Infinity;
    const safe = context || {};
    let value = 1;
    if (scene.id === 'body-recovery' && (safe.focusCanon === 'body' || safe.energyPct <= 55)) value += 5;
    if (scene.id === 'shadow-recovery' && safe.energyPct <= 35) value += 6;
    if (scene.id === 'body-resources' && safe.focusCanon === 'body') value += 4;
    if (scene.id === 'shadow-resources' && safe.focusCanon === 'money') value += 4;
    if (scene.id === 'recovery-resources' && safe.returning === true) value += 4;
    return value;
  }

  function pickScene(context) {
    return Object.values(SCENES).map((scene) => ({ scene, score: score(scene, context) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score || a.scene.id.localeCompare(b.scene.id))[0]?.scene || null;
  }

  function reducedMotion() {
    return Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function schedule(delay) {
    if (!director) return;
    clearTimeout(director.timer);
    director.timer = setTimeout(tick, Math.max(400, Number(delay) || RETRY_MS));
  }
  async function tick() {
    const current = director;
    if (!current || current.played || reducedMotion() || !current.scope || !current.scope.isConnected) return;
    if (Date.now() < cooldownUntil) return schedule(cooldownUntil - Date.now());
    if (typeof current.ready === 'function' && current.ready() !== true) return schedule(RETRY_MS);
    if (typeof current.canAct === 'function' && current.canAct() !== true) return schedule(RETRY_MS);
    const context = typeof current.context === 'function' ? current.context() : (current.context || {});
    const scene = pickScene(context);
    if (!scene || typeof current.onScene !== 'function') return schedule(RETRY_MS);
    current.busy = true;
    let played = false;
    try { played = await current.onScene(scene.id, { automatic: true, duration: scene.duration }); } catch {}
    if (director !== current) return;
    current.busy = false;
    if (played) {
      current.played = true;
      lastPlayedAt = Date.now();
      const span = COOLDOWN_MAX_MS - COOLDOWN_MIN_MS;
      cooldownUntil = lastPlayedAt + COOLDOWN_MIN_MS + Math.round(Math.random() * span);
      return;
    }
    schedule(RETRY_MS);
  }

  function start(scope, options) {
    if (!scope || !scope.querySelector) return false;
    const config = options || {};
    if (director) {
      director.scope = scope;
      director.canAct = config.canAct;
      director.context = config.context;
      director.onScene = config.onScene;
      director.ready = config.ready;
      if (!director.played && !director.busy && !director.timer) schedule(RETRY_MS);
      return true;
    }
    director = {
      busy: false, canAct: config.canAct, context: config.context,
      enteredAt: Date.now(), onScene: config.onScene, played: false,
      ready: config.ready, scope, timer: 0,
    };
    schedule(MIN_ENTRY_MS);
    return true;
  }

  function stop() {
    if (!director) return false;
    clearTimeout(director.timer);
    if (director.scope) cancelPair(director.scope);
    director = null;
    return true;
  }

  function inspect() {
    return director ? Object.freeze({
      busy: director.busy, cooldownUntil, enteredAt: director.enteredAt,
      lastPlayedAt, played: director.played,
    }) : null;
  }

  return Object.freeze({
    VERSION, ART_ROOT, MIN_ENTRY_MS, COOLDOWN_MIN_MS, COOLDOWN_MAX_MS, RETRY_MS,
    SCENES, sceneFor, frameSrc, preload, prefetch, pairMarkup, setScene,
    playPair, cancelPair, approachPair, available, score, pickScene,
    start, stop, inspect,
  });
});
