'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const source = app.slice(app.indexOf('function captureOwnerCurrent('), app.indexOf('// Nested-прогрессия'));
function harness() {
  let uploads = 0, writes = 0, uploadFails = false, writeFails = false;
  const ctx = vm.createContext({ Blob, AbortController, clearInterval, setInterval, Date,
    State: { me: { id: 'owner' }, inbox: [], _inboxBusy: false }, Store: { _writeEpoch: 1 },
    _rec: null, _capturePending: null, prepareAudioRoute() {}, render() {}, toast() {}, t: x => x, track() {},
    CSS: { escape: x => x }, uid: () => 'stable-note', inboxWriteAllowed: () => true,
    blobToDataUrl: async () => 'data:audio/webm;base64,cWE=',
    fetch: async () => { uploads++; return { ok: !uploadFails, json: async () => ({ file: 'qa.webm', type: 'audio/webm' }) }; },
    commitInbox: async next => { writes++; if (writeFails) return false; ctx.State.inbox = next; return true; },
  });
  vm.runInContext(source, ctx);
  const rec = { kind: 'voice', recorder: { mimeType: 'audio/webm' }, chunks: ['recorded bytes'], accountId: 'owner', writeEpoch: 1 };
  return { ctx, rec, counts: () => ({ uploads, writes }), failUpload: b => uploadFails = b, failWrite: b => writeFails = b };
}
test('failed upload retains the recording, retry saves it and releases pending state', async () => {
  const h = harness(); h.failUpload(true); await h.ctx.onCaptureStop(h.rec);
  assert.equal(h.ctx._capturePending, h.rec); assert(h.rec.failed); assert.equal(h.ctx.State.inbox.length, 0);
  h.failUpload(false); await h.ctx.onCaptureStop(h.rec);
  assert.equal(h.ctx.State.inbox.length, 1); assert.equal(h.ctx._capturePending, null);
  assert.deepEqual(h.counts(), { uploads: 2, writes: 1 });
});
test('failed inbox receipt keeps uploaded media and stable note id; retries never duplicate it', async () => {
  const h = harness(); h.failWrite(true); await h.ctx.onCaptureStop(h.rec);
  assert(h.rec.upload); assert(h.rec.failed); assert.equal(h.ctx._capturePending, h.rec);
  h.failWrite(false); await h.ctx.onCaptureStop(h.rec); await h.ctx.onCaptureStop(h.rec);
  assert.equal(h.ctx.State.inbox.length, 1); assert.deepEqual(h.counts(), { uploads: 1, writes: 3 });
});
test('recordings cannot cross account or write epoch and cancellation releases their bytes', async () => {
  const h = harness(); h.failUpload(true); await h.ctx.onCaptureStop(h.rec);
  h.ctx.State.me.id = 'other'; await h.ctx.onCaptureStop(h.rec); assert.deepEqual(h.counts(), { uploads: 1, writes: 0 });
  h.ctx.State.me.id = 'owner'; h.ctx.Store._writeEpoch++; await h.ctx.onCaptureStop(h.rec); assert.deepEqual(h.counts(), { uploads: 1, writes: 0 });
  h.ctx.cancelCapturePipeline(); assert.equal(h.ctx._capturePending, null); assert(h.rec.cancelled);
});
