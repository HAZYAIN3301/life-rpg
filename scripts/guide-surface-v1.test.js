'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'public', 'guide-surface-v1.js');
const SOURCE = fs.readFileSync(FILE, 'utf8');

class FakeClassList {
  constructor(owner) { this.owner = owner; }
  values() { return new Set(String(this.owner.className || '').split(/\s+/).filter(Boolean)); }
  write(values) { this.owner.className = [...values].join(' '); }
  add(...names) { const values = this.values(); names.forEach((name) => values.add(name)); this.write(values); }
  remove(...names) { const values = this.values(); names.forEach((name) => values.delete(name)); this.write(values); }
  contains(name) { return this.values().has(name); }
  toggle(name, force) {
    const values = this.values();
    const on = force === undefined ? !values.has(name) : Boolean(force);
    if (on) values.add(name); else values.delete(name);
    this.write(values); return on;
  }
}

class FakeElement {
  constructor(tag, document) {
    this.tagName = String(tag).toUpperCase(); this.ownerDocument = document; this.nodeType = 1;
    this.children = []; this.childNodes = this.children; this.parentNode = null;
    this.dataset = {}; this.style = {}; this.attributes = new Map(); this.className = '';
    this.classList = new FakeClassList(this); this.id = ''; this.hidden = false; this.disabled = false;
    this.textContent = ''; this.type = ''; this._rect = { left: 0, top: 0, width: 0, height: 0 };
  }
  get isConnected() { let node = this; while (node) { if (node === this.ownerDocument.body) return true; node = node.parentNode; } return false; }
  get firstChild() { return this.children[0] || null; }
  appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  replaceChildren(...children) { this.children.slice().forEach((child) => this.removeChild(child)); children.forEach((child) => this.appendChild(child)); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  querySelector(selector) {
    if (selector === 'button:not(:disabled)') return find(this, (node) => node !== this && node.tagName === 'BUTTON' && !node.disabled);
    return null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  getBoundingClientRect() { return { ...this._rect, right: this._rect.left + this._rect.width, bottom: this._rect.top + this._rect.height }; }
  focus() { this.ownerDocument.activeElement = this; this.focused = true; }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map(); this.targets = new Map();
    this.body = new FakeElement('body', this); this.activeElement = this.body;
  }
  createElement(tag) { return new FakeElement(tag, this); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { if (this.listeners.has(type)) this.listeners.get(type).delete(fn); }
  dispatch(type, event) { for (const fn of this.listeners.get(type) || []) fn(event); }
  querySelector(selector) {
    const value = this.targets.get(selector);
    return Array.isArray(value) ? value[0] || null : value || null;
  }
  querySelectorAll(selector) {
    const value = this.targets.get(selector);
    return Array.isArray(value) ? value.slice() : value ? [value] : [];
  }
  getElementById(id) { return find(this.body, (node) => node.id === id); }
}

class FakeWindowEvents {
  constructor() { this.listeners = new Map(); this.frames = new Map(); this.nextFrame = 1; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { if (this.listeners.has(type)) this.listeners.get(type).delete(fn); }
  dispatch(type) { for (const fn of this.listeners.get(type) || []) fn({ type }); }
  requestAnimationFrame(fn) { const id = this.nextFrame++; this.frames.set(id, fn); return id; }
  cancelAnimationFrame(id) { this.frames.delete(id); }
  flushFrames() { const jobs = [...this.frames.values()]; this.frames.clear(); jobs.forEach((job) => job()); }
}

function find(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children || []) { const match = find(child, predicate); if (match) return match; }
  return null;
}

function count(node, predicate) {
  if (!node) return 0;
  return (predicate(node) ? 1 : 0) + (node.children || []).reduce((sum, child) => sum + count(child, predicate), 0);
}

test('source stays a DOM-only UMD adapter with no art or unsafe HTML path', () => {
  assert.match(SOURCE, /root\.GuideSurfaceV1 = api/);
  assert.match(SOURCE, /Object\.freeze\(\{ VERSION, SURFACE_ID, paint, close \}\)/);
  for (const forbidden of [
    'State.', 'Store.', 'fetch(', 'innerHTML', 'insertAdjacentHTML', '.inert',
    'aria-modal', 'role="dialog"', 'ShadowRig', 'shadowVideo', '<img',
  ]) assert.equal(SOURCE.includes(forbidden), false, `forbidden surface dependency: ${forbidden}`);
  assert.match(SOURCE, /addEventListener\('resize', scheduleReposition\)/);
  assert.match(SOURCE, /addEventListener\('scroll', scheduleReposition, true\)/);
  assert.match(SOURCE, /event\.key !== 'Escape'/);
});

test('paint is safe, singular and non-modal; missing target falls back and Esc restores focus', (t) => {
  const doc = new FakeDocument();
  const events = new FakeWindowEvents();
  const previous = {
    document: global.document,
    addEventListener: global.addEventListener,
    removeEventListener: global.removeEventListener,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  };
  global.document = doc;
  global.addEventListener = events.addEventListener.bind(events);
  global.removeEventListener = events.removeEventListener.bind(events);
  global.requestAnimationFrame = events.requestAnimationFrame.bind(events);
  global.cancelAnimationFrame = events.cancelAnimationFrame.bind(events);
  const modulePath = require.resolve('../public/guide-surface-v1.js');
  delete require.cache[modulePath];
  const surfaceApi = require(modulePath);
  t.after(() => {
    surfaceApi.close({ restoreFocus: false });
    delete require.cache[modulePath];
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  });

  const opener = doc.createElement('button'); doc.body.appendChild(opener); opener.focus();
  const hiddenTarget = doc.createElement('button'); doc.body.appendChild(hiddenTarget);
  const target = doc.createElement('button'); target._rect = { left: 100, top: 200, width: 50, height: 40 }; doc.body.appendChild(target);
  target.setAttribute('aria-describedby', 'existing-description');
  doc.targets.set('#real-quest', [hiddenTarget, target]);
  let escaped = 0;
  const hostile = '<img src=x onerror=alert(1)>';
  const root = surfaceApi.paint({
    surfaceLabel: 'Guide', chapterId: 'first', stepId: 'choose', chapterLabel: hostile,
    title: hostile, progress: { current: 2, total: 5 }, transcript: hostile, visualLabel: hostile,
    targetSelector: '#real-quest', spotlightLabel: 'Current Guide target', returnFocus: opener,
    actions: [{ action: 'guide-next', id: 'q" onclick="bad', label: hostile, ariaLabel: hostile }],
    choices: [{ id: 'one', label: hostile, description: hostile, noI18n: true }],
    onEscape: () => { escaped += 1; },
  });

  assert.equal(surfaceApi.VERSION, '1.2.0');
  assert.equal(root.style.position, 'fixed');
  assert.equal(root.getAttribute('role'), 'region');
  assert.equal(root.getAttribute('aria-modal'), null);
  assert.equal(doc.body.inert, undefined);
  assert.equal(count(doc.body, (node) => node.id === surfaceApi.SURFACE_ID), 1);
  assert.equal(root.classList.contains('guide-safe-bubble'), false);
  assert.equal(root.dataset.guideFallback, 'spotlight');

  const transcript = find(root, (node) => node.classList.contains('guide-surface-v1__transcript'));
  const title = find(root, (node) => node.classList.contains('guide-surface-v1__title'));
  const action = find(root, (node) => node.dataset.action === 'guide-next');
  const choice = find(root, (node) => node.dataset.action === 'guide-choice');
  const ring = find(root, (node) => node.classList.contains('guide-surface-v1__spotlight'));
  const spotlightLabel = find(root, (node) => node.id === 'guide-surface-v1-spotlight-label');
  assert.equal(transcript.getAttribute('role'), 'status');
  assert.equal(transcript.getAttribute('data-noi18n'), '');
  assert.equal(transcript.textContent, hostile, 'copy is text, never parsed markup');
  assert.equal(title.textContent, hostile, 'episode title is also inserted as text');
  assert.equal(action.textContent, hostile);
  assert.equal(doc.activeElement, action, 'a new step places keyboard focus on its primary action');
  assert.equal(action.dataset.id, 'q" onclick="bad');
  assert.equal(choice.dataset.id, 'one');
  assert.equal(choice.getAttribute('data-noi18n'), '', 'user task names stay outside dynamic translation');
  assert.deepEqual([ring.style.left, ring.style.top, ring.style.width, ring.style.height], ['92px', '192px', '66px', '56px']);
  assert.equal(spotlightLabel.textContent, 'Current Guide target');
  assert.equal(hiddenTarget.getAttribute('aria-describedby'), null, 'a hidden responsive duplicate is ignored');
  assert.equal(target.getAttribute('aria-describedby'), 'existing-description guide-surface-v1-spotlight-label');

  const modal = doc.createElement('section');
  modal.setAttribute('role', 'dialog');
  const modalTarget = doc.createElement('button');
  modalTarget._rect = { left: 700, top: 600, width: 120, height: 44 };
  modal.appendChild(modalTarget); doc.body.appendChild(modal);
  doc.targets.set('#modal-target', modalTarget);
  surfaceApi.paint({ chapterLabel: 'Modal target', transcript: 'Save it', targetSelector: '#modal-target', spotlightLabel: 'Current Guide target' });
  assert.equal(root.classList.contains('guide-target-in-modal'), true, 'Guide bubble yields to a real modal');
  assert.equal(find(root, (node) => node.classList.contains('guide-surface-v1__bubble')).getAttribute('aria-hidden'), 'true');

  surfaceApi.paint({ chapterLabel: 'Page target', transcript: 'Continue', targetSelector: '#real-quest', spotlightLabel: 'Current Guide target' });
  assert.equal(root.classList.contains('guide-target-in-modal'), false);
  assert.equal(find(root, (node) => node.classList.contains('guide-surface-v1__bubble')).getAttribute('aria-hidden'), null);

  hiddenTarget._rect = { left: 20, top: 700, width: 80, height: 44 };
  target._rect = { left: 0, top: 0, width: 0, height: 0 };
  events.dispatch('resize'); events.flushFrames();
  assert.deepEqual([ring.style.left, ring.style.top, ring.style.width, ring.style.height], ['12px', '692px', '96px', '60px']);
  assert.equal(target.getAttribute('aria-describedby'), 'existing-description', 'retarget restores the prior description');
  assert.equal(hiddenTarget.getAttribute('aria-describedby'), 'guide-surface-v1-spotlight-label');

  surfaceApi.paint({ chapterLabel: 'Again', transcript: 'Again', targetSelector: '#real-quest' });
  assert.equal(count(doc.body, (node) => node.id === surfaceApi.SURFACE_ID), 1, 'paint reuses one fixed surface');

  doc.targets.delete('#real-quest');
  events.dispatch('resize'); events.flushFrames();
  assert.equal(root.classList.contains('guide-safe-bubble'), true);
  assert.equal(root.dataset.guideFallback, 'safe-bubble');
  assert.equal(ring.hidden, true);
  assert.equal(hiddenTarget.getAttribute('aria-describedby'), null, 'fallback removes its temporary target description');

  // Restore a callback-bearing model, then close it through the keyboard path.
  surfaceApi.paint({ transcript: 'Close', onEscape: () => { escaped += 1; }, returnFocus: opener });
  let prevented = false;
  doc.dispatch('keydown', { key: 'Escape', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(escaped, 1);
  assert.equal(doc.getElementById(surfaceApi.SURFACE_ID), null);
  assert.equal(doc.activeElement, opener);
});
