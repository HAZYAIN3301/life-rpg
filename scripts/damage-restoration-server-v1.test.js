'use strict';

/* «Повреждённые поля» через ИИ (владелец 03.10): сервер принимает готовые восстановления, но каждое
 * проверяет сам — та же испорченная строка на том же месте, заполнены только дыры «�». Остальное
 * пропускается и не пишется. Проверка на настоящем server.js с отдельной папкой данных. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

test('восстановления: честная замена записывается, лишняя правка и чужое место — нет', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-damage-restore-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 2400; i += 1) {
      if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
      try { if ((await fetch(`${base}/api/auth/profiles`)).ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    const reg = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'D', email: 'damage-restore@example.test', password: 'damage-pass-11' }) });
    assert.equal(reg.status, 200);
    const uid = (await reg.json()).id; const cookie = reg.headers.get('set-cookie').split(';')[0];
    const dir = path.join(dataDir, 'users', uid);
    fs.mkdirSync(dir, { recursive: true });
    const settings = { appName: 'Satoru', lang: 'ru', skills: [{ id: 's1', name: 'Учёба', note: 'не ух��дя в слив' }, { id: 's2', name: 'Спорт', note: 'С��да как и вебшутеры' }] };
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings));
    fs.writeFileSync(path.join(dir, 'inbox.json'), JSON.stringify([{ id: 'n1', kind: 'text', text: 'это D-р����нг' }]));
    const post = (body, withCookie = true) => fetch(`${base}/api/account/repair-damage`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(withCookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    assert.equal((await post({ apply: true, restorations: [] }, false)).status, 401);

    const r = await post({ apply: true, restorations: [
      { file: 'settings', path: '.skills[0].note', from: 'не ух��дя в слив', to: 'не уходя в слив' },
      { file: 'settings', path: '.skills[1].note', from: 'С��да как и вебшутеры', to: 'Сюда как и шутеры' }, // меняет не только дыру
      { file: 'settings', path: '.skills[0].name', from: 'Учёба', to: 'Учёба!' },                        // не повреждено
      { file: 'inbox', path: '[0].text', from: 'это D-р����нг', to: 'это D-рейтинг' },
      { file: 'ai-keys', path: '.openai', from: 'x��', to: 'xy' },                                      // не файл данных аккаунта
    ] });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.ok, true);
    assert.equal(d.done, 2);
    const fixedSettings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    assert.equal(fixedSettings.skills[0].note, 'не уходя в слив');
    assert.equal(fixedSettings.skills[1].note, 'С��да как и вебшутеры', 'лишняя правка не записана');
    assert.equal(fixedSettings.skills[0].name, 'Учёба');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'inbox.json'), 'utf8'))[0].text, 'это D-рейтинг');
    assert.equal(fs.existsSync(path.join(dir, 'ai-keys.json')), false);

    const again = await (await post({ apply: true, restorations: [{ file: 'settings', path: '.skills[0].note', from: 'не ух��дя в слив', to: 'не уходя в слив' }] })).json();
    assert.equal(again.done, 0, 'повтор безвреден: строка уже другая');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
