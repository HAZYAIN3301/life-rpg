/* Satoru BODY Guardian v2.
 *
 * Production contract:
 * - one approved 1024x1024 cut-paper character;
 * - four authored visual states;
 * - one deterministic seamless idle loop;
 * - authored male-Traveller contact frames share one 1536x1536 stage;
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

  const VERSION = '2.0.0';
  const ART_ROOT = '/art/pets/body-toad-v1/';
  const PAIR_ART_ROOT = `${ART_ROOT}pair-v2/`;
  const STATES = Object.freeze(['calm', 'thriving', 'strained', 'restoring']);
  const STATE_META = Object.freeze({
    calm: { label: 'Спокоен', line: 'Держит стойку и следит за ритмом.' },
    thriving: { label: 'В форме', line: 'Грудь колесом: тело отвечает на заботу.' },
    strained: { label: 'Перегружен', line: 'Хмурится: нагрузку пора уравновесить.' },
    restoring: { label: 'Восстанавливается', line: 'Сбавил темп и возвращает силу.' },
  });
  const INTERACTIONS = Object.freeze({
    greet: { label: 'Поприветствовать', duration: 1500, state: 'calm', pairFrames: ['greet-contact'] },
    train: { label: 'Размяться вместе', duration: 2800, state: 'thriving', pairFrames: ['train-low', 'train-high'] },
    rest: { label: 'Погладить и передохнуть', duration: 3000, state: 'restoring', pairFrames: ['rest-contact', 'rest-pet'] },
  });
  const PET_STATE_MAP = Object.freeze({
    hungry: 'strained',
    growing: 'calm',
    full: 'thriving',
    overfed: 'restoring',
  });
  const reactionTimers = new WeakMap();
  const pairTimers = new WeakMap();
  const preloads = new Map();

  function normalizeState(value) {
    return STATES.includes(value) ? value : 'calm';
  }

  function stateFromPetState(value) {
    return PET_STATE_MAP[value] || normalizeState(value);
  }

  function stateSrc(state) {
    return `${ART_ROOT}states/${normalizeState(state)}.png`;
  }

  function frameSrc(state, animated) {
    const safe = normalizeState(state);
    return animated && safe === 'calm'
      ? `${ART_ROOT}motion/idle-breath.gif`
      : stateSrc(safe);
  }

  function pairFrameSrc(frame) {
    const allowed = new Set(['rest-contact', 'rest-pet', 'greet-contact', 'train-low', 'train-high']);
    const safe = allowed.has(frame) ? frame : 'rest-contact';
    return `${PAIR_ART_ROOT}${safe}.png`;
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

  function prefetch() {
    const pairSources = Object.values(INTERACTIONS).flatMap((interaction) => interaction.pairFrames.map(pairFrameSrc));
    const sources = STATES.map(stateSrc).concat(`${ART_ROOT}motion/idle-breath.gif`, pairSources);
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
    const config = options || {};
    const classes = ['body-pair-v2', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-body-pair-v2 data-mode="rest" aria-hidden="true"><span class="body-pair-v2__stage"></span></span>`;
  }

  function pairImages(mode) {
    const interaction = INTERACTIONS[mode] || INTERACTIONS.rest;
    return interaction.pairFrames.map((frame, index) => {
      const image = document.createElement('img');
      image.className = `body-pair-v2__frame body-pair-v2__frame--${index === 0 ? 'a' : 'b'}`;
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
    const interaction = INTERACTIONS[mode];
    const sources = interaction.pairFrames.map(pairFrameSrc);
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.body-pair-v2__stage');
      if (!stage) return false;
      stage.replaceChildren(...pairImages(mode));
      element.dataset.mode = mode;
      return true;
    });
  }

  function playPair(scope, mode, options) {
    if (!scope || !INTERACTIONS[mode]) return Promise.resolve(false);
    const pair = scope.querySelector('[data-body-pair-v2]');
    if (!pair) return Promise.resolve(false);
    const config = options || {};
    const toad = config.toad || scope.querySelector('[data-body-toad]');
    const previousState = toad ? normalizeState(config.restoreState || toad.dataset.state) : 'calm';
    const oldTimer = pairTimers.get(pair);
    if (oldTimer) clearTimeout(oldTimer);
    return setPairMode(pair, mode).then((ready) => {
      if (!ready || !pair.isConnected || !scope.isConnected) return false;
      scope.classList.add('is-body-pair-active');
      pair.classList.remove('is-active');
      void pair.offsetWidth;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      if (toad) setState(toad, INTERACTIONS[mode].state, { animated: false }).catch(() => {});
      const timer = setTimeout(() => {
        pair.classList.remove('is-active');
        pair.setAttribute('aria-hidden', 'true');
        scope.classList.remove('is-body-pair-active');
        if (toad) setState(toad, previousState, { animated: true }).catch(() => {});
        pairTimers.delete(pair);
      }, INTERACTIONS[mode].duration);
      pairTimers.set(pair, timer);
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
    if (active && new URL(active.src, location.href).pathname === src) {
      element.dataset.state = safe;
      return Promise.resolve(element);
    }
    return preload(src).then(() => {
      if (!element.isConnected) return element;
      const stage = element.querySelector('.body-toad-v1__stage');
      if (!stage) return element;
      const next = document.createElement('img');
      next.className = 'body-toad-v1__frame is-incoming';
      next.src = src;
      next.alt = '';
      next.setAttribute('aria-hidden', 'true');
      next.draggable = false;
      next.decoding = 'async';
      stage.appendChild(next);
      element.dataset.state = safe;
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
    STATES,
    STATE_META,
    INTERACTIONS,
    normalizeState,
    stateFromPetState,
    stateSrc,
    frameSrc,
    pairFrameSrc,
    prefetch,
    markup,
    pairMarkup,
    setState,
    playInteraction,
    setPairMode,
    playPair,
  });
});
