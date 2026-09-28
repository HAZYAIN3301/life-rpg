'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const G = require('../public/gold-goal-v1'), C = require('../public/shop-catalog-v1');
const goal = G.select('seat-forest', C.DEN_ITEMS);
test('only existing gold furniture can be selected; no pro, starter, unknown or future schema', () => {
  for (const id of ['seat-cloud', 'seat-cushion', 'unknown', null]) assert.equal(G.select(id, C.DEN_ITEMS), null);
  assert.equal(G.progress({version:2,itemId:'seat-forest'}, C.DEN_ITEMS, 100, 10, []), null);
  assert.equal(G.progress(null, C.DEN_ITEMS, 100, 10, []), null);
});
test('one live balance: earning, another purchase, insufficient level and acquired goal', () => {
  const check = (balance, level=5, owned=[]) => G.progress(goal,C.DEN_ITEMS,balance,level,owned);
  assert.equal(check(100).remaining,160); assert.equal(check(260).ready,true);
  assert.equal(check(80).remaining,180); assert.equal(check(260,4).ready,false);
  assert.equal(check(260,4).remaining,0); assert.equal(check(260,4).levelReady,false);
  assert.equal(check(0,5,['seat-forest']).acquired,true);
  assert.equal(check(999,5,['seat-forest']).ready,false);
  assert.equal(check(-20).percent,0); assert.equal(check(-20).remaining,280);
  assert.equal(check(-20).available,-20); assert.equal(check(Infinity).available,0);
  assert.equal(check(999999).percent,100);
});
test('selection and projection do not reserve, spend, mutate inventory or lose unrelated data', () => {
  const owned=['legacy-item'], before=JSON.stringify(C.DEN_ITEMS), saved=JSON.stringify(goal);
  for(let n=0;n<3;n++) G.progress(goal,C.DEN_ITEMS,100,1,owned);
  assert.deepEqual(owned,['legacy-item']); assert.equal(JSON.stringify(goal),saved);
  assert.equal(JSON.stringify(C.DEN_ITEMS),before);
  assert.deepEqual(G.select('light-six',C.DEN_ITEMS),{version:1,itemId:'light-six'});
});
