'use strict';

// Dependency-free local visual harness for the Den. It launches the already
// installed system Chrome against an isolated profile, bypasses the service
// worker, reuses only the synthetic QA cookie, and captures the three required
// responsive viewports after the final CSS bytes are loaded.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.QA_ORIGIN || 'http://127.0.0.1:4345';
const COOKIE_FILE = process.env.QA_COOKIE_FILE || '/private/tmp/satoru-den-v156.cookies';
const OUT_DIR = path.resolve(process.env.QA_OUT_DIR || path.join(__dirname, '..', 'docs/design-qa/2026-08-15-den-director-v156'));
const DEBUG_PORT = Number(process.env.QA_CDP_PORT || 9435);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sessionCookie() {
  const line = fs.readFileSync(COOKIE_FILE, 'utf8').split(/\r?\n/).find((entry) => entry && entry.includes('\tlrpg_sess\t'));
  if (!line) throw new Error(`No lrpg_sess in ${COOKIE_FILE}`);
  return line.split('\t').at(-1);
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.seq = 0;
    this.pending = new Map();
    this.waiters = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP websocket timeout')), 8000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', (event) => { clearTimeout(timer); reject(event.error || new Error('CDP websocket error')); }, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
        return;
      }
      const list = this.waiters.get(message.method) || [];
      this.waiters.delete(message.method);
      list.forEach((resolve) => resolve(message.params || {}));
    });
    return this;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timeout`)), timeout);
      const wrapped = (value) => { clearTimeout(timer); resolve(value); };
      const list = this.waiters.get(method) || [];
      list.push(wrapped);
      this.waiters.set(method, list);
    });
  }
  close() { if (this.ws) this.ws.close(); }
}

async function waitJson(url, attempts = 100) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      last = new Error(`${response.status} ${url}`);
    } catch (error) { last = error; }
    await sleep(100);
  }
  throw last || new Error(`Cannot reach ${url}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result && result.result.value;
}

async function waitFor(cdp, expression, timeout = 16000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return true;
    await sleep(120);
  }
  const text = await evaluate(cdp, `document.body ? document.body.innerText.slice(0, 900) : ''`);
  throw new Error(`Page condition timed out: ${expression}\n${text}`);
}

async function capture(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 91, fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(filename, Buffer.from(shot.data, 'base64'));
}

const scenarioExpression = (action, mode) => `(() => {
  const button = document.querySelector('[data-action="${action}"]${mode ? `[data-mode="${mode}"]` : ''}');
  if (!button) return false;
  button.click();
  const scene = document.querySelector('.den-scene');
  if (scene) window.scrollTo(0, Math.max(0, scene.getBoundingClientRect().top + window.scrollY - 76));
  return true;
})()`;

async function roomMetrics(cdp) {
  return evaluate(cdp, `(() => {
    const shell = document.querySelector('.den-shell');
    const scene = document.querySelector('.den-scene');
    const rect = (selector) => { const e = document.querySelector(selector); if (!e) return null; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),opacity:s.opacity,visibility:s.visibility,display:s.display}; };
    const visibleGround = [...document.querySelectorAll('.den-scene > .den-pet')].filter((e) => { const s=getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > .01; }).length;
    const allTargets = [...document.querySelectorAll('.den-shell button')].filter((e) => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && r.width && r.height; });
    return {
      viewport:[innerWidth,innerHeight], overflow:document.documentElement.scrollWidth-innerWidth,
      meeting:shell && shell.dataset.denMeeting || '', laneMotion:shell && shell.dataset.denLaneMotion || '', classes:shell && shell.className || '',
      visibleGround, groundTotal:document.querySelectorAll('.den-scene > .den-pet').length,
      minTarget:allTargets.length ? Math.min(...allTargets.map((e)=>Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height))) : 0,
      smallTargets:allTargets.filter((e)=>Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height)<41.5).map((e)=>{const r=e.getBoundingClientRect();return{action:e.dataset.action||'',text:(e.textContent||'').trim().slice(0,40),w:+r.width.toFixed(1),h:+r.height.toFixed(1)};}),
      avatarDirection:document.querySelector('.den-avatar-core')?.dataset.locomotionDirection || '', avatarPosition:document.querySelector('.den-avatar-core')?.dataset.locomotionPosition || '',
      toadDirection:document.querySelector('.den-body-toad')?.dataset.toadDirection || '',
      toadMotion:document.querySelector('.den-body-toad')?.dataset.toadMotion || '', toadRoute:document.querySelector('.den-body-toad')?.dataset.toadRoute || '',
      slugDirection:document.querySelector('.den-recovery-slug')?.dataset.slugDirection || '',
      resourceDirection:document.querySelector('.den-resources-penguin')?.dataset.resourcesDirection || '',
      scene:rect('.den-scene'), avatar:rect('.den-avatar-core'), body:rect('.den-body-toad'), recovery:rect('.den-recovery-slug'), resources:rect('.den-resources-penguin'), shadow:rect('.den-companion[data-shadow-den]'), pair:rect('.body-pair-v2.is-active, .recovery-pair-v2.is-active, .resources-pair-v1.is-active')
    };
  })()`);
}

async function runScenario(cdp, spec) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: spec.width, height: spec.height, deviceScaleFactor: 1, mobile: spec.width < 700 });
  const loaded = cdp.wait('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?view=den&qa=${encodeURIComponent(spec.label)}-${Date.now()}` });
  await loaded;
  await waitFor(cdp, `document.querySelector('.den-shell .den-scene')`);
  // The isolated QA account starts with only Body/Recovery spheres. Add one
  // temporary Resources sphere in memory so all three guardians can be tested
  // without touching a real user's data or persisting a product preference.
  await evaluate(cdp, `(() => {
    if (!State.settings.skills.some((sphere) => sphere && sphere.id === 'den-qa-money')) {
      State.settings.skills.push({ id:'den-qa-money', name:'Финансы', color:'#d8a44b', canon:'money' });
    }
    State.settings.tutorial = { ...(State.settings.tutorial || {}), active:false, done:true, skipped:true };
    const den = ensureDen();
    den.petCount = Math.max(3, Number(den.petCount) || 0);
    render();
    return true;
  })()`);
  await waitFor(cdp, `document.querySelector('.den-body-toad') && document.querySelector('.den-recovery-slug') && document.querySelector('.den-resources-penguin')`);
  await sleep(300);
  const clicked = await evaluate(cdp, spec.invoke || scenarioExpression(spec.action, spec.mode));
  if (!clicked) throw new Error(`Missing ${spec.action}:${spec.mode}`);
  await sleep(spec.approachAt);
  const approach = await roomMetrics(cdp);
  await capture(cdp, path.join(OUT_DIR, `${spec.label}-${spec.width}x${spec.height}-approach.jpg`));
  await sleep(spec.contactAt - spec.approachAt);
  const contact = await roomMetrics(cdp);
  await capture(cdp, path.join(OUT_DIR, `${spec.label}-${spec.width}x${spec.height}-contact.jpg`));
  return { spec, approach, contact };
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome missing: ${CHROME}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-den-cdp-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-sync',
    '--disable-background-networking', '--disable-extensions', '--hide-scrollbars', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let cdp;
  try {
    console.error('[den-qa] waiting for Chrome');
    await waitJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    console.error('[den-qa] creating target');
    const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
    console.error('[den-qa] connecting target');
    cdp = await new Cdp(target.webSocketDebuggerUrl).connect();
    await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Network.enable')]);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await cdp.send('Network.setCookie', { name: 'lrpg_sess', value: sessionCookie(), url: `${ORIGIN}/`, path: '/', httpOnly: true, sameSite: 'Lax' });
    const scenarios = [
      { label: 'body-train', width: 360, height: 800, action: 'body-toad-interact', mode: 'train', approachAt: 820, contactAt: 2250 },
      { label: 'resources-greet', width: 375, height: 812, action: 'resources-penguin-interact', mode: 'greet', approachAt: 900, contactAt: 2650 },
      { label: 'recovery-greet', width: 1280, height: 900, action: 'recovery-slug-interact', mode: 'greet', approachAt: 1050, contactAt: 3050 },
      { label: 'window-lane', width: 375, height: 812, action: 'den-avatar-walk', approachAt: 880, contactAt: 2480 },
      { label: 'body-bench-nap', width: 1280, height: 900, invoke: `(() => { const toad=document.querySelector('[data-body-toad]'); if(!toad)return false; void BodyToadV1.playAmbient(toad,'bench-nap',{restoreState:toad.dataset.state,duration:14000}); return true; })()`, approachAt: 1150, contactAt: 2550 },
      { label: 'shadow-blink', width: 375, height: 812, invoke: `(() => { const shadow=document.querySelector('[data-shadow-den]'); if(!shadow)return false; shadow.dataset.shadowBlink='closed'; return true; })()`, approachAt: 120, contactAt: 260 },
    ];
    const report = [];
    for (const spec of scenarios) report.push(await runScenario(cdp, spec));
    fs.writeFileSync(path.join(OUT_DIR, 'metrics.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGTERM');
    await sleep(250);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch {}
  }
}

main().catch((error) => { console.error(error.stack || error, error && error.cause ? error.cause : ''); process.exitCode = 1; });
