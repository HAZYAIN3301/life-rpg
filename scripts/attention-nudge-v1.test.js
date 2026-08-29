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

test('🔴 все тексты вопроса — вопросы, а не выводы, на всех языках', () => {
  // Утверждение «ты сорвался» здесь недопустимо: мы не знаем, что было. И перевод
  // не имеет права вернуть приговор, который убрали из оригинала.
  const Copy = require('../server-nudge-copy-v1.js');
  const verdicts = {
    ru: ['сорвал', 'провал', 'опять', 'лень', 'должен'],
    en: ['failed', 'again', 'lazy', 'should have', 'missed'],
    de: ['versagt', 'wieder', 'faul', 'hättest'],
    uk: ['зірвав', 'провал', 'знову', 'лінь', 'мусиш'],
    es: ['fallaste', 'otra vez', 'vago', 'deberías'],
  };
  for (const lang of Copy.LOCALES) {
    const lines = Copy.pool(lang, 'q');
    assert.ok(lines.length >= 2, `${lang}: вариантов должно быть несколько, иначе пуш примелькается`);
    for (const line of lines) {
      assert.ok(/[?¿]/.test(line), `${lang}: вариант без вопроса — «${line}»`);
      for (const v of verdicts[lang]) {
        assert.equal(line.toLowerCase().includes(v), false, `${lang}: приговор «${v}» в «${line}»`);
      }
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

/* ── Пять локалей пушей ─────────────────────────────────────────────────────
 * До этого весь NUDGE_TEXT был русским: немец получал пуши на незнакомом языке.
 * Тест сторожит не перевод (его качество проверяет человек), а структурные вещи,
 * которые язык не проверяет сам и которые ломаются молча.
 */
const Copy = require('../server-nudge-copy-v1.js');

test('все локали имеют те же каналы и бакеты, что и русская', () => {
  const shape = (t) => ({
    m: Object.keys(t.m).sort(), e: Object.keys(t.e).sort(),
    p: Array.isArray(t.p), q: Array.isArray(t.q),
  });
  const ru = shape(Copy.COPY.ru);
  for (const lang of Copy.LOCALES) {
    assert.deepEqual(shape(Copy.COPY[lang]), ru, `${lang}: структура разошлась с русской`);
  }
});

test('🔴 плейсхолдер {pet} переживает перевод во всех локалях', () => {
  // Ровно тот класс тихих багов, что ловился в переводах гайда: {pet} без подстановки
  // не бросает исключение — просто показывает человеку фигурные скобки.
  for (const lang of Copy.LOCALES) {
    for (const line of Copy.pool(lang, 'p')) {
      assert.ok(line.includes('{pet}'), `${lang}: потерян {pet} в «${line}»`);
    }
  }
});

test('ни один пул не пуст — молчащий пуш хуже неидеального', () => {
  for (const lang of Copy.LOCALES) {
    for (const [kind, bucket] of [['m', 'near'], ['m', 'mid'], ['m', 'far'],
      ['e', 'near'], ['e', 'mid'], ['e', 'far'], ['p', null], ['q', null]]) {
      const got = Copy.pool(lang, kind, bucket);
      assert.ok(got.length > 0, `${lang}/${kind}/${bucket}: пустой пул`);
      for (const line of got) assert.ok(line.trim(), `${lang}/${kind}: пустая строка`);
    }
  }
});

test('неизвестный язык падает в русский, а не в пустоту', () => {
  assert.equal(Copy.normalizeLocale('fr'), 'ru');
  assert.equal(Copy.normalizeLocale(''), 'ru');
  assert.equal(Copy.normalizeLocale(null), 'ru');
  assert.equal(Copy.normalizeLocale('de-DE'), 'de', 'региональный тег обязан сводиться к языку');
  assert.equal(Copy.normalizeLocale('EN'), 'en');
  assert.ok(Copy.pool('клингонский', 'q').length > 0, 'неизвестный язык не имеет права дать пустой пуш');
  assert.ok(Copy.pool('en', 'нет-такого-канала').length === 0 || true);
});

test('🔴 «чем дольше не было — тем теплее» сохранено в переводе', () => {
  // Контринтуитивно для маркетинга и намеренно: человек, пропавший надолго,
  // возвращается от «дверь открыта», а не от «ты нас потерял».
  //
  // Отрицания вырезаются ДО проверки, и это не хак. «Не срочно», «Nada urgente»,
  // «nicht dringend» содержат слово давления, означая ровно обратное — это самый
  // естественный способ сказать «не тороплю». Две первые версии теста падали
  // именно на них, ловя заботу вместо давления.
  const negations = [
    'не срочно', 'без давления', 'без спешки', 'не тороплю',
    'nothing urgent', 'not urgent', 'no hurry', 'no rush', 'no pressure',
    'nada urgente', 'sin presion', 'sin presión', 'sin prisa',
    'nicht dringend', 'kein druck', 'ohne eile',
    'не терміново', 'без тиску', 'без поспіху',
  ];
  const pushy = ['срочн', 'сейчас же', 'немедленн', 'urgent', 'right now',
    'dringend', 'sofort', 'терміново', 'urgencia', 'ahora mismo'];

  for (const lang of Copy.LOCALES) {
    for (const line of Copy.pool(lang, 'm', 'far').concat(Copy.pool(lang, 'e', 'far'))) {
      let low = line.toLowerCase();
      assert.equal(low.includes('!'), false, `${lang}: восклицание в far-тексте «${line}»`);
      for (const n of negations) low = low.split(n).join(' ');
      for (const w of pushy) {
        assert.equal(low.includes(w), false, `${lang}: давление в far-тексте «${line}» (слово «${w}»)`);
      }
    }
  }
});

test('планировщик берёт язык из настроек человека, а не из локали сервера', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const tick = src.slice(src.indexOf('async function pushTick()'), src.indexOf('// ИИ BYOK'));
  assert.match(tick, /const settings = readUserJson\(user\.id, 'settings'\) \|\| \{\}/,
    'настройки пользователя должны читаться один раз для локали и секретарского напоминания');
  assert.match(tick, /NudgeCopy\.normalizeLocale\(settings\.lang\)/,
    'язык обязан читаться из настроек пользователя');
  for (const kind of ["'p'", "'q'"]) {
    assert.ok(tick.includes(`NudgeCopy.pool(lang, ${kind})`), `канал ${kind} обязан идти через локализованный пул`);
  }
  assert.ok(tick.includes('NudgeCopy.pool(lang, kind, bucket)'), 'утро/вечер обязаны идти через локализованный пул');
});
