const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Commitments = require('../public/commitment-v2.js');
const CommitmentStore = require('../public/commitment-store-v1.js');

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

test('409 несёт два разных факта, и «обнови страницу» врёт про один из них', () => {
  // 🔴 Этика честности. commitment_revision_conflict — правда чужая запись, перезагрузка
  // помогает. commitment_data_corrupt — файл на сервере не читается, и тогда совет
  // перезагрузиться это круг на всех устройствах сразу: файл он не починит никогда.
  // Различать по статусу нельзя — только по коду в теле ответа.
  const at = APP.indexOf('async function commitmentBoundaryRejected');
  assert.notEqual(at, -1, 'проверка границы должна читать тело, а значит быть async');
  const fn = APP.slice(at, APP.indexOf('\nasync function ', at + 10) + 1 || undefined);
  const block = APP.slice(at, at + 1200);
  assert.match(block, /commitmentBoundaryCode\(response\)/, 'код берётся из тела, а не из статуса');
  assert.match(block, /code === 'commitment_data_corrupt'/);
  const corruptAt = block.indexOf("commitment_data_corrupt");
  const corruptToast = block.slice(corruptAt, block.indexOf('return true', corruptAt));
  assert.ok(!/Обнови страницу/.test(corruptToast),
    'повреждённому файлу нельзя советовать перезагрузку: она не поможет никогда');
  assert.match(corruptToast, /ничего не изменено/i, 'человек должен знать, что данные целы');
  assert.ok(fn.length > 0);
});

test('устаревшая база перечитывается один раз; новая гонка не разрешает перезаписать чужую запись', async () => {
  // Аккаунт открыт на трёх устройствах: чужая запись делает базу устаревшей постоянно.
  // Отказ с советом перезагрузиться означает потерю набранного и круг: пока человек
  // перезагружается, другое устройство пишет снова.
  for (const marker of ['async function refreshCommitmentWriteBase']) {
    assert.notEqual(APP.indexOf(marker), -1, marker);
  }
  const refreshAt = APP.indexOf('async function refreshCommitmentWriteBase');
  const refresh = APP.slice(refreshAt, refreshAt + 900);
  assert.match(refresh, /loadChecked\('settings'/, 'свежая правда берётся с сервера');
  assert.match(refresh, /loadChecked\('tasks'/);
  assert.match(refresh, /writeEpoch !== Store\._writeEpoch/,
    'повтор запрещён, если сменился аккаунт или эпоха записи');

  const commitAt = APP.indexOf('async function commitmentDataCommit');
  const commit = APP.slice(commitAt, APP.indexOf('\nasync function takeQuestCommitment'));
  // Execute the actual writer with the real schema/receipt validator. Merely
  // finding a loop in the source cannot prove which base is sent after a race.
  for (const outcome of ['saved', 'malformed_receipt', 'second_conflict', 'corrupt']) {
    const State = { me: { id: 'owner' }, settings: { commitmentsV1: {
      version: 2, mode: 'default', log: {}, items: [{
        id: 'quest:q', kind: 'step', title: 'Draft', win: 'Original result',
        edge: { kind: 'time', at: '15:00' }, core: true, modes: [], history: [],
      }],
    } }, tasks: [{ id: 'q', title: 'Draft', done: false, commitmentId: 'quest:q' }] };
    const snapshot = () => ({ settings: { exists: true, value: structuredClone(State.settings) },
      tasks: { exists: true, value: structuredClone(State.tasks) } });
    let base = snapshot(), refreshes = 0, builds = 0, remembered = 0;
    const sent = [];
    const Store = { _writeEpoch: 7, runExclusive: async (slots, operation) => {
      assert.deepEqual(slots, ['settings', 'tasks']);
      return operation({ writeEpoch: 7, accountId: 'owner' });
    } };
    const env = {
      window: { CommitmentStoreV1: CommitmentStore }, State, Store, structuredClone,
      commitmentEngine: () => Commitments, commitmentMigration: raw => Commitments.migrate(raw),
      taskWriteAllowed: () => true, settingsWriteAllowed: () => true,
      validateSettingsPayload: value => !!value, validateTasksPayload: Array.isArray,
      commitmentWriteBase: () => structuredClone(base), t: value => value, toast: () => {},
      handleAccountSessionExpired: () => assert.fail('unexpected expiry'),
      commitmentBoundaryCode: async response => response.code,
      commitmentBoundaryRejected: async response => response.status === 409,
      refreshCommitmentWriteBase: async owner => {
        assert.deepEqual(owner, { writeEpoch: 7, accountId: 'owner' }); refreshes++;
        const fresh = { settings: { ...structuredClone(State.settings), otherDevice: 'preserve me' },
          tasks: structuredClone(State.tasks) };
        base = { settings: { exists: true, value: fresh.settings }, tasks: { exists: true, value: fresh.tasks } };
        return fresh;
      },
      rememberDedicatedCommitSlots: () => { remembered++; return true; },
      fetch: async (url, init) => {
        assert.equal(url, '/api/commitments/commit');
        const payload = JSON.parse(init.body); sent.push(payload);
        assert.equal(CommitmentStore.validateCommitPayload(payload), true);
        assert.notEqual(payload.base, 'server', 'a race never authorizes a blind overwrite');
        if (sent.length === 1 || outcome === 'second_conflict') return {
          ok: false, status: 409, code: outcome === 'corrupt' ? 'commitment_data_corrupt' : 'commitment_revision_conflict',
        };
        assert.equal(sent.length, 2, 'only one rebuild is permitted');
        assert.equal(payload.base.settings.value.otherDevice, 'preserve me', 'retry uses the refreshed base');
        assert.equal(payload.data.settings.otherDevice, 'preserve me', 'retry preserves concurrent data');
        return { ok: true, status: 200, json: async () => {
          assert.equal(remembered, 0, 'HTTP success cannot advance CAS slots before the durable body');
          assert.equal(State.settings.commitmentsV1.items[0].win, 'Original result', 'candidate is not applied before the receipt');
          return outcome === 'malformed_receipt' ? { ok: true } : { ok: true, files: ['settings', 'tasks'] };
        } };
      },
    };
    const write = Function(...Object.keys(env), commit + '; return commitmentDataCommit;')(...Object.values(env));
    const result = await write(({ settings, tasks }) => {
      builds++; settings.commitmentsV1.items[0].win = 'Chosen result'; return { settings, tasks };
    });
    assert.equal(result, outcome === 'saved', outcome);
    assert.equal(sent.length, outcome === 'corrupt' ? 1 : 2, outcome);
    assert.equal(refreshes, outcome === 'corrupt' ? 0 : 1, outcome);
    assert.equal(builds, sent.length, 'each attempt rebuilds instead of replaying the stale candidate');
    assert.equal(remembered, outcome === 'saved' ? 1 : 0, outcome);
    assert.equal(State.settings.commitmentsV1.items[0].win, outcome === 'saved' ? 'Chosen result' : 'Original result', outcome);
  }
});

test('примирение снимает только сверку версий, а не защиту графа', () => {
  // 🔴 Забор существует, чтобы не потерять чужую запись. Примирение — выход из тупика,
  // когда клиент уже перечитал состояние и пересобрал изменение на нём, а забор всё равно
  // запирает. Оно НЕ должно отключать проверку графа и проверку полезной нагрузки:
  // иначе «выход из тупика» превратился бы в дыру в самом заборе.
  const at = SERVER.indexOf("const reconcile = payload.base === 'server'");
  assert.notEqual(at, -1, 'примирение должно быть именованным условием, а не скрытой веткой');
  const block = SERVER.slice(at - 1200, at + 900);
  assert.match(block, /const protectedGraph = commitmentGraphPresent/,
    'защита графа проверяется до примирения');
  assert.match(block, /for \(const name of \(reconcile \? \[\] : COMMITMENT_PAIR_NAMES\)\)/,
    'примирение пропускает ровно сверку версий, и ничего кроме');
  const after = SERVER.slice(at, at + 6000);
  assert.match(after, /validateCommitPayload\(\{ base, data: pair \}\)/,
    'полезная нагрузка проверяется и при примирении');
  assert.match(after, /base = reconcile \? \{ settings: actual\.settings, tasks: actual\.tasks \}/,
    'базой становится то, что сервер читает сам, а не то, что прислал клиент');
});

test('🔴 клиент не шлёт base: server и не везёт устаревшую попутную половину', () => {
  // Примирение на клиенте затирало чужую одновременную правку: сверка версий пропускалась.
  // Но убрать его мало. Повтор после конфликта собирал пару через commitmentWriteData, а та
  // берёт попутную половину из ЖИВОГО State — при свежей базе сверка проходила, и устаревший
  // список задач ложился поверх свежего. Так фоновая запись настроек с одного устройства
  // стирала квест, только что созданный на другом (перепроверка 19.09).
  const bodies = APP.match(/JSON\.stringify\(\{\s*base:\s*'server'/g) || [];
  assert.equal(bodies.length, 0, 'клиент не должен просить сервер пропустить сверку версий');
  const at = APP.indexOf('const freshServer = response.status === 409');
  assert.notEqual(at, -1, 'повтор после конфликта должен перечитать сервер');
  const retry = APP.slice(at, at + 1800);
  assert.match(retry, /settings: structuredClone\(value\), tasks: structuredClone\(freshServer\.tasks\)/,
    'при записи настроек попутные задачи берутся с сервера, а не из State');
  assert.match(retry, /settings: structuredClone\(freshServer\.settings\), tasks: structuredClone\(value\)/,
    'при записи задач попутные настройки берутся с сервера');
  assert.match(retry, /\{ base: freshBase, data: freshPair \}/, 'база настоящая — сверка версий остаётся');
  assert.doesNotMatch(APP.slice(at, at + 4000), /commitmentWriteData\(name, value\)/,
    'в повторе нельзя собирать пару из живого State');
});

test('ответ «кем ты хочешь стать» доходит до секретаря', () => {
  // Правило связности: факт читается везде, где меняет решение. Тень советует человеку —
  // значит должна знать, кем он решил стать, а не только что было в его дне.
  const at = APP.indexOf('function chatUserContext');
  const body = APP.slice(at, APP.indexOf('\nfunction ', at + 10));
  assert.match(body, /State\.settings\.identityGoal/, 'контекст чата читает identityGoal');
  assert.match(body, /\$\{idBlock\}/, 'и кладёт его в промпт');
});
