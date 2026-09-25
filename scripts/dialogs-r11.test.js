'use strict';
// R11: диалоги и настоящее содержимое. Старые окна стали диалогами, стартовое содержимое программ —
// на языке интерфейса, имена сфер в подписях переводятся, статусы целей не красят текст.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const NEXT = fs.readFileSync(path.join(root, 'public/design-next-v1.css'), 'utf8');
const fnSource = (name) => { const at = APP.search(new RegExp(`(?:async )?function ${name}\\(`)); assert.ok(at >= 0, name); return APP.slice(at, APP.indexOf('\n}', at) + 2); };
function dictionaries() {
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  const a = APP.indexOf('const DUNGEON_PROGRAMS = [');
  vm.runInContext(APP.slice(a, APP.indexOf('\n];', a) + 3).replace('const DUNGEON_PROGRAMS', 'this.P'), ctx);
  return ctx;
}

test('starter habits and quests of every program exist in all four languages and are created through t()', () => {
  const { I18N, P } = dictionaries();
  const titles = P.flatMap((p) => [...(p.habits || []), ...(p.quests || [])].map((x) => x.title));
  assert.ok(titles.length >= 30);
  for (const title of titles) for (const l of ['en', 'de', 'uk', 'es']) assert.ok(I18N[l][title], `${title} → ${l}`);
  assert.match(fnSource('programHabits'), /title: t\(ph\.title\)/);
  assert.match(fnSource('programTasks'), /title: t\(pq\.title\)/);
});

test('sphere paths and sphere names in labels are shown in the interface language', () => {
  const line = APP.split('\n').find((l) => l.includes("[/^[^›]+(?: › [^›]+)+$/"));
  assert.ok(line, 'dynamic splitter for « › » paths');
  assert.match(fnSource('petName'), /pn\[id\] \|\| sphereNameText\(skillById\(id\)\.name\)/);
  for (const raw of ["aria-label=\"${t('Выше')}: ${esc(sk.name)}\"", "aria-label=\"${esc(t('Убрать') + ': ' + skillLabel(id))}\"", "aria-label=\"${esc(scores.map((s) => s.name).join(', '))}\"", "${nm !== s.name ?"]) {
    assert.ok(!APP.includes(raw), raw);
  }
});

test('legacy windows are real dialogs: role, label, Escape through their close action, focus back to the opener', () => {
  const helper = fnSource('mountLegacyDialog');
  assert.match(helper, /setAttribute\('role', 'dialog'\)/);
  assert.match(helper, /setAttribute\('aria-labelledby', labelledBy\)/);
  assert.match(helper, /event\.key !== 'Escape'[\s\S]*querySelector\(`\[data-action="\$\{closeAction\}"\]`\)\?\.click\(\)/);
  assert.match(fnSource('closeLegacyDialog'), /document\.querySelector\(back\)\?\.focus/);
  for (const [fn, label, close] of [['openCategoryPicker', 'cat-pop-title', 'close-cats'], ['openEntryRitual', 'entry-title', 'entry-close'], ['openSphereGuide', 'sphguide-title', 'sphguide-close']]) {
    const src = fnSource(fn);
    assert.match(src, new RegExp(`id="${label}"`), fn);
    assert.match(src, new RegExp(`mountLegacyDialog\\(ov, \\{ labelledBy: '${label}', closeAction: '${close}'`), fn);
  }
  // Re-rendering the category picker keeps the focused toggle instead of dropping focus.
  assert.equal((APP.match(/reopenLegacyDialog\('cat-pop', \(opts\) => openCategoryPicker\(/g) || []).length, 2);
});

test('dialog copy is translated and status chips keep colour off the text', () => {
  const { I18N } = dictionaries();
  for (const key of ['Открыть связанную цель', 'Это нельзя отменить.', 'Выйти на всех устройствах?', 'Все активные сессии будут завершены. Чтобы вернуться, понадобится войти снова.', 'Долгая ванна со свечами и пеной', 'Редактор внешности', 'с нуля']) {
    for (const l of ['en', 'de', 'uk', 'es']) assert.ok(I18N[l][key], `${key} → ${l}`);
  }
  assert.match(fnSource('goalStatusText'), /emojiFree\(t\(st\.txt\)\)/);
  assert.match(NEXT, /:root\[data-design=next\] \.goal-status\{color:var\(--text\);border:1px solid var\(--line-soft\)\}/);
  assert.match(NEXT, /:root\[data-design=next\] \.rw-cost\{color:var\(--text\)\}/);
  assert.match(NEXT, /:root\[data-design=next\] \.modal-x\{min-width:44px;min-height:44px/);
});
