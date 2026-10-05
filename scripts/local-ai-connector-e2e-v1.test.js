'use strict';

// Сквозной путь «для всех»: код из Настроек → настоящий install.sh (без автозапуска, временный HOME)
// → настоящий connector.sh → поддельная Ollama на случайном порту → ответ в чате Satoru → отзыв.
// Коннектор трогает у Ollama только /api/tags и /api/chat.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  return port;
}
function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('install → connector → chat answer from the local model → revoke removes the connector', { timeout: 120000 }, async () => {
  const seen = [];
  const ollama = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push(`${req.method} ${req.url}`);
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/api/tags') return res.end(JSON.stringify({ models: [
        { name: 'synthetic:9b', size: 9e9, capabilities: ['completion'], details: { format: 'gguf' } },
        { name: 'cloudy:120b-cloud', size: 1, capabilities: ['completion'], remote_host: 'https://ollama.com:443' }] }));
      if (req.method === 'POST' && req.url === '/api/chat') {
        const p = JSON.parse(body);
        return res.end(JSON.stringify({ model: p.model, done: true, done_reason: 'stop', prompt_eval_count: 10, eval_count: 3,
          message: { role: 'assistant', content: `Синтетика (${p.model}, think=${p.think}): ${p.messages.at(-1).content}` } }));
      }
      res.statusCode = 404; res.end('{}');
    });
  });
  const ollamaPort = await freePort();
  await new Promise((resolve) => ollama.listen(ollamaPort, '127.0.0.1', resolve));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-local-ai-data-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-local-ai-home-'));
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' };
  for (const k of Object.keys(env)) if (/^AI_HOUSE_KEY_|^SATORU_OLLAMA/.test(k)) delete env[k];
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', (c) => { log += c; }); server.stderr.on('data', (c) => { log += c; });
  let connector = null;
  try {
    for (let i = 0; i < 2400; i++) {
      if (server.exitCode != null) throw new Error(`сервер упал: ${log}`);
      try { if ((await fetch(`${base}/api/auth/profiles`)).ok) break; } catch {}
      await sleep(50);
    }
    const reg = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'L', email: 'local-ai@example.test', password: 'local-pass-11' }) });
    const cookie = reg.headers.get('set-cookie').split(';')[0];
    const api = (u, body) => fetch(`${base}${u}`, body === undefined ? { headers: { Cookie: cookie } } : { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await fetch(`${base}/api/local-ai/status`)).status, 401);
    assert.deepEqual((await (await api('/api/ai/keys')).json()).ollama, false, 'nothing paired yet');

    const pairing = await (await api('/api/local-ai/pairing', {})).json();
    assert.match(pairing.command, new RegExp(`^curl -fsSL ${base.replace(/[.]/g, '\\.')}/local-ai/install\\.sh -o satoru-local-ai\\.sh && sh satoru-local-ai\\.sh sp1\\.`));
    const script = await (await fetch(`${base}/local-ai/install.sh`)).text();
    assert.ok(script.includes(`SATORU_URL="\${SATORU_URL:-${base}}"`), 'the installer knows this server');
    const evil = await (await fetch(`${base}/local-ai/connector.sh`, { headers: { 'X-Forwarded-Host': 'x$(touch /tmp/pwned)', 'X-Forwarded-Proto': 'https' } })).text();
    assert.ok(!evil.includes('$(touch'), 'request headers cannot inject shell into the script');
    const installer = path.join(home, 'satoru-local-ai.sh');
    fs.writeFileSync(installer, script);

    const shellEnv = { PATH: process.env.PATH, HOME: home, OLLAMA_URL: `http://127.0.0.1:${ollamaPort}`, SATORU_LOCAL_AI_NO_SERVICE: '1' };
    const bad = await run('/bin/sh', [installer, 'sp1.bm9ib2R5.wrong'], shellEnv);
    assert.equal(bad.code, 1); assert.match(bad.out, /Код не подошёл/);
    const ok = await run('/bin/sh', [installer, pairing.code], shellEnv);
    assert.equal(ok.code, 0, ok.out);
    const dir = path.join(home, '.satoru-local-ai');
    assert.equal((fs.statSync(path.join(dir, 'token')).mode & 0o777).toString(8), '600');
    assert.match(fs.readFileSync(path.join(dir, 'token'), 'utf8'), /^sd1\./);

    connector = spawn('/bin/sh', [path.join(dir, 'connector.sh')], { env: shellEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let status = null;
    for (let i = 0; i < 200; i++) {
      status = await (await api('/api/local-ai/status')).json();
      if (status.devices[0] && status.devices[0].online && status.devices[0].model) break;
      await sleep(100);
    }
    assert.equal(status.devices.length, 1);
    assert.deepEqual(status.devices[0].models.map((m) => m.name), ['synthetic:9b'], 'the cloud alias is not offered');
    assert.equal(status.devices[0].model, 'synthetic:9b');
    const keys = await (await api('/api/ai/keys')).json();
    assert.equal(keys.ollama, true); assert.equal(keys.ollamaStatus.mode, 'paired');

    const chat = await api('/api/ai/chat', { provider: 'ollama', system: 'Синтетический тест', messages: [{ role: 'user', content: 'Привет' }] });
    assert.equal(chat.status, 200);
    const answer = await chat.json();
    assert.equal(answer.source, 'local');
    assert.match(answer.text, /^Синтетика \(synthetic:9b, think=false\): Привет$/);
    const check = await (await api('/api/local-ai/test', {})).json();
    assert.equal(check.ok, true); assert.equal(check.model, 'synthetic:9b');

    const revoked = await (await api('/api/local-ai/revoke', { id: status.devices[0].id })).json();
    assert.equal(revoked.devices.length, 0);
    const exit = await Promise.race([new Promise((r) => connector.on('close', r)), sleep(15000).then(() => 'timeout')]);
    assert.equal(exit, 0, 'the connector stops itself after revoke');
    assert.equal(fs.existsSync(dir), false, 'and removes its key and files');
    const offline = await api('/api/ai/chat', { provider: 'ollama', system: 's', messages: [{ role: 'user', content: 'q' }] });
    assert.equal(offline.status, 400);
    assert.deepEqual(await offline.json(), { error: 'local', reason: 'not_paired', message: '' }, 'with nothing paired the local choice is never silently cloud');
    assert.deepEqual([...new Set(seen)].sort(), ['GET /api/tags', 'POST /api/chat']);
  } finally {
    if (connector && connector.exitCode == null) connector.kill('SIGTERM');
    server.kill('SIGTERM'); ollama.close();
    fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true });
  }
});
