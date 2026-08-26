'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

function exportedFunction(name, nextName) {
  const start = APP.indexOf(`function ${name}(`);
  const end = APP.indexOf(`\nfunction ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `${name} source is missing`);
  return Function(`"use strict"; ${APP.slice(start, end)}; return ${name};`)();
}

const validateSettings = exportedFunction('validateSettingsPayload', 'settingsWriteAllowed');
const validateTasks = exportedFunction('validateTasksPayload', 'normalizeLoadedTasks');

test('old account settings accept legacy omissions but reject crash-shaped skills', () => {
  assert.equal(validateSettings({}), true, 'missing optional fields remains a valid legacy account');
  assert.equal(validateSettings({ skills: [] }), true, 'empty skills still routes to onboarding');
  assert.equal(validateSettings({
    lang: 'ru', unknownFutureField: { keep: true },
    skills: [
      { id: 'sport', name: 'Спорт', color: '#e0526a' },
      { id: 'boxing', name: 'Бокс', parentId: 'sport', color: '#cc3344' },
    ],
  }), true, 'valid hierarchy and unknown future fields must survive');

  const invalid = [
    null, [], { skills: null }, { skills: [null] }, { skills: [[]] },
    { skills: [{}] }, { skills: [{ id: 'x', name: '' }] },
    { skills: [{ id: '', name: 'X' }] },
    { skills: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Duplicate' }] },
    { skills: [{ id: 'x', name: 'X', parentId: [] }] },
    { skills: [{ id: 'x', name: 'X', color: {} }] },
    { skills: Array.from({ length: 501 }, (_, i) => ({ id: `s${i}`, name: `S${i}` })) },
  ];
  for (const value of invalid) assert.doesNotThrow(() => assert.equal(validateSettings(value), false));
});

test('task loading is bounded and rejects malformed dates without throwing', () => {
  const valid = { id: 'q1', title: 'Первое дело', date: '2026-08-26', done: false, estimateMin: 15 };
  assert.equal(validateTasks([valid]), true);
  const invalid = [
    null, {}, [null], [{ ...valid, id: '' }], [{ ...valid, title: '' }],
    [{ ...valid, date: '2026-02-30' }], [{ ...valid, startTime: '25:90' }],
    [{ ...valid }, { ...valid }],
    [{ ...valid, id: 'x'.repeat(181) }], [{ ...valid, title: 'x'.repeat(1001) }],
    Array.from({ length: 10001 }, (_, i) => ({ ...valid, id: `q${i}` })),
  ];
  for (const value of invalid) assert.doesNotThrow(() => assert.equal(validateTasks(value), false));
});

test('settings recovery fence runs before startup can mutate a corrupt fallback', () => {
  const start = APP.indexOf('async function initApp()');
  const ai = APP.indexOf('const aiKeysReady = ensureAiKeys()', start);
  const prefix = APP.slice(start, ai);
  assert.match(prefix, /Store\.loadChecked\('settings', DEFAULT_SETTINGS, validateSettingsPayload\)/);
  assert.match(prefix, /if \(State\._settingsLoadError\) \{[\s\S]*State\.view = 'settings';[\s\S]*render\(\);[\s\S]*return;/);
  assert.doesNotMatch(prefix, /Store\.save|Store\._put|saveNow/);
});

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-launch-hardening-'));
  const port = 46500 + (process.pid % 300);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 180; i += 1) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { base, child, dataDir }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start: ${output}`);
}

async function post(base, route, body) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => null) };
}

async function postRaw(base, route, body) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  return { response, data: await response.json().catch(() => null) };
}

test('public registration rejects hostile JSON shapes and remains usable', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });

  for (const payload of [null, [], { name: {}, email: 'bad@example.test', password: 'valid-pass-4417' }]) {
    const result = await post(runtime.base, '/api/auth/register', payload);
    assert.equal(result.response.status, 400, `hostile payload returned ${result.response.status}`);
  }

  const registered = await post(runtime.base, '/api/auth/register', {
    name: '  Launch User  ', avatar: { forged: true },
    email: 'launch-hardening@example.test', password: 'valid-pass-4417',
  });
  assert.equal(registered.response.status, 200, 'server must stay usable after rejected bodies');
  assert.equal(registered.data.name, 'Launch User');
  assert.equal(registered.data.avatar, '⚡', 'non-string avatar cannot enter account data');
  const registry = JSON.parse(fs.readFileSync(path.join(runtime.dataDir, 'users.json'), 'utf8'));
  const userDirs = fs.readdirSync(path.join(runtime.dataDir, 'users'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.equal(registry.length, 1, 'rejected requests cannot create ghost accounts');
  assert.equal(userDirs.length, 1, 'rejected requests cannot create ghost data directories');
});

test('all public auth entry points fail closed on non-object and oversized bodies', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });

  for (const route of ['/api/auth/login', '/api/auth/reset', '/api/auth/reset-token']) {
    for (const payload of [null, [], 'bad-shape']) {
      const result = await post(runtime.base, route, payload);
      assert.ok(result.response.status >= 400 && result.response.status < 500,
        `${route} must return a controlled 4xx for ${JSON.stringify(payload)}, got ${result.response.status}`);
    }
  }

  const oversized = await postRaw(runtime.base, '/api/auth/register', JSON.stringify({
    name: 'Oversized', pin: '4417', padding: 'x'.repeat(70 * 1024),
  }));
  assert.equal(oversized.response.status, 413);

  const healthy = await fetch(`${runtime.base}/api/auth/profiles`);
  assert.equal(healthy.status, 200, 'oversized auth input cannot kill the server');
  assert.deepEqual(await healthy.json(), [], 'rejected auth input cannot create an account');
});
