'use strict';
// Ночная ветка 14.10: личную награду можно отметить «Я воспользовался» / «Отложить» прямо на «Сегодня».
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const P = require('../public/reward-life-v1');

function setup() {
  const state = { purchases: [{ id: 'p1', rewardId: 'coffee', cost: 60, name: 'Кофе <в кофейне>' }], settings: { rewardLifeV1: { p1: { status: 'planned', date: '2026-10-14', updatedAt: '2026-10-14T08:00:00Z' } } } };
  const commits = [];
  const ui = P.create({ state: () => state, lang: () => 'ru', escape: (x) => String(x).replace(/</g, '&lt;').replace(/>/g, '&gt;'), today: () => '2026-10-14', identity: () => 'u1:1', commit: async (data) => { commits.push(data); return true; }, open: () => { state.opened = true; }, render: () => {} });
  return { state, ui, commits };
}
function click(action, rewardId) {
  const host = { dataset: { rewardId }, querySelector: () => null };
  const button = { dataset: { rewardLife: action }, closest: (sel) => sel === '[data-reward-life]' ? button : sel === '[data-reward-id]' ? host : null };
  return { target: { closest: (sel) => button.closest(sel) }, preventDefault() {} };
}

test('карточка на «Сегодня» даёт отметить награду на месте', () => {
  const { ui } = setup();
  const html = ui.today();
  assert.match(html, /<div class="duo-today reward-life-today" data-reward-id="p1">/);
  assert.match(html, /data-reward-life="used"[^>]*>Я воспользовался</);
  assert.match(html, /data-reward-life="deferred"[^>]*>Отложить</);
  assert.match(html, /data-reward-life="open">Открыть награды</);
  assert.match(html, /Кофе &lt;в кофейне&gt;/, 'название экранировано');
});

test('«Я воспользовался» с «Сегодня» сохраняет статус и не трогает покупки', async () => {
  global.document = { querySelector: () => null };
  try {
    const { state, ui, commits } = setup(); const before = JSON.stringify(state.purchases);
    assert.equal(await ui.handle(click('used', 'p1')), true);
    assert.equal(commits.length, 1);
    assert.equal(state.settings.rewardLifeV1.p1.status, 'used');
    assert.equal(JSON.stringify(state.purchases), before);
    assert.equal(ui.today(), '', 'использованная награда уходит с «Сегодня»');
  } finally { delete global.document; }
});

test('метка версии модуля поднята — телефоны не получат старый файл из кэша', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.match(html, /reward-life-v1\.js\?v=20261014-reward-today-1/);
});

test('название награды из каталога переводится, своё название остаётся', () => {
  const state = { purchases: [{ id: 'p1', rewardId: 'coffee', name: 'Кофе в любимой кофейне' }, { id: 'p2', rewardId: 'own', name: 'Мой поход' }], settings: { rewardLifeV1: { p1: { status: 'planned', date: '2026-10-14', updatedAt: '2026-10-14T08:00:00Z' } } } };
  const dict = { 'Кофе в любимой кофейне': 'Coffee at your favorite café' };
  const ui = P.create({ state: () => state, lang: () => 'en', escape: (x) => String(x), translate: (k) => dict[k] || k, today: () => '2026-10-14', identity: () => 'u', commit: async () => true, open() {}, render() {} });
  assert.match(ui.today(), /Coffee at your favorite café/);
  const body = ui.body(); assert.match(body, /Coffee at your favorite café/); assert.match(body, /Мой поход/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /window\.RewardLifeV1\.create\(\{ state: \(\) => State, lang, escape: esc, translate: t,/);
});
