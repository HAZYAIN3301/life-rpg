/* Satoru Den resident micro-life v1.
 *
 * Short blinks run independently from the authored action director. They
 * never steal a click, never overlap a room scene, and are deliberately not
 * offered as actions: this layer only stops idle residents looking frozen.
 */
(function exposeDenResidentLife(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DenResidentLifeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenResidentLife(root) {
  'use strict';

  const VERSION = '1.0.0';
  const MIN_GAP_MS = 4200;
  const MAX_GAP_MS = 7600;
  const BEATS = Object.freeze(['body', 'shadow', 'resources', 'shadow']);
  let state = null;
  let observer = null;

  function reducedMotion() {
    return Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function roomBusy(shell) {
    if (!shell || !shell.isConnected || (root.document && root.document.hidden)) return true;
    if (shell.matches('[class*="-pair-"][class*="active"], [class*="-pair-"][class*="approach"], [class*="-pair-"][class*="return"], .is-room-action-v4-active, .is-den-offscreen')) return true;
    if (shell.querySelector('.den-avatar-core[data-locomotion], [data-body-toad][data-motion], [data-recovery-slug][data-motion], [data-resources-penguin][data-motion]')) return true;
    return false;
  }

  function nextGap() {
    return Math.round(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
  }

  function schedule(delay) {
    if (!state) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(tick, Math.max(400, Number(delay) || nextGap()));
  }

  function shadowBlink(companion) {
    if (!companion || !companion.isConnected) return Promise.resolve(false);
    companion.dataset.shadowBlink = 'closed';
    return new Promise((resolve) => setTimeout(() => {
      if (companion.isConnected) delete companion.dataset.shadowBlink;
      resolve(true);
    }, 155));
  }

  async function play(kind, shell) {
    if (kind === 'body') {
      const toad = shell.querySelector('[data-body-toad]');
      if (!toad || !root.BodyToadV1 || !root.BodyToadV1.playAmbient) return false;
      return root.BodyToadV1.playAmbient(toad, 'blink', { restoreState: toad.dataset.state });
    }
    if (kind === 'resources') {
      const penguin = shell.querySelector('[data-resources-penguin]');
      if (!penguin || !root.ResourcesPenguinV1 || !root.ResourcesPenguinV1.playSolo) return false;
      shell.classList.add('is-resources-ambient-active');
      try {
        return await root.ResourcesPenguinV1.playSolo(penguin, 'blink', { restoreState: penguin.dataset.state });
      } finally {
        if (shell.isConnected) shell.classList.remove('is-resources-ambient-active');
      }
    }
    if (kind === 'shadow') return shadowBlink(shell.querySelector('[data-shadow-den]'));
    return false;
  }

  async function tick() {
    const current = state;
    if (!current || !current.shell.isConnected) return discover();
    if (reducedMotion() || roomBusy(current.shell)) return schedule(1800);
    const available = BEATS.filter((kind) => {
      if (kind === 'body') return current.shell.querySelector('[data-body-toad]');
      if (kind === 'resources') return current.shell.querySelector('[data-resources-penguin]');
      return current.shell.querySelector('[data-shadow-den]');
    });
    if (!available.length) return schedule(nextGap());
    const kind = available[current.step % available.length];
    current.step += 1;
    current.busy = true;
    try { await play(kind, current.shell); } catch {}
    if (state !== current) return;
    current.busy = false;
    schedule(nextGap());
  }

  function start(shell) {
    if (!shell || !shell.querySelector || reducedMotion()) return false;
    if (state && state.shell === shell) return true;
    stop();
    state = { shell, step: 0, timer: 0, busy: false };
    schedule(3600);
    return true;
  }

  function stop() {
    if (!state) return false;
    clearTimeout(state.timer);
    const shadow = state.shell && state.shell.querySelector && state.shell.querySelector('[data-shadow-den]');
    if (shadow) delete shadow.dataset.shadowBlink;
    state = null;
    return true;
  }

  function discover() {
    if (!root.document) return false;
    const shell = root.document.querySelector('.den-shell');
    if (!shell) return stop();
    return start(shell);
  }

  function inspect() {
    return state ? Object.freeze({ busy: state.busy, step: state.step, connected: state.shell.isConnected }) : null;
  }

  if (root.document && typeof root.MutationObserver === 'function') {
    const begin = () => {
      discover();
      observer = new root.MutationObserver(() => discover());
      observer.observe(root.document.documentElement, { childList: true, subtree: true });
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', begin, { once: true });
    else begin();
  }

  return Object.freeze({ VERSION, MIN_GAP_MS, MAX_GAP_MS, BEATS, roomBusy, shadowBlink, play, start, stop, discover, inspect });
});
