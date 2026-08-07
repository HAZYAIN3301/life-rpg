/* Satoru RECOVERY Guardian v2.
 *
 * Katsuya is a derived recovery signal, not another sphere to maintain.
 * Runtime rules:
 * - authored whole-character frames; no sliced joints;
 * - glide motion always swaps compression/extension frames;
 * - male-Traveller contact scenes are single 1536x1536 images;
 * - long, quiet holds instead of rapid action montage.
 */
(function exposeRecoverySlug(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.RecoverySlugV1 = api;
    if (root.document) api.prefetch().catch(() => {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRecoverySlugV1() {
  'use strict';

  const VERSION = '2.0.0';
  const ART_ROOT = '/art/pets/recovery-slug-v1/';
  const MOTION_ART_ROOT = `${ART_ROOT}motion-v2/`;
  const PAIR_ART_ROOT = `${ART_ROOT}pair-v2/`;
  const STATES = Object.freeze(['calm', 'thriving', 'strained', 'restoring']);
  const STATE_META = Object.freeze({
    calm: { label: 'Спокойна', line: 'Дышит медленно и хранит запас тишины.' },
    thriving: { label: 'Наполнена', line: 'Отдых действительно возвращает тебе силы.' },
    strained: { label: 'Тревожится', line: 'Слишком долго не было настоящей паузы.' },
    restoring: { label: 'Лечит', line: 'Не торопит: силы уже возвращаются.' },
  });
  const MOTION_FRAMES = Object.freeze({
    compress: 'glide-compress.png',
    extend: 'glide-extend.png',
    stretch: 'stretch-up.png',
    sleep: 'cushion-sleep.png',
    helpers: 'helpers.png',
  });
  const INTERACTIONS = Object.freeze({
    greet: { label: 'Поздороваться', duration: 6800, state: 'calm', pairFrames: ['greet-contact'] },
    breathe: { label: 'Подышать вместе', duration: 16000, state: 'restoring', pairFrames: ['breathe-in', 'breathe-out'] },
    restore: { label: 'Восстановиться рядом', duration: 16000, state: 'restoring', pairFrames: ['restore-contact'] },
    stretch: { label: 'Мягкая растяжка', duration: 16000, state: 'restoring', pairFrames: ['stretch-a', 'stretch-b'] },
  });

  const preloads = new Map();
  const pairTimers = new WeakMap();
  const reactionTimers = new WeakMap();
  const ambientControllers = new WeakMap();

  function normalizeState(value) {
    return STATES.includes(value) ? value : 'calm';
  }

  function stateSrc(state) {
    return `${ART_ROOT}states/${normalizeState(state)}.png`;
  }

  function motionFrameSrc(key) {
    return `${MOTION_ART_ROOT}${MOTION_FRAMES[key] || MOTION_FRAMES.compress}?v=20260806-2`;
  }

  function pairFrameSrc(frame) {
    const allowed = new Set(Object.values(INTERACTIONS).flatMap((item) => item.pairFrames));
    const safe = allowed.has(frame) ? frame : 'greet-contact';
    return `${PAIR_ART_ROOT}${safe}.png?v=20260806-2`;
  }

  function frameSrc(state, animated) {
    const safe = normalizeState(state);
    return safe === 'calm' && animated !== false
      ? `${ART_ROOT}motion/idle-softbody.gif?v=20260806-1`
      : stateSrc(safe);
  }

  function deriveState(signal) {
    const input = signal || {};
    const gap = Math.max(0, Number(input.restGapDays) || 0);
    const energy = Math.max(0, Math.min(100, Number(input.energyPct) || 0));
    if (gap <= 1 && energy < 68) return 'restoring';
    if (gap >= 5 || energy <= 25) return 'strained';
    if (gap === 0 && energy >= 75) return 'thriving';
    return 'calm';
  }

  function preload(src) {
    if (!src || typeof Image === 'undefined') return Promise.resolve(src);
    if (preloads.has(src)) return preloads.get(src);
    const ready = new Promise((resolve, reject) => {
      const image = new Image();
      const finish = () => {
        const decoded = typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.then(() => resolve(src));
      };
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', () => reject(new Error(`RECOVERY Guardian asset failed: ${src}`)), { once: true });
      image.decoding = 'async';
      image.src = src;
      if (image.complete && image.naturalWidth) finish();
    }).catch((error) => {
      preloads.delete(src);
      throw error;
    });
    preloads.set(src, ready);
    return ready;
  }

  function prefetch() {
    const sources = STATES.map(stateSrc)
      .concat([frameSrc('calm', true)])
      .concat(Object.keys(MOTION_FRAMES).map(motionFrameSrc))
      .concat(Object.values(INTERACTIONS).flatMap((item) => item.pairFrames.map(pairFrameSrc)));
    return Promise.allSettled(sources.map(preload));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function markup(options) {
    const config = options || {};
    const state = normalizeState(config.state);
    const animated = config.animated !== false;
    const classes = ['recovery-slug-v1', config.className || ''].filter(Boolean).join(' ');
    const label = config.label || `Хранитель восстановления: ${STATE_META[state].label}`;
    return `<span class="${escapeHTML(classes)}" data-recovery-slug data-state="${state}" data-animated="${animated ? 'true' : 'false'}" role="img" aria-label="${escapeHTML(label)}"><span class="recovery-slug-v1__stage"><img class="recovery-slug-v1__frame is-active" src="${frameSrc(state, animated)}" alt="" aria-hidden="true" draggable="false" decoding="async"></span></span>`;
  }

  function pairMarkup(options) {
    const config = options || {};
    const classes = ['recovery-pair-v2', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-recovery-pair-v2 data-mode="greet" aria-hidden="true"><span class="recovery-pair-v2__stage"></span></span>`;
  }

  function setState(element, state, options) {
    if (!element) return Promise.resolve(null);
    const safe = normalizeState(state);
    const config = options || {};
    const animated = config.animated !== false && element.dataset.animated !== 'false';
    const src = frameSrc(safe, animated);
    return preload(src).then(() => {
      if (!element.isConnected) return element;
      const stage = element.querySelector('.recovery-slug-v1__stage');
      const current = stage && stage.querySelector('.recovery-slug-v1__frame.is-active');
      if (!stage) return element;
      const next = document.createElement('img');
      next.className = `recovery-slug-v1__frame ${config.instant === true ? 'is-active' : 'is-incoming'}`;
      next.src = src;
      next.alt = '';
      next.setAttribute('aria-hidden', 'true');
      next.draggable = false;
      next.decoding = 'async';
      if (config.instant === true) stage.replaceChildren(next);
      else stage.appendChild(next);
      element.dataset.state = safe;
      if (config.instant === true) return element;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!next.isConnected) return;
        next.classList.add('is-active');
        next.classList.remove('is-incoming');
        if (current) current.classList.add('is-outgoing');
        setTimeout(() => current && current.remove(), 280);
      }));
      return element;
    });
  }

  function pairImages(mode) {
    return (INTERACTIONS[mode] || INTERACTIONS.greet).pairFrames.map((frame, index) => {
      const image = document.createElement('img');
      image.className = `recovery-pair-v2__frame recovery-pair-v2__frame--${index === 0 ? 'a' : 'b'}`;
      image.src = pairFrameSrc(frame);
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.draggable = false;
      image.decoding = 'async';
      return image;
    });
  }

  function setPairMode(element, mode) {
    if (!element || !INTERACTIONS[mode]) return Promise.resolve(false);
    const sources = INTERACTIONS[mode].pairFrames.map(pairFrameSrc);
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.recovery-pair-v2__stage');
      if (!stage) return false;
      stage.replaceChildren(...pairImages(mode));
      element.dataset.mode = mode;
      return true;
    });
  }

  function playPair(scope, mode, options) {
    if (!scope || !INTERACTIONS[mode]) return Promise.resolve(false);
    const pair = scope.querySelector('[data-recovery-pair-v2]');
    if (!pair) return Promise.resolve(false);
    const config = options || {};
    const slug = config.slug || scope.querySelector('[data-recovery-slug]');
    const restoreState = slug ? normalizeState(config.restoreState || slug.dataset.state) : 'calm';
    const duration = Math.max(800, Number(config.duration) || INTERACTIONS[mode].duration);
    const oldTimer = pairTimers.get(pair);
    if (oldTimer) clearTimeout(oldTimer);
    return setPairMode(pair, mode).then((ready) => {
      if (!ready || !pair.isConnected || !scope.isConnected) return false;
      scope.classList.add('is-recovery-pair-active');
      pair.classList.remove('is-active');
      void pair.offsetWidth;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      if (slug) setState(slug, INTERACTIONS[mode].state, { animated: false }).catch(() => {});
      const timer = setTimeout(() => {
        pair.classList.remove('is-active');
        pair.setAttribute('aria-hidden', 'true');
        scope.classList.remove('is-recovery-pair-active');
        if (slug) setState(slug, restoreState, { animated: true }).catch(() => {});
        pairTimers.delete(pair);
        if (typeof config.onFinish === 'function') config.onFinish(mode);
      }, duration);
      pairTimers.set(pair, timer);
      return true;
    });
  }

  function motionHost(element) {
    return element && element.closest ? (element.closest('.den-recovery-slug') || element) : element;
  }

  function replaceMotionFrames(element, keys, motion) {
    if (!element) return Promise.resolve(false);
    const safeKeys = Array.isArray(keys) ? keys : [keys];
    const sources = safeKeys.map(motionFrameSrc);
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.recovery-slug-v1__stage');
      if (!stage) return false;
      const frames = sources.map((src, index) => {
        const image = document.createElement('img');
        image.className = `recovery-slug-v1__frame recovery-slug-v1__motion-frame recovery-slug-v1__motion-frame--${index === 0 ? 'a' : 'b'} is-active`;
        image.src = src;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.draggable = false;
        image.decoding = 'async';
        return image;
      });
      stage.replaceChildren(...frames);
      element.dataset.motion = motion;
      element.classList.add('is-den-ambient');
      return true;
    });
  }

  function clearMotion(element, restoreState) {
    if (!element) return Promise.resolve(false);
    const host = motionHost(element);
    const shell = element.closest && element.closest('.den-shell');
    element.classList.remove('is-den-ambient');
    delete element.dataset.motion;
    if (host && host.dataset) {
      delete host.dataset.slugMotion;
      delete host.dataset.slugRoute;
      delete host.dataset.slugDirection;
      delete host.dataset.slugApproach;
    }
    if (shell) shell.classList.remove('is-recovery-ambient-active');
    return setState(element, normalizeState(restoreState || element.dataset.state), { animated: true, instant: true }).then(() => true);
  }

  function cancelAmbient(element, restore) {
    const controller = ambientControllers.get(element);
    if (!controller) return false;
    controller.cancelled = true;
    if (controller.timer) clearTimeout(controller.timer);
    if (controller.resolve) controller.resolve(false);
    ambientControllers.delete(element);
    if (restore !== false) clearMotion(element, controller.restoreState).catch(() => {});
    return true;
  }

  function waitFor(controller, ms) {
    return new Promise((resolve) => {
      controller.resolve = resolve;
      controller.timer = setTimeout(() => {
        controller.timer = 0;
        controller.resolve = null;
        resolve(!controller.cancelled);
      }, ms);
    });
  }

  async function installGlideFrames(element, direction) {
    if (!element) return false;
    cancelAmbient(element, false);
    const ready = await replaceMotionFrames(element, ['compress', 'extend'], 'approach-glide');
    if (!ready) return false;
    const host = motionHost(element);
    if (host && host.dataset) {
      host.dataset.slugApproach = direction === 'home' ? 'home' : 'meeting';
      host.dataset.slugDirection = direction === 'home' ? 'right' : 'left';
    }
    return true;
  }

  function clearGlideFrames(element, restoreState) {
    return clearMotion(element, restoreState);
  }

  async function playAmbient(element, mode, options) {
    if (!element || !element.isConnected) return false;
    cancelAmbient(element, false);
    const config = options || {};
    const restoreState = normalizeState(config.restoreState || element.dataset.state);
    const controller = { cancelled: false, resolve: null, restoreState, timer: 0 };
    ambientControllers.set(element, controller);
    const host = motionHost(element);
    const shell = element.closest && element.closest('.den-shell');
    if (shell) shell.classList.add('is-recovery-ambient-active');
    if (host && host.dataset) host.dataset.slugMotion = mode;
    const show = (keys) => replaceMotionFrames(element, keys, mode);
    const wait = (ms) => waitFor(controller, ms);
    try {
      if (mode === 'solo-stretch') {
        if (!(await show('stretch'))) return false;
        return await wait(Math.max(10000, Number(config.duration) || 14000));
      }
      if (mode === 'helpers') {
        if (!(await show('helpers'))) return false;
        return await wait(Math.max(12000, Number(config.duration) || 16000));
      }
      if (mode === 'cushion-nap') {
        if (!(await show('sleep'))) return false;
        return await wait(Math.max(18000, Number(config.duration) || 24000));
      }
      if (mode === 'glide-tour') {
        if (!(await show(['compress', 'extend']))) return false;
        if (!(await wait(1100))) return false;
        if (host && host.dataset) host.dataset.slugRoute = 'away';
        if (!(await wait(5200))) return false;
        if (!(await wait(Math.max(7000, Number(config.dwellMs) || 9000)))) return false;
        if (host && host.dataset) host.dataset.slugRoute = 'home';
        return await wait(5600);
      }
      return false;
    } finally {
      if (ambientControllers.get(element) === controller) ambientControllers.delete(element);
      await clearMotion(element, restoreState).catch(() => {});
    }
  }

  function playInteraction(element, mode, options) {
    if (!element || !INTERACTIONS[mode]) return Promise.resolve(false);
    const config = options || {};
    const previous = normalizeState(config.restoreState || element.dataset.state);
    const oldTimer = reactionTimers.get(element);
    if (oldTimer) clearTimeout(oldTimer);
    element.dataset.interaction = mode;
    element.classList.add('is-reassuring');
    return setState(element, INTERACTIONS[mode].state, { animated: false }).then(() => {
      const timer = setTimeout(() => {
        delete element.dataset.interaction;
        element.classList.remove('is-reassuring');
        setState(element, previous, { animated: true }).catch(() => {});
        reactionTimers.delete(element);
      }, Math.min(INTERACTIONS[mode].duration, 6200));
      reactionTimers.set(element, timer);
      return true;
    });
  }

  function reassure(element, restoreState) {
    return playInteraction(element, 'restore', { restoreState });
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    MOTION_ART_ROOT,
    PAIR_ART_ROOT,
    STATES,
    STATE_META,
    MOTION_FRAMES,
    INTERACTIONS,
    normalizeState,
    stateSrc,
    motionFrameSrc,
    pairFrameSrc,
    frameSrc,
    deriveState,
    prefetch,
    markup,
    pairMarkup,
    setState,
    setPairMode,
    playPair,
    playInteraction,
    reassure,
    playAmbient,
    cancelAmbient,
    installGlideFrames,
    clearGlideFrames,
  });
});
