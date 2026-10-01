'use strict';

/* Мост Senku → Satoru, фаза 1: факты показываются, ничего не начисляется.
 *
 * Проверяется там, где мост может сломаться по-настоящему: на образце ответа Senku,
 * на поддельном сервере Senku по HTTP (401, 500, обрыв сети, повтор сессии, поздняя
 * сессия, курсор) и на границе аккаунта Satoru (ключ не уходит ни в ответы, ни в
 * общий /api/data, ни в экспорт, ни в журнал сервера).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const Bridge = require('../server-senku-bridge-v1.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'senku-facts-v1.example.json');
const SENKU_EXAMPLE = path.join(os.homedir(), 'Projects', 'senku', 'bridge', 'facts-v1.example.json');
const fixture = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const DAY = { from: '2026-09-28T00:00:00.000Z', to: '2026-09-29T00:00:00.000Z' };
const MIN = 60 * 1000;

function fakeKey() { return `fake-senku-${crypto.randomBytes(18).toString('base64url')}`; }

function ride(over = {}) {
  return Object.assign({
    id: 'ride-a-1', kind: 'voice', deck: 'deck-a', deckName: 'Deck A', folder: ['Cards'],
    startedAt: '2026-09-28T08:00:00.000Z', endedAt: '2026-09-28T08:20:00.000Z', finished: true,
    cards: 10, durationMs: 20 * MIN, changedAt: '2026-09-28T08:20:05.000Z',
  }, over);
}

// ---- Поддельный Senku: тот же контракт, управляемые сбои, журнал запросов ----
async function startFakeSenku() {
  const state = { key: fakeKey(), mode: 'ok', rides: [], serverTime: '2026-09-28T09:00:00.000Z', revision: 1, requests: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fake');
    state.requests.push({ path: url.pathname, since: url.searchParams.get('since'), auth: req.headers.authorization || '' });
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname !== '/api/bridge/facts') return json(404, { error: 'not_found' });
    if (state.mode === 'network') { req.socket.destroy(); return; }
    if (req.headers.authorization !== `Bearer ${state.key}`) return json(401, { error: 'invalid_token' });
    if (state.mode === 'corrupt') return json(500, { ok: false, error: 'server_snapshot_corrupt' });
    if (state.mode === 'garbage') return json(200, { ok: true, source: 'other', version: 2, rides: [] });
    const since = Date.parse(url.searchParams.get('since') || '');
    const rides = state.rides.filter((one) => Number.isNaN(since) || Date.parse(one.changedAt) >= since);
    return json(200, { ok: true, source: 'senku', version: 1, revision: state.revision, serverTime: state.serverTime, nextSince: state.serverTime, rides });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  state.origin = `http://127.0.0.1:${server.address().port}`;
  state.close = () => new Promise((resolve) => server.close(resolve));
  return state;
}

function moduleWith(senku, clock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-senku-unit-'));
  const logs = [];
  const bridge = Bridge.create({
    userDataDir: (id) => path.join(dir, id), now: () => clock.t, testOrigins: [senku.origin],
    log: (event, detail) => logs.push(`${event} ${JSON.stringify(detail)}`),
  });
  const file = (uid = 'u1') => path.join(dir, uid, `${Bridge.FILE}.json`);
  return { bridge, dir, logs, file, stored: (uid) => JSON.parse(fs.readFileSync(file(uid), 'utf8')) };
}

// ---------------------------------------------------------------- образец и правила дня

test('образец Senku читается целиком и совпадает с оригиналом в репозитории Senku', (t) => {
  const facts = Bridge.parseFacts(JSON.stringify(fixture()));
  assert.equal(facts.ok, true);
  assert.equal(facts.skipped, 0);
  assert.equal(facts.nextSince, '2026-09-28T07:45:10.512Z');
  assert.deepEqual(facts.rides.map((one) => [one.id, one.kind, one.cards, one.durationMs, one.endedAt]), [
    ['ride1k8f2x-1', 'voice', 14, 1290000, '2026-09-28T07:13:30.000Z'],
    ['smuk87mma-2', 'visual', 6, null, null],
  ]);
  if (!fs.existsSync(SENKU_EXAMPLE)) return t.skip('репозитория Senku на этой машине нет — сверка пропущена');
  assert.deepEqual(fixture(), JSON.parse(fs.readFileSync(SENKU_EXAMPLE, 'utf8')), 'образец в Satoru отстал от контракта Senku');
});

test('день по образцу: N карточек, M минут, голосом K; открытая сессия без минут', () => {
  const view = Bridge.dayView(Bridge.parseFacts(JSON.stringify(fixture())).rides, Date.parse(DAY.from), Date.parse(DAY.to));
  assert.equal(view.cards, 20);
  assert.equal(view.voiceCards, 14);
  assert.equal(view.minutes, 22); // 21,5 минуты поездки; глазами ещё не закрыто — минут не даёт
  assert.equal(view.sessions.length, 2);
  assert.deepEqual(view.sessions.map((one) => [one.kind, one.open, one.minutes, one.decks[0].name]), [
    ['voice', false, 22, 'Transkription'],
    ['visual', true, null, '12.1 (2)'],
  ]);
});

test('поездка по папке из трёх колод — одна сессия, минуты не утраиваются', () => {
  const rides = [1, 2, 3].map((n) => Bridge.normalizeRide(ride({ id: `ride-f-${n}`, deck: `d${n}`, deckName: `Deck ${n}`, cards: n * 2 })));
  const view = Bridge.dayView(rides, Date.parse(DAY.from), Date.parse(DAY.to));
  assert.equal(view.sessions.length, 1);
  assert.equal(view.cards, 12);
  assert.equal(view.minutes, 20);
  assert.deepEqual(view.sessions[0].decks.map((one) => one.name), ['Deck 3', 'Deck 2', 'Deck 1']);
});

test('здравый смысл: 0 карточек — не занятие, дольше 6 часов — длительность не учитывается, чужой день не считается', () => {
  const rides = [
    ride({ id: 'zero-1', cards: 0 }),
    ride({ id: 'long-1', kind: 'visual', startedAt: '2026-09-28T10:00:00.000Z', endedAt: '2026-09-28T17:00:00.000Z', durationMs: 7 * 60 * MIN, cards: 5 }),
    ride({ id: 'yday-1', startedAt: '2026-09-27T23:50:00.000Z', endedAt: '2026-09-28T00:10:00.000Z', cards: 9 }),
  ].map(Bridge.normalizeRide);
  const view = Bridge.dayView(rides, Date.parse(DAY.from), Date.parse(DAY.to));
  assert.equal(view.cards, 5);
  assert.equal(view.minutes, 0);
  assert.equal(view.voiceCards, 0);
  assert.equal(view.sessions[0].durationTrusted, false);
  assert.equal(view.sessions[0].minutes, null);
});

test('контракт строгий к конверту и мягкий к одной странной записи', () => {
  assert.equal(Bridge.parseFacts('not json').ok, false);
  assert.equal(Bridge.parseFacts(JSON.stringify({ ok: true, source: 'senku', version: 2, nextSince: DAY.from, rides: [] })).ok, false);
  assert.equal(Bridge.parseFacts(JSON.stringify({ ok: true, source: 'senku', version: 1, nextSince: 'вчера', rides: [] })).ok, false);
  const body = fixture(); body.rides.push({ id: 'bad', kind: 'telepathy' }, ride({ id: 'x-1', cards: -1 }), ride({ id: 'x-2', endedAt: '2026-09-28T07:00:00.000Z' }));
  const facts = Bridge.parseFacts(JSON.stringify(body));
  assert.equal(facts.ok, true);
  assert.equal(facts.rides.length, 2);
  assert.equal(facts.skipped, 3);
  const control = Bridge.normalizeRide(ride({ deckName: 'Deck\u0000\nname\u2028', folder: ['A\tB', '', 42] }));
  assert.equal(control.deckName, 'Deck name');
  assert.deepEqual(control.folder, ['A B']);
});

test('адрес Senku: только публичный https, без путей, портов, IP и внутренних имён', () => {
  assert.equal(Bridge.normalizeBaseUrl(''), 'https://senku-production.up.railway.app');
  assert.equal(Bridge.normalizeBaseUrl(' https://senku.example.com/ '), 'https://senku.example.com');
  for (const bad of ['http://senku.example.com', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://senku.railway.internal',
    'https://printer.local', 'https://senku.example.com:8443', 'https://user:pw@senku.example.com', 'https://senku.example.com/api',
    'https://senku.example.com/?x=1', 'ftp://senku.example.com', 'https://intranet', 'не адрес']) {
    assert.throws(() => Bridge.normalizeBaseUrl(bad), (error) => error.code === 'senku_address_invalid', bad);
  }
  assert.equal(Bridge.normalizeBaseUrl('http://127.0.0.1:5555', ['http://127.0.0.1:5555']), 'http://127.0.0.1:5555');
  for (const address of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(Bridge.privateAddress(address), true, address);
  }
  for (const address of ['8.8.8.8', '66.33.22.11', '2606:4700::1111']) assert.equal(Bridge.privateAddress(address), false, address);
  assert.equal(Bridge.maskKey('abcdefghijklmnop'), '••••mnop');
});

test('DNS: имя, которое ведёт во внутреннюю сеть, блокируется до соединения', async () => {
  const blocked = await new Promise((resolve) => Bridge.safeLookup('localhost', { all: true }, (error) => resolve(error)));
  assert.equal(blocked && blocked.code, 'SENKU_ADDRESS_BLOCKED');
  const response = await Bridge.defaultRequest('https://localhost:9/api/bridge/facts', { headers: {}, timeoutMs: 2000, maxBytes: 1024, testOrigins: [] });
  assert.deepEqual(response, { status: 0, error: 'address_blocked' });
});

// ---------------------------------------------------------------- сборщик против поддельного Senku

test('подключение: первый запрос без since, ключ только в серверном файле, курсор после записи', async () => {
  const senku = await startFakeSenku();
  try {
    senku.rides = fixture().rides;
    const clock = { t: Date.parse('2026-09-28T09:00:00.000Z') };
    const { bridge, file, stored, logs } = moduleWith(senku, clock);
    await assert.rejects(bridge.connect('u1', { baseUrl: senku.origin, key: 'short' }), (error) => error.code === 'senku_key_invalid');
    await assert.rejects(bridge.connect('u1', { baseUrl: senku.origin, key: fakeKey() }), (error) => error.code === 'senku_invalid_token');
    assert.equal(fs.existsSync(file()), false, 'неверный ключ не сохраняется');
    const status = await bridge.connect('u1', { baseUrl: senku.origin, key: `  ${senku.key}  ` });
    assert.equal(senku.requests.at(-1).since, null);
    assert.equal(senku.requests.at(-1).auth, `Bearer ${senku.key}`);
    assert.equal(status.connected, true);
    assert.equal(status.keyMask, `••••${senku.key.slice(-4)}`);
    assert.equal(JSON.stringify(status).includes(senku.key), false);
    const disk = stored('u1');
    assert.equal(disk.connection.key, senku.key);
    assert.equal(disk.connection.nextSince, '2026-09-28T09:00:00.000Z');
    assert.equal(Object.keys(disk.rides).length, 2);
    assert.ok(Object.keys(disk.rides).every((key) => key.startsWith(`senku:${disk.connection.id}:`)));
    assert.equal((fs.statSync(file()).mode & 0o777).toString(8), '600');
    assert.equal(logs.join('\n').includes(senku.key), false);
    const view = await bridge.day('u1', DAY);
    assert.equal(JSON.stringify(view).includes(senku.key), false);
    assert.deepEqual([view.day.cards, view.day.minutes, view.day.voiceCards], [20, 22, 14]);
  } finally { await senku.close(); }
});

test('опрос: курсор nextSince, сложение по id, поздняя сессия, частота не чаще раза в 3 минуты', async () => {
  const senku = await startFakeSenku();
  try {
    senku.rides = fixture().rides;
    const clock = { t: Date.parse('2026-09-28T09:00:00.000Z') };
    const { bridge, stored } = moduleWith(senku, clock);
    await bridge.connect('u1', { baseUrl: senku.origin, key: senku.key });
    const calls = () => senku.requests.length;
    const before = calls();
    clock.t += 60 * 1000; await bridge.day('u1', DAY);
    assert.equal(calls(), before, 'через минуту Senku не спрашиваем');
    clock.t += 10 * 1000; await bridge.day('u1', Object.assign({ force: true }, DAY));
    assert.equal(calls(), before + 1, '«Обновить» через 30 с спрашивает сразу');
    assert.equal(senku.requests.at(-1).since, '2026-09-28T09:00:00.000Z');

    // Сессия глазами закрылась; поездка вчерашнего дня доехала только сейчас; первая пришла повторно.
    senku.serverTime = '2026-09-28T09:10:00.000Z';
    senku.rides = [
      Object.assign(fixture().rides[1], { endedAt: '2026-09-28T07:50:00.000Z', finished: true, cards: 9, durationMs: 20 * MIN, changedAt: '2026-09-28T09:06:00.000Z' }),
      Object.assign(fixture().rides[0], { changedAt: '2026-09-28T09:06:00.000Z' }),
      ride({ id: 'ride-late-1', startedAt: '2026-09-27T18:00:00.000Z', endedAt: '2026-09-27T18:30:00.000Z', cards: 7, changedAt: '2026-09-28T09:07:00.000Z' }),
    ];
    clock.t += 3 * 60 * 1000; const view = await bridge.day('u1', DAY);
    assert.equal(senku.requests.at(-1).since, '2026-09-28T09:00:00.000Z');
    const disk = stored('u1');
    assert.equal(Object.keys(disk.rides).length, 3, 'повтор той же сессии не добавляет запись');
    assert.equal(disk.connection.nextSince, '2026-09-28T09:10:00.000Z');
    assert.deepEqual([view.day.cards, view.day.minutes, view.day.voiceCards], [23, 42, 14]);
    assert.equal(view.day.sessions[1].open, false);
    const yesterday = await bridge.day('u1', { from: '2026-09-27T00:00:00.000Z', to: '2026-09-28T00:00:00.000Z' });
    assert.equal(yesterday.day.cards, 7, 'поздняя сессия легла в свой день');
  } finally { await senku.close(); }
});

test('сбои: 500 и обрыв сети — пауза растёт, курсор стоит; 401 — стоп и «переподключи»', async () => {
  const senku = await startFakeSenku();
  try {
    senku.rides = fixture().rides;
    const clock = { t: Date.parse('2026-09-28T09:00:00.000Z') };
    const { bridge, stored, logs } = moduleWith(senku, clock);
    await bridge.connect('u1', { baseUrl: senku.origin, key: senku.key });
    senku.serverTime = '2026-09-28T09:30:00.000Z';

    senku.mode = 'corrupt'; clock.t += 3 * MIN;
    let view = await bridge.day('u1', DAY);
    assert.equal(view.state, 'ok');
    assert.equal(view.lastError, 'server');
    assert.equal(stored('u1').connection.nextSince, '2026-09-28T09:00:00.000Z');
    assert.equal(Date.parse(view.retryAt) - clock.t, 3 * MIN);
    assert.equal(view.day.cards, 20, 'старые факты остаются на экране');

    const count = senku.requests.length;
    clock.t += 2 * MIN; await bridge.day('u1', Object.assign({ force: true }, DAY));
    assert.equal(senku.requests.length, count, 'пауза сильнее кнопки «Обновить»');

    senku.mode = 'network'; clock.t += 1 * MIN;
    view = await bridge.day('u1', DAY);
    assert.equal(view.lastError, 'network');
    assert.equal(Date.parse(view.retryAt) - clock.t, 6 * MIN);

    senku.mode = 'garbage'; clock.t += 6 * MIN;
    view = await bridge.day('u1', DAY);
    assert.equal(view.lastError, 'invalid_response');
    assert.equal(Date.parse(view.retryAt) - clock.t, 12 * MIN);
    assert.equal(stored('u1').connection.nextSince, '2026-09-28T09:00:00.000Z');

    senku.mode = 'ok'; clock.t += 12 * MIN;
    view = await bridge.day('u1', DAY);
    assert.equal(view.lastError, null);
    assert.equal(view.retryAt, null);
    assert.equal(stored('u1').connection.nextSince, '2026-09-28T09:30:00.000Z');
    assert.equal(stored('u1').connection.failures, 0);

    senku.key = fakeKey(); // ключ перевыпущен в Senku
    clock.t += 3 * MIN; view = await bridge.day('u1', DAY);
    assert.equal(view.state, 'reconnect');
    assert.equal(stored('u1').connection.key, null, 'мёртвый ключ не хранится');
    const afterRevoke = senku.requests.length;
    clock.t += 60 * MIN; await bridge.day('u1', Object.assign({ force: true }, DAY));
    assert.equal(senku.requests.length, afterRevoke, 'после 401 опрос остановлен');
    assert.equal(view.day.cards, 20);
    assert.equal(logs.some((line) => line.startsWith('invalid_token')), true);
  } finally { await senku.close(); }
});

test('отключение: ключ и факты удаляются, идущий опрос их не воскрешает; переподключение начинает с нуля', async () => {
  const senku = await startFakeSenku();
  try {
    senku.rides = fixture().rides;
    const clock = { t: Date.parse('2026-09-28T09:00:00.000Z') };
    const { bridge, file } = moduleWith(senku, clock);
    await bridge.connect('u1', { baseUrl: senku.origin, key: senku.key });
    clock.t += 3 * MIN;
    const pending = bridge.syncIfDue('u1');
    bridge.disconnect('u1');
    await pending;
    assert.equal(fs.existsSync(file()), false);
    assert.deepEqual(bridge.status('u1'), { connected: false, defaultBaseUrl: Bridge.DEFAULT_BASE_URL });
    const view = await bridge.day('u1', DAY);
    assert.equal(view.connected, false);
    assert.equal(view.day, undefined);
    await bridge.connect('u1', { baseUrl: senku.origin, key: senku.key });
    assert.equal(senku.requests.at(-1).since, null, 'новое подключение забирает историю заново');
    assert.equal((await bridge.day('u1', DAY)).day.cards, 20, 'без задвоения после переподключения');
  } finally { await senku.close(); }
});

test('день: границы проверяются, окно не больше 48 часов', async () => {
  const senku = await startFakeSenku();
  try {
    const { bridge } = moduleWith(senku, { t: Date.now() });
    for (const bad of [{}, { from: 'x', to: DAY.to }, { from: DAY.to, to: DAY.from }, { from: '2026-09-20T00:00:00.000Z', to: DAY.to }]) {
      await assert.rejects(bridge.day('u1', bad), (error) => error.code === 'senku_day_invalid');
    }
  } finally { await senku.close(); }
});

// ---------------------------------------------------------------- граница аккаунта Satoru

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startSatoru(env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-senku-server-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = { text: '' };
  child.stdout.on('data', (c) => { output.text += c; }); child.stderr.on('data', (c) => { output.text += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 2400; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${output.text}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base, output }; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  child.kill('SIGTERM'); throw new Error(`сервер не поднялся: ${output.text}`);
}

function client(base) {
  let cookie = '';
  return async (route, { method = 'GET', body } = {}) => {
    const headers = {}; if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: r.status, data, text };
  };
}

test('сервер Satoru: подключение, «Сегодня», ключ не уходит ни в ответы, ни в /api/data, ни в экспорт, ни в журнал', async () => {
  const senku = await startFakeSenku();
  const satoru = await startSatoru({ SENKU_BRIDGE_TEST_ORIGINS: senku.origin });
  try {
    senku.rides = fixture().rides;
    const anon = client(satoru.base);
    assert.equal((await anon('/api/bridge/senku/status')).status, 401);
    const c = client(satoru.base);
    const reg = await c('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'senku-bridge@example.test', password: 'senku-pass-11' } });
    assert.equal(reg.status, 200, JSON.stringify(reg.data));
    const uid = reg.data.id;

    let r = await c('/api/bridge/senku/status');
    assert.deepEqual(r.data, { connected: false, defaultBaseUrl: 'https://senku-production.up.railway.app' });
    r = await c('/api/bridge/senku/connect', { method: 'POST', body: { baseUrl: 'http://127.0.0.1:9', key: senku.key } });
    assert.deepEqual([r.status, r.data.error], [400, 'senku_address_invalid']);
    r = await c('/api/bridge/senku/connect', { method: 'POST', body: { baseUrl: senku.origin, key: fakeKey() } });
    assert.deepEqual([r.status, r.data.error], [400, 'senku_invalid_token']);
    senku.mode = 'corrupt';
    r = await c('/api/bridge/senku/connect', { method: 'POST', body: { baseUrl: senku.origin, key: senku.key } });
    assert.deepEqual([r.status, r.data.error], [502, 'senku_unreachable']);
    senku.mode = 'ok';
    r = await c('/api/bridge/senku/connect', { method: 'POST', body: { baseUrl: senku.origin, key: senku.key } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.data.connected, true);
    assert.equal(r.text.includes(senku.key), false);

    r = await c(`/api/bridge/senku/day?from=${encodeURIComponent(DAY.from)}&to=${encodeURIComponent(DAY.to)}`);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual([r.data.day.cards, r.data.day.minutes, r.data.day.voiceCards], [20, 22, 14]);
    assert.equal(r.text.includes(senku.key), false);
    assert.equal((await c('/api/bridge/senku/day?from=x&to=y')).status, 400);

    for (const name of ['senku-bridge', 'senku-bridge.json']) {
      r = await c(`/api/data/${name}`);
      assert.deepEqual([r.status, r.data.error], [403, 'server_owned_data'], name);
      r = await c(`/api/data/${name}`, { method: 'PUT', body: { version: 1 } });
      assert.equal(r.status, 403, `PUT ${name}`);
    }
    r = await c('/api/account/export');
    assert.equal(r.status, 200);
    assert.equal(r.text.includes(senku.key), false);
    assert.equal(r.text.includes('Transkription'), false, 'названия колод не уезжают в экспорт');
    assert.ok(r.data.excludedSecrets.includes('senkuBridge'));

    r = await c('/api/bridge/senku/pending');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.data.sittings, [], 'образец старше подключения — награды не ждёт');
    assert.equal(r.text.includes(senku.key), false);
    r = await c('/api/bridge/senku/claim', { method: 'POST', body: { keys: 'всё' } });
    assert.deepEqual([r.status, r.data.error], [400, 'senku_claim_invalid']);
    r = await c('/api/bridge/senku/decks');
    assert.deepEqual(r.data.decks.map((d) => d.name).sort(), ['12.1 (2)', 'Transkription']);
    assert.equal((await anon('/api/bridge/senku/pending')).status, 401);

    const file = path.join(satoru.dataDir, 'users', uid, 'senku-bridge.json');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).connection.key, senku.key);
    r = await c('/api/bridge/senku/disconnect', { method: 'POST' });
    assert.deepEqual(r.data, { connected: false, defaultBaseUrl: 'https://senku-production.up.railway.app' });
    assert.equal(fs.existsSync(file), false);
    assert.equal(satoru.output.text.includes(senku.key), false, 'ключ не попал в журнал сервера');
    assert.equal(satoru.output.text.includes('Transkription'), false, 'название колоды не попало в журнал сервера');
  } finally {
    satoru.child.kill('SIGTERM');
    await senku.close();
    fs.rmSync(satoru.dataDir, { recursive: true, force: true });
  }
});

test('клиент: награда только обычным путём квестов, ИИ — только с согласия, без localStorage и аналитики', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const start = app.indexOf('//  Senku bridge v1 (фаза 1)');
  const end = app.indexOf('// ── Детектор развилки');
  assert.ok(start > 0 && end > start, 'блок Senku в app.js не найден');
  const block = app.slice(start, end);
  for (const banned of [/localStorage|sessionStorage|indexedDB/, /\/api\/(?:data|analytics)\b/, /\btrack\(/,
    /State\.(?:habits|habitlog|days|goals|rewards|purchases)\b/, /grantXp|awardXp|addGold|xpAwarded\s*[+=]\s*\d/]) {
    assert.doesNotMatch(block, banned, `блок Senku не должен трогать ${banned}`);
  }
  // Награда считается обычной формулой и пишется обычной записью квестов; отметка — только после неё.
  assert.match(block, /task\.xpAwarded = Math\.max\(1, itemXp\(task\)\); task\.goldAwarded = itemGold\(task\);/);
  const write = block.indexOf("Store.updateNow('tasks'"); const claim = block.indexOf("fetch('/api/bridge/senku/claim'");
  assert.ok(write > 0 && claim > write, 'сессии отмечаются на сервере только после записи квестов');
  // Названия колод уходят ИИ только при включённом согласии.
  const ai = block.indexOf("fetch('/api/ai/analyze'"); const consent = block.lastIndexOf('aiSpheres === true', ai);
  assert.ok(ai > 0 && consent > 0 && ai - consent < 400, 'вызов ИИ стоит сразу под проверкой согласия');
  assert.equal(block.match(/\/api\/ai\//g).length, 1, 'ИИ вызывается в одном месте');
  assert.match(block, /if \(senkuSettings\(\)\.setup !== true\) return;/, 'первое начисление — только после разового выбора человека');
  assert.match(block, /aiSurfaceRun\('senku'/, 'ИИ идёт через общий механизм отмены и таймаута');
  assert.match(block, /fetch\('\/api\/bridge\/senku\/connect'/);
  assert.match(block, /form\.key\.value = ''/, 'ключ стирается из поля после подключения');
  for (const lang of ['ru', 'uk', 'en', 'de', 'es']) assert.match(block, new RegExp(`\\n  ${lang}: \\{`), `нет текстов ${lang}`);
});

test('фаза 2: ожидают награды только законченные сессии после подключения; отметка одна и переживает опрос', async () => {
  const senku = await startFakeSenku();
  try {
    const clock = { t: Date.parse('2026-10-01T09:00:00.000Z') };
    senku.serverTime = '2026-10-01T09:00:00.000Z';
    senku.rides = [ride({ id: 'old-1', startedAt: '2026-10-01T06:00:00.000Z', endedAt: '2026-10-01T06:20:00.000Z', changedAt: '2026-10-01T06:21:00.000Z' })];
    const { bridge, stored } = moduleWith(senku, clock);
    await bridge.connect('u1', { baseUrl: senku.origin, key: senku.key });
    assert.equal((await bridge.pending('u1')).sittings.length, 0, 'история до подключения не награждается');
    const view = await bridge.day('u1', { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' });
    assert.deepEqual([view.day.sessions[0].rewardable, view.day.sessions[0].claimed], [false, false]);

    senku.serverTime = '2026-10-01T12:00:00.000Z';
    senku.rides = [
      ...[1, 2].map((i) => ride({ id: `ride-n-${i}`, kind: 'voice', deck: `deck-${i}`, deckName: `Deck ${i}`, cards: 5 * i,
        startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T10:30:00.000Z', changedAt: '2026-10-01T10:31:00.000Z' })),
      ride({ id: 's-open-1', kind: 'visual', startedAt: '2026-10-01T11:00:00.000Z', endedAt: null, finished: false, durationMs: null, changedAt: '2026-10-01T11:01:00.000Z' }),
      ride({ id: 's-long-1', kind: 'visual', startedAt: '2026-10-01T09:10:00.000Z', endedAt: '2026-10-01T16:10:00.000Z', durationMs: 7 * 60 * MIN, changedAt: '2026-10-01T11:02:00.000Z' }),
      ride({ id: 's-zero-1', kind: 'visual', cards: 0, startedAt: '2026-10-01T11:30:00.000Z', endedAt: '2026-10-01T11:31:00.000Z', changedAt: '2026-10-01T11:32:00.000Z' }),
    ];
    clock.t += 3 * 60 * MIN;
    const pending = await bridge.pending('u1');
    assert.equal(pending.rewardsFrom, '2026-10-01T09:00:00.000Z');
    assert.equal(pending.sittings.length, 1, 'открытая, слишком длинная и пустая сессии не ждут награды');
    const one = pending.sittings[0];
    assert.deepEqual([one.key, one.cards, one.minutes, one.decks.map((d) => d.deck)], ['voice|2026-10-01T10:00:00.000Z', 15, 30, ['deck-2', 'deck-1']]);

    await assert.rejects(Promise.resolve().then(() => bridge.claim('u1', [])), (error) => error.code === 'senku_claim_invalid');
    await assert.rejects(Promise.resolve().then(() => bridge.claim('u1', ['../etc'])), (error) => error.code === 'senku_claim_invalid');
    assert.deepEqual(bridge.claim('u1', [one.key, 'visual|2026-10-01T11:00:00.000Z', 'voice|2026-01-01T00:00:00.000Z']), { ok: true, claimed: 1, ignored: 2 });
    assert.deepEqual(bridge.claim('u1', [one.key]), { ok: true, claimed: 0, ignored: 0 }, 'повторная отметка безвредна');
    assert.equal((await bridge.pending('u1')).sittings.length, 0);
    clock.t += 3 * MIN; await bridge.syncIfDue('u1');
    assert.ok(Object.hasOwn(stored('u1').claimed, one.key), 'отметка переживает опрос Senku');
    const after = await bridge.day('u1', { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' });
    assert.equal(after.day.sessions.find((s) => s.key === one.key).claimed, true);
    assert.deepEqual(bridge.decks('u1').decks.map((d) => d.deck).sort(), ['deck-1', 'deck-2', 'deck-a']);
    bridge.disconnect('u1');
    await assert.rejects(Promise.resolve().then(() => bridge.claim('u1', [one.key])), (error) => error.code === 'senku_not_connected');
  } finally { await senku.close(); }
});
