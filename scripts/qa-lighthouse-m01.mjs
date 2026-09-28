// Standalone design prototype. Does not exercise or claim production multiplayer UI.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'work/m03b'), data = await mkdtemp(path.join(tmpdir(), 'satoru-m01-'));
const base = 'http://127.0.0.1:52007';
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: data, PORT: '52007', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
const report = { states: 0, completions: 0, screenshots: [], errors: [], contrastMinimum: 100, checks: [] };
const browsers = [];
await mkdir(out, { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(base + '/api/version')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 40)); }
  assert.ok(ready);
  const pairs = [['compass', 'lens', 'wait', 'flash'], ['compass', 'repair', 'shelter', 'anchor'], ['lens', 'repair', 'align', 'brace']];
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch(engine === chromium ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } : { headless: true }); browsers.push(browser);
    for (const width of [375, 1280]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
      page.on('request', request => { if (request.url().includes('/api/')) report.errors.push('prototype called API: ' + request.url()); });
      await page.goto(base + '/experiments/lighthouse-m01.html');
      const choose = (group, value) => page.locator(`[data-group="${group}"][data-value="${value}"]`).click();
      const actor = n => page.locator(`[data-actor="${n}"]`).click();
      const next = () => page.locator('[data-next]').click();
      async function audit(name, screenshot = false) {
        const checks = await page.evaluate(() => {
          const visible = [...document.querySelectorAll('button')].filter(e => e.getClientRects().length);
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            short: visible.filter(e => e.getBoundingClientRect().height < 42).map(e => e.textContent),
            animation: visible.some(e => getComputedStyle(e).animationName !== 'none') };
        });
        assert.equal(checks.overflow, false, name); assert.deepEqual(checks.short, []); assert.equal(checks.animation, false);
        const contrast = await page.evaluate(() => {
          const e = document.querySelector('.lh-panel'), p = document.querySelector('.lh-private');
          const channels = s => s.match(/[\d.]+/g).slice(0,3).map(Number).map(v => {v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
          const lum = s => channels(s).reduce((sum,n,i) => sum+n*[.2126,.7152,.0722][i],0);
          const ratios = [[getComputedStyle(e).color,getComputedStyle(e).backgroundColor],[getComputedStyle(p).color,getComputedStyle(document.body).backgroundColor]];
          for (const button of document.querySelectorAll('button')) {
            const style = getComputedStyle(button); ratios.push([style.color, style.backgroundColor]);
          }
          return Math.min(...ratios.map(([a,b]) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)));
        });
        assert.ok(contrast >= 4.5, name + ': contrast ' + contrast); report.contrastMinimum = Math.min(report.contrastMinimum, contrast);
        report.states++;
        if (screenshot) { const filename = `${engine.name()}-${width}-${theme}-${name}.png`; await page.screenshot({ path: path.join(out, filename), fullPage: true }); report.screenshots.push(filename); }
      }
      const variants = pairs.flatMap((pair,i) => ['shore','garden'].map(route => ({
        pair: route === 'shore' ? pair : [pair[0], pair[1], ...[['align','flash'],['wait','anchor'],['shelter','brace']][i]], route,
      })));
      for (const [i,{pair,route}] of variants.entries()) {
        await page.locator('#reset').click(); await audit('intro', i === 0); await next();
        await choose('signal', 'blue'); assert.equal(await page.locator('[data-next]').isEnabled(), false);
        await actor(1); await choose('signal','wave'); await audit('signal',i===0); await next();
        await choose('route','shore'); await actor(1); await choose('route','garden');
        assert.equal(await page.locator('[data-next]').isEnabled(), false);
        await choose('route',route); await actor(0); await choose('route',route); await audit('route',i===0); await next();
        await choose('tools', pair[0]); await actor(1); await choose('tools',pair[0]);
        assert.equal(await page.locator('[data-next]').isEnabled(), false); await choose('tools',pair[1]);
        await audit('tools',i===0); await next();
        await choose('storm',pair[2] === 'wait' ? 'align' : 'wait'); await actor(1); await choose('storm',pair[3]); await next();
        assert.ok((await page.locator('#notice').textContent()).includes('ничего') || (await page.locator('#notice').textContent()).includes('сохранены'));
        await choose('storm',pair[2]); await actor(1); await choose('storm',pair[3]); await audit('storm',i===0);
        await page.reload(); assert.equal(await page.locator('[data-next]').isEnabled(),true); await next();
        await choose('wish','lamp'); await page.locator('[data-report]').click();
        assert.ok((await page.locator('#report').textContent()).includes('Попыток в финале: 2'));
        await audit('result',i===0); await page.reload(); assert.ok((await page.locator('h2').textContent()).includes('светит'));
        report.completions++;
      }
      // Real text-only scaling: preserve the 375 CSS-pixel viewport.
      if (width === 375) { await page.addStyleTag({ content: ':root{--type-body:30px;--type-control:28px;--type-meta:24px;--type-heading:32px;--type-title:40px;--type-hero:42px}' }); await audit('text-200',true); }
      await context.close();
    }
    const page = await browser.newPage();
    await page.addInitScript(() => { Storage.prototype.setItem = function () { throw Error('quota'); }; });
    await page.goto(base + '/experiments/lighthouse-m01.html');
    await page.locator('[data-next]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('h2').evaluate(e => e === document.activeElement), true);
    assert.ok((await page.locator('#notice').textContent()).includes('не сохранил'));
    // macOS WebKit defaults to text-field-only Tab; Option-Tab traverses controls.
    const tab = engine === webkit ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(tab); assert.equal(await page.locator('[data-actor="0"]').evaluate(e => e === document.activeElement), true);
    await page.keyboard.press(tab); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-actor="1"]').getAttribute('aria-pressed'),'true');
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) { return key === 'satoru.lighthouse.m01.v1' ? '{broken' : get.call(this,key); };
    });
    await page.reload(); assert.ok((await page.locator('#notice').textContent()).includes('не прочитался'));
    report.checks.push(engine.name() + ': keyboard, normal motion, corrupt/refused storage, no API requests, reload, conflicts, retries, both routes and three tool pairs');
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  await writeFile(path.join(out, 'prototype-qa.json'), JSON.stringify(report,null,2));
  for (const browser of browsers) await browser.close();
  if (server.exitCode === null) await new Promise(resolve => { server.once('exit',resolve); server.kill(); });
  await rm(data, { recursive: true, force: true });
}
console.log(JSON.stringify(report));
