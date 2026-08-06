/* Satoru RECOVERY Guardian v1.
 *
 * Katsuya-inspired healing slug on the shared 1024x1024 guardian stage.
 * Recovery is a derived signal, not another sphere the user must maintain.
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

  const VERSION = '1.0.0';
  const ART_ROOT = '/art/pets/recovery-slug-v1/';
  const STATES = Object.freeze(['calm', 'thriving', 'strained', 'restoring']);
  const STATE_META = Object.freeze({
    calm: { label: 'Спокойна', line: 'Дышит медленно и хранит запас тишины.' },
    thriving: { label: 'Наполнена', line: 'Отдых действительно возвращает тебе силы.' },
    strained: { label: 'Тревожится', line: 'Слишком долго не было настоящей паузы.' },
    restoring: { label: 'Лечит', line: 'Не торопит: силы уже возвращаются.' },
  });
  const preloads = new Map();

  function normalizeState(value) {
    return STATES.includes(value) ? value : 'calm';
  }

  function stateSrc(state) {
    return `${ART_ROOT}states/${normalizeState(state)}.png`;
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
      image.onload = () => resolve(src);
      image.onerror = () => reject(new Error(`RECOVERY Guardian asset failed: ${src}`));
      image.decoding = 'async';
      image.src = src;
      if (image.complete && image.naturalWidth) resolve(src);
    }).catch((error) => {
      preloads.delete(src);
      throw error;
    });
    preloads.set(src, ready);
    return ready;
  }

  function prefetch() {
    return Promise.allSettled(STATES.map(stateSrc).concat([frameSrc('calm', true)]).map(preload));
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
    return `<span class="${escapeHTML(classes)}" data-recovery-slug data-state="${state}" role="img" aria-label="${escapeHTML(label)}"><span class="recovery-slug-v1__stage"><img class="recovery-slug-v1__frame is-active" src="${frameSrc(state, animated)}" alt="" aria-hidden="true" draggable="false" decoding="async"></span></span>`;
  }

  function setState(element, state, options) {
    if (!element) return Promise.resolve(null);
    const safe = normalizeState(state);
    const animated = !options || options.animated !== false;
    const src = frameSrc(safe, animated);
    return preload(src).then(() => {
      if (!element.isConnected) return element;
      const stage = element.querySelector('.recovery-slug-v1__stage');
      const current = stage && stage.querySelector('.recovery-slug-v1__frame.is-active');
      if (!stage) return element;
      const next = document.createElement('img');
      next.className = 'recovery-slug-v1__frame is-incoming';
      next.src = src;
      next.alt = '';
      next.setAttribute('aria-hidden', 'true');
      next.draggable = false;
      next.decoding = 'async';
      stage.appendChild(next);
      element.dataset.state = safe;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.classList.add('is-active');
        next.classList.remove('is-incoming');
        if (current) current.classList.add('is-outgoing');
        setTimeout(() => current && current.remove(), 280);
      }));
      return element;
    });
  }

  function reassure(element, restoreState) {
    if (!element) return Promise.resolve(false);
    const original = normalizeState(restoreState || element.dataset.state);
    element.classList.add('is-reassuring');
    return setState(element, 'restoring', { animated: false }).then(() => new Promise((resolve) => {
      setTimeout(() => {
        element.classList.remove('is-reassuring');
        setState(element, original, { animated: true }).catch(() => {});
        resolve(true);
      }, 5200);
    }));
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    STATES,
    STATE_META,
    normalizeState,
    stateSrc,
    frameSrc,
    deriveState,
    prefetch,
    markup,
    setState,
    reassure,
  });
});
