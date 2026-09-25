import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, acct = 'dense-en', width = '375', theme = 'dark'] = process.argv;
const info = JSON.parse(fs.readFileSync(accountFile(acct), 'utf8')); const [cname, ...rest] = info.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, hasTouch: Number(width) < 700 });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await ctx.route('**/api/commitments/commit', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"qa"}' }));
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(600);
const STATES = [
  ['today', {}], ['today:board', { _todayTab: 'board' }], ['notes', {}], ['calendar', {}], ['habits', {}], ['shelf', {}], ['den', {}], ['character', {}], ['pets', {}],
  ['goals:focus', { goalView: 'focus' }], ['goals:all', { goalView: 'all' }], ['goals:map', { goalView: 'map' }], ['goals:archive', { goalView: 'archive' }],
  ['tree', {}], ['rewards', {}], ['weekly', {}], ['stats', {}], ['party', {}], ['leaderboard', {}],
  ...['account', 'experience', 'life', 'connections', 'progression', 'data'].map((g) => [`settings:${g}`, { settingsSection: g }]),
];
const out = {};
for (const [name, extra] of STATES) {
  await page.evaluate(([v, extra, th]) => { State.settings.theme = th; try { applyTheme(); } catch {} Object.assign(State, extra); State.view = v.split(':')[0]; State._todayCompanionOpen = true; render(); window.scrollTo(0, 0); }, [name, extra, theme]);
  await page.waitForTimeout(350);
  await page.evaluate(() => { document.querySelectorAll('#main details').forEach((d) => { d.open = true; }); });
  await page.waitForTimeout(250);
  out[name] = await page.evaluate(() => {
    const main = document.querySelector('#main');
    const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
    const EM = /\p{Extended_Pictographic}/u; const nonRu = !['ru', 'uk'].includes(document.documentElement.lang);
    const emoji = [], cyr = [];
    const wk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n; (n = wk.nextNode());) {
      const v = n.nodeValue; if (!v || !v.trim()) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('[data-noi18n], textarea, .chat-msg')) continue;
      if (EM.test(v) && el.closest('button, a, h1, h2, h3, h4, h5, summary, label, [role="tab"], .kpi')) emoji.push(v.trim().slice(0, 40));
      if (nonRu && /[А-Яа-яЁёІіЇїЄєҐґ]/.test(v)) cyr.push(v.trim().slice(0, 50));
    }
    const attrs = nonRu ? [...main.querySelectorAll('[placeholder],[aria-label],[title]')].filter((e) => !e.closest('[data-noi18n]')).flatMap((e) => ['placeholder', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v) => v && /[А-Яа-яЁё]/.test(v))) : [];
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { const st = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let o = { r: 255, g: 255, b: 255 }; if (st.length && st[st.length - 1].a >= 1) o = st.pop(); for (const c of st.reverse()) o = { r: c.r * c.a + o.r * (1 - c.a), g: c.g * c.a + o.g * (1 - c.a), b: c.b * c.a + o.b * (1 - c.a) }; return o; };
    const low = [], tiny = [];
    for (const el of main.querySelectorAll('*')) {
      if (!vis(el) || el.closest('svg') || ![...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
      const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize);
      if (size < 12 && !el.closest('[aria-hidden="true"]')) tiny.push(`${size}px ${String(el.className).slice(0, 18)}:${el.textContent.trim().slice(0, 22)}`);
      const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
      const fgc = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) } : fg;
      const L1 = lum(fgc), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const need = (size >= 24 || (parseInt(cs.fontWeight) >= 700 && size >= 18.66)) ? 3 : 4.5;
      if (ratio < need && (parseFloat(cs.opacity) || 1) >= 0.99 && !el.closest('[disabled], .done, del, s')) low.push(`${ratio.toFixed(2)} ${String(el.className).slice(0, 18)}:${el.textContent.trim().slice(0, 22)}`);
    }
    const small = [...main.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]):not([type=file]), select, summary, textarea')].filter(vis).filter((b) => {
      const r = b.getBoundingClientRect(); if (r.width >= 42 && r.height >= 42) return false;
      if ((b.type === 'radio' || b.type === 'checkbox') && b.closest('label') && b.closest('label').getBoundingClientRect().height >= 42) return false;
      return true;
    }).map((b) => `${String(b.dataset.action || b.type || b.className || b.tagName).slice(0, 24)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
    const overflow = document.documentElement.scrollWidth > innerWidth + 1;
    return { emoji: [...new Set(emoji)].slice(0, 10), cyr: [...new Set(cyr)].slice(0, 10), attrs: [...new Set(attrs)].slice(0, 6), low: [...new Set(low)].slice(0, 8), tiny: [...new Set(tiny)].slice(0, 8), small: [...new Set(small)].slice(0, 10), overflow };
  });
}
fs.writeFileSync(`${ACCOUNTS}/hidden-${acct}-${width}-${theme}.json`, JSON.stringify({ out, errors }, null, 1));
for (const [v, r] of Object.entries(out)) { const f = Object.entries(r).filter(([k, x]) => (Array.isArray(x) ? x.length : x)); if (f.length) console.log(v + ': ' + f.map(([k, x]) => `${k}=${Array.isArray(x) ? JSON.stringify(x) : x}`).join(' | ')); }
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
