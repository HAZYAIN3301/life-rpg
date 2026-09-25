import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, width = '375', theme = 'light'] = process.argv;
const browser = await launch();
const out = {};
for (const lang of ['ru', 'en', 'de', 'uk', 'es']) {
  const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, hasTouch: Number(width) < 700 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof State !== 'undefined' && document.querySelector('#app')?.children.length, null, { timeout: 20000 });
  for (const phase of ['login', 'register-language', 'register', 'reset']) {
    await page.evaluate(([l, p]) => { State.authLang = l; try { document.documentElement.lang = l; } catch {} State.phase = p; showAuthScreen(); }, [lang, phase]);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const root = document.getElementById('app');
      const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const EM = /\p{Extended_Pictographic}/u; const nonRu = !['ru', 'uk'].includes(document.documentElement.lang);
      const emoji = [], cyr = [];
      const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = wk.nextNode());) { const v = n.nodeValue; const el = n.parentElement; if (!v || !v.trim() || !el || !vis(el) || el.closest('[data-noi18n]')) continue; if (EM.test(v)) emoji.push(v.trim().slice(0, 40)); if (nonRu && /[А-Яа-яЁё]/.test(v) && !/^(Русский|Українська)$/.test(v.trim())) cyr.push(v.trim().slice(0, 50)); }
      const attrs = nonRu ? [...root.querySelectorAll('[placeholder],[aria-label],[title]')].flatMap((e) => ['placeholder', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v) => v && /[А-Яа-яЁё]/.test(v))) : [];
      const tiny = [...root.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => `${getComputedStyle(el).fontSize} ${String(el.className).slice(0, 16)}:${el.textContent.trim().slice(0, 18)}`);
      const small = [...root.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); if ((b.type === 'radio' || b.type === 'checkbox') && b.closest('label') && b.closest('label').getBoundingClientRect().height >= 42) return false; return r.height < 42 || r.width < 42; }).map((b) => `${String(b.dataset.action || b.type || b.className || b.tagName).slice(0, 22)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
      const unlabelled = [...root.querySelectorAll('input:not([type=hidden])')].filter(vis).filter((i) => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).map((i) => i.name || i.type);
      return { emoji: [...new Set(emoji)].slice(0, 8), cyr: [...new Set(cyr)].slice(0, 8), attrs: [...new Set(attrs)].slice(0, 5), tiny: [...new Set(tiny)].slice(0, 6), small: [...new Set(small)].slice(0, 8), unlabelled, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const f = Object.entries(r).filter(([k, v]) => (Array.isArray(v) ? v.length : v));
    out[`${lang}:${phase}`] = f.length ? Object.fromEntries(f) : 'clean';
  }
  out[`${lang}:errors`] = errors.length ? errors : 'none';
  await ctx.close();
}
for (const [k, v] of Object.entries(out)) console.log(k, typeof v === 'string' ? v : JSON.stringify(v).slice(0, 700));
await browser.close();
