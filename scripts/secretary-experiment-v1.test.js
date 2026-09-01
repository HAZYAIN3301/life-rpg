'use strict';

/* Тридцатидневный dogfood-эксперимент.
 *
 * Проверяется не арифметика, а защита от самообмана. Тридцать дней замеров очень
 * легко превратить в прибор, который всегда показывает «работает»: достаточно
 * посчитать молчание успехом, спрятать размер выборки или подставить вместо
 * неизвестного нуль. Каждый тест ниже закрывает один такой способ соврать.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const X = require('../public/secretary-experiment-v1.js');

const SRC = path.join(__dirname, '..', 'public/secretary-experiment-v1.js');
const START = '2026-09-02';

function running(overrides) {
  const r = X.open(X.emptyState(), Object.assign({ id: 'e1', startedOn: START, status: 'active' }, overrides || {}));
  assert.ok(r.ok, 'фикстура не создалась');
  return r.state;
}

// Записать один чек-ин, подняв seq; возвращает новое состояние.
function checkIn(state, day, payload, seq) {
  const r = X.recordCheckIn(state, 'e1', day, payload, seq);
  assert.ok(r.ok, `чек-ин отклонён: ${r.error}`);
  return r.state;
}

test('🔴 окно эксперимента — ровно дни 1..30 включительно', () => {
  const s = running();
  const exp = X.get(s, 'e1');
  assert.strictEqual(exp.endsOn, '2026-10-01', 'старт + 29 дней, обе границы включены');
  assert.strictEqual(X.dayNumber(exp, START), 1);
  assert.strictEqual(X.dayNumber(exp, '2026-10-01'), 30);
  assert.strictEqual(X.dayNumber(exp, '2026-10-02'), null, 'день 31 вне окна');
  assert.strictEqual(X.dayNumber(exp, '2026-09-01'), null, 'день до старта вне окна');

  assert.strictEqual(X.recordCheckIn(s, 'e1', '2026-10-02', {}, 2).error, 'out_of_window');
  assert.strictEqual(X.recordCheckIn(s, 'e1', '2026-09-01', {}, 2).error, 'out_of_window');
});

test('🔴 невозможные даты не роняют модуль', () => {
  const s = running();
  for (const bad of ['2026-02-31', '2026-13-01', '2026-00-10', 'вчера', '', null, undefined, 42]) {
    assert.doesNotThrow(() => X.dayNumber(X.get(s, 'e1'), bad), `упал на ${bad}`);
    assert.strictEqual(X.dayNumber(X.get(s, 'e1'), bad), null);
    assert.strictEqual(X.recordCheckIn(s, 'e1', bad, {}, 2).ok, false);
  }
  assert.strictEqual(X.open(X.emptyState(), { id: 'x', startedOn: '2026-02-31' }).error, 'bad_start');
});

test('🔴 устаревший seq отклоняется, повтор того же ответа проходит спокойно', () => {
  let s = running();
  const payload = { afterEffect: 'better', boundaryHeld: 'yes' };
  s = checkIn(s, START, payload, 2);

  // Тот же ответ тем же номером — обычный retry со второго устройства.
  const again = X.recordCheckIn(s, 'e1', START, payload, 2);
  assert.strictEqual(again.ok, true, 'повтор — не ошибка');
  assert.strictEqual(again.applied, false);
  assert.strictEqual(again.reason, 'repeat');

  // Эхо старого запроса не затирает более свежий ответ.
  const stale = X.recordCheckIn(s, 'e1', START, { afterEffect: 'worse' }, 1);
  assert.strictEqual(stale.ok, false);
  assert.strictEqual(stale.error, 'stale_seq');
  assert.strictEqual(X.get(s, 'e1').checkIns[START].afterEffect, 'better', 'ответ уцелел');

  // Другой ответ тем же номером — конфликт, а не молчаливая перезапись.
  assert.strictEqual(X.recordCheckIn(s, 'e1', START, { afterEffect: 'worse' }, 2).error, 'stale_seq');
});

test('🔴 unknown не входит в знаменатель, но всегда виден', () => {
  let s = running();
  // Два содержательных ответа и два молчаливых закрытия листа.
  s = checkIn(s, START, { boundaryHeld: 'yes', afterEffect: 'better', regret: 'none' }, 2);
  s = checkIn(s, '2026-09-03', { boundaryHeld: 'no', afterEffect: 'worse', regret: 'some' }, 3);
  s = checkIn(s, '2026-09-04', {}, 4);
  s = checkIn(s, '2026-09-05', { note: 'закрыл, не ответив' }, 5);

  const m = X.metrics(s, 'e1', { today: '2026-09-05' });
  assert.strictEqual(m.boundaryHeld.known, 2, 'знаменатель — только отвеченное');
  assert.deepStrictEqual([m.boundaryHeld.yes, m.boundaryHeld.no], [1, 1]);
  assert.strictEqual(m.afterEffect.known, 2);
  assert.strictEqual(m.knownDays, 2);
  assert.strictEqual(m.eligibleDays, 4, 'прошедшие дни видны целиком');
  assert.strictEqual(m.unknownDays, 2, 'неизвестное показывается, а не прячется');
});

test('🔴 молчание не считается ни успехом, ни провалом', () => {
  let s = running();
  s = checkIn(s, START, {}, 2);
  const m = X.metrics(s, 'e1', { today: START });
  assert.strictEqual(m.boundaryHeld.yes, 0);
  assert.strictEqual(m.boundaryHeld.no, 0, 'незаполненное не стало отрицательным исходом');
  assert.strictEqual(m.boundaryHeld.known, 0);
  assert.strictEqual(m.knownDays, 0);
});

test('🔴 вывод не делается на малой выборке', () => {
  let s = running();
  for (let i = 0; i < 4; i += 1) {
    s = checkIn(s, `2026-09-0${2 + i}`, { afterEffect: 'better' }, 2 + i);
  }
  assert.strictEqual(X.metrics(s, 'e1', { today: '2026-09-05' }).calibrating, true, '4 ответа — ещё калибровка');
  s = checkIn(s, '2026-09-06', { afterEffect: 'better' }, 6);
  assert.strictEqual(X.metrics(s, 'e1', { today: '2026-09-06' }).calibrating, false, `порог ${X.MIN_KNOWN} достигнут`);
});

test('🔴 задержка возврата без двух известных времён — not_measured, а не ноль', () => {
  const s = running();
  const half = [{ day: START, endedAt: `${START}T21:00:00Z` }];                 // возврат неизвестен
  const none = X.metrics(s, 'e1', { today: START, episodes: half });
  assert.strictEqual(none.returnLatency.status, 'not_measured');
  assert.strictEqual(none.returnLatency.n, 0);
  assert.strictEqual(none.returnLatency.medianMin, null, 'отсутствие замера — не нуль минут');

  const full = [
    { day: START, endedAt: `${START}T21:00:00Z`, returnedAt: `${START}T21:30:00Z` },
    { day: START, endedAt: `${START}T22:00:00Z`, returnedAt: `${START}T23:00:00Z` },
  ];
  const noBase = X.metrics(s, 'e1', { today: START, episodes: full });
  assert.strictEqual(noBase.returnLatency.status, 'no_baseline', 'сравнивать не с чем — так и сказано');
  // Длина самого эпизода в замер не входит: вопрос «быстро ли вернулся», а не
  // «сколько залипал», иначе метрика улучшалась бы от укорачивания эпизодов.
  assert.strictEqual(
    X.metrics(s, 'e1', { today: START, episodes: [{ startedAt: `${START}T20:00:00Z`, returnedAt: `${START}T21:00:00Z` }] })
      .returnLatency.status, 'not_measured', 'без endedAt замера нет');
  assert.strictEqual(noBase.returnLatency.medianMin, 45);
  assert.strictEqual(noBase.returnLatency.n, 2);

  const withBase = X.metrics(s, 'e1', {
    today: START, episodes: full,
    baselineEpisodes: [{ endedAt: '2026-08-20T21:00:00Z', returnedAt: '2026-08-20T23:00:00Z' }],
  });
  assert.strictEqual(withBase.returnLatency.status, 'measured');
  assert.strictEqual(withBase.returnLatency.baselineMedianMin, 120);
  assert.strictEqual(withBase.returnLatency.baselineN, 1);
});

test('🔴 число показов не выдумывается', () => {
  let s = running();
  s = checkIn(s, START, { offerOutcome: 'accepted' }, 2);
  s = checkIn(s, '2026-09-03', { offerOutcome: 'dismissed' }, 3);
  s = checkIn(s, '2026-09-04', { offerOutcome: 'unknown' }, 4);
  const m = X.metrics(s, 'e1', { today: '2026-09-04' });
  assert.strictEqual(m.offers.offered, null, 'показы считает сервер, а не рендер клиента');
  assert.deepStrictEqual([m.offers.accepted, m.offers.dismissed, m.offers.decided], [1, 1, 2]);
});

test('вехи обзора — только 7, 14, 21 и 30', () => {
  const s = running();
  assert.deepStrictEqual(X.REVIEW_DAYS.slice(), [7, 14, 21, 30]);
  assert.strictEqual(X.reviewDue(s, 'e1', '2026-09-08'), 7);
  assert.strictEqual(X.reviewDue(s, 'e1', '2026-09-15'), 14);
  assert.strictEqual(X.reviewDue(s, 'e1', '2026-10-01'), 30);
  assert.strictEqual(X.reviewDue(s, 'e1', '2026-09-09'), null, 'обзор не навязывается чаще');
});

test('🔴 эксперимент останавливается без штрафа и без потери данных', () => {
  let s = running();
  s = checkIn(s, START, { afterEffect: 'better', note: 'первый день' }, 2);
  const stopped = X.stop(s, 'e1', '2026-09-10T10:00:00Z', 3);
  assert.strictEqual(stopped.ok, true);
  const exp = X.get(stopped.state, 'e1');
  assert.strictEqual(exp.status, 'stopped');
  assert.strictEqual(Object.keys(exp.checkIns).length, 1, 'ответы не удалены вместе с остановкой');
  assert.strictEqual(exp.checkIns[START].note, 'первый день');
  // Повторная остановка — не ошибка; чужой id — ошибка, а не молчание.
  assert.strictEqual(X.stop(stopped.state, 'e1', '2026-09-10T10:00:00Z', 4).applied, false);
  assert.strictEqual(X.stop(stopped.state, 'нет', '2026-09-10T10:00:00Z', 4).error, 'not_found');
});

test('закрытый эксперимент больше не принимает ответы', () => {
  let s = running();
  s = X.complete(s, 'e1', '2026-10-01T20:00:00Z', 2).state;
  assert.strictEqual(X.get(s, 'e1').status, 'completed');
  assert.strictEqual(X.recordCheckIn(s, 'e1', '2026-09-10', { afterEffect: 'better' }, 3).error, 'not_active');
});

test('черновик виден до старта и активируется отдельным шагом', () => {
  // Срок, приватность и список измеряемого человек должен увидеть ДО старта.
  const r = X.open(X.emptyState(), { id: 'e1', startedOn: START });
  assert.strictEqual(r.experiment.status, 'draft');
  assert.strictEqual(X.recordCheckIn(r.state, 'e1', START, {}, 2).error, 'not_active');
  const on = X.activate(r.state, 'e1', 2);
  assert.strictEqual(X.get(on.state, 'e1').status, 'active');
});

test('🔴 время закрытия не берётся из воздуха', () => {
  const s = running();
  for (const bad of [null, undefined, '', 'вчера', 42]) {
    assert.strictEqual(X.complete(s, 'e1', bad, 2).error, 'bad_now', `принял ${bad}`);
  }
});

test('🔴 заметка приватна и не хранит ссылок на просмотренное', () => {
  let s = running();
  s = checkIn(s, START, { note: 'смотрел https://youtube.com/watch?v=abc и www.tiktok.com/@x — залип' }, 2);
  const note = X.get(s, 'e1').checkIns[START].note;
  assert.strictEqual(note.includes('http'), false);
  assert.strictEqual(note.includes('youtube'), false);
  assert.strictEqual(note.includes('tiktok'), false);
  assert.ok(note.includes('залип'), 'слова человека остались');

  s = checkIn(s, '2026-09-03', { note: 'я'.repeat(500) }, 3);
  assert.strictEqual(X.get(s, 'e1').checkIns['2026-09-03'].note.length, X.MAX_NOTE);
});

test('доменные объекты не копируются — только ссылки', () => {
  const s = running({ refs: { goalId: 'g1', rhythmId: 'r1', notesCollectionId: 'n1', title: 'Бегать' } });
  const refs = X.get(s, 'e1').refs;
  assert.deepStrictEqual(Object.keys(refs).sort(), ['goalId', 'notesCollectionId', 'rhythmId']);
  assert.strictEqual('title' in refs, false, 'заголовок цели живёт в Goals, а не здесь');
  // Удалённый объект оставляет null, а не оживает копией.
  assert.strictEqual(X.get(running(), 'e1').refs.goalId, null);
});

test('битое состояние не превращается в пустое молча... но и не роняет модуль', () => {
  for (const junk of [null, 'строка', 42, [], { experiments: 'нет' }]) {
    const s = X.normalize(junk);
    assert.strictEqual(s.version, 1);
    assert.deepStrictEqual(s.experiments, []);
  }
  // Запись без старта не подставляет сегодняшний день — она просто не запись.
  assert.deepStrictEqual(X.normalize({ experiments: [{ id: 'e1' }] }).experiments, []);
  assert.strictEqual(X.metrics(X.emptyState(), 'нет', { today: START }), null);
});

test('🔴 ни XP, ни серий, ни наград за заполнение', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1').toLowerCase();
  for (const bad of ['xp', 'gold', 'streak', 'confetti', 'rarity', 'reward', 'badge', 'penalty']) {
    assert.strictEqual(new RegExp('(?<![a-z])' + bad + '(?![a-z])').test(code), false,
      `награда за честный ответ портит честность ответа: «${bad}»`);
  }
  for (const bad of ['золот', 'награ', 'штраф', 'серия', 'диагно']) {
    assert.strictEqual(code.includes(bad), false, `запрещённое понятие: «${bad}»`);
  }
});

test('🔴 модуль не читает часы, State, DOM и сеть', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/', 'Date.now', 'localStorage']) {
    assert.strictEqual(code.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
  // Голый `new Date()` — это чтение часов; аргумент делает вызов чистой арифметикой.
  assert.strictEqual(/new Date\(\s*\)/.test(code), false, 'модуль читает часы вместо параметра');
});

test('🔴 в модуле нет ASCII-границы слова — она молча не работает на кириллице', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.strictEqual(code.includes('\\b'), false);
});
