(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravellerMotionV3 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const VERSION = '3.2.0';
  const ART_ROOT = '/art/avatars/traveller-core-v1/male/motion-v3/';
  const ASSETS = Object.freeze({
    blink: 'idle-blink.png',
    walkA: 'walk-a.png',
    walkB: 'walk-b.png',
  });
  const WALK_MS = 2200;
  const DWELL_MS = 3600;
  const controllers = new WeakMap();

  function frameSrc(key) {
    const file = ASSETS[key] || ASSETS.blink;
    return `${ART_ROOT}${file}`;
  }

  function blinkMarkup() {
    return `<span class="avatar-core-blink-layer" aria-hidden="true"><img src="${frameSrc('blink')}" alt="" draggable="false" decoding="async"></span>`;
  }

  function makeFrame(key, className) {
    const image = root.document.createElement('img');
    image.className = `avatar-core-frame avatar-core-walk-frame ${className}`;
    image.src = frameSrc(key);
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.decoding = 'async';
    return image;
  }

  function clearWalkFrames(host) {
    if (!host || !host.querySelectorAll) return;
    host.querySelectorAll('.avatar-core-walk-frame').forEach((frame) => frame.remove());
    const stack = host.querySelector('.avatar-core-stack');
    if (stack) delete stack.dataset.locomotion;
  }

  function installWalkFrames(host, direction) {
    const stack = host && host.querySelector && host.querySelector('.avatar-core-stack');
    const motion = stack && stack.querySelector('.avatar-core-motion');
    if (!motion || !root.document) return false;
    clearWalkFrames(host);
    motion.appendChild(makeFrame('walkA', 'avatar-core-walk-frame--a'));
    motion.appendChild(makeFrame('walkB', 'avatar-core-walk-frame--b'));
    stack.dataset.locomotion = 'walk';
    host.dataset.locomotion = 'walk';
    host.dataset.locomotionDirection = direction === 'left' ? 'left' : 'right';
    return true;
  }

  function nextFrame() {
    return new Promise((resolve) => {
      const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
      raf(() => raf(resolve));
    });
  }

  function announceLeg(host, phase, destination, direction) {
    if (!host || typeof host.dispatchEvent !== 'function' || typeof root.CustomEvent !== 'function') return false;
    host.dispatchEvent(new root.CustomEvent('satoru:den-traveller-motion', {
      bubbles: true,
      detail: { phase, destination, direction },
    }));
    return true;
  }

  function pause(controller, ms) {
    return new Promise((resolve) => {
      controller.waitResolve = resolve;
      controller.timer = setTimeout(() => {
        controller.timer = 0;
        controller.waitResolve = null;
        resolve(!controller.cancelled);
      }, ms);
    });
  }

  function resetHost(host) {
    if (!host || !host.dataset) return;
    announceLeg(host, 'reset', 'home', 'left');
    host.classList.add('is-locomotion-resetting');
    delete host.dataset.locomotion;
    delete host.dataset.locomotionDirection;
    delete host.dataset.locomotionPosition;
    clearWalkFrames(host);
    const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
    raf(() => host.classList.remove('is-locomotion-resetting'));
  }

  async function walkLeg(host, controller, target, options) {
    const config = options || {};
    const destination = target === 'home' ? 'home' : (target === 'bench' ? 'bench' : 'window');
    const direction = destination === 'home' ? 'left' : 'right';
    const preload = typeof config.preload === 'function' ? config.preload : () => Promise.resolve();
    await Promise.all(['walkA', 'walkB'].map((key) => preload(frameSrc(key))));
    if (controller.cancelled || !host.isConnected) return false;
    host.classList.remove('is-locomotion-resetting');
    if (!host.dataset.locomotionPosition && destination !== 'home') host.dataset.locomotionPosition = 'home';
    if (!installWalkFrames(host, direction)) return false;
    announceLeg(host, 'depart', destination, direction);
    await nextFrame();
    if (controller.cancelled) return false;
    host.dataset.locomotionPosition = destination;
    if (!(await pause(controller, Number(config.walkMs) || WALK_MS))) return false;
    clearWalkFrames(host);
    announceLeg(host, 'arrive', destination, direction);
    if (destination === 'home') {
      delete host.dataset.locomotion;
      delete host.dataset.locomotionDirection;
      delete host.dataset.locomotionPosition;
    } else {
      host.dataset.locomotion = 'arrived';
      delete host.dataset.locomotionDirection;
    }
    return true;
  }

  async function walkTo(host, target, options) {
    if (!host || !host.isConnected || controllers.has(host)) return false;
    const controller = { cancelled: false, timer: 0, waitResolve: null };
    controllers.set(host, controller);
    try {
      return await walkLeg(host, controller, target, options);
    } finally {
      const current = controllers.get(host);
      if (current === controller) controllers.delete(host);
      if (controller.cancelled) resetHost(host);
    }
  }

  function cancel(host) {
    if (!host) return false;
    const controller = controllers.get(host);
    if (controller) {
      controller.cancelled = true;
      if (controller.timer) clearTimeout(controller.timer);
      if (controller.waitResolve) controller.waitResolve(false);
      controllers.delete(host);
    }
    resetHost(host);
    return !!controller;
  }

  async function playWindowVisit(host, options) {
    if (!host || !host.isConnected || controllers.has(host)) return false;
    const stack = host.querySelector('.avatar-core-stack');
    if (!stack) return false;
    const config = options || {};
    const controller = { cancelled: false, timer: 0, waitResolve: null };
    controllers.set(host, controller);
    const preload = typeof config.preload === 'function'
      ? config.preload
      : () => Promise.resolve();
    const swapPose = typeof config.swapPose === 'function'
      ? config.swapPose
      : () => Promise.resolve(true);

    try {
      await Promise.all(['walkA', 'walkB', 'blink'].map((key) => preload(frameSrc(key))));
      if (controller.cancelled || !host.isConnected) return false;

      if (!(await walkLeg(host, controller, 'window', config))) return false;

      await swapPose('window-back');
      if (controller.cancelled || !host.isConnected) return false;
      host.dataset.locomotion = 'dwell';
      host.dataset.pose = 'window-back';
      if (!(await pause(controller, Number(config.dwellMs) || DWELL_MS))) return false;

      await swapPose('idle');
      if (controller.cancelled || !host.isConnected) return false;
      if (!(await walkLeg(host, controller, 'home', config))) return false;

      clearWalkFrames(host);
      host.dataset.pose = 'idle';
      delete host.dataset.locomotion;
      delete host.dataset.locomotionDirection;
      delete host.dataset.locomotionPosition;
      return true;
    } finally {
      const active = controllers.get(host);
      if (active === controller) controllers.delete(host);
      if (controller.cancelled) resetHost(host);
    }
  }

  function isPlaying(host) {
    return !!(host && controllers.has(host));
  }

  return Object.freeze({
    VERSION,
    ART_ROOT,
    ASSETS,
    WALK_MS,
    DWELL_MS,
    frameSrc,
    blinkMarkup,
    announceLeg,
    installWalkFrames,
    clearWalkFrames,
    walkTo,
    playWindowVisit,
    cancel,
    isPlaying,
  });
});
