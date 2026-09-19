'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Player = require('../public/inspiration-player-v1.js');
const Media = require('../public/inspiration-media-v1.js');

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {};
    this.isConnected = true; this.contentWindow = {}; this.classes = new Set();
    this.classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value) };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'src') this.src = ''; }
  appendChild(child) { child.parent = this; this.children.push(child); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) { return this.children.find(child => selector === '[data-media-status]' && Object.hasOwn(child.attributes, 'data-media-status')) || null; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  focus() { this.focused = true; }
}
const TIKTOK = 'https://www.tiktok.com/@example/video/7647936071673629973';
function harness() {
  const listeners = {}, timers = new Map(); let timerId = 0;
  const window = { addEventListener(name, handler) { (listeners[name] ||= new Set()).add(handler); },
    removeEventListener(name, handler) { listeners[name]?.delete(handler); } };
  const document = { createElement: tag => new Element(tag) };
  const controller = Player.createController({ document, window,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) });
  const host = new Element('div'), opener = new Element('button');
  const item = { title: 'An edit', sourceUrl: TIKTOK, embedUrl: Media.buildEmbed(TIKTOK) };
  function open(options = {}) { return controller.open({ host, opener, item, ...options }); }
  function layer() { return host.children.find(node => node.className?.startsWith('inspiration-embed')); }
  function event(type, value, extra = {}) {
    const message = { origin: Media.TIKTOK_ORIGIN, source: layer()?.children[0].contentWindow,
      data: { 'x-tiktok-player': true, type, value }, ...extra };
    for (const listener of [...(listeners.message || [])]) listener(message);
  }
  return { controller, host, opener, item, open, layer, event, timers, listeners };
}
test('viewer creates no frame until explicit open, uses exact safe params and focuses close', () => {
  const h = harness(); assert.equal(h.layer(), undefined);
  assert.equal(h.open(), true);
  const [frame, close] = h.layer().children;
  assert.equal(frame.src, Media.buildEmbed(TIKTOK)); assert.equal(close.focused, true);
  assert.match(frame.src, /autoplay=0/); assert.match(frame.src, /loop=0/);
  assert.doesNotMatch(frame.attributes.sandbox, /top-navigation|popups/);
  assert.equal(h.host.classes.has('has-player'), true);
});
test('wrong source embed and unavailable catalog cannot open', () => {
  const h = harness();
  assert.equal(h.open({ item: { ...h.item, sourceUrl: 'https://www.tiktok.com/@example/video/7647936071673629974' } }), false);
  assert.equal(h.open({ item: { ...h.item, supplyUnavailable: true } }), false);
  assert.equal(h.layer(), undefined);
});
test('spoofed origin or frame cannot clear loading or close a player', () => {
  const h = harness(); h.open(); const frame = h.layer().children[0];
  h.event('onPlayerReady', undefined, { origin: 'https://evil.invalid' });
  h.event('onStateChange', 0, { source: {} });
  assert.equal(h.layer().children[0], frame); assert.equal(h.timers.size, 1);
  h.event('onPlayerReady'); assert.equal(h.timers.size, 0);
  assert.equal(h.host.querySelector('[data-media-status]').textContent, '');
});
for (const end of ['ended', 'error', 'timeout']) test(`${end} immediately removes the frame/listeners and restores focus without an owner write`, () => {
  const h = harness(); h.open(); const frame = h.layer().children[0];
  if (end === 'ended') h.event('onStateChange', 0);
  if (end === 'error') h.event('onPlayerError', { errorCode: 1001 });
  if (end === 'timeout') [...h.timers.values()][0]();
  assert.equal(h.layer(), undefined); assert.equal(frame.src, '');
  assert.equal(h.listeners.message.size, 0); assert.equal(h.listeners.keydown.size, 0);
  assert.equal(h.timers.size, 0); assert.equal(h.opener.focused, true);
  assert.equal(h.host.classes.has('has-player'), false);
  assert.match(h.host.querySelector('[data-media-status]').textContent, end === 'ended' ? /закончился/ : /не открылся/);
});
test('one player at a time; messages from the old frame cannot control the new one', () => {
  const h = harness(); h.open(); const oldFrame = h.layer().children[0];
  h.open(); const newFrame = h.layer().children[0];
  assert.notEqual(oldFrame, newFrame); assert.equal(oldFrame.src, ''); assert.equal(h.listeners.message.size, 1);
  h.event('onStateChange', 0, { source: oldFrame.contentWindow }); assert.equal(h.layer().children[0], newFrame);
  h.controller.close({ restoreFocus: false }); assert.equal(h.layer(), undefined); assert.notEqual(h.opener.focused, true);
});
test('navigation DOM replacement disposes player and Escape restores focus', () => {
  const h = harness(); h.open(); h.host.isConnected = false; h.controller.sync();
  assert.equal(h.layer(), undefined); assert.equal(h.listeners.message.size, 0);
  h.host.isConnected = true; h.open(); let prevented = false;
  [...h.listeners.keydown][0]({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(h.layer(), undefined); assert.equal(prevented, true); assert.equal(h.opener.focused, true);
});
test('TikTok iframe load alone is not ready or playback and cannot evade timeout', () => {
  const h = harness(); h.open(); h.layer().children[0].listeners.load();
  assert.equal(h.timers.size, 1); assert.match(h.host.querySelector('[data-media-status]').textContent, /Загрузка/);
});
test('Pinterest stays explicit and accepts only the selected single pin', () => {
  const h = harness(), url = 'https://www.pinterest.com/pin/974818281863152085/';
  h.open({ item: { title: 'Pin', sourceUrl: url, embedUrl: Media.buildEmbed(url) } });
  assert.match(h.layer().className, /is-pinterest/); assert.equal(h.timers.size, 1);
  h.layer().children[0].listeners.load(); assert.equal(h.timers.size, 0);
  h.controller.close(); assert.equal(h.layer(), undefined);
});
