'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../public/reward-life-v1');
test('personal reward lifecycle leaves purchase history, inventory and gold intact', () => {
  const purchases=[{id:'p1',rewardId:'r1',cost:100,name:'Walk'},{id:'p2',denId:'chair',cost:50}];
  const before=JSON.stringify(purchases), settings={cosmetics:['a'],den:{owned:['chair']}};
  let next=P.change(settings,purchases,'p1','planned','2026-09-30','2026-09-29T12:00:00Z');
  assert.equal(next.rewardLifeV1.p1.date,'2026-09-30'); assert.equal(settings.rewardLifeV1,undefined);
  for (const status of ['used','deferred','received']) { next=P.change(next,purchases,'p1',status,null,'2026-09-29T12:01:00Z'); assert.equal(next.rewardLifeV1.p1.status,status); }
  assert.equal(JSON.stringify(purchases),before); assert.deepEqual(next.den,settings.den); assert.deepEqual(next.cosmetics,settings.cosmetics);
  assert.throws(()=>P.change(settings,purchases,'p2','used',null,'2026-09-29'));
  assert.throws(()=>P.change(settings,purchases,'p1','planned','2026-02-31','2026-09-29'));
  assert.throws(()=>P.change({...settings,rewardLifeV1:{p1:{status:'broken'}}},purchases,'p1','used',null,'2026-09-29'));
});
