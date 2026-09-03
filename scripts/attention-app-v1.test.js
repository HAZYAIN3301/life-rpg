'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const APP = read('public/app.js');
const UI = read('public/attention-ui-v1.js');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');
const CSS = read('public/styles.css');
const SERVER = read('server.js');

test('attention engine, controller and renderer load before app and stay in the v179 shell', () => {
  const files = ['attention-policy-v1.js', 'attention-session-v1.js', 'attention-episode-v1.js', 'attention-controller-v1.js', 'attention-ui-v1.js'];
  let prior = -1;
  for (const file of files) {
    const at = INDEX.indexOf(`src="${file}`);
    assert.ok(at > prior, `${file} must load after the previous dependency`);
    prior = at;
    assert.equal((SW.match(new RegExp(`'${file.replaceAll('.', '\\.')}'`, 'g')) || []).length, 1, `${file} must appear once in SHELL`);
  }
  assert.ok(INDEX.indexOf('src="app.js') > prior, 'app.js must run after every attention dependency');
  assert.match(SW, /const CACHE = 'satoru-v231'/);
});

test('client uses the dedicated checked envelope and never generic attention data files', () => {
  assert.match(APP, /fetch\('\/api\/attention'\)/);
  assert.match(APP, /method: 'PUT'[\s\S]{0,180}allowEmpty:/);
  assert.match(APP, /satoru_attention_v1:/, 'local-only state needs a device-local store');
  assert.match(APP, /if \(local\.error && !this\.hasContent\(remote\.value\)\)/,
    'malformed local data must not silently become an empty remote state');
  assert.doesNotMatch(APP, /Store\.loadChecked\('attention-(?:policies|sessions|episodes)'/);
  assert.doesNotMatch(APP, /Store\.saveNow\('attention-(?:policies|sessions|episodes)'/);
  assert.match(APP, /\['attention-policies', 'attention-sessions', 'attention-episodes'\]\.includes\(name\)[\s\S]{0,90}attentionWriteAllowed\(name, '_put', true\)/,
    'direct generic Store._put calls must fail closed for every legacy Attention dataset');
  assert.match(APP, /legacy attention dataset endpoint/, 'old generic writes must fail closed');
});

test('local-only is the default and revoking sync deletes the remote copy deliberately', () => {
  assert.match(APP, /attentionMode: 'local'/);
  assert.match(APP, /previousMode === 'contracts'[\s\S]{0,260}mode: 'local'[\s\S]{0,160}putServer\(cleared, true\)/);
  assert.match(UI, /name="storageMode" value="local"/);
  assert.match(UI, /name="storageMode" value="contracts"/);
  assert.doesNotMatch(UI, /name="storageMode" value="aggregates"/,
    'R1 must not sell aggregate sync before a server-side aggregate projection exists');
});

test('server independently enforces ownership, whitelist, bounded payload and lifecycle', () => {
  assert.match(SERVER, /ATTENTION_MAX_BYTES = 2 \* 1024 \* 1024/);
  assert.match(SERVER, /if \(u === '\/api\/attention' \|\| u === '\/api\/attention\/episode'\)/);
  assert.match(SERVER, /const uid = sessionUserId\(req\)/);
  assert.match(SERVER, /ACCOUNT_PORTABLE_FILES = \[[\s\S]{0,220}'attention'/);
  assert.match(SERVER, /function deleteAccountLifecycle/);
  assert.match(APP, /const attentionLocalKey = AttentionStore\.key\(\)[\s\S]{0,650}localStorage\.removeItem\(attentionLocalKey\)/,
    'account deletion must remove the device-local attention envelope too');
  for (const forbidden of ['accessibilityTree', 'messages', 'watched', 'history']) {
    const cleaner = SERVER.slice(SERVER.indexOf('function attentionCleanEpisode'), SERVER.indexOf('function attentionCleanPolicy'));
    assert.equal(cleaner.includes(`raw.${forbidden}`), false, `server whitelist must not persist ${forbidden}`);
  }
});

test('gate, boundary, return and session cleanup are wired without reward mechanics', () => {
  assert.match(APP, /act === 'gate' \|\| act === 'return'/);
  assert.match(APP, /scheduleAttentionBoundary\(\)/);
  assert.match(APP, /openAttentionReturn\(/);
  assert.match(APP, /clearAllData\(\)[\s\S]{0,2200}State\.attentionMode = 'local'/);
  const block = APP.slice(APP.indexOf('//  Attention R1 \u2014'), APP.indexOf('function renderSettings()', APP.indexOf('//  Attention R1 \u2014')));
  assert.doesNotMatch(block, /addXp|gold|streak|reward|loot/i);
  assert.match(block, /const refreshSettings = State\.view === 'settings';[\s\S]{0,220}_settingsFocusAfterCommit = '\.attention-settings-card'; render\(\)/,
    'starting a session from Settings must expose its active state and keep focus out of BODY');
  assert.doesNotMatch(block, /(?:extendAttentionSession|finishAttentionSession|startAttentionEmergency)[\s\S]{0,900}closeAttentionDialog\(\{ restoreFocus: false, force: true \}\)/,
    'completed attention mutations must restore a meaningful focus target');
});

test('dialog contract covers modal semantics, focus, scroll lock, touch and reduced motion', () => {
  assert.match(APP, /role="dialog" aria-modal="true" aria-labelledby="attention-dialog-title"/);
  assert.match(APP, /handleAttentionDialogKeydown/);
  assert.match(APP, /body\.style\.position = 'fixed'/);
  assert.match(CSS, /\.attention-dialog :is\(button, input, select, textarea, summary\):focus-visible/);
  assert.match(CSS, /\.attention-dialog \.btn:not\(\.ghost\):not\(\.danger\),[\s\S]{0,120}color: var\(--on-accent\)/,
    'filled Attention actions need a readable foreground on every selectable accent');
  assert.match(CSS, /:root\[data-theme="light"\] \{ --attention-kicker-fg: #075f78; \}/,
    'meaning-bearing Attention kicker text needs a light-theme purpose color');
  assert.match(CSS, /@media \(pointer: coarse\), \(max-width: 600px\)[\s\S]{0,260}var\(--touch-min\)/);
  const attentionCss = CSS.slice(CSS.indexOf('Attention contract v1'));
  assert.match(attentionCss, /prefers-reduced-motion: reduce/);
});

test('Shadow\'s daily moment yields to an attention dialog instead of burning itself behind one', () => {
  // Заход приходит по deep-link из шортката: человек открыл TikTok, у него пять секунд.
  // Момент, показанный поверх, не просто мешает — momentSeen() помечает его увиденным,
  // и приветствие сгорает на сегодня, хотя человек смотрел на другой диалог.
  const guard = APP.match(/function attentionHoldsAttention\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(guard, 'attentionHoldsAttention() must exist');
  assert.match(guard[1], /_attentionDeepLink/, 'the routing→mount gap must be covered');
  assert.match(guard[1], /attention-dialog-overlay/, 'a mounted attention dialog must count');

  const check = APP.match(/function momentCheck\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(check, 'momentCheck() must exist');
  const body = check[1];
  const guarded = body.indexOf('attentionHoldsAttention()');
  const scheduled = body.indexOf('_momentTimer = setTimeout');
  assert.ok(guarded > -1, 'momentCheck must consult attentionHoldsAttention()');
  assert.ok(scheduled > -1, 'momentCheck must still schedule the moment');
  assert.ok(guarded < scheduled, 'the guard must run before the moment is scheduled');
  assert.ok(
    body.slice(scheduled).includes('attentionHoldsAttention()'),
    'the deferred callback must re-check: a dialog can open during the 400ms wait',
  );
});
