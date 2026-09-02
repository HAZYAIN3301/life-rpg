'use strict';
/* Развилка §7 «не хочу» ≠ «не знаю как» (DISCIPLINE-ARENA-PLAN §7).
 *
 * Логика выбора дела покрыта `stuck-task-v1.test.js`. Здесь — только то, что
 * появилось при подключении: маршруты двух ответов, однократность вопроса и
 * гейты тона, которые модуль закрыть не может. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

const S = require('../public/stuck-task-v1.js');

const card = app.slice(app.indexOf('function stuckAskHTML('), app.indexOf('async function stuckAiStep('));
const handlers = app.slice(app.indexOf("} else if (action === 'stuck-want')"), app.indexOf("} else if (action === 'entry-open')"));

test('вопрос стоит выше «Захода», потому что «Заход» — один из двух его ответов', () => {
  // Показать «Заход» до вопроса значит ответить за человека «не хочу» и увести
  // того, у кого на самом деле «не знаю как».
  assert.match(app, /\{ id: 'stuckAsk', tier: State\._stuckSplit \? -1 : 0\.5, html: stuckNudge \}/);
  const order = app.indexOf("id: 'stuckAsk'");
  const entry = app.indexOf("{ id: 'entry', tier: 1, html: entryNudge }");
  assert.ok(order > 0 && entry > order, 'stuckAsk должен стоять до entry в списке');
});

test('открытая форма разбиения забирает арбитраж целиком', () => {
  // Иначе другой нудж подменил бы экран человеку, который начал отвечать.
  assert.match(app, /State\._stuckSplit \? -1 : 0\.5/);
  assert.match(card, /if \(State\._stuckSplit === pick\.id\)/);
});

test('оба ответа имеют ровно одинаковый вес — диагноз ставит человек', () => {
  const want = card.match(/data-action="stuck-want"[^>]*/)[0];
  const how = card.match(/data-action="stuck-how"[^>]*/)[0];
  const cls = (s) => (app.slice(app.lastIndexOf('<button', app.indexOf(s)), app.indexOf(s)).match(/class="([^"]+)"/) || [])[1];
  assert.ok(want && how);
  assert.equal(cls('data-action="stuck-want"'), cls('data-action="stuck-how"'));
  // Ни один из ответов не выделен цветом или весом в стилях.
  const block = css.slice(css.indexOf('.stuck-card {'), css.indexOf('/* Карточка §12'));
  for (const bad of ['--danger', 'red', 'stuck-want', 'stuck-how']) {
    assert.ok(!block.includes(bad), `ответ выделен в CSS: «${bad}»`);
  }
});

test('«не хочу» ведёт в «Заход» по КОНКРЕТНОМУ делу, а не в общий ритуал', () => {
  // Общий ритуал по сфере создал бы «🕯 Заход: …» рядом — то есть обошёл бы
  // дело ещё раз, теперь с помощью приложения.
  assert.match(handlers, /State\._entryTask = id;/);
  assert.match(handlers, /openEntryRitual\(\); track\('stuck:want'\);/);
});

test('«не знаю как» создаёт отдельный шаг, застрявшее дело остаётся', () => {
  // Дробление и есть лекарство §7 — этим ветка отличается от «Захода»,
  // который намеренно не создаёт ничего.
  assert.match(handlers, /State\.tasks\.push\(\{/);
  assert.match(handlers, /skillId: q\.skillId/);
  assert.ok(!/State\.tasks = State\.tasks\.filter/.test(handlers), 'застрявшее дело не должно удаляться');
  assert.ok(!/q\.done = true/.test(handlers), 'застрявшее дело не должно закрываться за человека');
});

test('ИИ только заполняет поле — дело создаёт человек', () => {
  // Границу среза брать по СЛЕДУЮЩЕЙ функции, а не по далёкому обработчику:
  // иначе срез накрывает и `stuck-step-add`, который создаёт дело законно, и
  // проверка ловит собственную неаккуратность вместо дефекта.
  const ai = app.slice(app.indexOf('async function stuckAiStep('), app.indexOf('function renderToday() {'));
  assert.ok(ai.length > 400 && ai.length < 2500, `срез не похож на одну функцию: ${ai.length} символов`);
  assert.match(ai, /field\.value = ans\.slice\(0, 110\)/);
  assert.ok(!ai.includes('State.tasks.push'), 'ИИ не имеет права создавать дело сам');
  assert.ok(!ai.includes("Store.save('tasks'"), 'ИИ не пишет в дела');
});

test('без ключа форма работает целиком — гейт только на кнопке ИИ', () => {
  const split = card.slice(card.indexOf('State._stuckSplit === pick.id'), card.indexOf('const item ='));
  assert.match(split, /id="stuck-step"/);
  assert.match(split, /data-action="stuck-step-add"/);
  // canUseAi() закрывает ровно одну кнопку, а не поле и не добавление.
  const gated = split.match(/\$\{canUseAi\(\) \? `([\s\S]*?)` : ''\}/);
  assert.ok(gated, 'кнопка ИИ должна быть под canUseAi()');
  assert.ok(gated[1].includes('stuck-ai-step'));
  assert.ok(!gated[1].includes('stuck-step-add'), 'добавление шага не должно зависеть от ключа');
});

test('вопрос задаётся один раз, повтор — только после ещё ASK_AFTER переносов', () => {
  assert.match(app, /return \(Number\(q\.postponedCount\) \|\| 0\) >= a \+ S\.ASK_AFTER;/);
  // Поведение фильтра на реальном модуле.
  const today = '2026-08-12';
  const mk = (id, n) => ({ id, date: '2026-08-01', title: 'x', postponedCount: n });
  const pool = [mk('a', 4)];
  assert.equal(S.stuckPick(pool, today).id, 'a');
  const askedAt = 4;
  const after = (n) => pool.map((q) => ({ ...q, postponedCount: n })).filter((q) => q.postponedCount >= askedAt + S.ASK_AFTER);
  assert.equal(after(5).length, 0, 'через один перенос спрашивать рано');
  assert.equal(after(7).length, 1, 'через ASK_AFTER переносов — новый эпизод');
});

test('отказ ничего не стоит и нигде не считается', () => {
  // Счётчик отказов немедленно стал бы материалом для вины.
  assert.match(handlers, /action === 'stuck-later'/);
  for (const bad of ['declineCount', 'skipCount', 'refused', 'ignoredCount']) {
    assert.ok(!handlers.includes(bad), `появился счётчик отказов: «${bad}»`);
  }
  // «Позже» пишет ровно ту же отметку, что и ответ, — не отдельную запись.
  assert.match(handlers, /stuckNoteAsked\(id, q \? \(Number\(q\.postponedCount\) \|\| 0\) : 0\);/);
});

test('гейт «без единой минуты работы» остался за модулем и работает', () => {
  // Дело, над которым уже сидели, — большая задача, а не избегание.
  const t0 = '2026-08-12';
  assert.ok(S.isStuck({ id: 'a', date: '2026-08-01', postponedCount: 3 }, t0));
  assert.equal(S.isStuck({ id: 'a', date: '2026-08-01', postponedCount: 3, actualMin: 12 }, t0), false);
  assert.equal(S.isStuck({ id: 'a', date: '2026-08-01', postponedCount: 3, startTime: '09:00' }, t0), false);
  assert.equal(S.isStuck({ id: 'a', date: '2026-08-01', postponedCount: 3, amnesty: t0 }, t0), false);
});

test('название дела экранируется, длинное не рвёт вёрстку', () => {
  assert.match(css, /\.stuck-title \{[\s\S]*?overflow-wrap: anywhere;/);
  assert.equal((card.match(/<p class="stuck-title" data-noi18n>\$\{esc\(taskDisplayTitle\(q\)\)\}<\/p>/g) || []).length, 2);
});

test('пользовательское название не переводится словарём', () => {
  // Без data-noi18n дело, названное «Позже» или «Награды», перевёл бы DOM-проход:
  // это уже не системный текст, а слова человека, и трогать их нельзя.
  for (const m of card.match(/class="stuck-title"[^>]*/g) || []) {
    assert.ok(m.includes('data-noi18n'), `название без защиты: ${m}`);
  }
  assert.equal((card.match(/class="stuck-title"/g) || []).length, 2, 'оба состояния карточки показывают название');
});

test('немецкие кавычки те же, что у соседей по словарю', () => {
  // В проекте принято „…“ (см. «System», «nützliche»); прямая ASCII-кавычка
  // выбивается из типографики и читается как чужая строка.
  const de = app.match(/de: '(Ist das[^']*)'/);
  assert.ok(de, 'строка вопроса не найдена');
  assert.ok(!de[1].includes('"'), `прямая кавычка в немецком: ${de[1]}`);
  assert.match(de[1], /„Ich will nicht“/);
});

test('новая copy покрыта всеми пятью языками', () => {
  const keys = [
    'переносов', 'висит', 'Не хочу', 'Не знаю как', 'Добавить шаг', 'Не сейчас', 'думаю…',
    'Это «не хочу» — или «не знаю как»?',
    '«Не знаю как» — не про характер. Оно лечится не мотивацией, а первым шагом, в котором нет неоднозначности.',
    'Первый шаг, после которого станет понятно, что делать дальше',
    'Например: открыть телефон и снять 15 секунд, ничего не публикуя',
    'Пусть Тень предложит шаг', 'Не получилось — напиши шаг сам',
    'Проверь и поправь — добавится только по твоей кнопке',
    'Напиши шаг — одной строкой',
  ];
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`'${esc}'\\s*:\\s*\\{ en:[\\s\\S]{0,900}de:[\\s\\S]{0,900}uk:[\\s\\S]{0,900}es:`), `нет полного словаря для «${key}»`);
  }
  // «Позже» переиспользуется из уже существующей строки, а не дублируется.
  assert.equal((app.match(/^ {2}'Позже':/gm) || []).length, 1);
});

test('обновлённый offline shell', () => {
  assert.match(sw, /const CACHE = 'satoru-v222'/);
});
