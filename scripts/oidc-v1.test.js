'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { create, verifyIdentity, hash } = require('../server-oidc-v1');
const Registry = require('../server-user-registry-v1');
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig', alg: 'RS256' };
const now = 1800000000000;
const base = { iss: 'https://accounts.google.com', sub: 'subject', aud: 'client', nonce: 'nonce', exp: now / 1000 + 300, iat: now / 1000 };
function sign(claims = {}, header = {}) {
  const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const input = enc({ alg: 'RS256', kid: 'test', ...header }) + '.' + enc({ ...base, ...claims });
  return input + '.' + crypto.sign('RSA-SHA256', Buffer.from(input), pair.privateKey).toString('base64url');
}
const options = { provider: 'google', audience: 'client', nonce: 'nonce', now };
test('OIDC accepts only verified issuer/subject; does not return email as identity', () => {
  assert.deepEqual(verifyIdentity(sign({ email: 'someone@example.test' }), { keys: [jwk] }, options), { issuer: base.iss, subject: 'subject' });
});
for (const claims of [{ iss: 'https://attacker.test' }, { aud: 'another' }, { aud: ['client'] }, { azp: 'another' }, { nonce: 'wrong' }, { exp: now / 1000 }, { iat: now / 1000 + 120 }, { iat: now / 1000 - 601 }, { nbf: now / 1000 + 120 }, { sub: '' }, { exp: 'forever' }]) {
  test('rejects invalid claims ' + JSON.stringify(claims), () => assert.throws(() => verifyIdentity(sign(claims), { keys: [jwk] }, options), /invalid_identity/));
}
test('rejects wrong alg, unknown or duplicated signing key and modified signature', () => {
  for (const token of [sign({}, { alg: 'none' }), sign({}, { kid: 'other' }), sign().slice(0, -10) + 'AAAAAAAAAA'])
    assert.throws(() => verifyIdentity(token, { keys: [jwk] }, options), /invalid_identity/);
  assert.throws(() => verifyIdentity(sign(), { keys: [jwk, jwk] }, options), /invalid_identity/);
});
const env = { OAUTH_PUBLIC_ORIGIN: 'https://satoruapp.com', GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret' };
function fixture() {
  let clock = now, nonce, posted;
  const service = create({ env, secret: () => 'test-key', now: () => clock, fetcher: async (url, options) => {
    if (url.includes('/token')) { posted = new URLSearchParams(options.body); return { ok: true, text: async () => JSON.stringify({ id_token: sign({ nonce }) }) }; }
    return { ok: true, text: async () => JSON.stringify({ keys: [jwk] }) };
  } });
  const verifier = 'a'.repeat(43);
  function begin(link = null) {
    const prepared = service.prepare('google', hash(verifier), link);
    const id = new URL(prepared.url).searchParams.get('request');
    const started = service.authorize(id);
    const url = new URL(started.url); nonce = url.searchParams.get('nonce');
    return { ...started, id, url };
  }
  return { service, verifier, begin, advance: n => clock += n, posted: () => posted };
}
test('disabled/malformed configuration fails closed', () => {
  for (const config of [{}, { ...env, OAUTH_PUBLIC_ORIGIN: 'http://satoruapp.com' }, { ...env, GOOGLE_OAUTH_CLIENT_SECRET: '' }]) {
    const service = create({ env: config, secret: () => 'test' });
    assert.deepEqual(service.available(), []);
    assert.throws(() => service.prepare('google', hash('x')), /provider_unavailable/);
  }
});
test('browser binding, one-use state and native PKCE are enforced', async () => {
  const f = fixture(), started = f.begin({ uid: 'one', version: 'v1' });
  assert.equal(started.url.searchParams.get('code_challenge_method'), 'S256');
  assert.throws(() => f.service.authorize(started.id), /expired_request/);
  const identity = await f.service.finish('google', { state: started.state, code: 'test-code' }, started.browser);
  assert.equal(identity.subject, 'subject'); assert.deepEqual(identity.link, { uid: 'one', version: 'v1' });
  assert.equal(hash(f.posted().get('code_verifier')), started.url.searchParams.get('code_challenge'));
  await assert.rejects(f.service.finish('google', { state: started.state, code: 'test-code' }, started.browser), /expired_request/);
  const ticket = f.service.issueTicket('one', 'v1', identity.challenge);
  assert.throws(() => f.service.redeem(ticket, 'b'.repeat(43)), /expired_request/);
  assert.equal(f.service.redeem(ticket, f.verifier).uid, 'one');
  assert.throws(() => f.service.redeem(ticket, f.verifier), /expired_request/);
});
test('wrong browser/provider, denial, expiry and restart cannot authorize', async () => {
  for (const kind of ['browser', 'provider', 'denied', 'expired']) {
    const f = fixture(), started = f.begin();
    if (kind === 'expired') f.advance(300001);
    await assert.rejects(f.service.finish(kind === 'provider' ? 'apple' : 'google', {
      state: started.state, code: 'code', ...(kind === 'denied' ? { error: 'access_denied' } : {}),
    }, kind === 'browser' ? 'wrong' : started.browser));
  }
  const f = fixture(), ticket = f.service.issueTicket('one', 'v1', hash(f.verifier));
  f.advance(60001); assert.throws(() => f.service.redeem(ticket, f.verifier), /expired_request/);
  assert.throws(() => fixture().service.redeem(ticket, f.verifier), /expired_request/);
});
test('registry rejects ambiguous OAuth subjects and invalid identity fields', () => {
  const account = { id: 'one', name: 'One', oauth: { google: { subject: 'subject' } } };
  Registry.assertValid([account]);
  assert.throws(() => Registry.assertValid([account, { ...account, id: 'two' }]), /duplicate-oauth/);
  assert.throws(() => Registry.assertValid([{ ...account, oauth: { google: { subject: '' } } }]), /bad-oauth/);
});
test('Apple client secret is ES256, refresh token is encrypted and revocation uses it', async () => {
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const appleEnv = { OAUTH_PUBLIC_ORIGIN: 'https://satoruapp.com', APPLE_OAUTH_CLIENT_ID: 'apple-client',
    APPLE_OAUTH_TEAM_ID: 'TESTTEAM', APPLE_OAUTH_KEY_ID: 'TESTKEY', APPLE_OAUTH_PRIVATE_KEY: ec.privateKey.export({ format: 'pem', type: 'pkcs8' }) };
  let nonce, revoke;
  const service = create({ env: appleEnv, now: () => now, secret: () => 'storage-secret', fetcher: async (url, options) => {
    if (url.endsWith('/keys')) return { ok: true, text: async () => JSON.stringify({ keys: [jwk] }) };
    const params = new URLSearchParams(options.body);
    const clientSecret = params.get('client_secret').split('.');
    assert.equal(JSON.parse(Buffer.from(clientSecret[0], 'base64url')).alg, 'ES256');
    assert.ok(crypto.verify('sha256', Buffer.from(clientSecret.slice(0, 2).join('.')), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(clientSecret[2], 'base64url')));
    if (url.endsWith('/revoke')) { revoke = params; return { ok: true }; }
    return { ok: true, text: async () => JSON.stringify({ id_token: sign({ iss: 'https://appleid.apple.com', aud: 'apple-client', nonce }), refresh_token: 'sensitive-refresh-token' }) };
  } });
  const prepared = service.prepare('apple', hash('v'.repeat(43)));
  const start = service.authorize(new URL(prepared.url).searchParams.get('request'));
  const external = new URL(start.url); nonce = external.searchParams.get('nonce');
  assert.equal(external.searchParams.get('response_mode'), 'form_post');
  const identity = await service.finish('apple', { state: start.state, code: 'test-code' }, start.browser);
  assert.equal(identity.subject, 'subject');
  assert.equal(identity.refresh.includes('sensitive-refresh-token'), false);
  await service.revokeApple(identity);
  assert.equal(revoke.get('token'), 'sensitive-refresh-token');
  assert.equal(revoke.get('token_type_hint'), 'refresh_token');
});
