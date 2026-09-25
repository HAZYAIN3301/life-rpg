import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, acct = 'dense-en'] = process.argv;
const info = JSON.parse(fs.readFileSync(accountFile(acct), 'utf8')); const [cname, ...rest] = info.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/keys', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ houseAvailable: true, quota: { remaining: 100000 } }) }));
const hung = [];
for (const path of ['propose', 'analyze', 'chat']) await ctx.route(`**/api/ai/${path}`, (r) => { hung.push(r); });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const failed = []; page.on('requestfailed', (r) => { if (r.url().includes('/api/ai/')) failed.push(r.url().split('/api/ai/')[1] + ':' + (r.failure() || {}).errorText); });
await page.clock.install();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.evaluate(() => ensureAiKeys && ensureAiKeys()); await page.clock.runFor(500);
const late = async (body) => { for (const r of hung.splice(0)) { try { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); } catch { /* aborted by the page */ } } };
const state = () => page.evaluate(() => {
  const modal = document.querySelector('#dayrec-modal, #ep-modal, #propose-modal, #treemap-modal');
  const res = modal && modal.querySelector('[id$="-result"]');
  const run = modal && modal.querySelector('[data-action$="-run"]');
  return { open: modal ? modal.id : null, result: res ? res.innerText.replace(/\s+/g, ' ').trim().slice(0, 140) : null, runDisabled: run ? run.disabled : null, text: modal ? (modal.querySelector('textarea')?.value || '') : null, focus: document.activeElement ? (document.activeElement.dataset.action || document.activeElement.id || document.activeElement.tagName) : null };
});
const R = {};
// 1. Day recap: provider hangs → pending, then timeout after 90 s, text kept; late answer ignored.
await page.evaluate(() => { const b = document.createElement('button'); b.id = 'qa-opener'; b.textContent = 'open'; document.querySelector('#main').prepend(b); b.focus(); openDayRecap(); });
await page.clock.runFor(100);
await page.fill('#dayrec-text', 'Synthetic day: walked 30 minutes');
await page.click('[data-action="dayrec-run"]'); await page.clock.runFor(200);
R.dayrecPending = await state();
await page.clock.runFor(91000);
R.dayrecTimeout = await state();
await late({ proposals: [{ title: 'LATE', minutes: 10 }] }); await page.clock.runFor(300);
R.dayrecAfterLate = await state();
// 2. Cancel button → notice, request aborted, run enabled and focused.
await page.click('[data-action="dayrec-run"]'); await page.clock.runFor(200);
await page.click('[data-action="ai-surface-cancel"]'); await page.clock.runFor(200);
R.dayrecCancelled = await state();
await late({ proposals: [{ title: 'LATE2', minutes: 10 }] }); await page.clock.runFor(300);
R.dayrecAfterLate2 = await state();
// 3. Escape during pending → closed, late answer does not reopen.
await page.click('[data-action="dayrec-run"]'); await page.clock.runFor(200);
await page.keyboard.press('Escape'); await page.clock.runFor(200);
R.dayrecEscape = await state();
await late({ proposals: [{ title: 'LATE3', minutes: 10 }] }); await page.clock.runFor(300);
R.dayrecAfterEscapeLate = await state();
// 4. Proposals: timeout is two minutes, not ninety seconds.
await page.evaluate(() => openProposeModal('goals')); await page.clock.runFor(100);
await page.fill('#propose-text', 'Synthetic goal text');
await page.click('[data-action="propose-run"]'); await page.clock.runFor(91000);
R.proposeAt91s = await state();
await page.clock.runFor(30000);
R.proposeAt121s = await state();
await page.keyboard.press('Escape'); await page.clock.runFor(100); await late({});
// 5. Episode: success path after a real answer, focus lands inside the dialog.
await page.evaluate(() => openEpisode()); await page.clock.runFor(100);
await page.fill('#ep-text', 'Synthetic trip');
await page.click('[data-action="ep-run"]'); await page.clock.runFor(200);
await late({ proposals: [], highlights: ['Synthetic'], social: 'normal' }); await page.clock.runFor(300);
R.episodeDone = await state();
// 6. Account teardown during a pending request: window closed, request aborted.
await page.click('[data-action="ep-manual"]').catch(() => {});
await page.evaluate(() => { document.getElementById('ep-modal')?.remove(); openDayRecap(); }); await page.clock.runFor(100);
await page.fill('#dayrec-text', 'Synthetic');
await page.click('[data-action="dayrec-run"]'); await page.clock.runFor(200);
await page.evaluate(() => clearAllData()); await page.clock.runFor(200);
R.teardown = await state();
await late({ proposals: [{ title: 'LATE4' }] }); await page.clock.runFor(300);
R.teardownLate = await state();
R.aborted = failed;
console.log(JSON.stringify({ R, errors }, null, 1));
await browser.close();
