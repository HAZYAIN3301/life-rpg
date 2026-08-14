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

  const VERSION = '1.2.0';
  const ART_ROOT = '/art/companions/shadow-den-v1/pair-v1/';
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
  function pairSrc(value) { return `${ART_ROOT}attune-${formForTier(value)}.png?v=20260811-1`; }

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

  // Pair posters are retained as archive/reference art only. Runtime meetings
  // use the live canonical Traveller and the current Shadow rig so scale,
  // left/right order, eyes and evolution tier cannot drift between renders.
  function prefetch() { return Promise.resolve([]); }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pairMarkup(options) {
    const config = options || {};
    const tier = normalizeTier(config.tier);
    const classes = ['shadow-den-pair-v1', config.className || ''].filter(Boolean).join(' ');
    return `<span class="${escapeHTML(classes)}" data-shadow-den-pair data-tier="${tier}" data-form="${formForTier(tier)}" data-mode="attune" aria-hidden="true"></span>`;
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
    const config = options || {};
    const tier = normalizeTier(config.tier == null ? pair.dataset.tier : config.tier);
    const duration = Math.max(900, Number(config.duration) || meta.duration);
    const companion = scope.querySelector('[data-shadow-den]');
    const rig = rigInside(companion);
    const restoreState = String((rig && rig.dataset.shadowState) || 'calm');
    cancelPair(scope, true);
    return Promise.resolve().then(() => {
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
    FORMS,
    SOLO,
    INTERACTIONS,
    normalizeTier,
    formForTier,
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
