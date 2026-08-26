'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Registry = require('../server-user-registry-v1.js');

const ROOT = path.resolve(__dirname, '..');

function legacyUser(overrides = {}) {
  return { id: 'albert', name: 'Albert', avatar: '⚔️', pinHash: 'legacy-hash', isAdmin: true, ...overrides };
}

test('missing future fields remain compatible while crash-shaped registries fail closed', () => {
  const valid = [legacyUser({ unknownFutureField: { retained: true } })];
  assert.equal(Registry.assertValid(valid), valid);
  assert.deepEqual(Registry.parse(JSON.stringify(valid)), valid);

  const invalid = [
    null, {}, [null], [[]], [{}], [legacyUser({ id: '../escape' })],
    [legacyUser({ name: {} })], [legacyUser({ avatar: {} })],
    [legacyUser(), legacyUser()], [legacyUser({ plan: 'enterprise' })],
    [legacyUser({ socialConsent: [] })],
  ];
  for (const value of invalid) {
    assert.throws(() => Registry.assertValid(value), error => error && error.code === 'USERS_REGISTRY_CORRUPT');
  }
  assert.throws(() => Registry.parse('{broken'), error => error && error.reason === 'invalid-json');
});

test('save boundary is wired before every atomic registry write', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const save = source.slice(source.indexOf('function saveUsers('), source.indexOf('function userDataDir', source.indexOf('function saveUsers(')));
  assert.match(save, /ServerUserRegistryV1\.assertValid\(users\)[\s\S]*writeJsonAtomic\(USERS_FILE\(\), users\)/);
  assert.match(source, /ServerUserRegistryV1\.parse\(fs\.readFileSync\(USERS_FILE\(\), 'utf8'\)\)/);
  assert.doesNotMatch(save, /catch\s*\{/);
});

async function runWithRegistry(raw) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-registry-hardening-'));
  const registryFile = path.join(dataDir, 'users.json');
  fs.writeFileSync(registryFile, raw);
  const before = fs.readFileSync(registryFile);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`server did not fail closed: ${output}`)); }, 5000);
    child.once('exit', code => { clearTimeout(timer); resolve(code); });
  });
  const after = fs.readFileSync(registryFile);
  fs.rmSync(dataDir, { recursive: true, force: true });
  return { exitCode, before, after, output };
}

test('malformed users.json prevents startup and remains byte-identical', { timeout: 15000 }, async () => {
  for (const raw of ['{"broken":true}', '[{"id":"../escape","name":"Ghost"}]', '{not-json']) {
    const result = await runWithRegistry(raw);
    assert.notEqual(result.exitCode, 0, 'server must not boot against a corrupt account index');
    assert.deepEqual(result.after, result.before, 'startup must not rewrite or normalize the corrupt registry');
    assert.match(result.output, /users-registry|USERS_REGISTRY_CORRUPT|user registry rejected/);
  }
});
