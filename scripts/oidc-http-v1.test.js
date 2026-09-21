'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { hash } = require('../server-oidc-v1');

test('real HTTP linking, login, PKCE, session-version fence and deletion', { timeout: 30000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-oidc-http-'));
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig', alg: 'RS256' };
  const pem = pair.privateKey.export({ format: 'pem', type: 'pkcs8' });
  // Test-process-only transport interception. Production has no configurable
  // issuer/JWKS URLs and cannot opt into this fake identity provider.
  const preload = path.join(dir, 'provider.cjs');
  fs.writeFileSync(preload, `const crypto = require('node:crypto');
    const original = global.fetch;
    global.fetch = async (url, options) => {
      if (url === 'https://www.googleapis.com/oauth2/v3/certs') return {ok:true,text:async()=>${JSON.stringify(JSON.stringify({ keys: [jwk] }))}};
      if (url === 'https://oauth2.googleapis.com/token') {
        const code = JSON.parse(Buffer.from(new URLSearchParams(options.body).get('code'), 'base64url'));
        const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        const input = enc({alg:'RS256',kid:'test'}) + '.' + enc({iss:'https://accounts.google.com',aud:'test-client',sub:code.sub,nonce:code.nonce,iat:now,exp:now+300,email:'shared@example.test'});
        const token = input + '.' + crypto.sign('RSA-SHA256',Buffer.from(input),${JSON.stringify(pem)}).toString('base64url');
        return {ok:true,text:async()=>JSON.stringify({id_token:token})};
      }
      return original(url,options);
    };`);
  const port = 52000 + process.pid % 900;
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['--require', preload, 'server.js'], {
    cwd: path.resolve(__dirname, '..'), stdio: 'ignore',
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: path.join(dir, 'data'), PUSH_SCHED: 'off',
      OAUTH_PUBLIC_ORIGIN: 'https://satoruapp.com', GOOGLE_OAUTH_CLIENT_ID: 'test-client', GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret',
      APPLE_OAUTH_CLIENT_ID: '', APPLE_OAUTH_PRIVATE_KEY: '' },
  });
  t.after(async () => { child.kill(); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await fetch(base + '/api/version'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 50)); } }
  assert.ok(ready);
  async function api(route, body, cookie) {
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': '10.8.' + Math.floor(Math.random() * 240) + '.' + Math.floor(Math.random() * 240),
      ...(cookie ? { Cookie: cookie } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const account = await api('/api/auth/register', { name: 'OIDC test', email: 'shared@example.test', password: 'test-password-123' });
  assert.equal(account.status, 200);
  assert.deepEqual((await api('/api/auth/oauth/providers')).data.providers, ['google']);
  const verifier = 'v'.repeat(43), challenge = hash(verifier);
  assert.equal((await api('/api/auth/oauth/prepare', { provider: 'google', mode: 'link', password: 'wrong', challenge }, account.cookie)).status, 401);
  async function flow(mode, sub, cookie = account.cookie) {
    const prep = await api('/api/auth/oauth/prepare', { provider: 'google', mode, challenge, password: 'test-password-123' }, cookie);
    assert.equal(prep.status, 200);
    const startURL = new URL(prep.data.url);
    const start = await fetch(base + startURL.pathname + startURL.search, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const external = new URL(start.headers.get('location'));
    const code = Buffer.from(JSON.stringify({ sub, nonce: external.searchParams.get('nonce') })).toString('base64url');
    const callback = '/oauth/callback/google?state=' + external.searchParams.get('state') + '&code=' + code;
    const browser = start.headers.get('set-cookie').split(';')[0];
    const finish = await fetch(base + callback, { redirect: 'manual', headers: { Cookie: browser } });
    assert.equal(finish.status, 302);
    const result = new URL(finish.headers.get('location'));
    return { result, callback, browser };
  }
  // Matching email alone cannot discover or authorize the existing account.
  assert.equal((await flow('login', 'subject-one', null)).result.searchParams.get('error'), 'account_not_linked');
  const linked = await flow('link', 'subject-one');
  const ticket = linked.result.searchParams.get('ticket'); assert.ok(ticket);
  assert.equal((await api('/api/auth/oauth/redeem', { ticket, verifier: 'x'.repeat(43) })).status, 401);
  const redeem = await api('/api/auth/oauth/redeem', { ticket, verifier }); assert.equal(redeem.status, 200);
  const oauthCookie = 'lrpg_sess=' + encodeURIComponent(redeem.data.sessionToken);
  assert.equal((await api('/api/auth/me', null, oauthCookie)).data.id, account.data.id);
  assert.equal((await api('/api/auth/oauth/redeem', { ticket, verifier })).status, 401);
  assert.equal((await fetch(base + linked.callback, { headers: { Cookie: linked.browser } })).status, 400);
  assert.equal((await flow('link', 'subject-two')).result.searchParams.get('error'), 'identity_already_linked');
  const login = await flow('login', 'subject-one', null);
  const rotated = await api('/api/auth/change-password', { currentPassword: 'test-password-123', newPassword: 'new-test-password-123' }, account.cookie);
  assert.equal(rotated.status, 200);
  assert.equal((await api('/api/auth/oauth/redeem', { ticket: login.result.searchParams.get('ticket'), verifier })).status, 401);
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'data/users.json')));
  assert.equal(stored[0].oauth.google.subject, 'subject-one');
  assert.equal(JSON.stringify((await api('/api/auth/me', null, rotated.cookie)).data).includes('subject-one'), false);
  assert.equal((await api('/api/auth/delete-account', { confirm: 'DELETE', password: 'new-test-password-123' }, rotated.cookie)).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'data/users.json'))).length, 0);
});
