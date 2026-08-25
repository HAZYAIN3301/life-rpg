const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

async function startServer(port, dataDir) {
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let error = ''; child.stderr.on('data', (chunk) => { error += chunk; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${error}`);
    try { const response = await fetch(`http://127.0.0.1:${port}/api/auth/me`); if (response.status) return child; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM'); throw new Error(error || 'server timeout');
}
async function register(base, email) {
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'goals-pass-127', name: 'Goals QA' }) });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('Goals v127 has one checked graph and no direct goal PUT path', () => {
  assert.match(APP, /Store\.loadChecked\('goals', \[\], validateGoalsPayload\)/);
  assert.match(APP, /fetch\('\/api\/goals\/commit'/);
  assert.match(APP, /data: \{ goals: nextGoals, tasks: nextTasks \}/);
  assert.doesNotMatch(APP, /Store\.(?:save|saveNow|_put)\('goals'/);
  assert.match(APP, /normalizeGoalTaskLinks/);
  assert.match(APP, /delete task\.goalId/);
  const cacheMatch = SW.match(/const CACHE = 'satoru-v(\d+)'/);
  assert.ok(cacheMatch, 'service worker has a versioned cache name');
  assert.ok(Number(cacheMatch[1]) >= 127, 'Goals v127 remains safe after later shell upgrades');
});

test('Progress source is exclusive and linked tasks are explicitly not counted', () => {
  const progress = APP.slice(APP.indexOf('function goalProgressKind'), APP.indexOf('// Цепочка вверх'));
  assert.match(progress, /metric.*checklist/);
  assert.doesNotMatch(progress, /State\.tasks|goalLinkedTasks/);
  assert.match(APP, /Связанные квесты не прибавляются повторно/);
  assert.match(APP, /Связанные квесты — действия, а не второй счётчик/);
  assert.match(APP, /goalProgressKind\(g\) !== 'checklist'/);
});

test('Goals hierarchy keeps durable edit paths, focus and deep links', () => {
  assert.match(APP, /class="card goals-outline/);
  assert.match(APP, /function goalTreeHTML/);
  assert.match(APP, /class="goal-edit-form"/);
  assert.match(APP, /class="goal-task-form"/);
  assert.match(APP, /function syncGoalDeepLink/);
  assert.match(APP, /State\._goalsFocusAfterCommit/);
  assert.match(APP, /role="dialog" aria-modal="true" aria-labelledby="goal-delete-title"/);
  assert.match(CSS, /\.goals-shell \.goal-summary \{[\s\S]*min-height: 76px/);
  assert.match(CSS, /\.goals-shell :is\(button, input, select, textarea, summary, a\),[\s\S]*min-height: var\(--touch-min\)/);
  assert.match(CSS, /body:has\(\.goals-shell\) #ai-fab \{ display: none; \}/);
  assert.match(CSS, /\.goals-shell \.gfilters \{[\s\S]*flex-wrap: nowrap;[\s\S]*overflow-x: auto/);
  assert.match(CSS, /body:has\(\.goals-shell\) \.navrow \.navsec-l/);
  assert.match(APP, /goalChildren\(g\.id\)\.filter\(\(child\) => !!child\.archived === !!g\.archived\)/);
});

test('Goals v168 separates focus, exact horizons, map and archive', () => {
  assert.match(APP, /goalView: 'focus'/);
  for (const view of ['focus', 'horizons', 'map', 'archive']) assert.match(APP, new RegExp(`'${view}'`));
  assert.match(APP, /const wanted = State\.goalFilter === 'all' \? active : active\.filter\(\(goal\) => goal\.type === State\.goalFilter\)/);
  const renderGoals = APP.slice(APP.indexOf('function renderGoals'), APP.indexOf('// ============================================================\n//  Вид «Навыки»'));
  assert.doesNotMatch(renderGoals, /shownIds|for \(const parent of goalChain/);
  assert.match(APP, /data-action="set-goal-view"/);
  assert.match(APP, /data-action="goals-toggle-create"/);
  assert.match(APP, /✨ \$\{t\('Разобрать с Тенью'\)\}/);
  assert.match(APP, /data-action="open-goal-detail"/);
  assert.doesNotMatch(APP.slice(APP.indexOf('function goalItem'), APP.indexOf('function goalTreeHTML')), /<details class="goal-detail"/);
});

test('Goals v168 uses one accessible detail dialog and human metric modes', () => {
  assert.match(APP, /overlay\.id = 'goal-detail-dialog'/);
  assert.match(APP, /role="dialog" aria-modal="true" aria-labelledby="goal-detail-title" aria-describedby="goal-detail-summary"/);
  assert.match(APP, /document\.getElementById\('app'\)\?\.setAttribute\('inert', ''\)/);
  assert.match(APP, /function handleGoalDetailKeydown/);
  assert.match(APP, /event\.key === 'Escape'/);
  assert.match(APP, /pathChoiceFocusable\(overlay\)/);
  assert.match(APP, /name="metricMode"/);
  for (const mode of ['checklist', 'increase', 'decrease', 'maintain']) assert.match(APP, new RegExp(`value="${mode}"`));
  assert.doesNotMatch(APP, /name="mLower"|name="mMaintain"/);
  assert.match(APP, /lowerBetter: metricMode === 'decrease'/);
  assert.match(APP, /maintain: metricMode === 'maintain'/);
  assert.match(CSS, /html\.goal-detail-open \{ overflow: hidden; \}/);
});

test('Goals v127 authored hierarchy and recovery copy covers every supported locale', () => {
  for (const key of [
    'Outcome сверху, следующие действия внутри. Один источник прогресса на цель.',
    'Связанные квесты не прибавляются повторно.',
    'Родительская цель',
    'Цели временно недоступны',
    'Удалить цели?',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(APP, new RegExp(`'${escaped}': \\{ en: '[^']+', de: '[^']+', uk: '[^']+', es: '[^']+' \\}`));
  }
  assert.match(APP, /\$\{t\(type\.label\)\} · \$\{t\(type\.timeframe\)\}/);
});

test('Goals v168 navigation and composer copy covers every supported locale', () => {
  for (const key of [
    'Фокус',
    'Горизонты',
    'Разобрать с Тенью',
    'Только цели выбранного горизонта. Полная цепочка — в Карте.',
    'Следующий шаг',
    'Дополнительные настройки',
    'Держать значение',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(APP, new RegExp(`'${escaped}': \\{ en: '[^']+', de: '[^']+', uk: '[^']+', es: '[^']+' \\}`));
  }
});

test('Delete contract reparents surviving children and detaches linked tasks', () => {
  const deletion = APP.slice(APP.indexOf('async function confirmGoalDelete'), APP.indexOf('function onClick'));
  assert.match(deletion, /goal\.parentId = parent && !removed\.has\(parent\.id\) \? parent\.id : null/);
  assert.match(deletion, /if \(task\.goalId && removed\.has\(task\.goalId\)\) delete task\.goalId/);
  assert.match(APP, /дочерних целей поднимутся на уровень выше/);
  assert.match(APP, /квестов останутся в плане, но потеряют ссылку на цель/);
});

test('Goals commit is account-owned, idempotent and rejects orphan/cyclic graphs', async (t) => {
  assert.match(SERVER, /function commitGoalData\(uid, payload\)/);
  assert.match(SERVER, /goal_commit_failed_no_changes_lost/);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-goals-v127-'));
  const port = 47500 + Math.floor(Math.random() * 500);
  const child = await startServer(port, dataDir);
  t.after(() => { child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const first = await register(base, 'goals-one@example.test');
  const second = await register(base, 'goals-two@example.test');
  const candidate = { goals: [
    { id: 'g_parent', title: 'Outcome', parentId: null, steps: [], metric: null, progressKind: 'checklist' },
    { id: 'g_child', title: 'Child', parentId: 'g_parent', steps: [{ id: 's1', title: 'Proof', done: false }], metric: null, progressKind: 'checklist' },
  ], tasks: [{ id: 'q1', title: 'Next action', goalId: 'g_child' }] };
  for (let i = 0; i < 2; i++) {
    const response = await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: candidate }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  }
  const goals = await fetch(base + '/api/data/goals', { headers: { Cookie: first } });
  const tasks = await fetch(base + '/api/data/tasks', { headers: { Cookie: first } });
  assert.deepEqual(await goals.json(), candidate.goals); assert.deepEqual(await tasks.json(), candidate.tasks);
  assert.equal((await fetch(base + '/api/data/goals', { headers: { Cookie: second } })).status, 404);
  const orphan = structuredClone(candidate); orphan.tasks[0].goalId = 'missing';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: orphan }) })).status, 400);
  const cycle = structuredClone(candidate); cycle.goals[0].parentId = 'g_child';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: cycle }) })).status, 400);
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: candidate }) })).status, 401);
});
