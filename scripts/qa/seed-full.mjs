// Synthetic QA only: registers qafull<lang> in the isolated DATA_DIR and fills goals, habits, notes and rewards
// through the app's own flows (program merge, proposal apply, capture form, reward catalog). No real data, no AI.
import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { execFileSync } from 'child_process'; import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const lang = process.argv[2] || 'en';
const out = JSON.parse(execFileSync('node', [new URL('./seed.mjs', import.meta.url).pathname, 'dense', lang, 'qafull' + lang + (process.env.QA_SUFFIX || String(Date.now() % 100000))], { env: { ...process.env, BASE } }).toString());
fs.mkdirSync(ACCOUNTS, { recursive: true }); fs.writeFileSync(accountFile(`full-${lang}`), JSON.stringify({ cookie: out.cookie }));
const [cname, ...rest] = out.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(600);
for (const label of ['Позже', 'Later', 'Später', 'Пізніше', 'Más tarde']) { const b = page.locator('button', { hasText: new RegExp('^' + label + '$') }).first(); if (await b.count() && await b.isVisible()) { await b.click(); break; } }
// 1. Habits (+ program quests) through the dungeon program merge.
await page.evaluate(() => applyProgramMerge(DUNGEON_PROGRAMS[0]));
await page.waitForTimeout(1500);
// 2. Goals through the proposal cards and the real apply/commit path.
await page.evaluate(() => {
  const sk = State.settings.skills.map((s) => s.name);
  const proposals = [
    { type: 'goal', title: 'Synthetic yearly goal', description: 'Synthetic description for QA.', spheres: [sk[2]], horizon: 'long', steps: ['First checkpoint', 'Second checkpoint', 'Third checkpoint'], status: 'active', deadline: null, parent: null, nextAction: { title: 'Synthetic next step', date: 'today', estimateMin: 20, difficulty: 'normal' } },
    { type: 'goal', title: 'Synthetic month goal', spheres: [sk[3]], backgroundSpheres: [sk[0]], horizon: 'mid', steps: ['Draft', 'Review'], status: 'active', parent: 'Synthetic yearly goal' },
    { type: 'goal', title: 'Synthetic metric goal', spheres: [sk[4]], horizon: 'short', metric: { current: 5, target: 10, unit: 'km', lowerBetter: false, maintain: false }, status: 'active' },
    { type: 'goal', title: 'Synthetic waiting goal', spheres: [sk[1]], horizon: 'short', status: 'waiting', window: 'next month' },
  ];
  openProposeModal('goals');
  _proposals = window.GoalProposalImportV1.normalize(proposals).proposals;
  renderProposalCards(document.getElementById('propose-result'), { issues: [], raw: '' });
});
await page.waitForTimeout(300);
await page.click('#propose-result [data-action="propose-apply"]');
await page.waitForTimeout(2500);
// 3. Notes through the capture form.
await page.evaluate(() => { State.view = 'notes'; render(); });
await page.waitForTimeout(500);
for (const text of ['Synthetic note one — an idea for later', 'Synthetic note two with a longer line that wraps across the card on phones', 'Synthetic note three']) {
  const input = page.locator('#capture-text').first();
  if (!(await input.count())) break;
  await input.fill(text); await page.locator('#capture-form .cap-add').first().click(); await page.waitForTimeout(1200);
}
// 4. Rewards from the catalog.
await page.evaluate(() => openRewardCatalog()); await page.waitForTimeout(400);
for (let i = 0; i < 3; i++) { const b = page.locator('[data-action="add-catalog-reward"]').nth(i); if (await b.count()) { await b.click(); await page.waitForTimeout(700); } }
await page.evaluate(() => document.getElementById('rw-catalog')?.remove());
const counts = await page.evaluate(() => ({ goals: (State.goals || []).length, habits: (State.habits || []).length, inbox: (State.inbox || []).length, rewards: (State.rewards || []).length, tasks: (State.tasks || []).length }));
console.log(JSON.stringify({ lang, counts, errors }));
await browser.close();
