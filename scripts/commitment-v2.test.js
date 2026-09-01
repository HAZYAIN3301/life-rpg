'use strict';

/* Уговор v2: вид «внимание» и миграция v1 без потери истории.
 *
 * Что здесь на самом деле проверяется. v2 — отдельный файл, копия v1 с добавками,
 * и главный риск такой схемы не в добавках, а в РАСХОЖДЕНИИ: копия однажды начнёт
 * считать серию иначе, чем оригинал, и никто этого не заметит. Поэтому центральный
 * тест — не «поля на месте», а поведенческая эквивалентность двух модулей на одних
 * и тех же v1-данных по каждой общей функции.
 *
 * Второй риск — тихая потеря. Первый черновик v2 хранил журнал булевыми вместо
 * 'win'|'miss' и стёр бы всю историю отметок при первом чтении реального файла.
 * Тест ниже воспроизводит именно этот случай.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V1 = require('../public/commitment-v1.js');
const V2 = require('../public/commitment-v2.js');

const SRC = path.join(__dirname, '..', 'public/commitment-v2.js');

/* Реальное по форме состояние v1: все пять видов, все необязательные поля,
 * архивный уговор, бюджет промахов и журнал за несколько дней. */
function v1State() {
  return {
    version: 1,
    mode: 'школа',
    items: [
      { id: 'c1', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю до школы',
        edge: { kind: 'time', at: '07:00' }, decidedOn: '2026-08-20',
        budget: { misses: 2, perDays: 7 }, core: true, modes: [] },
      { id: 'c2', kind: 'edge', title: 'Ноутбук закрыт в 22:30', win: 'высыпаюсь',
        edge: { kind: 'time', at: '22:30' }, core: true, modes: ['школа'] },
      { id: 'c3', kind: 'step', title: 'Первая строка реферата', win: 'не откладываю',
        edge: { kind: 'trigger', on: 'после завтрака' }, core: false, modes: [] },
      { id: 'c4', kind: 'care', title: 'Съесть до работы', win: 'не срываюсь к вечеру',
        edge: { kind: 'none' }, core: true, modes: [] },
      { id: 'c5', kind: 'moment', title: 'Рука тянется к телефону', win: 'не проваливаюсь',
        edge: { kind: 'window', from: '09:00', to: '13:00' }, core: false, modes: ['школа', 'каникулы'] },
      { id: 'c6', kind: 'care', title: 'Прогулка', win: 'голова яснее',
        edge: { kind: 'none' }, core: true, modes: [], archivedAt: '2026-08-25' },
    ],
    log: {
      '2026-08-28': { c1: 'win', c2: 'miss', c3: 'win' },
      '2026-08-29': { c1: 'win', c2: 'win' },
      '2026-08-30': { c1: 'miss', c4: 'win', c5: 'miss' },
      '2026-08-31': { c1: 'win', c2: 'win', c3: 'miss', c4: 'win' },
    },
  };
}

test('🔴 миграция не теряет ни одного уговора и ни одной отметки', () => {
  const before = v1State();
  const { state, migrated, dropped } = V2.migrate(before);

  assert.strictEqual(migrated, true);
  assert.deepStrictEqual(dropped, [], 'на честных v1-данных терять нечего');
  assert.strictEqual(state.version, 2);

  // Уговоры: те же id, и каждое поле дожило.
  const v1items = V1.normalize(before).items;
  assert.strictEqual(state.items.length, v1items.length);
  for (const old of v1items) {
    const now = state.items.find((i) => i.id === old.id);
    assert.ok(now, `уговор пропал при миграции: ${old.id}`);
    assert.deepStrictEqual(now, old, `уговор изменился при миграции: ${old.id}`);
  }

  // Журнал: побайтово тот же. Это та самая история, ради которой миграция и пишется.
  assert.deepStrictEqual(state.log, V1.normalize(before).log);
  assert.strictEqual(state.mode, 'школа', 'режим дня не сброшен');
});

test('🔴 словарь журнала остался win/miss — перевод в булевы стёр бы всю историю', () => {
  // Ровно та ошибка, что была в первом черновике v2.
  const { state } = V2.migrate(v1State());
  const values = new Set();
  for (const day of Object.values(state.log)) for (const v of Object.values(day)) values.add(v);
  assert.deepStrictEqual([...values].sort(), ['miss', 'win']);
  assert.strictEqual(V2.outcomeOf(state, 'c1', '2026-08-30'), 'miss');
});

test('🔴 v1 и v2 ведут себя одинаково на v1-данных', () => {
  // Защита от расхождения копий: не поля, а результаты каждой общей функции.
  const s1 = V1.normalize(v1State());
  const s2 = V2.migrate(v1State()).state;
  const days = ['2026-08-28', '2026-08-30', '2026-08-31', '2026-09-01'];
  const modes = ['школа', 'каникулы', undefined];

  for (const day of days) {
    for (const mode of modes) {
      assert.deepStrictEqual(
        V2.dueOn(s2, day, mode).map((i) => i.id), V1.dueOn(s1, day, mode).map((i) => i.id),
        `dueOn разошлись: ${day}/${mode}`);
      assert.deepStrictEqual(
        V2.coreOf(s2, day, mode).map((i) => i.id), V1.coreOf(s1, day, mode).map((i) => i.id), 'coreOf');
      assert.deepStrictEqual(
        V2.extrasOf(s2, day, mode).map((i) => i.id), V1.extrasOf(s1, day, mode).map((i) => i.id), 'extrasOf');
      assert.deepStrictEqual(
        V2.unsettled(s2, day, mode).map((i) => i.id), V1.unsettled(s1, day, mode).map((i) => i.id), 'unsettled');
      assert.deepStrictEqual(V2.dayScore(s2, day, mode), V1.dayScore(s1, day, mode), `dayScore: ${day}/${mode}`);
    }
    for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'нет-такого']) {
      assert.deepStrictEqual(V2.streakOf(s2, id, day), V1.streakOf(s1, id, day), `streakOf: ${id}@${day}`);
      assert.strictEqual(V2.outcomeOf(s2, id, day), V1.outcomeOf(s1, id, day), `outcomeOf: ${id}@${day}`);
    }
  }
});

test('🔴 бюджет промахов пережил миграцию — иначе серия порвалась бы молча', () => {
  const s2 = V2.migrate(v1State()).state;
  const c1 = s2.items.find((i) => i.id === 'c1');
  assert.deepStrictEqual(c1.budget, { misses: 2, perDays: 7 });
  // Промах 30-го прощён бюджетом, поэтому серия продолжается сквозь него.
  const st = V2.streakOf(s2, 'c1', '2026-08-31');
  assert.strictEqual(st.forgiven, 1, 'промах прощён, а не проигнорирован');
  assert.ok(st.streak >= 3, `серия должна пережить прощённый промах, а не оборваться: ${st.streak}`);
  assert.ok(st.recorded < st.covered, 'честность: записано меньше, чем охвачено');
});

test('миграция идемпотентна: повторный вызов ничего не меняет', () => {
  const once = V2.migrate(v1State());
  const twice = V2.migrate(once.state);
  assert.deepStrictEqual(twice.state, once.state);
  assert.strictEqual(twice.migrated, false, 'второй раз мигрировать нечего');
});

test('🔴 испорченная запись попадает в dropped, а не исчезает молча', () => {
  const broken = v1State();
  broken.items.push({ id: 'c7', kind: 'anchor', title: 'Без выигрыша' });       // нет win
  broken.items.push({ id: 'c8', kind: 'выдуманный', title: 'X', win: 'Y' });    // чужой вид
  broken.items.push({ id: 'c1', kind: 'care', title: 'Дубль', win: 'Z' });      // дубль id
  const { state, dropped } = V2.migrate(broken);
  assert.strictEqual(state.items.length, 6, 'здоровые уговоры не пострадали');
  assert.deepStrictEqual(dropped.map((d) => [d.id, d.why]).sort(),
    [['c1', 'duplicate'], ['c7', 'invalid'], ['c8', 'invalid']]);
});

test('мусор вместо состояния даёт пустое v2, а не исключение', () => {
  for (const junk of [null, undefined, 'строка', 42, []]) {
    const r = V2.migrate(junk);
    assert.strictEqual(r.state.version, 2);
    assert.deepStrictEqual(r.state.items, []);
    assert.strictEqual(r.migrated, false);
  }
});

test('🔴 attention — новый вид, и он живёт только в v2', () => {
  const draft = { id: 'a1', kind: 'attention', title: 'TikTok только чтобы выложить',
    win: 'вечер остаётся мой', target: 'tiktok', edge: { kind: 'duration', minutes: 12 } };
  assert.strictEqual(V1.add(V1.emptyState(), draft).ok, false, 'v1 не знает этого вида — файл не тронут');
  const r = V2.add(V2.emptyState(), draft);
  assert.strictEqual(r.ok, true);
  const item = r.state.items[0];
  assert.strictEqual(item.target, 'tiktok');
  assert.deepStrictEqual(item.edge, { kind: 'duration', minutes: 12 });
});

test('граница длительностью принимает минуты и отбивает бессмыслицу', () => {
  const make = (minutes) => V2.add(V2.emptyState(),
    { id: 'a', kind: 'attention', title: 'T', win: 'W', edge: { kind: 'duration', minutes } }).state.items[0].edge;
  assert.deepStrictEqual(make(12), { kind: 'duration', minutes: 12 });
  assert.deepStrictEqual(make(0), { kind: 'none' }, 'ноль минут — не граница');
  assert.deepStrictEqual(make(-5), { kind: 'none' });
  assert.deepStrictEqual(make(99999), { kind: 'none' }, 'опечатка не становится «десять часов можно»');
  assert.deepStrictEqual(make('двенадцать'), { kind: 'none' });
});

test('🔴 выигрыш обязателен и у attention — гейт v1 не ослаблен', () => {
  const r = V2.add(V2.emptyState(), { id: 'a1', kind: 'attention', title: 'TikTok', target: 'tiktok' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'invalid', 'граница без названного выигрыша производит вину, а не движение');
});

test('🔴 target — ярлык человека, а не адрес: у прочих видов его нет', () => {
  const s = V2.add(V2.emptyState(),
    { id: 'c1', kind: 'anchor', title: 'Подъём', win: 'высыпаюсь', target: 'https://tiktok.com/@x' }).state;
  assert.strictEqual('target' in s.items[0], false, 'target существует только у attention');
  const long = V2.add(V2.emptyState(),
    { id: 'a1', kind: 'attention', title: 'T', win: 'W', target: 'я'.repeat(200) }).state.items[0];
  assert.strictEqual(long.target.length, V2.MAX_TARGET);
});

test('🔴 bestFor цитирует уговор про то самое занятие', () => {
  let s = V2.emptyState();
  s = V2.add(s, { id: 'c1', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю' }).state;
  s = V2.add(s, { id: 'a1', kind: 'attention', title: 'Игры не после 22:00', win: 'сплю', target: 'игры' }).state;
  s = V2.add(s, { id: 'a2', kind: 'attention', title: 'TikTok двенадцать минут', win: 'вечер мой', target: 'tiktok' }).state;

  assert.strictEqual(V2.bestFor(s, 'tiktok').id, 'a2', 'совпавший ярлык важнее прочего');
  assert.strictEqual(V2.bestFor(s, 'TikTok').id, 'a2', 'регистр ярлыка не важен');
  assert.strictEqual(V2.bestFor(s, 'ютуб').id, 'a1', 'нет точного — любой attention');
  assert.strictEqual(V2.bestFor(s, '').id, 'a1');
});

test('🔴 bestFor не выдумывает решение, которого человек не принимал', () => {
  assert.strictEqual(V2.bestFor(V2.emptyState(), 'tiktok'), null, 'нет уговоров — нет цитаты');
  // Архивный уговор не цитируется: человек от него отказался.
  let s = V2.add(V2.emptyState(), { id: 'a1', kind: 'attention', title: 'T', win: 'W', target: 'tiktok' }).state;
  s = V2.archive(s, 'a1', '2026-08-30');
  assert.strictEqual(V2.bestFor(s, 'tiktok'), null);
});

test('bestFor уважает режим дня, когда день назван', () => {
  let s = V2.emptyState();
  s = V2.add(s, { id: 'a1', kind: 'attention', title: 'Только на каникулах', win: 'W', target: 'игры', modes: ['каникулы'] }).state;
  s = V2.add(s, { id: 'c1', kind: 'anchor', title: 'Подъём', win: 'успеваю' }).state;
  assert.strictEqual(V2.bestFor(s, 'игры', '2026-09-01', 'школа').id, 'c1', 'вне своего режима уговор не цитируется');
  assert.strictEqual(V2.bestFor(s, 'игры', '2026-09-01', 'каникулы').id, 'a1');
});

test('🔴 молчание не поражение и в v2', () => {
  let s = V2.add(V2.emptyState(), { id: 'a1', kind: 'attention', title: 'T', win: 'W', target: 'tiktok' }).state;
  assert.strictEqual(V2.outcomeOf(s, 'a1', '2026-09-01'), null);
  assert.deepStrictEqual(V2.dayScore(s, '2026-09-01').silent, 1, 'неотмеченное считается молчанием, не промахом');
  assert.strictEqual(V2.unsettled(s, '2026-09-01').length, 1);
  // Снять отметку = вернуться к молчанию, а не к поражению.
  s = V2.mark(s, 'a1', '2026-09-01', 'miss');
  s = V2.clearMark(s, 'a1', '2026-09-01');
  assert.strictEqual(V2.outcomeOf(s, 'a1', '2026-09-01'), null);
});

test('🔴 в модуле нет ни начислений, ни штрафов, ни блокировок', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const lower = code.toLowerCase();
  // Латинские термины ищутся как целые слова: подстрочный поиск ловил «xp» внутри
  // «expose» и давал ложное падение. Кириллические — просто подстрокой: они ни во
  // что законное не вкладываются, а \b на кириллице в JS молча не работает.
  for (const bad of ['xp', 'gold', 'penalty', 'block', 'damage', 'streakdamage']) {
    const re = new RegExp('(?<![a-z])' + bad + '(?![a-z])');
    assert.strictEqual(re.test(lower), false, `провал уговора не должен ничего отнимать: «${bad}»`);
  }
  for (const bad of ['золот', 'штраф', 'заблок', 'урон', 'наказ']) {
    assert.strictEqual(lower.includes(bad), false, `провал уговора не должен ничего отнимать: «${bad}»`);
  }
});

test('модуль не читает State, DOM, сеть и часы', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/', 'Date.now', 'localStorage']) {
    assert.strictEqual(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
});

test('🔴 в модуле нет ASCII-границы слова — она молча не работает на кириллице', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.strictEqual(code.includes('\\b'), false);
});

test('🔴 файл v1 не изменён этой задачей', () => {
  // v2 существует отдельным файлом именно ради этого: старые данные читает старый
  // проверенный код, и его двадцать тестов продолжают его же и проверять.
  const v1src = fs.readFileSync(path.join(__dirname, '..', 'public/commitment-v1.js'), 'utf8');
  assert.strictEqual(v1src.includes('attention'), false, 'v1 остался без нового вида');
  assert.strictEqual(v1src.includes('version: 2'), false);
  assert.deepStrictEqual(Object.keys(V1.KINDS), [...V2.V1_KINDS], 'список видов v1 не тронут');
});
