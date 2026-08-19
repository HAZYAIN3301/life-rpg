/* Satoru RECOVERY Guardian v2.
 *
 * Katsuya is a derived recovery signal, not another sphere to maintain.
 * Runtime rules:
 * - authored whole-character frames; no sliced joints;
 * - glide motion always swaps compression/extension frames;
 * - male and F2-female Traveller contact scenes are single 1536x1536 images;
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

  const VERSION = '2.6.0';
  const ART_ROOT = '/art/pets/recovery-slug-v1/';
  const MOTION_ART_ROOT = `${ART_ROOT}motion-v2/`;
  const PAIR_ART_ROOT = `${ART_ROOT}pair-v2/`;
  const PAIR_V155_ART_ROOT = `${ART_ROOT}pair-v3/`;
  const TRAVELLER_GENDERS = Object.freeze(['male', 'female']);
  const AUTHORED_PAIR_GENDERS = Object.freeze(['male', 'female']);
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
    // The original pair-v2/stretch-b remains quarantined because its low-alpha
    // black matte covered almost the whole source stage. The v155 sibling is a
    // separately generated, alpha-audited frame on the same 1536px contract.
    stretch: { label: 'Мягкая растяжка', duration: 16000, state: 'restoring', pairFrames: ['stretch-a', 'stretch-soft-b'] },
  });
  const FRAME_CALIBRATION = Object.freeze({
    compress: Object.freeze({ scale: 1.1 }),
    extend: Object.freeze({ scale: 1 }),
    stretch: Object.freeze({ scale: 1 }),
    sleep: Object.freeze({ scale: 1.02 }),
    helpers: Object.freeze({ scale: 1 }),
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

  function normalizeTravellerGender(value) {
    if (value === undefined) return 'male';
    const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return TRAVELLER_GENDERS.includes(candidate) ? candidate : null;
  }

  function pairGender(value, element) {
    if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) return normalizeTravellerGender(value);
    const config = value && typeof value === 'object' ? value : null;
    if (config && Object.prototype.hasOwnProperty.call(config, 'gender')) return normalizeTravellerGender(config.gender);
    if (config && Object.prototype.hasOwnProperty.call(config, 'travellerGender')) return normalizeTravellerGender(config.travellerGender);
    const authored = element && element.dataset && element.dataset.travellerGender;
    return normalizeTravellerGender(authored);
  }

  function hasPairArt(gender) {
    return AUTHORED_PAIR_GENDERS.includes(normalizeTravellerGender(gender));
  }

  function pairFrameSrc(frame, gender) {
    const allowed = new Set(Object.values(INTERACTIONS).flatMap((item) => item.pairFrames));
    const safe = allowed.has(frame) ? frame : 'greet-contact';
    const safeGender = normalizeTravellerGender(gender);
    if (!safeGender) return null;
    const genderPath = safeGender === 'female' ? 'female/f2-v1/' : '';
    if (safe === 'stretch-soft-b') return `${PAIR_V155_ART_ROOT}${genderPath}stretch-soft-b-v155.png?v=20260814-1`;
    return `${PAIR_ART_ROOT}${genderPath}${safe}.png?v=20260806-2`;
  }

  function frameSrc(state, animated) {
    const safe = normalizeState(state);
    // The original GIF was exported on an opaque black preview plate.  A calm
    // resident must therefore use the canonical transparent state plate; its
    // visible motion is scheduled from the authored solo frames below.
    return stateSrc(safe);
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

  function prefetch(options) {
    const gender = pairGender(options);
    const pairSources = hasPairArt(gender)
      ? Object.values(INTERACTIONS).flatMap((item) => item.pairFrames.map((frame) => pairFrameSrc(frame, gender)))
      : [];
    const sources = STATES.map(stateSrc)
      .concat([frameSrc('calm', true)])
      .concat(Object.keys(MOTION_FRAMES).map(motionFrameSrc))
      .concat(pairSources);
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
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options);
    if (!gender) return '';
    const classes = ['recovery-pair-v2', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-recovery-pair-v2 data-mode="greet" data-traveller-gender="${gender}" aria-hidden="true"><span class="recovery-pair-v2__stage"></span></span>`;
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

  function pairImages(mode, gender) {
    return (INTERACTIONS[mode] || INTERACTIONS.greet).pairFrames.map((frame, index) => {
      const image = document.createElement('img');
      image.className = `recovery-pair-v2__frame recovery-pair-v2__frame--${index === 0 ? 'a' : 'b'}`;
      image.src = pairFrameSrc(frame, gender);
      image.dataset.pairFrame = frame;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.draggable = false;
      image.decoding = 'async';
      return image;
    });
  }

  function clearPairElement(element, gender) {
    const stage = element && element.querySelector && element.querySelector('.recovery-pair-v2__stage');
    if (stage) stage.replaceChildren();
    if (element && element.classList) element.classList.remove('is-active');
    if (element && element.setAttribute) element.setAttribute('aria-hidden', 'true');
    if (element && element.dataset) {
      if (gender) element.dataset.travellerGender = gender;
      else delete element.dataset.travellerGender;
    }
    return false;
  }

  function setPairMode(element, mode, options) {
    if (!element || !INTERACTIONS[mode]) return Promise.resolve(false);
    const gender = pairGender(options, element);
    if (!hasPairArt(gender)) return Promise.resolve(clearPairElement(element, gender));
    const sources = INTERACTIONS[mode].pairFrames.map((frame) => pairFrameSrc(frame, gender));
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.recovery-pair-v2__stage');
      if (!stage) return false;
      stage.replaceChildren(...pairImages(mode, gender));
      element.dataset.mode = mode;
      element.dataset.travellerGender = gender;
      return true;
    }).catch(() => clearPairElement(element, gender));
  }

  function cancelPair(scope, restore = true) {
    if (!scope || !scope.querySelector) return false;
    const pair = scope.querySelector('[data-recovery-pair-v2]');
    if (!pair) return false;
    const controller = pairTimers.get(pair);
    if (controller && controller.timer) clearTimeout(controller.timer);
    pairTimers.delete(pair);
    pair.classList.remove('is-active');
    pair.setAttribute('aria-hidden', 'true');
    if (scope.classList) scope.classList.remove('is-recovery-pair-active');
    if (restore !== false && controller && controller.slug) {
      setState(controller.slug, controller.restoreState, { animated: true }).catch(() => {});
    }
    return Boolean(controller);
  }

  function playPair(scope, mode, options) {
    if (!scope || !INTERACTIONS[mode]) return Promise.resolve(false);
    const pair = scope.querySelector('[data-recovery-pair-v2]');
    if (!pair) return Promise.resolve(false);
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options, pair);
    const slug = config.slug || scope.querySelector('[data-recovery-slug]');
    const restoreState = slug ? normalizeState(config.restoreState || slug.dataset.state) : 'calm';
    const duration = Math.max(800, Number(config.duration) || INTERACTIONS[mode].duration);
    cancelPair(scope, true);
    if (!hasPairArt(gender)) {
      return Promise.resolve(clearPairElement(pair, gender));
    }
    return setPairMode(pair, mode, { gender }).then((ready) => {
      if (!ready || !pair.isConnected || !scope.isConnected) return false;
      scope.classList.add('is-recovery-pair-active');
      pair.classList.remove('is-active');
      void pair.offsetWidth;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      if (slug) setState(slug, INTERACTIONS[mode].state, { animated: false }).catch(() => {});
      const controller = { timer: 0, slug, restoreState };
      controller.timer = setTimeout(() => {
        if (pairTimers.get(pair) !== controller) return;
        pair.classList.remove('is-active');
        pair.setAttribute('aria-hidden', 'true');
        scope.classList.remove('is-recovery-pair-active');
        if (slug) setState(slug, restoreState, { animated: true }).catch(() => {});
        pairTimers.delete(pair);
        if (typeof config.onFinish === 'function') config.onFinish(mode);
      }, duration);
      pairTimers.set(pair, controller);
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
        const key = safeKeys[index];
        const calibration = FRAME_CALIBRATION[key] || FRAME_CALIBRATION.extend;
        const image = document.createElement('img');
        image.className = `recovery-slug-v1__frame recovery-slug-v1__motion-frame recovery-slug-v1__motion-frame--${index === 0 ? 'a' : 'b'} is-active`;
        image.src = src;
        image.dataset.actorFrame = key;
        image.style.setProperty('--actor-frame-scale', String(calibration.scale));
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
    PAIR_V155_ART_ROOT,
    TRAVELLER_GENDERS,
    AUTHORED_PAIR_GENDERS,
    STATES,
    STATE_META,
    MOTION_FRAMES,
    FRAME_CALIBRATION,
    INTERACTIONS,
    normalizeState,
    stateSrc,
    motionFrameSrc,
    normalizeTravellerGender,
    hasPairArt,
    pairFrameSrc,
    frameSrc,
    deriveState,
    prefetch,
    markup,
    pairMarkup,
    setState,
    setPairMode,
    playPair,
    cancelPair,
    playInteraction,
    reassure,
    playAmbient,
    cancelAmbient,
    installGlideFrames,
    clearGlideFrames,
  });
});
