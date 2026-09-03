const test = require('node:test');
const assert = require('node:assert/strict');
const Line = require('../public/board-day-line-v1.js');
const Board = require('../public/board-v1.js');

const TITLES = { o1: 'Искупайся в воде холоднее, чем хочется', o2: 'Позвони тому, кому давно не звонил', o3: 'Пройди новый маршрут пешком', o4: 'Четвёртый' };
const titleOf = (id) => TITLES[id] || '';
const take = (active) => Line.takenFor({ active, titleOf });

test('the day names what was taken from the board', () => {
  assert.deepEqual(take([{ orderId: 'o1', takenAt: '2026-09-01' }]),
    [{ orderId: 'o1', title: TITLES.o1, takenAt: '2026-09-01' }]);
});

test('order is by when it was taken, never by how the file happened to store it', () => {
  const rows = take([
    { orderId: 'o2', takenAt: '2026-09-02' },
    { orderId: 'o1', takenAt: '2026-08-31' },
    { orderId: 'o3', takenAt: '2026-09-01' },
  ]);
  assert.deepEqual(rows.map((r) => r.orderId), ['o1', 'o3', 'o2']);
  const reversed = take([
    { orderId: 'o3', takenAt: '2026-09-01' },
    { orderId: 'o1', takenAt: '2026-08-31' },
    { orderId: 'o2', takenAt: '2026-09-02' },
  ]);
  assert.deepEqual(reversed.map((r) => r.orderId), ['o1', 'o3', 'o2']);
});

test('an order with no date is shown last, not hidden and not dated by guess', () => {
  const rows = take([{ orderId: 'o1', takenAt: 'вчера' }, { orderId: 'o2', takenAt: '2026-09-02' }]);
  assert.deepEqual(rows.map((r) => r.orderId), ['o2', 'o1']);
  assert.equal(rows[1].takenAt, '', 'непонятная дата становится пустой, а не сегодняшней');
});

test('an order the catalogue cannot name is not promised to the person', () => {
  assert.deepEqual(take([{ orderId: 'gone', takenAt: '2026-09-01' }]), []);
  assert.deepEqual(Line.takenFor({ active: [{ orderId: 'o1' }], titleOf: () => '   ' }), []);
});

test('nothing is shown without a board, a title source or a real id', () => {
  assert.deepEqual(take([]), []);
  assert.deepEqual(take(null), []);
  assert.deepEqual(Line.takenFor({ active: [{ orderId: 'o1' }] }), [], 'без источника названий строки нет');
  assert.deepEqual(Line.takenFor(null), []);
  assert.deepEqual(take([{ orderId: '' }, { orderId: '  ' }, null, 'o1', 42]), []);
});

test('one order taken twice is one line', () => {
  const rows = take([{ orderId: 'o1', takenAt: '2026-09-01' }, { orderId: 'o1', takenAt: '2026-09-02' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].takenAt, '2026-09-01', 'первая запись выигрывает');
});

test('the day never shows more than the board can hold', () => {
  assert.equal(Line.MAX_SHOWN, Board.MAX_ACTIVE, 'предел строки дня равен пределу доски');
  const many = ['o1', 'o2', 'o3', 'o4'].map((orderId, i) => ({ orderId, takenAt: `2026-09-0${i + 1}` }));
  assert.equal(take(many).length, Line.MAX_SHOWN);
});

test('a long title is trimmed instead of taking over the day', () => {
  const rows = Line.takenFor({ active: [{ orderId: 'x' }], titleOf: () => '  ' + 'з'.repeat(300) + '  ' });
  assert.equal(rows[0].title.length, 80);
});

test('the real board state flows in without translation in between', () => {
  const order = { id: 'o1', title: TITLES.o1, skill: 'body', xp: 20, gold: 5 };
  const taken = Board.takeOrder(Board.normalize(null), order, '2026-09-01');
  assert.equal(taken.ok, true);
  const rows = Line.takenFor({ active: Board.activeOrders(taken.state), titleOf });
  assert.deepEqual(rows.map((r) => r.orderId), ['o1']);
  assert.equal(rows[0].takenAt, '2026-09-01');
});

test('reading never mutates what it was given', () => {
  const active = [{ orderId: 'o1', takenAt: '2026-09-01' }];
  const frozen = JSON.parse(JSON.stringify(active));
  take(active);
  assert.deepEqual(active, frozen);
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'board-day-line-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
  assert.deepEqual(Object.keys(Line).sort(), ['MAX_SHOWN', 'takenFor']);
});

// ── Клиентский контракт: день говорит про взятое и уводит к нему ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const at = INDEX.indexOf('src="board-day-line-v1.js');
  assert.ok(at >= 0 && INDEX.indexOf('src="app.js') > at);
  assert.equal((SW.match(/'board-day-line-v1\.js'/g) || []).length, 1);
  assert.match(SW, /const CACHE = 'satoru-v225'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v225'/);
});

test('the line lives inside the quests card, not as another card beside it', () => {
  assert.match(APP, /\$\{boardTakenLineHTML\(\)\}<\/section>`;/,
    'строка закрывает ту же карточку, где живут квесты дня');
  assert.doesNotMatch(APP, /class="card[^"]*"[^`]{0,40}\$\{boardTakenLineHTML/, 'своей карточки у неё нет');
  assert.match(CSS, /\.day-board-taken \{/);
});

test('the day names the order but never becomes a second record of it', () => {
  const at = APP.indexOf('function boardTakenLineHTML');
  const body = APP.slice(at, APP.indexOf('\n  const questBoard', at));
  assert.match(body, /L\.takenFor\(\{ active: B\.activeOrders\(boardRead\(\)\)/);
  assert.match(body, /titleOf: \(id\) =>/, 'название берётся у самой доски, а не собирается заново');
  assert.match(body, /if \(!L \|\| !B\) return '';/);
  assert.match(body, /if \(!rows\.length\) return '';/, 'нет взятого — нет строки');
  // взятый заказ не превращается в квест: второй записи того же факта не появляется
  assert.doesNotMatch(body, /State\.tasks|Store\.save|questRow/);
});

test('one tap goes from the day to that exact order', () => {
  const at = APP.indexOf("action === 'goto-board-order'");
  assert.notEqual(at, -1);
  const branch = APP.slice(at, APP.indexOf('\n  } else if', at));
  assert.match(branch, /State\._todayTab = 'board'/);
  assert.match(branch, /State\._boardSel = id/, 'открывается именно этот заказ, а не доска вообще');
});

test('the new copy reaches every language', () => {
  for (const key of ['С доски', 'Открыть заказ на доске', 'взят']) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});
