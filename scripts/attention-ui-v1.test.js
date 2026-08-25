'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../public/attention-ui-v1.js');

const t = (value) => value;

test('setup is one bounded rule with persistent labels and explicit modes', () => {
  const html = UI.renderSetup({ targetLabel: '<TikTok>', purpose: 'publish', mode: 'control', minutes: 10 }, t);
  assert.match(html, /id="attention-setup-form"/);
  assert.match(html, /name="targetLabel"/);
  assert.match(html, /name="purpose"/);
  assert.match(html, /value="publish" selected/);
  assert.match(html, /value="research"/);
  assert.match(html, /name="outcomeHint"/);
  assert.match(html, /name="mode" value="trust"/);
  assert.match(html, /name="mode" value="adaptive"/);
  assert.match(html, /name="mode" value="control"[^>]*checked/);
  assert.match(html, /Одно приложение, одна цель, одна граница/);
  assert.doesNotMatch(html, /<TikTok>/);
  assert.match(html, /&lt;TikTok&gt;/);
});

test('empty setup uses examples instead of saveable fake values', () => {
  const html = UI.renderSetup({}, t);
  assert.match(html, /name="targetLabel"[^>]*value=""[^>]*placeholder="Например: TikTok"/);
  assert.match(html, /name="purpose"/);
  assert.doesNotMatch(html, /value="Приложение или сайт"/);
});

test('entry shows honest calibration denominator and never invents it below five records', () => {
  const base = {
    policyId: 'p1', targetLabel: 'TikTok',
    purposes: [{ id: 'publish', label: 'Опубликовать', minutes: 12, outcomeHint: 'Ролик опубликован' }],
  };
  const hidden = UI.renderEntry({ ...base, calibration: { recorded: 4, started: 8, outsidePlan: 3 } }, t);
  assert.doesNotMatch(hidden, /записанных заходов закончились вне плана/);
  const visible = UI.renderEntry({ ...base, calibration: { recorded: 5, started: 8, outsidePlan: 4, label: 'Публикация' } }, t);
  assert.match(visible, /4 из 5 записанных заходов закончились вне плана/);
  assert.match(visible, /5 записано из 8/);
  assert.match(visible, /data-action="start-attention-session"/);
});

test('research entry asks for a bounded topic while other purposes keep it hidden', () => {
  const research = UI.renderEntry({ policyId: 'p1', targetLabel: 'TikTok', purposes: [{ id: 'research', label: 'Референсы', minutes: 10, selected: true }] }, t);
  assert.match(research, /data-attention-topic[^>]*>\s*<span>Тема поиска/);
  assert.match(research, /name="topic"[^>]*maxlength="80"[^>]*required/);
  const publish = UI.renderEntry({ policyId: 'p1', targetLabel: 'TikTok', purposes: [{ id: 'publish', label: 'Публикация', minutes: 10, selected: true }] }, t);
  assert.match(publish, /data-attention-topic hidden/);
});

test('boundary provides done, bounded extension, escape and delayed emergency without rewards', () => {
  const html = UI.renderBoundary({
    mode: 'control', targetLabel: 'TikTok', sessionId: 's1', expectedOutcome: 'Ролик опубликован',
    canExtend: true, extensionMinutes: 5, emergencyAvailable: true, emergencyDelaySeconds: 90,
  }, t);
  assert.match(html, /data-outcome="done"/);
  assert.match(html, /data-action="extend-attention-session" data-minutes="5"/);
  assert.match(html, /data-outcome="escaped"/);
  assert.match(html, /data-action="start-attention-emergency" data-delay="90"/);
  assert.doesNotMatch(html, /XP|золот|стрик|награ/iu);
});

test('return is one next action plus care and rest, never a debt wall', () => {
  const html = UI.renderReturn({ actionId: 'q1', actionLabel: 'Открыть план статьи', actionMinutes: 10 }, t);
  assert.match(html, /День не является долгом/);
  assert.match(html, /data-action="start-attention-return"/);
  assert.match(html, /data-action="attention-care-first"/);
  assert.match(html, /Сегодня отдых/);
  assert.doesNotMatch(html, /Просроченные задачи|Нужно наверстать|Компенсировать день/iu);
});

test('load failure is explicit recovery, not an empty policy list', () => {
  const html = UI.renderLoadError({ error: 'invalid' }, t);
  assert.match(html, /role="alert"/);
  assert.match(html, /Данные внимания повреждены/);
  assert.match(html, /не пустой список/);
  assert.match(html, /data-action="retry-attention-load"/);
});

test('the Attention R1 locale block is complete and introduces no duplicate keys', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = app.indexOf('// ── Attention R1:');
  const end = app.indexOf('// ── v164', start);
  assert.ok(start >= 0 && end > start, 'Attention locale block must stay bounded');
  const block = app.slice(start, end);
  const rows = [...block.matchAll(/^\s*'((?:\\.|[^'])+)':\s*\{([^}]+)\},?$/gm)];
  assert.ok(rows.length >= 45, `expected a complete locale set, found ${rows.length}`);
  for (const [, rawKey, values] of rows) {
    const key = rawKey.replace(/\\'/g, "'");
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(values, new RegExp(`\\b${locale}:\\s*'`), `${key}: missing ${locale}`);
    const encoded = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((app.match(new RegExp(`^\\s*'${encoded}':`, 'gm')) || []).length, 1, `${key}: duplicate translation key`);
  }
});
