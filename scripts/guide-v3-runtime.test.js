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
const GUIDE = readOptional('public/guide-v3.js');
const SURFACE = readOptional('public/guide-surface-v1.js');
const COPY_REVIEW = readOptional('GUIDE-V3-RU-COPY-REVIEW.md');
const COPY_RU = require('../public/guide-v3-copy-ru.js');

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
const COPY_SCRIPT = SCRIPT_SOURCES.find((source) => /(?:guide[^/]*copy|copy[^/]*guide)[^/]*\.js(?:\?|$)/i.test(source)) || '';
const COPY_FILE = scriptFile(COPY_SCRIPT);
const COPY = COPY_FILE ? readOptional(path.join('public', COPY_FILE)) : '';

test('Guide model, copy, presenter and surface load before app.js', () => {
  const model = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-v3.js');
  const copy = SCRIPT_SOURCES.findIndex((source) => source === COPY_SCRIPT);
  const presenter = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-presenter-v1.js');
  const surface = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'guide-surface-v1.js');
  const app = SCRIPT_SOURCES.findIndex((source) => scriptFile(source) === 'app.js');

  assert.ok(model >= 0, 'index.html must load public/guide-v3.js');
  assert.ok(COPY_SCRIPT, 'index.html must load a separate Guide copy script (guide*copy*.js)');
  assert.ok(COPY, `Guide copy script is referenced but missing: public/${COPY_FILE}`);
  assert.ok(presenter >= 0, 'index.html must load public/guide-presenter-v1.js');
  assert.ok(surface >= 0, 'index.html must load public/guide-surface-v1.js');
  assert.ok(app >= 0, 'index.html must load app.js');
  assert.ok(model < copy, 'guide-v3.js must load before the Guide copy table');
  assert.ok(copy < presenter, 'Guide copy must load before the presenter');
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

test('v163 offline shell pins all Guide runtime scripts', () => {
  sourceMatches(SW, /const CACHE = 'satoru-v184';/);
  for (const file of ['guide-v3.js', COPY_FILE, 'guide-presenter-v1.js', 'guide-surface-v1.js']) {
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
  ];
  for (const target of targets) {
    assert.ok(APP.includes(`data-guide-target="${target}"`), `missing stable Guide target: ${target}`);
  }
  sourceMatches(APP, /CSS\.escape\([^)]*(?:task|selected)/, 'task-specific Guide selectors must escape their persisted id');
});

test('welcome and release stay in the safe bubble instead of spotlighting content beneath mobile nav', () => {
  const selectors = between(APP, 'function guideV3TargetSelector', '\nfunction guideV3RevealTarget');
  sourceOmits(selectors, /\[['"]welcome['"],\s*['"]release['"]\][\s\S]{0,180}first-task-create/,
    'intro/outro have no authored UI target and must not draw an offscreen spotlight');
  sourceMatches(selectors, /vm\.step\s*===\s*['"]recognize['"][\s\S]{0,180}first-task-create/,
    'the blank-seed recognition step must still point at the real quick-add form');
});

test('persisted completion and bond success effects happen only after saveNow succeeds', () => {
  sourceMatches(APP,
    /(?:const|let)\s+saved\s*=\s*await\s+Store\.saveNow\(['"]tasks['"][\s\S]{0,900}if\s*\(\s*!saved\s*\)[\s\S]{0,900}type:\s*['"]task:completed['"][\s\S]{0,220}persisted:\s*true/,
    'task:completed(persisted:true) must follow an awaited successful task save');
  const commit = between(APP, 'async function guideV3Commit', '\nlet _guideV3SurfaceKey');
  sourceMatches(commit, /GuideV3\.reduce\([^)]*event[^)]*\)[\s\S]{0,500}await\s+Store\.saveNow\(['"]settings['"]/,
    'Guide reducer result and its event must be persisted in one settings transaction');
  sourceMatches(commit, /if\s*\(\s*!saved\s*\)[\s\S]{0,260}State\.settings\.guideV3\s*=\s*prior/,
    'failed Guide state writes must roll back');
  const contact = between(APP, 'async function guideV3CompleteShadowContact()', '\nasync function guideV3StartFocus');
  sourceMatches(contact,
    /\.reduce\([^;]*type:\s*['"]guide:bond['"][\s\S]{0,180}persisted:\s*true[\s\S]{0,500}State\.settings\.guideV3\s*=\s*[^;]+[\s\S]{0,220}await\s+Store\.saveNow\(['"]settings['"]/,
    'Shadow contact must reduce bond progress and persist it with the companion settings mutation');
  sourceMatches(contact,
    /await\s+Store\.saveNow\(['"]settings['"][\s\S]{0,500}if\s*\([^)]*(?:result\.)?metric[^)]*\)\s*track\(/,
    'bond telemetry and other success effects must follow the successful settings write');
});

test('live Shadow contact persists one real bond mutation atomically and replay stays inert', () => {
  const contact = between(APP, 'async function guideV3CompleteShadowContact()', '\nasync function guideV3StartFocus');
  sourceMatches(contact, /State\.settings\.guideV3[\s\S]{0,240}State\.settings\.companion/,
    'Shadow contact must snapshot only the Guide and companion records it can change');
  sourceMatches(contact, /ensureCompanion\(\)[\s\S]{0,500}\.bond\s*=\s*[^;]+\+\s*1/,
    'the first live Shadow contact must add exactly one bond point');
  sourceMatches(contact, /\.pet\s*=\s*(?:todayStr\(\)|[^;]*today)/,
    'the live contact must persist the companion pet/contact day');
  sourceMatches(contact, /\.lastSeen\s*=\s*(?:todayStr\(\)|[^;]*today)/,
    'the live contact must persist companion lastSeen');
  assert.equal((contact.match(/await\s+Store\.saveNow\(['"]settings['"]/g) || []).length, 1,
    'companion contact and Guide progress must share exactly one awaited settings write');
  sourceMatches(contact,
    /if\s*\(\s*!saved\s*\)[\s\S]{0,420}State\.settings\.guideV3\s*=[\s\S]{0,260}(?:State\.settings\.companion\s*=|delete\s+State\.settings\.companion)/,
    'a failed contact write must restore both targeted records, including a previously absent companion');
  sourceOmits(contact, /guideV3Commit\s*\(/,
    'the atomic contact helper must not split its state across a second Guide transaction');

  const bond = actionSection(APP, 'guide-shadow-contact');
  sourceMatches(bond, /await\s+guideV3CompleteShadowContact\s*\(\s*\)/,
    'the live contact handler must await the atomic helper');
  sourceOmits(bond, /ensureCompanion|\.bond\s*=|\.pet\s*=|\.lastSeen\s*=|Store\.saveNow/,
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
  assert.match(reconcile, /const prior = State\.settings\.guideV3/);
  assert.match(reconcile, /await Store\.saveNow\('settings', State\.settings\)/);
  assert.match(reconcile, /if \(!saved\) State\.settings\.guideV3 = prior/);
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

test('approved RU copy can run while another locale still cannot receive the RU library', () => {
  assert.equal(COPY_RU.RUNTIME_APPROVED, true,
    'the owner-approved RU Guide must be available in normal runtime');
  assert.equal(COPY_RU.STATUS, 'runtime-approved');
  const runtimeAllowed = between(APP, 'function guideV3RuntimeAllowed()', '\nfunction showGuideUnavailable');
  sourceMatches(runtimeAllowed, /lang\(\)\s*===\s*['"]ru['"]/,
    'Guide runtime eligibility must be locale-scoped');
  sourceMatches(runtimeAllowed, /RUNTIME_APPROVED\s*===\s*true/,
    'normal Guide runtime eligibility must require the explicit copy approval flag');
  const maybeStart = between(APP, 'function guideV3MaybeStart()', '\nasync function guideV3Snooze');
  sourceMatches(maybeStart, /guideV3RuntimeAllowed\(\)/,
    'automatic First Journey start must pass the centralized runtime/copy gate');

  const library = between(APP, 'function showGuide()', '\n// ============================================================\n//  Вид «Награды»');
  sourceMatches(library, /if\s*\(\s*lang\(\)\s*!==\s*['"]ru['"][^)]*\|\|\s*!guideV3RuntimeAllowed\(\)\s*\)/,
    'the RU-only draft library must not mount for EN/DE/UK/ES users');
});

test('feedback remains reachable even when the localized Guide is unavailable', () => {
  const panel = between(APP, 'function feedbackPanelHTML()', '\nfunction showGuideUnavailable');
  sourceMatches(panel, /id="feedback-form"/,
    'the durable feedback form must have one shared renderer');
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
    /@media\s*\(max-width:\s*600px\)[\s\S]{0,1500}guide-surface-v1__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,/,
    'mobile Guide actions need a two-column secondary row');
  sourceOmits(guideCss,
    /@media\s*\(max-width:\s*3\d{2}px\)[\s\S]{0,500}guide-surface-v1__actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'the 360px edge must not stack all three controls beneath the transcript');
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
