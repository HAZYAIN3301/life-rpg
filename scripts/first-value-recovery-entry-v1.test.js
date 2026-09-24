'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const prepare = source.slice(source.indexOf('function firstValuePrepareRoute('), source.indexOf('async function firstValueOpenReference('));

test('First Value recovery opens the existing launcher for the promised ten minutes after rendering', () => {
  const calls = [], opener = { id:'first-value-primary' };
  const context = { State:{view:'goals'}, render:()=>calls.push('render'),
    setTimeout:fn=>fn(),
    document:{querySelector:selector=>{
      assert.match(selector, /first-value-open-primary/);
      return opener;
    }},
    openRecoveryLauncher:(button, defaults)=>{
      assert.equal(button,opener); assert.equal(defaults.minutes,10);
      calls.push('launcher');
    },
  };
  vm.createContext(context); vm.runInContext(prepare,context);
  context.firstValuePrepareRoute('recover');
  assert.equal(context.State.view,'today');
  assert.deepEqual(calls,['render','launcher']);
});
