/* Routine v2 — the person's recurring week. Generalised from the owner's request 05.10:
   fixed appointments (classes, a sports section — never moved), flexible activities (gym, a run;
   may be moved or skipped, may have no set hour), rotations ("week 1 gym, week 2 run, week 3 rest,
   week 4 study" on the same evening) and the life sphere each one belongs to.
   An occurrence becomes a quest only when the person acts on it (counts it, moves it, accepts a
   weather swap); until then it is a schedule layer, not a to-do — a missed class is not debt.
   Pure UMD: no DOM, State, fetch or Store. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoutineV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const MAX_BLOCKS = 70, MAX_EVERY = 4, MAX_SKIPS = 300, DAY_MS = 86400000;
  const EPOCH = '2024-01-01'; // a Monday: rotation anchor when none was stored
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ID = /^r-[a-z0-9-]{4,40}$/;
  const KEY = /^r-[a-z0-9-]{4,40}\|\d{4}-\d{2}-\d{2}$/;

  function minutes(value) {
    if (!TIME.test(String(value))) return null;
    const [h, m] = String(value).split(':').map(Number);
    return h * 60 + m;
  }
  const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  function stamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_date');
    const n = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new Error('invalid_date');
    return n;
  }
  function isDate(value) { try { stamp(value); return true; } catch { return false; } }
  const iso = (n) => new Date(n).toISOString().slice(0, 10);
  const addDays = (date, n) => iso(stamp(date) + n * DAY_MS);
  function monday(date) { const n = stamp(date); return iso(n - ((new Date(n).getUTCDay() + 6) % 7) * DAY_MS); }
  // JS weekday (0 = Sunday, as in v1 blocks) → offset from Monday.
  const offsetOf = (day) => (day + 6) % 7;
  function hash(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  // Saved blocks carry their own id. A v1 block (or an AI draft) gets a content-derived id so the
  // same block keeps the same occurrences until the editor saves a permanent id for it.
  function blockId(b) {
    if (typeof b.id === 'string' && ID.test(b.id)) return b.id;
    return 'r-' + hash([b.day, b.start || '', b.end || '', b.title || '', b.every || 1, b.week || 1].join('|'));
  }

  function block(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('invalid_block');
    const day = Number(raw.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('invalid_block');
    const title = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    let start = raw.start == null || raw.start === '' ? null : raw.start;
    let end = raw.end == null || raw.end === '' ? null : raw.end;
    const a = start === null ? null : minutes(start);
    let b = end === null ? null : minutes(end);
    if ((start !== null && a === null) || (end !== null && b === null)) throw new Error('invalid_block');
    let length = Math.round(Number(raw.minutes));
    // "18:00, 90 minutes" is a complete appointment; one bare end is not.
    if (a !== null && b === null && Number.isInteger(length) && length >= 5 && a + length <= 1439) { b = a + length; end = clock(b); }
    if ((a === null) !== (b === null)) throw new Error('invalid_block');
    if (a !== null && a >= b) throw new Error('invalid_block');
    const timed = a !== null;
    if (!timed && (!Number.isFinite(length) || length < 5 || length > 600)) throw new Error('invalid_block');
    const every = Number.isInteger(raw.every) && raw.every >= 1 && raw.every <= MAX_EVERY ? raw.every : 1;
    const week = every > 1 && Number.isInteger(raw.week) && raw.week >= 1 && raw.week <= every ? raw.week : 1;
    const skillId = typeof raw.skillId === 'string' && raw.skillId.trim() && raw.skillId.length <= 120 ? raw.skillId : null;
    const out = {
      day, start: timed ? start : null, end: timed ? end : null, minutes: timed ? b - a : length, title, skillId,
      // Without an hour there is nothing to hold fixed: such an activity is flexible by nature.
      fixed: timed ? raw.fixed !== false : false, outdoor: raw.outdoor === true, every, week,
    };
    out.id = blockId(Object.assign({}, out, { id: raw.id }));
    return out;
  }
  // Editor: every row must be valid, or nothing is saved.
  function blocks(list) {
    if (!Array.isArray(list) || list.length > MAX_BLOCKS) throw new Error('invalid_blocks');
    const out = list.map(block), ids = new Set();
    for (const b of out) { if (ids.has(b.id)) b.id = blockId(Object.assign({}, b, { id: null, title: b.title + '#' + ids.size })); ids.add(b.id); }
    return out;
  }
  function placeOf(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const lat = Number(raw.lat), lon = Number(raw.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    // A searched city: ~1 km is enough for a forecast. The app place itself is shared with the sky board.
    return { name: String(raw.name || '').slice(0, 80), lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
  }
  // Reading is lenient: one broken saved row must not hide the whole week.
  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const out = [], ids = new Set();
    for (const item of Array.isArray(r.blocks) ? r.blocks.slice(0, MAX_BLOCKS) : []) {
      try { const b = block(item); if (ids.has(b.id)) continue; ids.add(b.id); out.push(b); } catch {}
    }
    const a = minutes(r.from), z = minutes(r.to), hours = a !== null && z !== null && a < z;
    return {
      text: typeof r.text === 'string' ? r.text.slice(0, 6000) : '',
      blocks: out,
      from: hours ? r.from : '09:00', to: hours ? r.to : '18:00',
      cycleStart: isDate(r.cycleStart) ? monday(r.cycleStart) : (out.some((b) => b.every > 1) ? EPOCH : null),
      skips: Array.isArray(r.skips) ? [...new Set(r.skips.filter((k) => typeof k === 'string' && KEY.test(k)))].slice(-MAX_SKIPS) : [],
    };
  }
  function weekIndex(cycleStart, weekStart) {
    return Math.round((stamp(monday(weekStart)) - stamp(monday(cycleStart || EPOCH))) / (7 * DAY_MS));
  }
  function activeIn(b, weekStart, cycleStart) {
    if (b.every <= 1) return true;
    const i = weekIndex(cycleStart, weekStart);
    return ((i % b.every) + b.every) % b.every === b.week - 1;
  }
  function occurrences(raw, weekStart, { withSkipped = false } = {}) {
    const r = normalize(raw), start = monday(weekStart), skipped = new Set(r.skips), out = [];
    for (const b of r.blocks) {
      if (!activeIn(b, start, r.cycleStart)) continue;
      const date = addDays(start, offsetOf(b.day)), key = `${b.id}|${date}`;
      if (!withSkipped && skipped.has(key)) continue;
      out.push({ key, blockId: b.id, date, day: b.day, start: b.start, end: b.end, minutes: b.minutes, title: b.title,
        skillId: b.skillId, fixed: b.fixed, outdoor: b.outdoor, skipped: skipped.has(key) });
    }
    return out.sort((x, y) => x.date.localeCompare(y.date) || String(x.start || '99').localeCompare(String(y.start || '99')) || x.title.localeCompare(y.title));
  }
  // Occurrences already turned into quests are shown and held as quests, not twice.
  function pending(raw, weekStart, takenKeys) {
    const taken = takenKeys instanceof Set ? takenKeys : new Set(takenKeys || []);
    return occurrences(raw, weekStart).filter((o) => !taken.has(o.key));
  }
  // Busy intervals for the v1 planner and the assistant's conflict check: one week, v1 shape.
  function busyBlocks(raw, weekStart, takenKeys) {
    return pending(raw, weekStart, takenKeys).filter((o) => o.start).map((o) => ({ day: o.day, start: o.start, end: o.end, title: o.title }));
  }
  // Editor choices for a rotation, named by the nearest date so "2 of 4" is never abstract.
  function cycleChoices(weekStart, cycleStart, day) {
    const start = monday(weekStart), out = [{ every: 1, week: 1, next: addDays(start, offsetOf(day)) }];
    for (let every = 2; every <= MAX_EVERY; every++) {
      for (let week = 1; week <= every; week++) {
        for (let k = 0; k < every; k++) {
          const ws = addDays(start, 7 * k);
          if (activeIn({ every, week }, ws, cycleStart)) { out.push({ every, week, next: addDays(ws, offsetOf(day)) }); break; }
        }
      }
    }
    return out;
  }
  // An AI draft counts weeks from the current week; the saved routine may have its own anchor.
  function rebase(b, fromAnchor, toAnchor) {
    if (!b || b.every <= 1) return b;
    const shift = weekIndex(toAnchor || EPOCH, fromAnchor || EPOCH);
    return Object.assign({}, b, { week: (((b.week - 1 + shift) % b.every) + b.every) % b.every + 1 });
  }
  // The routine quest every action on an occurrence creates. Rewards follow normal quest rules.
  function questFrom(occ, { id, nowIso, skillId, date, startTime } = {}) {
    const sphere = skillId || occ.skillId;
    return {
      id, title: occ.title, skillId: sphere, skillIds: [sphere], estimateMin: occ.minutes, difficulty: 'normal',
      date: date || occ.date, done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null,
      startTime: startTime === undefined ? occ.start : startTime, createdAt: nowIso, source: 'routine', routineKey: occ.key,
    };
  }
  // AI drafts: same contract as the editor, sphere ids only from the person's own list.
  function fromAi(value, { skillIds = [] } = {}) {
    const allowed = new Set(skillIds);
    const list = Array.isArray(value) ? value : Array.isArray(value && value.blocks) ? value.blocks : [];
    const out = [];
    for (const raw of list.slice(0, MAX_BLOCKS)) {
      if (!raw || typeof raw !== 'object') continue;
      const days = Array.isArray(raw.days) ? raw.days : [raw.day];
      for (const day of days.slice(0, 7)) {
        try {
          out.push(block({ day, start: raw.start, end: raw.end, minutes: raw.minutes, title: raw.title,
            skillId: allowed.has(raw.sphere) ? raw.sphere : null, fixed: raw.fixed !== false, outdoor: raw.outdoor === true,
            every: Number(raw.every), week: Number(raw.week) }));
        } catch {}
        if (out.length >= MAX_BLOCKS) return blocks(out);
      }
    }
    return blocks(out);
  }
  return Object.freeze({ MAX_BLOCKS, MAX_EVERY, MAX_SKIPS, EPOCH, minutes, clock, monday, addDays, isDate, block, blocks, normalize,
    weekIndex, activeIn, occurrences, pending, busyBlocks, cycleChoices, rebase, questFrom, fromAi, placeOf });
});
