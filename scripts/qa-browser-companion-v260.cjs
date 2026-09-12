const { chromium } = require(process.env.SATORU_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const output = path.join(base, 'extensions/satoru-attention/store-kit-v260');
const Core = require(path.join(base, 'extensions/satoru-attention/core.js'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-v260-browser-'));
const extension = path.join(profile, 'extension');
fs.cpSync(path.join(base, 'extensions/satoru-attention'), extension, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
manifest.host_permissions.push('https://boundary.satoru.test/*', 'http://boundary.satoru.test/*');
fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const browserName = process.argv[2] || 'chrome';
const executablePath = process.env.SATORU_BROWSER_EXECUTABLE || (browserName === 'brave' ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
let context;
(async () => {
  context = await chromium.launchPersistentContext(path.join(profile, 'profile'), { executablePath, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 800 }, args: [...(browserName === 'brave' ? [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] : []), '--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP *.satoru.test 127.0.0.1', '--no-first-run', '--disable-background-networking'] });
  let id;
  if (browserName === 'chrome') {
    const cdp = await context.browser().newBrowserCDPSession();
    id = (await cdp.send('Extensions.loadUnpacked', { path: extension })).id;
  } else {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    id = new URL(worker.url()).host;
  }
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForFunction(() => document.querySelector('#health-status').textContent.length > 0);
  const initial = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_HEALTH' }));
  assert.equal(initial.status.enforcement.state, 'not_configured');
  const policy = Core.cleanPolicy({ id: 'study-site', hostname: 'boundary.satoru.test', label: 'Study example', appKey: 'web', dailyBudgetMinutes: 20, maxSessionsPerDay: 3, purposes: [{ purpose: 'watch', defaultMinutes: 1, mode: 'control', expectedOutcome: 'One chosen lesson' }] });
  const save = await page.evaluate(policy => chrome.runtime.sendMessage({ type: 'SAVE_POLICY', policy }), policy);
  assert.equal(save.ok, true, JSON.stringify(save));
  const applied = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_HEALTH' }));
  assert.equal(applied.status.enforcement.state, 'active', JSON.stringify(applied));
  await page.locator('#health-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#boundary-start').disabled);
  const newPage = context.waitForEvent('page');
  await page.locator('#boundary-start').click();
  const gate = await newPage;
  gate.on('pageerror', error => errors.push(error.message));
  await gate.waitForURL(`chrome-extension://${id}/gate.html?site=study-site`);
  try { await gate.locator('#boundary-test-receipt').waitFor({ timeout: 8000 }); }
  catch (error) { console.log('PAGE', await gate.locator('body').innerText()); console.log('HEALTH', await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_HEALTH' }))); throw error; }
  const receipt = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_HEALTH' }));
  assert.equal(receipt.status.selfTest.state, 'passed');
  if (browserName === 'chrome') {
    await page.screenshot({ path: path.join(output, 'chrome-options-1280x800.png') });
    await gate.screenshot({ path: path.join(output, 'chrome-boundary-1280x800.png') });
  }
  for (const target of [page, gate]) {
    await target.setViewportSize({ width: 375, height: 812 });
    const metrics = await target.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, buttons: [...document.querySelectorAll('button:not([hidden])')].filter(el => el.getBoundingClientRect().height).map(el => ({ id: el.id, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }));
    assert.equal(metrics.overflow, false, JSON.stringify(metrics));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduce = await page.evaluate(() => getComputedStyle(document.querySelector('#boundary-start')).transitionDuration);
  assert.equal(reduce, '0s');
  const production = 'https://life-rpg-production-416a.up.railway.app';
  await context.route(`${production}/**`, async route => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (!/^browser-companion[\w.-]*\.(?:html|js|css|png|svg)$/.test(name)) return route.abort();
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(name)];
    await route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(path.join(base, 'public', name)) });
  });
  const landing = await context.newPage();
  landing.on('pageerror', error => errors.push(error.message));
  const views = [];
  for (const lang of ['ru', 'en', 'de', 'uk', 'es']) for (const theme of ['dark', 'light']) for (const width of [375, 1280]) {
    await landing.setViewportSize({ width, height: 800 });
    await landing.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await landing.goto(`${production}/browser-companion.html?lang=${lang}&browser=${browserName}#connect`);
    await landing.waitForFunction(() => !document.querySelector('#bc-open-options').disabled);
    const metrics = await landing.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, language: document.documentElement.lang, state: document.querySelector('#bc-connection-state').textContent, test: document.querySelector('#bc-test-state').textContent, buttons: ['#bc-connect-refresh','#bc-open-options'].map(selector => document.querySelector(selector).getBoundingClientRect().height) }));
    assert.equal(metrics.language, lang); assert.equal(metrics.overflow, false, JSON.stringify({ lang, theme, width, metrics }));
    assert.ok(metrics.buttons.every(height => height >= 44));
    views.push({ lang, theme, width, ...metrics });
    if (browserName === 'chrome' && lang === 'ru' && width === 375 && theme === 'dark') await landing.screenshot({ path: path.join(output, 'landing-ru-375-dark.png') });
  }
  // Keep the automation-loader reload limitation explicit; exercise bounded readback after a worker-close request.
  const reload = { state: 'not_verified', reason: 'runtime.reload disabled/closed the automation-loaded unpacked fixture in both browsers. Ordinary user Reload and signed updates need separate owner QA.' };
  const browserSession = await context.browser().newBrowserCDPSession();
  const workerTarget = (await browserSession.send('Target.getTargets')).targetInfos.find(target => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${id}/`));
  assert.ok(workerTarget, 'actual extension worker target exists before suspension');
  const stopped = await browserSession.send('Target.closeTarget', { targetId: workerTarget.targetId });
  assert.equal(stopped.success, true);
  await page.waitForTimeout(100);
  const afterSleep = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_HEALTH' }));
  assert.equal(afterSleep.status.enforcement.state, 'active'); assert.equal(afterSleep.status.selfTest.state, 'passed');
  const nextWorker = (await browserSession.send('Target.getTargets')).targetInfos.find(target => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${id}/`));
  assert.ok(nextWorker);
  const workerRestart = { state: 'passed', method: 'Browser acknowledges MV3 worker close request; GET_HEALTH then confirms applied rules and saved test receipt. Target IDs may be reused, so no new-process inference is made.' };
  assert.deepEqual(errors, []);
  const report = { browser: browserName, browserVersion: context.browser()?.version() || null, at: new Date().toISOString(), passed: true,
    scenarios: ['empty readback', 'native saved rule and script readback', 'user test gesture to real navigation', 'actual local gate receipt', '375px options and gate overflow', 'reduced motion', 'real bridge on locally fulfilled production origin', '20 landing locale/theme/viewport combinations'],
    fixture: 'Disposable browser profile; source runtime; test manifest adds only HTTP/HTTPS boundary.satoru.test/* to permanent grants. Production-origin landing responses are fulfilled from local files. No live browsing/user data. Does not prove the native optional-permission dialog or signed install/update.', status: receipt.status, workerRestart, reload, views, errors };
  fs.writeFileSync(path.join(output, `${browserName}-qa.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (context) await context.close(); fs.rmSync(profile, { recursive: true, force: true }); });
