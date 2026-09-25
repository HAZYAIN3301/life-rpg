'use strict';
// R09 (решение владельца 25.09): у каждой подсказки на «Сегодня» ровно одно действие,
// иначе блок поддержки её не показывает; тизер «Системы» удалён как дубль реплики Тени.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const hintLine = (name) => {
  const at = APP.indexOf(`const ${name} = `);
  assert.notEqual(at, -1, name);
  return APP.slice(at, APP.indexOf("` : '';", at) + 6);
};
const eligible = new Function(`${APP.slice(APP.indexOf('function secretaryNudgeEligible('), APP.indexOf('function secretaryNudgeInlineHTML('))}\nreturn secretaryNudgeEligible;`)();

test('rest, overload and mobility hints each carry exactly one action and pass the support rule', () => {
  const expected = { restNudge: 'recovery-open', lowEnergyNudge: 'evening-open', mobilityNudge: 'add-mobility' };
  for (const [name, action] of Object.entries(expected)) {
    const line = hintLine(name);
    assert.deepEqual([...line.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]), [action], name);
    assert.equal(eligible(line), true, name);
  }
  assert.doesNotMatch(hintLine('mobilityNudge'), /mobil-later|mobil-never/);
  assert.match(hintLine('mobilityNudge'), /class="nudge-note">\$\{esc\(t\('Это не медицинский совет/, 'the medical disclaimer stays visible');
});

test('the System teaser is gone; its discovery stays with the Shadow drip line', () => {
  assert.doesNotMatch(APP, /const sysTeaser = /);
  assert.doesNotMatch(APP, /id: 'sysTeaser'/);
  assert.doesNotMatch(APP, /enable-system-teaser|dismiss-system-teaser/);
  assert.match(APP, /\{ id: 'd_system', say: '[^']*«Система»[^']*', disc: 'teaser:system'/);
});

test('mobility can be switched off in Settings and created quests use the interface language', () => {
  assert.match(APP, /data-action="toggle-mobility-nudge" \$\{\(State\.settings\.prefs \|\| \{\}\)\.noMobilityNudge \? '' : 'checked'\}/);
  assert.match(APP, /action === 'toggle-mobility-nudge'\) \{ State\.settings\.prefs = Object\.assign\(\{\}, State\.settings\.prefs, \{ noMobilityNudge: !el\.checked \}\)/);
  assert.match(APP, /title: t\('Разминка \/ прогулка'\)/);
  assert.match(APP, /title: t\('Мобилка спины и плеч'\)/);
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  for (const key of ['Разминка / прогулка', 'Мобилка спины и плеч', 'Подсказывать мобилку, если ты тренируешься без растяжки', 'Отдохнуть с границей', 'Завершить день']) {
    for (const l of ['en', 'de', 'uk', 'es']) assert.ok(ctx.I18N[l][key], `${key} → ${l}`);
  }
});

test('movement and mobility are recognised in the quest titles the app itself creates in every language', () => {
  const move = new Function(`return ${APP.match(/const moveRe = (\/[^\n]+\/i);/)[1]};`)();
  const mobility = new Function(`return ${APP.match(/const mobilityRe = (\/[^\n]+\/i);/)[1]};`)();
  for (const title of ['Разминка / прогулка', 'Warm-up / walk', 'Aufwärmen / Spaziergang', 'Розминка / прогулянка', 'Calentamiento / paseo']) assert.ok(move.test(title), title);
  for (const title of ['мобилка спины и плеч', 'back and shoulder mobility', 'mobility für rücken und schultern', 'мобілка спини й плечей', 'movilidad de espalda y hombros']) assert.ok(mobility.test(title), title);
});
