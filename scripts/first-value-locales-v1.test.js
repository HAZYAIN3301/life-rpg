'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../public/first-value-v1.js');
const UI = require('../public/first-value-ui-v1.js');
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const extra = vm.runInNewContext('(' + source.match(/const I18N_EXTRA = (\{[\s\S]*?\n\});/)[1] + ')');
const at = '2026-09-24T10:00:00.000Z';

function views() {
  const all = [];
  for (const [route, entityType, outcomeType] of [
    ['do_now', 'quest', 'quest_completed'],
    ['clarify', 'goal_step', 'next_action_committed'],
    ['clarify', 'plan', 'real_plan_created'],
    ['recover', 'recovery_boundary', 'recovery_boundary_started'],
  ]) {
    let journey = F.createJourney({ userId:'qa', startedAt:at });
    const add = j => all.push(F.deriveJourneyView(j, { now:at }));
    add(journey);
    journey = F.transitionJourney(journey, { id:'route', type:'route_chosen', route, at }); add(journey);
    for (const reason of ['user_choice', 'time_boundary']) {
      const deferred = F.transitionJourney(journey, { id:'defer', type:'deferred', reason, at });
      add(deferred);
      add(F.transitionJourney(deferred, { id:'resume', type:'resumed', at }));
    }
    journey = F.transitionJourney(journey, { id:'ready', type:'action_ready', entityType, entityId:'item', at }); add(journey);
    journey = F.transitionJourney(journey, { id:'start', type:'action_started', entityType, entityId:'item', at }); add(journey);
    all.push(F.deriveJourneyView(journey, { now:'2026-09-24T10:11:00.000Z' }));
    journey = F.transitionJourney(journey, { id:'outcome', type:'outcome_recorded', entityType, entityId:'item', outcomeType, occurredAt:at, at });
    assert.equal(journey.status, 'first_value_reached'); add(journey);
  }
  return all;
}

for (const locale of ['en','de','uk','es']) {
  test(`First Value renders every route, saved outcome, pause and time boundary in ${locale}`, () => {
    const base = vm.runInNewContext('(' + source.match(new RegExp('const I18N_' + locale.toUpperCase() + ' = (\\{[\\s\\S]*?\\n\\});'))[1] + ')');
    const missing = new Set();
    const t = key => {
      const value = extra[key]?.[locale] || base[key];
      if (!value && /[А-Яа-яЁё]/.test(key)) missing.add(key);
      return value || key;
    };
    for (const view of views()) {
      const html = UI.renderCard(view, { t, resolveReference: () => ({ title:'Example task' }) });
      assert.doesNotMatch(html, /user_choice|time_boundary|\{reason\}|\{time\}/);
      assert.ok(!html.includes('undefined'));
    }
    assert.deepEqual([...missing], []);
  });
}

test('Russian deferred card explains the reason instead of exposing an internal code', () => {
  for (const reason of ['user_choice','time_boundary']) {
    const journey = F.transitionJourney(F.createJourney({ userId:'qa', startedAt:at }),
      { id:'pause', type:'deferred', reason, at });
    const html = UI.renderCard(F.deriveJourneyView(journey, { now:at }));
    assert.doesNotMatch(html, /user_choice|time_boundary/);
    assert.match(html, /Отложено:/);
  }
});
