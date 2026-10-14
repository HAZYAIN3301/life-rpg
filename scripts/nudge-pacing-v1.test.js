'use strict';
// Ночная ветка 14.10: частота напоминаний Тени и тексты без вины (ждёт решения владельца).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Pacing = require('../server-nudge-pacing-v1.js');
const Copy = require('../server-nudge-copy-v1.js');
const ROOT = path.resolve(__dirname, '..');

test('затухание: каждый день → раз в 2 дня → раз в неделю → тишина', () => {
  assert.equal(Pacing.gapFor(0), 1); assert.equal(Pacing.gapFor(2), 1);
  assert.equal(Pacing.gapFor(3), 2); assert.equal(Pacing.gapFor(6), 2);
  assert.equal(Pacing.gapFor(7), 7); assert.equal(Pacing.gapFor(29), 7);
  assert.equal(Pacing.gapFor(30), null); assert.equal(Pacing.gapFor(400), null);
});

test('одно напоминание в день и слот по выбору человека', () => {
  const base = { away: 0, today: '2026-10-14', lastSent: '2026-10-13' };
  assert.equal(Pacing.decide({ ...base, kind: 'm', log: {} }).ok, true);
  assert.equal(Pacing.decide({ ...base, kind: 'p', log: { m: true } }).reason, 'daily_cap');
  assert.equal(Pacing.decide({ ...base, kind: 'e', log: {} }).reason, 'slot', 'по умолчанию — утро');
  assert.equal(Pacing.decide({ ...base, kind: 'e', log: {}, slot: 'evening' }).ok, true);
  assert.equal(Pacing.decide({ ...base, kind: 'm', log: {}, slot: 'evening' }).reason, 'slot');
  assert.equal(Pacing.normalizeSlot('nonsense'), 'morning');
});

test('«утром и вечером» — два касания, питомец третьим не приходит', () => {
  const base = { away: 0, today: '2026-10-14', lastSent: '2026-10-14', slot: 'both' };
  assert.equal(Pacing.decide({ ...base, kind: 'e', log: { m: true } }).ok, true);
  assert.equal(Pacing.decide({ ...base, kind: 'p', log: { m: true } }).reason, 'daily_cap');
  assert.equal(Pacing.decide({ ...base, kind: 'm', log: { m: true } }).reason, 'daily_cap');
  assert.equal(Pacing.decide({ ...base, kind: 'e', log: { p: true } }).reason, 'daily_cap');
});

test('🔴 40 дней без визита — 7 напоминаний, а не по 2–3 в день', () => {
  let lastSent = null, sent = 0;
  for (let day = 1; day <= 40; day++) {
    const today = new Date(Date.UTC(2026, 9, 1 + day)).toISOString().slice(0, 10);
    const log = {};
    for (const kind of ['m', 'p', 'e', 'q']) {
      if (Pacing.decide({ away: day, today, lastSent, log, kind }).ok) { log[kind] = true; lastSent = today; sent++; }
    }
    assert.ok(Object.keys(log).length <= 1, `день ${day}: больше одного напоминания`);
  }
  assert.equal(sent, 7);
});

test('🔴 тексты без вины: нет «скучает», «не пропадай», «ты пропал» ни на одном языке', () => {
  const banned = {
    ru: ['скучает', 'соскучил', 'не пропадай', 'ты пропал', 'давно тебя не видел в этой'],
    en: ['miss you', 'missed you', 'do not disappear', 'you disappeared'],
    de: ['vermiss', 'verschwinde nicht', 'du bist verschwunden'],
    uk: ['сумує', 'скучили', 'не зникай', 'ти зник'],
    es: ['echa de menos', 'echado de menos', 'no desaparezcas', 'desapareciste'],
  };
  for (const lang of Copy.LOCALES) {
    const t = Copy.COPY[lang];
    const all = [...Object.values(t.m).flat(), ...Object.values(t.e).flat(), ...t.p, ...t.q];
    for (const line of all) for (const w of banned[lang]) assert.equal(line.toLowerCase().includes(w), false, `${lang}: «${w}» в «${line}»`);
  }
});

test('планировщик идёт через правила частоты и помнит дату последнего напоминания', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const tick = src.slice(src.indexOf('async function pushTick()'), src.indexOf('// ИИ BYOK'));
  assert.match(tick, /NudgePacing\.decide\(\{ away: awayDays, today: date, lastSent: user\.push\.lastNudge \|\| null, log, kind: k, slot: user\.push\.slot \}\)/);
  for (const k of ["if (!payload && kind && !pace(kind).ok) kind = null;", "pace('p').ok", "pace('q').ok"]) assert.ok(tick.includes(k), k);
  assert.match(tick, /user\.push\.lastNudge = date/);
  assert.match(src, /u === '\/api\/push\/nudges' && req\.method === 'GET'/);
  assert.match(src, /NudgePacing\.SLOTS\.includes\(b\.slot\)/);
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  assert.match(app, /data-nudge-slot/);
  assert.match(app, /accountJson\('\/api\/push\/nudges'/);
});
