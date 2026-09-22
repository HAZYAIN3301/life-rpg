'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const Import = require('../public/goal-proposal-import-v1.js');

test('external-AI metric with a unit is saved as a finite number without changing the source JSON', () => {
  const source = { type: 'goal', title: 'Run 10 km', metric: { current: '1,5 км', target: '10 км', unit: 'км' } };
  const result = Import.normalize([source]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.proposals[0].metric.current, 1.5);
  assert.equal(result.proposals[0].metric.target, 10);
  assert.equal(result.proposals[0].metric.unit, 'км');
  assert.equal(source.metric.target, '10 км');
  assert.equal(Import.numberWithUnit('1 000 км', 'км').value, 1000);
});

test('ambiguous metrics and oversized proposal files fail before a partial import', () => {
  assert.deepEqual(Import.normalize([{ type: 'goal', metric: { current: 0, target: '10 miles', unit: 'км' } }]).issues,
    [{ index: 0, field: 'metric' }]);
  assert.deepEqual(Import.normalize([{ type: 'goal', metric: { current: 0, target: 'ten' } }]).issues,
    [{ index: 0, field: 'metric' }]);
  const tooMany = Import.normalize(Array.from({ length: Import.MAX_PROPOSALS + 1 }, () => ({ type: 'goal', title: 'Goal' })));
  assert.equal(tooMany.proposals.length, 0);
  assert.deepEqual(tooMany.issues, [{ index: -1, field: 'limit' }]);
});

test('current Chromium archive is served as a download with the exact ZIP bytes', { timeout: 20000 }, async t => {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-extension-download-'));
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env,
    HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; } fs.rmSync(dataDir, { recursive: true, force: true }); });
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150 && !output.includes('Satoru запущен:'); i++) {
    if (child.exitCode !== null) throw Error(output); await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.match(output, /Satoru запущен:/);
  const name = 'satoru-attention-chromium-v260.zip';
  const response = await fetch(`${base}/downloads/${name}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${name}"`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, 'public/downloads', name)));
});
