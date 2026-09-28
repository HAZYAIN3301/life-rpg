// Real app, two authenticated accounts, isolated data. No production fixtures.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'work/m04/evidence'), data = await mkdtemp(path.join(tmpdir(), 'satoru-den-ui-'));
const base = 'http://127.0.0.1:52007';
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: data, PORT: '52007', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
const browsers = [], report = { checks: [], states: 0, errors: [], complete: false };
await mkdir(out, { recursive: true });
const nav = async (page, view) => { await page.evaluate(view => { State.view = view; render(); }, view); await page.waitForFunction(view => _renderedMainView === view && !document.querySelector('#main').classList.contains('is-view-pending'), view); };
try {
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/version')).ok) break; } catch {} await new Promise(r => setTimeout(r, 30)); }
  for (const engine of [chromium, webkit]) {
    if (process.env.QA_ENGINE && process.env.QA_ENGINE !== engine.name()) continue;
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); browsers.push(browser);
    const pages = [];
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ viewport: { width: i ? 375 : 1280, height: i ? 812 : 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const p = await context.newPage(); pages.push(p); p.setDefaultTimeout(15000); p.on('pageerror', e => report.errors.push(e.message));
      const auth = await p.request.post(base + '/api/auth/register', { data: { name: i ? 'Мира' : 'Александр', email: `den-${engine.name()}-${i}@example.test`, password: 'shared-room-qa-only', lang: 'ru' } }); assert.ok(auth.ok());
      await p.goto(base); await p.waitForFunction(() => typeof State !== 'undefined' && State.me && State.phase !== 'boot');
      const later = p.getByRole('button', { name: 'Настроить позже', exact: true }); if (await later.count()) await later.click();
      await p.waitForFunction(() => State.phase === 'app' && Store._persisted.settings && Store._persisted.tasks);
      await p.evaluate(async () => {
        Object.assign(State.settings, { guideV3: { ...(State.settings.guideV3 || {}), enabled: false }, tutorial: { done: true, active: false }, sound: false, theme: 'dark', systemMode: false, systemSkinOff: true, lang: 'ru' });
        if (!State.settings.skills.length) State.settings.skills.push({ id: 'qa-work', name: 'Творчество', color: '#9473bb' });
        ensureDen(); ensureGear(); ensureCosmetics();
        assertSaved(await Store.saveNow('settings', State.settings));
        function assertSaved(ok) { if (!ok) throw Error('settings save failed'); }
        document.querySelectorAll('.modal-overlay').forEach(e => e.remove()); document.querySelector('#app')?.removeAttribute('inert');
      });
    }
    const [a, b] = pages;
    const created = await (await a.request.post(base + '/api/party/create', { data: { name: 'Наша мастерская', shareProgress: true, acknowledgedVisibility: true } })).json();
    await b.request.post(base + '/api/party/join', { data: { code: created.party.code, shareProgress: true, acknowledgedVisibility: true } });
    for (const p of pages) { await p.evaluate(() => refreshPartyAuthority()); await nav(p, 'party'); }
    await a.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-empty.png`) });
    // Historical earning fixture, then the actual completion owner earns the missing gold.
    await a.evaluate(async () => {
      const task = { id: 'real-next-step', title: 'PRIVATE_TASK — написать абзац', date: todayStr(), estimateMin: 25, difficulty: 'normal', skillId: State.settings.skills[0]?.id || '', done: false };
      const tasks = [{ ...task, id: 'historical-fixture', done: true, completedAt: new Date().toISOString(), xpAwarded: 100000, goldAwarded: 260 - itemGold(task) }, task];
      if (!await Store.updateNow('tasks', () => tasks, s => { State.tasks = s; return true; })) throw Error('fixture');
    });
    await nav(a, 'rewards');
    await a.locator('[data-action="gold-goal-set"][data-id="seat-forest"]').click(); await a.locator('.gold-goal').waitFor();
    await nav(a, 'today'); await a.locator('.today-gold-goal').waitFor();
    const before = await a.evaluate(() => goldBalance()); assert.ok(before < 260);
    await a.evaluate(async () => { await completeTask(State.tasks.find(t => t.id === 'real-next-step'), null, todayStr()); render(); });
    await a.waitForFunction(() => goldBalance() === 260);
    await a.locator('.today-gold-goal').click(); await a.locator('[data-action="furniture-buy"]').click();
    await a.locator('[data-action="confirm-economy-action"]').click(); await a.locator('#economy-confirm-modal').waitFor({ state: 'detached' });
    assert.equal(await a.evaluate(() => goldBalance()), 0);
    const purchases = await (await a.request.get(base + '/api/data/purchases')).text();
    await nav(a, 'party'); await a.locator('#shared-den-item').selectOption('seat-forest');
    await a.route('**/api/party/den', async route => { if (route.request().method() === 'POST') { await route.fetch(); await route.abort(); } else await route.continue(); }, { times: 1 });
    await a.locator('[data-party-den="place"]').click(); await a.locator('[data-party-den="retry"]').waitFor();
    await a.locator('[data-party-den="retry"]').click(); await a.waitForFunction(() => State.party.sharedDen.placements.length === 1);
    await b.locator('.shared-den [data-den-id="seat-forest"]').waitFor({ timeout: 25000 }); // Background refresh, no manual reload.
    assert.equal((await b.locator('.shared-den').innerText()).includes('PRIVATE_TASK'), false);
    await b.locator('#shared-den-item').selectOption('seat-cushion'); assert.ok(await b.locator('[data-party-den="place"]').isDisabled());
    await b.locator('#shared-den-item').selectOption('light-lantern'); await b.locator('[data-party-den="place"]').click();
    await b.waitForFunction(() => State.party.sharedDen.placements.length === 2);
    await a.reload(); await a.waitForFunction(() => State.phase === 'app'); await a.evaluate(() => refreshPartyAuthority()); await nav(a, 'party');
    assert.equal(await a.locator('.shared-den .den-object').count(), 2);
    assert.equal(await (await a.request.get(base + '/api/data/purchases')).text(), purchases);
    assert.equal(await a.evaluate(() => goldBalance()), 0);
    report.checks.push(engine.name() + ': real completion → gold goal → purchase → shared room; other account view; response-loss retry; reload; no second spending');
    await a.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-desktop.png`) });
    await b.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-mobile.png`) });
    for (const language of ['ru', 'uk', 'en', 'de', 'es']) for (const theme of ['dark', 'light']) for (const width of [375, 1280]) {
      await b.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await b.evaluate(({ language, theme }) => { State.settings.lang = language; State.settings.theme = theme; render(); }, { language, theme });
      await b.locator('.shared-den').waitFor();
      await b.evaluate(async () => {
        getComputedStyle(document.querySelector('.shared-den')).backgroundColor;
        await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {})));
      });
      const metrics = await b.locator('.shared-den').evaluate(el => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        small: [...el.querySelectorAll('button,select')].filter(e => e.getBoundingClientRect().height < 42).map(e => e.textContent),
        ratio: el.querySelector('.den-scene').clientWidth / el.querySelector('.den-scene').clientHeight,
        animated: [...el.querySelectorAll('.den-scene *')].filter(e => getComputedStyle(e).animationName !== 'none').length }));
      assert.equal(metrics.overflow, false, JSON.stringify({ language, theme, width, metrics })); assert.deepEqual(metrics.small, []); assert.ok(Math.abs(metrics.ratio - 16 / 9) < .03); assert.equal(metrics.animated, 0);
      const contrast = await b.locator('.shared-den').evaluate(el => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        return [...el.querySelectorAll('h3,p,label,strong,small,button:not(:disabled),select')].filter(e => e.textContent.trim()).map(e => {
          const bg = [255, 255, 255], ancestors = []; let parent = e;
          while (parent) { ancestors.unshift(parent); parent = parent.parentElement; }
          for (const ancestor of ancestors) { const c = rgba(getComputedStyle(ancestor).backgroundColor); for (let i = 0; i < 3; i++) bg[i] = c[i] * c[3] / 255 + bg[i] * (1 - c[3] / 255); }
          const foreground = rgba(getComputedStyle(e).color); for (let i = 0; i < 3; i++) foreground[i] = foreground[i] * foreground[3] / 255 + bg[i] * (1 - foreground[3] / 255);
          return { ratio: (Math.max(lum(foreground), lum(bg)) + .05) / (Math.min(lum(foreground), lum(bg)) + .05), text: e.textContent.slice(0, 90), fg: getComputedStyle(e).color, bg };
        }).sort((a,b) => a.ratio - b.ratio)[0];
      });
      if (contrast.ratio < 4.5) await b.locator('.shared-den').screenshot({ path: path.join(out, 'contrast-failure.png') });
      assert.ok(contrast.ratio >= 4.5, JSON.stringify({ theme, language, contrast })); report.contrastMinimum = Math.min(report.contrastMinimum || 100, contrast.ratio);
      report.states++;
    }
    await b.setViewportSize({ width: 375, height: 812 });
    await b.evaluate(() => { for (const e of document.querySelectorAll('.shared-den h3,.shared-den p,.shared-den strong,.shared-den small,.shared-den label,.shared-den button,.shared-den select')) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 2 + 'px'; });
    assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await b.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-text200.png`) });
    await b.locator('[data-party-den="refresh"]').focus(); await b.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab');
    assert.equal(await b.evaluate(() => !!document.activeElement.closest('.shared-den') && document.activeElement.matches('button,select')), true);
    await b.request.post(base + '/api/party/leave', { data: {} }); await a.locator('[data-party-den="refresh"]').click();
    await a.waitForFunction(() => State.party.sharedDen.placements.length === 1);
    assert.equal(await a.evaluate(() => ensureDen().owned.includes('seat-forest')), true);
    const offline = await browser.newContext({ serviceWorkers: 'allow' });
    const shell = await offline.newPage(); await shell.goto(base);
    await shell.evaluate(() => navigator.serviceWorker.ready);
    await shell.waitForFunction(async () => { const cache = await caches.open(PWA_CACHE_VERSION); return !!await cache.match('party-den-ui-v1.js') && !!await cache.match('party-den-v1.css'); });
    await shell.reload(); await shell.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline.setOffline(true);
    if (engine === chromium) {
      await shell.reload(); await shell.waitForFunction(() => !!window.PartyDenUIV1);
      report.checks.push('chromium: full offline shell reload with shared room module');
    } else {
      assert.ok(await shell.evaluate(async () => { const cache = await caches.open(PWA_CACHE_VERSION); return (await (await cache.match('party-den-ui-v1.js')).text()).includes('PartyDenUIV1') && (await (await cache.match('party-den-v1.css')).text()).includes('.shared-den'); }));
      report.checks.push('webkit: new assets stored/read in CacheStorage; offline SW delivery/navigation UNVERIFIED (automation Load failed/internal error), needs physical-device check');
    }
    await offline.close();
    await browser.close();
  }
  assert.deepEqual(report.errors, []); report.complete = true;
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  for (const browser of browsers) await browser.close().catch(() => {});
  await new Promise(r => { server.once('exit', r); server.kill(); });
  await rm(data, { recursive: true, force: true });
}
console.log(JSON.stringify(report));
