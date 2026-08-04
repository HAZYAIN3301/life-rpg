/* Satoru Den Life v1.
 *
 * A small deterministic director for the approved flattened BODY guardian.
 * It never invents joints or locomotion. Ambient beats move the complete
 * authored sprite, while physical contact remains in atomic pair frames.
 */
(function exposeDenLife(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DenLifeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenLife(root) {
  'use strict';

  const VERSION = '1.0.0';
  const FIRST_AMBIENT_MS = 7200;
  const RETRY_MS = 3200;
  const FOCUS_START_MS = 5200;
  const AMBIENT_ACTIONS = Object.freeze([
    Object.freeze({ id: 'observe', duration: 2400, gap: 12800 }),
    Object.freeze({ id: 'brace', duration: 2200, gap: 15400 }),
    Object.freeze({ id: 'settle', duration: 2800, gap: 18200 }),
  ]);

  const active = new WeakMap();
  const completedFocusSessions = new Set();
  let liveScope = null;
  let sequence = 0;

  function normalizeContext(value) {
    const input = value || {};
    return Object.freeze({
      focusCanon: String(input.focusCanon || ''),
      focusRunning: input.focusRunning === true,
      focusSession: String(input.focusSession || ''),
    });
  }

  function modeFor(context) {
    const safe = normalizeContext(context);
    return safe.focusRunning && safe.focusCanon === 'body' ? 'body-focus' : 'ambient';
  }

  function nextAmbient(index) {
    const safe = Math.abs(Number(index) || 0) % AMBIENT_ACTIONS.length;
    return AMBIENT_ACTIONS[safe];
  }

  function clearAmbient(scope) {
    const toad = scope && scope.querySelector && scope.querySelector('[data-body-toad]');
    if (!toad) return;
    toad.classList.remove('is-den-ambient');
    delete toad.dataset.ambient;
  }

  function stop(target) {
    const scope = target || liveScope;
    if (!scope) return false;
    const state = active.get(scope);
    if (state) {
      clearTimeout(state.timer);
      clearTimeout(state.finishTimer);
      active.delete(scope);
    }
    clearAmbient(scope);
    if (liveScope === scope) liveScope = null;
    return Boolean(state);
  }

  function schedule(scope, state, delay) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => tick(scope), Math.max(0, Number(delay) || 0));
  }

  function canAct(state) {
    if (!state || typeof state.canAct !== 'function') return true;
    try { return state.canAct() !== false; } catch { return false; }
  }

  function finishAmbient(scope, state, action) {
    if (!scope.isConnected || active.get(scope) !== state) return;
    clearAmbient(scope);
    state.finishTimer = 0;
    schedule(scope, state, action.gap);
  }

  function playAmbient(scope, state) {
    const toad = scope.querySelector('[data-body-toad]');
    if (!toad) return schedule(scope, state, RETRY_MS);
    const action = nextAmbient(state.step++);
    clearAmbient(scope);
    toad.dataset.ambient = action.id;
    toad.classList.add('is-den-ambient');
    state.finishTimer = setTimeout(() => finishAmbient(scope, state, action), action.duration);
  }

  function focusWasPlayed(context) {
    return !context.focusSession || completedFocusSessions.has(context.focusSession);
  }

  function playFocusBeat(scope, state) {
    const play = typeof state.onPair === 'function' ? state.onPair('train', { automatic: true }) : false;
    Promise.resolve(play).then((played) => {
      if (!scope.isConnected || active.get(scope) !== state) return;
      if (played) {
        completedFocusSessions.add(state.context.focusSession);
        schedule(scope, state, 15800);
      } else {
        schedule(scope, state, RETRY_MS);
      }
    }).catch(() => {
      if (scope.isConnected && active.get(scope) === state) schedule(scope, state, RETRY_MS);
    });
  }

  function tick(scope) {
    const state = active.get(scope);
    if (!state || !scope.isConnected) return stop(scope);
    if (!canAct(state)) return schedule(scope, state, RETRY_MS);
    if (modeFor(state.context) === 'body-focus' && !focusWasPlayed(state.context)) {
      playFocusBeat(scope, state);
      return;
    }
    playAmbient(scope, state);
  }

  function start(target, options) {
    const scope = target;
    const config = options || {};
    if (!scope || !scope.querySelector || !scope.querySelector('[data-body-toad]')) return false;
    if (liveScope && liveScope !== scope) stop(liveScope);
    stop(scope);
    const context = normalizeContext(config.context);
    const state = {
      canAct: config.canAct,
      context,
      finishTimer: 0,
      onPair: config.onPair,
      step: sequence++,
      timer: 0,
    };
    active.set(scope, state);
    liveScope = scope;
    const firstDelay = modeFor(context) === 'body-focus' && !focusWasPlayed(context)
      ? FOCUS_START_MS
      : FIRST_AMBIENT_MS;
    schedule(scope, state, firstDelay);
    return true;
  }

  function postpone(target, delay) {
    const scope = target || liveScope;
    const state = scope && active.get(scope);
    if (!state) return false;
    clearAmbient(scope);
    clearTimeout(state.finishTimer);
    state.finishTimer = 0;
    schedule(scope, state, delay || 9000);
    return true;
  }

  return Object.freeze({
    VERSION,
    FIRST_AMBIENT_MS,
    RETRY_MS,
    FOCUS_START_MS,
    AMBIENT_ACTIONS,
    normalizeContext,
    modeFor,
    nextAmbient,
    start,
    stop,
    postpone,
  });
});
