const test = require('node:test');
const assert = require('node:assert/strict');
const View = require('../public/secretary-offer-view-v1.js');

const offer = (patch = {}) => ({
  offerId: 'morning-recovery|2026-09-03|attention.escaped|2026-09-02|tiktok',
  capability: 'morning-recovery', action: 'recovery_day_open', channel: 'card', channels: ['card'],
  confidence: 0.9, askOnly: false, reason: 'escaped',
  about: { day: '2026-09-02' }, quote: null,
  cooldownKey: 'morning-recovery|2026-09-03', ...patch,
});

test('a known move names the fact and opens a surface that already exists', () => {
  const view = View.presentOffer(offer());
  assert.equal(view.reasonCopy, View.REASON_COPY.escaped);
  assert.equal(view.actionLabel, 'Вернуться одним шагом');
  assert.equal(view.domAction, 'attention-open-return');
  assert.equal(view.askOnly, false);
  assert.equal(view.cooldownKey, 'morning-recovery|2026-09-03');
});

test('every action in the closed vocabulary maps to a surface, and none of them is new', () => {
  assert.deepEqual(Object.keys(View.ACTION_SURFACE).sort(),
    ['ask_one_question', 'evening_transition_open', 'recovery_day_open', 'rest_start_prepared']);
  for (const [action, surface] of Object.entries(View.ACTION_SURFACE)) {
    assert.ok(surface.label, action);
    if (action !== 'ask_one_question') assert.match(surface.domAction, /^[a-z-]+$/, action);
  }
});

test('an unknown reason or action shows nothing rather than the nearest guess', () => {
  assert.equal(View.presentOffer(offer({ reason: 'burnout' })), null);
  assert.equal(View.presentOffer(offer({ action: 'delete_everything' })), null);
  assert.equal(View.presentOffer(offer({ action: 'purchase' })), null);
  assert.equal(View.presentOffer(offer({ reason: undefined })), null);
});

test('nothing is shown without a move to identify', () => {
  assert.equal(View.presentOffer(offer({ offerId: '' })), null);
  assert.equal(View.presentOffer(null), null);
  assert.equal(View.presentOffer('offer'), null);
  assert.equal(View.presentOffer([]), null);
});

test('a question stays a question and opens nothing', () => {
  const view = View.presentOffer(offer({ reason: 'silent', action: 'ask_one_question', askOnly: true }));
  assert.equal(view.askOnly, true);
  assert.equal(view.domAction, '');
  assert.match(view.reasonCopy, /\?$/, 'причина сформулирована вопросом');
  // даже при известном действии askOnly не открывает поверхность
  const forced = View.presentOffer(offer({ askOnly: true }));
  assert.equal(forced.domAction, '', 'askOnly сильнее известного действия');
  assert.equal(forced.actionLabel, 'Вернуться одним шагом');
});

test('the person’s own words are carried through, and half a quote is still a quote', () => {
  assert.equal(View.presentOffer(offer()).quote, null);
  assert.deepEqual(View.presentOffer(offer({ quote: { id: 'c2', title: 'Подъём в 7:00', win: 'успеваю до школы' } })).quote,
    { title: 'Подъём в 7:00', win: 'успеваю до школы' });
  assert.deepEqual(View.presentOffer(offer({ quote: { title: 'Подъём в 7:00' } })).quote, { title: 'Подъём в 7:00', win: '' });
  assert.equal(View.presentOffer(offer({ quote: { win: 'без названия' } })).quote, null, 'цитата без слов человека не цитата');
  assert.equal(View.presentOffer(offer({ quote: 'выдумка' })).quote, null);
  assert.equal(View.presentOffer(offer({ quote: { title: 'ц'.repeat(400), win: 'в'.repeat(400) } })).quote.title.length, 120);
});

test('a missing cooldown key falls back to the move id, never to nothing', () => {
  // Без ключа кулдауна исход хода некуда записать, и предложение вернулось бы завтра снова.
  assert.equal(View.presentOffer(offer({ cooldownKey: '' })).cooldownKey, offer().offerId);
});

test('no diagnosis, no shame, no score anywhere in the copy', () => {
  const words = ['срыв', 'провал', 'ты снова', 'опять', 'нельзя было', 'XP', 'золот', 'серия', 'штраф'];
  const all = Object.values(View.REASON_COPY).concat(Object.values(View.ACTION_SURFACE).map((s) => s.label)).join(' ').toLowerCase();
  for (const word of words) assert.equal(all.includes(word.toLowerCase()), false, word);
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'secretary-offer-view-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
});

// ── Клиентский контракт: заявка раньше показа, исход всегда записан ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const at = INDEX.indexOf('src="secretary-offer-view-v1.js');
  assert.ok(at >= 0 && INDEX.indexOf('src="app.js') > at);
  assert.equal((SW.match(/'secretary-offer-view-v1\.js'/g) || []).length, 1);
  assert.match(SW, /const CACHE = 'satoru-v227'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v227'/);
});

test('the move is claimed before it is ever drawn', () => {
  const at = APP.indexOf('async function loadSecretaryOffer');
  const body = APP.slice(at, APP.indexOf('\nasync function settleSecretaryClaim', at));
  assert.match(body, /'X-Local-Day': todayStr\(\)/);
  assert.match(body, /'X-Channel': 'card'/);
  const view = body.indexOf('V.presentOffer');
  const claim = body.indexOf("'/api/secretary/claim'");
  const show = body.indexOf('State.secretaryOffer = { view');
  assert.ok(view >= 0 && claim > view && show > claim, 'порядок: получить → заявить → только потом показать');
  assert.match(body, /if \(claim\.status !== 200\) \{ State\.secretaryOffer = null; return; \}/, '409 значит молчать');
  assert.match(body, /settleSecretaryClaim\(view\.offerId, claimed\.token, 'delivered'\)/);
});

test('a stolen slot is never claimed, so the move is not lost unseen', () => {
  // Заявка подаётся только когда ни одна ветка выше не выиграла место на экране.
  assert.match(APP, /_secretaryOfferSlotFree = !!C && !State\._attentionLoadError && !active && !closed/);
  assert.match(APP, /if \(_secretaryOfferSlotFree && State\.secretaryOffer === undefined\) loadSecretaryOffer\(\);/);
});

test('one decision-maker for the morning: the local detector is gone', () => {
  // Утренний ход и незавершённый возврат — про один вчерашний факт. Двое, решающих
  // одно и то же, — это дефект, а не запас прочности.
  for (const dead of ['secretaryMorningRecoveryOffer', 'experimentRecovery', 'morning-after-overrun']) {
    assert.equal(APP.includes(dead), false, dead);
  }
  const offerAt = APP.indexOf("} else if (secretaryOfferView()) {");
  const returnAt = APP.indexOf('} else if (pendingReturn) {');
  assert.ok(offerAt > 0 && returnAt > offerAt, 'ход сервера стоит выше локального возврата');
  const activeAt = APP.indexOf('} else if (active) {');
  assert.ok(activeAt > 0 && activeAt < offerAt, 'живая граница внимания остаётся выше хода');
});

test('both answers are recorded, and dismiss is an equal button', () => {
  assert.match(APP, /if \(el\.dataset\.secretaryAccept === '1'\) reportSecretaryOutcome\('accepted'\);/);
  assert.match(APP, /action === 'secretary-offer-accept'[\s\S]{0,90}reportSecretaryOutcome\('accepted'\)/);
  assert.match(APP, /action === 'secretary-offer-dismiss'[\s\S]{0,90}reportSecretaryOutcome\('dismissed'\)/);
  const at = APP.indexOf('function secretaryOfferHTML');
  const body = APP.slice(at, APP.indexOf('\nfunction secretarySettings', at));
  assert.match(body, /data-action="secretary-offer-dismiss"[^`]*Не сейчас/, 'отказ — кнопка, а не крестик');
  assert.doesNotMatch(body, /modal-x|✕/);
  assert.match(CSS, /\.secretary-offer \{/);
});

test('the outcome is written even if the answer never reaches the server', () => {
  const at = APP.indexOf('async function reportSecretaryOutcome');
  const body = APP.slice(at, APP.indexOf('\nfunction secretaryOfferHTML', at));
  // карточка убирается сразу; сеть может упасть, но второй раз то же самое не показывается
  assert.ok(body.indexOf('State.secretaryOffer = null;') < body.indexOf("'/api/secretary/offer'"));
  assert.match(body, /catch \(error\) \{ console\.error\('secretary outcome', error\); \}/);
});

test('the offer copy reaches every language', () => {
  for (const key of Object.values(View.REASON_COPY).concat(['Ответить'])) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});

test('only one block on the day may call itself the priority', () => {
  // Герой дня уже называет следующий квест. Второй заголовок «Сейчас важнее всего»
  // над альтернативным советом противоречил ему на одном экране: две вещи объявляли
  // себя главным и указывали на разное.
  const offer = APP.indexOf("primary = { kind: 'offer'");
  const nudge = APP.indexOf("primary = { kind: 'nudge'");
  assert.ok(offer > 0 && nudge > 0);
  assert.match(APP.slice(offer, offer + 120), /title: t\('Сейчас важнее всего'\)/,
    'заявленный ход движка — про то, что случилось с человеком, и остаётся главным');
  assert.match(APP.slice(nudge, nudge + 120), /title: t\('Поддержка'\)/,
    'совет называется тем, что он есть, словом самой карточки');
  assert.equal((APP.match(/title: t\('Сейчас важнее всего'\)/g) || []).length, 1,
    'на экране ровно один претендент на «важнее всего»');
});
