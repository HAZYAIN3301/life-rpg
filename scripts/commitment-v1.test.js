'use strict';
/* Уговор — примитив «решение, принятое заранее, с явной границей».
 *
 * Тест сторожит не столько арифметику, сколько ЭТИЧЕСКИЕ гейты: именно они теряются
 * первыми при рефакторинге, и именно их потеря превращает Satoru в машину вины, против
 * которой написан весь ALTERNEYT. Каждый такой тест помечен 🔴 и объясняет, почему
 * поведение именно такое.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/commitment-v1.js');

const draft = (over = {}) => Object.assign({
  id: 'wake', kind: 'anchor', title: 'Подъём 07:10',
  win: 'день начинается с меня, а не с телефона',
  edge: { kind: 'time', at: '07:10' },
}, over);

function withItem(over) {
  const r = C.add(C.emptyState(), draft(over));
  assert.equal(r.ok, true, 'заготовка теста не добавилась');
  return r.state;
}

test('нормализация переживает мусор вместо состояния', () => {
  for (const junk of [null, undefined, 42, 'нет', [], { items: 'не массив' }, { log: [] }]) {
    const s = C.normalize(junk);
    assert.equal(s.version, 1);
    assert.deepEqual(s.items, []);
    assert.deepEqual(s.log, {});
    assert.equal(s.mode, C.DEFAULT_MODE);
  }
});

test('🔴 уговор без названного выигрыша не принимается', () => {
  // Гейт §5 плана границ: «каждая граница обязана нести заявленный выигрыш, а не
  // только норму». Норма без выигрыша — это ещё один способ быть собой недовольным.
  assert.equal(C.add(C.emptyState(), draft({ win: '' })).ok, false);
  assert.equal(C.add(C.emptyState(), draft({ win: '   ' })).ok, false);
  delete_win: {
    const d = draft(); delete d.win;
    assert.equal(C.add(C.emptyState(), d).ok, false);
  }
  assert.equal(C.add(C.emptyState(), draft()).ok, true, 'с выигрышем — принимается');
});

test('вид уговора — закрытый список, чужой вид отклоняется', () => {
  assert.equal(C.add(C.emptyState(), draft({ kind: 'whatever' })).ok, false);
  for (const kind of Object.keys(C.KINDS)) {
    assert.equal(C.add(C.emptyState(), draft({ id: kind, kind })).ok, true, `вид ${kind} должен приниматься`);
  }
});

test('дубликат и потолок не пускают список разрастись в шум', () => {
  let s = C.emptyState();
  for (let i = 0; i < C.MAX_ITEMS; i += 1) {
    const r = C.add(s, draft({ id: 'i' + i }));
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(C.add(s, draft({ id: 'ещё' })).error, 'limit');
  assert.equal(C.add(s, draft({ id: 'i0' })).error, 'duplicate');
});

test('🔴 в модуле нет ни одной функции, начисляющей или отнимающей', () => {
  // Провал уговора обязан быть бесплатным. Проверяем не намерение, а поверхность:
  // если появится функция про XP/золото/штраф — этот тест упадёт раньше, чем она
  // доедет до пользователя.
  const surface = Object.keys(C).join(' ').toLowerCase();
  for (const forbidden of ['xp', 'gold', 'золот', 'penalt', 'штраф', 'punish', 'damage', 'streakbreak']) {
    assert.equal(surface.includes(forbidden), false, `в API появилось «${forbidden}» — уговор начал наказывать`);
  }
});

test('🔴 неотмеченный день не считается проигранным', () => {
  // Молчание — не поражение (тот же гейт, что в fights-v1).
  let s = withItem();
  s = C.mark(s, 'wake', '2026-08-20', 'win');
  s = C.mark(s, 'wake', '2026-08-25', 'win');
  // Между ними четыре дня молчания — серия не должна порваться.
  const st = C.streakOf(s, 'wake', '2026-08-25');
  assert.equal(st.streak, 2, 'молчание порвало серию');
  assert.equal(st.recorded, 2);
});

test('🔴 серия не даёт соврать: рядом со streak всегда видно, сколько реально записано', () => {
  // Этика «не наказывать» не даёт права на приятную неправду. Без этого поля
  // интерфейс мог бы показать «2 подряд», умолчав, что это 2 записи за 6 дней.
  let s = withItem();
  s = C.mark(s, 'wake', '2026-08-20', 'win');
  s = C.mark(s, 'wake', '2026-08-25', 'win');
  const st = C.streakOf(s, 'wake', '2026-08-25', 6);
  assert.equal(st.streak, 2);
  assert.equal(st.recorded, 2, 'записанных дней должно быть видно');
  assert.equal(st.covered, 6, 'охваченное окно должно быть видно');
  assert.ok(st.recorded < st.covered, 'разрыв между записанным и охваченным обязан быть различим');
});

test('промах без бюджета заканчивает серию, но ничего не отнимает', () => {
  let s = withItem();
  s = C.mark(s, 'wake', '2026-08-25', 'win');
  s = C.mark(s, 'wake', '2026-08-24', 'miss');
  s = C.mark(s, 'wake', '2026-08-23', 'win');
  assert.equal(C.streakOf(s, 'wake', '2026-08-25').streak, 1, 'серия должна начаться заново после промаха');
});

test('🔴 бюджет промахов прощает поздний вечер и не рвёт серию', () => {
  // §13 брифа: без бюджета серия по подъёму рвётся на первом же тренировочном
  // вечере, и человек бросает саму затею. Один промах на семь дней — прощается.
  let s = withItem({ budget: { misses: 1, perDays: 7 } });
  s = C.mark(s, 'wake', '2026-08-25', 'win');
  s = C.mark(s, 'wake', '2026-08-24', 'miss');   // тренировочный вечер
  s = C.mark(s, 'wake', '2026-08-23', 'win');
  s = C.mark(s, 'wake', '2026-08-22', 'win');
  const st = C.streakOf(s, 'wake', '2026-08-25');
  assert.equal(st.streak, 3, 'промах в пределах бюджета обязан прощаться');
  assert.equal(st.forgiven, 1);
});

test('сверх бюджета серия всё-таки заканчивается', () => {
  let s = withItem({ budget: { misses: 1, perDays: 7 } });
  s = C.mark(s, 'wake', '2026-08-25', 'win');
  s = C.mark(s, 'wake', '2026-08-24', 'miss');
  s = C.mark(s, 'wake', '2026-08-23', 'miss');   // второй за то же окно — уже сверх
  s = C.mark(s, 'wake', '2026-08-22', 'win');
  assert.equal(C.streakOf(s, 'wake', '2026-08-25').streak, 1);
});

test('битый бюджет игнорируется, а не роняет модуль', () => {
  for (const bad of [{ misses: 0, perDays: 7 }, { misses: 99, perDays: 7 }, { misses: 1, perDays: 1 }, 'нет', null]) {
    const r = C.add(C.emptyState(), draft({ id: 'b', budget: bad }));
    assert.equal(r.ok, true);
    assert.equal(C.activeItems(r.state)[0].budget, undefined, 'негодный бюджет не должен сохраняться');
  }
});

test('режимы дня: ядро живёт везде, расширение — только в своём режиме', () => {
  // §12 брифа: общее ядро + разные надстройки, без ручной пересборки при смене
  // школа/каникулы/поездка.
  let s = C.emptyState();
  s = C.add(s, draft({ id: 'core', modes: [] })).state;
  s = C.add(s, draft({ id: 'school-only', modes: ['school'], core: false })).state;

  const inSchool = C.dueOn(s, '2026-09-02', 'school').map((i) => i.id).sort();
  const inTrip = C.dueOn(s, '2026-09-02', 'trip').map((i) => i.id);
  assert.deepEqual(inSchool, ['core', 'school-only']);
  assert.deepEqual(inTrip, ['core'], 'расширение чужого режима не должно всплывать в поездке');

  assert.deepEqual(C.coreOf(s, '2026-09-02', 'school').map((i) => i.id), ['core']);
  assert.deepEqual(C.extrasOf(s, '2026-09-02', 'school').map((i) => i.id), ['school-only']);
});

test('setMode переключает режим и не трогает уговоры', () => {
  let s = C.add(C.emptyState(), draft()).state;
  s = C.setMode(s, 'trip');
  assert.equal(s.mode, 'trip');
  assert.equal(C.activeItems(s).length, 1);
  assert.equal(C.setMode(s, '   ').mode, C.DEFAULT_MODE, 'пустой режим падает в дефолт');
});

test('уговор не всплывает раньше дня, когда его решили', () => {
  const s = C.add(C.emptyState(), draft({ id: 'step', kind: 'step', decidedOn: '2026-08-25' })).state;
  assert.equal(C.dueOn(s, '2026-08-24').length, 0, 'решение из будущего не может быть живо вчера');
  assert.equal(C.dueOn(s, '2026-08-25').length, 1);
});

test('архивация прячет уговор с этого дня, но сохраняет историю', () => {
  let s = withItem();
  s = C.mark(s, 'wake', '2026-08-20', 'win');
  s = C.archive(s, 'wake', '2026-08-25');
  assert.equal(C.dueOn(s, '2026-08-25').length, 0);
  assert.equal(C.dueOn(s, '2026-08-20').length, 1, 'до архивации уговор был жив');
  assert.equal(C.outcomeOf(s, 'wake', '2026-08-20'), 'win', 'история обязана пережить архивацию');
  assert.equal(C.activeItems(s).length, 0);
});

test('🔴 пересмотр меняет границу без проигрыша и сохраняет объяснимую историю', () => {
  const original = withItem({ edge: { kind: 'time', at: '07:10' } });
  const result = C.revise(original, 'wake', { edge: { kind: 'time', at: '07:30' } }, '2026-08-25');
  assert.equal(result.ok, true);
  const item = result.state.items[0];
  assert.deepEqual(item.edge, { kind: 'time', at: '07:30' });
  assert.equal(item.revisedOn, '2026-08-25');
  assert.deepEqual(item.history, [{
    type: 'revised', day: '2026-08-25',
    from: { kind: 'time', at: '07:10' }, to: { kind: 'time', at: '07:30' },
  }]);
  assert.equal(C.outcomeOf(result.state, 'wake', '2026-08-25'), null, 'revision is not a miss');
  assert.deepEqual(original.items[0].edge, { kind: 'time', at: '07:10' }, 'source state was mutated');
});

test('🔴 уговор можно снять бесплатно, не стирая его историю', () => {
  const original = withItem();
  const result = C.release(original, 'wake', '2026-08-25');
  assert.equal(result.ok, true);
  assert.equal(C.activeItems(result.state).length, 0);
  assert.equal(result.state.items[0].archivedAt, '2026-08-25');
  assert.deepEqual(result.state.items[0].history, [{ type: 'released', day: '2026-08-25' }]);
  assert.equal(C.outcomeOf(result.state, 'wake', '2026-08-25'), null, 'release is not a miss');
});

test('битый пересмотр и повторное снятие fail closed без мутации', () => {
  const original = withItem();
  assert.equal(C.revise(original, 'missing', { title: 'x' }, '2026-08-25').error, 'missing');
  assert.equal(C.revise(original, 'wake', { title: '' }, '2026-08-25').error, 'invalid');
  assert.equal(C.release(original, 'wake', 'not-a-day').error, 'invalid');
  const released = C.release(original, 'wake', '2026-08-25').state;
  assert.equal(C.release(released, 'wake', '2026-08-26').error, 'missing');
});

test('снятие отметки возвращает молчание, а не поражение', () => {
  let s = withItem();
  s = C.mark(s, 'wake', '2026-08-25', 'miss');
  s = C.clearMark(s, 'wake', '2026-08-25');
  assert.equal(C.outcomeOf(s, 'wake', '2026-08-25'), null);
  assert.deepEqual(s.log, {}, 'пустой день не должен оставаться в журнале');
});

test('undo завершения возвращает архивированное обязательство без нового штрафа', () => {
  const added = withItem();
  const marked = C.mark(added, 'wake', '2026-08-25', 'win');
  const archived = C.archive(marked, 'wake', '2026-08-25');
  const reopened = C.reopen(C.clearMark(archived, 'wake', '2026-08-25'), 'wake', '2026-08-25');
  assert.equal(reopened.ok, true);
  assert.equal(reopened.state.items[0].archivedAt, undefined);
  assert.equal(reopened.state.log['2026-08-25'], undefined);
  assert.deepEqual(reopened.state.items[0].history, added.items[0].history);
});

test('unsettled спрашивает только про неотмеченное и только про свой режим', () => {
  let s = C.emptyState();
  s = C.add(s, draft({ id: 'a' })).state;
  s = C.add(s, draft({ id: 'b' })).state;
  s = C.add(s, draft({ id: 'trip-only', modes: ['trip'] })).state;
  s = C.mark(s, 'a', '2026-08-25', 'win');
  assert.deepEqual(C.unsettled(s, '2026-08-25', 'default').map((i) => i.id), ['b']);
});

test('dayScore различает выигрыш, промах и молчание', () => {
  let s = C.emptyState();
  s = C.add(s, draft({ id: 'a' })).state;
  s = C.add(s, draft({ id: 'b' })).state;
  s = C.add(s, draft({ id: 'c' })).state;
  s = C.mark(s, 'a', '2026-08-25', 'win');
  s = C.mark(s, 'b', '2026-08-25', 'miss');
  assert.deepEqual(C.dayScore(s, '2026-08-25', 'default'), { win: 1, miss: 1, silent: 1, total: 3 });
});

test('операции иммутабельны — исходное состояние не мутируется', () => {
  const s0 = withItem();
  const before = JSON.stringify(s0);
  C.mark(s0, 'wake', '2026-08-25', 'win');
  C.archive(s0, 'wake', '2026-08-25');
  C.setMode(s0, 'trip');
  C.add(s0, draft({ id: 'другой' }));
  assert.equal(JSON.stringify(s0), before, 'модуль мутировал переданное состояние');
});

test('чистый модуль: ни DOM, ни State, ни сети, ни переводчика', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/commitment-v1.js'), 'utf8');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const forbidden of ['document', 'window.State', 'localStorage', 'fetch(', 'State.', ' t(']) {
    assert.equal(body.includes(forbidden), false, `модуль потянулся к «${forbidden}»`);
  }
});
