'use strict';
// R08: на плотном «Сегодня» название квеста — одна цель 44px на линии кружка-отметки,
// а подсказка «Как выбрать сложность?» раскрывается из строки 44px.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NEXT = fs.readFileSync(path.join(__dirname, '../public/design-next-v1.css'), 'utf8');

function lastRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = [...NEXT.matchAll(new RegExp(`${escaped}\\{([^}]*)\\}`, 'g'))];
  assert.ok(rules.length, selector);
  return rules[rules.length - 1][1];
}

test('the quest title button is a 44px target and the title column no longer pads it down', () => {
  assert.match(lastRule(':root[data-design=next] .task.task-entry-layout .t-title-edit'), /min-height:44px/);
  assert.match(lastRule(':root[data-design=next] .task.task-entry-layout>.t-title'), /padding-top:0/);
  // The later rule must win over the dense v282 reset (min-height:0).
  assert.ok(NEXT.lastIndexOf('.task.task-entry-layout .t-title-edit{display:flex;align-items:center;min-height:44px')
    > NEXT.indexOf('.task.task-entry-layout .t-title-edit{padding:0;min-height:0'));
});

test('the difficulty help summary opens from a 44px row', () => {
  assert.match(lastRule(':root[data-design=next] .difficulty-help>summary'), /min-height:44px/);
});
