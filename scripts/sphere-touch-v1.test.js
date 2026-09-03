const test = require('node:test');
const assert = require('node:assert/strict');
const Touch = require('../public/sphere-touch-v1.js');
const Frequency = require('../public/sphere-frequency-v1.js');

const spheres = [
  { id: 'body', name: 'Тело' },
  { id: 'gym', name: 'Качалка', parentId: 'body' },
  { id: 'bench', name: 'Жим', parentId: 'gym' },
  { id: 'mind', name: 'Ум' },
];
const ev = (date, skillId, patch = {}) => ({ date, skillId, xp: 10, ...patch });

test('a deed anywhere in the branch counts for the sphere at the top of it', () => {
  const index = Touch.touchDaysBySphere([ev('2026-09-01', 'bench'), ev('2026-09-02', 'gym'), ev('2026-09-03', 'body')], spheres);
  assert.deepEqual(Touch.daysFor(index, 'body'), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepEqual(Touch.daysFor(index, 'gym'), [], 'ритм объявляется на оси колеса, а не на ветке');
});

test('a day is counted once however busy it was', () => {
  const index = Touch.touchDaysBySphere([ev('2026-09-01', 'bench'), ev('2026-09-01', 'gym'), ev('2026-09-01', 'body')], spheres);
  assert.deepEqual(Touch.daysFor(index, 'body'), ['2026-09-01'],
    'три дела за вечер — это один день, когда ты этим занимался');
});

test('a sphere brushed in passing was not what the person was doing', () => {
  const index = Touch.touchDaysBySphere([ev('2026-09-01', 'mind', { layer: true }), ev('2026-09-02', 'mind')], spheres);
  assert.deepEqual(Touch.daysFor(index, 'mind'), ['2026-09-02']);
});

test('junk never becomes a day', () => {
  const index = Touch.touchDaysBySphere([
    ev('2026-9-1', 'body'), ev('', 'body'), ev(null, 'body'),
    ev('2026-09-01', ''), ev('2026-09-01', null), ev('2026-09-01', 'gone'),
    null, 'event', 42,
  ], spheres);
  assert.equal(index.size, 0);
  assert.equal(Touch.touchDaysBySphere(null, spheres).size, 0);
  assert.deepEqual(Touch.daysFor(null, 'body'), []);
  assert.deepEqual(Touch.daysFor(new Map(), ''), []);
});

test('a loop in the parents neither hangs nor swallows the sphere', () => {
  const looped = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }];
  const owner = Touch.topOwnerMap(looped);
  assert.ok(owner.get('a') === 'a' || owner.get('a') === 'b');
  assert.equal(Touch.touchDaysBySphere([ev('2026-09-01', 'a')], looped).size, 1);
});

test('a parent that no longer exists leaves the sphere its own top', () => {
  const orphan = [{ id: 'solo', parentId: 'deleted' }];
  assert.equal(Touch.topOwnerMap(orphan).get('solo'), 'solo');
  assert.deepEqual(Touch.daysFor(Touch.touchDaysBySphere([ev('2026-09-01', 'solo')], orphan), 'solo'), ['2026-09-01']);
});

test('the days feed the frequency module without any translation in between', () => {
  const days = ['2026-08-30', '2026-08-31', '2026-09-01'];
  const index = Touch.touchDaysBySphere(days.map((d) => ev(d, 'bench')), spheres);
  const rhythm = Frequency.sphereRhythm({ id: 'body', targetPerWeek: 3 }, Touch.daysFor(index, 'body'), '2026-09-02');
  assert.equal(rhythm.status, 'ok');
  assert.equal(rhythm.actual, 3);
  const idle = Frequency.sphereRhythm({ id: 'mind', targetPerWeek: 3 }, Touch.daysFor(index, 'mind'), '2026-09-02');
  assert.equal(idle.status, 'under');
  const unset = Frequency.sphereRhythm({ id: 'mind' }, [], '2026-09-02');
  assert.equal(unset.status, 'unset', 'сфера без объявленной частоты не судится');
});

test('reading never mutates what it was given', () => {
  const events = [ev('2026-09-01', 'bench')];
  const frozen = JSON.parse(JSON.stringify({ events, spheres }));
  Touch.touchDaysBySphere(events, spheres);
  assert.deepEqual({ events, spheres }, frozen);
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'sphere-touch-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
  assert.deepEqual(Object.keys(Touch).sort(), ['daysFor', 'topOwnerMap', 'touchDaysBySphere']);
});

// ── Клиентский контракт: частота объявляется у сферы и читается в Прогрессе ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('both modules are loaded before app.js and cached once for offline', () => {
  const freq = INDEX.indexOf('src="sphere-frequency-v1.js');
  const touch = INDEX.indexOf('src="sphere-touch-v1.js');
  assert.ok(freq >= 0 && touch >= 0 && INDEX.indexOf('src="app.js') > Math.max(freq, touch));
  for (const file of ['sphere-frequency-v1', 'sphere-touch-v1']) {
    assert.equal((SW.match(new RegExp(`'${file}\\.js'`, 'g')) || []).length, 1, file);
  }
  assert.match(SW, /const CACHE = 'satoru-v239'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v239'/);
});

test('the rhythm is declared where the sphere is edited, not in a screen of its own', () => {
  assert.match(APP, /data-field="targetPerWeek"[^`]*min="1" max="7"|min="1" max="7"[^`]*data-field="targetPerWeek"/);
  assert.match(CSS, /\.se-rhythm \{/);
  // изменение частоты сохраняется тем же путём, что домен и «проект»
  assert.match(APP, /\['parentId', 'canon', 'noBalance', 'targetPerWeek'\]\.includes/);
});

test('an empty field means «not declared», never zero', () => {
  const at = APP.indexOf('const rhythmInput = row.querySelector');
  const body = APP.slice(at, APP.indexOf('return o;', at));
  assert.match(body, /rhythmInput\.value\.trim\(\) && Number\.isFinite\(declared\) && declared >= 1 && declared <= 7/);
  assert.match(body, /else delete o\.targetPerWeek;/);
  assert.equal((body.match(/delete o\.targetPerWeek;/g) || []).length, 2, 'и пустое поле, и его отсутствие стирают объявление');
});

test('the progress screen says nothing when nothing was declared', () => {
  const at = APP.indexOf('function sphereRhythmSummary');
  const body = APP.slice(at, APP.indexOf('\nfunction renderStats', at));
  assert.match(body, /if \(!F \|\| !T\) return '';/, 'без модулей строка не рисуется');
  assert.match(body, /if \(!balance\.counted\) return '';/, 'ноль объявленных — ни строки, ни нуля');
  assert.match(body, /!isProjectSkill\(sphere\) && !sphere\.archived/, 'проекты и архив не оси колеса');
  assert.match(body, /F\.mostNeglected\(rhythms\)/, 'один сигнал за раз, а не список запущенных сфер');
  assert.doesNotMatch(body, /Math\.round\(.*100\)|%/, 'ведущий вывод словами, а не процентом');
  // Один вопрос — один ответ: строка про ритм заменяет прежнюю строку баланса,
  // а не встаёт рядом с ней. Две строки называли разные сферы на одном экране.
  assert.match(APP, /const balanceSummary = rhythmSummary \|\| \(hasBalanceSignal/);
  assert.equal(APP.includes('stats-rhythm-line'), false, 'второй строки на экране нет');
  const summaryAt = APP.indexOf('const balanceSummary = rhythmSummary');
  const summary = APP.slice(summaryAt, APP.indexOf(';', APP.indexOf('Это не оценка тебя', summaryAt)));
  assert.match(summary, /Баланс появится, когда хотя бы две сферы получат внимание/,
    'без объявленных частот прежняя строка остаётся ровно как была');
});

test('the new copy reaches every language', () => {
  for (const key of ['раз в неделю', 'В своём ритме', 'Реже, чем ты решил', 'сфер с объявленной частотой']) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});
