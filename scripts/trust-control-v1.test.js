const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

function between(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, 'missing start marker: ' + startMarker);
  assert.ok(end > start, 'missing end marker: ' + endMarker);
  return app.slice(start, end);
}

function re(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

function frozenJsonConstant(name) {
  const marker = 'const ' + name + ' = Object.freeze(';
  const markerIndex = app.indexOf(marker);
  const objectStart = app.indexOf('{', markerIndex + marker.length);
  assert.ok(markerIndex >= 0 && objectStart >= 0, name + ' marker must exist');
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = objectStart; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return JSON.parse(app.slice(objectStart, index + 1));
  }
  assert.fail(name + ' object is not closed');
}

test('dialog is local, labelled, inert, focus-trapped, and dismissible', () => {
  const controller = between('function pathChoiceFocusable', '\nfunction confirmPathChoice');
  for (const selector of [
    'path-choice-box', 'path-choice-head', 'path-choice-intro', 'path-choice-lore',
    'path-cards', 'path-card-state', 'path-consequences', 'path-choice-actions',
    'path-choice-confirm', 'path-choice-cancel',
  ]) assert.match(controller, new RegExp(selector));
  assert.match(controller, /setAttribute\('role', 'dialog'\)/);
  assert.match(controller, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(controller, /setAttribute\('aria-labelledby', 'path-choice-title'\)/);
  assert.match(controller, /setAttribute\('aria-describedby', 'path-choice-intro path-choice-lore'\)/);
  assert.match(controller, /setAttribute\('lang', lang\(\)\)/);
  assert.match(controller, /class="modal-x"[\s\S]{0,180}data-action="close-path-choice"/);
  assert.match(controller, /aria-describedby="path-card-\$\{p\.id\}-state path-card-\$\{p\.id\}-pitch path-card-\$\{p\.id\}-consequences"/);
  assert.match(controller, /overlay\._pathAppWasInert = !!\(appRoot && appRoot\.inert\)/);
  assert.match(controller, /overlay\._pathApp\.inert = !!overlay\._pathAppWasInert/);
  assert.match(controller, /overlay\.addEventListener\('keydown', handlePathChoiceKeydown\)/);
  assert.match(controller, /event\.target === overlay\) closePathChoiceModal\(\)/);
  assert.match(controller, /event\.key === 'Escape'/);
  assert.match(controller, /event\.key !== 'Tab'/);
  assert.match(controller, /avatarMotionReduced\(\)[\s\S]{0,120}video\.pause\(\)/);
  assert.match(controller, /target\.tabIndex = -1/);
});

test('pending selection does not save and explicit confirmation owns mutation', () => {
  const select = between('function selectPathChoice', '\nfunction showPathChoiceModal');
  const show = between('function showPathChoiceModal', '\nfunction confirmPathChoice');
  const confirm = between('function confirmPathChoice', '\n// Единственная точка мутации пути');
  assert.doesNotMatch(select, /Store\.save|State\.settings\.[A-Za-z_$][\w$]*\s*=/);
  assert.doesNotMatch(show, /Store\.save|State\.settings\.[A-Za-z_$][\w$]*\s*=/);
  assert.match(select, /overlay\.dataset\.selected = id/);
  assert.match(select, /setAttribute\('aria-pressed', String\(selected\)\)/);
  assert.match(show, /data-action="select-path-choice"/);
  assert.match(show, /data-action="confirm-path-choice"/);
  assert.match(confirm, /if \(id === current\) \{ closePathChoiceModal\(\); return false; \}/);
  assert.match(confirm, /closePathChoiceModal\(\{ restoreFocus: false \}\)/);
  assert.match(confirm, /return choosePath\(id\)/);
});

test('real transitions save once and preserve the reckoning cursor', () => {
  const source = between('function choosePath', '\n// Настройки остаются постоянной точкой обзора');
  const State = { settings: {
    path: 'trust', pathChosenAt: '2025-01-02', pathTeaserAt: 'old',
    control: { lastReckon: 'stale', keep: 'yes' },
  } };
  const calls = { save: 0, theme: 0, sfx: 0, toast: 0, publish: 0, render: 0 };
  const Store = { save(key, value) {
    assert.equal(key, 'settings');
    assert.equal(value, State.settings);
    calls.save += 1;
  } };
  const choosePath = Function(
    'pathIdValid', 'State', 'Store', 'todayStr', 'applyTheme', 'PATHS', 'sfx',
    'FLINT_LINES', 'toast', 't', 'publishLeaderboard', 'render',
    source + '\nreturn choosePath;'
  )(
    (id) => id === 'trust' || id === 'control', State, Store, () => '2026-08-09',
    () => { calls.theme += 1; },
    { trust: { glyph: 'T' }, control: { glyph: 'C' } },
    () => { calls.sfx += 1; }, { chose: ['control'], left: ['trust'] },
    () => { calls.toast += 1; }, (value) => value,
    () => { calls.publish += 1; }, () => { calls.render += 1; }
  );

  assert.equal(choosePath('control'), true);
  assert.equal(State.settings.pathChosenAt, '2025-01-02');
  assert.equal(State.settings.pathTeaserAt, '2026-08-09');
  assert.deepEqual(State.settings.control, { lastReckon: '2026-08-09', keep: 'yes' });
  State.settings.control.lastReckon = 'sentinel';
  assert.equal(choosePath('control'), false);
  assert.equal(State.settings.control.lastReckon, 'sentinel');
  assert.equal(choosePath('trust'), true);
  assert.equal(State.settings.control.lastReckon, 'sentinel');
  State.settings.control = 'corrupt';
  assert.equal(choosePath('control'), true);
  assert.deepEqual(State.settings.control, { lastReckon: '2026-08-09' });
  for (const invalid of ['', 'constructor', '__proto__', 'kindness']) assert.equal(choosePath(invalid), false);
  assert.deepEqual(calls, { save: 3, theme: 3, sfx: 3, toast: 3, publish: 3, render: 3 });
});

test('all entry points share the controller and Settings keeps review plus mute', () => {
  const click = between("if (action === 'drip-dismiss')", '\n  // --- Auth actions ---');
  const drip = between('function dripSeen', '\nlet _tutBound');
  const settings = between('function pathCard', '\nfunction adminCard');
  assert.match(app, /open-path-choice'\) \{ showPathChoiceModal\(\{ pendingPath: el\.dataset\.path \|\| null, source: 'settings', returnFocus: el \}\)/);
  assert.match(click, /source: 'teaser', returnFocus: el/);
  assert.match(drip, /showPathChoiceModal\(\{ source: 'drip', returnFocus \}\)/);
  assert.doesNotMatch(app, /data-action="choose-path"|data-action="set-path"/);
  const teaser = between('function pathTeaserCard', '\n// Один локальный контроллер');
  assert.deepEqual(
    [...teaser.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ['path-teaser-switch', 'path-teaser-dismiss']
  );
  assert.match(settings, /data-action="open-path-choice">\$\{t\('Сравнить оба пути'\)\}/);
  assert.match(settings, /const muteExtra = cur \? [\s\S]{0,160}<label[\s\S]*data-action="toggle-antagonist-mute"/);
  assert.match(settings, /const controlExtras = cur === 'control'/);
  assert.match(settings, /id="path-settings-title" tabindex="-1"/);
  const commit = between('function afterMainCommit', '\nfunction commitMainView');
  assert.match(commit, /State\._pathFocusAfterCommit = ''[\s\S]{0,220}focusPathChoiceTarget\(target\)/);
});

test('new copy has complete locales and normalized path quotes', () => {
  const keys = [
    'Закрыть выбор пути', 'Варианты пути', 'Текущий путь', 'Выбрано для подтверждения',
    'Подтвердить путь', 'Подтвердить смену пути', 'Оставить текущий путь', 'Сначала выбери путь',
    'Сравнить оба пути', 'Что меняется', 'Серия: +1 базовая защита от срыва.',
    'Мягкий (Доверие) или жёсткий (Контроль). Базовые XP и золото одинаковы; различаются тон, строгость и опциональная ставка Контроля. Сменить можно в любой момент.',
    'Просроченный дедлайн: 0 потерь энергии.', 'Клятва Кремню недоступна.',
    'Базовые XP и золото не меняются.', 'Оформление: следует твоим настройкам темы и нарратора.',
    'Серия: 0 базовых защит от пути.', 'Просроченный дедлайн: −5 энергии, максимум −15 в день.',
    'Клятва Кремню: ×1,5 золота при успехе или −25 золота при срыве.',
    'Оформление: по умолчанию включается скин «Система»; настройка нарратора не меняется.',
  ];
  for (const key of keys) {
    const rows = [...app.matchAll(new RegExp("^  '" + re(key) + "': \\{([^\\n]+)\\},$", 'gm'))];
    assert.equal(rows.length, 1, key + ' must have one row');
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(rows[0][1], new RegExp('\\b' + locale + ':'));
  }
  const consequences = between('const PATH_CONSEQUENCES', '\n// Поведенческий дефолт');
  assert.equal((consequences.match(/^    '[^']+',$/gm) || []).length, 10);
  const core = between('// Пути дисциплины: Доверие vs Контроль', '\n  // Companion (Тень)');
  const voice = between('// ══ i18n пласт 2 — Кремінь', '\n  // ══ i18n пласт 2 — Боссы');
  for (const line of (core + voice).split('\n')) {
    const en = (line.match(/ en: (.*?), de:/) || [])[1];
    const de = (line.match(/ de: (.*?), uk:/) || [])[1];
    if (en) assert.doesNotMatch(en, /["«»]/);
    if (de) assert.doesNotMatch(de, /"/);
  }
  assert.match(core, /en: 'Flint smirks: “/);
  assert.match(core, /de: 'Feuerstein grinst: „/);
});

test('v115 authored Tree catalogs remain intact', () => {
  const template = frozenJsonConstant('TREE_AUTHORED_COPY');
  const ladder = frozenJsonConstant('LADDER_AUTHORED_COPY');
  assert.equal(template.version, 1);
  assert.equal(Object.keys(template.archetypeByIcon).length, 11);
  assert.equal(Object.keys(template.rows).length, 77);
  assert.equal(ladder.version, 1);
  assert.equal(Object.keys(ladder.aliasToId).length, 56);
  assert.equal(Object.keys(ladder.variants).length, 43);
  let fields = 0;
  for (const variant of Object.values(ladder.variants)) fields += 1 + variant.tiers.length;
  assert.equal(fields, 261);
  assert.match(app, /TREE_TEMPLATE_COPY_KEY_RE/);
  assert.match(app, /TREE_LADDER_COPY_KEY_RE/);
});
