#!/usr/bin/env node
/* Снимает виджеты Satoru по одному — готовые кадры для роликов.
 *
 * Претензия к прежним скринам была двойной: пустой аккаунт (починено засевом) и съёмка
 * ВСЕЙ страницы, где фича теряется среди шапки, навигации и соседних карточек. Здесь
 * снимается ровно один виджет на чистом фоне.
 *
 * Кадры рендерит само приложение (`?widget=имя`), а не копия вёрстки. Это важнее, чем
 * кажется: в проекте уже был случай, когда генератор роликов рекламировал шкалу энергии
 * через месяц после её удаления. Пока источник один, реклама не может разойтись с продуктом.
 *
 * Использование:
 *   node scripts/seed-demo.mjs                       # сначала данные, иначе кадры пустые
 *   node scripts/capture-widgets.mjs                 # все виджеты, вертикаль 1080×1920
 *   node scripts/capture-widgets.mjs --only chest,board --scale 2
 *   node scripts/capture-widgets.mjs --out ~/Desktop/mahoraga/satoru-widgets
 *
 * Нужен Playwright (`npx playwright install chromium`). Если его нет — скрипт скажет об
 * этом и выйдет, а не упадёт стеком.
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const BASE = arg('base', 'http://localhost:4317').replace(/\/+$/, '');
const EMAIL = arg('email', 'demo@example.test');
const PASSWORD = arg('password', 'demo-pass-1234');
const OUT = path.resolve(arg('out', 'docs/widgets'));
const SCALE = Math.max(1, Math.min(4, Number(arg('scale', 2)) || 2));
const ONLY = (arg('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
// 1080×1920 — тот же кадр, в котором ролик и живёт. Снимаем сразу в нём, чтобы никто
// потом не переобрезал и не срезал половину карточки.
const WIDTH = Number(arg('width', 1080)), HEIGHT = Number(arg('height', 1920));

const WIDGETS = ['chest', 'dayload', 'board', 'companion', 'progress', 'collection', 'daynav'];

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  console.error('Нужен Playwright. Поставь один раз:\n  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const wanted = ONLY.length ? WIDGETS.filter((w) => ONLY.includes(w)) : WIDGETS;
if (!wanted.length) { console.error(`Неизвестные виджеты. Доступны: ${WIDGETS.join(', ')}`); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
const page = await ctx.newPage();

try {
  // Вход один раз на весь прогон: cookie живёт в контексте.
  const login = await page.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!login.ok()) {
    console.error(`Не вошли (${login.status()}). Засей аккаунт: node scripts/seed-demo.mjs --base ${BASE}`);
    process.exit(1);
  }

  const made = [];
  for (const name of wanted) {
    await page.goto(`${BASE}/?widget=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' });
    const stage = page.locator('.capture-stage > *').first();
    await stage.waitFor({ state: 'visible', timeout: 15000 });

    // Снимаем сам виджет, а не страницу: вокруг него уже нет ничего, но обрезка по элементу
    // даёт кадр без лишних полей — его удобнее ставить в композицию.
    const file = path.join(OUT, `${name}.png`);
    await stage.screenshot({ path: file });
    // И полный кадр 9:16 — под фон, когда виджет должен «жить» в вертикали.
    const full = path.join(OUT, `${name}-9x16.png`);
    await page.screenshot({ path: full });
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    made.push(name);
    console.log(`  ${name.padEnd(11)} ${kb} КБ  +9×16`);
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), base: BASE, scale: SCALE, viewport: { width: WIDTH, height: HEIGHT },
    widgets: made, note: 'Кадры рендерит само приложение (?widget=), не копия вёрстки.',
  }, null, 2));
  console.log(`\nГотово: ${made.length} виджетов → ${path.relative(process.cwd(), OUT)}`);
} finally {
  await browser.close();
}
