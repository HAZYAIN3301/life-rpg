(function initTravellerRoomV4(global) {
  'use strict';

  const VERSION = '4.0.0';
  const BASE = '/art/avatars/traveller-core-v1/male/room-actions-v4';
  const STORAGE_KEY = 'satoru.traveller-room-v4.active';
  const ACTIONS = Object.freeze({
    'bench-rest': Object.freeze({
      label: 'Сесть у окна',
      duration: 7000,
      frames: Object.freeze([`${BASE}/bench-rest.png`]),
    }),
    'bench-read': Object.freeze({
      label: 'Почитать',
      duration: 9000,
      frames: Object.freeze([`${BASE}/bench-read-a.png`, `${BASE}/bench-read-b.png`]),
    }),
  });

  const active = new WeakMap();
  let tokenSeed = 0;
  let liveShell = null;

  function shellFrom(target) {
    if (!target) return document.querySelector('.den-shell');
    if (target.matches && target.matches('.den-shell')) return target;
    return target.closest ? target.closest('.den-shell') : null;
  }

  function readPersisted() {
    try {
      const record = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!record || !ACTIONS[record.actionId] || !record.id || Number(record.expiresAt) <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  function writePersisted(record) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch {}
  }

  function clearPersisted(id) {
    const record = readPersisted();
    if (!id || !record || record.id === id) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }

  function markup(options = {}) {
    const extra = options.className ? ` ${options.className}` : '';
    const record = readPersisted();
    const action = record ? ACTIONS[record.actionId] : ACTIONS['bench-rest'];
    return `<div class="traveller-room-v4${extra}${record ? ' is-active' : ''}" data-traveller-room-v4 data-action="${record ? record.actionId : 'bench-rest'}" aria-hidden="${record ? 'false' : 'true'}">
      <img class="traveller-room-v4__frame traveller-room-v4__frame--a" src="${action.frames[0]}" alt="" aria-hidden="true" draggable="false" decoding="async" />
      <img class="traveller-room-v4__frame traveller-room-v4__frame--b" src="${action.frames[1] || action.frames[0]}" alt="" aria-hidden="true" draggable="false" decoding="async" />
    </div>`;
  }

  function decode(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = src;
      if (image.complete) resolve(image.naturalWidth > 0);
    });
  }

  function preload(actionId) {
    const action = ACTIONS[actionId];
    return action ? Promise.all(action.frames.map(decode)).then((values) => values.every(Boolean)) : Promise.resolve(false);
  }

  function isPlaying(target) {
    const shell = shellFrom(target);
    return Boolean(shell && (active.get(shell) || readPersisted()));
  }

  function finish(shell, token, notify) {
    const state = active.get(shell);
    if (!state || state.token !== token) return false;
    clearTimeout(state.timer);
    active.delete(shell);
    if (liveShell === shell) liveShell = null;
    clearPersisted(state.id);
    shell.classList.remove('is-room-action-v4-active');
    const layer = shell.querySelector('[data-traveller-room-v4]');
    if (layer) {
      layer.classList.remove('is-active');
      layer.setAttribute('aria-hidden', 'true');
      delete layer.dataset.action;
    }
    if (notify && typeof state.onFinish === 'function') state.onFinish(state.actionId);
    return true;
  }

  function cancel(target, options = {}) {
    const shell = shellFrom(target) || liveShell;
    if (!shell) return false;
    const state = active.get(shell) || (liveShell ? active.get(liveShell) : null);
    if (!state) {
      const hadPersisted = Boolean(readPersisted());
      clearPersisted();
      shell.classList.remove('is-room-action-v4-active');
      return hadPersisted;
    }
    return finish(active.get(shell) ? shell : liveShell, state.token, options.notify === true);
  }

  function attach(shell, record, options = {}) {
    const action = ACTIONS[record.actionId];
    if (!action) return false;
    if (liveShell && liveShell !== shell) {
      const previous = active.get(liveShell);
      if (previous) {
        clearTimeout(previous.timer);
        active.delete(liveShell);
        if (!options.onFinish && previous.onFinish) options.onFinish = previous.onFinish;
      }
      liveShell.classList.remove('is-room-action-v4-active');
    }
    const layer = shell.querySelector('[data-traveller-room-v4]');
    if (!layer) return false;
    const frames = layer.querySelectorAll('.traveller-room-v4__frame');
    frames[0].src = action.frames[0];
    frames[1].src = action.frames[1] || action.frames[0];
    layer.dataset.action = record.actionId;
    layer.setAttribute('aria-hidden', 'false');
    layer.classList.add('is-active');
    shell.classList.add('is-room-action-v4-active');
    const token = ++tokenSeed;
    const remaining = Math.max(0, Number(record.expiresAt) - Date.now());
    const timer = setTimeout(() => finish(shell, token, true), remaining);
    active.set(shell, { actionId: record.actionId, id: record.id, onFinish: options.onFinish, timer, token });
    liveShell = shell;
    return true;
  }

  function restore(target, options = {}) {
    const shell = shellFrom(target);
    const record = readPersisted();
    if (!shell || !record) return false;
    const scene = shell.querySelector('.den-scene');
    if (!scene || scene.dataset.denRenderer !== 'v5' || scene.dataset.denTheme !== 'workshop' || shell.classList.contains('is-body-pair-active')) {
      clearPersisted(record.id);
      return false;
    }
    return attach(shell, record, options);
  }

  async function play(target, actionId, options = {}) {
    const shell = shellFrom(target);
    const action = ACTIONS[actionId];
    if (!shell || !action) return false;
    const scene = shell.querySelector('.den-scene');
    if (!scene || scene.dataset.denRenderer !== 'v5' || scene.dataset.denTheme !== 'workshop') return false;
    if (shell.classList.contains('is-body-pair-active')) return false;

    cancel(shell);
    const avatar = shell.querySelector('.den-avatar-core');
    if (avatar && global.TravellerMotionV3 && global.TravellerMotionV3.isPlaying(avatar)) {
      global.TravellerMotionV3.cancel(avatar, { restore: true });
    }

    const ready = await preload(actionId);
    if (!ready || !shell.isConnected || shell.classList.contains('is-body-pair-active')) return false;
    const record = { actionId, expiresAt: Date.now() + action.duration, id: `${Date.now()}-${++tokenSeed}` };
    writePersisted(record);
    return attach(shell, record, options);
  }

  global.TravellerRoomV4 = Object.freeze({
    VERSION,
    BASE,
    ACTIONS,
    markup,
    preload,
    play,
    restore,
    cancel,
    isPlaying,
  });
})(window);
