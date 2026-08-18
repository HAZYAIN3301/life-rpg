/* Satoru MONEY / RESOURCES guardian v1.
 *
 * The guardian uses authored whole-character frames and atomic whole-pair
 * Traveller scenes. Runtime only schedules and swaps approved frames: it does
 * not slide a static actor, rebuild hand contact, or rescale the pair.
 */
(function exposeResourcesPenguin(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.ResourcesPenguinV1 = api;
    if (root.document) api.prefetch().catch(() => {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildResourcesPenguin(root) {
  'use strict';

  const VERSION = '1.1.0';
  const ART_ROOT = '/art/pets/resources-penguin-v1/';
  const PAIR_ART_ROOT = `${ART_ROOT}pair-v1/`;
  const TRAVELLER_GENDERS = Object.freeze(['male', 'female']);
  const AUTHORED_PAIR_GENDERS = Object.freeze(['male']);
  const STATES = Object.freeze(['calm', 'thriving', 'strained', 'restoring']);
  const STATE_META = Object.freeze({
    calm: { label: 'Собран', line: 'Держит цифры в порядке и не путает деньги с делом.' },
    thriving: { label: 'Уверен', line: 'Резерв растёт, а план остаётся честным.' },
    strained: { label: 'Насторожен', line: 'Бюджету нужна ясность, а не ещё одна тревожная мысль.' },
    restoring: { label: 'Пересобирает', line: 'Спокойно возвращает запас и порядок.' },
  });
  const SOLO = Object.freeze({
    blink: { duration: 900, frames: ['motion/idle-blink.png'] },
    waddle: { duration: 4200, frames: ['solo/waddle-left.png', 'solo/waddle-right.png', 'solo/waddle-left.png'] },
    coinSort: { duration: 15000, frames: ['solo/coin-sort-a.png', 'solo/coin-sort-b.png', 'solo/coin-sort-c.png'] },
    stash: { duration: 16000, frames: ['solo/stash-open.png', 'solo/stash-place.png', 'solo/stash-closed.png'] },
    ledger: { duration: 17000, frames: ['solo/ledger-read.png', 'solo/ledger-mark.png'] },
    jacketReset: { duration: 9000, frames: ['solo/jacket-reset.png'] },
    quietRest: { duration: 20000, frames: ['solo/quiet-rest.png'] },
  });
  const INTERACTIONS = Object.freeze({
    greet: { label: 'Приветствие', duration: 7200, state: 'calm', frames: ['greet-contact'] },
    budget: { label: 'Сверить бюджет', duration: 15000, state: 'calm', frames: ['budget-point', 'budget-reserve'] },
    count: { label: 'Разложить монеты', duration: 16000, state: 'thriving', frames: ['count-pass', 'count-place', 'count-stack'] },
    reserve: { label: 'Отложить резерв', duration: 15000, state: 'restoring', frames: ['reserve-offer', 'reserve-accept'] },
    focus: { label: 'Работать над ресурсами', duration: 32000, state: 'calm', frames: ['focus-work', 'focus-check', 'focus-nod'] },
    close: { label: 'Закрыть план', duration: 9000, state: 'thriving', frames: ['close-stamp'] },
  });

  const preloads = new Map();
  const controllers = new WeakMap();
  const pairControllers = new WeakMap();

  function normalizeState(value) { return STATES.includes(value) ? value : 'calm'; }
  function stateSrc(state) { return `${ART_ROOT}states/${normalizeState(state)}.png?v=20260807-1`; }
  function assetSrc(path) { return `${ART_ROOT}${path}?v=20260807-1`; }
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
  function pairSrc(frame, gender) {
    const safeGender = normalizeTravellerGender(gender);
    if (!safeGender) return null;
    const genderPath = safeGender === 'female' ? 'female/' : '';
    return `${PAIR_ART_ROOT}${genderPath}${frame}.png?v=20260807-1`;
  }
  function stateFromPetState(value) {
    return ({ hungry: 'strained', thriving: 'calm', full: 'thriving', overfed: 'restoring' })[value] || 'calm';
  }

  function preload(src) {
    if (!src || typeof root.Image === 'undefined') return Promise.resolve(src);
    if (preloads.has(src)) return preloads.get(src);
    const ready = new Promise((resolve, reject) => {
      const image = new root.Image();
      image.onload = () => Promise.resolve(typeof image.decode === 'function' ? image.decode().catch(() => {}) : null).then(() => resolve(src));
      image.onerror = () => reject(new Error(`MONEY guardian asset failed: ${src}`));
      image.decoding = 'async';
      image.src = src;
    }).catch((error) => { preloads.delete(src); throw error; });
    preloads.set(src, ready);
    return ready;
  }

  function prefetch(options) {
    const gender = pairGender(options);
    const pairSources = hasPairArt(gender)
      ? Object.values(INTERACTIONS).flatMap((item) => item.frames.map((frame) => pairSrc(frame, gender)))
      : [];
    const sources = STATES.map(stateSrc)
      .concat(Object.values(SOLO).flatMap((item) => item.frames.map(assetSrc)))
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
    const classes = ['resources-penguin-v1', config.className || ''].filter(Boolean).join(' ');
    const label = config.label || `Хранитель денег и ресурсов: ${STATE_META[state].label}`;
    return `<span class="${escapeHTML(classes)}" data-resources-penguin data-state="${state}" role="img" aria-label="${escapeHTML(label)}"><span class="resources-penguin-v1__stage"><img class="resources-penguin-v1__frame is-active" src="${stateSrc(state)}" alt="" aria-hidden="true" draggable="false" decoding="async"></span></span>`;
  }

  function pairMarkup(options) {
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options);
    if (!gender) return '';
    const classes = ['resources-pair-v1', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-resources-pair-v1 data-traveller-gender="${gender}" aria-hidden="true"><span class="resources-pair-v1__stage"></span></span>`;
  }

  function imageFor(src, className) {
    const image = root.document.createElement('img');
    image.className = className;
    image.src = src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.decoding = 'async';
    return image;
  }

  function cancel(element, restore) {
    const controller = controllers.get(element);
    if (!controller) return false;
    controller.cancelled = true;
    controller.timers.forEach(clearTimeout);
    controllers.delete(element);
    if (controller.resolve) controller.resolve(false);
    if (restore !== false) setState(element, controller.restoreState, { instant: true }).catch(() => {});
    return true;
  }

  function setState(element, state, options) {
    if (!element) return Promise.resolve(false);
    const safe = normalizeState(state);
    const src = stateSrc(safe);
    return preload(src).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.resources-penguin-v1__stage');
      if (!stage) return false;
      stage.replaceChildren(imageFor(src, 'resources-penguin-v1__frame is-active'));
      element.dataset.state = safe;
      delete element.dataset.motion;
      return true;
    });
  }

  function playSolo(element, mode, options) {
    const meta = SOLO[mode];
    if (!element || !meta || !element.isConnected) return Promise.resolve(false);
    cancel(element, false);
    const config = options || {};
    const duration = Math.max(700, Number(config.duration) || meta.duration);
    const restoreState = normalizeState(config.restoreState || element.dataset.state);
    const sources = meta.frames.map(assetSrc);
    return Promise.all(sources.map(preload)).then(() => new Promise((resolve) => {
      if (!element.isConnected) return resolve(false);
      const stage = element.querySelector('.resources-penguin-v1__stage');
      if (!stage) return resolve(false);
      const controller = { cancelled: false, timers: [], resolve, restoreState };
      controllers.set(element, controller);
      element.dataset.motion = mode;
      const step = duration / sources.length;
      sources.forEach((src, index) => {
        const timer = setTimeout(() => {
          if (controller.cancelled || !element.isConnected) return;
          stage.replaceChildren(imageFor(src, 'resources-penguin-v1__frame is-active'));
        }, Math.round(index * step));
        controller.timers.push(timer);
      });
      controller.timers.push(setTimeout(() => {
        if (controllers.get(element) !== controller) return;
        controllers.delete(element);
        setState(element, restoreState, { instant: true }).finally(() => resolve(true));
      }, duration));
    }));
  }

  function clearWaddleFrames(element, restoreState) {
    cancel(element, false);
    return setState(element, restoreState || element.dataset.state, { instant: true });
  }

  function installWaddleFrames(element, direction) {
    if (!element) return Promise.resolve(false);
    cancel(element, false);
    const sources = SOLO.waddle.frames.slice(0, 2).map(assetSrc);
    return Promise.all(sources.map(preload)).then(() => {
      if (!element.isConnected) return false;
      const stage = element.querySelector('.resources-penguin-v1__stage');
      if (!stage) return false;
      stage.replaceChildren(
        imageFor(sources[0], 'resources-penguin-v1__frame resources-penguin-v1__waddle-a'),
        imageFor(sources[1], 'resources-penguin-v1__frame resources-penguin-v1__waddle-b'),
      );
      element.dataset.resourcesDirection = direction === 'home' ? 'home' : 'meeting';
      element.dataset.motion = 'waddle-route';
      return true;
    });
  }

  function setPairFrame(pair, frame, gender) {
    const stage = pair && pair.querySelector('.resources-pair-v1__stage');
    if (!stage) return false;
    stage.replaceChildren(imageFor(pairSrc(frame, gender), 'resources-pair-v1__frame'));
    pair.dataset.frame = frame;
    pair.dataset.travellerGender = normalizeTravellerGender(gender);
    return true;
  }

  function clearPairElement(pair, gender) {
    const stage = pair && pair.querySelector && pair.querySelector('.resources-pair-v1__stage');
    if (stage) stage.replaceChildren();
    if (pair && pair.classList) pair.classList.remove('is-active');
    if (pair && pair.setAttribute) pair.setAttribute('aria-hidden', 'true');
    if (pair && pair.dataset) {
      if (gender) pair.dataset.travellerGender = gender;
      else delete pair.dataset.travellerGender;
    }
    return false;
  }

  function cancelPair(scope) {
    if (!scope || !scope.querySelector) return false;
    const pair = scope.querySelector('[data-resources-pair-v1]');
    if (!pair) return false;
    const timers = pairControllers.get(pair);
    if (timers) timers.forEach(clearTimeout);
    pairControllers.delete(pair);
    pair.classList.remove('is-active');
    pair.setAttribute('aria-hidden', 'true');
    if (scope.classList) scope.classList.remove('is-resources-pair-active');
    return Boolean(timers);
  }

  function playPair(scope, mode, options) {
    const meta = INTERACTIONS[mode];
    const pair = scope && scope.querySelector('[data-resources-pair-v1]');
    if (!scope || !pair || !meta) return Promise.resolve(false);
    cancelPair(scope);
    const config = options && typeof options === 'object' ? options : {};
    const gender = pairGender(options, pair);
    if (!hasPairArt(gender)) return Promise.resolve(clearPairElement(pair, gender));
    const duration = Math.max(900, Number(config.duration) || meta.duration);
    const sources = meta.frames.map((frame) => pairSrc(frame, gender));
    return Promise.all(sources.map(preload)).then(() => {
      if (!scope.isConnected || !pair.isConnected) return false;
      const timers = [];
      pairControllers.set(pair, timers);
      pair.dataset.mode = mode;
      setPairFrame(pair, meta.frames[0], gender);
      scope.classList.add('is-resources-pair-active');
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'false');
      const step = duration / meta.frames.length;
      meta.frames.slice(1).forEach((frame, offset) => {
        timers.push(setTimeout(() => pair.isConnected && setPairFrame(pair, frame, gender), Math.round((offset + 1) * step)));
      });
      timers.push(setTimeout(() => {
        pair.classList.remove('is-active');
        pair.setAttribute('aria-hidden', 'true');
        scope.classList.remove('is-resources-pair-active');
        pairControllers.delete(pair);
      }, duration));
      return true;
    }).catch(() => {
      if (scope.classList) scope.classList.remove('is-resources-pair-active');
      return clearPairElement(pair, gender);
    });
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    PAIR_ART_ROOT,
    TRAVELLER_GENDERS,
    AUTHORED_PAIR_GENDERS,
    STATES,
    STATE_META,
    SOLO,
    INTERACTIONS,
    stateFromPetState,
    stateSrc,
    assetSrc,
    normalizeTravellerGender,
    hasPairArt,
    pairSrc,
    preload,
    prefetch,
    markup,
    pairMarkup,
    setState,
    playSolo,
    playPair,
    cancelPair,
    installWaddleFrames,
    clearWaddleFrames,
    cancel,
  });
});
