/* Satoru Shadow Den v1.
 *
 * Gives the current Shadow form the same Den contract as canonical guardians:
 * authored solo beats, live room-scale Traveller meetings, deterministic
 * cleanup, and no identity fallback to a different evolution tier.
 */
(function exposeShadowDen(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.ShadowDenV1 = api;
    if (root.document) api.prefetch().catch(() => {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildShadowDen(root) {
  'use strict';

  const VERSION = '1.3.0';
  const ART_ROOT = '/art/companions/shadow-den-v1/pair-v1/';
  const TRAVELLER_GENDERS = Object.freeze(['male', 'female']);
  const AUTHORED_PAIR_GENDERS = Object.freeze(['male']);
  const FORMS = Object.freeze(['spark', 'spirit', 'guardian', 'keeper']);
  const SOLO = Object.freeze({
    greet: Object.freeze({ label: 'Откликнуться', state: 'happy', duration: 3200 }),
    listen: Object.freeze({ label: 'Прислушаться', state: 'listening', duration: 6200 }),
    think: Object.freeze({ label: 'Подумать вместе', state: 'thinking', duration: 7200 }),
    speak: Object.freeze({ label: 'Поговорить', state: 'speaking', duration: 7000 }),
  });
  const INTERACTIONS = Object.freeze({
    attune: Object.freeze({ label: 'Свериться', duration: 7600 }),
    rest: Object.freeze({ label: 'Побыть рядом', duration: 12000 }),
    silence: Object.freeze({ label: 'Разделить тишину', duration: 16000 }),
  });

  const preloads = new Map();
  const soloControllers = new WeakMap();
  const pairControllers = new WeakMap();

  function normalizeTier(value) {
    const tier = Number(value);
    return Number.isFinite(tier) ? Math.max(0, Math.min(FORMS.length - 1, Math.round(tier))) : 0;
  }

  function formForTier(value) { return FORMS[normalizeTier(value)]; }
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
  function pairSrc(value, gender) {
    const safeGender = normalizeTravellerGender(gender);
    if (!safeGender) return null;
    const genderPath = safeGender === 'female' ? 'female/' : '';
    return `${ART_ROOT}${genderPath}attune-${formForTier(value)}.png?v=20260811-1`;
  }

  function preload(src) {
    if (!src || typeof root.Image === 'undefined') return Promise.resolve(src);
    if (preloads.has(src)) return preloads.get(src);
    const ready = new Promise((resolve, reject) => {
      const image = new root.Image();
      image.onload = () => Promise.resolve(typeof image.decode === 'function' ? image.decode().catch(() => {}) : null).then(() => resolve(src));
      image.onerror = () => reject(new Error(`Shadow Den asset failed: ${src}`));
      image.decoding = 'async';
      image.src = src;
    }).catch((error) => { preloads.delete(src); throw error; });
    preloads.set(src, ready);
    return ready;
  }

  // Approach and return use live rigs; contact uses one authored atomic plate.
  // This keeps locomotion directional while making the hand touch, gaze and
  // shared lighting readable without a caption for all four evolutions.
  function prefetch(options) {
    const gender = pairGender(options);
    const sources = hasPairArt(gender) ? FORMS.map((_, tier) => pairSrc(tier, gender)) : [];
    return Promise.allSettled(sources.map(preload));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pairMarkup(options) {
    const config = options && typeof options === 'object' ? options : {};
    const tier = normalizeTier(config.tier);
    const gender = pairGender(options);
    if (!gender) return '';
    const classes = ['shadow-den-pair-v1', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-shadow-den-pair data-tier="${tier}" data-form="${formForTier(tier)}" data-mode="attune" data-traveller-gender="${gender}" aria-hidden="true"><span class="shadow-den-pair-v1__stage"></span></span>`;
  }

  function clearPairElement(pair, gender) {
    const stage = pair && pair.querySelector && pair.querySelector('.shadow-den-pair-v1__stage');
    if (stage) stage.replaceChildren();
    if (pair && pair.classList) pair.classList.remove('is-active');
    if (pair && pair.setAttribute) pair.setAttribute('aria-hidden', 'true');
    if (pair && pair.dataset) {
      if (gender) pair.dataset.travellerGender = gender;
      else delete pair.dataset.travellerGender;
    }
    return false;
  }

  function installPairImage(pair, tier, options) {
    const gender = pairGender(options, pair);
    if (!hasPairArt(gender)) return Promise.resolve(clearPairElement(pair, gender));
    const src = pairSrc(tier, gender);
    return preload(src).then(() => {
      if (!pair || !pair.isConnected || !root.document) return false;
      const stage = pair.querySelector('.shadow-den-pair-v1__stage');
      if (!stage) return false;
      const image = root.document.createElement('img');
      image.className = 'shadow-den-pair-v1__frame';
      image.src = src;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.draggable = false;
      image.decoding = 'async';
      stage.replaceChildren(image);
      pair.dataset.travellerGender = gender;
      return true;
    }).catch(() => clearPairElement(pair, gender));
  }

  function rigInside(element) {
    if (!element) return null;
    return element.matches && element.matches('[data-shadow-rig]')
      ? element
      : element.querySelector && element.querySelector('[data-shadow-rig]');
  }

  function cancelSolo(element, restore) {
    const controller = element && soloControllers.get(element);
    if (!controller) return false;
    clearTimeout(controller.timer);
    soloControllers.delete(element);
    element.classList.remove('is-shadow-den-solo');
    delete element.dataset.shadowDenMode;
    if (restore !== false && root.ShadowRig) root.ShadowRig.setState(rigInside(element), controller.restoreState);
    if (controller.resolve) controller.resolve(false);
    return true;
  }

  function playSolo(element, mode, options) {
    const meta = SOLO[mode];
    const rig = rigInside(element);
    if (!element || !rig || !meta || !element.isConnected) return Promise.resolve(false);
    cancelSolo(element, false);
    const config = options || {};
    const restoreState = String(config.restoreState || rig.dataset.shadowState || 'calm');
    const duration = Math.max(600, Number(config.duration) || meta.duration);
    if (root.ShadowRig) root.ShadowRig.setState(rig, meta.state);
    element.classList.add('is-shadow-den-solo');
    element.dataset.shadowDenMode = mode;
    return new Promise((resolve) => {
      const controller = { resolve, restoreState, timer: 0 };
      controller.timer = setTimeout(() => {
        if (soloControllers.get(element) !== controller) return;
        soloControllers.delete(element);
        if (element.isConnected) {
          element.classList.remove('is-shadow-den-solo');
          delete element.dataset.shadowDenMode;
          if (root.ShadowRig) root.ShadowRig.setState(rigInside(element), restoreState);
        }
        resolve(true);
      }, duration);
      soloControllers.set(element, controller);
    });
  }

  function pairElement(scope) { return scope && scope.querySelector ? scope.querySelector('[data-shadow-den-pair]') : null; }

  function cancelPair(scope, restore = true) {
    const pair = pairElement(scope);
    if (!pair) return false;
    const controller = pairControllers.get(pair);
    if (controller) controller.timers.forEach(clearTimeout);
    pairControllers.delete(pair);
    pair.classList.remove('is-active');
    pair.setAttribute('aria-hidden', 'true');
    if (scope && scope.classList) scope.classList.remove('is-shadow-pair-active');
    if (scope && scope.dataset) delete scope.dataset.shadowPairPhase;
    const companion = scope && scope.querySelector ? scope.querySelector('[data-shadow-den]') : null;
    if (companion) delete companion.dataset.shadowPairPhase;
    if (restore !== false && controller && controller.rig && root.ShadowRig) {
      root.ShadowRig.setState(controller.rig, controller.restoreState);
    }
    return Boolean(controller);
  }

  function pairStates(mode) {
    if (mode === 'rest') return ['caring', 'sleepy', 'caring'];
    if (mode === 'silence') return ['listening', 'thinking', 'calm'];
    return ['listening', 'caring', 'happy'];
  }

  function playPair(scope, mode, options) {
    const meta = INTERACTIONS[mode];
    const pair = pairElement(scope);
    if (!scope || !pair || !meta) return Promise.resolve(false);
    const config = options && typeof options === 'object' ? options : {};
    const tier = normalizeTier(config.tier == null ? pair.dataset.tier : config.tier);
    const gender = pairGender(options, pair);
    const duration = Math.max(900, Number(config.duration) || meta.duration);
    const companion = scope.querySelector('[data-shadow-den]');
    const rig = rigInside(companion);
    const restoreState = String((rig && rig.dataset.shadowState) || 'calm');
    cancelPair(scope, true);
    if (!hasPairArt(gender)) return Promise.resolve(clearPairElement(pair, gender));
    return installPairImage(pair, tier, { gender }).then((ready) => {
      if (!ready) return false;
      if (!scope.isConnected || !pair.isConnected || !companion || !rig) return false;
      pair.dataset.tier = String(tier);
      pair.dataset.form = formForTier(tier);
      pair.dataset.mode = mode;
      pair.classList.add('is-active');
      pair.setAttribute('aria-hidden', 'true');
      scope.classList.add('is-shadow-pair-active');
      const states = pairStates(mode);
      const controller = { timers: [], rig, restoreState };
      states.forEach((state, index) => {
        controller.timers.push(setTimeout(() => {
          if (pairControllers.get(pair) !== controller || !rig.isConnected) return;
          if (root.ShadowRig) root.ShadowRig.setState(rig, state);
          companion.dataset.shadowPairPhase = String(index + 1);
          scope.dataset.shadowPairPhase = String(index + 1);
        }, Math.round(index * duration / states.length)));
      });
      controller.timers.push(setTimeout(() => {
        if (pairControllers.get(pair) !== controller) return;
        pairControllers.delete(pair);
        if (pair.isConnected) {
          pair.classList.remove('is-active');
          pair.setAttribute('aria-hidden', 'true');
        }
        if (companion.isConnected) delete companion.dataset.shadowPairPhase;
        if (scope.isConnected) delete scope.dataset.shadowPairPhase;
        if (scope.isConnected) scope.classList.remove('is-shadow-pair-active');
        if (rig.isConnected && root.ShadowRig) root.ShadowRig.setState(rig, restoreState);
      }, duration));
      pairControllers.set(pair, controller);
      return true;
    });
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    TRAVELLER_GENDERS,
    AUTHORED_PAIR_GENDERS,
    FORMS,
    SOLO,
    INTERACTIONS,
    normalizeTier,
    formForTier,
    normalizeTravellerGender,
    hasPairArt,
    pairSrc,
    preload,
    prefetch,
    pairMarkup,
    playSolo,
    cancelSolo,
    pairStates,
    playPair,
    cancelPair,
  });
});
