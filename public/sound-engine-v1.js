/* Satoru Sound Engine v1 — semantic, original Web Audio feedback.
 *
 * This is deliberately not a bag of "click.mp3" files. Product code names the
 * meaning of an event (navigate, complete, reward_land, loot); this module owns
 * the sound language, rate limits and collision policy. All voices are generated
 * from oscillators, filtered noise and a synthetic room impulse, so no third-party
 * anime/game samples are shipped or imitated one-for-one.
 */
(function exposeSoundEngine(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruSoundV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSoundEngine(root) {
  'use strict';

  const VERSION = '1.0.0';
  const MODES = Object.freeze(['off', 'essential', 'full']);
  const EVENTS = Object.freeze({
    navigate:     Object.freeze({ family: 'ui',          essential: false, cooldownMs: 70 }),
    select:       Object.freeze({ family: 'ui',          essential: false, cooldownMs: 45 }),
    open:         Object.freeze({ family: 'ui',          essential: false, cooldownMs: 100 }),
    close:        Object.freeze({ family: 'ui',          essential: false, cooldownMs: 100 }),
    confirm:      Object.freeze({ family: 'ui',          essential: false, cooldownMs: 80 }),
    complete:     Object.freeze({ family: 'earned',      essential: true,  cooldownMs: 180 }),
    coin:         Object.freeze({ family: 'economy',     essential: true,  cooldownMs: 120 }),
    reward_tick:  Object.freeze({ family: 'ceremony',    essential: false, cooldownMs: 38 }),
    reward_land:  Object.freeze({ family: 'ceremony',    essential: true,  cooldownMs: 220 }),
    loot:         Object.freeze({ family: 'ceremony',    essential: true,  cooldownMs: 260 }),
    achievement:  Object.freeze({ family: 'milestone',   essential: true,  cooldownMs: 500 }),
    levelup:      Object.freeze({ family: 'milestone',   essential: true,  cooldownMs: 700 }),
    bosshit:      Object.freeze({ family: 'impact',      essential: true,  cooldownMs: 180 }),
    raidwin:      Object.freeze({ family: 'milestone',   essential: true,  cooldownMs: 900 }),
  });

  const ALIASES = Object.freeze({ click: 'select', chest_tick: 'reward_tick', chest_land: 'reward_land' });
  function normalizeMode(value) { return MODES.includes(value) ? value : 'full'; }
  function normalizeEvent(value) {
    const name = ALIASES[String(value || '')] || String(value || '');
    return EVENTS[name] ? name : '';
  }
  function isAllowed(name, mode) {
    const event = EVENTS[normalizeEvent(name)];
    const normalized = normalizeMode(mode);
    return !!event && normalized !== 'off' && (normalized === 'full' || event.essential);
  }
  function rarityIndex(value) { return Math.max(0, ['common', 'rare', 'epic', 'legendary'].indexOf(value)); }

  function create(options) {
    const opts = options || {};
    let ctx = null, input = null, compressor = null, master = null, room = null;
    let noiseBuffer = null;
    let mode = normalizeMode(opts.mode);
    const lastPlayed = Object.create(null);
    const activeStops = new Set();

    function getContext() {
      if (ctx) {
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => {});
        return ctx;
      }
      try {
        const Context = opts.AudioContext || (root && (root.AudioContext || root.webkitAudioContext));
        if (!Context) return null;
        ctx = typeof Context === 'function' ? new Context() : Context;
        input = ctx.createGain();
        compressor = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        compressor.threshold.value = -18;
        compressor.knee.value = 14;
        compressor.ratio.value = 8;
        compressor.attack.value = .003;
        compressor.release.value = .16;
        master.gain.value = Number.isFinite(opts.gain) ? Math.max(0, Math.min(1, opts.gain)) : .52;
        input.connect(compressor).connect(master).connect(ctx.destination);
        if (typeof ctx.createConvolver === 'function') {
          room = ctx.createConvolver();
          const seconds = .72, length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
          const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
          for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
              const decay = Math.pow(1 - i / length, 3.2);
              data[i] = (Math.random() * 2 - 1) * decay * (channel ? .86 : 1);
            }
          }
          room.buffer = impulse;
          const roomGain = ctx.createGain(); roomGain.gain.value = .16;
          room.connect(roomGain).connect(compressor);
        }
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => {});
      } catch (_) { ctx = null; }
      return ctx;
    }

    function output(node, wet) {
      if (!node || !input) return;
      node.connect(input);
      if (wet && room) node.connect(room);
    }
    function envelope(gain, start, attack, hold, end, peak) {
      gain.cancelScheduledValues(start);
      gain.setValueAtTime(.0001, start);
      gain.exponentialRampToValueAtTime(Math.max(.0002, peak), start + Math.max(.004, attack));
      gain.setValueAtTime(Math.max(.0002, peak), start + Math.max(.004, attack) + Math.max(0, hold));
      gain.exponentialRampToValueAtTime(.0001, end);
    }
    function panNode(value) {
      if (!ctx || typeof ctx.createStereoPanner !== 'function') return null;
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, value || 0)); return pan;
    }
    function tone(config) {
      if (!ctx) return;
      const c = config || {}, start = c.start == null ? ctx.currentTime : c.start;
      const duration = Math.max(.025, c.duration || .12), stop = start + duration;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = c.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, c.from || c.frequency || 440), start);
      if (c.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, c.to), stop);
      if (c.detune) osc.detune.value = c.detune;
      envelope(gain.gain, start, c.attack == null ? .008 : c.attack, c.hold || 0, stop, c.gain || .08);
      let tail = gain;
      if (c.filter) {
        const filter = ctx.createBiquadFilter(); filter.type = c.filter.type || 'lowpass';
        filter.frequency.setValueAtTime(c.filter.from || c.filter.frequency || 1800, start);
        if (c.filter.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, c.filter.to), stop);
        filter.Q.value = c.filter.q || .7; gain.connect(filter); tail = filter;
      }
      const pan = panNode(c.pan); if (pan) { tail.connect(pan); tail = pan; }
      output(tail, c.wet);
      osc.connect(gain); osc.start(start); osc.stop(stop + .025);
      activeStops.add(osc); osc.onended = () => activeStops.delete(osc);
    }
    function getNoiseBuffer() {
      if (noiseBuffer || !ctx) return noiseBuffer;
      const length = Math.max(1, Math.floor(ctx.sampleRate * 1.1));
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        previous = previous * .18 + white * .82;
        data[i] = previous;
      }
      return noiseBuffer;
    }
    function noise(config) {
      if (!ctx) return;
      const c = config || {}, start = c.start == null ? ctx.currentTime : c.start;
      const duration = Math.max(.025, c.duration || .1), stop = start + duration;
      const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      source.buffer = getNoiseBuffer();
      filter.type = c.type || 'bandpass';
      filter.frequency.setValueAtTime(Math.max(30, c.from || c.frequency || 1200), start);
      if (c.to) filter.frequency.exponentialRampToValueAtTime(Math.max(30, c.to), stop);
      filter.Q.value = c.q == null ? 1.2 : c.q;
      envelope(gain.gain, start, c.attack == null ? .004 : c.attack, c.hold || 0, stop, c.gain || .05);
      source.connect(filter).connect(gain);
      const pan = panNode(c.pan); if (pan) { gain.connect(pan); output(pan, c.wet); } else output(gain, c.wet);
      source.start(start, 0, duration); source.stop(stop + .02);
      activeStops.add(source); source.onended = () => activeStops.delete(source);
    }
    function shimmer(start, rootFreq, count, gain) {
      for (let i = 0; i < count; i++) {
        const offset = i * .045;
        tone({ start: start + offset, from: rootFreq * [1, 1.25, 1.5, 2][i % 4], to: rootFreq * [1.12, 1.4, 1.68, 2.2][i % 4], duration: .3 + i * .035, type: i % 2 ? 'sine' : 'triangle', gain: gain / (1 + i * .18), pan: (i % 2 ? 1 : -1) * Math.min(.55, .16 + i * .08), wet: true });
      }
    }
    function impact(start, strength, bright) {
      tone({ start, from: 118, to: 42, duration: .34, type: 'sine', gain: .16 * strength, attack: .006, filter: { type: 'lowpass', from: 420, to: 110 }, wet: true });
      noise({ start, from: bright ? 4200 : 1700, to: bright ? 900 : 260, duration: .22, type: 'bandpass', q: .72, gain: .11 * strength, wet: true });
      tone({ start: start + .012, from: bright ? 1240 : 620, to: bright ? 760 : 330, duration: .12, type: 'triangle', gain: .055 * strength, wet: true });
    }

    function voice(name, detail) {
      const now = ctx.currentTime + .006;
      const rarity = detail.rarity || 'common', tier = rarityIndex(rarity);
      if (name === 'navigate') {
        noise({ start: now, from: 1800, to: 3200, duration: .055, gain: .025, pan: -.08 });
        tone({ start: now, from: 310, to: 480, duration: .075, type: 'sine', gain: .038, pan: .08 });
      } else if (name === 'select' || name === 'confirm') {
        noise({ start: now, from: 2400, to: 1500, duration: .035, q: 2.6, gain: .028 });
        tone({ start: now, from: name === 'confirm' ? 380 : 520, to: name === 'confirm' ? 520 : 680, duration: .055, type: 'triangle', gain: .032 });
      } else if (name === 'open') {
        noise({ start: now, from: 360, to: 3400, duration: .19, attack: .075, gain: .045, pan: -.18, wet: true });
        tone({ start: now + .055, from: 210, to: 330, duration: .18, type: 'sine', gain: .045, pan: .15, wet: true });
      } else if (name === 'close') {
        noise({ start: now, from: 2600, to: 420, duration: .13, gain: .035, pan: .12 });
        tone({ start: now, from: 520, to: 240, duration: .11, type: 'sine', gain: .035, pan: -.1 });
      } else if (name === 'complete') {
        noise({ start: now, from: 1800, to: 5600, duration: .11, gain: .047, wet: true });
        [520, 780, 1040].forEach((frequency, i) => tone({ start: now + .035 + i * .065, from: frequency, to: frequency * 1.045, duration: .25, type: i === 2 ? 'sine' : 'triangle', gain: .066 / (1 + i * .1), pan: (i - 1) * .22, wet: true }));
      } else if (name === 'coin') {
        [1320, 1860, 2440].forEach((frequency, i) => tone({ start: now + i * .042, from: frequency, to: frequency * .92, duration: .095 + i * .018, type: 'sine', gain: .047 / (1 + i * .18), pan: (i - 1) * .22, wet: true }));
        noise({ start: now, from: 5200, to: 2900, duration: .055, q: 3.1, gain: .025 });
      } else if (name === 'reward_tick') {
        const progress = Math.max(0, Math.min(1, Number(detail.progress) || 0));
        const pitch = 330 + progress * 310;
        noise({ start: now, from: 2200 + progress * 2100, to: 1100 + progress * 900, duration: .032, q: 3.4, gain: .02 + progress * .008, pan: detail.pan || 0 });
        tone({ start: now, from: pitch, to: pitch * 1.08, duration: .044, type: 'triangle', gain: .027, pan: detail.pan || 0 });
      } else if (name === 'reward_land') {
        impact(now, .72 + tier * .08, tier >= 2);
      } else if (name === 'loot') {
        const hitAt = now + (tier >= 2 ? .07 : .02);
        if (tier >= 2) noise({ start: now, from: 260, to: 4600, duration: .17, attack: .095, gain: .045 + tier * .008, wet: true });
        impact(hitAt, .78 + tier * .12, tier >= 2);
        shimmer(hitAt + .085, [392, 440, 520, 620][tier], 2 + tier, .055 + tier * .009);
      } else if (name === 'achievement') {
        noise({ start: now, from: 420, to: 5000, duration: .2, attack: .09, gain: .05, wet: true });
        shimmer(now + .08, 466, 5, .064);
      } else if (name === 'levelup') {
        impact(now + .07, .94, true);
        noise({ start: now, from: 280, to: 6200, duration: .36, attack: .18, gain: .065, wet: true });
        shimmer(now + .13, 392, 7, .07);
      } else if (name === 'bosshit') {
        impact(now, 1.08, false);
        tone({ start: now + .05, from: 980, to: 210, duration: .24, type: 'sawtooth', gain: .045, filter: { type: 'lowpass', from: 2100, to: 380 }, wet: true });
      } else if (name === 'raidwin') {
        impact(now + .08, 1.12, true);
        noise({ start: now, from: 190, to: 7200, duration: .48, attack: .24, gain: .07, wet: true });
        shimmer(now + .16, 330, 9, .072);
      }
    }

    function play(rawName, detail) {
      const name = normalizeEvent(rawName), event = EVENTS[name];
      const requestedMode = normalizeMode((detail && detail.mode) || mode);
      if (!event || !isAllowed(name, requestedMode)) return false;
      const clock = Date.now();
      if (clock - (lastPlayed[name] || 0) < event.cooldownMs) return false;
      if (!getContext()) return false;
      lastPlayed[name] = clock;
      voice(name, detail || {});
      return true;
    }
    function setMode(next) { mode = normalizeMode(next); return mode; }
    function getMode() { return mode; }
    function setGain(next) {
      const value = Math.max(0, Math.min(1, Number(next)));
      if (Number.isFinite(value) && master && ctx) master.gain.setTargetAtTime(value, ctx.currentTime, .02);
      return Number.isFinite(value) ? value : null;
    }
    function stop() {
      for (const source of activeStops) { try { source.stop(); } catch (_) {} }
      activeStops.clear();
    }
    function diagnostics() { return { version: VERSION, mode, context: ctx ? ctx.state : 'idle', active: activeStops.size }; }
    return { play, stop, setMode, getMode, setGain, diagnostics };
  }

  return { VERSION, MODES, EVENTS, normalizeMode, normalizeEvent, isAllowed, rarityIndex, create };
});
