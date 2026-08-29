'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const Guide = require(path.join(ROOT, 'public', 'guide-v3.js'));
const Presenter = require(path.join(ROOT, 'public', 'guide-presenter-v1.js'));
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const CHAPTERS = ['calendar', 'notes', 'voice', 'jarvis', 'systemTheme', 'rewards', 'hero', 'den', 'pets', 'tree', 'stats'];
const COMPLETIONS = Object.freeze({
  calendar: 'task-date-persisted', notes: 'note-persisted', voice: 'voice-choice-persisted',
  jarvis: 'helper-response-seen', systemTheme: 'system-theme-persisted', rewards: 'purchase-persisted', hero: 'hero-seen',
  den: 'den-seen', pets: 'pets-seen', tree: 'tree-seen', stats: 'stats-seen',
});

function openChapter(chapter) {
  let result = Guide.reduce(Guide.defaultState(), { type: 'guide:start', chapter, at: 1 });
  assert.equal(result.accepted, true, `${chapter}: start`);
  const candidate = chapter === 'calendar' ? 'task-1'
    : chapter === 'rewards' ? 'reward-1'
      : chapter === 'tree' ? 'node-1' : undefined;
  result = Guide.reduce(result.state, { type: 'guide:context-next', itemId: candidate, at: 2 });
  assert.equal(result.accepted, true, `${chapter}: open`);
  return result.state;
}

function completionEvent(chapter) {
  const event = { type: 'guide:context-complete', completion: COMPLETIONS[chapter], persisted: true, at: 3 };
  if (chapter === 'calendar') event.itemId = 'task-1';
  if (chapter === 'notes') event.itemId = 'note-1';
  if (chapter === 'voice') event.voiceConsent = true;
  if (chapter === 'jarvis') event.itemId = 'answer-1';
  if (chapter === 'rewards') { event.itemId = 'purchase-1'; event.targetId = 'reward-1'; }
  if (chapter === 'pets') event.itemId = 'sphere-1';
  if (chapter === 'tree') event.itemId = 'node-1';
  return event;
}

test('v195 registry releases eleven contextual chapters on one reload-safe three-step contract', () => {
  for (const chapter of CHAPTERS) {
    const entry = Guide.REGISTRY.find((item) => item.chapter === chapter);
    assert.ok(entry, chapter);
    assert.equal(entry.version, 2, `${chapter}: registry version`);
    assert.equal(entry.completion, COMPLETIONS[chapter], `${chapter}: exact completion`);
    let state = openChapter(chapter);
    assert.equal(state.currentStep, 'engage', `${chapter}: real feature step`);
    assert.equal(state.waitingFor, COMPLETIONS[chapter], `${chapter}: persisted receipt`);
    assert.equal(Guide.normalize(state).currentStep, 'engage', `${chapter}: survives hydration`);
    const done = Guide.reduce(state, completionEvent(chapter));
    assert.equal(done.accepted, true, `${chapter}: exact action accepted`);
    assert.equal(done.state.currentStep, 'complete', `${chapter}: receipt shown before chapter closes`);
    const finished = Guide.reduce(done.state, { type: 'guide:context-finish', at: 4 });
    assert.equal(finished.accepted, true, `${chapter}: explicit finish`);
    assert.ok(finished.state.completedChapters.includes(chapter));
    const replay = Guide.reduce(finished.state, { type: 'guide:replay', chapter, at: 5 });
    assert.equal(replay.accepted, true);
    assert.equal(Guide.reduce(replay.state, completionEvent(chapter)).accepted, false, `${chapter}: replay cannot mutate data`);
  }
});

test('candidate identity, persistence and successful voice playback fail closed', () => {
  const calendar = openChapter('calendar');
  assert.equal(Guide.reduce(calendar, { ...completionEvent('calendar'), itemId: 'other-task' }).reason, 'different-item');
  assert.equal(Guide.reduce(calendar, { ...completionEvent('calendar'), persisted: false }).reason, 'not-persisted');
  const rewards = openChapter('rewards');
  assert.equal(Guide.reduce(rewards, { ...completionEvent('rewards'), targetId: 'other-reward' }).reason, 'different-item');
  const voice = openChapter('voice');
  assert.equal(Guide.reduce(voice, { ...completionEvent('voice'), voiceConsent: false }).reason, 'voice-not-confirmed');
  const accepted = Guide.reduce(voice, completionEvent('voice'));
  assert.equal(accepted.state.voiceConsent, true);
  const jarvis = openChapter('jarvis');
  assert.equal(Guide.reduce(jarvis, { ...completionEvent('jarvis'), itemId: undefined }).reason, 'missing-item');
  const tree = openChapter('tree');
  assert.equal(Guide.reduce(tree, { ...completionEvent('tree'), itemId: undefined }).reason, 'missing-item');
  assert.equal(Guide.reduce(tree, { ...completionEvent('tree'), itemId: 'other-node' }).reason, 'different-item');
});

test('Calendar reconcile returns a stale real-action candidate to its recoverable intro', () => {
  const engaged = openChapter('calendar');
  const healthy = Guide.reconcile(engaged, {
    tasks: [{ id: 'task-1', title: 'Plan me', done: false, startTime: null }],
  });
  assert.equal(healthy.changed, false);
  assert.equal(healthy.state.currentStep, 'engage');
  for (const tasks of [
    [],
    [{ id: 'task-1', title: 'Done', done: true, startTime: null }],
    [{ id: 'task-1', title: 'Already scheduled', done: false, startTime: '09:30' }],
  ]) {
    const reset = Guide.reconcile(engaged, { tasks });
    assert.equal(reset.changed, true);
    assert.equal(reset.state.currentStep, 'intro');
    assert.equal(reset.state.waitingFor, null);
    assert.equal(reset.state.chapterMeta.calendar?.candidateId, undefined);
  }
  const malformedTime = Guide.reconcile(engaged, {
    tasks: [{ id: 'task-1', title: 'Still needs scheduling', done: false, startTime: '25:99' }],
  });
  assert.equal(malformedTime.changed, false, 'only a valid persisted time proves that scheduling is already complete');
});

test('a deliberately skipped Hero still satisfies Den prerequisite in a later session', () => {
  const state = Guide.defaultState();
  state.completedChapters = [Guide.FIRST_CHAPTER];
  const started = Guide.reduce(state, { type: 'guide:start', chapter: 'hero', at: 10 });
  const skipped = Guide.reduce(started.state, { type: 'guide:skip', chapter: 'hero', at: 11 });
  assert.equal(skipped.accepted, true);
  const den = Guide.REGISTRY.find((entry) => entry.chapter === 'den');
  assert.equal(Guide.prerequisitesMet(den, skipped.state), true);
  assert.equal(Guide.entryEligible(den, skipped.state, {
    now: 20, level: 3, newSessionAfterHero: true, sessionPrompted: false,
  }), true);
});

test('all released locales can present intro, real action, receipt and inert replay', () => {
  for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
    const Copy = require(path.join(ROOT, 'public', `guide-v3-copy-${locale}.js`));
    for (const chapter of CHAPTERS) {
      let state = Guide.reduce(Guide.defaultState(), { type: 'guide:start', chapter }).state;
      let view = Presenter.present({ state, chapter, copy: Copy });
      assert.equal(view.step, 'intro'); assert.ok(view.transcript); assert.equal(view.actions[0].id, 'context-open');
      state = Guide.reduce(state, { type: 'guide:context-next', itemId: chapter === 'calendar' ? 'task-1' : chapter === 'rewards' ? 'reward-1' : chapter === 'tree' ? 'node-1' : undefined }).state;
      view = Presenter.present({ state, chapter, copy: Copy });
      assert.equal(view.step, 'engage'); assert.ok(view.transcript); assert.ok(view.targetKey);
      state = Guide.reduce(state, completionEvent(chapter)).state;
      view = Presenter.present({ state, chapter, copy: Copy });
      assert.equal(view.step, 'complete'); assert.ok(view.transcript); assert.equal(view.actions[0].id, 'context-finish');
      state = Guide.reduce(Guide.reduce(state, { type: 'guide:context-finish' }).state, { type: 'guide:replay', chapter }).state;
      view = Presenter.present({ state, chapter, copy: Copy });
      assert.equal(view.replay, true); assert.equal(view.presentationOnly, true);
      assert.ok(view.actions.every((action) => action.presentationOnly === true));
    }
  }
});

test('runtime binds each chapter to a real semantic surface and suppresses replaced legacy drips', () => {
  assert.equal(Guide.REGISTRY.filter((entry) => entry.chapter === 'hero').length, 1, 'Hero registry entry must stay unique');
  for (const target of [
    'plan-nav', 'calendar-task', 'notes-nav', 'note-capture', 'speaker', 'helper', 'helper-input',
    'rewards-nav', 'reward-buy', 'hero-nav', 'hero-overview', 'den-overview', 'pet-sphere',
    'tree-overview', 'stats-overview',
  ]) assert.ok(APP.includes(target), `missing semantic target: ${target}`);
  for (const chapter of CHAPTERS) assert.match(APP, new RegExp(`\\b${chapter}: guideV3ReleasedChapter\\('${COMPLETIONS[chapter]}'\\)`));
  assert.match(APP, /guideV3FeatureCommit\('calendar',[\s\S]*task-date-persisted/);
  assert.match(APP, /guideV3FeatureCommit\('notes',[\s\S]*note-persisted/);
  assert.match(APP, /guideV3FeatureCommit\('rewards',[\s\S]*purchase-persisted/);
  assert.match(APP, /liveVoicePreview[\s\S]*\['unavailable', 'stopped'\][\s\S]*voiceConsent: true/);
  assert.match(APP, /guideRequestId[\s\S]*guideResponseId[\s\S]*helper-response-seen/);
  assert.match(APP, /_shadowVoiceStatus\?\.configured === true/);
  assert.match(APP, /refreshShadowVoiceStatus\(\);[\s\S]*scheduleAttentionBoundary/);
  assert.match(APP, /_guideV3AssistantResponseId = ''/);
  assert.match(APP, /data-response-id=\"\$\{CSS\.escape\(responseId\)\}\"/);
  const dataReady = APP.slice(APP.indexOf('function guideV3ChapterDataReady'), APP.indexOf('\nfunction guideV3AvailableChapters'));
  assert.match(dataReady, /const tasksReady = !State\._tasksLoadBusy/);
  assert.match(dataReady, /const habitsReady = !State\._habitsLoadBusy/);
  assert.match(dataReady, /const goalsReady = !State\._goalsLoadBusy/);
  assert.match(dataReady, /const progressReady = [\s\S]*!State\._accountDataLoadBusy[\s\S]*tasksReady && habitsReady && goalsReady/);
  assert.match(dataReady, /chapter === 'rewards'[\s\S]*progressReady[\s\S]*_accountDataLoadErrors\?\.lootbox/);
  assert.match(APP, /guide-context-viewed[\s\S]*target\?\.getClientRects\(\)\.length/);
  assert.match(APP, /GUIDE_V3_LEGACY_DRIPS[\s\S]*guideV3ContextRuntimeAllowed\(guideChapter\)/);
  assert.match(APP, /treeGuide = \(!edit[\s\S]*!guideV3ContextActive\('tree', 'tree-seen'\)/);
});

test('Calendar and Notes Guide actions fail closed around real writes and recovery', () => {
  assert.match(APP, /const future = openTasks\.filter\(\(task\) => !calendarTimeValue\(task\.startTime\)/);
  assert.match(APP, /const deadlineTask = openTasks\.find\(\(task\) => \{\s*if \(calendarTimeValue\(task\.startTime\)\) return false;/);
  assert.match(APP, /const guideOwns = guideV3ContextActive\('calendar', 'task-date-persisted'\)[\s\S]{0,260}!before\.startTime && !!nextTime/);
  const paint = APP.slice(APP.indexOf('function guideV3Paint()'), APP.indexOf('\nfunction guideV3MaybeStart'));
  assert.match(paint, /contextualReplay \|\| guideV3ChapterDataReady\(state\.currentChapter\)/);
  assert.match(paint, /reconcileGuideV3AfterTaskLoad\(\)[\s\S]*State\._guideV3CalendarTaskId = ''/);
  const openContext = APP.slice(APP.indexOf('async function guideV3OpenContextChapter()'), APP.indexOf('\nasync function guideV3OpenHabitsChapter'));
  assert.match(openContext, /!guideV3ChapterDataReady\(chapter\)/);

  const captureBar = APP.slice(APP.indexOf('function captureBar()'), APP.indexOf('\nfunction validateInboxPayload'));
  assert.match(captureBar, /const guideTextOnly = guideV3ContextActive\('notes', 'note-persisted'\)/);
  assert.match(captureBar, /guideTextOnly \? '' : `[\s\S]*data-action="cap-voice"[\s\S]*data-action="cap-video"/);
  assert.match(captureBar, /guideTextOnly \? '' : `<button class="dayrec-btn"/);

  const textSubmit = APP.slice(APP.indexOf("if (f.id === 'capture-form')"), APP.indexOf("if (f.id === 'chat-form')"));
  assert.match(textSubmit, /State\._guideV3NoteDraftId = uid\(\)/);
  assert.match(textSubmit, /id: guideNotes \? State\._guideV3NoteDraftId : uid\(\)/);
  assert.match(textSubmit, /filter\(\(note\) => !guideNotes \|\| note\.id !== item\.id\)/);
  assert.match(textSubmit, /if \(guideNotes\) State\._guideV3NoteDraftId = ''/);

  const mediaStop = APP.slice(APP.indexOf('async function onCaptureStop('), APP.indexOf('\n// Nested-прогрессия'));
  assert.match(mediaStop, /State\._inboxBusy = true/);
  assert.match(mediaStop, /commitInbox\(nextInbox, \{ lockOwned: true \}\)/);
  assert.match(mediaStop, /finally \{[\s\S]*_capturePending === rec[\s\S]*State\._inboxBusy = false/);
  assert.doesNotMatch(mediaStop, /guideV3FeatureCommit/);
});

test('Notes media capture is fenced to the account and write epoch that started it', () => {
  const capture = APP.slice(APP.indexOf('function captureOwnerCurrent('), APP.indexOf('\n// Nested-прогрессия'));
  assert.match(capture, /rec\.writeEpoch === Store\._writeEpoch[\s\S]*rec\.accountId === String\(State\.me\?\.id \|\| ''\)/);
  assert.match(capture, /const accountId = String\(State\.me\?\.id \|\| ''\), writeEpoch = Store\._writeEpoch/);
  assert.match(capture, /if \(writeEpoch !== Store\._writeEpoch \|\| accountId !== String\(State\.me\?\.id \|\| ''\)\)[\s\S]*stream\.getTracks\(\)\.forEach/);
  assert.match(capture, /recorder\.ondataavailable = \(e\) => \{ if \(!rec\.cancelled/);
  assert.ok((capture.match(/if \(!captureOwnerCurrent\(rec\)\) return;/g) || []).length >= 3,
    'owner is rechecked before upload, after upload and before inbox construction');
  assert.match(capture, /rec\.abortController\?\.abort\(\)/);
  const clear = APP.slice(APP.indexOf('function clearAllData()'), APP.indexOf('\nfunction handleAccountSessionExpired'));
  assert.match(clear, /Store\.cancelPending\(\);\s*cancelCapturePipeline\(\);/);
});

test('Hero, Pets and Tree gates use resolved-session, descendant activity and exact node identity', () => {
  const context = APP.slice(APP.indexOf('function guideV3Context('), APP.indexOf('\nfunction guideV3ChapterDataReady'));
  assert.match(context, /heroMeta\.completedAt \|\| heroMeta\.skippedAt/);
  assert.match(context, /descendantSkills\(skill\.id\)[\s\S]*recentEvents\.some/);
  assert.match(context, /treeNodeId = ''[\s\S]*nodeUnlockable\(skill\.id, node\)[\s\S]*treeNodeId = String\(candidate\.id\)/);
  assert.match(context, /meaningfulSphereData: activeSphereIds\.size >= 2[\s\S]*treeNodeId/);
  const selector = APP.slice(APP.indexOf('function guideV3TargetSelector'), APP.indexOf('\nfunction guideV3RevealTarget'));
  assert.match(selector, /vm\.chapter === 'tree'[\s\S]*data-action="tree-select-node"[\s\S]*CSS\.escape\(exactId\)/);
  const openContext = APP.slice(APP.indexOf('async function guideV3OpenContextChapter()'), APP.indexOf('\nasync function guideV3OpenHabitsChapter'));
  assert.match(openContext, /chapter === 'tree' \? context\.treeNodeId/);
  const treeHandler = APP.slice(APP.indexOf("action === 'tree-select-node'"), APP.indexOf("action === 'unlock-node'"));
  assert.match(treeHandler, /candidateId === String\(nodeId\)[\s\S]*!node\.milestone[\s\S]*!node\.capstone[\s\S]*nodeUnlockable/);
});

function cookieOf(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-guide-v193-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 200; index += 1) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}
async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}

test('Guide feature commit is authenticated, account-owned and rejects malformed batches without partial data', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;
  const alpha = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Guide Alpha', email: 'guide-alpha@example.test', password: 'guide-alpha-123' } });
  const beta = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Guide Beta', email: 'guide-beta@example.test', password: 'guide-beta-123' } });
  assert.equal(alpha.response.status, 200); assert.equal(beta.response.status, 200);
  const guide = Guide.defaultState(); guide.currentChapter = 'calendar'; guide.currentStep = 'complete'; guide.chapterMeta.calendar = { itemId: 'task-1' };
  const settings = { skills: [{ id: 's1', name: 'Work' }], guideV3: guide };
  const tasks = [{ id: 'task-1', title: 'Plan real work', date: '2026-08-29', done: false }];
  assert.equal((await api(base, '/api/guide/commit', { method: 'POST', body: { data: { tasks, settings } } })).response.status, 401);
  const saved = await api(base, '/api/guide/commit', { method: 'POST', cookie: alpha.cookie, body: { data: { tasks, settings } } });
  assert.equal(saved.response.status, 200); assert.deepEqual(new Set(saved.data.files), new Set(['tasks', 'settings']));
  assert.deepEqual((await api(base, '/api/data/tasks', { cookie: alpha.cookie })).data, tasks);
  const betaTasks = await api(base, '/api/data/tasks', { cookie: beta.cookie });
  assert.equal(JSON.stringify(betaTasks.data || {}).includes('Plan real work'), false, 'another account cannot read the committed task');
  const malformed = await api(base, '/api/guide/commit', {
    method: 'POST', cookie: alpha.cookie, body: { data: { tasks: [{ id: 'broken', title: '' }], settings } },
  });
  assert.equal(malformed.response.status, 400);
  assert.deepEqual((await api(base, '/api/data/tasks', { cookie: alpha.cookie })).data, tasks, 'validation happens before any write');
  assert.equal((await api(base, '/api/guide/commit', { method: 'POST', cookie: alpha.cookie, body: { data: { tasks, settings, goals: [] } } })).response.status, 400);
});

test('v195 cache and source contract ship the whole pack together', () => {
  assert.match(SW, /const CACHE = 'satoru-v196'/);
  assert.match(INDEX, /guide-v3\.js\?v=20260829-guide-library-v195-1/);
  assert.match(INDEX, /app\.js\?v=20260829-inspiration-v196-1/);
  assert.match(SERVER, /if \(u === '\/api\/guide\/commit' && req\.method === 'POST'\)/);
  assert.match(SERVER, /commitGuideData[\s\S]*restoreSnapshot/);
});
