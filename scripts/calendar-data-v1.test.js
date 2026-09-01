const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = app.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    else if (app[i] === '}') {
      depth -= 1;
      if (depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function asyncObjectMethod(name) {
  const needle = `async ${name}(`;
  const start = app.indexOf(needle);
  assert.notEqual(start, -1, `${name} method must exist`);
  const paramsEnd = app.indexOf(')', start + needle.length);
  const params = app.slice(start + needle.length, paramsEnd);
  const brace = app.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = brace; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    else if (app[i] === '}') {
      depth -= 1;
      if (depth === 0) return `async function ${name.replace(/^_/, 'private_')}(${params})${app.slice(brace, i + 1)}`;
    }
  }
  throw new Error(`unterminated Store.${name}`);
}

test('tasks use checked loading and retain a distinct error state', () => {
  assert.match(app, /Store\.loadChecked\('tasks', \[\], validateTasksPayload\)/);
  assert.doesNotMatch(app, /State\.tasks\s*=\s*await Store\.load\('tasks', \[\]\)/);
  assert.match(app, /State\._tasksLoadError\s*=\s*tasksLoad\.error/);
  assert.match(functionBody('safeViewMarkup'), /if \(State\._tasksLoadError\) return calendarLoadRecoveryHTML\(\);/);
});

test('task payload validation rejects false-empty shapes', () => {
  const validateTasksPayload = Function(`return (${functionBody('validateTasksPayload')})`)();
  const valid = { id: 'q1', title: 'Write the plan', date: '2026-08-09', startTime: null, done: false, estimateMin: 30 };
  assert.equal(validateTasksPayload([]), true);
  assert.equal(validateTasksPayload([valid]), true);
  assert.equal(validateTasksPayload(null), false);
  assert.equal(validateTasksPayload({}), false);
  assert.equal(validateTasksPayload(['q1']), false);
  assert.equal(validateTasksPayload([null]), false);
  assert.equal(validateTasksPayload([[]]), false);
  assert.equal(validateTasksPayload([{}]), false);
  assert.equal(validateTasksPayload([{ id: 'q1' }]), false);
  assert.equal(validateTasksPayload([valid, { ...valid }]), false);
  assert.equal(validateTasksPayload([{ ...valid, date: '2026-02-30' }]), false);
  assert.equal(validateTasksPayload([{ ...valid, startTime: '25:00' }]), false);
  assert.equal(validateTasksPayload([{ ...valid, done: 'yes' }]), false);
});

test('task writes are blocked at the lowest Store primitive', async () => {
  assert.match(functionBody('taskWriteAllowed'), /if \(!State\._tasksLoadError\) return true/);
  assert.match(app, /name === 'tasks' && !taskWriteAllowed\('save', true\)/);
  assert.match(app, /name === 'tasks' && !taskWriteAllowed\('saveNow', true\)/);
  const putSource = asyncObjectMethod('_put');
  assert.match(putSource, /name === 'tasks' && !taskWriteAllowed\('_put', true\)/);

  let fetches = 0;
  const makePut = Function('fetch', 'pwaWriteAllowed', 'taskWriteAllowed', 'accountDataWriteAllowed', 'accountDataPayloadAllowed', 'console', 'toast', 'State', `return (${putSource})`);
  const blockedPut = makePut(async () => { fetches += 1; return { ok: true }; }, () => true, () => false, () => true, () => true, { error() {} }, () => {}, { me: null });
  assert.equal(await blockedPut('tasks', []), false);
  assert.equal(fetches, 0);

  const allowedPut = makePut(async () => { fetches += 1; return { ok: true }; }, () => true, () => true, () => true, () => true, { error() {} }, () => {}, { me: null });
  const storeContext = {
    _writeEpoch: 0,
    _liveSlot() { return ''; },
    runExclusive(_names, operation) { return operation({ writeEpoch: 0, accountId: '' }); },
  };
  assert.equal(await allowedPut.call(storeContext, 'tasks', []), true);
  assert.equal(fetches, 1);
});

test('recovery UI is actionable, localized, and not an empty calendar', () => {
  assert.match(app, /role="alert"/);
  assert.match(app, /data-action="cal-tasks-retry"/);
  assert.match(app, /retryTasksLoad\(\)/);
  for (const key of [
    'План временно недоступен',
    'Не удалось загрузить квесты. Мы ничего не перезапишем, пока данные не вернутся.',
    'Файл квестов повреждён. Мы ничего не перезапишем, пока данные не будут восстановлены.',
    'Повторить загрузку',
    'Проверяем данные…',
  ]) {
    const row = app.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
  assert.match(css, /\.calendar-load-retry[\s\S]*min-block-size:\s*var\(--touch-min\)/);
});

test('retry only clears the write guard after a valid payload', () => {
  const retry = functionBody('retryTasksLoad');
  assert.match(retry, /State\._tasksLoadError\s*=\s*result\.error/);
  assert.match(retry, /if \(!result\.error\) \{/);
  assert.match(retry, /State\.tasks\s*=\s*normalizeLoadedTasks\(result\.value\)/);
  assert.match(retry, /State\._tasksWriteBlockedNoticeAt\s*=\s*0/);
  assert.match(retry, /State\._tasksFocusAfterCommit\s*=\s*result\.error/);
  assert.doesNotMatch(retry, /requestAnimationFrame/);
  assert.match(functionBody('afterMainCommit'), /if \(State\._tasksFocusAfterCommit\)/);
});

test('checked loading distinguishes malformed JSON, HTTP failure, and valid data at runtime', async () => {
  const loadSource = asyncObjectMethod('loadChecked');
  const makeLoad = Function('fetch', 'structuredClone', 'console', `return (${loadSource})`);
  const silent = { error() {} };

  const malformed = makeLoad(async () => ({
    status: 200, ok: true,
    async json() { throw new SyntaxError('bad json'); },
  }), structuredClone, silent);
  assert.deepEqual(await malformed('tasks', [], () => true), { value: [], error: 'invalid' });

  const failed = makeLoad(async () => ({ status: 500, ok: false }), structuredClone, silent);
  assert.deepEqual(await failed('tasks', [], () => true), { value: [], error: 'load' });

  const payload = [{ id: 'q1', title: 'Recovered', date: '2026-08-09' }];
  const valid = makeLoad(async () => ({ status: 200, ok: true, async json() { return payload; } }), structuredClone, silent);
  assert.deepEqual(await valid('tasks', [], () => true), { value: payload, error: '' });
});
