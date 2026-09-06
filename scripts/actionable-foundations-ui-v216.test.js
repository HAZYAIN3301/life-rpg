'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const UI = require('../public/actionable-settings-ui-v1.js');
const FVUI = require('../public/first-value-ui-v1.js');
const F = require('../public/first-value-v1.js');

const telemetry = {
  purposes: [
    { id:'service_operation', label:'Работа', description:'Сбои', essential:true, defaultOn:true, retentionDays:30, whyNotOptional:'Нужно для ремонта' },
    { id:'product_improvement', label:'Польза', description:'Стало ли лучше', essential:false, defaultOn:true, retentionDays:180 },
    { id:'experimentation', label:'Опыты', description:'Варианты', essential:false, defaultOn:false, retentionDays:180 },
  ],
  consent: { purposes:{ service_operation:true, product_improvement:true, experimentation:false }, history:[] },
};

test('телеметрия показывает четыре состояния и не рисует toggle для essential', () => {
  const out = UI.renderTelemetry(telemetry, {});
  assert.match(out, /Всегда включено/);
  assert.match(out, /Включено по умолчанию — можно выключить/);
  assert.match(out, /Выключено вами/);
  assert.equal((out.match(/data-action="telemetry-consent-toggle"/g) || []).length, 2);
  assert.match(out, /30/); assert.match(out, /180/); assert.match(out, /Нужно для ремонта/);
  const chosen = structuredClone(telemetry); chosen.consent.history.push({ purpose:'product_improvement', granted:true });
  assert.match(UI.renderTelemetry(chosen, {}), /Включено вами/);
});

test('память показывает origin/usage и оставляет dismissed видимой', () => {
  const out = UI.renderMemory({ partial:false, entries:[{ id:'m1', text:'Утром легче', origin:'Вы сказали это сами (form)', usage:'Используется в: planning.', status:'dismissed' }] }, {});
  assert.match(out, /Утром легче/); assert.match(out, /Вы сказали это сами/); assert.match(out, /Используется в/);
  assert.match(out, /ai-memory-restore/); assert.ok(!out.includes('ai-memory-dismiss'));
});

test('partial блокирует любые мутации памяти, но показывает записи', () => {
  const out = UI.renderMemory({ partial:true, entries:[{ id:'m1', text:'Живое', origin:'Источник', usage:'Не используется', status:'active' }] }, {});
  assert.match(out, /Часть памяти не читается/); assert.match(out, /Живое/);
  assert.match(out, /data-action="ai-memory-edit"[^>]*disabled/);
  assert.match(out, /data-action="ai-memory-delete"[^>]*disabled/);
});

test('first-value UI держит ровно одну primary action', () => {
  let j = F.createJourney({ userId:'u', startedAt:'2026-09-01T10:00:00.000Z', profile:{} });
  j = F.transitionJourney(j, { id:'r', type:'route_chosen', route:'do_now', at:'2026-09-01T10:00:01.000Z' });
  j = F.transitionJourney(j, { id:'a', type:'action_ready', entityType:'quest', entityId:'q1', at:'2026-09-01T10:00:02.000Z' });
  const out = FVUI.renderCard(F.deriveJourneyView(j), { references:{ 'quest:q1':{ title:'Шаг' } } });
  assert.equal((out.match(/first-value-card__primary/g) || []).length, 1);
});

test('браузер подключает только пользовательские модули, governance остаётся серверным инструментом', () => {
  for (const name of ['first-value-v1.js','first-value-ui-v1.js','ai-memory-policy-v1.js','telemetry-consent-v1.js','actionable-settings-ui-v1.js']) {
    assert.match(html, new RegExp(`<script src="${name.replaceAll('.', '\\.')}`));
    assert.ok(sw.includes(`'${name}'`));
  }
  assert.ok(!html.includes('src="gamification-governance-v1.js'));
  assert.ok(!sw.includes("'gamification-governance-v1.js'"));
});

test('праздник first-value стоит после durable domain writes', () => {
  const completion = app.slice(app.indexOf('async function completeTask('), app.indexOf('function taskCompletionFocusPlan('));
  assert.ok(completion.indexOf("Store.saveNow('tasks'") < completion.indexOf("outcomeType: 'quest_completed'"));
  const recovery = app.slice(app.indexOf('async function startRecoverySession('), app.indexOf('async function saveEveningSetup('));
  assert.ok(recovery.indexOf('AttentionStore.save(bundle)') < recovery.indexOf("outcomeType: 'recovery_boundary_started'"));
  const questionnaire = app.slice(app.indexOf('async function questionnaireCommit('), app.indexOf('async function questionnaireDefer('));
  assert.ok(questionnaire.indexOf("fetch('/api/questionnaire/commit'") < questionnaire.indexOf("outcomeType: 'real_plan_created'"));
});

test('старые аккаунты не enrol автоматически, новые получают путь до questionnaire write', () => {
  assert.match(app, /response\.status === 404\) \{ State\.firstValue = null/);
  const q = app.slice(app.indexOf('async function questionnaireCommit('), app.indexOf('async function questionnaireDefer('));
  assert.ok(q.indexOf('ensureOnboardingFirstValueJourney') < q.indexOf("fetch('/api/questionnaire/commit'"));
});

test('сервер требует честный source согласия и хранит аналитику по purpose', () => {
  assert.match(server, /invalid_consent_source/);
  assert.match(server, /byPurpose/);
  assert.match(server, /purposeRetention/);
});

test('generic profile PUT перечитывает память прямо перед записью', () => {
  const block = server.slice(server.indexOf("if (name === 'profile' && fs.existsSync(file))"), server.indexOf('fs.mkdirSync(dir', server.indexOf("if (name === 'profile' && fs.existsSync(file))")));
  assert.match(block, /readFileSync\(file/); assert.match(block, /entries: currentStore\.entries/);
});

test('release pins обновлены согласованно', () => {
  assert.match(sw, /const CACHE = 'satoru-v244'/);
  assert.match(html, /app\.js\?v=20260906-attention-commitment-v244-1/);
  assert.match(html, /styles\.css\?v=20260906-attention-commitment-v244-1/);
});

test('zero-memory handoff ведёт к актуальным источникам и гасит старый task brief', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const start = fs.readFileSync(path.join(root, 'START-HERE.md'), 'utf8');
  const status = fs.readFileSync(path.join(root, 'STATUS-AND-PLAN.md'), 'utf8');
  const handoff = fs.readFileSync(path.join(root, 'ACTIONABLE-GAMIFICATION-CLAUDE-HANDOFF.md'), 'utf8');
  const release = fs.readFileSync(path.join(root, 'ACTIONABLE-FOUNDATIONS-UI-V216.md'), 'utf8');
  const backlog = fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8');
  for (const name of ['START-HERE.md', 'AGENTS-PROTOCOL.md', 'DEVLOG.md', 'BACKLOG.md']) {
    assert.ok(readme.includes(name), `README должен вести к ${name}`);
  }
  assert.match(start, /Актуальный handoff — 2026-09-06/);
  assert.match(status, /НЕ текущий master-документ/);
  assert.match(handoff, /ЗАКРЫТО \/ ИСТОРИЧЕСКИЙ TASK BRIEF/);
  assert.match(release, /выпущено и проверено в production/);
  assert.match(release, /8f2c510a53e14d90d1c90bace9728da803ea5ac5/);
  assert.ok(!backlog.includes('[~] **Parallel foundations:**'));
});
