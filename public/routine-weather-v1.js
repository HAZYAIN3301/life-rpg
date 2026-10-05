/* Routine weather v1 — the owner's example, generalised (05.10): a flexible outdoor activity on a
   rainy slot is swapped with a flexible indoor one on a dry day of the same week, or moved to a dry
   day; a fixed one (a club section, cycling to school) is never moved — only a warning, so the
   person can choose transport or plan around it. Hours come from the server forecast proxy as UTC
   ISO strings; this module reads them in the device's local time. Pure: no DOM, State or fetch. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoutineWeatherV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const DAY_FROM = 8 * 60, DAY_TO = 20 * 60, MAX_SUGGESTIONS = 3;
  const WET_SYMBOL = /rain|sleet|snow|thunder/;
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const minutes = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // Forecast hours → 'YYYY-MM-DD|H' (device-local) → one slot.
  function byLocalHour(hours) {
    const out = new Map();
    for (const h of Array.isArray(hours) ? hours : []) {
      const d = new Date(h && h.t);
      if (!Number.isFinite(+d)) continue;
      out.set(`${localDate(d)}|${d.getHours()}`, { prob: num(h.prob), precip: num(h.precip), thunder: num(h.thunder), temp: num(h.temp), symbol: String(h.symbol || '') });
    }
    return out;
  }
  function wetSlot(s) {
    if (!s) return false;
    if (s.prob !== null && s.prob >= 60) return true;
    if (s.precip !== null && s.precip >= 0.5) return true;
    if (s.thunder !== null && s.thunder >= 30) return true;
    return WET_SYMBOL.test(s.symbol) && (s.prob === null || s.prob >= 40);
  }
  // Weather over an interval: wet when any hour is wet for a timed slot; for a day without an hour,
  // when at least half of the daytime hours are wet (a dry evening still allows a run).
  function weatherFor(map, date, start, end, { untimed = false } = {}) {
    const from = untimed ? DAY_FROM : start, to = untimed ? DAY_TO : end;
    let known = 0, wet = 0, prob = null, precip = 0, temp = null;
    for (let h = Math.floor(from / 60); h * 60 < to; h++) {
      const s = map.get(`${date}|${h}`);
      if (!s) continue;
      known++; if (wetSlot(s)) wet++;
      if (s.prob !== null) prob = Math.max(prob ?? 0, s.prob);
      if (s.precip !== null) precip += s.precip;
      if (s.temp !== null) temp = temp === null ? s.temp : Math.min(temp, s.temp);
    }
    if (!known) return { known: false, wet: false, prob: null, precip: null, temp: null };
    return { known: true, wet: untimed ? wet * 2 >= known : wet > 0, prob, precip: Math.round(precip * 10) / 10, temp };
  }
  const slotOf = (o, date, start) => {
    const s = start === undefined ? o.start : start, a = minutes(s);
    return a === null ? { date, start: null, end: null, a: null, b: null } : { date, start: s, a, b: a + o.minutes };
  };
  const overlaps = (a1, b1, a2, b2) => a1 < b2 && a2 < b1;

  // occurrences: pending RoutineV2 occurrences of one week (already without acted-on/skipped).
  // tasks: quests of that week (timed, not done) — they hold time. today/nowTime: device-local.
  function plan({ occurrences = [], tasks = [], hours = [], today, nowTime = '00:00' } = {}) {
    const map = byLocalHour(hours), now = minutes(nowTime) ?? 0;
    const future = (o, date, a) => date > today || (date === today && (a === null ? now < DAY_TO : a > now));
    const weatherOf = (o, slot) => weatherFor(map, slot.date, slot.a, slot.b, { untimed: slot.a === null });
    const held = (except) => {
      const out = [];
      for (const q of tasks) {
        const a = minutes(q.startTime), d = Number(q.estimateMin);
        if (!q.done && a !== null) out.push({ date: q.date, a, b: a + (Number.isFinite(d) && d > 0 ? d : 30) });
      }
      for (const o of occurrences) if (!except.includes(o) && o.start) out.push({ date: o.date, a: minutes(o.start), b: minutes(o.end) });
      return out;
    };
    const free = (slot, except) => slot.a === null || !held(except).some((h) => h.date === slot.date && overlaps(slot.a, slot.b, h.a, h.b));
    const out = [], used = new Set();
    for (const a of occurrences) {
      if (!a.outdoor || used.has(a.key) || out.length >= MAX_SUGGESTIONS) continue;
      const here = slotOf(a, a.date);
      if (!future(a, a.date, here.a)) continue;
      const w = weatherOf(a, here);
      if (!w.known || !w.wet) continue;
      if (a.fixed) { out.push({ type: 'warn', a, weather: w }); used.add(a.key); continue; }
      // 1) Swap with a flexible indoor activity on a dry slot of the same week.
      let best = null;
      for (const b of occurrences) {
        if (b === a || b.outdoor || b.fixed || used.has(b.key) || !future(b, b.date, minutes(b.start))) continue;
        for (const [aTo, bTo] of [[slotOf(a, b.date), slotOf(b, a.date)], [slotOf(a, b.date, b.start), slotOf(b, a.date, a.start)]]) {
          if (aTo.date === a.date && aTo.start === a.start) continue;
          if (!future(a, aTo.date, aTo.a) || !future(b, bTo.date, bTo.a)) continue;
          const wa = weatherOf(a, aTo);
          if (!wa.known || wa.wet || !free(aTo, [a, b]) || !free(bTo, [a, b])) continue;
          if (aTo.a !== null && bTo.a !== null && aTo.date === bTo.date && overlaps(aTo.a, aTo.b, bTo.a, bTo.b)) continue;
          const score = Math.abs(Date.parse(b.date) - Date.parse(a.date)) / 864e5 * 10 + Math.abs(a.minutes - b.minutes) / 10;
          if (!best || score < best.score) best = { score, b, aTo, bTo, weather: wa };
          break;
        }
      }
      if (best) {
        out.push({ type: 'swap', a, b: best.b, aTo: { date: best.aTo.date, start: best.aTo.start }, bTo: { date: best.bTo.date, start: best.bTo.start }, weather: w, then: best.weather });
        used.add(a.key); used.add(best.b.key); continue;
      }
      // 2) Move to the nearest dry, free day of the same week at the same hour.
      const weekDays = weekOf(a.date).filter((d) => d !== a.date)
        .sort((x, y) => Math.abs(Date.parse(x) - Date.parse(a.date)) - Math.abs(Date.parse(y) - Date.parse(a.date)) || x.localeCompare(y));
      let moved = null;
      for (const d of weekDays) {
        const to = slotOf(a, d);
        if (!future(a, d, to.a)) continue;
        const wt = weatherOf(a, to);
        if (wt.known && !wt.wet && free(to, [a])) { moved = { to, wt }; break; }
      }
      if (moved) { out.push({ type: 'move', a, aTo: { date: moved.to.date, start: moved.to.start }, weather: w, then: moved.wt }); used.add(a.key); continue; }
      out.push({ type: 'warn', a, weather: w }); used.add(a.key);
    }
    return out;
  }
  function weekOf(date) {
    const d = Date.parse(date + 'T12:00:00Z'), start = d - ((new Date(d).getUTCDay() + 6) % 7) * 864e5;
    return Array.from({ length: 7 }, (_, i) => new Date(start + i * 864e5).toISOString().slice(0, 10));
  }
  return Object.freeze({ byLocalHour, wetSlot, weatherFor, plan, weekOf });
});
