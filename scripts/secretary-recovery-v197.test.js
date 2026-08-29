'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const Actions = require('../public/assistant-actions-v1.js');
const AttentionUI = require('../public/attention-ui-v1.js');

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing end token after ${startToken}: ${endToken}`);
  return source.slice(start, end);
}

function occurrences(source, token) {
  return source.split(token).length - 1;
}

test('Today composes one work contour and moves secondary systems out of its render tree', () => {
  const renderToday = section(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  const composition = renderToday.slice(renderToday.lastIndexOf("if (tab === 'board')"));

  for (const oldCard of [
    'founderPassCard',
    'fightsCardHTML',
    'energyCard',
    'progressTrioCard',
    'notesPeekToday',
    'deeperPath',
    'antiHabitsCard',
  ]) {
    assert.equal(composition.includes(oldCard), false, `${oldCard} returned to the Today composition`);
  }

  assert.match(composition, /\$\{todayHero\}\$\{captureBar\(\)\}/,
    'capture must remain immediately after the day hero');
  assert.match(composition, /\$\{companionCard\(attentionTodayControlHTML\(\)\)\}/,
    'recovery/attention must stay inside the companion support card');
});

test('Founder Pass belongs to the Settings account group, not Today', () => {
  const settings = section(APP, 'function renderSettings() {', '\nfunction bossForWeek(');
  const account = settings.indexOf("groupStart('account'");
  const founder = settings.indexOf('${founderPassCard()}');
  const experience = settings.indexOf("groupStart('experience'");

  assert.ok(account >= 0, 'Settings account group is missing');
  assert.ok(founder > account && founder < experience,
    'Founder Pass must render between the Account and Experience group boundaries');
  const renderToday = section(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  assert.doesNotMatch(renderToday, /founderPassCard\s*\(/);
});

test('assistant can only open safe recovery destinations and cannot grant permission or close a session', () => {
  const context = { attentionPolicies: { policies: [{ id: 'p1', name: 'TikTok' }] } };
  for (const kind of ['attention_open_return', 'recovery_open', 'evening_open', 'push_settings_open']) {
    const result = Actions.validate({
      kind,
      requestPermission: true,
      permission: 'granted',
      closeSession: true,
      outcome: 'done',
    }, context);
    assert.deepEqual(result.action, { kind, tier: 'open' });
  }

  for (const kind of [
    'notification_permission',
    'push_permission',
    'permission_request',
    'attention_session_close',
    'attention_session_finish',
    'attention_outcome',
  ]) {
    assert.equal(Actions.KIND_LIST.includes(kind), false, `${kind} must not be executable`);
    assert.equal(Actions.validate({ kind }, context).reason, Actions.REASONS.REFUSED_KIND);
  }

  const opener = section(APP, 'function openAssistantDestination(action) {', '\nasync function applyChatActions(');
  assert.match(opener, /action\.kind === 'attention_open_return'[\s\S]*openAttentionReturn/);
  assert.match(opener, /action\.kind === 'recovery_open'[\s\S]*openRecoveryLauncher/);
  assert.match(opener, /action\.kind === 'evening_open'[\s\S]*openEveningLanding/);
  assert.match(opener, /action\.kind === 'push_settings_open'[\s\S]*State\.view = 'settings'/);
  assert.doesNotMatch(opener, /requestPermission|finishAttentionSession|closeSession|commitDayClosed/);
});

test('recovery persists exactly one Attention envelope before applying or announcing success', () => {
  const startRecovery = section(APP, 'async function startRecoverySession(form) {', '\nasync function saveEveningSetup(');
  assert.equal(occurrences(startRecovery, 'AttentionStore.save('), 1,
    'starting recovery must make one envelope write');
  assert.match(startRecovery, /const bundle = \{ \.\.\.base, sessions: started\.sessions \}/);
  const writeAt = startRecovery.indexOf('await AttentionStore.save(bundle)');
  const applyAt = startRecovery.indexOf('applyAttentionBundle(bundle)');
  const successAt = startRecovery.indexOf("toast(t('Отдых начался");
  assert.ok(writeAt >= 0 && writeAt < applyAt && applyAt < successAt,
    'write must finish before in-memory apply and success feedback');

  const persistClose = section(APP, 'async function persistAttentionClose(next) {', '\nasync function finishAttentionSession(');
  assert.equal(occurrences(persistClose, 'AttentionStore.save('), 1,
    'session + episode close must stay one checked envelope');
  assert.ok(persistClose.indexOf('await AttentionStore.save(bundle)') < persistClose.indexOf('applyAttentionBundle(bundle)'),
    'closed session must not appear locally before the envelope is stored');
});

test('rested and unknown remain honest recovery outcomes end-to-end', () => {
  const finish = section(APP, 'async function finishAttentionSession(button) {', '\nfunction paintAttentionEmergencyCountdown(');
  assert.match(finish, /\['done', 'rested', 'escaped', 'unknown'\]\.includes\(button\.dataset\.outcome\)/);
  assert.match(finish, /outcome === 'rested'/);
  assert.match(finish, /outcome === 'unknown'/);

  const html = AttentionUI.renderBoundary({
    purpose: 'rest',
    mode: 'adaptive',
    targetLabel: 'Отдых',
    sessionId: 'rest-1',
  }, (value) => value);
  assert.match(html, /data-outcome="rested"/);
  assert.match(html, /data-outcome="unknown"/);
  assert.doesNotMatch(html, /data-outcome="done"/);
});

test('daily evening reminder requires a valid time and never requests browser permission itself', () => {
  const save = section(APP, 'async function saveEveningSetup(form) {', '\nasync function commitDayClosed(');
  assert.match(save, /dailyReminder && !\/\^\(\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$\/\.test\(targetTime\)/,
    'enabling the daily reminder must reject an empty or invalid time');
  assert.ok(save.indexOf('dailyReminder &&') < save.indexOf("Store.saveNow('settings'"),
    'time validation must run before settings are written');

  const scheduler = section(APP, 'async function showEveningNotification() {', '\nfunction scheduleReminders() {');
  assert.match(scheduler, /!cfg\.dailyReminder \|\| !\/\^\(\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$\/\.test\(cfg\.eveningTime\)/);
  assert.doesNotMatch(scheduler, /requestPermission/,
    'a scheduled reminder must only use an already-granted permission');

  const setupHtml = AttentionUI.renderEvening({ dailyReminder: true, targetTime: '' }, (value) => value);
  assert.match(setupHtml, /name="dailyReminder" checked/);
  assert.match(setupHtml, /name="targetTime" value=""/);
  assert.doesNotMatch(setupHtml, /requestPermission/);
});

test('both close-day entry points await write-guarded persistence and expose no legacy false success', () => {
  const commit = section(APP, 'async function commitDayClosed(closed, { reflection } = {}) {', '\nasync function finishEveningLanding(');
  assert.match(commit, /await Store\.saveNow\('days', nextDays,/);
  assert.ok(commit.indexOf("await Store.saveNow('days'") < commit.indexOf('if (!saved) return false'));
  assert.doesNotMatch(commit, /Store\.save\('days'/);

  const clickBranch = section(
    APP,
    "} else if (action === 'close-day' || action === 'reopen-day') {",
    '\n  // --- Цели ---',
  );
  assert.match(clickBranch, /const saved = await commitDayClosed\(closed,/);
  assert.match(clickBranch, /if \(!saved\)[\s\S]*return;/);
  assert.doesNotMatch(clickBranch, /Store\.save\('days'/);

  const evening = section(APP, 'async function finishEveningLanding() {', '\nfunction scheduleAttentionBoundary(');
  assert.match(evening, /if \(!await commitDayClosed\(true\)\)/);
  assert.ok(evening.indexOf('await commitDayClosed(true)') < evening.indexOf("toast(`🌙"),
    'the evening success message must follow the durable close');
});

test('service-worker click navigates an existing client to the exact same-origin deep-link', async () => {
  const clickSource = SW.slice(SW.indexOf("self.addEventListener('notificationclick'"));
  assert.ok(clickSource.startsWith("self.addEventListener('notificationclick'"));

  let clickHandler = null;
  let navigated = '';
  let focused = 0;
  let opened = 0;
  const client = {
    focus() { focused += 1; return Promise.resolve(this); },
    navigate(url) { navigated = url; return Promise.resolve(this); },
  };
  const self = {
    location: { origin: 'https://satoru.example' },
    addEventListener(kind, handler) { if (kind === 'notificationclick') clickHandler = handler; },
    clients: {
      matchAll() { return Promise.resolve([client]); },
      openWindow() { opened += 1; return Promise.resolve(null); },
    },
  };
  vm.runInNewContext(clickSource, { self, URL });
  assert.equal(typeof clickHandler, 'function');

  let pending;
  let closed = 0;
  clickHandler({
    notification: {
      data: { url: './?view=today&do=finish' },
      close() { closed += 1; },
    },
    waitUntil(value) { pending = value; },
  });
  await pending;

  assert.equal(closed, 1);
  assert.equal(navigated, 'https://satoru.example/?view=today&do=finish');
  assert.equal(focused, 1);
  assert.equal(opened, 0, 'an existing client must be reused instead of opening another tab');
});

test('server evening decision skips a closed day and only configured flow owns the evening slot', () => {
  const dueSource = section(SERVER, 'function secretaryEveningDue(', '\nconst SECRETARY_EVENING_COPY');
  const context = {};
  vm.runInNewContext(`${dueSource}\nthis.secretaryEveningDue = secretaryEveningDue;`, context);
  const due = context.secretaryEveningDue;

  assert.equal(due({}, {}, '2026-08-29', 21, 0, {}).configured, false);
  const configured = { secretary: { configured: true, dailyReminder: true, eveningTime: '21:00' } };
  assert.equal(due(configured, {}, '2026-08-29', 21, 15, {}).due, true);
  const closed = due(configured, { '2026-08-29': { closed: true } }, '2026-08-29', 21, 15, {});
  assert.equal(closed.configured, true);
  assert.equal(closed.due, false);

  const tick = section(SERVER, 'async function pushTick() {', '\nfunction aiKeysFile(');
  assert.match(tick, /if \(evening\.configured\)[\s\S]*kind = legacyKind === 'm' \? 'm' : null;/,
    'configured secretary must suppress the legacy evening check-in');
  assert.match(tick, /else if \(days\[date\] && days\[date\]\.closed && kind === 'e'\) kind = null;/,
    'closed day must suppress even the legacy fallback');
  assert.match(tick, /url: '\.\/\?view=today&do=finish'/);
  assert.match(tick, /tag: 'satoru-evening'/);
});

test('companion and quick capture keep explicit accessible names', () => {
  const capture = section(APP, 'function captureBar() {', '\nfunction validateInboxPayload(');
  assert.match(capture, /<label class="sr-only" for="capture-text">\$\{t\('Текст заметки'\)\}<\/label>/);
  assert.match(capture, /data-action="cap-voice" aria-label="\$\{t\('Голосовая заметка'\)\}"/);
  assert.match(capture, /data-action="cap-video" aria-label="\$\{t\('Видео-заметка'\)\}"/);
  assert.match(capture, /type="submit" class="cap-add" aria-label="\$\{t\('Сохранить заметку'\)\}"/);
  assert.match(capture, /data-action="goto-notes"[^>]*aria-label="\$\{t\('Открыть заметки'\)\}: \$\{noteCount\}"/);

  const companion = section(APP, 'function companionCard(controlHTML = \'\') {', '\n// ============================================================\n//  Питомцы по сферам');
  assert.match(companion, /class="secretary-toggle"[^>]*aria-expanded="\$\{expanded\}"[^>]*aria-controls="secretary-details"/);
  assert.match(companion, /\$\{t\(expanded \? 'Свернуть' : 'Подробнее'\)\}/,
    'the disclosure must have a localized visible name, not only a chevron');
  assert.match(companion, /class="secretary-reward[^>]*aria-label="\$\{esc\(t\('Заработанная награда ждёт — получить'\)\)\}: \$\{chests\}"/);
  assert.match(companion, /class="secretary-details-head"[\s\S]*\$\{t\('Связь с Тенью'\)\}/);
  assert.match(companion, /class="comp-rename"[^>]*title="\$\{t\('Переименовать'\)\}"/);

  const today = section(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  assert.match(today, /<aside class="today-support" aria-label="\$\{t\('Поддержка дня'\)\}"/);
});

test('new secretary and capture emoji remain decorative for assistive technology', () => {
  const control = section(APP, 'function attentionTodayControlHTML() {', '\nfunction attentionPolicyId(');
  for (const glyph of ['↩', '🌿', '🌙', '🛡']) {
    assert.match(control, new RegExp(`<span aria-hidden="true">${glyph}<\\/span>`),
      `${glyph} must not be announced before the adjacent text label`);
  }

  const capture = section(APP, 'function captureBar() {', '\nfunction validateInboxPayload(');
  assert.match(capture, /<span aria-hidden="true">📝<\/span> \$\{noteCount\}/);

  const companion = section(APP, 'function companionCard(controlHTML = \'\') {', '\n// ============================================================\n//  Питомцы по сферам');
  assert.match(companion, /<span aria-hidden="true">\$\{expanded \? '⌃' : '⌄'\}<\/span>/);

  const evening = AttentionUI.renderEvening({ active: true }, (value) => value);
  assert.match(evening, /<span aria-hidden="true">✓<\/span>/);
});

test('companion disclosure restores focus and disappears while a companion form is active', () => {
  const companion = section(APP, 'function companionCard(controlHTML = \'\') {', '\n// ============================================================\n//  Питомцы по сферам');
  assert.match(companion, /\$\{form \? '' : `<button type="button" class="secretary-toggle"/,
    'a live check-in/rename form must not also expose the summary toggle');
  assert.match(companion, /const expanded = !!State\._todayCompanionOpen \|\| !!form/,
    'an active form must keep its details visible');

  const toggle = section(
    APP,
    "if (action === 'toggle-today-companion') {",
    "\n  if (action === 'comp-rename')",
  );
  assert.match(toggle, /State\._todayCompanionOpen = !State\._todayCompanionOpen/);
  assert.ok(toggle.indexOf('render();') < toggle.indexOf('requestAnimationFrame('));
  assert.match(toggle, /focusPathChoiceTarget\(document\.querySelector\('\[data-action="toggle-today-companion"\]'\)\)/,
    'focus must return to the newly rendered disclosure button');
});

test('successful recovery and evening close land focus on the visible secretary state', () => {
  const recovery = section(APP, 'async function startRecoverySession(form) {', '\nasync function saveEveningSetup(');
  const evening = section(APP, 'async function finishEveningLanding() {', '\nfunction scheduleAttentionBoundary(');
  const landing = /requestAnimationFrame\(\(\) => focusPathChoiceTarget\(document\.querySelector\('\[data-secretary-control\]'\) \|\| document\.querySelector\('#main h2'\)\)\)/;

  assert.match(recovery, landing);
  assert.ok(recovery.indexOf('applyAttentionBundle(bundle)') < recovery.search(landing),
    'recovery focus must move only after the stored state is applied and rendered');
  assert.match(evening, landing);
  assert.ok(evening.indexOf('await commitDayClosed(true)') < evening.search(landing),
    'evening focus must move only after durable day close and render');
});

test('setEveningDue updates both visual state and the assistant FAB accessible name', () => {
  const source = section(APP, 'function setEveningDue(due) {', '\nfunction eveningPromptBlocked(');
  const classes = [];
  const attributes = {};
  const fab = { setAttribute(name, value) { attributes[name] = value; } };
  const context = {
    State: {},
    document: {
      documentElement: { classList: { toggle(name, value) { classes.push([name, value]); } } },
      getElementById(id) { return id === 'ai-fab' ? fab : null; },
    },
    t(value) { return `translated:${value}`; },
  };
  vm.runInNewContext(`${source}\nthis.setEveningDue = setEveningDue;`, context);

  context.setEveningDue(true);
  assert.equal(context.State._eveningDue, true);
  assert.deepEqual(classes.at(-1), ['evening-reminder-due', true]);
  assert.equal(attributes['aria-label'], 'translated:Тень — завершить вечер');

  context.setEveningDue(false);
  assert.equal(context.State._eveningDue, false);
  assert.deepEqual(classes.at(-1), ['evening-reminder-due', false]);
  assert.equal(attributes['aria-label'], 'translated:Тень');
});

test('the complete v197 secretary locale block has EN, DE, UK and ES for every string', () => {
  const localeBlock = section(
    APP,
    '// ── Attention R1: visible secretary, recovery and evening flows ──',
    '// ── v164 18.08:',
  );
  const rows = [...localeBlock.matchAll(/^\s*'((?:\\.|[^'])+)':\s*\{([^}]+)\},?$/gm)];
  assert.ok(rows.length >= 80, `expected the full v197 locale surface, found ${rows.length} rows`);
  for (const [, key, values] of rows) {
    for (const locale of ['en', 'de', 'uk', 'es']) {
      assert.match(values, new RegExp(`\\b${locale}:\\s*'`), `${key}: missing ${locale}`);
    }
  }

  for (const key of [
    'Подробнее', 'Свернуть', 'Связь с Тенью', 'Открыть заметки', 'Переименовать',
    'Поддержка дня', 'Тень — завершить вечер', 'Выбери нужную поддержку',
    'Отдохнуть с границей', 'Завершить вечер',
  ]) {
    assert.match(localeBlock, new RegExp(`^\\s*'${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}':`, 'm'),
      `${key}: missing from the bounded v197 locale block`);
  }
});

test('GOJO secretary routes one support flow and cannot invent fight or anti-habit tracking', () => {
  const manual = section(APP, 'const GOJO_MANUAL = `', '`;\nconst CHAT_SUGGESTIONS');
  const secretary = section(manual, 'СЕКРЕТАРСКИЙ РЕЖИМ.', '\n\nКОНТЕКСТ И ФАЙЛЫ.');

  assert.match(secretary, /сам выбери ОДИН подходящий контур/);
  assert.match(secretary, /нужен возврат — attention_open_return/);
  assert.match(secretary, /нужен ограниченный отдых — recovery_open/);
  assert.match(secretary, /подготовить сон — evening_open/);
  assert.match(secretary, /войти в TikTok\/YouTube[\s\S]*— attention_policy_draft/);
  assert.match(secretary, /настроить уведомления — push_settings_open/);
  assert.match(secretary, /Не создавай «схватку», анти-привычку или новый ежедневный трекер/);
  assert.match(secretary, /Одна полезная карточка лучше пяти/);

  for (const kind of Actions.KIND_LIST) {
    assert.doesNotMatch(kind, /fight|anti[-_]?habit/i,
      `assistant unexpectedly gained a tracker action: ${kind}`);
  }
});
