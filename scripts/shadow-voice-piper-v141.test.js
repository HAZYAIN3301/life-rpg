'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

function wavFixture() {
  const out = Buffer.alloc(46);
  out.write('RIFF', 0, 'ascii'); out.writeUInt32LE(38, 4); out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii'); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22); out.writeUInt32LE(22050, 24); out.writeUInt32LE(44100, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36, 'ascii');
  out.writeUInt32LE(2, 40); out.writeInt16LE(0, 44);
  return out;
}

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startSatoru(piperUrl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-piper-v141-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off',
      SHADOW_TTS_PROVIDER: 'piper', PIPER_TTS_URL: piperUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { const response = await fetch(base + '/api/auth/profiles'); if (response.ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start: ${output}`);
}

test('Shadow Voice v141 uses private Piper, returns WAV and caches repeated speech', { timeout: 30000 }, async (t) => {
  let providerCalls = 0;
  let providerPayload = null;
  const piper = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ piper: true }));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/synthesize') { res.writeHead(404).end(); return; }
    providerCalls += 1;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    providerPayload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const audio = wavFixture();
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length });
    res.end(audio);
  });
  await new Promise((resolve, reject) => piper.listen(0, '127.0.0.1', resolve).once('error', reject));
  const piperUrl = `http://127.0.0.1:${piper.address().port}`;
  const runtime = await startSatoru(piperUrl);
  t.after(() => {
    runtime.child.kill('SIGTERM'); piper.close();
    fs.rmSync(runtime.dataDir, { recursive: true, force: true });
  });

  assert.equal((await fetch(runtime.base + '/api/shadow/voice/status')).status, 401);
  const registered = await fetch(runtime.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Piper QA', email: 'piper-v141@example.test', password: 'piper-pass-141' }),
  });
  assert.equal(registered.status, 200);
  const cookie = cookieOf(registered);
  const status = await fetch(runtime.base + '/api/shadow/voice/status', { headers: { Cookie: cookie } });
  assert.equal(status.status, 200);
  const statusBody = await status.json();
  assert.equal(statusBody.configured, true);
  assert.equal(statusBody.provider, 'piper');
  assert.equal(statusBody.mode, 'server-neural');
  assert.equal(statusBody.format, 'wav');
  assert.equal(statusBody.languages.ru.voice, 'ru_RU-denis-medium');

  const requestVoice = () => fetch(runtime.base + '/api/shadow/voice', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Я рядом.', language: 'ru', context: 'calm' }),
  });
  const first = await requestVoice();
  assert.equal(first.status, 200); assert.equal(first.headers.get('content-type'), 'audio/wav');
  assert.equal(first.headers.get('x-shadow-voice-provider'), 'piper');
  assert.equal(first.headers.get('x-shadow-voice-mode'), 'server-neural');
  assert.equal(first.headers.get('x-shadow-voice-cache'), 'MISS');
  assert.equal(Buffer.from(await first.arrayBuffer()).subarray(0, 4).toString('ascii'), 'RIFF');
  assert.deepEqual(providerPayload.text, 'Я рядом.');
  assert.equal(providerPayload.voice, 'ru_RU-denis-medium');
  assert.ok(providerPayload.length_scale > 1);

  const second = await requestVoice();
  assert.equal(second.status, 200); assert.equal(second.headers.get('x-shadow-voice-cache'), 'HIT');
  assert.equal(providerCalls, 1, 'identical speech must not call Piper twice');
});

test('Shadow Voice v141 reports Piper unavailable when health check fails', { timeout: 30000 }, async (t) => {
  const piper = http.createServer((req, res) => res.writeHead(503).end());
  await new Promise((resolve, reject) => piper.listen(0, '127.0.0.1', resolve).once('error', reject));
  const runtime = await startSatoru(`http://127.0.0.1:${piper.address().port}`);
  t.after(() => {
    runtime.child.kill('SIGTERM'); piper.close();
    fs.rmSync(runtime.dataDir, { recursive: true, force: true });
  });
  const registered = await fetch(runtime.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Piper Down QA', email: 'piper-down-v141@example.test', password: 'piper-down-141' }),
  });
  const status = await fetch(runtime.base + '/api/shadow/voice/status', { headers: { Cookie: cookieOf(registered) } });
  const body = await status.json();
  assert.equal(body.configured, false);
  assert.equal(body.mode, 'unavailable');
  assert.equal(body.reason, 'local_voice_unreachable');
});
