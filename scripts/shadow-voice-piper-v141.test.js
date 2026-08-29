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
  assert.deepEqual(statusBody.languages.ru.voices, { female: 'ru_RU-irina-medium', male: 'ru_RU-denis-medium' });
  assert.deepEqual(statusBody.languages.uk.voices, { female: 'uk_UA-lada-x_low', male: 'uk_UA-oleksa-high' });
  assert.deepEqual(statusBody.languages.en.voices, { female: 'en_US-ljspeech-high', male: 'en_US-john-medium' });
  assert.deepEqual(statusBody.languages.de.voices, { female: 'de_DE-kerstin-low', male: 'de_DE-thorsten-high' });
  assert.deepEqual(statusBody.languages.es.voices, { female: 'es_AR-daniela-high', male: 'es_ES-davefx-medium' });
  assert.equal(statusBody.languages.ru.speed, 1);

  const requestVoice = (gender) => fetch(runtime.base + '/api/shadow/voice', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Я рядом.', language: 'ru', gender, context: 'calm' }),
  });
  const first = await requestVoice('female');
  assert.equal(first.status, 200); assert.equal(first.headers.get('content-type'), 'audio/wav');
  assert.equal(first.headers.get('x-shadow-voice-provider'), 'piper');
  assert.equal(first.headers.get('x-shadow-voice-mode'), 'server-neural');
  assert.equal(first.headers.get('x-shadow-voice-gender'), 'female');
  assert.equal(first.headers.get('x-shadow-voice-cache'), 'MISS');
  assert.equal(Buffer.from(await first.arrayBuffer()).subarray(0, 4).toString('ascii'), 'RIFF');
  assert.deepEqual(providerPayload.text, 'Я рядом.');
  assert.equal(providerPayload.voice, 'ru_RU-irina-medium');
  assert.equal(providerPayload.length_scale, 1);
  assert.equal(providerPayload.noise_scale, 0.667);
  assert.equal(providerPayload.noise_w_scale, 0.8);

  const second = await requestVoice('female');
  assert.equal(second.status, 200); assert.equal(second.headers.get('x-shadow-voice-cache'), 'HIT');
  assert.equal(providerCalls, 1, 'identical speech must not call Piper twice');

  const male = await requestVoice('male');
  assert.equal(male.status, 200);
  assert.equal(male.headers.get('x-shadow-voice-cache'), 'MISS');
  assert.equal(male.headers.get('x-shadow-voice-gender'), 'male');
  assert.equal(providerPayload.voice, 'ru_RU-denis-medium');
  assert.equal(providerCalls, 2, 'gender must be part of the audio cache key');
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

test('Shadow Voice remains accessible after the v146 shell update', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const voiceClient = fs.readFileSync(path.join(ROOT, 'public', 'shadow-voice-v2.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
  const docker = fs.readFileSync(path.join(ROOT, 'piper-tts', 'Dockerfile'), 'utf8');
  const selected = [
    'ru_RU-irina-medium', 'ru_RU-denis-medium',
    'uk_UA-lada-x_low', 'uk_UA-oleksa-high',
    'en_US-ljspeech-high', 'en_US-john-medium',
    'de_DE-kerstin-low', 'de_DE-thorsten-high',
    'es_AR-daniela-high', 'es_ES-davefx-medium',
  ];
  for (const voice of selected) assert.match(docker, new RegExp(voice));
  assert.match(app, /shadowVoiceGender: 'female'/);
  assert.match(app, /data-action="set-shadow-voice-gender"/);
  assert.match(app, /aria-pressed="\$\{gender === 'female'\}"/);
  assert.match(app, /ru: \{ female: 'Irina', male: 'Denis' \}/);
  assert.match(app, /dataset\.ttsIdleHtml = btn\.innerHTML/);
  assert.match(app, /innerHTML = _ttsBtn\.dataset\.ttsIdleHtml/);
  assert.match(voiceClient, /dataset\.shadowVoiceIdleHtml = button\.innerHTML/);
  assert.match(voiceClient, /innerHTML = button\.dataset\.shadowVoiceIdleHtml/);
  assert.match(css, /\.shadow-voice-choice[\s\S]*?min-height: 42px/);
  assert.match(sw, /const CACHE = 'satoru-v197'/);
});
