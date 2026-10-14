'use strict';
// Ночная ветка 14.10: окно удаления заметки обещает «медиа исчезнут», а файл записи оставался на сервере
// и скачивался. Теперь клиент после явного удаления просит удалить файл, сервер удаляет только файл,
// на который не ссылается ни одна сохранённая заметка (сохранение заметок — «последний прав»).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('файл записи удаляется только после удаления заметки и только своим владельцем', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-media-delete-v1-'));
  const port = 49950 + process.pid % 40, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); fs.rmSync(dataDir, { recursive: true, force: true }); });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  async function call(route, user, method = 'GET', body) {
    const res = await fetch(base + route, { method, headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  }
  const owner = await call('/api/auth/register', null, 'POST', { name: 'Media Owner', email: 'media-owner@example.test', password: 'media-testing-123' });
  const other = await call('/api/auth/register', null, 'POST', { name: 'Media Other', email: 'media-other@example.test', password: 'media-testing-123' });
  assert.equal(owner.status, 200); assert.equal(other.status, 200);
  const up = await call('/api/inbox/media', owner, 'POST', { dataUrl: 'data:audio/webm;base64,' + Buffer.from('synthetic-audio').toString('base64') });
  assert.equal(up.status, 200); const file = up.data.file;
  const note = { id: 'n1', kind: 'voice', text: '', file, type: 'audio/webm', at: new Date().toISOString() };
  assert.equal((await call('/api/data/inbox', owner, 'PUT', [note])).status, 200);
  const route = `/api/inbox/media/${file}`;
  assert.equal((await call(route, null, 'DELETE')).status, 401, 'без входа нельзя');
  const busy = await call(route, owner, 'DELETE');
  assert.equal(busy.status, 409); assert.equal(busy.data.error, 'still_referenced', 'файл заметки, которая ещё есть, не трогаем');
  assert.equal((await call(route, owner)).status, 200);
  assert.equal((await call('/api/data/inbox', owner, 'PUT', [])).status, 200);
  const foreign = await call(route, other, 'DELETE');
  assert.equal(foreign.status, 200); assert.equal(foreign.data.deleted, false, 'чужой запрос смотрит только в свою папку');
  assert.equal((await call(route, owner)).status, 200, 'после чужого запроса файл владельца на месте');
  const gone = await call(route, owner, 'DELETE');
  assert.equal(gone.status, 200); assert.equal(gone.data.deleted, true);
  assert.equal((await call(route, owner)).status, 404, 'после удаления запись больше не скачивается');
  const again = await call(route, owner, 'DELETE');
  assert.equal(again.status, 200); assert.equal(again.data.deleted, false, 'повтор безопасен');
  assert.notEqual((await call('/api/inbox/media/..%2Fusers.json', owner, 'DELETE')).status, 200, 'путь наружу не проходит');
  assert.ok(fs.existsSync(path.join(dataDir, 'users.json')), 'файлы вне папки записей не тронуты');
});

test('после удаления заметки клиент просит удалить её запись', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const at = app.indexOf('async function confirmNoteDelete() {');
  const body = app.slice(at, app.indexOf('\n}', at));
  assert.match(body, /const removed = \(State\.inbox \|\| \[\]\)\.find\(\(note\) => note\.id === id\);/);
  const saved = body.indexOf('if (!saved)'), del = body.indexOf("{ method: 'DELETE' }");
  assert.ok(saved > 0 && del > saved, 'файл удаляется только после успешного сохранения списка');
  assert.match(body, /if \(removed\?\.file\) fetch\(`\/api\/inbox\/media\/\$\{encodeURIComponent\(removed\.file\)\}`, \{ method: 'DELETE' \}\)\.catch\(\(\) => \{\}\);/);
});
