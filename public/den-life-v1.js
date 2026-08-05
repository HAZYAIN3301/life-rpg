/* Satoru Den Life v2.
 *
 * A persistent director for authored full-frame Den actions. It survives DOM
 * rebinds, never treats a CSS scale as acting, and keeps BODY focus active for
 * the whole session instead of firing one greeting at the start.
 */
(function exposeDenLife(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DenLifeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenLife(root) {
  'use strict';

  const VERSION = '2.1.0';
  const FIRST_AMBIENT_MS = 3200;
  const FIRST_FOCUS_MS = 1600;
  const RETRY_MS = 1800;
  const AMBIENT_SEQUENCE = Object.freeze([
    Object.freeze({ id: 'toad-blink', kind: 'toad', gap: 2600 }),
    Object.freeze({ id: 'bench-rest', kind: 'room', gap: 4200 }),
    Object.freeze({ id: 'toad-look', kind: 'toad', gap: 3200 }),
    Object.freeze({ id: 'window-visit', kind: 'window', gap: 4400 }),
    Object.freeze({ id: 'bench-read', kind: 'room', gap: 5200 }),
  ]);
  const BODY_FOCUS_SEQUENCE = Object.freeze([
    Object.freeze({ id: 'whistle', kind: 'pair', duration: 3200, gap: 650 }),
    Object.freeze({ id: 'pushup', kind: 'pair', duration: 5600, gap: 700 }),
    Object.freeze({ id: 'stretch', kind: 'pair', duration: 6000, gap: 850 }),
    Object.freeze({ id: 'train', kind: 'pair', duration: 5200, gap: 750 }),
  ]);

  let director = null;
  let sequenceSeed = 0;

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

  function contextKey(context) {
    const safe = normalizeContext(context);
    return `${modeFor(safe)}:${safe.focusSession}:${safe.focusCanon}`;
  }

  function sequenceFor(context) {
    return modeFor(context) === 'body-focus' ? BODY_FOCUS_SEQUENCE : AMBIENT_SEQUENCE;
  }

  function canAct(state) {
    if (!state || typeof state.canAct !== 'function') return true;
    try { return state.canAct() !== false; } catch { return false; }
  }

  function clearTimer(state) {
    if (state && state.timer) clearTimeout(state.timer);
    if (state) state.timer = 0;
  }

  function schedule(state, delay) {
    if (!state || director !== state) return;
    clearTimer(state);
    state.nextAt = Math.max(
      Date.now() + Math.max(0, Number(delay) || 0),
      Number(state.holdUntil) || 0,
    );
    state.timer = setTimeout(tick, Math.max(0, state.nextAt - Date.now()));
  }

  function callbackFor(state, action) {
    if (action.kind === 'pair') return state.onPair && state.onPair(action.id, { automatic: true, duration: action.duration });
    if (action.kind === 'room') return state.onRoomAction && state.onRoomAction(action.id, { automatic: true });
    if (action.kind === 'window') return state.onWindowVisit && state.onWindowVisit({ automatic: true });
    if (action.kind === 'toad') return state.onToadBeat && state.onToadBeat(action.id, { automatic: true });
    return false;
  }

  function tick() {
    const state = director;
    if (!state || state.busy) return;
    if (Number(state.holdUntil) > Date.now()) {
      schedule(state, state.holdUntil - Date.now());
      return;
    }
    const scope = state.scope;
    if (!scope || !scope.isConnected || !canAct(state)) {
      schedule(state, RETRY_MS);
      return;
    }
    const sequence = sequenceFor(state.context);
    const action = sequence[state.step % sequence.length];
    state.step += 1;
    state.busy = true;
    let result = false;
    try { result = callbackFor(state, action); } catch { result = false; }
    Promise.resolve(result).then((played) => {
      if (director !== state) return;
      state.busy = false;
      schedule(state, played === false ? RETRY_MS : action.gap);
    }).catch(() => {
      if (director !== state) return;
      state.busy = false;
      schedule(state, RETRY_MS);
    });
  }

  function stop() {
    if (!director) return false;
    clearTimer(director);
    director = null;
    return true;
  }

  function start(target, options) {
    const scope = target;
    const config = options || {};
    if (!scope || !scope.querySelector || !scope.querySelector('[data-body-toad]')) return false;
    const context = normalizeContext(config.context);
    const key = contextKey(context);
    if (director && director.key === key) {
      director.scope = scope;
      director.canAct = config.canAct;
      director.onPair = config.onPair;
      director.onRoomAction = config.onRoomAction;
      director.onWindowVisit = config.onWindowVisit;
      director.onToadBeat = config.onToadBeat;
      if (!director.busy && !director.timer) schedule(director, Math.max(0, director.nextAt - Date.now()));
      return true;
    }
    stop();
    director = {
      busy: false,
      canAct: config.canAct,
      context,
      key,
      holdUntil: 0,
      nextAt: 0,
      onPair: config.onPair,
      onRoomAction: config.onRoomAction,
      onToadBeat: config.onToadBeat,
      onWindowVisit: config.onWindowVisit,
      scope,
      step: sequenceSeed++,
      timer: 0,
    };
    schedule(director, modeFor(context) === 'body-focus' ? FIRST_FOCUS_MS : FIRST_AMBIENT_MS);
    return true;
  }

  function postpone(target, delay) {
    const scope = target || (director && director.scope);
    if (!director || (scope && director.scope !== scope)) return false;
    director.holdUntil = Date.now() + Math.max(0, Number(delay) || 9000);
    if (!director.busy) schedule(director, director.holdUntil - Date.now());
    return true;
  }

  function inspect() {
    if (!director) return null;
    return Object.freeze({
      busy: director.busy,
      key: director.key,
      holdUntil: director.holdUntil,
      mode: modeFor(director.context),
      nextAt: director.nextAt,
      step: director.step,
    });
  }

  return Object.freeze({
    VERSION,
    FIRST_AMBIENT_MS,
    FIRST_FOCUS_MS,
    RETRY_MS,
    AMBIENT_SEQUENCE,
    BODY_FOCUS_SEQUENCE,
    normalizeContext,
    modeFor,
    contextKey,
    sequenceFor,
    start,
    stop,
    postpone,
    inspect,
  });
});
