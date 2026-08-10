const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

async function startServer(port, dataDir) {
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; child.stderr.on('data', (chunk) => { err += chunk; });
  for (let i = 0; i < 80; i++) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${err}`);
    try { const response = await fetch(`http://127.0.0.1:${port}/api/auth/me`); if (response.status) return child; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${err}`);
}
async function account(base, email) {
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'habits-pass-126', name: 'Habit QA' }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { cookie, body: await response.json() };
}

test('Habits v126 uses checked load, global write fences and one atomic client transaction', () => {
  assert.match(APP, /Store\.loadChecked\('habits', \[\], validateHabitsPayload\)/);
  assert.match(APP, /Store\.loadChecked\('habitlog', \{\}, validateHabitlogPayload\)/);
  assert.match(APP, /Store\.loadChecked\('antihabits', \[\], validateAntihabitsPayload\)/);
  assert.match(APP, /\['habits', 'habitlog', 'antihabits'\]\.includes\(name\).*habitWriteAllowed\('_put'/s);
  assert.match(APP, /fetch\('\/api\/habits\/commit'/);
  assert.match(APP, /habitDataCommit\(\{ habitlog: nextLog, settings: nextSettings \}\)/);
  assert.match(APP, /e\.cur == null[\s\S]*Number\(e\.value\)/);
  assert.match(APP, /at: new Date\(\)\.toISOString\(\), energy \}/);
  assert.match(APP, /nextSettings\.energy\.cur = Math\.max[\s\S]*energy\.delta/);
  assert.match(APP, /State\._habitTxnBusy = key;[\s\S]*await habitDataCommit/);
  assert.match(APP, /async function undoHabitCompletion/);
});

test('Habits v126 privacy, local-day and non-shaming contracts are explicit', () => {
  const weekContext = APP.slice(APP.indexOf('function buildWeekContext()'), APP.indexOf('async function runWeeklyReview()'));
  assert.doesNotMatch(weekContext, /State\.antihabits|Анти-привычки/);
  assert.match(APP, /function localDayOrdinal\([\s\S]*Date\.UTC/);
  assert.match(APP, /localDayDistance\(from, habitDayKey\(\)\)/);
  assert.match(APP, /Стрик — наблюдение, не долг/);
  assert.match(APP, /не публикуются в Party, leaderboard и не отправляются в AI-разбор недели/);
  assert.doesNotMatch(APP.slice(APP.indexOf('function habitsBuildHTML()'), APP.indexOf('function habitsBreakHTML()')), /Никогда не пропускай дважды/);
});

test('Habits v126 exposes work-first, keyboard and touch state', () => {
  assert.match(APP, /<h2 id="habits-title"/);
  assert.match(APP, /role="tablist"/);
  assert.match(APP, /role="tab" aria-selected=/);
  assert.match(APP, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
  assert.match(APP, /aria-pressed="\$\{done \? 'true' : 'false'\}"/);
  assert.match(APP, /id="add-habit-v126"/);
  assert.match(CSS, /\.hsub\[role="tablist"\] \.navsubtab \{ min-height: var\(--touch-min\)/);
  assert.match(CSS, /\.anti-row2 \.del \{ min-inline-size: var\(--touch-min\); min-block-size: var\(--touch-min\)/);
  assert.match(CSS, /body:has\(\.habits-shell\) #ai-fab \{ display: none; \}/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.habits-shell/);
  const cacheVersion = Number(SW.match(/const CACHE = 'satoru-v(\d+)'/)?.[1] || 0);
  assert.ok(cacheVersion >= 126, `expected SW cache v126 or newer, got v${cacheVersion}`);
});

test('Habits v126 day keys follow the user timezone and streak distance survives DST', () => {
  const code = `const pad=n=>String(n).padStart(2,'0');const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());const ord=d=>Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);const instant=new Date('2026-08-10T00:30:00.000Z');const a=new Date(2026,2,28),b=new Date(2026,2,29),c=new Date(2026,2,30);console.log(JSON.stringify({key:key(instant),gaps:[ord(b)-ord(a),ord(c)-ord(b)]}))`;
  const berlin = JSON.parse(spawnSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8' }).stdout);
  const losAngeles = JSON.parse(spawnSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' }).stdout);
  assert.equal(berlin.key, '2026-08-10'); assert.equal(losAngeles.key, '2026-08-09');
  assert.deepEqual(berlin.gaps, [1, 1]); assert.deepEqual(losAngeles.gaps, [1, 1]);
});

test('Habits commit is account-owned, validates its allowlist and is idempotent', async (t) => {
  assert.match(SERVER, /function commitHabitData\(uid, payload\)/);
  assert.match(SERVER, /habit_commit_failed_no_changes_lost/);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-habits-v126-'));
  const port = 46000 + Math.floor(Math.random() * 1000);
  const child = await startServer(port, dataDir);
  t.after(() => { child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const one = await account(base, 'habit-one@example.test');
  const two = await account(base, 'habit-two@example.test');
  const candidate = { habits: [{ id: 'h1', title: 'Read', skillId: 'sk1', estimateMin: 10, difficulty: 'easy', days: [1], archived: false }], habitlog: { '2026-08-10': { h1: { xp: 1, gold: 1, min: 10, at: '2026-08-10T08:00:00.000Z' } } } };
  for (let i = 0; i < 2; i++) {
    const response = await fetch(base + '/api/habits/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: one.cookie }, body: JSON.stringify({ data: candidate }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  }
  const oneRead = await fetch(base + '/api/data/habitlog', { headers: { Cookie: one.cookie } });
  assert.deepEqual(await oneRead.json(), candidate.habitlog);
  const twoRead = await fetch(base + '/api/data/habitlog', { headers: { Cookie: two.cookie } });
  assert.equal(twoRead.status, 404);
  const invalid = await fetch(base + '/api/habits/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: one.cookie }, body: JSON.stringify({ data: { rewards: [] } }) });
  assert.equal(invalid.status, 400);
  const badShape = await fetch(base + '/api/habits/commit', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: one.cookie }, body: JSON.stringify({ data: { habits: [{}] } }) });
  assert.equal(badShape.status, 400);
  const anonymous = await fetch(base + '/api/habits/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: candidate }) });
  assert.equal(anonymous.status, 401);
});
