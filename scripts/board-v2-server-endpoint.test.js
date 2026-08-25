'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) { return String(response.headers.get('set-cookie') || '').split(';')[0]; }
async function api(base, route, options) {
  const input = options || {};
  const headers = input.cookie ? { Cookie: input.cookie } : {};
  if (input.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method: input.method || 'GET', headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data, cookie: cookieOf(response) };
}
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-board-v2-endpoint-'));
  const port = 45800 + (process.pid % 500);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', BRAVE_SEARCH_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}

test('Board v2 endpoint owns consent/cache and stays dormant without Brave key', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const unauth = await api(runtime.base, '/api/board-v2/discovery');
  assert.equal(unauth.status, 401);

  const registered = await api(runtime.base, '/api/auth/register', {
    method: 'POST', body: { name: 'BoardOwner', email: 'board-owner@example.test', password: 'board-owner-pass' },
  });
  assert.equal(registered.status, 200);
  const cookie = registered.cookie;
  const consent = await api(runtime.base, '/api/board-v2/discovery/consent', {
    method: 'PUT', cookie,
    body: {
      enabled: true, city: 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE',
      latitude: 52.03, longitude: 8.53, address: 'private home',
    },
  });
  assert.equal(consent.status, 200);
  assert.equal(consent.data.consent.city, 'Bielefeld');
  assert.equal(consent.data.providerAvailable, false);
  const file = path.join(runtime.dataDir, 'users', registered.data.id, 'board-discovery.json');
  const stored = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(stored, /52\.03|8\.53|private home|latitude|longitude|address/);

  const forged = await api(runtime.base, '/api/board-v2/discovery/resolve', {
    method: 'POST', cookie,
    body: { templateId: 'try-specific-local-class', slotId: 'class', query: 'anything from diary', url: 'https://attacker.test' },
  });
  assert.equal(forged.status, 400); assert.equal(forged.data.reason, 'unsupported-resolve-field');
  const dormant = await api(runtime.base, '/api/board-v2/discovery/resolve', {
    method: 'POST', cookie, body: { templateId: 'try-specific-local-class', slotId: 'class', interestId: 'boxing' },
  });
  assert.equal(dormant.status, 503); assert.equal(dormant.data.reason, 'provider-unavailable');

  assert.equal((await api(runtime.base, '/api/data/board-discovery', { cookie })).status, 403);
  assert.equal((await api(runtime.base, '/api/data/board-discovery', { method: 'PUT', cookie, body: { ledger: { searches: 0 } } })).status, 403);
  const revoked = await api(runtime.base, '/api/board-v2/discovery/consent', { method: 'PUT', cookie, body: { enabled: false } });
  assert.equal(revoked.status, 200); assert.equal(revoked.data.consent.enabled, false);
});

test('Board v2 server source never accepts client query/GPS identity fields', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(source, /boardV2Service\.resolve\(uid, payload/);
  assert.match(source, /name === 'board-discovery'.*server_owned_data/);
  assert.doesNotMatch(source, /payload\.(?:query|url|latitude|longitude|userId)/);
});
