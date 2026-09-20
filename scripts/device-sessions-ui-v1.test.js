'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../public/device-sessions-ui-v1.js');
const device = { id: 'a'.repeat(32), name: '<img src=x onerror=alert(1)>', platform: 'ios',
  active: true, current: false, needsAck: true };
test('device notice and controls are localized, escaped and permission scoped', () => {
  for (const language of ['en', 'ru', 'de', 'uk', 'es']) {
    const full = { data: { ok: true, canManageAll: true, devices: [device] } };
    const native = { data: { ...full.data, canManageAll: false } };
    assert.equal(UI.validList(full.data), true);
    assert.match(UI.card(full, language), /data-action="device-ack"/);
    assert.match(UI.card(full, language), /&lt;img/);
    assert.doesNotMatch(UI.card(full, language), /<img/);
    assert.doesNotMatch(UI.card(native, language), /data-action="device-(ack|revoke|revoke-all)"/);
    assert.match(UI.notice(native, language), /device-review/);
    assert.equal(UI.notice({ data: { ...full.data, devices: [{ ...device, needsAck: false }] } }, language), '');
    assert.match(UI.card({ data: { ...native.data, devices: [{ ...device, current: true }] } }, language), /device-revoke"/);
  }
});
test('malformed list never produces trusted device controls', () => {
  for (const data of [null, {}, {ok:true, devices:[]},
    {ok:true,canManageAll:true,devices:[{...device,id:'"><script>'}]},
    {ok:true,canManageAll:true,devices:[{...device,active:'false'}]}]) assert.equal(Boolean(UI.validList(data)), false);
});
