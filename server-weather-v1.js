'use strict';

/* Погода для занятий на улице (владелец 05.10). Прогноз — MET Norway Locationforecast 2.0
 * (CC BY 4.0, подпись в интерфейсе), город → координаты — OpenStreetMap Nominatim (ODbL).
 * Браузер к ним не ходит: запросы идут через наш сервер с кэшем, как требуют условия MET;
 * наружу уходит только место, округлённое до ~1 км, и введённое название города. */

const https = require('node:https');

const USER_AGENT = 'Satoru/1.0 (https://satoruapp.com; satoru@satoruapp.com)';
const MET_HOST = 'api.met.no';
const OSM_HOST = 'nominatim.openstreetmap.org';
const MIN_TTL = 10 * 60 * 1000, MAX_TTL = 3 * 60 * 60 * 1000, DEFAULT_TTL = 30 * 60 * 1000;
const PLACE_TTL = 24 * 60 * 60 * 1000, OSM_GAP_MS = 1100, MAX_CACHE = 300;

function coord(lat, lon) {
  if (lat == null || lon == null || lat === '' || lon === '') return null;
  const a = Number(lat), b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: Math.round(a * 100) / 100, lon: Math.round(b * 100) / 100 };
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// MET timeseries → hourly slots for up to ten days: hourly where the forecast is hourly,
// six-hour blocks spread over their hours after that.
function parseMet(json, nowMs = Date.now()) {
  const series = json && json.properties && Array.isArray(json.properties.timeseries) ? json.properties.timeseries : [];
  const slots = new Map(), limit = nowMs + 10 * 864e5, floor = nowMs - 2 * 3600e3;
  const put = (t, row, override) => { if (t < floor || t > limit) return; const k = new Date(t).toISOString(); if (override || !slots.has(k)) slots.set(k, row); };
  for (const entry of series) {
    const t = Date.parse(entry && entry.time), d = (entry && entry.data) || {};
    if (!Number.isFinite(t) || !d.next_1_hours) continue;
    const det = d.next_1_hours.details || {}, inst = (d.instant && d.instant.details) || {};
    put(t, { temp: num(inst.air_temperature), precip: num(det.precipitation_amount), prob: num(det.probability_of_precipitation),
      thunder: num(det.probability_of_thunder), symbol: String((d.next_1_hours.summary || {}).symbol_code || '').slice(0, 40) }, true);
  }
  for (const entry of series) {
    const t = Date.parse(entry && entry.time), d = (entry && entry.data) || {};
    if (!Number.isFinite(t) || d.next_1_hours || !d.next_6_hours) continue;
    const det = d.next_6_hours.details || {}, inst = (d.instant && d.instant.details) || {}, amount = num(det.precipitation_amount);
    for (let h = 0; h < 6; h++) put(t + h * 3600e3, { temp: num(inst.air_temperature), precip: amount === null ? null : Math.round(amount / 6 * 100) / 100,
      prob: num(det.probability_of_precipitation), thunder: num(det.probability_of_thunder), symbol: String((d.next_6_hours.summary || {}).symbol_code || '').slice(0, 40) }, false);
  }
  return [...slots.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([t, row]) => Object.assign({ t }, row));
}
function ttl(headers, nowMs = Date.now()) {
  const at = Date.parse(headers && headers.expires);
  return Number.isFinite(at) ? Math.max(MIN_TTL, Math.min(MAX_TTL, at - nowMs)) : DEFAULT_TTL;
}
// Русские названия в OSM несут знак ударения («Хе́рфорд») — убираем его только после кириллицы,
// чтобы не сломать «Málaga». Одно и то же место (город и район с теми же координатами) — один раз.
const plainName = (text) => String(text || '').normalize('NFD').replace(/([\u0400-\u04FF])\u0301/g, '$1').normalize('NFC');
function parsePlaces(json) {
  const out = [], seen = new Set();
  for (const p of (Array.isArray(json) ? json : []).slice(0, 5)) {
    const c = coord(p && p.lat, p && p.lon);
    if (!c || seen.has(`${c.lat},${c.lon}`)) continue;
    seen.add(`${c.lat},${c.lon}`);
    const parts = plainName(p.display_name || p.name).split(',').map((x) => x.trim()).filter(Boolean);
    out.push({ name: [...new Set(parts)].slice(0, 2).join(', ').slice(0, 80) || `${c.lat}, ${c.lon}`, lat: c.lat, lon: c.lon });
    if (out.length >= 3) break;
  }
  return out;
}

function defaultRequest({ host, path, headers }) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host, path, method: 'GET', headers: Object.assign({ 'User-Agent': USER_AGENT, Accept: 'application/json' }, headers) }, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(Buffer.from(c)));
      resp.on('end', () => {
        let json = null; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch { json = null; }
        resolve({ status: resp.statusCode, json, headers: resp.headers });
      });
    });
    r.setTimeout(10000, () => r.destroy(new Error('weather timeout')));
    r.on('error', reject); r.end();
  });
}

function create({ request = defaultRequest, now = Date.now, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const forecasts = new Map(), places = new Map(), pending = new Map();
  let osmChain = Promise.resolve(), osmLast = 0;
  const trim = (map) => { while (map.size > MAX_CACHE) map.delete(map.keys().next().value); };

  async function forecast(lat, lon) {
    const c = coord(lat, lon);
    if (!c) return { error: 'bad_place' };
    const key = `${c.lat},${c.lon}`, cached = forecasts.get(key);
    if (cached && cached.expires > now()) return view(c, cached);
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      try {
        const headers = cached && cached.lastModified ? { 'If-Modified-Since': cached.lastModified } : {};
        const r = await request({ host: MET_HOST, path: `/weatherapi/locationforecast/2.0/complete?lat=${c.lat}&lon=${c.lon}`, headers });
        if (r.status === 304 && cached) { cached.expires = now() + ttl(r.headers, now()); return view(c, cached); }
        if (r.status !== 200 || !r.json) return cached ? view(c, cached) : { error: 'weather_unavailable' };
        const entry = { hours: parseMet(r.json, now()), updatedAt: new Date(now()).toISOString(), lastModified: (r.headers || {})['last-modified'] || '', expires: now() + ttl(r.headers, now()) };
        forecasts.delete(key); forecasts.set(key, entry); trim(forecasts);
        return view(c, entry);
      } catch { return cached ? view(c, cached) : { error: 'weather_unavailable' }; }
      finally { pending.delete(key); }
    })();
    pending.set(key, job);
    return job;
  }
  function view(c, entry) {
    const floor = now() - 2 * 3600e3;
    return { place: c, updatedAt: entry.updatedAt, hours: entry.hours.filter((h) => Date.parse(h.t) >= floor), source: 'MET Norway' };
  }

  async function place(query, lang) {
    const q = String(query || '').replace(/\s+/g, ' ').trim();
    if (q.length < 2 || q.length > 80) return { error: 'bad_query' };
    const language = ['ru', 'en', 'de', 'uk', 'es'].includes(lang) ? lang : 'en';
    const key = `${language}|${q.toLowerCase()}`, cached = places.get(key);
    if (cached && cached.expires > now()) return { places: cached.places };
    // Nominatim: не чаще одного запроса в секунду на всё приложение.
    const run = osmChain.then(async () => {
      const gap = osmLast + OSM_GAP_MS - now();
      if (gap > 0) await wait(gap);
      osmLast = now();
      try {
        const r = await request({ host: OSM_HOST, path: `/search?format=jsonv2&limit=3&accept-language=${language}&q=${encodeURIComponent(q)}`, headers: {} });
        if (r.status !== 200) return { error: 'place_unavailable' };
        const list = parsePlaces(r.json);
        places.delete(key); places.set(key, { places: list, expires: now() + PLACE_TTL }); trim(places);
        return { places: list };
      } catch { return { error: 'place_unavailable' }; }
    });
    osmChain = run.catch(() => {});
    return run;
  }
  return { forecast, place };
}

module.exports = { USER_AGENT, coord, parseMet, ttl, parsePlaces, defaultRequest, create };
