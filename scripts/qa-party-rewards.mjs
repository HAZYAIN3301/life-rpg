// Isolated real UI/API/disk test. Never connects to a production account.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = new URL('../', import.meta.url).pathname, out = path.join(root, 'art-factory/party-rewards-v250');
const dir = await mkdtemp(path.join(tmpdir(), 'satoru-reward-ui-')), base = 'http://127.0.0.1:4198';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: '4198', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
let browser; const report = { at: new Date().toISOString(), checks: [], errors: [], complete: false };
try {
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
  const registered = await page.request.post(base + '/api/auth/register', { data: { name: 'Алекс — тест награды', email: 'reward-ui@example.test', password: 'test-only-reward250', lang: 'ru' } });
  assert.equal(registered.ok(), true); const user = await registered.json();
  await page.goto(base); await page.waitForFunction(() => typeof State !== 'undefined' && State.me && State.phase !== 'boot');
  const later = page.getByRole('button', { name: 'Настроить позже', exact: true }); if (await later.count()) await later.click();
  await page.waitForFunction(() => State.phase === 'app');
  await page.locator('#main > *').first().waitFor();
  await page.evaluate(async () => {
    State.settings.guideV3 = { ...(State.settings.guideV3 || {}), enabled: false };
    State.settings.tutorial = { done: true, active: false }; State.settings.sound = false;
    const skill = State.settings.skills[0]?.id || 'reward-work';
    if (!State.settings.skills.length) State.settings.skills.push({ id: skill, name: 'Творчество', color: '#9473bb' });
    if (!await Store.saveNow('settings', State.settings)) throw new Error('Fixture settings did not save');
    document.querySelectorAll('.modal-overlay').forEach((e) => e.remove()); document.querySelector('#app')?.removeAttribute('inert');
    State.tasks.push({ id: 'reward-proof', title: 'Проверить один законченный шаг', date: todayStr(), estimateMin: 30, difficulty: 'normal', skillId: skill, done: false });
    State.tasks.push({ id: 'reward-qualification', title: 'Синтетический недельный вклад', date: todayStr(), estimateMin: 400, difficulty: 'normal', skillId: skill, done: true, completedAt: new Date().toISOString(), xpAwarded: 605, goldAwarded: 0 });
    await Store.saveNow('tasks', State.tasks); State.view = 'party'; render();
  });
  const made = await (await page.request.post(base + '/api/party/create', { data: { name: 'Небольшая мастерская', shareProgress: true, acknowledgedVisibility: true } })).json();
  assert.equal(made.party.raid.won, true, 'the synthetic saved weekly contribution actually qualifies');
  await page.evaluate(async (cycle) => { localStorage.setItem('liferpg_raidwin_' + cycle, '1'); await refreshPartyAuthority(); render(); }, made.party.ws);
  await page.locator('.party-progress-details > summary').click();
  const before = await page.evaluate(() => ({ gold: goldBalance(), xp: itemXp(State.tasks.find((t) => t.id === 'reward-proof')), loot: State.lootbox?.goldWon || 0 }));
  await page.screenshot({ path: path.join(out, 'desktop-unclaimed.png'), fullPage: true });
  // Lose only the response, AFTER the server has written the award.
  await page.route(base + '/api/party/claim', async (route) => { await route.fetch(); await route.abort(); }, { times: 1 });
  await page.locator('[data-action=party-claim]').click();
  await page.getByRole('button', { name: 'Проверить получение награды', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => goldBalance()), before.gold);
  const ledgerPath = path.join(dir, 'users', user.id, 'party-rewards.json');
  assert.equal(JSON.parse(await readFile(ledgerPath, 'utf8')).receipts.length, 1);
  await page.screenshot({ path: path.join(out, 'desktop-retry.png'), fullPage: true });
  await page.getByRole('button', { name: 'Проверить получение награды', exact: true }).click();
  await page.waitForFunction((gold) => goldBalance() === gold + 150, before.gold);
  assert.equal(await page.evaluate(() => State.lootbox?.goldWon || 0), before.loot);
  assert.equal(await page.locator('.party-progress-details').getAttribute('open'), '');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('raid-claimed')), true);
  await page.route(base + '/api/party/rewards', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ partyRewards: { version: 1, receipts: [] } }) }), { times: 1 });
  await page.evaluate(() => refreshPartyRewards());
  assert.equal(await page.evaluate(() => goldBalance()), before.gold + 150, 'a delayed older snapshot cannot roll back confirmed credit');
  const xp = await page.evaluate(async () => {
    const task = State.tasks.find((t) => t.id === 'reward-proof'); const preview = itemXp(task);
    const saved = await completeTask(task, null);
    const receipt = partyRewardSnapshot().receipts[0];
    return { preview, saved, actual: State.tasks.find((t) => t.id === task.id).xpAwarded, afterExpiry: itemXp({ ...task, completedAt: receipt.boost.until }) };
  });
  assert.equal(xp.saved, true); assert.equal(xp.actual, xp.preview); assert.ok(xp.actual > before.xp); assert.equal(xp.afterExpiry, before.xp);
  const persistedTask = JSON.parse(await readFile(path.join(dir, 'users', user.id, 'tasks.json'), 'utf8')).find((t) => t.id === 'reward-proof');
  assert.equal(persistedTask.xpAwarded, xp.actual);
  report.checks.push('Lost response → unchanged client balance → safe retry → one durable 150-gold credit, no lootbox write', 'Focus returns to receipt; expanded raid remains open', 'Actual task completion saves boosted XP; expiry stops future bonus without removing earned XP');
  report.checks.push('Stale wallet response cannot overwrite a newer confirmed reward');
  await page.reload(); await page.waitForFunction(() => State.phase === 'app');
  assert.equal(await page.evaluate(() => partyRewardSnapshot().receipts.length), 1);
  assert.equal(await page.evaluate(() => State.tasks.find((t) => t.id === 'reward-proof').xpAwarded), xp.actual);
  for (const locale of ['ru', 'en', 'de']) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: theme === 'light' ? 375 : 1280, height: theme === 'light' ? 812 : 900 });
    await page.evaluate(async ({ locale, theme }) => { State.settings.lang = locale; State.settings.theme = theme; State.settings.systemMode = false; State.settings.systemSkinOff = true; await Store.saveNow('settings', State.settings); await refreshPartyAuthority(); State.view = 'party'; render(); }, { locale, theme });
    await page.locator('.party-progress-details').waitFor();
    await page.locator('.party-progress-details').evaluate((el) => { el.open = true; });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    await page.locator('.party-progress-details').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, `${locale}-${theme}.png`) });
  }
  assert.equal(report.errors.length, 0);
  report.checks.push('Reload preserves receipt and awarded XP', 'RU/EN/DE · 375/1280 · light/dark · reduced motion · no document overflow');
  report.complete = true;
} finally {
  await writeFile(path.join(out, 'receipt.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server.exitCode === null) await new Promise((r) => { server.once('exit', r); server.kill(); });
  await rm(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(report, null, 2));
