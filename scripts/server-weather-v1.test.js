'use strict';

// Прокси погоды: MET Norway с кэшем по Expires и условным запросом, Nominatim не чаще раза в
// секунду. Наружу — только место до ~1 км. Сеть в тестах подменена.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const W = require('../server-weather-v1.js');

const NOW = Date.parse('2026-10-05T06:00:00Z');
const met = { properties: { timeseries: [
  { time: '2026-10-05T06:00:00Z', data: { instant: { details: { air_temperature: 9.1 } }, next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 1.2, probability_of_precipitation: 88, probability_of_thunder: 1 } } } },
  { time: '2026-10-05T07:00:00Z', data: { instant: { details: { air_temperature: 9.4 } }, next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0, probability_of_precipitation: 12 } }, next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 6 } } } },
  { time: '2026-10-05T08:00:00Z', data: { instant: { details: { air_temperature: 10 } }, next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 6, probability_of_precipitation: 70 } } } },
  { time: '2026-10-20T00:00:00Z', data: { instant: { details: {} }, next_6_hours: { summary: { symbol_code: 'clearsky' }, details: {} } } },
] } };

test('MET series: hourly values win, six-hour blocks fill the rest, nothing past ten days', () => {
  const hours = W.parseMet(met, NOW);
  assert.deepEqual(hours.slice(0, 3).map((h) => [h.t.slice(11, 16), h.symbol, h.prob, h.precip]), [['06:00', 'rain', 88, 1.2], ['07:00', 'cloudy', 12, 0], ['08:00', 'rain', 70, 1]]);
  assert.equal(hours.length, 8, '06, 07, then 08–13 from the six-hour block');
  assert.equal(hours.at(-1).t, '2026-10-05T13:00:00.000Z');
  assert.equal(hours[0].temp, 9.1);
});

test('cache lifetime follows Expires within 10 minutes … 3 hours', () => {
  assert.equal(W.ttl({ expires: new Date(NOW + 45 * 60e3).toUTCString() }, NOW), 45 * 60e3);
  assert.equal(W.ttl({ expires: new Date(NOW + 60e3).toUTCString() }, NOW), 10 * 60e3);
  assert.equal(W.ttl({ expires: new Date(NOW + 864e5).toUTCString() }, NOW), 3 * 3600e3);
  assert.equal(W.ttl({}, NOW), 30 * 60e3);
});

test('forecast: rounded place, one request per cache window, conditional refresh, stale copy on failure', async () => {
  let now = NOW; const calls = [];
  let reply = { status: 200, json: met, headers: { expires: new Date(NOW + 30 * 60e3).toUTCString(), 'last-modified': 'Mon, 05 Oct 2026 05:50:00 GMT' } };
  const svc = W.create({ now: () => now, request: async (r) => { calls.push(r); return reply; } });
  const [a, b] = await Promise.all([svc.forecast(52.11523, 8.67342), svc.forecast('52.1201', '8.6699')]);
  assert.equal(calls.length, 1, 'parallel requests for the same ~1 km share one fetch');
  assert.equal(calls[0].host, 'api.met.no');
  assert.equal(calls[0].path, '/weatherapi/locationforecast/2.0/complete?lat=52.12&lon=8.67');
  assert.deepEqual(a.place, { lat: 52.12, lon: 8.67 }); assert.equal(a.source, 'MET Norway'); assert.equal(b.hours.length, a.hours.length);
  await svc.forecast(52.12, 8.67); assert.equal(calls.length, 1, 'fresh cache');
  now += 31 * 60e3; reply = { status: 304, json: null, headers: { expires: new Date(now + 20 * 60e3).toUTCString() } };
  const c = await svc.forecast(52.12, 8.67);
  assert.equal(calls.length, 2); assert.equal(calls[1].headers['If-Modified-Since'], 'Mon, 05 Oct 2026 05:50:00 GMT');
  assert.equal(c.hours.length, a.hours.length);
  now = NOW + 150 * 60e3; reply = { status: 503, json: null, headers: {} };
  const stale = await svc.forecast(52.12, 8.67);
  assert.equal(stale.source, 'MET Norway', 'an outage serves the last copy');
  assert.equal(stale.hours.length, a.hours.length - 1, 'hours older than two hours are dropped');
  assert.deepEqual(await svc.forecast(null, 8), { error: 'bad_place' });
  assert.deepEqual(await svc.forecast(95, 8), { error: 'bad_place' });
  const empty = W.create({ now: () => NOW, request: async () => { throw new Error('offline'); } });
  assert.deepEqual(await empty.forecast(1, 1), { error: 'weather_unavailable' });
});

test('city search: Nominatim at most once a second, cached, short names', async () => {
  let now = NOW; const calls = [], waits = [];
  const svc = W.create({ now: () => now, wait: async (ms) => { waits.push(ms); now += ms; },
    request: async (r) => { calls.push(r); return { status: 200, json: [{ lat: '52.1145', lon: '8.6730', display_name: 'Herford, Kreis Herford, Nordrhein-Westfalen, Deutschland' }], headers: {} }; } });
  const first = await svc.place('Herford', 'ru');
  assert.deepEqual(first, { places: [{ name: 'Herford, Kreis Herford', lat: 52.11, lon: 8.67 }] });
  assert.equal(calls[0].host, 'nominatim.openstreetmap.org');
  assert.match(calls[0].path, /format=jsonv2&limit=3&accept-language=ru&q=Herford$/);
  await svc.place('herford ', 'ru'); assert.equal(calls.length, 1, 'cached by normalized query');
  await svc.place('Bielefeld', 'de');
  assert.equal(calls.length, 2); assert.ok(waits[0] >= 1000, 'second lookup waits for the one-second gap');
  assert.deepEqual(await svc.place('x'), { error: 'bad_query' });
  assert.deepEqual(W.parsePlaces([
    { lat: '52.1145', lon: '8.6730', display_name: 'Хе́рфорд, Kreis Herford, Северный Рейн-Вестфалия' },
    { lat: '52.1180', lon: '8.6710', display_name: 'Херфорд, Хе́рфорд' },
    { lat: '36.72', lon: '-4.42', display_name: 'Málaga, Andalucía' },
  ]), [{ name: 'Херфорд, Kreis Herford', lat: 52.11, lon: 8.67 }, { name: 'Херфорд', lat: 52.12, lon: 8.67 }, { name: 'Málaga, Andalucía', lat: 36.72, lon: -4.42 }],
  'stress marks go only after Cyrillic letters; repeated parts collapse');
  assert.match(W.USER_AGENT, /satoruapp\.com/);
});

test('server route: sign-in required and bad input refused before any network call', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-weather-'));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 2400; i += 1) {
      if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
      try { if ((await fetch(`${base}/api/auth/profiles`)).ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal((await fetch(`${base}/api/weather?lat=52.1&lon=8.6`)).status, 401);
    const reg = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'W', email: 'weather@example.test', password: 'weather-pass-11' }) });
    const cookie = reg.headers.get('set-cookie').split(';')[0];
    const bad = await fetch(`${base}/api/weather?lat=&lon=8`, { headers: { Cookie: cookie } });
    assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'bad_place');
    const q = await fetch(`${base}/api/weather/place?q=x`, { headers: { Cookie: cookie } });
    assert.equal(q.status, 400); assert.equal((await q.json()).error, 'bad_query');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
