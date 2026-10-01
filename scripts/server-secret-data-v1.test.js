'use strict';

/* Секреты в папке пользователя не доступны через общий /api/data и админские бэкапы.
 *
 * Раньше общий маршрут отдавал и принимал любой <name>.json своей папки: скрипт на
 * странице читал ai-keys.json (ключи ИИ) и strava.json (токены Strava), обнулял
 * ai-usage.json (расход ИИ-квоты) и мог переписать devices.json — вернуть отозванное
 * устройство. Проверка идёт на настоящем server.js с отдельным DATA_DIR и только
 * синтетическими ключами; свои маршруты этих файлов должны работать как раньше.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NAMES = ['ai-keys', 'strava', 'devices', 'ai-usage'];
const STAMP = '2026-09-01T00-00-00-000Z';

const fake = (label) => `fake-${label}-${crypto.randomBytes(12).toString('hex')}`;

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startSatoru() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-secret-data-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', STRAVA_CLIENT_ID: '', STRAVA_CLIENT_SECRET: '' },
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

test('ai-keys, strava, devices, ai-usage: /api/data и админские бэкапы отвечают 403, свои маршруты работают', { timeout: 60000 }, async () => {
  const satoru = await startSatoru();
  try {
    const c = client(satoru.base);
    const reg = await c('/api/auth/register', { method: 'POST', body: { name: 'Secret', email: 'secret-data@example.test', password: 'secret-pass-11' } });
    assert.equal(reg.status, 200, reg.text);
    const uid = reg.data.id;
    const dir = path.join(satoru.dataDir, 'users', uid);
    const file = (name) => path.join(dir, `${name}.json`);
    const read = (name) => fs.readFileSync(file(name), 'utf8');

    // Настоящая сессия устройства, затем её отзыв: devices.json пишет сам сервер.
    const phone = await c('/api/auth/devices/register', { method: 'POST', body: { remember: true, name: 'iPhone', platform: 'ios' } });
    assert.equal(phone.status, 200, phone.text);
    const liveDevices = JSON.parse(read('devices'));
    assert.equal((await c('/api/auth/devices/revoke', { method: 'POST', body: { deviceId: phone.data.device.id } })).status, 200);

    // Синтетические секреты в форме, которую пишут /api/ai/keys, /api/strava/callback и учёт ИИ.
    const aiKey = fake('gemini-key');
    const strava = { access: fake('strava-access'), refresh: fake('strava-refresh') };
    const month = new Date().toISOString().slice(0, 7);
    fs.writeFileSync(file('ai-keys'), JSON.stringify({ gemini: aiKey }));
    fs.writeFileSync(file('strava'), JSON.stringify({
      athleteId: 7, athleteName: 'Synthetic Runner', accessToken: strava.access, refreshToken: strava.refresh,
      expiresAt: 4102444800, scope: 'activity:read_all', connectedAt: '2026-09-01T00:00:00.000Z', lastSync: null,
    }));
    fs.writeFileSync(file('ai-usage'), JSON.stringify({ month, tokens: 4321, requests: 3 }));
    const secrets = [aiKey, strava.access, strava.refresh, phone.data.refreshToken, phone.data.accessToken];
    const leaks = (text) => secrets.filter((secret) => text.includes(secret));
    const snapshot = () => Object.fromEntries(NAMES.map((name) => [name, read(name)]));
    const before = snapshot();

    for (const name of NAMES) {
      for (const route of [`/api/data/${name}`, `/api/data/${name}.json`, `/api/data/${name}?fresh=1`, `/api/data/${name}/x`]) {
        let r = await c(route);
        assert.deepEqual([r.status, r.data && r.data.error], [403, 'server_owned_data'], `GET ${route}`);
        assert.deepEqual(leaks(r.text), [], `GET ${route}`);
        for (const method of ['PUT', 'POST']) {
          r = await c(route, { method, body: { overwritten: true } });
          assert.deepEqual([r.status, r.data && r.data.error], [403, 'server_owned_data'], `${method} ${route}`);
        }
      }
    }
    // Попытка вернуть отозванное устройство его прежней записью и обнулить квоту.
    assert.equal((await c('/api/data/devices', { method: 'PUT', body: liveDevices })).status, 403);
    assert.equal((await c('/api/data/ai-usage', { method: 'PUT', body: { month, tokens: 0, requests: 0 } })).status, 403);
    assert.deepEqual(snapshot(), before, 'файлы не изменились');
    for (const name of NAMES) assert.equal(fs.existsSync(path.join(dir, '.backups', name)), false, `нет бэкапа ${name}`);
    const revived = await c('/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: phone.data.refreshToken } });
    assert.notEqual(revived.status, 200, 'отозванное устройство не оживает');

    // Свои маршруты: ключи ИИ, квота, Strava.
    let r = await c('/api/ai/keys');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual([r.data.gemini, r.data.groq, r.data.quota.used, r.data.quota.requests], [true, false, 4321, 3]);
    assert.deepEqual(leaks(r.text), []);
    const groqKey = fake('groq-key'); secrets.push(groqKey);
    r = await c('/api/ai/keys', { method: 'POST', body: { groq: groqKey } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual([r.data.gemini, r.data.groq], [true, true]);
    assert.deepEqual(leaks(r.text), []);
    assert.deepEqual(JSON.parse(read('ai-keys')), { gemini: aiKey, groq: groqKey });
    r = await c('/api/strava/status');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual([r.data.connected, r.data.athlete && r.data.athlete.name], [true, 'Synthetic Runner']);
    assert.deepEqual(leaks(r.text), []);
    assert.deepEqual([(await c('/api/strava/connect')).status], [503], 'без ключей приложения Strava сервер честно не готов');

    r = await c('/api/account/export');
    assert.equal(r.status, 200);
    assert.deepEqual(leaks(r.text), [], 'экспорт без секретов');

    // Админ (первый аккаунт) не читает и не откатывает бэкапы секретов, даже оставшиеся с прежней дыры.
    const adminBefore = snapshot();
    for (const name of NAMES) {
      fs.mkdirSync(path.join(dir, '.backups', name), { recursive: true });
      fs.writeFileSync(path.join(dir, '.backups', name, `${STAMP}.json`), JSON.stringify({ restored: name }));
      r = await c(`/api/admin/userdata/${uid}/backup/${name}/${STAMP}`);
      assert.deepEqual([r.status, r.data && r.data.error], [403, 'server_owned_data'], `admin backup ${name}`);
      r = await c(`/api/admin/userdata/${uid}/restore`, { method: 'POST', body: { name, stamp: STAMP } });
      assert.deepEqual([r.status, r.data && r.data.error], [403, 'server_owned_data'], `admin restore ${name}`);
    }
    assert.deepEqual(snapshot(), adminBefore, 'откат не тронул секреты');

    // Контроль: обычные данные и их бэкапы работают как раньше.
    assert.equal((await c('/api/data/weeks', { method: 'PUT', body: { first: true } })).status, 200);
    assert.equal((await c('/api/data/weeks', { method: 'PUT', body: { second: true } })).status, 200);
    assert.deepEqual((await c('/api/data/weeks')).data, { second: true });
    const stamps = (await c(`/api/admin/userdata/${uid}`)).data.backups.weeks;
    assert.equal(stamps.length, 1);
    assert.deepEqual((await c(`/api/admin/userdata/${uid}/backup/weeks/${stamps[0]}`)).data, { first: true });
    assert.equal((await c(`/api/admin/userdata/${uid}/restore`, { method: 'POST', body: { name: 'weeks', stamp: stamps[0] } })).status, 200);
    assert.deepEqual((await c('/api/data/weeks')).data, { first: true });

    assert.deepEqual(leaks(satoru.output.text), [], 'секреты не попали в журнал сервера');
  } finally {
    satoru.child.kill('SIGTERM');
    fs.rmSync(satoru.dataDir, { recursive: true, force: true });
  }
});
