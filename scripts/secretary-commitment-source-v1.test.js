const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const CommitmentV2 = require('../public/commitment-v2.js');
const Router = require('../public/secretary-router-v1.js');

test('the router reads commitments where they are actually written', () => {
  // Клиент пишет уговоры в `settings.commitmentsV1`, и защищённая пара — `settings + tasks`.
  // Router читал `commitments.json`, которого не существует и который никогда не писался,
  // поэтому цитата словами человека не появлялась ни разу.
  assert.equal(SERVER.includes("readUserJson(uid, 'commitments')"), false,
    'файла commitments.json не существует — читать его нельзя');
  assert.match(SERVER, /function readUserCommitments\(uid\) \{/);
  const at = SERVER.indexOf('function readUserCommitments');
  const body = SERVER.slice(at, SERVER.indexOf('\n}', at));
  assert.match(body, /readUserJson\(uid, 'settings'\)/);
  assert.match(body, /CommitmentV2\.migrate\(settings && settings\.commitmentsV1\)\.state/);
  // Оба читателя — утренняя карточка и планировщик пуша — берут из одного места.
  assert.equal((SERVER.match(/= readUserCommitments\(uid\);/g) || []).length, 2);
  assert.match(SERVER, /const COMMITMENT_PAIR_NAMES = Object\.freeze\(\['settings', 'tasks'\]\)/,
    'пара, защищённая CAS, и есть место рождения уговоров');
});

test('a commitment written by the client survives the read the router does', () => {
  // Тот же путь, что у сервера: клиентское состояние из настроек → migrate → Router.
  const settings = {
    commitmentsV1: {
      version: 1, mode: 'default', log: {},
      items: [{ id: 'c2', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю до школы', core: true, modes: [], edge: { kind: 'time', at: '07:00' }, history: [] }],
    },
  };
  const state = CommitmentV2.migrate(settings.commitmentsV1).state;
  assert.equal(state.items.length, 1, 'уговор клиента доживает до Router-а');
  assert.equal(CommitmentV2.migrate(null).state.items.length, 0, 'нет настроек — пусто, а не падение');
  assert.equal(CommitmentV2.migrate(undefined).state.items.length, 0);

  const offer = Router.next({
    invocation: 'app_open',
    now: '2026-09-02T08:00:00.000Z', today: '2026-09-02', tzOffsetMinutes: 120,
    events: { version: 1, events: [{ key: 'attention.escaped|2026-09-01|tiktok', type: 'attention.escaped', at: '2026-09-01T21:40:00.000Z', day: '2026-09-01', source: 'client', ref: 'tiktok', data: {} }] },
    ledger: Router.emptyLedger(), commitments: state, mode: state.mode, channel: 'card', dayClosed: false,
  });
  assert.ok(offer, 'повод вчера + утро сегодня даёт ход');
  assert.ok(offer.quote, 'ход цитирует человека его же словами, а не молчит');
  assert.equal(offer.quote.title, 'Подъём в 7:00');
  assert.equal(offer.quote.win, 'успеваю до школы');
});
