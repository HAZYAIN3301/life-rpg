const test = require('node:test');
const assert = require('node:assert/strict');
const Producer = require('../public/secretary-attention-producer-v1.js');
const Events = require('../public/secretary-events-v1.js');

const DAY = '2026-09-01';
const AT = '2026-09-01T23:50:00.000Z';
const episode = (patch = {}) => ({
  id: 'e_1', sourcePolicyId: 'p_1', declaredPurpose: 'create',
  startedAt: '2026-09-01T23:30:00.000Z', endedAt: AT,
  outcome: 'escaped', plannedMinutes: 10, actualMinutes: 20, ...patch,
});
const run = (patch = {}, opts = {}) => Producer.eventsForEpisode({ episode: episode(patch), day: DAY, label: 'TikTok', ...opts });

test('the person’s own word becomes an event with the moment it happened', () => {
  const { events } = run({ actualMinutes: 10 });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { day: DAY, at: AT, source: 'client', ref: 'tiktok', type: 'attention.escaped' });
});

test('a measured overrun carries both numbers, never a verdict', () => {
  const { events } = run({ outcome: 'done' });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    day: DAY, at: AT, source: 'client', ref: 'tiktok',
    type: 'attention.overran', plannedMinutes: 10, actualMinutes: 20,
  });
});

test('one episode can be both: the word and the measurement are separate facts', () => {
  const { events } = run();
  assert.deepEqual(events.map((e) => e.type).sort(), ['attention.escaped', 'attention.overran']);
});

test('a missing measurement is not a zero and produces no overrun', () => {
  for (const actualMinutes of [null, undefined, NaN, 'nope', -1]) {
    const { events, skipped } = run({ outcome: 'done', actualMinutes });
    assert.equal(events.length, 0, String(actualMinutes));
    assert.equal(skipped.find((s) => s.type === Producer.OVERRAN).reason, 'not_measured', String(actualMinutes));
  }
});

test('without a boundary there is nothing to exceed', () => {
  const { events, skipped } = run({ outcome: 'done', plannedMinutes: undefined });
  assert.equal(events.length, 0);
  assert.equal(skipped.find((s) => s.type === Producer.OVERRAN).reason, 'no_boundary');
});

test('staying inside the boundary is silence, and it says why', () => {
  for (const actualMinutes of [10, 9, 0]) {
    const { events, skipped } = run({ outcome: 'done', actualMinutes });
    assert.equal(events.length, 0, String(actualMinutes));
    assert.equal(skipped.find((s) => s.type === Producer.OVERRAN).reason, 'within_boundary');
  }
});

test('a moment nobody observed is never invented', () => {
  for (const endedAt of [undefined, null, '', 'вчера', 12345]) {
    const { events, skipped } = run({ endedAt });
    assert.equal(events.length, 0, String(endedAt));
    assert.equal(skipped[0].reason, 'no_ended_at');
  }
  assert.equal(Producer.eventsForEpisode({ episode: null, day: DAY }).skipped[0].reason, 'no_episode');
  assert.equal(Producer.eventsForEpisode(null).skipped[0].reason, 'no_episode');
});

test('a day the calendar does not have is refused, not guessed', () => {
  for (const day of ['2026-02-31', '2026-13-01', '01.09.2026', '', null, undefined]) {
    const { events, skipped } = Producer.eventsForEpisode({ episode: episode(), day, label: 'TikTok' });
    assert.equal(events.length, 0, String(day));
    assert.equal(skipped[0].reason, 'no_local_day');
  }
});

test('the label becomes a modest key so one activity is one reason', () => {
  assert.equal(Producer.refOf('TikTok'), 'tiktok');
  assert.equal(Producer.refOf('  YouTube Shorts  '), 'youtube-shorts');
  assert.equal(Producer.refOf('Инстаграм'), 'инстаграм');
  assert.equal(Producer.refOf('!!!'), '');
  assert.equal(Producer.refOf(null), '');
  assert.equal(Producer.refOf('x'.repeat(200)).length, 60);
  const { events } = run({}, { label: '   ' });
  assert.equal('ref' in events[0], false, 'пустой ярлык не превращается в пустой ref');
});

test('nothing that could identify a page or a query leaves the module', () => {
  const { events } = Producer.eventsForEpisode({
    episode: episode({ note: 'https://tiktok.com/@someone/video/123', topic: 'поисковый запрос', expectedOutcome: 'x' }),
    day: DAY, label: 'TikTok',
  });
  const serialized = JSON.stringify(events);
  for (const leak of ['http', 'tiktok.com', 'запрос', 'someone']) {
    assert.equal(serialized.includes(leak), false, leak);
  }
});

test('every produced event is accepted by the shared vocabulary', () => {
  const { events } = run();
  for (const event of events) {
    assert.ok(Events.TYPE_LIST.includes(event.type), event.type);
    assert.equal(Events.RETIRED_TYPES.includes(event.type), false, event.type);
    const normalized = Events.normalizeIngress(event);
    assert.ok(normalized, `${event.type} must survive ingress normalization`);
    assert.equal(normalized.type, event.type);
    assert.equal(normalized.day, DAY);
  }
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'secretary-attention-producer-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
});

// ── Клиентский контракт: продюсер стоит на единственном шве закрытия окна ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the vocabulary loads before the producer, and both before app.js', () => {
  const vocab = INDEX.indexOf('src="secretary-events-v1.js');
  const producer = INDEX.indexOf('src="secretary-attention-producer-v1.js');
  assert.ok(vocab >= 0 && producer > vocab, 'словарь событий грузится раньше продюсера');
  assert.ok(INDEX.indexOf('src="app.js') > producer);
  for (const file of ['secretary-events-v1', 'secretary-attention-producer-v1']) {
    assert.equal((SW.match(new RegExp(`'${file}\\.js'`, 'g')) || []).length, 1, `${file} once in SHELL`);
  }
  assert.match(SW, /const CACHE = 'satoru-v244'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v244'/);
});

test('every closed window reports, and there is exactly one place that closes one', () => {
  // Оба потока — обычное завершение и аварийный выход — идут через persistAttentionClose,
  // поэтому продюсер висит на нём, а не на каждой кнопке отдельно.
  assert.equal((APP.match(/await persistAttentionClose\(next\)/g) || []).length, 2);
  const at = APP.indexOf('async function persistAttentionClose');
  const body = APP.slice(at, APP.indexOf('\n}', at));
  assert.match(body, /applyAttentionBundle\(bundle\);\n  reportAttentionEpisode\(next\.episode\);/,
    'событие уходит только после успешного сохранения эпизода');
});

test('the report never blocks the person and never invents a day', () => {
  const at = APP.indexOf('async function reportAttentionEpisode');
  const body = APP.slice(at, APP.indexOf('\n}\nasync function persistAttentionClose', at));
  assert.match(body, /if \(!producer \|\| !episode \|\| !episode\.endedAt\) return;/);
  assert.match(body, /day: fmtDate\(new Date\(episode\.endedAt\)\)/, 'день считается из момента конца окна');
  assert.match(body, /'\/api\/secretary\/event'/);
  assert.doesNotMatch(body, /toast\(/, 'провал отправки сигнала не сообщается человеку тостом');
  assert.doesNotMatch(APP, /await reportAttentionEpisode/, 'отправка не задерживает закрытие окна');
});

test('the client never sends a retired event type', () => {
  for (const retired of Events.RETIRED_TYPES) {
    assert.equal(APP.includes(`'${retired}'`), false, retired);
  }
});
