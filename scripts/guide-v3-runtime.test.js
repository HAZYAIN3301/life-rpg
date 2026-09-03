'use strict';

/* Guide v3 browser integration contract.
 *
 * These are intentionally source-level release gates. The pure reducer is covered by
 * guide-v3.test.js; this file guards the seams where a correct reducer can still become
 * a broken first-run experience: script order, persistence, focus/voice UI and app-shell
 * caching. During TDD a missing runtime seam is expected to make an individual test red.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readOptional = (file) => {
  try { return read(file); } catch { return ''; }
};

const APP = read('public/app.js');
const INDEX = read('public/index.html');
const CSS = read('public/styles.css');
const SW = read('public/sw.js');
const SERVER = read('server.js');
const GUIDE = readOptional('public/guide-v3.js');
const SURFACE = readOptional('public/guide-surface-v1.js');
const COPY_REVIEW = readOptional('GUIDE-V3-RU-COPY-REVIEW.md');
const COPY_RU = require('../public/guide-v3-copy-ru.js');
const GUIDE_COPY_FILES = Object.freeze([
  'guide-v3-copy-ru.js', 'guide-v3-copy-en.js', 'guide-v3-copy-de.js',
  'guide-v3-copy-uk.js', 'guide-v3-copy-es.js',
]);

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source boundary: ${start}`);
  assert.ok(to > from, `missing source boundary after ${start}: ${end}`);
  return source.slice(from, to);
}

function sourceMatches(source, pattern, message) {
  pattern.lastIndex = 0;
  assert.ok(pattern.test(source), message || `source must match ${pattern}`);
}

function sourceOmits(source, pattern, message) {
  pattern.lastIndex = 0;
  assert.equal(pattern.test(source), false, message || `source must not match ${pattern}`);
}

function scriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
    .map((match) => match[1]);
}

function scriptFile(source) {
  return String(source || '').replace(/^\.\//, '').replace(/^\//, '').split('?')[0];
}

function actionSection(source, action) {
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marker = new RegExp(`(?:if|else\\s+if)\\s*\\(action\\s*===\\s*['"]${escaped}['"]\\)`);
  const found = marker.exec(source);
  assert.ok(found, `missing click action: ${action}`);
  const start = found.index;
  const rest = source.slice(start + found[0].length);
  const next = /\n\s*(?:if|else\s+if)\s*\(action\s*===\s*['"]/.exec(rest);
  return source.slice(start, next ? start + found[0].length + next.index : source.length);
}

const SCRIPT_SOURCES = scriptSources(INDEX);
const COPY_SCRIPTS = GUIDE_COPY_FILES.map((file) => (
  SCRIPT_SOURCES.find((source) => scriptFile(source) === file) || ''
));
const COPY_FILE = GUIDE_COPY_FILES[0];
const COPY = COPY_FILE ? readOptional(path.join('public', COPY_FILE)) : '';

test('Guide model, all locale copies, presenter and surface load before app.js', () => {
  const model = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-v3.js');
  const presenter = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-presenter-v1.js');
  const surface = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-surface-v1.js');
  const app = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'app.js');

  assert.ok(model >= 0, 'index.html must load public/guide-v3.js');
  assert.ok(presenter >= 0, 'index.html must load public/guide-presenter-v1.js');
  assert.ok(surface >= 0, 'index.html must load public/guide-surface-v1.js');
  assert.ok(app >= 0, 'index.html must load app.js');
  let previous = model;
  COPY_SCRIPTS.forEach((source, index) => {
    const file = GUIDE_COPY_FILES[index];
    assert.ok(source, `index.html must load public/${file}`);
    assert.ok(readOptional(path.join('public', file)), `Guide copy script is referenced but missing: public/${file}`);
    const position = SCRIPT_SOURCES.indexOf(source);
    assert.ok(previous < position, `${file} must follow the model and prior locale copy`);
    assert.ok(position < presenter, `${file} must load before the presenter`);
    previous = position;
  });
  assert.ok(presenter < surface, 'Guide presenter must load before the DOM surface');
  assert.ok(surface < app, 'Guide surface must be available before app.js starts');
});

test('the approved RU review is an exact mirror of centralized runtime copy', () => {
  const mirror = COPY_REVIEW.match(/## Точное зеркало ключей[\s\S]*?```json\s*([\s\S]*?)\s*```/);
  assert.ok(mirror, 'missing machine-readable RU copy mirror');
  const reviewCopy = JSON.parse(mirror[1]);
  assert.equal(Object.keys(reviewCopy).length, Object.keys(COPY_RU.COPY).length);
  assert.deepEqual(reviewCopy, COPY_RU.COPY);
  assert.match(COPY_REVIEW, /runtime утверждён 2026-08-26/);
  assert.match(COPY_REVIEW, /RUNTIME_APPROVED` поднят намеренно/);
});

test('v195 offline shell pins all Guide runtime scripts and locale copies', () => {
  sourceMatches(SW, /const CACHE = 'satoru-v228';/);
  for (const file of ['guide-v3.js', ...GUIDE_COPY_FILES, 'guide-presenter-v1.js', 'guide-surface-v1.js']) {
    assert.ok(file, 'Guide runtime file must be discoverable before checking SHELL');
    assert.ok(SW.includes(`'${file}'`) || SW.includes(`"${file}"`), `${file} must be pinned in SHELL`);
  }
});

test('first-run ownership is account state, never the old device-global flag', () => {
  const init = between(APP, 'async function initApp()', '\nfunction publishLeaderboard');
  sourceOmits(init, /liferpg_seen_guide/);
  sourceOmits(init, /localStorage\.(?:getItem|setItem)\([^)]*guide/i);
  sourceMatches(init, /guideV3|GuideV3/, 'initApp must hand first-run eligibility to Guide v3');
});

test('legacy tutorialAdvance is not a pre-action hook for Guide v3', () => {
  const calls = APP.match(/\btutorialAdvance\s*\(/g) || [];
  assert.ok(calls.length <= 1, 'tutorialAdvance may remain as an inert legacy declaration, but must not be called from onClick');
  const onClick = between(APP, 'async function onClick(e)', '\nasync function onWkDrop');
  sourceOmits(onClick, /tutorialAdvance\s*\(/);
  sourceOmits(GUIDE, /tutorialAdvance/);
});

test('First Journey uses stable semantic targets instead of layout selectors', () => {
  const targets = [
    'first-task-create',
    'first-task-select',
    'first-task-focus',
    'first-task-complete',
    'first-task-reward',
    'first-shadow-contact',
    'guide-library',
  ];
  for (const target of targets) {
    assert.ok(APP.includes(`data-guide-target="${target}"`), `missing stable Guide target: ${target}`);
  }
  sourceMatches(APP, /CSS\.escape\([^)]*(?:task|selected)/, 'task-specific Guide selectors must escape their persisted id');
});

test('Habits chapter is data-triggered and points only at stable real UI targets', () => {
  assert.ok(APP.includes("habits: 'habits-nav'"), 'responsive navigation must expose the stable Habits Guide target');
  for (const target of ['habit-create', 'habit-title', 'habit-schedule', 'habit-two-minute', 'habit-created']) {
    assert.ok(APP.includes(`data-guide-target="${target}"`), `missing stable Habits Guide target: ${target}`);
  }

  const context = between(APP, 'function guideV3Context(', '\nfunction guideV3AvailableChapters');
  sourceMatches(context, /State\.tasks[\s\S]{0,180}filter\(\s*\(?task\)?\s*=>[\s\S]{0,80}task\.done/,
    'Habits eligibility must use completed account tasks, not the current view');
  sourceMatches(context, /new Set\([\s\S]{0,180}dayOf\(/,
    'the second-active-day trigger must use local completion days');
  sourceMatches(context, /completedTasks:\s*completed\.length[\s\S]{0,100}\bactiveDays\b/,
    'both approved Habits triggers must reach the pure registry');

  const maybeStart = between(APP, 'function guideV3MaybeStart()', '\nasync function guideV3Snooze');
  sourceMatches(maybeStart, /nextContextual\(state,\s*guideV3Context\(\),\s*releasedRegistry\)/,
    'automatic contextual selection must stay registry-driven');
  sourceMatches(maybeStart, /guideV3ContextRuntimeAllowed\(item\.chapter\)/,
    'an unreleased contextual chapter must fail closed');
  sourceMatches(maybeStart, /guideV3ChapterDataReady\(item\.chapter\)/,
    'the Guide must not invite a write while its feature data is in recovery');

  const open = between(APP, 'async function guideV3OpenContextChapter()', '\nasync function guideV3OpenHabitsChapter');
  sourceMatches(open, /state\.currentStep\s*!==\s*['"]intro['"]/,
    'only the authored intro may enter the real form');
  sourceMatches(open, /guideV3Commit\([\s\S]{0,120}type:\s*['"]guide:context-next['"]/, 'the CTA must advance the pure three-step state machine');
  sourceMatches(open, /habits:\s*['"]habits['"][\s\S]{0,500}discover:\s*discovery/, 'route discovery and the context transition must share one queued settings snapshot');
  sourceOmits(open, /markDiscovered\s*\(/,
    'the contextual CTA cannot launch a competing fire-and-forget settings write');
  sourceMatches(open, /chapter\s*===\s*model\.HABITS_CHAPTER[\s\S]{0,500}State\.habitsTab\s*=\s*['"]build['"][\s\S]{0,800}State\.view\s*=\s*guideV3RouteForState/,
    'entry must reveal the existing Habits build surface');
  const onClick = between(APP, 'async function onClick(e)', '\nasync function onWkDrop');
  sourceMatches(onClick, /s\.id\s*===\s*['"]habits['"][\s\S]{0,500}await\s+guideV3OpenHabitsChapter\(\)/,
    'clicking the spotlighted real navigation target must behave like the bubble CTA');
  const habitsNavAt = onClick.indexOf("s.id === 'habits'");
  const flushAt = onClick.indexOf('await flushSettingsForm()', habitsNavAt);
  const openAt = onClick.indexOf('await guideV3OpenHabitsChapter()', habitsNavAt);
  assert.ok(habitsNavAt >= 0 && flushAt > habitsNavAt && openAt > flushAt,
    'pending Settings and Habits edits must flush before Guide navigation replaces the form');

  const selector = between(APP, 'function guideV3TargetSelector', '\nfunction guideV3RevealTarget');
  sourceMatches(selector, /vm\.step\s*===\s*['"]complete['"][\s\S]{0,100}vm\.habitId[\s\S]{0,180}CSS\.escape\(String\(vm\.habitId\)\)/,
    'the receipt must target the exact persisted habit id safely');
});

test('Habits form and Guide completion share one rollback-safe account transaction', () => {
  const submit = between(APP, "if (f.id === 'add-habit-v126')", "\n  if (f.id === 'ai-keys')");
  sourceMatches(submit, /selectedId\s*!==\s*['"]new['"][\s\S]{0,160}source\.find\(/,
    'the contextual form must update a selected real habit instead of always duplicating it');
  sourceMatches(submit, /selectedId\s*=\s*guideCompose\s*\?[^:]+:\s*['"]new['"]/,
    'a stale Guide-only selector must never address an existing habit after the chapter closes');
  sourceMatches(submit, /data(?:set)?\.guideCompose|dataset\.guideCompose/,
    'the submit path must recognize a stale Guide-rendered draft');
  sourceMatches(submit, /State\.habits[\s\S]{0,140}\.some\([\s\S]{0,140}String\(item\.id\)\s*===\s*draftId/,
    'a stale draft id that collides with a real habit must be replaced before create');
  sourceOmits(submit, /toLocaleLowerCase|normalized\s*=/,
    'explicit Create new must not silently deduplicate into an older habit by title');
  sourceMatches(submit, /\.\.\.\(original\?\.atomic\s*\|\|\s*\{\}\)[\s\S]{0,80}\btwoMin\b/,
    'updating the two-minute version must preserve identity/cue and other atomic fields');
  const capture = between(APP, 'function captureSettingsForm()', '\n// Один сериализованный autosave');
  sourceMatches(capture, /const old\s*=[^;]+\|\|\s*\{\}[\s\S]{0,400}\.\.\.old[\s\S]{0,900}archived:\s*!!old\.archived/,
    'ordinary Settings autosave must preserve Guide atomic metadata and paused/archived state');
  sourceMatches(submit, /original\?\.id[\s\S]{0,120}\bdraftId\b|\bdraftId\b[\s\S]{0,120}original\?\.id/,
    'a failed retry must reuse one stable habit id');
  sourceMatches(submit, /guideV3Exclusive\(persistHabit\)/,
    'the feature transaction must hold the same queue as prompt, Skip, Later and voice writes');
  const jobAt = submit.indexOf('const persistHabit');
  const liveStepAt = submit.indexOf("guideV3HabitsStep('compose')", jobAt);
  const freshStateAt = submit.indexOf('const guide = guideV3State()', liveStepAt);
  const completeAt = submit.indexOf("type: 'guide:context-complete'", freshStateAt);
  assert.ok(jobAt >= 0 && liveStepAt > jobAt && freshStateAt > liveStepAt && completeAt > freshStateAt,
    'the exclusive job must re-read the live compose state before reducing completion');
  sourceMatches(submit,
    /GuideV3\?*\.reduce\([^;]*type:\s*['"]guide:context-complete['"][\s\S]{0,220}completion:\s*['"]habit-persisted['"][\s\S]{0,120}persisted:\s*true[\s\S]{0,120}itemId:\s*habit\.id/,
    'the candidate Guide state must name the exact habit included in the same write');
  sourceMatches(submit, /nextSettings\.guideV3\s*=\s*guideResult\.state/,
    'the accepted reducer state must be placed in the candidate settings snapshot');
  sourceMatches(submit, /\{\s*habits:\s*source,\s*settings:\s*nextSettings\s*\}/,
    'Habits and Guide state must be one account-owned payload');
  sourceMatches(submit, /await\s+habitDataCommit\(payload,\s*\(\)\s*=>/,
    'the combined payload must use the rollback-safe Habits endpoint');
  sourceMatches(submit, /habitDataCommit\(payload,[\s\S]{0,500}State\.settings\.guideV3\s*=\s*guideResult\.state[\s\S]{0,220}return\s+true/,
    'the exact persisted Guide state must become live before the shared slot lock is released');
  sourceOmits(submit, /guideV3Commit\s*\(/,
    'a second settings write would allow the habit and Guide receipt to diverge');

  const saveAt = submit.indexOf('await habitDataCommit(payload,');
  const habitApplyAt = submit.indexOf('State.habits = source');
  const settingsApplyAt = submit.indexOf('State.settings.guideV3 = guideResult.state');
  const firstRenderAt = submit.indexOf('render()');
  assert.ok(saveAt >= 0 && habitApplyAt > saveAt && settingsApplyAt > saveAt,
    'client state must not claim success before the server confirms both files');
  assert.ok(firstRenderAt > habitApplyAt && firstRenderAt > settingsApplyAt,
    'render-before-save or render-on-failure would destroy the live retry draft');
  sourceMatches(submit, /failLiveForm[\s\S]{0,260}disabled\s*=\s*false[\s\S]{0,260}focusPathChoiceTarget\(f\.title\)/,
    'failure must keep the form mounted, re-enable it and return focus to the draft');
  sourceMatches(submit, /if\s*\(\s*!saved\s*\)\s*return\s+failLiveForm\(\)/,
    'an unconfirmed atomic response must take the live retry path');
  sourceMatches(submit, /if\s*\(guideResult\.metric\)\s*track\(guideResult\.metric\)/,
    'success telemetry must follow the combined write');

  const serverCommit = between(SERVER, 'const HABIT_COMMIT_TYPES', '\nfunction goalRecordValid');
  sourceMatches(serverCommit, /habits:\s*['"]array['"][\s\S]{0,100}settings:\s*['"]object['"]/,
    'the endpoint must explicitly allow the two files in one transaction');
  sourceMatches(serverCommit,
    /snapshots[\s\S]{0,300}for\s*\(const name of names\)[\s\S]{0,360}catch[\s\S]{0,220}restoreSnapshot/,
    'a partial disk write must restore every previously written file');
});

test('Guide and account writes are ordered, fenced and leave no stale Habits form', () => {
  const exclusive = between(APP, 'let _guideV3WriteQueue', '\nlet _guideV3SurfaceKey');
  sourceMatches(exclusive, /_guideV3WriteQueue\.then\(run,\s*run\)/,
    'every Guide event must enter one ordered queue');
  sourceMatches(exclusive, /accountId[\s\S]{0,180}_guideV3WriteEpoch/,
    'queued Guide work must be fenced to its originating account and epoch');

  const store = between(APP, 'const Store = {', '\n// Attention keeps one checked envelope');
  sourceMatches(store, /_writes:\s*Object\.create\(null\)/,
    'Store must retain one in-flight promise per account slot');
  const mutexAt = store.indexOf('runExclusive(names, operation)');
  const jobAt = store.indexOf('const job = previous.then', mutexAt);
  const reserveAt = store.indexOf('this._writes[name] = tracked', jobAt);
  assert.ok(mutexAt >= 0 && jobAt > mutexAt && reserveAt > jobAt,
    'the shared mutex must reserve every affected account slot before awaiting');
  const putAt = store.indexOf('async _put(name, obj');
  const pairedAt = store.indexOf("const pairedSlot = name === 'settings' || name === 'tasks'", putAt);
  const queuedAt = store.indexOf("return this.runExclusive(pairedSlot ? ['settings', 'tasks'] : [name]", pairedAt);
  const liveValueAt = store.indexOf('State[liveSlot]', queuedAt);
  const stringifyAt = store.indexOf('JSON.stringify(value)', liveValueAt);
  assert.ok(putAt >= 0 && pairedAt > putAt && queuedAt > pairedAt && liveValueAt > queuedAt && stringifyAt > liveValueAt,
    'a queued live-state PUT must reserve the paired graph and take its snapshot after earlier atomic work finishes');
  sourceMatches(store, /const base = pairedSlot \? commitmentWriteBase\(\) : null[\s\S]{0,1600}\/api\/commitments\/commit/,
    'protected queued writes must carry their persisted CAS base to the commitment endpoint');
  const habitCommit = between(APP, 'async function habitDataCommit(data, applyCommitted = null)', '\nasync function reloadHabitData');
  sourceMatches(habitCommit,
    /const touchesGraph = names\.some\(\(name\) => name === 'settings' \|\| name === 'tasks'\)[\s\S]{0,220}Store\.runExclusive\(touchesGraph \? \[\.\.\.names, 'settings', 'tasks'\] : names/,
    'a Habits transaction that touches the commitment graph must reserve settings and tasks in the same shared mutex');
  sourceMatches(habitCommit, /const payload = dedicatedCommitPayload\(data\)[\s\S]{0,260}\/api\/habits\/commit/,
    'the Habits endpoint must receive the based graph envelope');

  const skip = actionSection(APP, 'guide-skip');
  sourceMatches(skip, /_guideV3HabitCandidateId\s*=\s*null[\s\S]{0,120}_guideV3HabitDraftId\s*=\s*['"]/,
    'Skip must clear the Guide-only candidate and draft');
  sourceMatches(skip, /guideV3Close\(\{\s*restoreFocus:\s*false\s*\}\)[\s\S]{0,160}habit-create\s*>\s*summary[\s\S]{0,80}render\(\)/,
    'Skip from compose must remount an ordinary form and focus its interactive summary');

  const disable = actionSection(APP, 'guide-disable');
  sourceMatches(disable, /_guideV3HabitDraftId\s*=\s*['"][\s\S]{0,240}habit-create\s*>\s*summary[\s\S]{0,80}render\(\)/,
    'global Disable from Habits must also remove stale Guide-only form semantics');

  const snooze = between(APP, 'async function guideV3Snooze()', '\nasync function guideV3AbandonReplay');
  sourceMatches(snooze, /guideV3HabitsStep\(['"]compose['"]\)[\s\S]{0,500}_guideV3HabitDraftId\s*=\s*['"][\s\S]{0,220}render\(\)/,
    'Later from compose must remount the ordinary form instead of leaving an unexplained edit surface');
  const habitsStep = between(APP, 'function guideV3HabitsStep(step)', '\nfunction guideV3HabitCandidates');
  sourceMatches(habitsStep, /snoozedUntil[\s\S]{0,160}_guideV3ForceOpen[\s\S]{0,220}!snoozed/,
    'a snoozed contextual chapter cannot own the form until explicit Resume');
});

test('Habits Guide route, focus and account reset do not leak across modal or profile boundaries', () => {
  const paint = between(APP, 'function guideV3Paint()', '\nfunction guideV3MaybeStart');
  const route = between(APP, 'function guideV3RouteForState', '\nasync function guideV3OpenContextChapter');
  sourceMatches(route, /currentStep\s*===\s*['"]intro['"][\s\S]{0,240}habits:\s*['"]habits['"]/,
    'intro belongs to Today while compose/complete belong to the Habits route');
  sourceMatches(paint, /\.modal-overlay, #mobile-nav-sheet/,
    'the non-modal Guide must yield while a modal or mobile sheet owns interaction');
  sourceMatches(paint, /focusInitial:[^\n]*HABITS_CHAPTER[^\n]*compose/,
    'the bubble must not steal focus from the live contextual form');
  sourceMatches(paint, /returnTarget\?\.matches\(['"]details['"]\)[\s\S]{0,100}querySelector\(['"]summary['"]\)/,
    'closing a bubble must return keyboard focus to the interactive summary, never the details container');
  sourceMatches(paint, /stepChanged[\s\S]{0,180}HABITS_CHAPTER[\s\S]{0,100}complete[\s\S]{0,220}guideV3RevealTarget/,
    'the persisted receipt must be revealed after the asynchronous view commit');

  const clear = between(APP, 'function clearAllData()', '\nfunction handleAccountSessionExpired');
  for (const field of [
    '_guideV3SessionPrompted', '_guideV3StartBusy', '_guideV3PromptMarkBusy',
    '_guideV3ForceOpen', '_guideV3HabitCandidateId', '_guideV3HabitDraftId',
  ]) {
    assert.ok(clear.includes(field), `account reset must clear ${field}`);
  }
  sourceMatches(clear, /guideV3Close\(\{\s*restoreFocus:\s*false\s*\}\)/,
    'logout/session expiry must remove the old account Guide surface without restoring stale focus');
  sourceMatches(clear, /_guideV3WriteEpoch\s*\+=\s*1[\s\S]{0,80}_guideV3WriteQueue\s*=\s*Promise\.resolve\(\)/,
    'account reset must invalidate queued Guide writes from the old session');
});

test('welcome stays safe while release spotlights the responsive How to play route', () => {
  const selectors = between(APP, 'function guideV3TargetSelector', '\nfunction guideV3RevealTarget');
  sourceMatches(selectors, /vm\.step\s*===\s*['"]release['"][\s\S]{0,120}guide-library/,
    'the authored release line must point at the real Guide library route');
  sourceMatches(selectors, /vm\.step\s*===\s*['"]recognize['"][\s\S]{0,180}first-task-create/,
    'the blank-seed recognition step must still point at the real quick-add form');
  assert.ok((APP.match(/data-guide-target="guide-library"/g) || []).length >= 2,
    'desktop Help and mobile More must share one responsive semantic target');
  sourceMatches(SURFACE, /querySelectorAll\(selector\)[\s\S]{0,900}return width\s*>\s*0\s*&&\s*height\s*>\s*0/,
    'the surface must ignore the hidden responsive duplicate instead of drawing a 0×0 ring');
  sourceMatches(SURFACE, /spotlightLabel[\s\S]{0,1000}aria-describedby/,
    'the localized a11y spotlight label must describe the actual responsive target');
});

test('persisted completion and bond success effects happen only after their durable write succeeds', () => {
  sourceMatches(APP,
    /(?:const|let)\s+saved\s*=\s*activeCommitmentId[\s\S]{0,1200}await\s+commitmentDataCommit[\s\S]{0,1200}:\s*await\s+Store\.saveNow\(['"]tasks['"][\s\S]{0,500}if\s*\(\s*!saved\s*\)[\s\S]{0,1200}type:\s*['"]task:completed['"][\s\S]{0,220}persisted:\s*true/,
    'task:completed(persisted:true) must follow an awaited successful task save');
  const commit = between(APP, 'async function guideV3Commit', '\nlet _guideV3SurfaceKey');
  sourceMatches(commit, /Store\.updateNow\(['"]settings['"],\s*\(current\)\s*=>[\s\S]{0,320}GuideV3\.reduce\(current\.guideV3,\s*event\)/,
    'Guide reducer must derive its persisted result from the latest settings snapshot inside the settings mutex');
  sourceMatches(commit, /Store\.updateNow\(['"]settings['"][\s\S]{0,700}\(\)\s*=>\s*\{[\s\S]{0,260}State\.settings\.guideV3\s*=\s*result\.state/,
    'Guide progress must enter live state before the shared settings mutex is released');
  const store = between(APP, 'const Store = {', '\n// Attention keeps one checked envelope');
  sourceMatches(store, /async updateNow\(name, buildValue, applyCommitted = null\)[\s\S]{0,220}this\._put\(name, buildValue, false, applyCommitted\)/,
    'lazy account updates must enter the same tracked Store slot');
  sourceMatches(store, /const lazy\s*=\s*typeof obj\s*===\s*['"]function['"][\s\S]{0,1600}value\s*=\s*lazy\s*\?\s*await obj\(/,
    'the lazy builder must read live state only after its prior slot writer finishes');
  const callbackAt = store.indexOf('await applyCommitted(value)');
  const successAt = store.indexOf('return true;', callbackAt);
  assert.ok(callbackAt >= 0 && successAt > callbackAt,
    'Store must run a successful write callback before releasing its tracked slot');
  const saveAt = commit.indexOf("await Store.updateNow('settings'");
  const reduceAt = commit.indexOf('GuideV3.reduce(current.guideV3, event)', saveAt);
  const applyAt = commit.indexOf('State.settings.guideV3 = result.state');
  assert.ok(saveAt >= 0 && reduceAt > saveAt && applyAt > reduceAt,
    'Guide state must be built and applied within its queued durable settings update');
  sourceMatches(commit, /if\s*\(\s*!saved\s*\|\|\s*epoch\s*!==\s*_guideV3WriteEpoch[\s\S]{0,260}return\s+false/,
    'a queued write from an expired or switched account must fail closed');
  const contact = between(APP, 'async function guideV3CompleteShadowContact()', '\nasync function guideV3StartFocus');
  sourceMatches(contact,
    /Store\.updateNow\(['"]settings['"][\s\S]{0,700}\.reduce\(current\.guideV3,\s*\{\s*type:\s*['"]guide:bond['"][^}]*persisted:\s*true/,
    'Shadow contact must reduce bond progress from the live settings snapshot');
  sourceMatches(contact, /next\.companion\s*=\s*companion;\s*next\.guideV3\s*=\s*result\.state/,
    'companion and Guide progress must share the same persisted settings value');
  sourceMatches(contact, /State\.settings\.guideV3\s*=\s*result\.state;[\s\S]{0,100}State\.settings\.companion\s*=\s*committed\.companion/,
    'both committed records must enter live state in the pre-release callback');
  const bondSaveAt = contact.indexOf("await Store.updateNow('settings'");
  const bondMetricAt = contact.indexOf('if (result.metric) track(result.metric)', bondSaveAt);
  assert.ok(bondSaveAt >= 0 && bondMetricAt > bondSaveAt,
    'bond telemetry and other success effects must follow the successful settings write');
});

test('live Shadow contact persists one real bond mutation atomically and replay stays inert', () => {
  const contact = between(APP, 'async function guideV3CompleteShadowContact()', '\nasync function guideV3StartFocus');
  sourceMatches(contact, /State\.settings\.guideV3[\s\S]{0,240}State\.settings\.companion/,
    'Shadow contact must snapshot only the Guide and companion records it can change');
  sourceMatches(contact, /companion\.bond\s*=\s*Math\.max\([^;]+\)\s*\+\s*1/,
    'the first live Shadow contact must add exactly one bond point');
  sourceMatches(contact, /\.pet\s*=\s*(?:todayStr\(\)|[^;]*today)/,
    'the live contact must persist the companion pet/contact day');
  sourceMatches(contact, /\.lastSeen\s*=\s*(?:todayStr\(\)|[^;]*today)/,
    'the live contact must persist companion lastSeen');
  assert.equal((contact.match(/await\s+Store\.updateNow\(['"]settings['"]/g) || []).length, 1,
    'companion contact and Guide progress must share exactly one awaited settings write');
  sourceOmits(contact, /priorGuide|priorCompanion|ensureCompanion\(\)/,
    'a failed contact write must need no rollback because live records stay untouched until commit');
  sourceOmits(contact, /guideV3Commit\s*\(/,
    'the atomic contact helper must not split its state across a second Guide transaction');

  const bond = actionSection(APP, 'guide-shadow-contact');
  sourceMatches(bond, /await\s+guideV3CompleteShadowContact\s*\(\s*\)/,
    'the live contact handler must await the atomic helper');
  sourceOmits(bond, /ensureCompanion|\.bond\s*=|\.pet\s*=|\.lastSeen\s*=|Store\.(?:saveNow|updateNow)/,
    'the handler cannot perform a second relationship mutation or persistence write');

  const replay = actionSection(APP, 'guide-replay');
  sourceOmits(replay, /ensureCompanion|\.bond\b|\.pet\s*=|\.lastSeen\s*=/,
    'starting or advancing replay must never mutate companion relationship state');
});

test('finishing the selected task can bypass the optional timer without bypassing persistence', () => {
  const completion = between(APP, 'async function completeTask(', '\nfunction taskCompletionFocusPlan');
  assert.match(completion, /\['start', 'wait'\]\.includes\(guide\.currentStep\)/);
  assert.match(completion, /if \(guide\.currentStep === 'start'\) await reconcileGuideV3AfterTaskLoad\(\)/);
  const reconcile = between(APP, 'async function reconcileGuideV3AfterTaskLoad()', '\nfunction guideV3Copy');
  assert.match(reconcile, /await Store\.updateNow\('settings', \(current\)/);
  assert.match(reconcile, /GuideV3\.reconcile\(current\.guideV3/);
  assert.match(reconcile, /State\.settings\.guideV3 = result\.state/);
  assert.doesNotMatch(reconcile, /prior\s*=|State\.settings\.guideV3\s*=\s*result\.state[\s\S]*await Store/);
});

test('every Guide bubble keeps a transcript and explicit Piper controls', () => {
  sourceMatches(SURFACE, /element\(['"]p['"],\s*['"]guide-surface-v1__transcript['"]\)/i);
  sourceMatches(SURFACE, /transcript\.setAttribute\(['"]role['"],\s*['"]status['"]\)/i);
  sourceMatches(APP, /speaker:\s*['"]guide-voice['"]/i, 'presenter speaker action must map to the Guide voice control');
  sourceMatches(APP, /ariaLabel:\s*speaking[\s\S]{0,180}pressed:/i, 'Guide voice control needs label and pressed state');
  sourceMatches(APP, /(?:ShadowVoiceV2\.speak|ttsSpeak)\s*\(/, 'Guide voice must call the Piper bridge');
  sourceMatches(APP, /(?:ShadowVoiceV2\.stop|ttsStop)\s*\(/, 'step/close transitions must stop Guide speech');
  sourceMatches(APP, /browserFallback:\s*false/, 'Guide cannot silently fall back to the system voice');
});

test('mastery spotlights the account level/Form target, not the quest payout', () => {
  assert.ok(APP.includes('data-guide-target="first-level-form"'),
    'the real level/Form control needs a stable first-level-form Guide target');
  const selectors = between(APP, 'function guideV3TargetSelector', '\nfunction guideV3SurfaceAction');
  sourceMatches(selectors, /vm\.step\s*===\s*['"]victory['"][\s\S]{0,180}first-task-reward/,
    'victory should continue to point at the earned quest payout');
  sourceMatches(selectors, /vm\.step\s*===\s*['"]mastery['"][\s\S]{0,180}first-level-form/,
    'mastery must move the spotlight to persistent account level/Form');
  sourceOmits(selectors, /\[['"]victory['"],\s*['"]mastery['"]\][\s\S]{0,180}first-task-reward/,
    'victory and mastery cannot share the quest-reward target');
});

test('cancelling the Guide Pomodoro picker restores the active Guide step', () => {
  const cancel = actionSection(APP, 'focus-duration-close');
  sourceMatches(cancel, /(?:guideV3Paint|render)\s*\(/,
    'closing the duration picker must repaint the still-active start step');
});

test('closing More or an account modal restores the active non-modal Guide surface', () => {
  const helper = between(APP, 'function repaintGuideV3AfterBlockingSurface', '\nfunction closeAccountDialog');
  sourceMatches(helper, /requestAnimationFrame[\s\S]{0,260}guideV3Paint\s*\(/,
    'Guide restoration must wait until the blocking surface leaves the DOM');
  sourceMatches(helper, /\.modal-overlay, #mobile-nav-sheet/,
    'restoration must not paint underneath another modal surface');
  const closeDialog = between(APP, 'function closeAccountDialog', '\nfunction mountAccountDialog');
  sourceMatches(closeDialog, /overlay\.remove\(\)[\s\S]{0,320}repaintGuideV3AfterBlockingSurface\s*\(/,
    'account dialogs must restore an active Guide after disposal');
  const closeMore = between(APP, 'function closeMobileNavSheet', '\nfunction showMobileNavSheet');
  sourceMatches(closeMore, /overlay\.remove\(\)[\s\S]{0,520}repaintGuideV3AfterBlockingSurface\s*\(/,
    'the More sheet must restore an active Guide after its close animation');
});

test('calendar task dialog yields the Guide surface and restores it after closing', () => {
  sourceMatches(APP, /function openCalendarTaskEditor[\s\S]{0,4200}document\.body\.appendChild\(overlay\);\s*guideV3Close\(\{ restoreFocus: false \}\)/);
  sourceMatches(APP, /function closeCalendarTaskEditor[\s\S]{0,900}repaintGuideV3AfterBlockingSurface\(\)/);
});

test('every blocking modal yields the non-modal Guide surface', () => {
  sourceMatches(APP, /function observeGuideV3BlockingSurfaces\(\)[\s\S]{0,1500}querySelector\(['"]\.modal-overlay, #mobile-nav-sheet['"]\)[\s\S]{0,700}guideV3Close\(\{ restoreFocus: false \}\)[\s\S]{0,700}repaintGuideV3AfterBlockingSurface\(\)/);
  sourceMatches(APP, /async function init\(\)[\s\S]{0,250}observeGuideV3BlockingSurfaces\(\)/);
});

test('Escape abandons replay but snoozes a live chapter', () => {
  const paint = between(APP, 'function guideV3Paint()', '\nfunction guideV3MaybeStart');
  sourceMatches(paint,
    /onEscape[\s\S]{0,260}if\s*\(\s*vm\.replay\s*\)\s*guideV3AbandonReplay\(vm\.chapter\)[\s\S]{0,100}else\s+guideV3Snooze\(\)/,
    'Escape must abandon replay while reserving snooze for the live journey');
  const abandon = between(APP, 'async function guideV3AbandonReplay(chapter)', '\nasync function guideV3Speak');
  sourceMatches(abandon,
    /guideV3Commit\(\{\s*type:\s*['"]guide:skip['"][\s\S]{0,120}\bchapter\b/,
    'abandoning replay must dispatch the semantic guide:skip event for that chapter');
  sourceOmits(abandon, /guideV3Snooze|guide:snooze/,
    'the replay abandonment helper must never enter the live snooze path');
});

test('Context pack v205 explicitly releases exact Guide copy and chapter versions for RU/EN/DE/UK/ES', () => {
  assert.equal(COPY_RU.RUNTIME_APPROVED, true,
    'the owner-approved RU Guide must be available in normal runtime');
  assert.equal(COPY_RU.STATUS, 'runtime-approved');
  const runtimeAllowed = between(APP, 'const GUIDE_V3_COPY_RELEASES', '\nfunction feedbackPanelHTML');
  for (const [locale, globalName, version, status] of [
    ['ru', 'GuideV3CopyRu', '1.4.0', 'runtime-approved'],
    ['en', 'GuideV3CopyEn', '0.5.0', 'translated'],
    ['de', 'GuideV3CopyDe', '0.5.0', 'translated'],
    ['uk', 'GuideV3CopyUk', '0.5.0', 'translated'],
    ['es', 'GuideV3CopyEs', '0.5.0', 'translated'],
  ]) {
    const exactVersion = version.replace(/\./g, '\\.');
    sourceMatches(runtimeAllowed, new RegExp(`${locale}:[\\s\\S]{0,160}${globalName}[\\s\\S]{0,100}${exactVersion}[\\s\\S]{0,100}${status}[\\s\\S]{0,80}released:\\s*true`),
      `${locale} needs an explicit exact-version Habits release entry`);
    const mod = require(path.join(ROOT, 'public', `guide-v3-copy-${locale}.js`));
    assert.equal(mod.VERSION, version, `${locale} module and app manifest must be the same release`);
    assert.equal(mod.STATUS, status);
    assert.equal(mod.CONTEXTUAL_STATUS.habits, 'runtime-approved',
      `${locale} cannot enter Habits until that chapter is explicitly approved`);
    assert.equal(mod.CONTEXTUAL_STATUS.systemTheme, 'runtime-approved',
      `${locale} cannot enter System Theme until that chapter is explicitly approved`);
  }
  sourceMatches(runtimeAllowed,
    /function guideV3ReleasedChapter\(completion, registryVersion = 2\)[\s\S]{0,180}registryVersion[\s\S]{0,120}completion[\s\S]{0,120}released:\s*true[\s\S]{0,300}habits:\s*guideV3ReleasedChapter\(['"]habit-persisted['"]\)/,
    'the chapter contract must default to registry v2 while allowing a versioned chapter adapter');
  sourceMatches(runtimeAllowed, /tree:\s*guideV3ReleasedChapter\(['"]tree-seen['"],\s*3\)/,
    'the Tree v4 guide adapter must pin registry v3 explicitly');
  for (const [locale, version] of [['ru', '1.4.0'], ['en', '0.5.0'], ['de', '0.5.0'], ['uk', '0.5.0'], ['es', '0.5.0']]) {
    sourceMatches(runtimeAllowed, new RegExp(`GUIDE_V3_CONTEXT_LOCALES[\\s\\S]{0,220}${locale}:\\s*['"]${version.replace(/\./g, '\\.')}['"]`),
      `Habits context release must pin ${locale} ${version}`);
  }
  sourceMatches(runtimeAllowed,
    /entry\.version\s*===\s*release\.registryVersion[\s\S]{0,120}entry\.completion\s*===\s*release\.completion[\s\S]{0,180}CONTEXTUAL_STATUS\?\.\[chapter\]\s*===\s*['"]runtime-approved['"]/,
    'runtime must fail closed when model, completion or locale chapter approval drifts');
  sourceMatches(runtimeAllowed, /copy\.LOCALE\s*===\s*code/,
    'a mislabeled locale module must fail closed');
  sourceMatches(runtimeAllowed, /copy\.VERSION\s*===\s*release\.version[\s\S]{0,140}copy\.STATUS\s*===\s*release\.status/,
    'a stale or draft locale module must fail closed');
  sourceMatches(runtimeAllowed, /RUNTIME_APPROVED\s*===\s*true/,
    'normal Guide runtime eligibility must retain the approved source gate');
  const previewGate = between(APP, 'function guideV3ReviewPreviewRequested()', '\nconst GUIDE_V3_COPY_RELEASES');
  sourceMatches(previewGate, /localhost[\s\S]{0,220}State\.me\?\.isAdmin\s*===\s*true/,
    'guidePreview cannot be a public production approval bypass');
  const maybeStart = between(APP, 'function guideV3MaybeStart()', '\nasync function guideV3Snooze');
  sourceMatches(maybeStart, /guideV3RuntimeAllowed\(\)/,
    'automatic First Journey start must pass the centralized runtime/copy gate');

  const library = between(APP, 'function showGuide()', '\n// ============================================================\n//  Вид «Награды»');
  sourceOmits(library, /lang\(\)\s*!==\s*['"]ru['"]/,
    'the localized library must not retain the old RU-only branch');
  sourceMatches(library, /const copy = guideV3CopyModule\(\)[\s\S]{0,400}libraryCards\([\s\S]{0,300}, copy\)/,
    'the library presenter must receive the active locale copy');
  const paint = between(APP, 'function guideV3Paint()', '\nfunction guideV3MaybeStart');
  sourceMatches(paint, /const copy = guideV3CopyModule\(\)[\s\S]{0,240}presenter\.present\([\s\S]{0,240}\bcopy\b/,
    'the active First Journey must receive the current locale copy');
  const speak = between(APP, 'async function guideV3Speak', '\nasync function guideV3CompleteShadowContact');
  sourceMatches(speak, /copy:\s*guideV3CopyModule\(\)/,
    'Piper must speak the same locale-specific transcript shown on screen');

  for (const file of ['guide-v3.js', ...GUIDE_COPY_FILES, 'guide-presenter-v1.js']) {
    const source = SCRIPT_SOURCES.find((item) => scriptFile(item) === file);
    assert.ok(source, `${file} must load in index.html`);
    assert.match(source, /\?v=[^"']*v205(?:-|$)/, `${file} needs a v205 cache-busting pin`);
  }
  const appSource = SCRIPT_SOURCES.find((item) => scriptFile(item) === 'app.js');
  assert.ok(appSource, 'app.js must load in index.html');
  assert.match(appSource, /\?v=[^"']*v215(?:-|$)/, 'the current app shell needs the v215 cache-busting pin');
  sourceMatches(INDEX, /styles\.css\?v=[^"']*v215(?:-|["'])/,
    'the current application CSS needs the v215 cache-busting pin');
});

test('feedback remains reachable even when the localized Guide is unavailable', () => {
  const panel = between(APP, 'function feedbackPanelHTML()', '\nfunction showGuideUnavailable');
  sourceMatches(panel, /id="feedback-form"/,
    'the durable feedback form must have one shared renderer');
  for (const key of [
    'Нашёл баг или есть идея?', 'Баг', 'Идея', 'Другое',
    'Опиши, что случилось или что предлагаешь…', 'Прикрепить фото/видео',
    'Отправить', 'Смотреть все репорты (админ)',
  ]) {
    assert.ok(panel.includes(`t('${key}')`), `feedback copy must pass through locale routing: ${key}`);
  }
  const unavailable = between(APP, 'function showGuideUnavailable()', '\n\/\/ ── Вложения');
  sourceMatches(unavailable, /feedbackPanelHTML\(\)/,
    'a missing Guide translation must never hide bug and idea reporting');
  const library = between(APP, 'function showGuide()', '\n\/\/ ============================================================\n\/\/  Вид «Награды»');
  sourceMatches(library, /feedbackPanelHTML\(\)/,
    'the full Guide library must reuse the same feedback panel');
});

test('the post-contact bond acknowledgement is surfaced before release', () => {
  sourceMatches(APP, /guideV3Copy\(\s*['"]first\.bond\.complete['"]\s*\)/,
    'the authored “first.bond.complete” line must be shown after successful contact');
});

test('a disabled Guide can be re-enabled from its library', () => {
  assert.equal(COPY_RU.has('system.action.enable_prompts'), true,
    'the re-enable control needs centralized reviewable copy');
  const library = between(APP, 'function showGuide()', '\n// ============================================================\n//  Вид «Награды»');
  sourceMatches(library, /state\.enabled[\s\S]{0,500}guide-disable[\s\S]{0,500}guide-enable/,
    'Guide Library must render an explicit enable action when prompts are disabled');
  const enable = actionSection(APP, 'guide-enable');
  sourceMatches(enable, /guideV3Commit\(\{\s*type:\s*['"]guide:enable['"]/,
    'the library enable action must persist guide:enable through the normal transaction');
});

test('voice activation repaints and gives Piper the mounted Stop control', () => {
  const speak = between(APP, 'async function guideV3Speak', '\nasync function guideV3StartFocus');
  const activeAt = speak.indexOf('State._guideV3VoiceActive = true');
  const repaintAt = speak.indexOf('guideV3Paint()', activeAt);
  const mountedAt = speak.indexOf('querySelector', repaintAt);
  const piperAt = speak.indexOf('ShadowVoiceV2.speak', mountedAt);
  assert.ok(activeAt >= 0 && repaintAt > activeAt,
    'voice start must repaint after setting _guideV3VoiceActive');
  assert.ok(mountedAt > repaintAt && piperAt > mountedAt,
    'Piper must receive the newly mounted guide-voice button, not a detached consent-era node');
  sourceMatches(speak.slice(mountedAt, piperAt), /guide-voice/,
    'the mounted control lookup must specifically resolve the Guide voice action');
});

test('bond has a keyboard focus route, expanded contact zone and centralized visible copy', () => {
  const paint = between(APP, 'function guideV3Paint()', '\nfunction guideV3MaybeStart');
  const surfaceFocus = /focusTargetSelector/.test(paint)
    && /focusTargetSelector[\s\S]{0,700}(?:querySelector|resolveTarget)[\s\S]{0,700}\.focus\s*\(/.test(SURFACE);
  const directFocus = /first-shadow-contact[\s\S]{0,500}\.focus\s*\(/.test(APP);
  const delegatedFocus = /guideV3RevealTarget\([^\n]*first-shadow-contact[^\n]*focus:\s*true/.test(paint)
    && /function\s+guideV3RevealTarget[\s\S]{0,700}if\s*\(focus\)[\s\S]{0,180}\.focus\s*\(/.test(APP);
  assert.ok(surfaceFocus || directFocus || delegatedFocus,
    'entering bond must focus the semantic Shadow contact, not the Later button');
  sourceMatches(paint,
    /guideV3RevealTarget\([^\n]*first-shadow-contact[^\n]*forceScroll:\s*true[^\n]*block:\s*['"]end['"]/,
    'bond must place the enlarged contact above the persistent mobile navigation');

  const contactRule = CSS.match(/\.guide-shadow-contact\s*\{([^}]*)\}/);
  assert.ok(contactRule, 'missing .guide-shadow-contact rule');
  sourceMatches(contactRule[1], /min-inline-size\s*:\s*(?:96|9[7-9]|[1-9]\d{2,})px/,
    'Guide contact needs an expanded mobile width, not the old 64px portrait');
  sourceMatches(contactRule[1], /min-block-size\s*:\s*(?:96|9[7-9]|[1-9]\d{2,})px/,
    'Guide contact needs an expanded mobile height, not the old portrait');
  sourceMatches(contactRule[1], /scroll-margin-block-end\s*:\s*calc\(/,
    'the contact target must reserve the mobile navigation inset when scrolled into view');

  sourceOmits(paint, /visualLabel:\s*`[^`]*Тень/,
    'Guide-visible Shadow labels cannot bypass the centralized tone-review table');
  sourceMatches(paint, /visualLabel:\s*guideV3Copy\(/,
    'the visible Shadow label must come from Guide copy');
});

test('Guide controls keep the 42px floor and reduced motion stops decoration', () => {
  const guideRules = [...CSS.matchAll(/[^{}]*guide[^{}]*\{[^{}]*\}/gi)].map((match) => match[0]).join('\n');
  sourceMatches(guideRules, /min-(?:height|block-size)\s*:\s*(?:42px|var\(--touch-min(?:\s*,\s*42px)?\))/i);
  sourceMatches(CSS,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,1800}guide[\s\S]{0,600}(?:animation|transition)\s*:\s*none/i,
    'Guide entrance, bob and celebration motion must stop under reduced motion');
});

test('360px keeps secondary Guide actions beside each other so the bubble stays above mobile nav', () => {
  const guideCss = CSS.slice(CSS.indexOf('Guide v3 — non-modal'));
  sourceMatches(guideCss,
    /\.guide-surface-v1__action\s*\{[^}]*max-inline-size:\s*100%[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s,
    'long localized Guide actions must wrap inside their grid cell');
  sourceMatches(guideCss,
    /@media\s*\(max-width:\s*600px\)[\s\S]{0,1500}guide-surface-v1__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,/,
    'mobile Guide actions need a two-column secondary row');
  sourceOmits(guideCss,
    /@media\s*\(max-width:\s*3\d{2}px\)[\s\S]{0,500}guide-surface-v1__actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'the 360px edge must not stack all three controls beneath the transcript');
});

test('360px keeps all seven 42px habit days inside the Guide form', () => {
  sourceMatches(CSS,
    /\.habit-day-picks\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(var\(--touch-min\),\s*1fr\)\)/,
    'the real Habits form must keep seven explicit touch-size columns');
  sourceMatches(CSS,
    /@media\s*\(max-width:\s*380px\)[\s\S]{0,500}\.habit-day-picks\s*\{[^}]*gap:\s*2px[^}]*overflow-x:\s*visible/,
    'the 360px edge must fit all seven days rather than hiding Sunday in an inner scroller');
  sourceMatches(CSS,
    /\.habit-day-picks input\s*\{[^}]*margin:\s*0/,
    'native checkbox margins must not add hidden width outside each 42px day target');
});

test('a missing spotlight target renders the safe bubble instead of blocking the app', () => {
  sourceMatches(GUIDE, /fallback:\s*['"]safe-bubble['"]/);
  sourceMatches(SURFACE, /guide-safe-bubble|guideFallback\s*=\s*['"]safe-bubble['"]/i);
  sourceMatches(CSS, /guide-safe-bubble/i);
});

test('chapter replay is presentation-only and cannot pay rewards again', () => {
  assert.ok(GUIDE, 'public/guide-v3.js must exist');
  const G = require(path.join(ROOT, 'public', 'guide-v3.js'));
  const resolved = G.migrate(null, { done: true });
  const replay = G.reduce(resolved, { type: 'guide:replay', chapter: G.FIRST_CHAPTER });
  assert.equal(replay.accepted, true);
  assert.deepEqual(replay.effects, [], 'replay cannot request feature mutations or rewards');
  assert.ok(G.REGISTRY.every((entry) => entry.rewardPolicy === 'none'));
  assert.ok(G.REGISTRY.every((entry) => /no-reward/.test(entry.replayPolicy)));

  const replayReducer = between(GUIDE, "if (type === 'guide:replay')", "if (type === 'guide:start')");
  sourceOmits(replayReducer, /\b(?:xp|gold|bond|discovered|reward)\b/i);
  const replayUi = actionSection(APP, 'guide-replay');
  sourceOmits(replayUi, /\b(?:xp|gold|bond)\b|markDiscovered|grant|award/i);
});

test('the real Shadow contact is mounted and removed on the bond transitions', () => {
  assert.match(APP, /const enteringBond = state\?\.currentStep === 'mastery'/);
  assert.match(APP, /if \(advanced && enteringBond\) render\(\)/);
  const bond = actionSection(APP, 'guide-shadow-contact');
  assert.match(bond, /const ok = await guideV3CompleteShadowContact\(\)/);
  assert.match(bond, /if \(ok\) \{[\s\S]*?ShadowRig\?\.setTransient\('happy',[\s\S]*?render\(\)/);
});

test('Guide v3 copy and library do not resurrect the removed energy mechanic', () => {
  assert.ok(COPY, 'Guide copy must live in its own script before it can be audited');
  const guideLibrary = between(APP, 'const GUIDE_SECTIONS = Object.freeze([]);', '\nfunction showGuide()');
  const obsolete = /(?:\benergy\b|Энергия|энерги[яиюе])/i;
  sourceOmits(GUIDE, obsolete);
  sourceOmits(COPY, obsolete);
  sourceOmits(guideLibrary, obsolete);
});

test('Guide integration does not enter renderCalendarView', () => {
  const calendar = between(APP, 'function renderCalendarView()', '\nfunction trainingWithoutMobility');
  sourceOmits(calendar, /GuideV3|guideV3|guide-v3|data-guide-target|guide:/i);
});
