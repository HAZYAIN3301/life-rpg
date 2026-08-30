'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

async function startServer(extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-questionnaire-v1-'));
  const port = 32000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  // This repo may live in a cloud-synchronised folder on macOS; cold module
  // reads occasionally take >8 s even though the server is healthy.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { const response = await fetch(`${base}/api/auth/profiles`); if (response.ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start on ${port}: ${output}`);
}

async function api(base, route, { method = 'GET', cookie = '', body, raw } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method, headers,
    body: raw !== undefined ? raw : (body === undefined ? undefined : JSON.stringify(body)),
  });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}

async function register(base, suffix) {
  const result = await api(base, '/api/auth/register', {
    method: 'POST', body: { name: `Q ${suffix}`, email: `q-${suffix}@example.test`, password: `questionnaire-${suffix}-pass` },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return { cookie: result.cookie, user: result.data };
}

function payload(suffix = 'alpha', revision = 1) {
  const source = 'user_confirmed_suggestion';
  return {
    idempotencyKey: `questionnaire.commit.${suffix}.001`,
    revision,
    receipt: {
      draftId: `draft-${suffix}-001`,
      originAnswerId: `answer-${suffix}-001`,
      sourceLocale: 'ru',
      recognitionPhrase: 'Выпустить первое видео о Satoru',
      source,
      confirmedAt: '2026-08-30T10:00:00.000Z',
      consents: { sendRawTextToAiProvider: true, retainRawAnswer: true },
    },
    settings: {
      skills: [{ id: `sk-${suffix}-video`, name: `Видео ${suffix}`, color: '#4cc9f0', parentId: null, role: 'primary', source }],
    },
    goal: {
      id: `g-${suffix}-video`, title: 'Выпустить первое видео', why: 'Начать продвижение Satoru',
      outcome: 'Видео опубликовано', deadline: null,
      skillIds: [`sk-${suffix}-video`], backgroundSkillIds: [], source,
    },
    task: {
      id: `t-${suffix}-video`, title: 'Выбрать сцену и записать черновой дубль', estimateMin: 15,
      date: '2026-08-30', skillIds: [`sk-${suffix}-video`], layers: [],
      goalId: `g-${suffix}-video`, difficulty: 'easy', source,
    },
    profileConsent: { useConfirmedFactsForAssistant: true, useRecognitionInGuide: true },
  };
}

function existingGoal() {
  return {
    id: 'g-existing', title: 'Существующая цель', description: '', skillId: 'sk-existing', skillIds: ['sk-existing'],
    backgroundSkillIds: [], type: 'short', xpReward: 75, parentId: null, groupId: null,
    targetDate: null, steps: [], metric: null, progressKind: 'checklist', status: 'active', window: '',
    createdAt: '2026-08-01T00:00:00.000Z', completedAt: null, archived: false,
  };
}

test('Questionnaire v1: auth, ownership, atomic materialization and idempotent retry', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = runtime;

  assert.equal((await api(base, '/api/questionnaire')).response.status, 401);
  assert.equal((await api(base, '/api/questionnaire/commit', { method: 'POST', body: payload() })).response.status, 401);

  const alpha = await register(base, 'alpha');
  const beta = await register(base, 'beta');
  const initial = await api(base, '/api/questionnaire', { cookie: alpha.cookie });
  assert.equal(initial.response.status, 200);
  assert.equal(initial.data.questionnaire.status, 'draft');
  assert.equal(initial.data.questionnaire.revision, 0);

  const initialSettings = { lang: 'ru', marker: 'preserve-me', skills: [{ id: 'sk-existing', name: 'Учёба', color: '#6688cc' }] };
  const initialGoals = [existingGoal()];
  const initialTasks = [{ id: 't-existing', title: 'Существующее дело', skillId: 'sk-existing', skillIds: ['sk-existing'], date: '2026-08-30', done: false }];
  assert.equal((await api(base, '/api/data/settings', { method: 'PUT', cookie: alpha.cookie, body: initialSettings })).response.status, 200);
  assert.equal((await api(base, '/api/data/goals', { method: 'PUT', cookie: alpha.cookie, body: initialGoals })).response.status, 200);
  assert.equal((await api(base, '/api/data/tasks', { method: 'PUT', cookie: alpha.cookie, body: initialTasks })).response.status, 200);
  assert.equal((await api(base, '/api/data/goal-groups', { method: 'PUT', cookie: alpha.cookie, body: [] })).response.status, 200);
  const legacy = await api(base, '/api/questionnaire', { cookie: alpha.cookie });
  assert.equal(legacy.data.questionnaire.status, 'materialized');
  assert.equal(legacy.data.questionnaire.legacy, true, 'existing accounts with skills skip the new gate without an invented receipt');

  const candidate = payload('alpha');
  const committed = await api(base, '/api/questionnaire/commit', { method: 'POST', cookie: alpha.cookie, body: candidate });
  assert.equal(committed.response.status, 200, JSON.stringify(committed.data));
  assert.equal(committed.data.ok, true);
  assert.equal(committed.data.replayed, false);
  assert.equal(committed.data.questionnaire.status, 'materialized');
  assert.deepEqual(committed.data.questionnaire.materialized, {
    goalIds: ['g-alpha-video'], taskIds: ['t-alpha-video'], sphereIds: ['sk-alpha-video'],
  });
  assert.equal(committed.data.questionnaire.consents.retainRawAnswer, false, 'raw answer is never retained by commit');
  assert.equal(committed.data.settings.marker, 'preserve-me');
  assert.equal(committed.data.settings.skills.length, 2, 'existing sphere is preserved');
  assert.deepEqual(committed.data.goals.map((item) => item.id), ['g-existing', 'g-alpha-video']);
  assert.deepEqual(committed.data.tasks.map((item) => item.id), ['t-existing', 't-alpha-video']);
  assert.equal(committed.data.tasks[1].goalId, 'g-alpha-video');

  const replay = await api(base, '/api/questionnaire/commit', { method: 'POST', cookie: alpha.cookie, body: candidate });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.data));
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.goals.length, 2);
  assert.equal(replay.data.tasks.length, 2);
  assert.equal(replay.data.settings.skills.length, 2);

  const altered = structuredClone(candidate); altered.goal.title = 'Другой результат';
  const keyConflict = await api(base, '/api/questionnaire/commit', { method: 'POST', cookie: alpha.cookie, body: altered });
  assert.equal(keyConflict.response.status, 409);
  assert.equal(keyConflict.data.error, 'questionnaire_idempotency_conflict');

  const betaView = await api(base, `/api/questionnaire?userId=${encodeURIComponent(alpha.user.id)}`, { cookie: beta.cookie });
  assert.equal(betaView.response.status, 200);
  assert.equal(betaView.data.questionnaire.status, 'draft', 'query cannot select another owner');
  const injected = { ...payload('beta'), userId: alpha.user.id };
  const rejectedOwner = await api(base, '/api/questionnaire/commit', { method: 'POST', cookie: beta.cookie, body: injected });
  assert.equal(rejectedOwner.response.status, 400, 'a body userId is outside the whitelist');

  const betaCommit = await api(base, '/api/questionnaire/commit', { method: 'POST', cookie: beta.cookie, body: payload('beta') });
  assert.equal(betaCommit.response.status, 200);
  assert.deepEqual(betaCommit.data.questionnaire.materialized.goalIds, ['g-beta-video']);
  const alphaAfterBeta = await api(base, '/api/questionnaire', { cookie: alpha.cookie });
  assert.deepEqual(alphaAfterBeta.data.questionnaire.materialized.goalIds, ['g-alpha-video']);

  const directOverwrite = await api(base, '/api/data/questionnaire', { method: 'PUT', cookie: alpha.cookie, body: { status: 'deferred' } });
  assert.equal(directOverwrite.response.status, 403, 'receipt is server-owned');

  const exported = await api(base, '/api/account/export', { cookie: alpha.cookie });
  assert.equal(exported.response.status, 200);
  assert.equal(exported.data.data.questionnaire.status, 'materialized');
  assert.ok(exported.data.data.goals.some((goal) => goal.id === 'g-alpha-video'));
  assert.ok(exported.data.data.tasks.some((task) => task.id === 't-alpha-video'));

  const restoredAccount = await register(base, 'restored');
  const restored = await api(base, '/api/account/import', {
    method: 'POST', cookie: restoredAccount.cookie, body: exported.data,
  });
  assert.equal(restored.response.status, 200, JSON.stringify(restored.data));
  const restoredQuestionnaire = await api(base, '/api/questionnaire', { cookie: restoredAccount.cookie });
  assert.equal(restoredQuestionnaire.data.questionnaire.status, 'materialized');
  assert.deepEqual(restoredQuestionnaire.data.questionnaire.materialized.goalIds, ['g-alpha-video']);

  const incompleteAccount = await register(base, 'incomplete');
  const incomplete = await api(base, '/api/account/import', {
    method: 'POST', cookie: incompleteAccount.cookie,
    body: { format: 'satoru-account', version: 1, data: { questionnaire: exported.data.data.questionnaire } },
  });
  assert.equal(incomplete.response.status, 400, 'receipt cannot be restored without referenced domain records');

  const alphaDir = path.join(dataDir, 'users', alpha.user.id);
  assert.equal(fs.existsSync(path.join(alphaDir, 'questionnaire.json')), true);
  const deleted = await api(base, '/api/auth/delete-account', {
    method: 'POST', cookie: alpha.cookie, body: { password: 'questionnaire-alpha-pass', confirm: 'DELETE' },
  });
  assert.equal(deleted.response.status, 200, JSON.stringify(deleted.data));
  assert.equal(fs.existsSync(alphaDir), false, 'delete lifecycle removes receipt with the account directory');
});

test('Questionnaire v1: defer is idempotent and a later explicit seed uses the next revision', { timeout: 20000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'defer');
  const deferPayload = {
    idempotencyKey: 'questionnaire.defer.defer.001', revision: 1,
    receipt: {
      draftId: 'draft-defer-001', originAnswerId: 'answer-defer-001', sourceLocale: 'de',
      recognitionPhrase: '', source: 'user_explicit', confirmedAt: null, consents: {},
    },
  };
  const first = await api(runtime.base, '/api/questionnaire/defer', { method: 'POST', cookie: account.cookie, body: deferPayload });
  assert.equal(first.response.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.questionnaire.status, 'deferred');
  assert.equal(first.data.questionnaire.revision, 1);
  const replay = await api(runtime.base, '/api/questionnaire/defer', { method: 'POST', cookie: account.cookie, body: deferPayload });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.replayed, true);
  const loaded = await api(runtime.base, '/api/questionnaire', { cookie: account.cookie });
  assert.equal(loaded.data.questionnaire.status, 'deferred');

  const next = payload('defer', 2);
  const committed = await api(runtime.base, '/api/questionnaire/commit', { method: 'POST', cookie: account.cookie, body: next });
  assert.equal(committed.response.status, 200, JSON.stringify(committed.data));
  assert.equal(committed.data.questionnaire.status, 'materialized');
  assert.equal(committed.data.questionnaire.revision, 2);
});

test('Questionnaire v1: malformed, oversized and revision-conflict requests do not mutate account data', { timeout: 20000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const account = await register(runtime.base, 'invalid');
  const baseline = { marker: 'still-here', skills: [] };
  await api(runtime.base, '/api/data/settings', { method: 'PUT', cookie: account.cookie, body: baseline });
  await api(runtime.base, '/api/data/goals', { method: 'PUT', cookie: account.cookie, body: [] });
  await api(runtime.base, '/api/data/tasks', { method: 'PUT', cookie: account.cookie, body: [] });
  await api(runtime.base, '/api/data/goal-groups', { method: 'PUT', cookie: account.cookie, body: [] });

  const wrongRevision = await api(runtime.base, '/api/questionnaire/commit', {
    method: 'POST', cookie: account.cookie, body: payload('invalid', 2),
  });
  assert.equal(wrongRevision.response.status, 409);
  assert.equal(wrongRevision.data.error, 'questionnaire_revision_conflict');

  const long = payload('invalid'); long.goal.title = 'x'.repeat(121);
  const malformed = await api(runtime.base, '/api/questionnaire/commit', { method: 'POST', cookie: account.cookie, body: long });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.data.error, 'invalid_questionnaire_goal');

  const badRef = payload('invalid'); badRef.task.goalId = 'g-someone-else';
  assert.equal((await api(runtime.base, '/api/questionnaire/commit', { method: 'POST', cookie: account.cookie, body: badRef })).response.status, 400);
  const badDate = payload('invalid'); badDate.task.date = '2026-99-99';
  assert.equal((await api(runtime.base, '/api/questionnaire/commit', { method: 'POST', cookie: account.cookie, body: badDate })).response.status, 400);

  const oversized = await api(runtime.base, '/api/questionnaire/commit', {
    method: 'POST', cookie: account.cookie, raw: JSON.stringify({ junk: 'x'.repeat(100 * 1024) }),
  });
  assert.equal(oversized.response.status, 413);

  const settings = await api(runtime.base, '/api/data/settings', { cookie: account.cookie });
  assert.deepEqual(settings.data, baseline);
  const receiptFile = path.join(runtime.dataDir, 'users', account.user.id, 'questionnaire.json');
  assert.equal(fs.existsSync(receiptFile), false);
  fs.writeFileSync(receiptFile, '{"broken":true}');
  const corrupt = await api(runtime.base, '/api/questionnaire', { cookie: account.cookie });
  assert.equal(corrupt.response.status, 409);
  assert.equal(corrupt.data.error, 'questionnaire_data_corrupt');
  assert.equal(corrupt.data.recoverable, true, 'malformed receipt is not presented as an empty onboarding');
});

test('Questionnaire v1: failure after each transaction file rolls back every prior write', { timeout: 60000 }, async (t) => {
  for (const failAfter of [1, 2, 3, 4]) {
    await t.test(`fault after file ${failAfter}`, async (st) => {
      const runtime = await startServer({ QUESTIONNAIRE_FAIL_AFTER_FILE: String(failAfter) });
      st.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
      const suffix = `fault${failAfter}`;
      const account = await register(runtime.base, suffix);
      const beforeSettings = { marker: 'before', skills: [] }, beforeGoals = [], beforeTasks = [];
      await api(runtime.base, '/api/data/settings', { method: 'PUT', cookie: account.cookie, body: beforeSettings });
      await api(runtime.base, '/api/data/goals', { method: 'PUT', cookie: account.cookie, body: beforeGoals });
      await api(runtime.base, '/api/data/tasks', { method: 'PUT', cookie: account.cookie, body: beforeTasks });
      await api(runtime.base, '/api/data/goal-groups', { method: 'PUT', cookie: account.cookie, body: [] });

      const failed = await api(runtime.base, '/api/questionnaire/commit', { method: 'POST', cookie: account.cookie, body: payload(suffix) });
      assert.equal(failed.response.status, 500);
      assert.equal(failed.data.error, 'questionnaire_commit_failed_no_changes_lost');
      assert.deepEqual((await api(runtime.base, '/api/data/settings', { cookie: account.cookie })).data, beforeSettings);
      assert.deepEqual((await api(runtime.base, '/api/data/goals', { cookie: account.cookie })).data, beforeGoals);
      assert.deepEqual((await api(runtime.base, '/api/data/tasks', { cookie: account.cookie })).data, beforeTasks);
      assert.equal(fs.existsSync(path.join(runtime.dataDir, 'users', account.user.id, 'questionnaire.json')), false);
      const state = await api(runtime.base, '/api/questionnaire', { cookie: account.cookie });
      assert.equal(state.response.status, 200);
      assert.equal(state.data.questionnaire.status, 'draft');
    });
  }
});

test('Questionnaire v1: AI onboarding prompt and route enforce one goal, one task and 1–3 explicit spheres', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const prompt = source.slice(source.indexOf('const AI_ONBOARD_SYS'), source.indexOf('const AI_CALIB_SYS'));
  assert.match(prompt, /от 1 до 3 элементов/);
  assert.match(prompt, /ровно один \{"type":"goal"/);
  assert.match(prompt, /ровно один \{"type":"task"/);
  assert.match(prompt, /Никогда автоматически не добавляй Отдых, Отношения/);
  assert.match(source, /sanitizeOnboardingProposals\(parsed\)/);
  assert.match(source, /if \(kind === 'onboard'\)/);
});
