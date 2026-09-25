import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, acct = 'dense-ru', width = '375', theme = 'dark', shots = ''] = process.argv;
const info = JSON.parse(fs.readFileSync(accountFile(acct), 'utf8')); const [cname, ...rest] = info.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/keys', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ houseAvailable: true, quota: { remaining: 100000 } }) }));
await ctx.route('**/api/ai/chat', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Синтетический ответ Тени: один шаг на 10 минут.' }) }));
await ctx.route('**/api/ai/analyze', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'x' }) }));
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(800);
for (const label of ['Позже', 'Later', 'Später', 'Пізніше', 'Más tarde']) { const b = page.locator('button', { hasText: new RegExp('^' + label + '$') }).first(); if (await b.count() && await b.isVisible()) { await b.click(); break; } }
await page.evaluate((th) => { State.settings.theme = th; try { applyTheme(); } catch {} ensureAiKeys(); }, theme);
const audit = (sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel); if (!root) return { missing: sel };
  const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const EM = /\p{Extended_Pictographic}/u; const emoji = [];
  const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = wk.nextNode());) { const v = n.nodeValue; if (!v || !EM.test(v)) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('[data-noi18n]') || el.closest('.chat-msg')) continue; emoji.push(`${el.tagName}.${String(el.className).slice(0, 24)}:${v.trim().slice(0, 30)}`); }
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { const st = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let o = { r: 255, g: 255, b: 255 }; if (st.length && st[st.length - 1].a >= 1) o = st.pop(); for (const c of st.reverse()) o = { r: c.r * c.a + o.r * (1 - c.a), g: c.g * c.a + o.g * (1 - c.a), b: c.b * c.a + o.b * (1 - c.a) }; return o; };
  const low = []; const tiny = [];
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el) || el.closest('svg') || ![...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
    const cs = getComputedStyle(el); if (parseFloat(cs.fontSize) < 12) tiny.push(`${cs.fontSize}:${el.textContent.trim().slice(0, 24)}`);
    const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const need = parseFloat(cs.fontSize) >= 24 ? 3 : 4.5; if (ratio < need && (parseFloat(cs.opacity) || 1) >= .99) low.push(`${ratio.toFixed(2)} ${String(el.className).slice(0, 20)}:${el.textContent.trim().slice(0, 24)}`);
  }
  const small = [...root.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]):not([type=file]), textarea, select, summary')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 42 || r.width < 42; }).map((b) => `${String(b.dataset.action || b.className || b.tagName).slice(0, 26)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  const cyr = document.documentElement.lang !== 'ru' && document.documentElement.lang !== 'uk' ? (() => { const r = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) { if (/[А-Яа-яЁё]/.test(n.nodeValue) && !n.parentElement.closest('[data-noi18n], .chat-msg') && vis(n.parentElement)) r.push(n.nodeValue.trim().slice(0, 40)); } return r.slice(0, 6); })() : [];
  return { emoji: [...new Set(emoji)].slice(0, 8), low: [...new Set(low)].slice(0, 6), tiny: [...new Set(tiny)].slice(0, 6), small: [...new Set(small)].slice(0, 8), cyr };
}, sel);
const R = {};
// Today companion
await page.evaluate(() => { State.view = 'today'; State._todayCompanionOpen = true; render(); }); await page.waitForTimeout(500);
R.today = await audit('.today-support');
if (shots) { const l = page.locator('.today-support').first(); if (await l.count()) { await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: `${shots}-today.png` }); } }
// Chat
await page.evaluate(() => openHelperChat()); await page.waitForTimeout(500);
await page.fill('#chat-input', 'Синтетический вопрос'); await page.press('#chat-input', 'Enter'); await page.waitForTimeout(800);
R.chat = await audit('#helper-modal');
if (shots) await page.locator('#helper-modal .helper-box, #helper-modal > *').first().screenshot({ path: `${shots}-chat.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// Den
await page.evaluate(() => { State.view = 'den'; render(); }); await page.waitForTimeout(700);
R.den = await audit('#main');
if (shots) await page.screenshot({ path: `${shots}-den.png` });
console.log(JSON.stringify({ R, errors }, null, 1));
await browser.close();
