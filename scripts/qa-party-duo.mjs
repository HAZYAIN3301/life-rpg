// Real two-account UI → API → durable file → reload. Synthetic localhost only.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = new URL('../', import.meta.url).pathname, dir = path.join(root, 'art-factory/party-duo-v249');
const dataDir = await mkdtemp(path.join(tmpdir(), 'satoru-duo-ui-')), base = 'http://127.0.0.1:4197';
await mkdir(dir, { recursive: true });
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dataDir, PORT: '4197', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
let browser; const report = { at: new Date().toISOString(), checks: [], errors: [], complete: false };
try {
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: i ? { width: 375, height: 812 } : { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage(); pages.push(page); page.on('pageerror', (e) => report.errors.push(e.message));
    const response = await page.request.post(base + '/api/auth/register', { data: { name: i ? 'Мира' : 'Александр — тестовый напарник', email: `duo-ui-${i}@example.test`, password: 'test-only-duo249', lang: 'ru' } });
    assert.equal(response.ok(), true);
    await page.goto(base); await page.waitForFunction(() => typeof State !== 'undefined' && State.me && State.phase !== 'boot');
    const later = page.getByRole('button', { name: 'Настроить позже', exact: true }); if (await later.count()) await later.click();
    await page.waitForFunction(() => State.phase === 'app'); await page.locator('#main > *').first().waitFor();
    await page.evaluate(async (i) => {
      State.settings.guideV3 = { ...(State.settings.guideV3 || {}), enabled: false };
      State.settings.tutorial = { done: true, active: false }; State.settings.sound = false;
      State.settings.questionnaire = { ...(State.settings.questionnaire || {}), status: 'deferred' };
      if (!State.settings.skills.length) State.settings.skills.push({ id: 'duo-work', name: 'Творчество', color: '#9473bb' });
      await Store.saveNow('settings', State.settings);
      document.querySelectorAll('.modal-overlay').forEach((e) => e.remove()); document.querySelector('#app')?.removeAttribute('inert');
      State.tasks.push({ id: 'duo-task-' + i, title: 'Личный черновик — название, которое нельзя раскрывать напарнику', date: todayStr(), estimateMin: 25, difficulty: 'normal', skillId: State.settings.skills[0].id, done: false });
      await Store.saveNow('tasks', State.tasks); State.view = 'party'; render();
    }, i);
  }
  const [a, b] = pages;
  const created = await (await a.request.post(base + '/api/party/create', { data: { name: 'Вечерняя мастерская', shareProgress: true, acknowledgedVisibility: true } })).json();
  await a.evaluate(async () => { await refreshPartyAuthority(); render(); });
  await a.screenshot({ path: path.join(dir, 'desktop-solo.png') });
  await b.request.post(base + '/api/party/join', { data: { code: created.party.code, shareProgress: true, acknowledgedVisibility: true } });
  for (const p of pages) await p.evaluate(async () => { await refreshPartyAuthority(); render(); });
  await a.locator('[data-duo=invite]').click();
  await a.locator('[name=publicLabel]').fill('Разобрать один эпизод сценария'); await a.locator('[name=share]').check();
  await a.screenshot({ path: path.join(dir, 'desktop-invite.png') });
  // Lost response AFTER the write: retry must reuse the same invitation ID.
  await a.route(base + '/api/party/sessions', async (route) => { await route.fetch(); await route.abort(); }, { times: 1 });
  await a.locator('[data-duo-form] [type=submit]').click();
  await a.locator('[data-duo-error]').filter({ hasText: 'Ответ не дошёл' }).waitFor();
  assert.equal(await a.locator('[name=publicLabel]').isDisabled(), true);
  assert.equal(await a.locator('[name=publicLabel]').inputValue(), 'Разобрать один эпизод сценария');
  await a.locator('[data-duo-form] [type=submit]').click(); await a.locator('#party-duo-dialog').waitFor({ state: 'hidden' });
  assert.equal((await (await a.request.get(base + '/api/party')).json()).party.sessions.length, 1);
  report.checks.push('Lost response after durable create: draft retained, retry produces exactly one invitation');
  await b.evaluate(async () => { await partyDuoUI().refresh(); });
  await b.locator('[data-duo=accept]').click();
  await b.locator('[name=publicLabel]').fill('Сделать первые наброски'); await b.locator('[name=share]').check();
  await b.screenshot({ path: path.join(dir, 'mobile-accept.png') });
  await b.locator('[data-duo-form] [type=submit]').click(); await b.locator('#party-duo-dialog').waitFor({ state: 'hidden' });
  await a.evaluate(async () => { await partyDuoUI().refresh(); });
  await a.locator('[data-duo=ready]').click(); await b.locator('[data-duo=ready]').click();
  await a.evaluate(async () => { await partyDuoUI().refresh(); });
  for (const p of pages) await p.locator('.duo-timer').waitFor();
  await a.screenshot({ path: path.join(dir, 'desktop-running.png') });
  await b.screenshot({ path: path.join(dir, 'mobile-running.png') });
  const times = await Promise.all(pages.map((p) => p.locator('.duo-timer').innerText())); assert.equal(times[0], times[1]);
  assert.equal(await b.locator('[data-duo-host]').innerText().then((text) => text.includes('Личный черновик')), false);
  report.checks.push('Two independent contexts: explicit acceptance/readiness; shared server timer; private title absent');
  await a.evaluate(() => { State.view = 'today'; render(); }); await a.locator('.duo-today').waitFor();
  await a.screenshot({ path: path.join(dir, 'desktop-today.png') }); await a.locator('.duo-today').click();
  await a.locator('[data-duo=check-out]').click(); await a.locator('[data-outcome=done]').click();
  await a.locator('#party-duo-dialog').waitFor({ state: 'hidden' });
  const tasks = await (await a.request.get(base + '/api/data/tasks')).json(); assert.equal(tasks.find((v) => v.id === 'duo-task-0').done, true);
  await b.locator('[data-duo=check-out]').click(); await b.locator('[data-outcome=partial]').click();
  await b.locator('#party-duo-dialog').waitFor({ state: 'hidden' });
  await a.reload(); await a.waitForFunction(() => State.phase === 'app'); await a.locator('#main > *').first().waitFor();
  await a.evaluate(async () => { State.view = 'party'; await refreshPartyAuthority(); render(); });
  assert.equal(await a.evaluate(() => State.party.sessions[0].status), 'finished');
  assert.equal((await (await b.request.get(base + '/api/data/tasks')).json()).find((v) => v.id === 'duo-task-1').done, false);
  report.checks.push('Real completeTask/CAS saves A task; partial leaves B task open; session survives full reload');
  for (const [locale, theme] of [['ru', 'dark'], ['en', 'light'], ['de', 'light']]) {
    await b.evaluate(({ locale, theme }) => { State.settings.lang = locale; State.settings.theme = theme; State.settings.systemMode = false; State.settings.systemSkinOff = true; State.view = 'party'; render(); }, { locale, theme });
    assert.equal(await b.evaluate(() => document.documentElement.dataset.theme), theme);
    await b.locator('.duo-history>summary').click();
    assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await b.screenshot({ path: path.join(dir, 'mobile-history-' + locale + '.png') });
  }
  await b.locator('[data-duo=invite]').click();
  await b.keyboard.press('Tab'); assert.equal(await b.evaluate(() => !!document.activeElement.closest('#party-duo-dialog')), true);
  await b.keyboard.press('Escape'); await b.locator('#party-duo-dialog').waitFor({ state: 'hidden' });
  await b.waitForFunction(() => document.activeElement.dataset.duo === 'invite');
  assert.equal(await b.evaluate(() => document.activeElement.dataset.duo), 'invite');
  report.checks.push('375px RU/EN/DE, light/dark, reduced motion, dialog keyboard focus/return, no page overflow');
  assert.deepEqual(report.errors, []); report.complete = true;
} catch (e) { report.failure = String(e.stack); throw e; }
finally {
  await writeFile(path.join(dir, 'receipt.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server.exitCode === null) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
  await rm(dataDir, { recursive: true, force: true });
}
console.log(JSON.stringify(report));
