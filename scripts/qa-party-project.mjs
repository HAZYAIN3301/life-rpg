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
const out = path.join(root, 'work/m05/evidence'), data = await mkdtemp(path.join(tmpdir(), 'satoru-den-ui-'));
const base = 'http://127.0.0.1:52008';
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: data, PORT: '52008', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
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
    await a.locator('[data-project="start"][data-id="hearth"]').click();
    await a.waitForFunction(() => State.party.projects.chapters.length === 1);
    await nav(a, 'today'); await a.locator('[data-project="open"]').click();
    await a.locator('.shared-project').waitFor();
    for (const [index, page] of pages.entries()) await page.evaluate(async index => {
      const fields = { date: todayStr(), estimateMin: 15, difficulty: 'normal', skillId: State.settings.skills[0]?.id || '' };
      const tasks = [{ ...fields, id: 'historical', title: 'fixture', done: true, completedAt: '2020-01-01T00:00:00Z', xpAwarded: 100000, goldAwarded: 0 },
        ...Array.from({ length: 12 }, (_, i) => ({ ...fields, id: 'step-' + index + '-' + i, title: 'PRIVATE_' + index + '_' + i, done: false }))];
      if (!await Store.updateNow('tasks', current => [...current, ...tasks], s => { State.tasks = s; return true; })) throw Error('fixture save');
    }, index);
    async function contribution(page, index, i, lose = false) {
      let id = `step-${index}-${i}`, kind = 'task';
      if (i === 1) {
        kind = 'habit';
        id = await page.evaluate(async () => {
          const h = { id: 'project-habit', title: 'PRIVATE_habit', days: [0,1,2,3,4,5,6], estimateMin: 10, difficulty: 'normal', skillId: State.settings.skills[0]?.id || '' };
          const habits = [...State.habits, h];
          if (!await habitDataCommit({ habits }, () => { State.habits = habits; })) throw Error('habit fixture save');
          await transactHabitCompletion(h, { twoMinute: true });
          if (!State.habitlog[habitDayKey()]?.[h.id]) throw Error('habit completion unconfirmed');
          return JSON.stringify([habitDayKey(), h.id]);
        });
      } else await page.evaluate(async id => { await completeTask(State.tasks.find(t => t.id === id), null, todayStr()); }, id);
      await page.evaluate(() => partyProjectUI().refresh(true));
      await page.locator('#project-task').selectOption(JSON.stringify([kind, id]));
      const before = await page.evaluate(() => goldBalance());
      const current = await page.evaluate(() => { const c = State.party.projects.chapters.find(c => !c.completedAt); return { id: c.id, progress: c.progress }; });
      if (lose) await page.route('**/api/party/projects', async route => { await route.fetch(); await route.abort(); }, { times: 1 });
      await page.locator('[data-project="contribute"]').click();
      if (lose) { await page.locator('[data-project="retry"]').waitFor(); await page.locator('[data-project="retry"]').click(); }
      await page.waitForFunction(current => State.party.projects.chapters.some(c => c.id === current.id && c.progress === current.progress + 1), current);
      assert.equal(await page.evaluate(() => goldBalance()), before, 'project never pays a second task reward');
    }
    for (let i = 0; i < 5; i++) await contribution(a, 0, i, i === 0);
    await a.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-hearth-progress.png`) });
    await contribution(b, 1, 0);
    await a.evaluate(() => partyProjectUI().refresh(true));
    await a.locator('.shared-den-scene[data-project-hearth="done"]').waitFor();
    await a.locator('.shared-den-scene').screenshot({ path: path.join(out, `${engine.name()}-hearth-finished.png`) });
    assert.equal(await b.locator('[data-party-project-host]').innerText().then(s => s.includes('PRIVATE_0')), false);
    await b.locator('[data-project="start"][data-id="garden"]').click();
    await b.waitForFunction(() => State.party.projects.chapters.length === 2);
    for (let i = 5; i < 9; i++) await contribution(a, 0, i);
    await a.locator('.shared-den-scene[data-project-garden="1"]').waitFor();
    for (let i = 1; i < 5; i++) await contribution(b, 1, i);
    await b.locator('.shared-den-scene[data-project-garden="2"]').waitFor();
    await b.reload(); await b.waitForFunction(() => State.phase === 'app'); await b.evaluate(() => refreshPartyAuthority()); await nav(b, 'party');
    assert.equal(await b.locator('.project-window-plant').count(), 2);
    assert.equal(await b.locator('.project-completed li').count(), 2);
    const persisted = structuredClone(await b.evaluate(() => State.party.projects));
    for (const locale of ['ru','en','de','uk','es']) for (const theme of ['dark','light']) for (const width of [375,1280]) {
      await b.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const phase of ['choose','active','complete']) {
        await b.evaluate(({ locale, theme, phase, persisted }) => {
          State.settings.lang = locale; State.settings.theme = theme;
          State.party.projects = phase === 'choose' ? { version: 1, revision: persisted.revision, chapters: [] } : structuredClone(persisted);
          if (phase === 'active') State.party.projects.chapters = [{ ...persisted.chapters[0], completedAt: null, progress: 3 }];
          render();
        }, { locale, theme, phase, persisted });
        await b.locator('.shared-project').waitFor();
        await b.waitForFunction(() => !document.querySelector('#main').classList.contains('is-view-pending'));
        await b.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await b.evaluate(async () => { getComputedStyle(document.querySelector('.shared-project')).color; await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))); });
        const metrics = await b.locator('.shared-project').evaluate(el => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
          small: [...el.querySelectorAll('button,select')].filter(e => e.getBoundingClientRect().height < 42).map(e => e.textContent) }));
        assert.equal(metrics.overflow, false, JSON.stringify({ locale, theme, phase, width })); assert.deepEqual(metrics.small, []);
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
      assert.ok(contrast.ratio >= 4.5, JSON.stringify({ theme, locale, contrast })); report.contrastMinimum = Math.min(report.contrastMinimum || 100, contrast.ratio);
      report.states++;
      }
    }
    await b.evaluate(() => { State.settings.lang = 'ru'; State.settings.theme = 'dark'; render(); });
    await b.locator('.shared-den').screenshot({ path: path.join(out, `${engine.name()}-projects-complete.png`) });
    await b.setViewportSize({ width:375, height:812 });
    await b.evaluate(() => { for (const e of document.querySelectorAll('.shared-project h4,.shared-project strong,.shared-project p,.shared-project button,.shared-project li')) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 2 + 'px'; });
    assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await b.locator('[data-project="refresh"]').focus(); await b.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab');
    assert.ok(await b.evaluate(() => document.activeElement.matches('button,select')));
    report.checks.push(engine.name() + ': 2 projects, 12 real task completions + 2 habit completions, response-loss replay, no extra gold, two accounts, progressive scene, reload, privacy, text200 and keyboard');
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
