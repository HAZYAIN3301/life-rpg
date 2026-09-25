import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const [,, width = '375', theme = 'light'] = process.argv;
const browser = await launch();
const auditFn = () => {
  const root = document.getElementById('app');
  const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const EM = /\p{Extended_Pictographic}/u; const nonRu = !['ru', 'uk'].includes(document.documentElement.lang);
  const emoji = [], cyr = [];
  const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = wk.nextNode());) { const v = n.nodeValue; const el = n.parentElement; if (!v || !v.trim() || !el || !vis(el) || el.closest('[data-noi18n], textarea')) continue; if (EM.test(v) && el.closest('button, a, h1, h2, h3, summary, label')) emoji.push(v.trim().slice(0, 40)); if (nonRu && /[А-Яа-яЁё]/.test(v)) cyr.push(v.trim().slice(0, 50)); }
  const attrs = nonRu ? [...root.querySelectorAll('[placeholder],[aria-label],[title]')].flatMap((e) => ['placeholder', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v) => v && /[А-Яа-яЁё]/.test(v))) : [];
  const tiny = [...root.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => `${getComputedStyle(el).fontSize} ${String(el.className).slice(0, 16)}:${el.textContent.trim().slice(0, 18)}`);
  const small = [...root.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select, summary, textarea')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); if ((b.type === 'radio' || b.type === 'checkbox') && b.closest('label') && b.closest('label').getBoundingClientRect().height >= 42) return false; return r.height < 42 || r.width < 42; }).map((b) => `${String(b.dataset.action || b.type || b.className || b.tagName).slice(0, 22)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  const unlabelled = [...root.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select')].filter(vis).filter((i) => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).map((i) => i.id || i.name || i.type);
  return { emoji: [...new Set(emoji)].slice(0, 8), cyr: [...new Set(cyr)].slice(0, 8), attrs: [...new Set(attrs)].slice(0, 5), tiny: [...new Set(tiny)].slice(0, 6), small: [...new Set(small)].slice(0, 8), unlabelled, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
};
const show = (k, r) => { const f = Object.entries(r).filter(([, v]) => (Array.isArray(v) ? v.length : v)); console.log(k, f.length ? JSON.stringify(Object.fromEntries(f)).slice(0, 700) : 'clean'); };
for (const lang of ['ru', 'en', 'de', 'uk', 'es']) {
  const name = `qaob${lang}${Date.now() % 100000}`;
  const reg = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: name + '@example.test', password: 'synthetic-pass-123', lang }) });
  const cookie = (reg.headers.get('set-cookie') || '').split(';')[0]; const [cname, ...rest] = cookie.split('=');
  const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, hasTouch: Number(width) < 700 });
  await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
  await ctx.route('**/api/ai/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof State !== 'undefined' && document.querySelector('#app')?.children.length && State.phase, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const phase = await page.evaluate(() => State.phase);
  show(`${lang}:${phase}:start`, await page.evaluate(auditFn));
  const manual = page.locator('[data-action="questionnaire-manual"]').first();
  if (await manual.count()) {
    await manual.click(); await page.waitForTimeout(500);
    show(`${lang}:manual`, await page.evaluate(auditFn));
    await page.evaluate(() => { document.querySelectorAll('#app input[type=text], #app input:not([type]), #app textarea').forEach((el, i) => { if (!el.value) { el.value = 'Synthetic ' + (i + 1); el.dispatchEvent(new Event('input', { bubbles: true })); } }); });
    const rv = page.locator('[data-action="questionnaire-manual-review"]').first();
    if (await rv.count()) { await rv.click(); await page.waitForTimeout(600); show(`${lang}:review`, await page.evaluate(auditFn)); }
  }
  if (errors.length) console.log(lang, 'errors', errors);
  await ctx.close();
}
await browser.close();
