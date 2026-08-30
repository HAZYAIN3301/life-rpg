'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const INSPIRATION_UI = fs.readFileSync(path.join(ROOT, 'public', 'return-shelf-ui-v1.js'), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('persistent header no longer renders the skills strip', () => {
  const header = between(APP, 'function renderHeader(force = false)', 'function catChips');
  assert.doesNotMatch(header, /topSkills\(|skills-row|class="skill-chip"/);
  assert.doesNotMatch(APP, /<div class="skills-row"/);
  assert.match(header, /class="char-main"/);
});

test('Today support has one unambiguous Shadow owner in all locales', () => {
  assert.match(APP, /'Тень рядом': \{ en: 'Shadow is here', de: 'Schatten ist da', uk: 'Тінь поруч', es: 'Sombra está aquí' \}/);
  const support = between(APP, 'function attentionTodayControlHTML()', 'function attentionPolicyId');
  assert.match(support, /secretary-control-kicker[^\n]+t\('Тень рядом'\)/);
  assert.doesNotMatch(support, /t\('Satoru рядом'\)/);
  assert.match(CSS, /\.secretary-toggle-copy/);
});

test('all v203 authored copy has a RU/EN/DE/UK/ES contract', () => {
  for (const key of [
    'Тень рядом', 'Длительность и сложность', 'Как выбрать сложность?', 'Сфера выбрана',
    'Почему цепляет?', 'Что именно здесь тебя цепляет?', 'Необязательно · до 10 ссылок.', 'Как хранятся ссылки',
  ]) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const row = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(row, new RegExp(locale), `${key}: ${locale}`);
  }
});

test('core quest is labelled and raised without reintroducing a checkbox stripe', () => {
  const row = between(APP, 'function questRow(q)', 'function scheduleQuestTitleDisclosures');
  assert.match(row, /const coreBadge = q\.core \? `<span class="task-core-badge"/);
  assert.match(row, /<span aria-hidden="true">◆<\/span>\$\{esc\(t\('Ядро дня'\)\)\}/);
  assert.match(row, /const titleCell = `<div class="t-title">\$\{coreBadge\}\$\{titleControl\}<\/div>`/);
  assert.doesNotMatch(row, /<span class="t-title">\$\{coreBadge\}\$\{titleControl\}<\/span>/);
  const actions = between(APP, "} else if (action === 'toggle-core')", "} else if (action === 'edit-difficulty')");
  assert.match(actions, /const nextTasks = structuredClone\(State\.tasks\)/);
  assert.match(actions, /await Store\.saveNow\('tasks', nextTasks/);
  assert.ok(actions.indexOf("if (!saved)") < actions.indexOf("sfx(willCore ? 'confirm' : 'select')"));
  assert.match(CSS, /\.task-core-badge\s*\{/);
  assert.match(CSS, /\.card-quests \.task\.is-core\s*\{[^}]*background(?:-color)?\s*:/s);
  assert.match(CSS, /\.card-quests \.task\.is-core\s*\{[^}]*border(?:-color)?\s*:/s);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.today-shell \*[\s\S]*?animation:\s*none !important/);
});

test('quest and calendar forms disclose configuration only after the primary fields', () => {
  assert.match(APP, /<details class="quest-add-options"><summary>\$\{t\('Длительность и сложность'\)\}<\/summary>/);
  assert.match(APP, /<details class="difficulty-help"><summary>\$\{t\('Как выбрать сложность\?'\)\}<\/summary>/);
  assert.doesNotMatch(APP, /<p class="diff-hint muted">/);
  assert.match(APP, /<details class="calendar-add-options"><summary>\$\{esc\(t\('Дополнительные настройки'\)\)\}<\/summary>/);
  assert.match(APP, /class="cal-date-primary"/);
  assert.match(APP, /class="cal-date-meta"/);
  for (const selector of ['.quest-add-options', '.quest-add-options-body', '.difficulty-help',
    '.calendar-add-options', '.calendar-add-options-body', '.cal-date-primary', '.cal-date-meta']) {
    assert.match(CSS, new RegExp(selector.replaceAll('.', '\\\.') + '\\s*\\{'), selector);
  }
  assert.match(CSS, /\.quest-add-options > summary[^}]*min-(?:block-)?size:\s*var\(--touch-min\)/s);
  assert.match(CSS, /\.calendar-add-options > summary[^}]*min-(?:block-)?size:\s*var\(--touch-min\)/s);
});

test('inspiration keeps storage and the optional reason behind explicit disclosures', () => {
  assert.match(INSPIRATION_UI, /<details class="inspiration-reference-storage"><summary>\$\{tr\(t, 'Как хранятся ссылки'\)\}<\/summary>/);
  assert.match(INSPIRATION_UI, /<details class="inspiration-reference-why"\$\{reference\.why \? ' open' : ''\}>/);
  assert.match(INSPIRATION_UI, /Почему цепляет\?'\)\} <span>\$\{tr\(t, 'необязательно'\)\}/);
  assert.doesNotMatch(INSPIRATION_UI, /class="inspiration-reference-head"><p>/);
  const update = between(APP, 'function updateInspirationReferenceUI(', 'function inspirationDraftFromSetupForm');
  assert.match(update, /\/\^https\?:\\\/\\\/\[\^\\s\]\+\$\/i\.test\(url\)/);
  assert.match(update, /why\.open = true; why\.dataset\.autoOpened = 'true'/);
  assert.match(CSS, /\.inspiration-reference-storage\s*\{/);
  assert.match(CSS, /\.inspiration-reference-why\s*\{/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.inspiration-shell \*[\s\S]*?animation:\s*none !important/);
});

test('Wildcard renders six ideas or one selected detail, never six forms at once', () => {
  const ideas = between(APP, 'const BOARD_WILDCARD_IDEAS = [', 'function boardWildcardDraftFromForm');
  assert.equal((ideas.match(/\{ id: '/g) || []).length, 6);
  assert.match(APP, /function boardWildcardDraftFromForm\(form, seed = State\._boardWildcardDraft \|\| \{\}\)/);
  assert.match(APP, /function boardWildcardFieldsHTML\(choice, draft\)/);
  const panel = between(APP, 'function boardV2WildcardPanelHTML()', 'function prepareBoardV2Action');
  assert.match(panel, /const body = choice\s*\? `<form id="board-wildcard-form"[^`]+\$\{boardWildcardFieldsHTML\(choice, draft\)\}[^`]+`\s*:\s*`<div class="board-wildcard-ideas"/s);
  assert.match(panel, /data-action="board-wildcard-select"/);
  assert.match(panel, /data-action="board-wildcard-back"/);
  const actions = between(APP, "} else if (action === 'board-unexpected-open')", "} else if (action === 'board-unexpected-reject')");
  assert.match(actions, /action === 'board-wildcard-select'/);
  assert.match(actions, /action === 'board-wildcard-back'/);
  assert.match(actions, /State\._boardWildcardDraft = boardWildcardDraftFromForm\(form\)/);
  assert.match(actions, /State\._boardFocusAfterCommit = `\[data-action="board-wildcard-select"\]/);
  for (const selector of ['.board-wildcard-ideas', '.board-wildcard-idea', '.board-wildcard-detail', '.board-wildcard-detail-head']) {
    assert.match(CSS, new RegExp(selector.replaceAll('.', '\\\.') + '\\s*\\{'), selector);
  }
});

test('sphere selection closes the suggestion loop with persisted visible feedback', () => {
  const acknowledgement = between(APP, 'function acknowledgeSphereChoice(field, skillId)', 'function updateCatSuggest');
  assert.match(acknowledgement, /form\.dataset\.catTouched = '1'/);
  assert.match(acknowledgement, /cat-chip cat-chip-confirm/);
  assert.match(acknowledgement, /t\('Сфера выбрана'\)/);
  assert.match(acknowledgement, /setTimeout\(\(\) => \{[\s\S]*?box\.innerHTML = ''[\s\S]*?\}, 1600\)/);
  assert.ok((APP.match(/acknowledgeSphereChoice\(/g) || []).length >= 3,
    'helper must cover direct picker and AI suggestion paths');
  assert.ok((APP.match(/id="cat-suggest" class="cat-suggest" role="status" aria-live="polite"/g) || []).length >= 2,
    'Today and Calendar both expose the acknowledgement to assistive technology');
  assert.match(CSS, /\.cat-chip-confirm\s*\{/);
});

test('v203 hierarchy selectors stay responsive, touch-safe and motion-optional', () => {
  const selectors = [
    '.today-support', '.secretary-toggle-copy', '.task-core-badge', '.quest-add-options',
    '.calendar-add-options', '.cal-date-primary', '.inspiration-reference-storage',
    '.inspiration-reference-why', '.board-wildcard-ideas', '.board-wildcard-detail', '.cat-chip-confirm',
  ];
  for (const selector of selectors) assert.match(CSS, new RegExp(selector.replaceAll('.', '\\\.')), selector);
  assert.match(CSS, /@media \(max-width: 600px\)[\s\S]*?\.quest-add-options[\s\S]*?\.calendar-add-options/);
  assert.match(CSS, /@media \(max-width: 600px\)[\s\S]*?\.board-wildcard-ideas/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.today-shell \*[\s\S]*?transition:\s*none !important/);
});

test('new disclosures and hierarchy changes use semantic sound and finite motion only', () => {
  const actions = between(APP, "} else if (action === 'board-unexpected-open')", "} else if (action === 'board-unexpected-reject')");
  assert.match(actions, /board-unexpected-open'[\s\S]*?sfx\('open'\)/);
  assert.match(actions, /board-wildcard-select'[\s\S]*?sfx\('select'\)/);
  assert.match(actions, /board-wildcard-back'[\s\S]*?sfx\('close'\)/);
  const init = between(APP, 'async function init()', '\ninit();');
  assert.match(init, /\.quest-add-options, \.calendar-add-options, \.difficulty-help, \.inspiration-reference-why, \.inspiration-reference-storage/);
  assert.match(init, /e\.isTrusted\) sfx\(panel\.open \? 'open' : 'close'\)/);
  assert.match(init, /\.quest-add-options > summary, \.calendar-add-options > summary, \.difficulty-help > summary, \.inspiration-reference-why > summary, \.inspiration-reference-storage > summary/);
  assert.match(init, /\['Enter', ' '\]\.includes\(e\.key\)[\s\S]*?panel\.open = !panel\.open/);
  assert.match(CSS, /@keyframes hierarchy-reveal/);
  assert.match(CSS, /@keyframes hierarchy-receipt/);
  assert.doesNotMatch(CSS, /hierarchy-(?:reveal|receipt)[^;]*infinite/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.board-wildcard-detail,[\s\S]*?\.cat-chip-confirm/);
});

test('v203 assets remain pinned while the current shell advances coherently', () => {
  assert.match(SW, /const CACHE = 'satoru-v205'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v205'/);
  assert.match(INDEX, /return-shelf-ui-v1\.js\?v=20260829-interface-hierarchy-v203-1/);
  for (const file of ['styles.css', 'app.js']) assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=20260830-guide-tree-v205-1`));
});
