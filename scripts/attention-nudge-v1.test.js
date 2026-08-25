'use strict';
/* Тихий вопрос после отсутствия (DISCIPLINE-ESCAPE-PLAN §5 слой A, §8 п.1).
 *
 * Самая опасная фича плана: срабатывает в худший момент человека, без его просьбы,
 * и говорит первой. Поэтому тест проверяет в первую очередь СДЕРЖАННОСТЬ — что
 * модуль молчит везде, где молчать положено, — и только потом что он вообще
 * способен спросить.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const N = require('../server-attention-nudge-v1.js');
const ROOT = path.resolve(__dirname, '..');

const base = (over = {}) => Object.assign({
  quietDays: 3, hour: 14, today: '2026-08-25', askedAt: null, askedToday: false,
}, over);

test('спрашивает после настоящей паузы в разумный час', () => {
  const v = N.decide(base());
  assert.equal(v.ask, true);
  assert.equal(v.reason, 'quiet');
});

test('🔴 один тихий день — это норма жизни, а не сигнал', () => {
  // Выходной, поездка, просто занят. Спрашивать здесь — придираться.
  assert.equal(N.decide(base({ quietDays: 0 })).ask, false);
  assert.equal(N.decide(base({ quietDays: 1 })).reason, 'not_quiet_enough');
  assert.equal(N.decide(base({ quietDays: 2 })).ask, true, 'два дня — уже уместно');
});

test('🔴 ночью не спрашиваем никогда', () => {
  for (const hour of [0, 3, 7, 9, 21, 23]) {
    assert.equal(N.decide(base({ hour })).ask, false, `час ${hour} обязан молчать`);
  }
  for (const hour of [12, 15, 19]) {
    assert.equal(N.decide(base({ hour })).ask, true, `час ${hour} — рабочее окно`);
  }
});

test('🔴 спросив, замолкает на несколько дней', () => {
  // Повторный вопрос каждый день превращает заботу в преследование — это ровно
  // механика, которая в продукте запрещена.
  assert.equal(N.decide(base({ askedAt: '2026-08-25' })).reason, 'too_soon');
  assert.equal(N.decide(base({ askedAt: '2026-08-24' })).reason, 'too_soon');
  assert.equal(N.decide(base({ askedAt: '2026-08-23' })).reason, 'too_soon');
  assert.equal(N.decide(base({ askedAt: '2026-08-22' })).ask, true, 'через три дня можно снова');
});

test('🔴 второй раз за день молчит при любом счётчике', () => {
  assert.equal(N.decide(base({ quietDays: 30, askedToday: true })).reason, 'already_spoke_today');
});

test('🔴 сдвинутые часы устройства не дают спросить дважды', () => {
  // Смена часового пояса не повод разбудить человека вопросом повторно.
  assert.equal(N.decide(base({ askedAt: '2026-08-27' })).reason, 'clock_skew');
  assert.equal(N.decide(base({ askedAt: 'не дата' })).reason, 'bad_dates');
});

test('мусор на входе означает молчание, а не сбой', () => {
  for (const junk of [null, undefined, 'нет', 42, []]) {
    const v = N.decide(junk);
    assert.equal(v.ask, false, 'при мусоре обязано быть молчание');
    assert.ok(typeof v.reason === 'string' && v.reason);
  }
  assert.equal(N.decide(base({ quietDays: NaN })).ask, false);
  assert.equal(N.decide(base({ hour: 'полдень' })).ask, false);
});

test('пороги настраиваются, а дефолты остаются сдержанными', () => {
  const loose = N.createQuietAsk({ minQuietDays: 1, minGapDays: 1, fromHour: 0, toHour: 24 });
  assert.equal(loose.decide(base({ quietDays: 1, hour: 3 })).ask, true);
  // Но по умолчанию — тише.
  assert.equal(N.decide(base({ quietDays: 1, hour: 3 })).ask, false);
  assert.equal(N.MIN_QUIET_DAYS, 2);
  assert.equal(N.MIN_GAP_DAYS, 3);
});

test('🔴 модуль не умеет диагностировать причину отсутствия', () => {
  // §8 п.1: не угадывать болезнь, отдых, поездку или работу вне Satoru. Здесь не
  // должно быть ни функции, ни поля, которое называет причину.
  const surface = Object.keys(N).join(' ').toLowerCase();
  for (const bad of ['diagnose', 'classify', 'cause', 'relapse', 'escape', 'sick', 'burnout']) {
    assert.equal(surface.includes(bad), false, `в API появилось «${bad}» — модуль начал ставить диагноз`);
  }
  // Решение содержит только ask/reason, и reason описывает НАШЕ решение, не человека.
  assert.deepEqual(Object.keys(N.decide(base())).sort(), ['ask', 'reason']);
});

test('🔴 все тексты вопроса — вопросы, а не выводы', () => {
  // Утверждение «ты сорвался» здесь недопустимо: мы не знаем, что было.
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const block = src.match(/const QUIET_ASK_TEXT = \[([\s\S]*?)\];/);
  assert.ok(block, 'тексты тихого вопроса не найдены в server.js');
  const lines = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(lines.length >= 2, 'вариантов должно быть несколько, иначе пуш примелькается');
  for (const line of lines) {
    assert.ok(line.includes('?'), `вариант без вопроса: «${line}»`);
    for (const verdict of ['сорвал', 'провал', 'опять', 'снова ты', 'лень', 'должен']) {
      assert.equal(line.toLowerCase().includes(verdict), false, `вариант содержит приговор «${verdict}»: «${line}»`);
    }
  }
});

test('тихий вопрос стоит последним в приоритете и уважает отказ от пушей', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const tick = src.slice(src.indexOf('async function pushTick()'), src.indexOf('// ИИ BYOK'));
  // Отписка от напоминаний обязана гасить и этот канал: ветка стоит после проверки.
  assert.ok(tick.indexOf('user.push.nudges === false') < tick.indexOf('attentionQuietAsk'),
    'отказ от напоминаний обязан отсекать тихий вопрос тоже');
  // Утренний и вечерний чек-ин важнее: тихий вопрос только когда сказать больше нечего.
  assert.ok(tick.indexOf("kind === 'm' || kind === 'e'") < tick.indexOf('attentionQuietAsk'),
    'тихий вопрос не имеет права перебивать утренний чек-ин');
  assert.match(tick, /askedToday:\s*!!\(log\.m \|\| log\.e \|\| log\.p \|\| log\.q\)/,
    'второй пуш за день обязан отсекаться по всем каналам, а не только по своему');
});
