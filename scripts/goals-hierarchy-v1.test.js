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
const INDEX = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const INITIATIVES = fs.readFileSync(path.join(ROOT, 'public/goals-initiatives-v1.js'), 'utf8');

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
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'goals-pass-169', name: 'Goals QA' }) });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('Goals v169 has one checked goals/initiatives/tasks graph and no direct client goal PUT path', () => {
  assert.match(APP, /Store\.loadChecked\('goals', \[\], validateGoalsPayload\)/);
  assert.match(APP, /Store\.loadChecked\('goal-groups', \[\], validateGoalGroupsPayload\)/);
  assert.match(APP, /fetch\('\/api\/goals\/commit'/);
  assert.match(APP, /const data = \{ goals: nextGoals, tasks: nextTasks, groups: nextGroups \|\| \[\] \}/);
  assert.match(APP, /Store\.runExclusive\(\['goals', 'goal-groups', 'settings', 'tasks'\][\s\S]{0,260}dedicatedCommitPayload\(data\)/,
    'goal graph must share the settings/tasks mutex and receive the exact CAS envelope');
  assert.match(APP, /\/api\/goals\/commit[\s\S]{0,300}commitmentBoundaryRejected\(response\)[\s\S]{0,180}rememberDedicatedCommitSlots\(data/,
    'goal commit must reject stale bases and advance snapshots only after success');
  assert.doesNotMatch(APP, /Store\.(?:save|saveNow|_put)\('(goals|goal-groups)'/);
  assert.match(APP, /normalizeGoalTaskLinks/);
  assert.match(APP, /normalizeGoalGroupLinks/);
  assert.match(APP, /delete task\.goalId/);
  assert.match(INDEX, /<script src="goals-initiatives-v1\.js\?v=20260825-goals-v169-1"><\/script>[\s\S]*<script src="app\.js/);
  assert.match(SW, /'goals-initiatives-v1\.js'/);
  assert.match(INITIATIVES, /function focusModel/);
  assert.match(SW, /const CACHE = 'satoru-v233'/);
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
  assert.match(CSS, /Goals v169[\s\S]*\.goals-shell \.goal-summary \{[\s\S]*min-height: 58px/);
  assert.match(CSS, /\.goals-shell :is\(button, input, select, textarea, summary, a\),[\s\S]*min-height: var\(--touch-min\)/);
  assert.match(CSS, /\.goal-next-card a \{ display: inline-flex; align-items: center; \}/);
  assert.doesNotMatch(CSS, /body:has\(\.goals-shell\) #ai-fab[^}]*display:\s*none/);
  assert.match(CSS, /body:has\(\.goals-shell\) \.navrow \.navsec-l/);
  assert.match(APP, /goalChildren\(g\.id\)\.filter\(\(child\) => !!child\.archived === !!g\.archived\)/);
});

test('Goals v169 keeps two primary modes and moves map/archive into More', () => {
  assert.match(APP, /goalView: 'focus'/);
  for (const view of ['focus', 'all', 'map', 'archive']) assert.match(APP, new RegExp(`'${view}'`));
  assert.doesNotMatch(APP, /State\.goalView = 'horizons'/);
  assert.match(APP, /const wanted = State\.goalFilter === 'all' \? active : active\.filter\(\(goal\) => goal\.type === State\.goalFilter\)/);
  const renderGoals = APP.slice(APP.indexOf('function renderGoals'), APP.indexOf('// ============================================================\n//  Вид «Навыки»'));
  assert.doesNotMatch(renderGoals, /for \(const parent of goalChain/);
  assert.match(renderGoals, /<nav class="goals-view-tabs"/);
  assert.match(renderGoals, /class="goals-more-nav/);
  assert.equal(renderGoals.split('class="goals-view-tab${').length - 1, 2);
  assert.match(renderGoals, /data-action="goals-toggle-create"/);
  assert.match(renderGoals, /\$\{t\('Разобрать с Тенью'\)\}/);
  assert.match(APP, /data-action="open-goal-detail"/);
  assert.match(APP, /maxInitiatives: 3, maxUngrouped: 3/);
  assert.match(INITIATIVES, /FOCUS_TYPES = new Set\(\['short', 'recurring', 'mid', 'long'\]\)/);
  assert.doesNotMatch(APP.slice(APP.indexOf('function goalItem'), APP.indexOf('function goalTreeHTML')), /<details class="goal-detail/);
});

test('Goals supports explicit multi-select with atomic pause, archive and confirmed delete', () => {
  assert.match(APP, /data-action="goals-toggle-bulk"/);
  assert.match(APP, /data-action="goal-bulk-toggle"/);
  assert.match(APP, /data-action="goals-bulk-archive"/);
  assert.match(APP, /data-action="goals-bulk-delete"/);
  assert.match(APP, /aria-pressed="\$\{selected \? 'true' : 'false'\}"/);
  const bulk = APP.slice(APP.indexOf('async function applyGoalsBulkState'), APP.indexOf('function assistantActionsModule'));
  assert.match(bulk, /commitGoalMutation/);
  assert.match(bulk, /kind === 'archive'/);
  assert.match(CSS, /\.goal-bulk-pick/);
  assert.match(CSS, /\.goals-bulk-toolbar/);
});

test('Goals v169 uses one progressively disclosed detail dialog and human metric modes', () => {
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
  const detail = APP.slice(APP.indexOf('function goalDetailContentHTML'), APP.indexOf('function goalCreateFormHTML'));
  assert.equal((detail.match(/<details class="goal-detail-section/g) || []).length, 3);
  assert.doesNotMatch(detail, /<details[^>]* open/);
  assert.match(CSS, /html\.goal-detail-open \{ overflow: hidden; \}/);
});

test('Goals authored hierarchy and recovery copy covers every supported locale', () => {
  assert.match(APP, /else State\._goalsFocusAfterCommit = '\[data-action="goals-retry"\]'/);
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

test('Goals v169 initiative-first navigation and composer copy covers every supported locale', () => {
  for (const key of [
    'Сейчас',
    'Все цели',
    'Что важно сейчас',
    'До трёх активных инициатив. В каждой — одно ближайшее действие.',
    'Название инициативы',
    'В архив вместе с целями',
    'Разобрать с Тенью',
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

test('Goals commit is account-owned, idempotent, backward compatible and rejects orphan graphs', async (t) => {
  assert.match(SERVER, /function commitGoalData\(uid, payload\)/);
  assert.match(SERVER, /goal_commit_failed_no_changes_lost/);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-goals-v169-'));
  const port = 47500 + Math.floor(Math.random() * 500);
  const child = await startServer(port, dataDir);
  t.after(() => { child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const first = await register(base, 'goals-one@example.test');
  const second = await register(base, 'goals-two@example.test');
  const candidate = { goals: [
    { id: 'g_parent', title: 'Outcome', parentId: null, groupId: 'grp_research', steps: [], metric: null, progressKind: 'checklist' },
    { id: 'g_child', title: 'Child', parentId: 'g_parent', groupId: 'grp_research', steps: [{ id: 's1', title: 'Proof', done: false }], metric: null, progressKind: 'checklist' },
  ], groups: [{ id: 'grp_research', title: 'Research', status: 'active', createdAt: '2026-08-25T00:00:00.000Z' }], tasks: [{ id: 'q1', title: 'Next action', goalId: 'g_child' }] };
  for (let i = 0; i < 2; i++) {
    const response = await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: candidate }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  }
  const goals = await fetch(base + '/api/data/goals', { headers: { Cookie: first } });
  const groups = await fetch(base + '/api/data/goal-groups', { headers: { Cookie: first } });
  const tasks = await fetch(base + '/api/data/tasks', { headers: { Cookie: first } });
  assert.deepEqual(await goals.json(), candidate.goals); assert.deepEqual(await groups.json(), candidate.groups); assert.deepEqual(await tasks.json(), candidate.tasks);
  assert.equal((await fetch(base + '/api/data/goals', { headers: { Cookie: second } })).status, 404);
  const orphan = structuredClone(candidate); orphan.tasks[0].goalId = 'missing';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: orphan }) })).status, 400);
  const orphanGroup = structuredClone(candidate); orphanGroup.goals[0].groupId = 'missing';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: orphanGroup }) })).status, 400);
  const cycle = structuredClone(candidate); cycle.goals[0].parentId = 'g_child';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: cycle }) })).status, 400);
  const legacy = { goals: structuredClone(candidate.goals), tasks: structuredClone(candidate.tasks) }; legacy.goals[1].title = 'Changed by open v168 tab';
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: first }, body: JSON.stringify({ data: legacy }) })).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/data/goal-groups', { headers: { Cookie: first } })).json(), candidate.groups);
  assert.equal((await fetch(base + '/api/goals/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: candidate }) })).status, 401);
});
