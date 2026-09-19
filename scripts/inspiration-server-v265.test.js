'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const { spawn } = require('node:child_process');
const Profile = require('../public/inspiration-profile-v1');
const Commitment = require('../public/commitment-v2');
const ROOT = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = (extra = {}) => Profile.configure({ interests: [{ id: 'anime', label: 'Anime' }], formats: ['image', 'edit'], visualTaste: 'Neon city collage', ...extra });
const payload = (base = null, target = profile(), extra = {}) => ({ base, profile: target, finds: [], ...extra });

async function runtime(t, initialEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-inspiration-v265-'));
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const preload = path.join(dir, 'provider.cjs'), callsFile = path.join(dir, 'provider-calls.jsonl');
  fs.writeFileSync(preload, `
    const fs = require('node:fs'), path = require('node:path');
    const dir = process.env.DATA_DIR;
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(input);
      fs.appendFileSync(path.join(dir, 'provider-calls.jsonl'), JSON.stringify({ url: url.href }) + '\\n');
      if (url.hostname === 'api.search.brave.com') return new Response(JSON.stringify(
        url.pathname.includes('/images/') ? { results: [{ url: 'https://www.pinterest.com/pin/123456789/', title: 'Blue mountain photograph' }] }
        : { web: { results: [{ url: 'https://www.tiktok.com/@sample/video/7111111111111111111', title: 'Quiet ocean edit' }] } }
      ), { headers: { 'content-type': 'application/json' } });
      if (url.hostname === 'widgets.pinterest.com') {
        if (process.env.INSPIRATION_TEST_SLOW === '1') return new Promise((resolve, reject) => {
          const abort = () => { fs.writeFileSync(path.join(dir, 'metadata-aborted'), 'yes'); reject(Error('cancelled')); };
          if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
        });
        return new Response(JSON.stringify({ status: 'success', data: [{ id: url.searchParams.get('pin_ids'), is_video: false,
          title: 'Official pin title', description: 'Only metadata', pinner: { full_name: 'Pinner' } }] }),
          { headers: { 'content-type': 'application/json' } });
      }
      throw Error('Unexpected provider in isolated test');
    };
  `);
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) await new Promise(resolve => {
      child.once('exit', resolve); child.kill('SIGTERM');
    });
  };
  const start = async (env = {}) => {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: ROOT,
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off',
        BRAVE_SEARCH_API_KEY: '', COMMITMENT_CRASH_AT: '', COMMITMENT_FAIL_AFTER_FILE: '', INSPIRATION_TEST_SLOW: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
    for (let n = 0; n < 300; n++) {
      if (child.exitCode !== null || child.signalCode !== null) throw Error(output);
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await pause(15);
    }
    throw Error('server start timeout: ' + output);
  };
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const api = async (route, { cookie = '', bearer = '', method = 'GET', body, raw, headers = {} } = {}) => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers },
      body: raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw, signal: AbortSignal.timeout(10000) });
    let data; try { data = await response.json(); } catch {}
    return { status: response.status, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  };
  const register = async name => {
    const result = await api('/api/auth/register', { method: 'POST', body: { name, email: name + '@example.test', password: 'synthetic-test-pass-265' } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return { cookie: result.cookie, id: result.data.id };
  };
  const file = (user, name) => path.join(dir, 'users', user.id, name + '.json');
  const seed = (user, values) => {
    fs.mkdirSync(path.dirname(file(user, 'settings')), { recursive: true });
    for (const [name, value] of Object.entries(values)) fs.writeFileSync(file(user, name), JSON.stringify(value));
  };
  const read = (user, name) => JSON.parse(fs.readFileSync(file(user, name), 'utf8'));
  const calls = () => fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  await start(initialEnv);
  return { api, register, seed, file, read, start, stop, calls, dir, base, child: () => child };
}

test('authenticated profile owner keeps the current account and existing device-session semantics', { timeout: 30000 }, async t => {
  const r = await runtime(t), a = await r.register('inspiration-a'), b = await r.register('inspiration-b');
  for (const [route, method, body] of [['profile', 'POST', payload()], ['metadata', 'POST', { url: 'https://example.test' }], ['discovery', 'GET'], ['discovery', 'POST', {}]]) {
    assert.equal((await r.api('/api/inspiration/' + route, { method, body })).status, 401);
  }
  const tasks = [{ id: 'quest-a', title: 'Existing task', done: false }];
  const settings = { commitmentsV1: Commitment.emptyState(), inventory: [{ id: 'already-owned' }], lang: 'de', goals: { marker: 'latest' } };
  r.seed(a, { settings, tasks });
  const device = await r.api('/api/auth/devices/register', { method: 'POST', cookie: a.cookie, body: { remember: true, name: 'Test phone', platform: 'ios' } });
  assert.equal(device.status, 200);
  const saved = await r.api('/api/inspiration/profile', { method: 'POST', bearer: device.data.accessToken, body: payload() });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.deepEqual(Object.keys(saved.data).sort(), ['kind', 'ok', 'replay', 'snapshots', 'version']);
  assert.equal(saved.data.kind, 'inspiration-profile'); assert.equal(saved.data.version, 1); assert.equal(saved.data.replay, false);
  assert.deepEqual(saved.data.snapshots.settings, { exists: true, value: { ...settings, inspiration: profile() } });
  assert.deepEqual(saved.data.snapshots.tasks, { exists: true, value: tasks });
  assert.deepEqual(r.read(a, 'settings'), saved.data.snapshots.settings.value); assert.deepEqual(r.read(a, 'tasks'), tasks);
  const both = await r.api('/api/inspiration/profile', { method: 'POST', cookie: b.cookie, bearer: device.data.accessToken,
    body: payload(null, profile({ visualTaste: 'Cookie account' })) });
  assert.equal(both.status, 200); assert.equal(r.read(b, 'settings').inspiration.visualTaste, 'Cookie account');
  assert.equal(r.read(a, 'settings').inspiration.visualTaste, 'Neon city collage');
  assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: { ...payload(), accountId: b.id } })).status, 400);
});

test('streaming request takes current snapshots after body; stale taste cannot overwrite newer consent/history', { timeout: 30000 }, async t => {
  const r = await runtime(t), a = await r.register('stream-owner'), old = profile(), target = profile({ visualTaste: 'Changed taste' });
  const original = { inspiration: old, marker: 'before' }; r.seed(a, { settings: original, tasks: [] });
  const begin = body => {
    const data = JSON.stringify(body); let resolve, reject;
    const result = new Promise((yes, no) => { resolve = yes; reject = no; });
    const req = http.request(r.base + '/api/inspiration/profile', { method: 'POST', headers: { Cookie: a.cookie, 'Content-Type': 'application/json' } }, res => {
      let raw = ''; res.on('data', chunk => raw += chunk); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
    });
    req.on('error', reject); req.write(data.slice(0, 30));
    return { finish: () => req.end(data.slice(30)), result };
  };
  const first = begin(payload(old, target)); await r.api('/api/version');
  r.seed(a, { settings: { ...original, marker: 'new unrelated value', inventory: [{ id: 'preserved' }] }, tasks: [{ id: 'new-task', title: 'New task' }] });
  first.finish(); const saved = await first.result; assert.equal(saved.status, 200);
  assert.equal(saved.data.snapshots.settings.value.marker, 'new unrelated value');
  assert.deepEqual(saved.data.snapshots.settings.value.inventory, [{ id: 'preserved' }]);
  assert.deepEqual(saved.data.snapshots.tasks.value, [{ id: 'new-task', title: 'New task' }]);
  const second = begin(payload(target, profile({ discoveryEnabled: true }))); await r.api('/api/version');
  const newer = Profile.normalize({ ...target, visualTaste: 'Newer taste', discoveryEnabled: false, shownHistory: [{ id: 'shown', day: '2026-09-19' }] });
  r.seed(a, { settings: { inspiration: newer, marker: 'latest' } }); second.finish();
  assert.equal((await second.result).status, 409); assert.deepEqual(r.read(a, 'settings'), { inspiration: newer, marker: 'latest' });
  const third = begin(payload(newer, target)); await r.api('/api/version');
  assert.equal((await r.api('/api/auth/logout', { cookie: a.cookie, method: 'POST', body: { all: true } })).status, 200);
  third.finish(); assert.equal((await third.result).status, 401, 'session rotation while a body streams revokes that write too');
  assert.deepEqual(r.read(a, 'settings'), { inspiration: newer, marker: 'latest' });
});

test('profile owner rejects malformed state and drafts, and lost-response replay does not rewrite files', { timeout: 30000 }, async t => {
  const r = await runtime(t), a = await r.register('profile-retry');
  const draft = { version: 1, savedAt: '2026-09-19T12:00:00.000Z', profile: profile() };
  r.seed(a, { settings: { marker: 1, inspirationDraft: draft }, tasks: [] });
  const request = payload(null, profile(), { baseDraft: draft });
  for (const body of [null, {}, { ...request, base: 'server' }, { ...request, profile: {} }, { ...request, finds: Array(4).fill({}) }]) {
    assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body })).status, 400);
  }
  assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, raw: '{' })).status, 400);
  assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, raw: 'x'.repeat(262145) })).status, 413);
  const first = await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request }); assert.equal(first.status, 200);
  r.seed(a, { settings: { ...r.read(a, 'settings'), marker: 'unrelated second write' } });
  const before = fs.readFileSync(r.file(a, 'settings'), 'utf8');
  const retry = await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request });
  assert.equal(retry.status, 200); assert.equal(retry.data.replay, true); assert.equal(fs.readFileSync(r.file(a, 'settings'), 'utf8'), before);
  const newDraft = { ...draft, savedAt: '2026-09-19T13:00:00.000Z' };
  r.seed(a, { settings: { ...r.read(a, 'settings'), inspirationDraft: newDraft } });
  assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request })).status, 409);
  assert.deepEqual(r.read(a, 'settings').inspirationDraft, newDraft);
  fs.writeFileSync(r.file(a, 'settings'), '{broken');
  assert.equal((await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request })).status, 409);
  assert.equal(fs.readFileSync(r.file(a, 'settings'), 'utf8'), '{broken');
});

test('profile success waits for WAL; failures roll back and SIGKILL recovery/retry preserves both files', { timeout: 45000 }, async t => {
  const r = await runtime(t), a = await r.register('profile-wal'), before = { marker: 'keep', inspiration: profile() }, tasks = [{ id: 'task', title: 'Keep task' }];
  const request = payload(before.inspiration, profile({ visualTaste: 'After durable write' }));
  r.seed(a, { settings: before, tasks }); await r.stop(); await r.start({ COMMITMENT_FAIL_AFTER_FILE: '1' });
  const failed = await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request });
  assert.equal(failed.status, 500); assert.equal(failed.data.ok, false); assert.equal(failed.data.snapshots, undefined);
  assert.deepEqual(r.read(a, 'settings'), before); assert.deepEqual(r.read(a, 'tasks'), tasks);
  for (const point of ['after_settings_write', 'after_tasks_write', 'after_committed_journal']) {
    await r.stop(); r.seed(a, { settings: before, tasks }); await r.start({ COMMITMENT_CRASH_AT: point });
    const died = new Promise(resolve => r.child().once('exit', (code, signal) => resolve(signal)));
    await assert.rejects(r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request }));
    assert.equal(await died, 'SIGKILL'); await r.start();
    assert.deepEqual(r.read(a, 'settings'), point === 'after_committed_journal' ? { ...before, inspiration: request.profile } : before);
    assert.deepEqual(r.read(a, 'tasks'), tasks);
    const retry = await r.api('/api/inspiration/profile', { method: 'POST', cookie: a.cookie, body: request });
    assert.equal(retry.status, 200); assert.equal(retry.data.replay, point === 'after_committed_journal');
    assert.deepEqual(retry.data.snapshots.settings.value, { ...before, inspiration: request.profile });
    assert.equal(fs.existsSync(path.join(path.dirname(r.file(a, 'settings')), '.commitment-journal-v1.json')), false);
  }
});

test('discovery uses only stored opt-in, honestly reports configuration, and protects cache integrity and quotas', { timeout: 30000 }, async t => {
  const r = await runtime(t), a = await r.register('discovery-a'), b = await r.register('discovery-b');
  r.seed(a, { settings: { inspiration: profile({ discoveryEnabled: true }) } });
  const absent = await r.api('/api/inspiration/discovery', { cookie: a.cookie });
  assert.equal(absent.data.status, 'unconfigured'); assert.equal(absent.data.providerAvailable, false);
  assert.equal((await r.api('/api/inspiration/discovery', { cookie: a.cookie, method: 'POST', body: {} })).data.status, 'unconfigured');
  assert.equal(r.calls().length, 0);
  assert.equal((await r.api('/api/inspiration/discovery', { cookie: b.cookie, method: 'POST', body: { profile: profile({ discoveryEnabled: true }), accountId: a.id } })).status, 400);
  await r.stop(); await r.start({ BRAVE_SEARCH_API_KEY: 'isolated-provider-key' });
  assert.equal((await r.api('/api/inspiration/discovery', { cookie: b.cookie, method: 'POST', body: {} })).data.status, 'disabled');
  const first = await r.api('/api/inspiration/discovery', { cookie: a.cookie, method: 'POST', body: {} });
  assert.equal(first.status, 200); assert.equal(first.data.status, 'ready'); assert.equal(first.data.candidates.length, 2); assert.equal(r.calls().length, 2);
  assert.deepEqual(first.data.candidates[0].keywords, ['blue', 'mountain', 'photograph']);
  assert.ok(!first.data.candidates[0].keywords.includes('neon'), 'query taste is not evidence of the candidate content');
  const saved = r.read(a, 'inspiration-discovery'); assert.equal(saved.quota.attempts, 2);
  const replay = await r.api('/api/inspiration/discovery', { cookie: a.cookie, method: 'POST', body: {} });
  assert.equal(replay.data.cached, true); assert.deepEqual(replay.data.candidates, first.data.candidates); assert.equal(r.calls().length, 2);
  for (const method of ['GET', 'POST', 'PUT']) assert.equal((await r.api('/api/data/inspiration-discovery', { cookie: a.cookie, method, body: method === 'GET' ? undefined : {} })).status, 403);
  for (const broken of ['{bad', 'null', '{}']) {
    fs.writeFileSync(r.file(a, 'inspiration-discovery'), broken);
    const result = await r.api('/api/inspiration/discovery', { cookie: a.cookie, method: 'POST', body: {} });
    assert.equal(result.status, 503); assert.equal(result.data.status, 'storage_error');
    assert.equal(fs.readFileSync(r.file(a, 'inspiration-discovery'), 'utf8'), broken); assert.equal(r.calls().length, 2);
  }
});

test('metadata body/rate limits are account-scoped; disconnect aborts the official request', { timeout: 30000 }, async t => {
  const r = await runtime(t), a = await r.register('metadata-a'), b = await r.register('metadata-b');
  assert.equal((await r.api('/api/inspiration/metadata', { cookie: a.cookie, method: 'POST', body: { url: 'x'.repeat(8192) } })).status, 413);
  for (const body of [null, {}, { url: 1 }, { url: 'https://example.test', profile: {} }]) {
    assert.equal((await r.api('/api/inspiration/metadata', { cookie: a.cookie, method: 'POST', body })).status, 400);
  }
  for (let n = 0; n < 20; n++) assert.equal((await r.api('/api/inspiration/metadata', { cookie: a.cookie, method: 'POST', body: { url: 'https://example.test/' } })).status, 400);
  assert.equal((await r.api('/api/inspiration/metadata', { cookie: a.cookie, method: 'POST', body: { url: 'https://www.pinterest.com/pin/123456789/' } })).status, 429);
  assert.equal(r.calls().length, 0);
  const got = await r.api('/api/inspiration/metadata', { cookie: b.cookie, method: 'POST', body: { url: 'https://www.pinterest.com/pin/123456789/' } });
  assert.equal(got.status, 200); assert.equal(got.data.status, 'resolved'); assert.equal(got.data.title, 'Official pin title');
  assert.equal(got.data.mediaType, 'image'); assert.equal(got.data.attributionKind, 'pinner');
  await r.stop(); await r.start({ INSPIRATION_TEST_SLOW: '1' });
  const req = http.request(r.base + '/api/inspiration/metadata', { method: 'POST', headers: { Cookie: a.cookie, 'Content-Type': 'application/json' } });
  req.on('error', () => {}); req.end(JSON.stringify({ url: 'https://www.pinterest.com/pin/123456789/' }));
  for (let n = 0; n < 100 && r.calls().length < 2; n++) await pause(10);
  assert.equal(r.calls().length, 2); req.destroy();
  const aborted = path.join(r.dir, 'metadata-aborted');
  for (let n = 0; n < 100 && !fs.existsSync(aborted); n++) await pause(10);
  assert.equal(fs.existsSync(aborted), true);
});
