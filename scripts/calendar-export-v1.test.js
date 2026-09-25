'use strict';
// R04D: .ics по RFC 5545 — свёртка по октетам, экранирование, стабильный UID, пропуск битого времени.
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../public/calendar-export-v1.js');

const NOW = new Date('2026-09-25T10:11:12.345Z');
const unfold = (text) => text.replace(/\r\n /g, '');

test('events keep stable UIDs, floating local time and a clean title', () => {
  const out = X.build([
    { id: 't1', title: 'Учёба, глава 3; конспект', date: '2026-09-26', startTime: '09:30', estimateMin: 45 },
    { id: 't2', title: 'no time', date: '2026-09-26' },
  ], { now: NOW, sphereOf: () => 'Учёба' });
  const text = unfold(out.text);
  assert.equal(out.count, 1);
  assert.equal(out.skipped, 0, 'tasks without a time are not an error');
  assert.match(text, /\r\nUID:t1@gojo\r\n/, 'UID stays compatible with earlier imports');
  assert.match(text, /\r\nDTSTAMP:20260925T101112Z\r\n/);
  assert.match(text, /\r\nDTSTART:20260926T093000\r\n/, 'floating time, no TZ shift');
  assert.match(text, /\r\nDURATION:PT45M\r\n/);
  assert.match(text, /\r\nSUMMARY:Учёба\\, глава 3\\; конспект\r\n/);
  assert.doesNotMatch(text, /🎯/);
  assert.match(text, /\r\nDESCRIPTION:Satoru · Учёба\r\n/);
  assert.ok(out.text.startsWith('BEGIN:VCALENDAR\r\n') && out.text.endsWith('END:VCALENDAR\r\n'));
});

test('long UTF-8 lines fold at 75 octets without splitting characters', () => {
  const title = 'Подготовить презентацию для встречи с научным руководителем 🎓 и отправить черновик';
  const out = X.build([{ id: 'long', title, date: '2026-09-26', startTime: '18:00' }], { now: NOW });
  for (const line of out.text.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line}`);
  assert.match(unfold(out.text), new RegExp(`SUMMARY:${title}\\r\\n`));
  assert.ok(!out.text.includes('�'));
});

test('invalid dates or times are skipped and counted; short times are normalised', () => {
  const out = X.build([
    { id: 'a', title: 'bad time', date: '2026-09-26', startTime: '25:00' },
    { id: 'b', title: 'bad date', date: '2026-02-30', startTime: '10:00' },
    { id: 'c', title: 'short', date: '2026-09-26', startTime: '9:5', estimateMin: 1 },
    { id: 'd', title: 'x\r\ny\\z', date: '2026-09-26', startTime: '23:59', estimateMin: 10000 },
  ], { now: NOW });
  assert.equal(out.count, 2);
  assert.equal(out.skipped, 2);
  const text = unfold(out.text);
  assert.match(text, /UID:c@gojo\r\nDTSTAMP:\S+\r\nDTSTART:20260926T090500\r\nDURATION:PT5M/);
  assert.match(text, /SUMMARY:x\\ny\\\\z\r\n/);
  assert.match(text, /UID:d@gojo[\s\S]*DURATION:PT1440M/);
});

test('filename uses the product name and the export date', () => {
  assert.equal(X.filename('2026-09-25'), 'satoru-calendar-2026-09-25.ics');
  assert.equal(X.filename('bad'), 'satoru-calendar-export.ics');
});

test('export entry points are wired, verified and localized', () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.resolve(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.ok(index.indexOf('calendar-export-v1.js?v=') > 0 && index.indexOf('calendar-export-v1.js?v=') < index.indexOf('app.js?v='));
  assert.match(sw, /'calendar-export-v1\.js'/);
  assert.doesNotMatch(app, /gojo-calendar\.ics/);
  assert.doesNotMatch(app, /href="\/api\/account\/export" download/, 'the archive is fetched and verified before saving');
  assert.match(app, /archive\.format !== 'satoru-account'/);
  const card = app.slice(app.indexOf('function weekShareSVG('), app.indexOf('function closeWeekShare('));
  assert.doesNotMatch(card, /'Квестов'\s*,\s*val|>Квестов<|>Привычек<|>Часов<|ур\.\$\{lvl\}|railway\.app/);
  assert.match(card, /satoruapp\.com/);
  for (const key of ['Скачать PNG', 'Файл календаря сохранён', 'Архив сохранён', 'Сессия истекла. Войди снова и повтори экспорт — архив не скачан.', 'Не удалось создать картинку. Попробуй ещё раз.', 'Память сохранена в файл']) {
    const at = app.indexOf(`'${key}': {`);
    assert.notEqual(at, -1, key);
    const row = app.slice(at, app.indexOf('\n', at));
    for (const lang of ['en', 'de', 'uk', 'es']) assert.match(row, new RegExp(`\\b${lang}: ['"]`), `${key} → ${lang}`);
  }
});
