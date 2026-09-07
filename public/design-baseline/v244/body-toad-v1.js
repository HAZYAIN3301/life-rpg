/* Satoru BODY Guardian v2.
 *
 * Production contract:
 * - one approved 1024x1024 cut-paper character;
 * - four authored visual states;
 * - one deterministic seamless idle loop;
 * - authored male and F2-female Traveller contact frames share one 1536x1536 stage;
 * - no sliced-joint theatre and no viewport-specific coordinates;
 * - image swaps are decoded before the visible frame changes.
 */
(function exposeBodyToad(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.BodyToadV1 = api;
    if (root.document) api.prefetch().catch(() => {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBodyToadV1() {
  'use strict';

  const VERSION = '3.6.1';
  const ART_ROOT = '/art/pets/body-toad-v1/';
  const PAIR_ART_ROOT = `${ART_ROOT}pair-v4/`;
  const ACTION_PAIR_ART_ROOT = PAIR_ART_ROOT;
  const MOTION_ART_ROOT = `${ART_ROOT}motion-v4/`;
  const TRAVELLER_GENDERS = Object.freeze(['male', 'female']);
  // Both entries are complete authored packs. Explicit female requests stay
  // on the immutable F2 subtree and may never borrow a male contact plate.
  const AUTHORED_PAIR_GENDERS = Object.freeze(['male', 'female']);
  const STATES = Object.freeze(['calm', 'thriving', 'strained', 'restoring']);
  const STATE_META = Object.freeze({
    calm: { label: 'Спокоен', line: 'Держит стойку и следит за ритмом.' },
    thriving: { label: 'В форме', line: 'Грудь колесом: тело отвечает на заботу.' },
    strained: { label: 'Перегружен', line: 'Хмурится: нагрузку пора уравновесить.' },
    restoring: { label: 'Восстанавливается', line: 'Сбавил темп и возвращает силу.' },
  });
  const INTERACTIONS = Object.freeze({
    greet: { label: 'Поприветствовать', duration: 4200, state: 'calm', pairFrames: ['greet-contact'] },
    train: { label: 'Размяться вместе', duration: 8000, state: 'thriving', pairFrames: ['train-low', 'train-high'] },
    whistle: { label: 'Команда сэнсэя', duration: 9000, state: 'thriving', pairFrames: ['whistle-a', 'whistle-b', 'whistle-c', 'whistle-d'] },
    pushup: { label: 'Отжимания', duration: 9000, state: 'thriving', pairFrames: ['pushup-down', 'pushup-up'] },
    stretch: { label: 'Растяжка', duration: 10000, state: 'restoring', pairFrames: ['stretch-a', 'stretch-b'] },
    rest: { label: 'Погладить и передохнуть', duration: 8000, state: 'restoring', pairFrames: ['rest-contact', 'rest-pet'] },
  });
  const PET_STATE_MAP = Object.freeze({
    hungry: 'strained',
    growing: 'calm',
    full: 'thriving',
    overfed: 'restoring',
  });
  const reactionTimers = new WeakMap();
  const pairTimers = new WeakMap();
  const ambientControllers = new WeakMap();
  const preloads = new Map();
  const MOTION_FRAMES = Object.freeze({
    blink: 'idle-blink.png',
    calm: '../states/calm.png',
    crouch: 'hop-crouch.png',
    air: 'hop-air.png',
    stretch: 'solo-stretch.png',
    stretchUp: 'solo-stretch-up.png',
    sleep: 'bench-sleep.png',
  });
  // Full-frame art keeps one 1024px stage.  Calibration corrects source crop
  // variance inside that stage; room perspective remains solely on the outer
  // actor host.  In-place acting can therefore never resize the room actor.
  const FRAME_CALIBRATION = Object.freeze({
    blink: Object.freeze({ scale: 1 }),
    calm: Object.freeze({ scale: 1 }),
    crouch: Object.freeze({ scale: 1.01 }),
    air: Object.freeze({ scale: 1.12 }),
    stretch: Object.freeze({ scale: 1.12 }),
    stretchUp: Object.freeze({ scale: 1.04 }),
    sleep: Object.freeze({ scale: 1.02 }),
  });

  function normalizeState(value) {
    return STATES.includes(value) ? value : 'calm';
  }

  function stateFromPetState(value) {
    return PET_STATE_MAP[value] || normalizeState(value);
  }

  function stateSrc(state) {
    return `${ART_ROOT}states/${normalizeState(state)}.png`;
  }

  function motionFrameSrc(key) {
    return `${MOTION_ART_ROOT}${MOTION_FRAMES[key] || MOTION_FRAMES.blink}?v=20260806-3`;
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

  function frameSrc(state, animated) {
    const safe = normalizeState(state);
    return stateSrc(safe);
  }

  function pairFrameSrc(frame, gender) {
    const allowed = new Set(Object.values(INTERACTIONS).flatMap((interaction) => interaction.pairFrames));
    const safe = allowed.has(frame) ? frame : 'rest-contact';
    const safeGender = normalizeTravellerGender(gender);
    if (!safeGender) return null;
    const genderPath = safeGender === 'female' ? 'female/f2-v1/' : '';
    if (safeGender === 'female' && safe === 'stretch-b') {
      return `${PAIR_ART_ROOT}${genderPath}stretch-b-v183.png`;
    }
    return `${PAIR_ART_ROOT}${genderPath}${safe}.png?v=20260806-3`;
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
      image.addEventListener('error', () => reject(new Error(`BODY Guardian asset failed: ${src}`)), { once: true });
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
      ? Object.values(INTERACTIONS).flatMap((interaction) => interaction.pairFrames.map((frame) => pairFrameSrc(frame, gender)))
      : [];
    const motionSources = Object.keys(MOTION_FRAMES).map(motionFrameSrc);
    const sources = STATES.map(stateSrc).concat(pairSources, motionSources);
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
    const classes = ['body-toad-v1', config.className || ''].filter(Boolean).join(' ');
    const label = config.label || `Хранитель тела: ${STATE_META[state].label}`;
    return `<span class="${escapeHTML(classes)}" data-body-toad data-state="${state}" data-animated="${animated ? 'true' : 'false'}" role="img" aria-label="${escapeHTML(label)}"><span class="body-toad-v1__stage"><img class="body-toad-v1__frame is-active" src="${frameSrc(state, animated)}" alt="" aria-hidden="true" draggable="false" decoding="async"></span></span>`;
  }

  function pairMarkup(options) {
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options);
    if (!gender) return '';
    const classes = ['body-pair-v2', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-body-pair-v2 data-mode="rest" data-traveller-gender="${gender}" aria-hidden="true"><span class="body-pair-v2__stage"></span></span>`;
  }

  function pairImages(mode, gender) {
    const interaction = INTERACTIONS[mode] || INTERACTIONS.rest;
    return interaction.pairFrames.map((frame, index) => {
      const image = document.createElement('img');
      image.className = `body-pair-v2__frame body-pair-v2__frame--${['a', 'b', 'c', 'd'][index] || 'a'}`;
      image.src = pairFrameSrc(frame, gender);
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.draggable = false;
      image.decoding = 'async';
      return image;
    });
  }

  function clearPairElement(element, gender) {
    const stage = element && element.querySelector && element.querySelector('.body-pair-v2__stage');
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
    const interaction = INTERACTIONS[mode];
    const sources = interaction.pairFrames.map((frame) => pairFrameSrc(frame, gender));
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.body-pair-v2__stage');
      if (!stage) return false;
      stage.replaceChildren(...pairImages(mode, gender));
      element.dataset.mode = mode;
      element.dataset.travellerGender = gender;
      return true;
    }).catch(() => clearPairElement(element, gender));
  }

  function cancelPair(scope, restore = true) {
    if (!scope || !scope.querySelector) return false;
    const pair = scope.querySelector('[data-body-pair-v2]');
    if (!pair) return false;
    const controller = pairTimers.get(pair);
    if (controller && controller.timer) clearTimeout(controller.timer);
    pairTimers.delete(pair);
    pair.classList.remove('is-active');
    pair.setAttribute('aria-hidden', 'true');
    if (scope.classList) scope.classList.remove('is-body-pair-active');
    if (restore !== false && controller && controller.toad) {
      setState(controller.toad, controller.restoreState, { animated: true }).catch(() => {});
    }
    return Boolean(controller);
  }

  function playPair(scope, mode, options) {
    if (!scope || !INTERACTIONS[mode]) return Promise.resolve(false);
    const pair = scope.querySelector('[data-body-pair-v2]');
    if (!pair) return Promise.resolve(false);
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options, pair);
    const duration = Math.max(400, Number(config.duration) || INTERACTIONS[mode].duration);
    const toad = config.toad || scope.querySelector('[data-body-toad]');
    const previousState = toad ? normalizeState(config.restoreState || toad.dataset.state) : 'calm';
    cancelPair(scope, true);
    if (!hasPairArt(gender)) {
      return Promise.resolve(clearPairElement(pair, gender));
    }
    return setPairMode(pair, mode, { gender }).then((ready) => {
      if (!ready || !pair.isConnected || !scope.isConnected) return false;
      scope.classList.add('is-body-pair-active');
      pair.classList.remove('is-active');
      void pair.offsetWidth;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      if (toad) setState(toad, INTERACTIONS[mode].state, { animated: false }).catch(() => {});
      const controller = { timer: 0, toad, restoreState: previousState };
      controller.timer = setTimeout(() => {
        if (pairTimers.get(pair) !== controller) return;
        pair.classList.remove('is-active');
        pair.setAttribute('aria-hidden', 'true');
        scope.classList.remove('is-body-pair-active');
        if (toad) setState(toad, previousState, { animated: true }).catch(() => {});
        pairTimers.delete(pair);
        if (typeof config.onFinish === 'function') config.onFinish(mode);
      }, duration);
      pairTimers.set(pair, controller);
      return true;
    });
  }

  function setState(element, state, options) {
    if (!element) return Promise.resolve(null);
    const safe = normalizeState(state);
    const config = options || {};
    const animated = config.animated !== false && element.dataset.animated !== 'false';
    const src = frameSrc(safe, animated);
    const active = element.querySelector('.body-toad-v1__frame.is-active');
    const activeUrl = active ? new URL(active.src, location.href) : null;
    const targetUrl = new URL(src, location.href);
    if (activeUrl && activeUrl.pathname === targetUrl.pathname && activeUrl.search === targetUrl.search) {
      element.dataset.state = safe;
      return Promise.resolve(element);
    }
    return preload(src).then(() => {
      if (!element.isConnected) return element;
      const stage = element.querySelector('.body-toad-v1__stage');
      if (!stage) return element;
      const next = document.createElement('img');
      next.className = `body-toad-v1__frame ${config.instant === true ? 'is-active' : 'is-incoming'}`;
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
        if (active) active.classList.add('is-outgoing');
        setTimeout(() => {
          if (active && active.isConnected) active.remove();
          next.classList.remove('is-outgoing');
        }, 240);
      }));
      return element;
    });
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

  function motionHost(element) {
    return element && element.closest ? (element.closest('.den-body-toad') || element) : element;
  }

  function replaceMotionFrames(element, keys, motion) {
    if (!element) return Promise.resolve(false);
    const safeKeys = Array.isArray(keys) ? keys : [keys];
    const sources = safeKeys.map(motionFrameSrc);
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.body-toad-v1__stage');
      if (!stage) return false;
      const frames = sources.map((src, index) => {
        const key = safeKeys[index];
        const calibration = FRAME_CALIBRATION[key] || FRAME_CALIBRATION.blink;
        const image = document.createElement('img');
        image.className = `body-toad-v1__frame body-toad-v1__motion-frame body-toad-v1__motion-frame--${index === 0 ? 'a' : 'b'} is-active`;
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
      delete host.dataset.toadMotion;
      delete host.dataset.toadRoute;
      delete host.dataset.toadDirection;
    }
    if (shell) shell.classList.remove('is-toad-ambient-active');
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

  async function installHopFrames(element, direction) {
    if (!element) return false;
    cancelAmbient(element, false);
    const ready = await replaceMotionFrames(element, ['crouch', 'air'], 'approach-hop');
    if (!ready) return false;
    const host = motionHost(element);
    if (host && host.dataset) {
      host.dataset.toadApproach = direction === 'home' ? 'home' : 'meeting';
      host.dataset.toadDirection = direction === 'home' ? 'left' : 'right';
    }
    return true;
  }

  function clearHopFrames(element, restoreState) {
    const host = motionHost(element);
    if (host && host.dataset) {
      delete host.dataset.toadApproach;
      delete host.dataset.toadDirection;
    }
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
    if (shell) shell.classList.add('is-toad-ambient-active');
    if (host && host.dataset) host.dataset.toadMotion = mode;
    const show = (key) => replaceMotionFrames(element, key, mode);
    const wait = (ms) => waitFor(controller, ms);
    try {
      if (mode === 'blink') {
        if (!(await show('blink'))) return false;
        return await wait(520);
      }
      if (mode === 'solo-stretch') {
        if (!(await show(['stretch', 'stretchUp']))) return false;
        return await wait(Math.max(8000, Number(config.duration) || 10800));
      }
      if (mode === 'bench-nap') {
        if (!(await show('crouch')) || !(await wait(320))) return false;
        if (host && host.dataset) host.dataset.toadDirection = 'right';
        await show('air');
        if (host && host.dataset) host.dataset.toadRoute = 'bench';
        if (!(await wait(1800))) return false;
        await show('sleep');
        if (!(await wait(Math.max(14000, Number(config.duration) || 18000)))) return false;
        if (host && host.dataset) host.dataset.toadDirection = 'left';
        await show('air');
        if (host && host.dataset) host.dataset.toadRoute = 'home';
        if (!(await wait(2200))) return false;
        await show('crouch');
        return await wait(340);
      }
      if (mode === 'hop-tour') {
        if (!(await show('crouch')) || !(await wait(320))) return false;
        if (host && host.dataset) host.dataset.toadDirection = 'right';
        await show('air');
        if (host && host.dataset) host.dataset.toadRoute = 'away';
        if (!(await wait(1500))) return false;
        await show('calm');
        if (!(await wait(Math.max(6000, Number(config.dwellMs) || 8200)))) return false;
        await show('crouch');
        if (!(await wait(320))) return false;
        if (host && host.dataset) host.dataset.toadDirection = 'left';
        await show('air');
        if (host && host.dataset) host.dataset.toadRoute = 'home';
        if (!(await wait(1500))) return false;
        await show('crouch');
        return await wait(340);
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
    const avatar = config.avatar || null;
    const interaction = INTERACTIONS[mode];
    const previousState = normalizeState(config.restoreState || element.dataset.state);
    const oldTimer = reactionTimers.get(element);
    if (oldTimer) clearTimeout(oldTimer);
    element.dataset.interaction = mode;
    element.classList.remove('is-reacting');
    void element.offsetWidth;
    element.classList.add('is-reacting');
    if (avatar) avatar.dataset.toadInteraction = mode;
    return setState(element, interaction.state, { animated: mode === 'greet' }).catch(() => element).then(() => {
      const timer = setTimeout(() => {
        element.classList.remove('is-reacting');
        delete element.dataset.interaction;
        if (avatar && avatar.dataset.toadInteraction === mode) delete avatar.dataset.toadInteraction;
        setState(element, previousState, { animated: true }).catch(() => {});
        reactionTimers.delete(element);
      }, interaction.duration);
      reactionTimers.set(element, timer);
      return true;
    });
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    PAIR_ART_ROOT,
    ACTION_PAIR_ART_ROOT,
    MOTION_ART_ROOT,
    MOTION_FRAMES,
    FRAME_CALIBRATION,
    TRAVELLER_GENDERS,
    AUTHORED_PAIR_GENDERS,
    STATES,
    STATE_META,
    INTERACTIONS,
    normalizeState,
    stateFromPetState,
    stateSrc,
    frameSrc,
    motionFrameSrc,
    normalizeTravellerGender,
    hasPairArt,
    pairFrameSrc,
    prefetch,
    markup,
    pairMarkup,
    setState,
    playInteraction,
    setPairMode,
    playPair,
    cancelPair,
    installHopFrames,
    clearHopFrames,
    playAmbient,
    cancelAmbient,
  });
});
