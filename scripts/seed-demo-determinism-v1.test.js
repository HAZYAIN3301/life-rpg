'use strict';
// Ночная ветка 14.10: --seed делает демо-засев воспроизводимым — иначе цифры описи интерфейса гуляют
// между прогонами (144–176 элементов на «Сегодня» на одном и том же коде).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

async function seeded(seed, slot) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-seed-det-'));
  const port = 48900 + (process.pid % 90) + slot;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 200; i += 1) { try { if ((await fetch(`${base}/api/auth/profiles`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
    const args = ['scripts/seed-demo.mjs', '--base', base, '--email', 'det-demo@example.test', '--password', 'demo-pass-1234'];
    if (seed) args.push('--seed', seed);
    await new Promise((resolve, reject) => execFile(process.execPath, args, { cwd: ROOT, timeout: 60000 }, (e, o, er) => (e ? reject(new Error(er || o)) : resolve())));
    const users = fs.readdirSync(path.join(dataDir, 'users'));
    const read = (name) => fs.readFileSync(path.join(dataDir, 'users', users[0], name + '.json'), 'utf8');
    return { tasks: read('tasks'), habits: read('habits'), habitlog: read('habitlog') };
  } finally {
    await new Promise((r) => { child.once('exit', r); child.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test('одно зерно — одинаковые дела и привычки; без зерна — по-прежнему случайно', { timeout: 120000 }, async () => {
  const [a, b] = [await seeded('42', 0), await seeded('42', 1)];
  assert.equal(a.tasks, b.tasks); assert.equal(a.habits, b.habits); assert.equal(a.habitlog, b.habitlog);
  const c = await seeded('7', 2);
  assert.notEqual(a.tasks, c.tasks, 'другое зерно — другие данные');
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts/seed-demo.mjs'), 'utf8'), /const rand = SEED \? mulberry32\(.*\) : Math\.random;/);
});
