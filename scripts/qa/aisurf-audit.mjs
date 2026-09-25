import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, acct = 'dense-en', width = '375', theme = 'dark', shots = ''] = process.argv;
const info = JSON.parse(fs.readFileSync(accountFile(acct), 'utf8')); const [cname, ...rest] = info.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/keys', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ houseAvailable: true, quota: { remaining: 100000 } }) }));
await ctx.route('**/api/ai/propose', (r) => {
  const kind = JSON.parse(r.request().postData() || '{}').kind;
  const body = kind === 'daylog' ? { proposals: [{ title: 'Synthetic walk', sphere: '', minutes: 30, difficulty: 'easy' }] }
    : kind === 'episode' ? { proposals: [], highlights: ['Synthetic'], social: 'normal' }
    : kind === 'treemap' ? { proposals: [{ title: 'Synthetic step', criterion: 'c', nextAction: 'n' }] }
    : { proposals: [{ type: 'goal', title: 'Synthetic goal', spheres: [], horizon: 'short' }] };
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await ctx.route('**/api/ai/chat', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'x' }) }));
await ctx.route('**/api/ai/analyze', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'x' }) }));
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.evaluate(() => ensureAiKeys && ensureAiKeys()); await page.waitForTimeout(400);
const audit = (sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel); if (!root) return { missing: sel };
  const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const EM = /\p{Extended_Pictographic}/u; const emoji = [], cyr = [];
  const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = wk.nextNode());) { const v = n.nodeValue; const el = n.parentElement; if (!v || !v.trim() || !el || !vis(el) || el.closest('[data-noi18n]')) continue; if (EM.test(v)) emoji.push(v.trim().slice(0, 40)); if (document.documentElement.lang !== 'ru' && document.documentElement.lang !== 'uk' && /[А-Яа-яЁё]/.test(v)) cyr.push(v.trim().slice(0, 50)); }
  const attrs = [...root.querySelectorAll('[placeholder],[aria-label],[title]')].flatMap((e) => ['placeholder', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v) => v && /[А-Яа-яЁё]/.test(v) && !['ru', 'uk'].includes(document.documentElement.lang)));
  const small = [...root.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=range]), textarea, select')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 42 || r.width < 42; }).map((b) => `${String(b.dataset.action || b.id || b.className || b.tagName).slice(0, 22)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  const dlg = root.matches('[role=dialog]') ? root : root.querySelector('[role=dialog]');
  const x = root.querySelector('.modal-x');
  return { dialog: !!dlg && !!dlg.getAttribute('aria-labelledby'), closeName: x ? (x.getAttribute('aria-label') || '') : null, emoji: [...new Set(emoji)].slice(0, 8), cyr: [...new Set(cyr)].slice(0, 8), attrs: attrs.slice(0, 4), small: [...new Set(small)].slice(0, 6) };
}, sel);
const R = {};
const run = async (name, open, sel, runSel) => {
  await page.evaluate(open); await page.waitForTimeout(300);
  R[name] = { open: await audit(sel) };
  if (shots) await page.locator(sel).first().screenshot({ path: `${shots}-${name}-open.png` }).catch(() => {});
  if (runSel) {
    await page.evaluate(({ sel, runSel }) => { const box = document.querySelector(sel); const ta = box && box.querySelector('textarea'); if (ta) ta.value = 'Synthetic day: walked 30 min, studied 1 hour'; const i = box && box.querySelector('input[type=text], #treemap-peak'); if (i && !i.value) i.value = 'Synthetic'; box.querySelector(runSel)?.click(); }, { sel, runSel });
    await page.waitForTimeout(700);
    R[name].result = await audit(sel);
    if (shots) await page.locator(sel).first().screenshot({ path: `${shots}-${name}-result.png` }).catch(() => {});
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  R[name].escapeCloses = !(await page.evaluate((sel) => !!document.querySelector(sel), sel));
  await page.evaluate((sel) => document.querySelector(sel)?.remove(), sel);
};
await run('dayrec', () => openDayRecap(), '#dayrec-modal', '[data-action="dayrec-run"]');
await run('episode', () => openEpisode(), '#ep-modal', '[data-action="ep-run"]');
await run('proposeGoals', () => openProposeModal('goals'), '#propose-modal', '[data-action="propose-run"]');
await run('proposeLevels', () => openProposeModal('calibrate'), '#propose-modal', null);
await run('treemap', () => { State.view = 'tree'; State.treeSkill = State.treeSkill || (State.settings.skills[0] || {}).id; render(); openTreeMapAI(); }, '#treemap-modal', '[data-action="treemap-run"]');
// category chip
await page.evaluate(() => { State.view = 'today'; render(); });
await page.waitForTimeout(400);
const ti = page.locator('#add-task input[name="title"]').first();
if (await ti.count()) { await ti.fill('Qzxv plmrt'); await page.waitForTimeout(300); R.cat = { chip: await audit('#cat-suggest') }; const b = page.locator('#cat-suggest [data-action="ai-cat-suggest"]'); if (await b.count()) { await b.click(); await page.waitForTimeout(600); R.cat.after = await audit('#cat-suggest'); } }
console.log(JSON.stringify({ R, errors }, null, 1));
await browser.close();
