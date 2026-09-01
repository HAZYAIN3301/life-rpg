'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) { return String(response.headers.get('set-cookie') || '').split(';')[0]; }

async function startServer(extraEnv = {}, options = {}) {
  const dataDir = options.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-commitment-v1-'));
  const port = 33000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { const response = await fetch(`${base}/api/auth/profiles`); if (response.ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}

async function waitForExit(child, timeoutMs = 15000) {
  if (child.exitCode != null || child.signalCode != null) return;
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('server did not exit')), timeoutMs)),
  ]);
}

async function stopServer(child) {
  if (child.exitCode == null && child.signalCode == null) child.kill('SIGTERM');
  await waitForExit(child).catch(() => {});
}

async function api(base, route, { method = 'GET', cookie = '', body, raw } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method, headers, body: raw !== undefined ? raw : (body === undefined ? undefined : JSON.stringify(body)),
  });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}

async function register(base, suffix) {
  const result = await api(base, '/api/auth/register', {
    method: 'POST', body: { name: 'Commit ' + suffix, email: `commit-${suffix}@example.test`, password: `commit-${suffix}-pass` },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return { cookie: result.cookie, id: result.data.id };
}

function commitment(id, over = {}) {
  return Object.assign({
    id: 'quest:' + id, kind: 'step', title: 'Квест ' + id,
    win: 'Завершить выбранный квест без ставки ресурсами',
    edge: { kind: 'trigger', on: 'до 2026-09-02' }, core: false,
    modes: [], history: [], decidedOn: '2026-09-01',
  }, over);
}
function candidate(id = 'q1', marker = 'after', baseData = null) {
  return {
    base: baseData ? {
      settings: { exists: true, value: structuredClone(baseData.settings) },
      tasks: { exists: true, value: structuredClone(baseData.tasks) },
    } : {
      settings: { exists: false, value: null },
      tasks: { exists: false, value: null },
    },
    data: {
    settings: {
      lang: 'ru', marker,
      commitmentsV1: { version: 1, mode: 'default', items: [commitment(id)], log: {} },
    },
    tasks: [{ id, title: 'Квест ' + id, date: '2026-09-02', done: false, commitmentId: 'quest:' + id, goldAwarded: 0 }],
  } };
}

const GRAPH_PUBLIC_NAMES = ['settings', 'tasks', 'goals', 'groups', 'skilltree'];
const GRAPH_ROUTE_NAME = { settings: 'settings', tasks: 'tasks', goals: 'goals', groups: 'goal-groups', skilltree: 'skilltree' };
function graphBase(data = null) {
  return Object.fromEntries(GRAPH_PUBLIC_NAMES.map((name) => [name, data
    ? { exists: true, value: structuredClone(data[name]) }
    : { exists: false, value: null }]));
}
function proposalGraph(id = 'one', marker = 'after', baseData = null) {
  const taskId = `task-${id}`, skillId = `skill-${id}`, goalId = `goal-${id}`, groupId = `group-${id}`;
  return {
    base: graphBase(baseData),
    data: {
      settings: {
        lang: 'ru', marker,
        skills: [{ id: skillId, name: `Сфера ${id}`, color: '#44aacc' }],
        commitmentsV1: { version: 1, mode: 'default', items: [commitment(taskId)], log: {} },
      },
      tasks: [{
        id: taskId, title: `Квест ${id}`, date: '2026-09-02', done: false,
        goalId, skillId, skillIds: [skillId], layers: [],
        commitmentId: `quest:${taskId}`, goldAwarded: 0,
      }],
      goals: [{
        id: goalId, title: `Цель ${id}`, groupId, skillId, skillIds: [skillId],
        backgroundSkillIds: [], steps: [{ id: `step-${id}`, title: `Шаг ${id}`, done: false }],
      }],
      groups: [{ id: groupId, title: `Проект ${id}`, status: 'active', createdAt: '2026-09-01T12:00:00.000Z' }],
      skilltree: { [skillId]: { schemaVersion: 1, nodes: [] } },
    },
  };
}
function plainGraph(id = 'plain') {
  const graph = proposalGraph(id, id).data;
  delete graph.settings.commitmentsV1;
  delete graph.tasks[0].commitmentId;
  return graph;
}
async function readGraph(base, cookie) {
  const pairs = await Promise.all(GRAPH_PUBLIC_NAMES.map(async (name) => {
    const result = await api(base, `/api/data/${GRAPH_ROUTE_NAME[name]}`, { cookie });
    return [name, result.data];
  }));
  return Object.fromEntries(pairs);
}
async function putGraph(base, cookie, data) {
  for (const name of GRAPH_PUBLIC_NAMES) {
    const result = await api(base, `/api/data/${GRAPH_ROUTE_NAME[name]}`, {
      method: 'PUT', cookie, body: data[name],
    });
    assert.equal(result.response.status, 200, `${name}: ${JSON.stringify(result.data)}`);
  }
}

test('extended goal commit atomically stores the exact five-file proposal graph', { timeout: 50000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'proposal-success');
  const graph = proposalGraph('success', 'success');
  const committed = await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: graph,
  });
  assert.equal(committed.response.status, 200, JSON.stringify(committed.data));
  assert.deepEqual(committed.data, {
    ok: true, files: ['settings', 'tasks', 'goals', 'goal-groups', 'skilltree'],
  });
  assert.deepEqual(await readGraph(runtime.base, account.cookie), graph.data);
});

test('invalid proposal graph and unknown skill references change none of the five files', { timeout: 50000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'proposal-invalid');
  const baseline = proposalGraph('baseline', 'baseline');
  assert.equal((await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: baseline,
  })).response.status, 200);
  const before = await readGraph(runtime.base, account.cookie);

  const invalidGoal = proposalGraph('invalid-goal', 'invalid-goal', baseline.data);
  invalidGoal.data.goals[0].skillIds = ['skill-does-not-exist'];
  const invalidTask = proposalGraph('invalid-task', 'invalid-task', baseline.data);
  invalidTask.data.tasks[0].skillId = 'skill-does-not-exist';
  for (const invalid of [invalidGoal, invalidTask]) {
    const rejected = await api(runtime.base, '/api/goals/commit', {
      method: 'POST', cookie: account.cookie, body: invalid,
    });
    assert.equal(rejected.response.status, 400, JSON.stringify(rejected.data));
    assert.equal(rejected.data.error, 'invalid_goal_commit');
    assert.deepEqual(await readGraph(runtime.base, account.cookie), before);
  }

  const unknownFile = proposalGraph('unknown', 'unknown', baseline.data);
  unknownFile.data.profile = {};
  assert.equal((await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: unknownFile,
  })).response.status, 400);
  assert.deepEqual(await readGraph(runtime.base, account.cookie), before);
});

test('extended goal commit requires exact base and rejects a stale five-file revision', { timeout: 50000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'proposal-cas');
  const first = proposalGraph('first', 'first');
  assert.equal((await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: first,
  })).response.status, 200);

  const missingBase = proposalGraph('missing', 'missing', first.data); delete missingBase.base;
  const required = await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: missingBase,
  });
  assert.equal(required.response.status, 428, JSON.stringify(required.data));
  assert.equal(required.data.error, 'commitment_atomic_write_required');

  const second = proposalGraph('second', 'second', first.data);
  assert.equal((await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: second,
  })).response.status, 200);
  const stale = proposalGraph('stale', 'stale', first.data);
  const conflict = await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: stale,
  });
  assert.equal(conflict.response.status, 409, JSON.stringify(conflict.data));
  assert.equal(conflict.data.error, 'commitment_revision_conflict');
  assert.deepEqual(await readGraph(runtime.base, account.cookie), second.data);
});

test('caught mid-graph write failure rolls every proposal file back', { timeout: 60000 }, async (t) => {
  const runtime = await startServer({ COMMITMENT_FAIL_AFTER_FILE: '3' });
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'proposal-caught');
  const before = plainGraph('before-caught');
  await putGraph(runtime.base, account.cookie, before);
  const after = proposalGraph('after-caught', 'after-caught', before);
  const failed = await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: after,
  });
  assert.equal(failed.response.status, 500, JSON.stringify(failed.data));
  assert.equal(failed.data.error, 'goal_commit_failed_no_changes_lost');
  assert.deepEqual(await readGraph(runtime.base, account.cookie), before);
});

test('SIGKILL during five-file proposal write is rolled back on restart', { timeout: 80000 }, async (t) => {
  const initial = await startServer();
  const dataDir = initial.dataDir; let live = initial.child;
  t.after(async () => { await stopServer(live); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const account = await register(initial.base, 'proposal-crash-prepared');
  const before = proposalGraph('before-crash', 'before-crash');
  assert.equal((await api(initial.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: before,
  })).response.status, 200);
  await stopServer(initial.child);

  const crashing = await startServer({ COMMITMENT_CRASH_AT: 'after_settings_write' }, { dataDir }); live = crashing.child;
  const after = proposalGraph('after-crash', 'after-crash', before.data);
  const request = api(crashing.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: after,
  }).catch(() => null);
  await waitForExit(crashing.child); await request;
  assert.equal(crashing.child.signalCode, 'SIGKILL');

  const restarted = await startServer({}, { dataDir }); live = restarted.child;
  assert.deepEqual(await readGraph(restarted.base, account.cookie), before.data);
  assert.equal(fs.existsSync(path.join(dataDir, 'users', account.id, '.commitment-journal-v1.json')), false);
});

test('SIGKILL after five-file commit marker rolls the complete proposal graph forward', { timeout: 80000 }, async (t) => {
  const initial = await startServer();
  const dataDir = initial.dataDir; let live = initial.child;
  t.after(async () => { await stopServer(live); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const account = await register(initial.base, 'proposal-crash-committed');
  const before = proposalGraph('before-forward', 'before-forward');
  assert.equal((await api(initial.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: before,
  })).response.status, 200);
  await stopServer(initial.child);

  const crashing = await startServer({ COMMITMENT_CRASH_AT: 'after_committed_journal' }, { dataDir }); live = crashing.child;
  const after = proposalGraph('after-forward', 'after-forward', before.data);
  const request = api(crashing.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie, body: after,
  }).catch(() => null);
  await waitForExit(crashing.child); await request;
  assert.equal(crashing.child.signalCode, 'SIGKILL');

  const restarted = await startServer({}, { dataDir }); live = restarted.child;
  assert.deepEqual(await readGraph(restarted.base, account.cookie), after.data);
  assert.equal(fs.existsSync(path.join(dataDir, 'users', account.id, '.commitment-journal-v1.json')), false);
});

test('legacy three-file goal commit remains compatible with the protected settings/tasks pair', { timeout: 50000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'proposal-legacy');
  const pair = candidate('legacy', 'legacy');
  assert.equal((await api(runtime.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: pair,
  })).response.status, 200);
  const legacy = await api(runtime.base, '/api/goals/commit', {
    method: 'POST', cookie: account.cookie,
    body: {
      base: {
        settings: { exists: true, value: pair.data.settings },
        tasks: { exists: true, value: pair.data.tasks },
      },
      data: { goals: [], groups: [], tasks: pair.data.tasks },
    },
  });
  assert.equal(legacy.response.status, 200, JSON.stringify(legacy.data));
  assert.deepEqual(legacy.data.files, ['goals', 'tasks', 'goal-groups']);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, pair.data.tasks);
});

test('commitment endpoint requires auth and atomically stores the exact settings + tasks graph', { timeout: 40000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', body: candidate() })).response.status, 401);
  const account = await register(runtime.base, 'atomic');
  const committed = await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, body: candidate() });
  assert.equal(committed.response.status, 200, JSON.stringify(committed.data));
  assert.deepEqual(committed.data, { ok: true, files: ['settings', 'tasks'] });
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, candidate().data.settings);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, candidate().data.tasks);
});

test('stale tab base is rejected with 409 and cannot overwrite a newer pair', { timeout: 40000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'revision');
  const first = candidate('first', 'first');
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, body: first })).response.status, 200);
  const staleBase = { settings: first.data.settings, tasks: first.data.tasks };
  const second = candidate('second', 'second', staleBase);
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, body: second })).response.status, 200);
  const stale = candidate('stale', 'stale', staleBase);
  const rejected = await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, body: stale });
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.data.error, 'commitment_revision_conflict');
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, second.data.settings);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, second.data.tasks);
});

test('exact payload, strict commitmentsV1, graph refs, and owner boundary reject without mutation', { timeout: 40000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const alpha = await register(runtime.base, 'alpha');
  const beta = await register(runtime.base, 'beta');
  const baseline = candidate('base', 'baseline');
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: alpha.cookie, body: baseline })).response.status, 200);

  const invalid = [];
  invalid.push({ settings: baseline.data.settings, tasks: baseline.data.tasks });
  invalid.push({ base: baseline.base, data: { settings: baseline.data.settings } });
  invalid.push({ base: baseline.base, data: { ...baseline.data, purchases: [] } });
  invalid.push({ base: baseline.base, data: baseline.data, userId: alpha.id });
  const unknown = structuredClone(baseline); unknown.data.settings.commitmentsV1.items[0].gold = 25; invalid.push(unknown);
  const legacy = structuredClone(baseline); legacy.data.tasks[0].oath = { gold: 25 }; invalid.push(legacy);
  const dangling = structuredClone(baseline); dangling.data.tasks[0].commitmentId = 'quest:missing'; invalid.push(dangling);
  const badLog = structuredClone(baseline); badLog.data.settings.commitmentsV1.log = { '2026-09-01': { missing: 'win' } }; invalid.push(badLog);

  for (const body of invalid) {
    const result = await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: alpha.cookie, body });
    assert.equal(result.response.status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: alpha.cookie })).data, baseline.data.settings);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: alpha.cookie })).data, baseline.data.tasks);

  const betaCandidate = candidate('beta', 'beta-only');
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: beta.cookie, body: betaCandidate })).response.status, 200);
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: alpha.cookie })).data, baseline.data.settings,
    'another authenticated account must not change alpha');
});

test('malformed and oversized bodies are rejected before account files change', { timeout: 40000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'body');
  const baseline = candidate('base', 'baseline');
  await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, body: baseline });
  assert.equal((await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, raw: '{bad' })).response.status, 400);
  const huge = JSON.stringify({ base: baseline.base, data: { settings: { marker: 'x'.repeat(9 * 1024 * 1024), commitmentsV1: baseline.data.settings.commitmentsV1 }, tasks: baseline.data.tasks } });
  const oversized = await api(runtime.base, '/api/commitments/commit', { method: 'POST', cookie: account.cookie, raw: huge });
  assert.equal(oversized.response.status, 413);
  assert.equal(oversized.data.error, 'commitment_commit_too_large');
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, baseline.data.settings);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, baseline.data.tasks);
});

test('failure after either transaction file restores every prior snapshot', { timeout: 60000 }, async (t) => {
  for (const failAfter of [1, 2]) {
    await t.test(`fault after file ${failAfter}`, async (st) => {
      const runtime = await startServer({ COMMITMENT_FAIL_AFTER_FILE: String(failAfter) });
      st.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
      const account = await register(runtime.base, 'fault' + failAfter);
      const beforeSettings = { marker: 'before-' + failAfter };
      const beforeTasks = [{ id: 'before', title: 'До транзакции', done: false }];
      assert.equal((await api(runtime.base, '/api/data/settings', { method: 'PUT', cookie: account.cookie, body: beforeSettings })).response.status, 200);
      assert.equal((await api(runtime.base, '/api/data/tasks', { method: 'PUT', cookie: account.cookie, body: beforeTasks })).response.status, 200);

      const failed = await api(runtime.base, '/api/commitments/commit', {
        method: 'POST', cookie: account.cookie, body: candidate('after', 'after-' + failAfter, { settings: beforeSettings, tasks: beforeTasks }),
      });
      assert.equal(failed.response.status, 500, JSON.stringify(failed.data));
      assert.equal(failed.data.error, 'commitment_commit_failed_no_changes_lost');
      assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, beforeSettings);
      assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, beforeTasks);
    });
  }
});

test('protected graph rejects single-file generic writes and accepts a based settings-only domain commit', { timeout: 40000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'boundary');
  const beforeSettings = { marker: 'bootstrap' };
  const beforeTasks = [{ id: 'plain', title: 'Обычный квест', done: false }];
  assert.equal((await api(runtime.base, '/api/data/settings', { method: 'PUT', cookie: account.cookie, body: beforeSettings })).response.status, 200);
  assert.equal((await api(runtime.base, '/api/data/tasks', { method: 'PUT', cookie: account.cookie, body: beforeTasks })).response.status, 200);

  const protectedPair = candidate('protected', 'protected', { settings: beforeSettings, tasks: beforeTasks });
  assert.equal((await api(runtime.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: protectedPair,
  })).response.status, 200);

  for (const [name, value] of [['settings', { marker: 'bypass' }], ['tasks', []]]) {
    const rejected = await api(runtime.base, `/api/data/${name}`, { method: 'PUT', cookie: account.cookie, body: value });
    assert.equal(rejected.response.status, 428, `${name}: ${JSON.stringify(rejected.data)}`);
    assert.equal(rejected.data.error, 'commitment_atomic_write_required');
  }

  const currentBase = {
    settings: { exists: true, value: structuredClone(protectedPair.data.settings) },
    tasks: { exists: true, value: structuredClone(protectedPair.data.tasks) },
  };
  const nextSettings = structuredClone(protectedPair.data.settings); nextSettings.marker = 'economy';
  const economy = await api(runtime.base, '/api/economy/commit', {
    method: 'POST', cookie: account.cookie, body: { base: currentBase, data: { settings: nextSettings } },
  });
  assert.equal(economy.response.status, 200, JSON.stringify(economy.data));
  assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, nextSettings);
  assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, protectedPair.data.tasks);

  const missingBase = await api(runtime.base, '/api/economy/commit', {
    method: 'POST', cookie: account.cookie, body: { data: { settings: protectedPair.data.settings } },
  });
  assert.equal(missingBase.response.status, 428);
  const stale = await api(runtime.base, '/api/economy/commit', {
    method: 'POST', cookie: account.cookie, body: { base: currentBase, data: { settings: protectedPair.data.settings } },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error, 'commitment_revision_conflict');
});

test('SIGKILL after settings write leaves a prepared journal that restart rolls back', { timeout: 70000 }, async (t) => {
  const initial = await startServer();
  const dataDir = initial.dataDir;
  let live = initial.child;
  t.after(async () => { await stopServer(live); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const account = await register(initial.base, 'crash-prepared');
  const before = candidate('before', 'before');
  assert.equal((await api(initial.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: before,
  })).response.status, 200);
  await stopServer(initial.child);

  const crashing = await startServer({ COMMITMENT_CRASH_AT: 'after_settings_write' }, { dataDir });
  live = crashing.child;
  const after = candidate('after', 'after', before.data);
  const request = api(crashing.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: after,
  }).catch(() => null);
  await waitForExit(crashing.child); await request;
  assert.equal(crashing.child.signalCode, 'SIGKILL');

  const restarted = await startServer({}, { dataDir }); live = restarted.child;
  assert.deepEqual((await api(restarted.base, '/api/data/settings', { cookie: account.cookie })).data, before.data.settings);
  assert.deepEqual((await api(restarted.base, '/api/data/tasks', { cookie: account.cookie })).data, before.data.tasks);
  assert.equal(fs.existsSync(path.join(dataDir, 'users', account.id, '.commitment-journal-v1.json')), false);
});

test('SIGKILL after committed journal leaves a transaction that restart rolls forward', { timeout: 70000 }, async (t) => {
  const initial = await startServer();
  const dataDir = initial.dataDir;
  let live = initial.child;
  t.after(async () => { await stopServer(live); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const account = await register(initial.base, 'crash-committed');
  const before = candidate('before', 'before');
  assert.equal((await api(initial.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: before,
  })).response.status, 200);
  await stopServer(initial.child);

  const crashing = await startServer({ COMMITMENT_CRASH_AT: 'after_committed_journal' }, { dataDir });
  live = crashing.child;
  const after = candidate('after', 'after', before.data);
  const request = api(crashing.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: after,
  }).catch(() => null);
  await waitForExit(crashing.child); await request;
  assert.equal(crashing.child.signalCode, 'SIGKILL');

  const restarted = await startServer({}, { dataDir }); live = restarted.child;
  assert.deepEqual((await api(restarted.base, '/api/data/settings', { cookie: account.cookie })).data, after.data.settings);
  assert.deepEqual((await api(restarted.base, '/api/data/tasks', { cookie: account.cookie })).data, after.data.tasks);
  assert.equal(fs.existsSync(path.join(dataDir, 'users', account.id, '.commitment-journal-v1.json')), false);
});

test('a corrupted journal fails closed for protected reads and writes without deleting evidence', { timeout: 50000 }, async (t) => {
  const initial = await startServer();
  const dataDir = initial.dataDir;
  let live = initial.child;
  t.after(async () => { await stopServer(live); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const account = await register(initial.base, 'corrupt-journal');
  const before = candidate('before', 'before');
  assert.equal((await api(initial.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: before,
  })).response.status, 200);
  await stopServer(initial.child);

  const journalFile = path.join(dataDir, 'users', account.id, '.commitment-journal-v1.json');
  fs.writeFileSync(journalFile, '{"schema":"truncated"');
  const restarted = await startServer({}, { dataDir }); live = restarted.child;
  for (const name of ['settings', 'tasks']) {
    const read = await api(restarted.base, `/api/data/${name}`, { cookie: account.cookie });
    assert.equal(read.response.status, 409, `${name}: ${JSON.stringify(read.data)}`);
    assert.equal(read.data.error, 'commitment_recovery_required');
  }
  const write = await api(restarted.base, '/api/commitments/commit', {
    method: 'POST', cookie: account.cookie, body: candidate('after', 'after', before.data),
  });
  assert.equal(write.response.status, 409);
  assert.equal(write.data.error, 'commitment_recovery_required');
  assert.equal(fs.readFileSync(journalFile, 'utf8'), '{"schema":"truncated"');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'users', account.id, 'settings.json'), 'utf8')), before.data.settings);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'users', account.id, 'tasks.json'), 'utf8')), before.data.tasks);
});
