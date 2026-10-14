'use strict';
// Ночная ветка 14.10: отзыв (текст человека + id) уходит в GitHub Issues только если репозиторий приватный.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const code = SERVER.slice(SERVER.indexOf('let _githubRepoPrivacy = '), SERVER.indexOf('//  Strava integration'));

function load(repoReply) {
  const calls = [];
  const https = { request(options, onResponse) {
    const req = new EventEmitter(); calls.push({ method: options.method, path: options.path });
    req.setTimeout = () => req; req.write = () => {}; req.destroy = (e) => req.emit('error', e);
    req.end = () => setImmediate(() => {
      if (options.method === 'GET') {
        if (repoReply === 'error') return req.emit('error', new Error('offline'));
        const res = new EventEmitter(); res.statusCode = repoReply.status; res.setEncoding = () => {};
        onResponse(res); res.emit('data', JSON.stringify(repoReply.body)); res.emit('end');
      } else { const res = new EventEmitter(); res.resume = () => {}; onResponse(res); }
    });
    return req;
  } };
  const ctx = { https, process: { env: { GITHUB_TOKEN: 'test-token', GITHUB_REPO: 'owner/repo' } }, console: { warn() {}, error() {} }, Buffer, JSON, Date, Promise, setImmediate };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, calls };
}
const entry = { kind: 'bug', text: 'Текст отзыва', userId: 'u1', at: '2026-10-14T12:00:00.000Z', attachments: [] };

test('публичный репозиторий — issue не создаётся', async () => {
  const { ctx, calls } = load({ status: 200, body: { private: false } });
  await ctx.createGithubIssue(entry);
  assert.deepEqual(calls.map((c) => c.method), ['GET']);
});

test('приватный репозиторий — issue создаётся, проверка кэшируется', async () => {
  const { ctx, calls } = load({ status: 200, body: { private: true } });
  await ctx.createGithubIssue(entry); await ctx.createGithubIssue(entry);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), ['GET /repos/owner/repo', 'POST /repos/owner/repo/issues', 'POST /repos/owner/repo/issues']);
});

test('нет ответа или ошибка доступа — по умолчанию не публикуем', async () => {
  for (const reply of ['error', { status: 404, body: { message: 'Not Found' } }, { status: 200, body: {} }]) {
    const { ctx, calls } = load(reply);
    await ctx.createGithubIssue(entry);
    assert.equal(calls.filter((c) => c.method === 'POST').length, 0, JSON.stringify(reply));
  }
});
