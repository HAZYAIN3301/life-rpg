const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

test('a protected account never falls back to a write the server always refuses', () => {
  // Сервер судит по файлам на диске. Если клиент решил «графа нет» только потому,
  // что не смог собрать пару, обычный PUT уходит и получает 428 — на любом
  // устройстве и навсегда, потому что перезагрузка этого не меняет.
  const at = APP.indexOf('const protectedGraph = pairedSlot &&');
  assert.notEqual(at, -1);
  const expr = APP.slice(at, APP.indexOf(';', at));
  assert.match(expr, /commitmentGraphProtected\(base\?\.settings\?\.value, base\?\.tasks\?\.value\)/);
  assert.match(expr, /commitmentGraphProtected\(pair\?\.settings, pair\?\.tasks\)/);
  assert.match(expr, /commitmentGraphProtected\(State\.settings, State\.tasks\)/,
    'живое состояние — третий свидетель, и без него неготовая пара выглядит как отсутствие графа');
});

test('the client and the server agree on what a protected graph is', () => {
  const clientAt = APP.indexOf('function commitmentGraphProtected');
  const client = APP.slice(clientAt, APP.indexOf('\nfunction ', clientAt + 10));
  const serverAt = SERVER.indexOf('function commitmentGraphPresent');
  const server = SERVER.slice(serverAt, SERVER.indexOf('\nfunction ', serverAt + 10));
  for (const key of ["'commitmentsV1'", "'commitmentId'", "'oath'"]) {
    assert.ok(client.includes(key), `клиент: ${key}`);
    assert.ok(server.includes(key), `сервер: ${key}`);
  }
});

test('a refused pair says which half is wrong instead of a bare failure', () => {
  const at = APP.indexOf("console.error('save blocked'");
  assert.notEqual(at, -1);
  const block = APP.slice(at - 400, at + 400);
  assert.match(block, /const half = !base \? 'base' : !pair \?/);
  assert.match(block, /Запись остановлена: данные аккаунта не проходят проверку/);
});

test('409 and 428 are told apart, because only one of them is fixed by reloading', () => {
  const at = APP.indexOf('function commitmentBoundaryRejected');
  const body = APP.slice(at, APP.indexOf('\n}', at));
  assert.match(body, /response\.status === 409[\s\S]{0,120}Данные изменились в другой вкладке/);
  assert.match(body, /Запись отклонена защитой данных/);
  // 428 не должен советовать перезагрузку: она не помогает никогда
  const at428 = body.indexOf('Запись отклонена защитой данных');
  assert.equal(body.slice(at428, at428 + 160).includes('Обнови страницу'), false);
});

test('the honest copy exists in all five languages', () => {
  for (const key of [
    'Запись остановлена: данные аккаунта не проходят проверку',
    'Ничего не изменено.',
    'Запись отклонена защитой данных. Ничего не изменено — сообщи об этом.',
  ]) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});

test('the rescue path is not fenced off from the accounts that need it', () => {
  // Откат из бэкапа звал ту же проверку без базы, а клиентской базы у него быть не
  // может. У аккаунта с графом уговоров это значило 428 всегда: единственный путь
  // спасения был закрыт ровно там, где он нужен. Проверено до и после: 428 → 200.
  const at = SERVER.indexOf("am = u.match(/^\\/api\\/admin\\/userdata\\/([a-z0-9_-]{1,32})\\/restore$/)");
  assert.notEqual(at, -1);
  const handler = SERVER.slice(at, SERVER.indexOf('\n    am =', at + 10) + 1 || SERVER.length);
  assert.match(handler, /const actual = commitmentActualPair\(am\[1\]\);/);
  assert.match(handler, /base: \{ settings: actual\.settings, tasks: actual\.tasks \}/);
  assert.doesNotMatch(handler, /assertAccountGraphTransition\(am\[1\], \{ data: \{ \[name\]: candidate \} \}\)/,
    'проверка без базы у отката означает 428 навсегда');
});

test('the generic writer still refuses to bypass the pair on the server', () => {
  // Правка клиента ничего не ослабляет: сервер по-прежнему требует пару для
  // settings/tasks, когда граф есть. Клиент просто перестал туда ходить.
  const at = SERVER.indexOf('if (COMMITMENT_PAIR_NAMES.includes(name)) {');
  assert.notEqual(at, -1);
  assert.match(SERVER.slice(at, at + 220), /assertAccountGraphTransition\(uid, \{ data: \{ \[name\]: parsed \} \}\)/);
  assert.match(SERVER, /commitment_atomic_write_required', 428/);
});
