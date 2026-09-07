'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const START = read('START-HERE.md');
const BACKLOG = read('BACKLOG.md');
const CONTRACT = read('SECRETARY-ENGINE-CONTRACT.md');
const DEVLOG = read('DEVLOG.md');
const DOORS = read('HANDOFF-CODEX-DOORS.md');
const SECRETARY_UI = read('HANDOFF-CODEX-SECRETARY-UI.md');

test('cold start points at the current checkpoint and both old handoffs are superseded', () => {
  assert.match(START, /Актуальный handoff — 2026-09-06/);
  assert.match(START.slice(0, 1000), /текущий checkpoint/i);
  assert.match(START, /HANDOFF-CODEX-DOORS\.md.*HANDOFF-CODEX-SECRETARY-UI\.md[\s\S]*superseded history/);
  assert.match(DOORS.slice(0, 700), /SUPERSEDED 2026-09-06/);
  assert.match(SECRETARY_UI.slice(0, 700), /SUPERSEDED 2026-09-06/);
});

test('engine contract records actual browser and server ownership', () => {
  const wiring = CONTRACT.slice(CONTRACT.indexOf('## 1.'), CONTRACT.indexOf('## 2.'));
  assert.match(wiring, /commitment-v2\.js[\s\S]*загружен в браузере/);
  assert.match(wiring, /secretary-router-v1\.js[\s\S]*не загружать в браузер/);
  assert.match(wiring, /secretary-claim-v1\.js[\s\S]*не нужен как browser-script/);
  assert.match(wiring, /secretary-experiment-v1\.js[\s\S]*не строить второй экран/);
  assert.doesNotMatch(wiring, /Что нужно подключить со стороны UI/);
});

test('backlog keeps the four-door resolution and the open release gate', () => {
  assert.match(BACKLOG, /Старая последовательность «четырёх дверей» superseded/);
  assert.match(BACKLOG, /rest-profile-v1[^\n]*единственным намеренно dormant/);
  assert.match(BACKLOG, /Не закрыт release gate:[\s\S]*production deploy\/byte verification/);
});

test('devlog describes the selected animated ouroboros and preserves QA debt', () => {
  const loaderStart = DEVLOG.indexOf('## [2026-08-28] 🐉 Loader v190');
  const loaderEnd = DEVLOG.indexOf('\n---', loaderStart);
  const loader = DEVLOG.slice(loaderStart, loaderEnd);
  assert.match(loader, /ouroboros-body\.png/);
  assert.match(loader, /ouroboros-jaw\.png/);
  assert.match(loader, /3\.2s/);
  assert.match(loader, /\.8s/);
  assert.doesNotMatch(loader, /Само существо больше не крутится/);
  assert.match(DEVLOG.slice(0, 6500), /OPEN — visual\/production QA/);
  assert.match(DEVLOG.slice(0, 6500), /не писать «production verified» или «visual approved»/);
});
