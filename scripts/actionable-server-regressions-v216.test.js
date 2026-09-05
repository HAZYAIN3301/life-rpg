'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-actionable-v216-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 2400; index += 1) {
    if (child.exitCode != null) throw new Error(`server exited: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start: ${output}`);
}

function client(base) {
  let cookie = '';
  return async (route, { method = 'GET', body } = {}) => {
    const headers = cookie ? { Cookie: cookie } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  };
}

async function register(base, email) {
  const request = client(base);
  const response = await request('/api/auth/register', {
    method: 'POST', body: { name: 'A', email, password: 'actionable-pass-11' },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return { request, uid: response.data.id };
}

function dayAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function memoryEntry() {
  return {
    id: 'm1', text: 'Утром работать легче', category: 'pattern',
    scopes: ['assistant_prompt'], sourceType: 'explicit', sourceRef: 'settings_form',
    confidence: 1, sensitivity: 'normal', status: 'active',
    createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

test('stale profile save cannot resurrect a deleted structured memory entry', { timeout: 180000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { request } = await register(runtime.base, 'stale-memory@example.test');
  const stale = { text: 'Старый свободный профиль', auto: true, schemaVersion: 1, entries: [memoryEntry()] };

  assert.equal((await request('/api/data/profile', { method: 'PUT', body: stale })).status, 200);
  assert.equal((await request('/api/ai/memory/m1', { method: 'DELETE' })).status, 200);

  const delayedSave = { ...stale, text: 'Новый свободный профиль' };
  assert.equal((await request('/api/data/profile', { method: 'PUT', body: delayedSave })).status, 200);
  const memory = await request('/api/ai/memory');
  assert.equal(memory.status, 200);
  assert.deepEqual(memory.data.entries, [], 'deleted entry was not resurrected by the stale form');
  assert.equal(memory.data.legacy.text, 'Новый свободный профиль');

  const malformed = await request('/api/ai/memory/%E0%A4%A', { method: 'DELETE' });
  assert.equal(malformed.status, 400, 'malformed URI is a client error, not a process crash');
  assert.equal((await request('/api/ai/memory')).status, 200, 'server remains healthy after malformed URI');
});

test('analytics retention prunes each purpose at the exact period shown in settings', { timeout: 180000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { request, uid } = await register(runtime.base, 'retention@example.test');
  const bucket = (name) => ({ events: { [name]: 1 }, users: { [uid]: 1 } });
  const stored = {
    [dayAgo(31)]: { legacy: bucket('legacy31'), byPurpose: { service_operation: bucket('service31'), safety: bucket('safety31') } },
    [dayAgo(91)]: { byPurpose: { engagement_optimization: bucket('engagement91'), product_improvement: bucket('product91') } },
    [dayAgo(181)]: { byPurpose: { product_improvement: bucket('product181'), personalization: bucket('personal181') } },
    [dayAgo(365)]: { byPurpose: { personalization: bucket('personal365') } },
  };
  fs.writeFileSync(path.join(runtime.dataDir, 'analytics.json'), JSON.stringify(stored));

  const trigger = await request('/api/analytics', { method: 'POST', body: { event: 'retention:probe', purpose: 'product_improvement' } });
  assert.equal(trigger.status, 200);
  assert.equal(trigger.data.retentionDays, 180);
  const result = JSON.parse(fs.readFileSync(path.join(runtime.dataDir, 'analytics.json'), 'utf8'));

  assert.equal(result[dayAgo(31)].legacy, undefined);
  assert.equal(result[dayAgo(31)].byPurpose.service_operation, undefined);
  assert.ok(result[dayAgo(31)].byPurpose.safety, '180-day safety data is retained at day 31');
  assert.equal(result[dayAgo(91)].byPurpose.engagement_optimization, undefined);
  assert.ok(result[dayAgo(91)].byPurpose.product_improvement, '180-day product data is retained at day 91');
  assert.equal(result[dayAgo(181)].byPurpose.product_improvement, undefined);
  assert.ok(result[dayAgo(181)].byPurpose.personalization, '365-day personalization is retained at day 181');
  assert.equal(result[dayAgo(365)], undefined, 'the final expired bucket removes the empty day');
});
