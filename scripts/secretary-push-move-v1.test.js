'use strict';

/* Утренний ход в пуше: единственный канал, работающий при закрытом приложении.
 *
 * Целиком планировщик не поднять без настоящего push-сервиса, поэтому проверяется
 * то, что реально ломается: порядок вызовов в планировщике и поведение связки
 * «заявка + кулдаун». Обещание одно — человек не получает одно и то же обращение
 * дважды и не получает двух пушей за одно утро.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../public/secretary-router-v1.js');
const E = require('../public/secretary-events-v1.js');
const C = require('../public/secretary-claim-v1.js');

const ROOT = path.join(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function tick() {
  const from = SERVER.indexOf('async function pushTick(');
  assert.notStrictEqual(from, -1, 'планировщик найден');
  const to = SERVER.indexOf('\n// ИИ BYOK:', from);
  assert.notStrictEqual(to, -1, 'конец планировщика найден');
  return SERVER.slice(from, to);
}

const DAY = '2026-09-02';
const YDAY = '2026-09-01';
const NOW = `${DAY}T08:30:00.000Z`;
const log = E.append(E.emptyLog(),
  { type: E.TYPES.ATTENTION_ESCAPED, day: YDAY, at: `${YDAY}T23:50:00.000Z`, ref: 'tiktok' }).log;

const ask = (channel, ledger) => R.next({
  now: NOW, today: DAY, tzOffsetMinutes: 0, events: log,
  ledger: ledger || R.emptyLedger(), channel,
});

test('🔴 доставленный пуш закрывает день — карточка не повторит ход', () => {
  // Иначе человек получает пуш, открывает приложение и встречает то же самое.
  const offer = ask('push');
  assert.ok(offer, 'повод есть');
  const after = R.mark(R.emptyLedger(), offer, 'offered', NOW);
  assert.strictEqual(ask('card', after), null, 'до завтра тишина');
  assert.strictEqual(ask('push', after), null);
});

test('🔴 неотправленный пуш день не закрывает', () => {
  // Кулдаун ставится только на доставленное. Иначе неудачная отправка молча
  // съедала бы единственное вмешательство за день.
  const offer = ask('push');
  const claims = C.claim(C.emptyClaims(), offer.offerId, 'push', NOW, 'tok');
  const dead = C.settle(claims.claims, offer.offerId, 'tok', 'gone', NOW);
  assert.strictEqual(dead.released, true);
  assert.ok(ask('card'), 'ход остался доступен карточке');
});

test('🔴 планировщик сообщает исход до всех выходов из цикла', () => {
  const src = tick();
  const settle = src.indexOf('secretarySettlePush(');
  const goneExit = src.indexOf("if (outcome === 'gone')");
  const notDelivered = src.indexOf("if (outcome !== 'delivered') continue;");
  assert.ok(settle > 0, 'исход вообще сообщается');
  assert.ok(settle < goneExit, 'иначе после мёртвой подписки заявка держала бы ход сама себя');
  assert.ok(settle < notDelivered, 'то же самое после временного сбоя');
});

test('🔴 ход глушит тёплый чек-ин — двух пушей за утро не бывает', () => {
  const src = tick();
  assert.ok(src.includes("if (!payload && (kind === 'm' || kind === 'e'))"),
    'общий чек-ин обязан уступать ходу');
  // И ход не отмечается в журнале чек-инов: у него свой кулдаун, а чужой он бы сжёг.
  const move = src.indexOf('if (move) { user.push.log = log;');
  const delivery = src.indexOf('if (delivery) {');
  assert.ok(move > 0 && move < delivery, 'ход выходит раньше учёта вариантов чек-ина');
});

test('🔴 заявка берётся до отправки, а не после', () => {
  const src = tick();
  const claim = src.indexOf('secretaryClaimForPush(');
  const send = src.indexOf('await sendWebPush(');
  assert.ok(claim > 0 && claim < send, 'право показать берётся заранее');
});

test('🔴 в пуше нет ни цитаты, ни занятия, ни причины', () => {
  const src = tick();
  const from = src.indexOf('const candidate = secretaryPushOffer(');
  const to = src.indexOf("if (!payload && (kind === 'm'");
  const block = src.slice(from, to);
  assert.ok(block.length > 200, 'блок хода найден');
  for (const leak of ['quote', '.ref', 'reason', 'about', 'target', 'note']) {
    assert.strictEqual(block.includes(leak), false, `в пуш просочилось: «${leak}»`);
  }
  assert.ok(block.includes('SecretaryClaimV1.pushCopy(lang)'), 'текст берётся из готовых строк');
});

test('🔴 повреждённые файлы секретаря заставляют промолчать, а не слать наугад', () => {
  const src = SERVER.slice(SERVER.indexOf('function readSecretaryPart('), SERVER.indexOf('function tzOffsetMinutesFor('));
  assert.ok(src.includes('|| null'), 'мусор превращается в null');
  const offerFn = SERVER.slice(SERVER.indexOf('function secretaryPushOffer('), SERVER.indexOf('function secretaryClaimForPush('));
  assert.ok(offerFn.includes('if (!events || !ledger) return null;'), 'без исправных файлов хода нет');
});
