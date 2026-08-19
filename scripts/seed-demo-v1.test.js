'use strict';
/* Засеянный аккаунт должен открываться приложением, а не баннером восстановления.
 *
 * Сидер пишет файлы напрямую через /api/data/<name>, а сервер их не разбирает: он
 * хранит то, что дали. Единственная проверка формы живёт в клиенте — validate*Payload
 * в `public/app.js`. Поэтому разъехаться сидер и приложение могут молча, и именно это
 * и случилось: привычки записывались с полем `name`, валидатор требует `title`, и
 * отбраковывался НЕ отдельный элемент, а весь файл. В интерфейсе это выглядело как
 * «привычек нет», в консоли — одна строка `loadChecked habits invalid data`.
 *
 * Тест гоняет НАСТОЯЩИЙ сидер против настоящего сервера и проверяет результат
 * НАСТОЯЩИМИ валидаторами приложения — вырезанными из `app.js`, а не переписанными
 * здесь. Копия валидатора разошлась бы с оригиналом ровно тогда, когда это важно.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-seed-demo-'));
  const port = 48600 + (process.pid % 150);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  child.kill('SIGTERM'); throw new Error(`сервер не поднялся: ${out}`);
}

function runSeeder(base, email, password) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['scripts/seed-demo.mjs', '--base', base, '--email', email, '--password', password],
      { cwd: ROOT, timeout: 60000 },
      (err, stdout, stderr) => (err ? reject(new Error(`сидер упал: ${stderr || stdout}`)) : resolve(stdout)));
  });
}

/* Валидаторы берутся из app.js как есть: вырезаем исходник функции по балансу скобок
 * и исполняем. Так тест проверяет ровно тот код, который отбракует данные у живого
 * пользователя, — а не его пересказ. */
function loadValidators(names) {
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const cut = (name) => {
    const start = app.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `в app.js нет ${name} — валидатор переименовали, тест надо чинить`);
    let depth = 0;
    for (let j = app.indexOf('{', start); j < app.length; j += 1) {
      if (app[j] === '{') depth += 1;
      else if (app[j] === '}') { depth -= 1; if (!depth) return app.slice(start, j + 1); }
    }
    throw new Error(`не удалось вырезать ${name}`);
  };
  const src = names.map(cut).join('\n') + `\n;({${names.join(',')}})`;
  return eval(src); // eslint-disable-line no-eval
}

// Файл → валидатор. Всё, что сидер пишет и что приложение потом проверяет на входе.
const CHECKED = {
  settings: 'validateSettingsPayload',
  tasks: 'validateTasksPayload',
  habits: 'validateHabitsPayload',
  habitlog: 'validateHabitlogPayload',
  goals: 'validateGoalsPayload',
};

test('приложение принимает всё, что засеял сидер', { timeout: 90000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });

  const email = 'demo-seed@example.test', password = 'seed-pass-1234';
  const stdout = await runSeeder(rt.base, email, password);
  assert.match(stdout, /Готово/, 'сидер не досеял до конца');

  const V = loadValidators(Object.values(CHECKED));

  // Читаем ровно тем же путём, что и приложение.
  let cookie = '';
  const login = await fetch(`${rt.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, 'не удалось войти в засеянный аккаунт');
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  const broken = [];
  for (const [name, fn] of Object.entries(CHECKED)) {
    const r = await fetch(`${rt.base}/api/data/${name}`, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200, `${name}: сидер не записал файл`);
    const data = await r.json();
    if (!V[fn](data)) {
      const first = Array.isArray(data) ? data.find((item) => !V[fn]([item])) : null;
      broken.push(`${name} (${fn})${first ? ` — первый негодный: ${JSON.stringify(first).slice(0, 200)}` : ''}`);
    }
  }
  assert.deepEqual(broken, [], `приложение отбракует засеянные файлы:\n  ${broken.join('\n  ')}`);
});

test('засеянная доска показывает доску, а не калибровку вкуса', { timeout: 90000 }, async (t) => {
  // Пустая доска отдаёт не доску, а опросник «что из этого — твоё?»: до шести
  // вердиктов board-taste держит экран себе. Для съёмки виджета `?widget=board`
  // это ловушка — в кадр попадает калибровка вместо доски, которую и рекламируем.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });

  const email = 'demo-board@example.test', password = 'seed-pass-1234';
  await runSeeder(rt.base, email, password);
  const login = await fetch(`${rt.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const settings = await (await fetch(`${rt.base}/api/data/settings`, { headers: { Cookie: cookie } })).json();

  const taste = require(path.join(ROOT, 'public/board-taste-v1.js'));
  assert.ok(taste.isCalibrated(settings.boardTaste),
    `вкус не откалиброван (${taste.verdictCount(settings.boardTaste)} из ${taste.CALIBRATED_AT}) — виджет снимет опросник вместо доски`);

  const board = require(path.join(ROOT, 'public/board-v1.js')).normalize(settings.board);
  assert.ok(board.done.length >= 1, 'на доске нет ни одного выполненного заказа');
  assert.ok(board.active.length >= 1, 'на доске нет ни одного взятого заказа');

  // Заказы обязаны существовать в пуле: id из головы отрисуется пустой карточкой.
  const pool = require(path.join(ROOT, 'public/board-pool-v1.js')).ALL;
  const known = new Set(pool.map((o) => o.id));
  for (const entry of [...board.active, ...board.done, ...board.rested]) {
    assert.ok(known.has(entry.orderId), `заказа ${entry.orderId} нет в пуле`);
  }
});

test('засеянные привычки видны, а не отбракованы целиком', { timeout: 90000 }, async (t) => {
  // Отдельным тестом, потому что поломка была именно здесь и стоила молчаливого
  // пустого экрана: валидатор привычек отбраковывает файл целиком, поэтому одна
  // запись с чужим полем уносит с собой все остальные.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });

  const email = 'demo-habits@example.test', password = 'seed-pass-1234';
  await runSeeder(rt.base, email, password);

  const login = await fetch(`${rt.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const habits = await (await fetch(`${rt.base}/api/data/habits`, { headers: { Cookie: cookie } })).json();

  assert.ok(Array.isArray(habits) && habits.length >= 3, 'привычек засеяно меньше, чем нужно для проверки');
  for (const h of habits) {
    assert.equal(typeof h.title, 'string', `у привычки нет title: ${JSON.stringify(h)}`);
    assert.ok(h.title.trim(), 'пустой заголовок привычки');
    assert.equal('name' in h, false, `вернулось поле name — редактор его не пишет: ${JSON.stringify(h)}`);
  }
  // Брошенная привычка — она и есть смысл засева: пустой идеальный аккаунт
  // не показывает ни одного состояния, ради которого приложение написано.
  assert.ok(habits.some((h) => h.archived === true), 'нет брошенной привычки');
  assert.ok(habits.some((h) => h.archived === false), 'нет ни одной живой привычки');

  // Журнал обязан ссылаться на существующие привычки, иначе стрики считаются в пустоту.
  const log = await (await fetch(`${rt.base}/api/data/habitlog`, { headers: { Cookie: cookie } })).json();
  const ids = new Set(habits.map((h) => h.id));
  const days = Object.keys(log);
  assert.ok(days.length > 0, 'журнал привычек пуст');
  for (const day of days) {
    for (const hid of Object.keys(log[day])) {
      assert.ok(ids.has(hid), `журнал за ${day} ссылается на несуществующую привычку ${hid}`);
    }
  }
});
