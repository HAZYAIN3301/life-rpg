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
  assert.match(html, /name="storageMode" value="local"[^>]*checked/);
  assert.match(html, /name="storageMode" value="contracts"/);
  assert.match(html, /Ничего не отправляется в Satoru Cloud/);
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
  assert.doesNotMatch(html, /data-outcome="rested"|data-outcome="unknown"/);
  assert.match(html, /data-action="start-attention-emergency" data-delay="90"/);
  assert.doesNotMatch(html, /XP|золот|стрик|награ/iu);
});

test('rest boundary records rested, one extension, escaped or unknown without changing control safeguards', () => {
  const translated = [];
  const translate = (value) => {
    translated.push(value);
    return value;
  };
  const html = UI.renderBoundary({
    purpose: 'rest', mode: 'control', targetLabel: 'Отдых', sessionId: 'rest-1',
    expectedOutcome: 'Вернуться спокойнее', canExtend: true, extensionMinutes: 7,
    emergencyAvailable: true, emergencyDelaySeconds: 90,
  }, translate);
  assert.match(html, /Граница отдыха/);
  assert.match(html, /Запланированный отдых закончился/);
  assert.match(html, /План отдыха: Вернуться спокойнее/);
  assert.match(html, /data-outcome="rested">Отдых закончен/);
  assert.match(html, /data-action="extend-attention-session" data-minutes="7"/);
  assert.match(html, /data-outcome="escaped">Меня унесло/);
  assert.match(html, /data-outcome="unknown">Не уверен/);
  assert.doesNotMatch(html, /data-outcome="done"/);
  assert.match(html, /data-action="start-attention-emergency" data-delay="90"/);
  for (const key of ['Граница отдыха', 'Запланированный отдых закончился', 'План отдыха', 'Отдых закончен', 'Меня унесло', 'Не уверен']) {
    assert.equal(translated.includes(key), true, `${key} must run through t`);
  }
});

test('recovery is a compact bounded rest launcher, not another daily tracker', () => {
  const html = UI.renderRecovery({ minutes: 40, recoveryLabel: '<Душ>', deviceMode: 'bounded' }, t);
  assert.match(html, /id="attention-recovery-form"/);
  assert.match(html, /class="attention-flow attention-recovery attention-recovery-compact"/);
  assert.match(html, /data-minutes-min="5" data-minutes-max="180"/);
  assert.match(html, /Отдых с границей/);
  assert.match(html, /name="recoveryLabel"[^>]*value="&lt;Душ&gt;"/);
  for (const minutes of [10, 20, 40]) assert.match(html, new RegExp(`name="minutes" value="${minutes}"`));
  assert.match(html, /name="minutes" value="40" checked/);
  for (const mode of ['none', 'bounded', 'open']) assert.match(html, new RegExp(`name="deviceMode" value="${mode}"`));
  assert.match(html, /name="deviceMode" value="bounded" checked/);
  assert.match(html, /не ежедневный трекер/);
  assert.match(html, /PWA покажет границу, пока Satoru открыт/);
  assert.match(html, /поставь системный таймер/);
  assert.match(html, /type="submit"[^>]*data-action="start-recovery-session"/);
  assert.match(html, /data-action="close-attention-dialog">Отмена/);
});

test('recovery rejects unbounded presentation values and keeps a safe default', () => {
  const html = UI.renderRecovery({ minutes: 999, deviceMode: 'anything' }, t);
  assert.match(html, /name="minutes" value="20" checked/);
  assert.match(html, /name="deviceMode" value="none" checked/);
  assert.doesNotMatch(html, /value="999"/);
});

test('evening setup configures time and reminder without asking for permission', () => {
  const html = UI.renderEvening({ targetTime: '22:30', dailyReminder: true }, t);
  assert.match(html, /id="attention-evening-form"/);
  assert.match(html, /Настроить завершение вечера/);
  assert.match(html, /name="targetTime" value="22:30"/);
  assert.match(html, /type="checkbox" name="dailyReminder" checked/);
  assert.match(html, /Голос и диалог работают, только пока Satoru открыт/);
  assert.match(html, /только если разрешение уже выдано/);
  assert.doesNotMatch(html, /requestPermission/);
  assert.match(html, /type="submit"[^>]*data-action="start-evening-session"/);
  assert.match(html, /data-action="close-attention-dialog">Отмена/);
});

test('active evening landing has exactly three steps and no progress tracker', () => {
  const html = UI.renderEvening({ active: true }, t);
  assert.doesNotMatch(html, /id="attention-evening-form"|name="dailyReminder"|name="targetTime"/);
  assert.match(html, /Закрыть работу/);
  assert.match(html, /Вернуть базовый порядок/);
  assert.match(html, /Поставить будильник и убрать устройства/);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.match(html, /не означает, что ты уже лёг спать или восстановился/);
  assert.match(html, /data-action="finish-evening-landing">Вечер завершён/);
  assert.match(html, /data-action="close-attention-dialog">Закрыть/);
  assert.doesNotMatch(html, /type="checkbox"|data-step-complete|progress/);
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
  const adapterStart = app.indexOf('//  Attention R1 —');
  const adapterEnd = app.indexOf('function renderSettings()', adapterStart);
  let adapter = app.slice(adapterStart, adapterEnd);
  // Actionable v216 keeps its locale catalog beside its own adapter. Translation
  // values are not new source keys, so exclude the catalog/helper from this R1
  // check while continuing to inspect every visible Attention adapter literal.
  const actionableCatalog = adapter.indexOf('const ACTIONABLE_COPY =');
  const actionableRuntime = adapter.indexOf('function actionableSettingsUI()', actionableCatalog);
  if (actionableCatalog >= 0 && actionableRuntime > actionableCatalog) {
    adapter = adapter.slice(0, actionableCatalog) + adapter.slice(actionableRuntime);
  }
  const visibleKeys = new Set([...adapter.matchAll(/'([^'\n]*[\u0400-\u04ff][^'\n]*)'/g)].map((match) => match[1]));
  const localeKeys = new Set(rows.map(([, rawKey]) => rawKey.replace(/\\'/g, "'")));
  for (const key of visibleKeys) {
    assert.equal(localeKeys.has(key) || app.includes(`'${key}':`), true, `Attention adapter string is not localized: ${key}`);
  }
});
