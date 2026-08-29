'use strict';
/* Предложения схваток из детектора границ (DISCIPLINE-ARENA-PLAN §1, вариант C).
 *
 * Логика `suggestFor()` покрыта `fights-v1.test.js`. Здесь — подключение:
 * гейты показа, которые модуль закрыть не может, и правило «создаёт человек». */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

const F = require('../public/fights-v1.js');

const pickFn = app.slice(app.indexOf('function fightSuggestPick('), app.indexOf('function fightSuggestHTML('));
const addH = app.slice(app.indexOf("} else if (action === 'fight-suggest-add')"), app.indexOf("} else if (action === 'fight-won'"));

test('предложение не создаёт схватку само — её создаёт человек кнопкой', () => {
  // Автосоздание превратило бы счёт ⚔ в чужой список, а весь смысл схваток в
  // том, что человек называет СВОИ моменты.
  const html = app.slice(app.indexOf('function fightSuggestHTML('), app.indexOf("function secondsLabel("));
  assert.ok(!html.includes('addFight'), 'разметка не должна создавать схватку');
  assert.match(html, /data-action="fight-suggest-add"/);
  assert.match(html, /data-action="fight-suggest-skip"/);
});

test('точное название и точная длительность видны до нажатия', () => {
  const html = app.slice(app.indexOf('function fightSuggestHTML('), app.indexOf("function secondsLabel("));
  assert.match(html, /esc\(t\(pick\.title\)\)/);
  assert.match(html, /secondsLabel\(pick\.seconds\)/);
});

test('потолок закрывает предложение — предложить непринимаемое значит поставить ловушку', () => {
  assert.match(pickFn, /if \(live\.length >= F\.MAX_FIGHTS\) return null;/);
});

test('`norest` не получает предложения — отдых не схватка', () => {
  // Гейт живёт в модуле; здесь проверяем, что подключение его не обходит.
  assert.equal(F.suggestFor('norest'), null);
  assert.match(pickFn, /if \(!sug \|\| !FIGHT_SUGGEST_COPY\[sug\.suggestionId\]\) return null;/);
  // И что у `norest` нет авторской строки, которой можно было бы его воскресить.
  const copy = app.slice(app.indexOf('const FIGHT_SUGGEST_COPY'), app.indexOf('function fightSuggestSkipped('));
  assert.ok(!copy.includes('norest'), 'у norest не должно быть строки предложения');
});

test('у каждого предложения модуля есть авторская строка, и наоборот', () => {
  const copy = app.slice(app.indexOf('const FIGHT_SUGGEST_COPY'), app.indexOf('function fightSuggestSkipped('));
  const authored = [...copy.matchAll(/'([a-z-]+)':/g)].map((m) => m[1]).filter((k) => k.includes('-'));
  const fromModule = ['nightdebt', 'nostart', 'noend', 'weekend', 'norecover']
    .map((p) => F.suggestFor(p)).filter(Boolean).map((s) => s.suggestionId);
  assert.deepEqual([...authored].sort(), [...fromModule].sort());
});

test('архивированная схватка не предлагается заново', () => {
  // Архив — это «попробовал и отказался». Предложить снова значит не заметить
  // уже данный ответ.
  assert.match(pickFn, /F\.normalize\(st\)\.fights\.some\(\(f\) => f\.fromPattern === pat\.id\)/);
  assert.ok(!pickFn.includes('activeFights'), 'проверять надо ВСЕ схватки, не только активные');
  // Поле, на котором это держится, модуль действительно сохраняет.
  const st = F.addFight(F.emptyState(), { id: 'x', title: 'т', seconds: 10, createdAt: '2026-08-12', fromPattern: 'nightdebt' });
  assert.equal(st.ok, true);
  assert.equal(st.state.fights[0].fromPattern, 'nightdebt');
});

test('«не моё» — окончательный ответ по этому паттерну', () => {
  const skipH = app.slice(app.indexOf("} else if (action === 'fight-suggest-skip')"), app.indexOf("} else if (action === 'fight-won'"));
  assert.match(skipH, /fightSuggestSkipped\(\)\.concat\(\[id\]\)/);
  assert.match(pickFn, /if \(fightSuggestSkipped\(\)\.includes\(pat\.id\)\) return null;/);
  // Отказ по одному паттерну не глушит остальные.
  assert.ok(!app.includes('noFightSuggest'), 'глобального выключателя быть не должно');
});

test('клик пересчитывает предложение, а не доверяет разметке', () => {
  // Между рендером и кликом состояние могло измениться (потолок, та же схватка
  // из другой вкладки), и data-* из DOM — не источник правды.
  assert.match(addH, /const pick = fightSuggestPick\(st, F\.activeFights\(st\)\);/);
  assert.match(addH, /if \(!pick \|\| pick\.pattern !== el\.dataset\.pattern\) \{ render\(\); return; \}/);
});

test('название фиксируется на языке момента принятия', () => {
  // Дальше это СВОЯ схватка человека: переводить её задним числом нельзя,
  // как любое его слово. Тот же приём, что у entry-accept.
  assert.match(addH, /title: t\(pick\.title\)/);
  assert.match(addH, /fromPattern: pick\.pattern/);
});

test('предложение не весомее собственных схваток', () => {
  const block = css.slice(css.indexOf('.fight-suggest {'), css.indexOf('/* ── Развилка §7'));
  assert.match(block, /border-top: 1px solid var\(--line\)/);
  for (const bad of ['--danger', 'background:', 'red']) {
    assert.ok(!block.includes(bad), `предложение выделено сильнее схваток: «${bad}»`);
  }
  assert.match(block, /min-height: 42px/);
});

test('новая copy покрыта всеми пятью языками', () => {
  const keys = [
    'Похоже, этот момент у тебя повторяется. Назвать его схваткой?',
    'Не получилось добавить',
    'Рука к телефону в 23:00', 'Первое действие, когда сел за дело',
    'Закрыть ноутбук в 21:00', 'Первый шаг в выходной',
    'Одно маленькое дело после паузы',
  ];
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`'${esc}'\\s*:\\s*\\{ en:[\\s\\S]{0,900}de:[\\s\\S]{0,900}uk:[\\s\\S]{0,900}es:`), `нет полного словаря для «${key}»`);
  }
});

test('выбор называется тем же словом, что и вердикты вкуса доски', () => {
  // Один и тот же жест в продукте должен называться одинаково — иначе человек
  // учит два словаря вместо одного. И дубля ключа быть не должно.
  const html = app.slice(app.indexOf('function fightSuggestHTML('), app.indexOf("function secondsLabel("));
  assert.match(html, /data-action="fight-suggest-add"[^>]*>\$\{t\('Моё'\)\}/);
  assert.match(html, /data-action="fight-suggest-skip"[^>]*>\$\{t\('Не моё'\)\}/);
  assert.equal((app.match(/^ {2}'Не моё':/gm) || []).length, 1, 'ключ «Не моё» продублирован');
  assert.equal((app.match(/^ {2}'Моё':/gm) || []).length, 1, 'ключ «Моё» продублирован');
  // Ровно те же строки уже используются калибровкой вкуса доски.
  assert.match(app, /data-action="calib-like"[^>]*>\$\{t\('Моё'\)\}/);
});

test('предложение называет фичу её же словом в каждом языке', () => {
  // Фича переведена как «Duels / Duelle / Сутички / Duelos». «fight / Kampf /
  // combate» в предложении читались бы как другая механика, которой нет.
  const line = app.match(/'Похоже, этот момент у тебя повторяется\. Назвать его схваткой\?': \{ ([^}]+) \}/);
  assert.ok(line, 'строка предложения не найдена');
  const feature = app.match(/'Схватки': \{ ([^}]+) \}/)[1];
  for (const loc of ['en', 'de', 'uk', 'es']) {
    // Корень по первым ЧЕТЫРЁМ буквам. Отсечение окончания по правилам одного
    // языка ломается о словоизменение другого («сутички» → «сутичкою»), а пять
    // букв уже режут единственное число («Duels» против «duel»). Это проверка
    // терминологии, а не морфологии — четырёх хватает, чтобы поймать «Kampf».
    const stem = feature.match(new RegExp(`${loc}: '([^']+)'`))[1].slice(0, 4);
    const text = line[1].match(new RegExp(`${loc}: '([^']+)'`))[1];
    assert.ok(new RegExp(stem, 'i').test(text), `${loc}: предложение не использует корень «${stem}» — ${text}`);
  }
});

test('обновлённый offline shell', () => {
  assert.match(sw, /const CACHE = 'satoru-v204'/);
});
