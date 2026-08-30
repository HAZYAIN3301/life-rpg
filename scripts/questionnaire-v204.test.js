'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const MODULE_PATH = path.join(ROOT, 'public', 'questionnaire-v1.js');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

function functionSource(source, name) {
  const start = source.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.notEqual(start, -1, `missing function ${name}()`);
  const openParen = source.indexOf('(', start);
  let parenDepth = 0;
  let signatureQuote = '';
  let signatureEscaped = false;
  let closeParen = -1;
  for (let i = openParen; i < source.length; i += 1) {
    const char = source[i];
    if (signatureEscaped) { signatureEscaped = false; continue; }
    if (signatureQuote) {
      if (char === '\\') signatureEscaped = true;
      else if (char === signatureQuote) signatureQuote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { signatureQuote = char; continue; }
    if (char === '(') parenDepth += 1;
    else if (char === ')' && --parenDepth === 0) { closeParen = i; break; }
  }
  assert.notEqual(closeParen, -1, `unterminated signature for ${name}()`);
  const brace = source.indexOf('{', closeParen);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const char = source[i];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}()`);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function questionnaireClientRegion() {
  const candidates = ['function questionnaireEngine()', '// ── Questionnaire v1', '// ── Онбординг'];
  const start = candidates.map((marker) => APP.indexOf(marker)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const end = APP.indexOf('\nfunction showAuthScreen()', start);
  assert.ok(Number.isInteger(start) && start >= 0, 'missing questionnaire client region');
  assert.ok(end > start, 'questionnaire client region must end before the auth router');
  return APP.slice(start, end);
}

function moduleApi() {
  assert.ok(fs.existsSync(MODULE_PATH),
    'Questionnaire must have a pure public/questionnaire-v1.js contract before UI wiring');
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

function apiFunction(api, names, purpose) {
  const name = names.find((candidate) => typeof api[candidate] === 'function');
  assert.ok(name, `${purpose}: export one of ${names.join(', ')}`);
  return api[name];
}

function freshDraft(api, overrides = {}) {
  const create = apiFunction(api, ['createDraft', 'defaultDraft', 'freshDraft', 'empty'], 'draft factory');
  const options = {
    sourceLocale: 'ru',
    now: 1_787_968_800_000,
    idFactory: (kind) => `qa-${kind}`,
    ...overrides,
  };
  let draft = create(options);
  // The existing pure modules conventionally accept either an options object or
  // the locale as their only argument. Supporting both keeps this contract about
  // behaviour rather than a cosmetic factory signature.
  if (!draft || draft.sourceLocale !== options.sourceLocale) draft = create(options.sourceLocale);
  return draft;
}

function normalizeDraft(api, value) {
  const normalize = apiFunction(api, ['normalize', 'normalizeDraft'], 'draft normalization');
  return normalize(value);
}

function localeRow(key) {
  const manifestStart = APP.indexOf('const I18N_EXTRA');
  const manifestEnd = APP.indexOf('for (const ru in I18N_EXTRA', manifestStart);
  assert.ok(manifestStart >= 0 && manifestEnd > manifestStart, 'missing bounded I18N_EXTRA manifest');
  const manifest = APP.slice(manifestStart, manifestEnd);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`["']${escaped}["']\\s*:\\s*\\{`).exec(manifest);
  if (!match) return '';
  const brace = manifest.indexOf('{', match.index);
  let depth = 0, quote = '', escapedChar = false;
  for (let i = brace; i < manifest.length; i += 1) {
    const char = manifest[i];
    if (escapedChar) { escapedChar = false; continue; }
    if (quote) {
      if (char === '\\') escapedChar = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return manifest.slice(brace, i + 1);
  }
  return '';
}

test('Questionnaire source asks one consequential question instead of showing a feature wall', () => {
  const onboarding = between(APP, 'function renderOnboardingScreen()', '\nfunction showAuthScreen()');
  const question = 'Что тебе сейчас важнее всего сдвинуть с места?';
  assert.equal(count(onboarding, question), 1,
    'the source screen must contain the main question exactly once');
  assert.match(onboarding, /У меня уже есть план/);
  assert.match(onboarding, /Настроить позже/);
  assert.ok(count(onboarding, '<textarea') >= 1,
    'free text/paste must be the main input channel');
  assert.doesNotMatch(onboarding, /DUNGEON_PROGRAMS|SKILL_GROUPS|prog-grid|ob-groups|ob-canon-hint/,
    'programs, the complete sphere tree and balance coaching do not belong before first value');

  assert.ok(fs.existsSync(MODULE_PATH), 'the questionnaire state must not live only in DOM globals');
  assert.match(INDEX, /questionnaire-v1\.js/);
  assert.match(SW, /questionnaire-v1\.js/);
});

test('Draft normalization preserves the answer and explicit source/review/deferred stages', () => {
  const Q = moduleApi();
  const initial = freshDraft(Q);
  assert.equal(initial.sourceLocale, 'ru');
  assert.ok(initial.draftId, 'draftId is allocated before the first request');
  assert.ok(initial.originAnswerId, 'originAnswerId is allocated before the first request');

  const authored = normalizeDraft(Q, {
    ...initial,
    status: 'draft',
    rawAnswer: 'Выпустить первое видео; сегодня выбрать одну сцену.',
  });
  const afterRenderAndReload = normalizeDraft(Q, JSON.parse(JSON.stringify(authored)));
  assert.equal(afterRenderAndReload.rawAnswer, authored.rawAnswer,
    'render/reload/retry must not turn the controlled textarea back into an empty field');
  assert.equal(afterRenderAndReload.draftId, initial.draftId);
  assert.equal(afterRenderAndReload.originAnswerId, initial.originAnswerId);

  const review = normalizeDraft(Q, { ...afterRenderAndReload, status: 'review' });
  assert.equal(review.status, 'review');
  const deferred = normalizeDraft(Q, { ...afterRenderAndReload, status: 'deferred' });
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.rawAnswer, authored.rawAnswer,
    'Skip is a state transition, not a destructive clear operation');

  const render = between(APP, 'function renderOnboardingScreen()', '\nfunction showAuthScreen()');
  assert.match(render, /questionnaire-answer[\s\S]{0,1400}?q\.rawAnswer/,
    'rerender must repopulate the controlled textarea from the saved draft');
  assert.match(functionSource(APP, 'questionnaireRemember'), /sessionStorage\.setItem/,
    'the pre-commit draft must survive a refresh/SW update in the same account session');
  assert.match(APP, /(?:e|event)\.target\.id\s*===\s*['"]questionnaire-answer['"][\s\S]{0,180}?questionnaireSourceFromDOM\s*\(/,
    'typing must update the draft before any rerender can occur');
});

test('Deferred path uses the same stable owned receipt without inventing domain data', () => {
  const clientDefer = functionSource(APP, 'questionnaireDefer');
  const serverDeferSchema = functionSource(SERVER, 'questionnaireNormalizeDefer');
  const serverDefer = functionSource(SERVER, 'questionnaireDefer');

  assert.match(clientDefer, /fetch\(['"]\/api\/questionnaire\/defer['"]/);
  assert.match(serverDeferSchema, /questionnaireExactKeys\([^\n]+['"]receipt['"]/,
    'defer has an exact server-owned receipt schema');
  assert.match(clientDefer, /\breceipt\s*:/,
    'client Skip must send the receipt the exact server schema accepts');
  assert.doesNotMatch(clientDefer, /\brawAnswer\b/,
    'Skip persists the decision/provenance, not the private draft text');
  assert.match(serverDefer, /seeds:\s*\{\s*goals:\s*\[\],\s*firstSteps:\s*\[\],\s*spheres:\s*\[\]\s*\}/);
  assert.match(serverDefer, /materialized:\s*\{\s*goalIds:\s*\[\],\s*taskIds:\s*\[\],\s*sphereIds:\s*\[\]\s*\}/,
    'defer may unlock the app, but must not fabricate a goal, task or sphere');
});

test('Preview is bounded to one goal, one first step and one to three suggested spheres', () => {
  const Q = moduleApi();
  const draft = freshDraft(Q);
  const many = {
    ...draft,
    stage: 'review', status: 'review',
    seeds: {
      goals: Array.from({ length: 4 }, (_, index) => ({
        localId: `g${index}`, title: `Goal ${index}`, source: 'ai_suggested',
      })),
      firstSteps: Array.from({ length: 5 }, (_, index) => ({
        localId: `q${index}`, title: `Step ${index}`, estimateMin: 15, source: 'ai_suggested',
      })),
      spheres: Array.from({ length: 8 }, (_, index) => ({
        localId: `s${index}`, title: `Sphere ${index}`, role: index ? 'background' : 'primary', source: 'ai_suggested',
      })),
    },
  };
  const bounded = normalizeDraft(Q, many);
  assert.equal(bounded.seeds.goals.length, 1);
  assert.equal(bounded.seeds.firstSteps.length, 1);
  assert.ok(bounded.seeds.spheres.length >= 1 && bounded.seeds.spheres.length <= 3);
  for (const item of [...bounded.seeds.goals, ...bounded.seeds.firstSteps, ...bounded.seeds.spheres]) {
    assert.equal(item.source, 'ai_suggested',
      'normalization must not silently promote a model suggestion to a confirmed fact');
  }
});

test('AI analysis requires explicit send consent and manual fallback remains complete', () => {
  const Q = moduleApi();
  const draft = freshDraft(Q);
  assert.equal(draft.consents.sendRawTextToAiProvider, false);
  const consented = normalizeDraft(Q, {
    ...draft,
    rawAnswer: 'Мой план',
    consents: { ...draft.consents, sendRawTextToAiProvider: true },
  });
  assert.equal(consented.consents.sendRawTextToAiProvider, true);

  const manualPreview = apiFunction(Q, ['manualPreview', 'buildManualPreview', 'createManualPreview', 'manualReview'], 'manual fallback');
  const fields = {
    outcome: 'Выпустить первое видео',
    result: 'Выпустить первое видео',
    why: 'Начать продвижение',
    firstStep: 'Выбрать одну сцену',
    step: 'Выбрать одну сцену',
    sphere: 'Медиа',
    estimateMin: 15,
  };
  const manual = manualPreview.length >= 2
    ? manualPreview(consented, fields)
    : manualPreview({ draft: consented, ...fields });
  const manualDraft = normalizeDraft(Q, manual && (manual.value || manual.draft) ? (manual.value || manual.draft) : manual);
  assert.equal(manualDraft.seeds.goals.length, 1);
  assert.equal(manualDraft.seeds.firstSteps.length, 1);
  assert.equal(manualDraft.seeds.spheres.length, 1);
  assert.equal(manualDraft.seeds.goals[0].source, 'user_explicit');
  assert.equal(manualDraft.seeds.firstSteps[0].source, 'user_explicit');

  const onboarding = between(APP, 'function renderOnboardingScreen()', '\nfunction showAuthScreen()');
  assert.match(onboarding, /Продолжить вручную|Заполнить вручную/);
  assert.match(onboarding, /sendRawTextToAiProvider|questionnaire-ai-consent/,
    'the consent must be a purpose-specific UI choice, not buried in terms');

  const analyzeName = ['questionnaireAnalyze', 'analyzeQuestionnaire', 'obAiRun']
    .find((name) => new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(APP));
  assert.ok(analyzeName, 'missing questionnaire analysis action');
  const analyze = functionSource(APP, analyzeName);
  assert.match(analyze, /sendRawTextToAiProvider|questionnaire-ai-consent/,
    'the network path itself must enforce consent before fetch, not merely render a checkbox');
});

test('Commit payload keeps one stable idempotency key across retry and reload', () => {
  const Q = moduleApi();
  const draft = normalizeDraft(Q, {
    ...freshDraft(Q),
    stage: 'review', status: 'review', rawAnswer: 'Проверяем Retry',
    seeds: {
      goals: [{ localId: 'g1', title: 'Goal', source: 'user_explicit' }],
      firstSteps: [{ localId: 'q1', title: 'Step', estimateMin: 15, goalRef: 'g1', source: 'user_explicit' }],
      spheres: [{ localId: 's1', title: 'Work', role: 'primary', source: 'user_explicit' }],
    },
  });
  const retry = normalizeDraft(Q, JSON.parse(JSON.stringify(draft)));
  assert.equal(typeof draft.idempotencyKey, 'string');
  assert.ok(draft.idempotencyKey.length >= 8);
  assert.equal(retry.idempotencyKey, draft.idempotencyKey,
    'Retry/reload must reuse the original operation identity');
  assert.equal(retry.draftId, draft.draftId);

  const onboardingRegion = questionnaireClientRegion();
  assert.match(onboardingRegion, /idempotencyKey/,
    'the stable operation key must be sent with the atomic commit');
});

test('Client commit shape matches the bounded server schema and never uploads the raw answer', () => {
  const clientCommit = functionSource(APP, 'questionnaireCommit');
  const serverCommitSchema = functionSource(SERVER, 'questionnaireNormalizeCommit');
  const serverReceiptSchema = functionSource(SERVER, 'questionnaireNormalizeReceipt');

  assert.match(serverCommitSchema, /['"]settings['"]/);
  assert.match(clientCommit, /settings\s*:\s*\{\s*skills\s*:/,
    'client must send the 1–3 selected spheres under the server-owned settings preview');
  assert.doesNotMatch(clientCommit, /\breceipt\s*:\s*\{\s*\.\.\./,
    'spreading the full draft leaks fields the exact server schema rejects');
  assert.doesNotMatch(clientCommit, /\brawAnswer\b/,
    'the atomic materialization endpoint stores structured confirmation, not the raw answer');
  for (const field of ['draftId', 'originAnswerId', 'sourceLocale', 'recognitionPhrase', 'source', 'confirmedAt', 'consents']) {
    assert.match(clientCommit, new RegExp(`\\b${field}\\s*:`), `receipt.${field} must be mapped explicitly`);
    assert.match(serverReceiptSchema, new RegExp(`['"]${field}['"]`));
  }
  assert.match(clientCommit, /\bgoal\s*:\s*\{[\s\S]*?\bid\s*:/,
    'local goal IDs must be mapped into the server goal schema');
  assert.match(clientCommit, /\btask\s*:\s*\{[\s\S]*?\bid\s*:/,
    'local first-step IDs must be mapped into the server task schema');
  assert.match(clientCommit, /\bgoalId\s*:/);
  assert.match(clientCommit, /\bdate\s*:/,
    'the first step must materialize on a concrete Today date');
});

test('Client uses one questionnaire commit and never clears an existing account graph', () => {
  assert.match(APP, /fetch\(['"]\/api\/questionnaire\/commit['"]/,
    'confirmed seed must go through the atomic questionnaire endpoint');
  assert.doesNotMatch(APP, /Promise\.all\s*\(\s*entries\.map\s*\(\s*\(\[name, value\]\)/,
    'legacy onboardingSave can partially persist independent files');

  const onboardingRegion = questionnaireClientRegion();
  assert.doesNotMatch(onboardingRegion, /State\.(?:goals|tasks|goalGroups)\s*=\s*\[\]/,
    'questionnaire materialization is additive and cannot reset existing goals/tasks/groups');
  assert.doesNotMatch(onboardingRegion, /State\.settings\s*=\s*freshOnboardingSettings\s*\(\s*\[\s*\]\s*\)/,
    'questionnaire cannot replace a returning user\'s settings with a fresh account');
});

test('Server exposes an owned atomic commit with validation, idempotency and merge semantics', () => {
  const commitMatch = SERVER.match(/function\s+((?:questionnaireCommit|(?:commit|apply)Questionnaire(?:Data|Seed|Transaction)?))\s*\(\s*uid\s*,/i);
  assert.ok(commitMatch,
    'server needs a user-owned questionnaire transaction function');
  assert.match(SERVER, /(?:u|questionnairePath)\s*===\s*['"]\/api\/questionnaire\/commit['"]\s*&&\s*req\.method\s*===\s*['"]POST['"]/);

  const routeAt = SERVER.indexOf('/api/questionnaire/commit');
  assert.notEqual(routeAt, -1);
  const route = SERVER.slice(Math.max(0, routeAt - 1200), routeAt + 4500);
  assert.match(route, /uid/,
    'the route must derive ownership from the authenticated session');
  assert.match(route, /(?:receipt|questionnaire)/i);

  const serverContract = functionSource(SERVER, commitMatch[1]);
  const atomicContract = /questionnaireWriteUnit/.test(serverContract)
    ? `${serverContract}\n${functionSource(SERVER, 'questionnaireWriteUnit')}`
    : serverContract;
  assert.match(`${atomicContract}\n${route}`, /idempotency/i);
  assert.match(atomicContract, /(?:existing|current|previous|readJson|readData|questionnaireLoadDomain)/i,
    'materialization must merge with the owned graph rather than blind-replace it');
  assert.match(atomicContract, /fileSnapshot|snapshot/i);
  assert.match(atomicContract, /restoreSnapshot|rollback/i,
    'a later file failure must restore every earlier questionnaire write');
  assert.doesNotMatch(atomicContract, /(?:goals|tasks)\s*=\s*\[\]/,
    'no empty-array reset is permitted in the questionnaire transaction');
});

test('Source/review/error UI has named progress, explicit choices and the 42px floor', () => {
  const onboarding = between(APP, 'function renderOnboardingScreen()', '\nfunction showAuthScreen()');
  assert.match(onboarding, /aria-busy=/);
  assert.match(onboarding, /role="alert"/);
  assert.match(onboarding, /(?:Шаг 1 из 2|role="progressbar"[^>]+aria-(?:label|valuetext)=)/,
    'progress must have a spoken name, not only a decorative bar');
  assert.match(onboarding, /<(?:fieldset)[^>]*>[\s\S]*?<legend/,
    'consent and review choices need a fieldset/legend relationship');
  assert.match(onboarding, /aria-(?:pressed|checked)=|type="(?:radio|checkbox)"/,
    'custom choices must expose their selected state');
  assert.match(onboarding, /data-(?:questionnaire|ob)-(?:stage|mode)|State\._(?:ob|questionnaire)(?:Stage|Mode|Draft)|\.status/,
    'source/review/deferred needs an inspectable UI state');

  const questionnaireCss = CSS.slice(Math.max(0, CSS.search(/Questionnaire v1|questionnaire/i)));
  assert.ok(questionnaireCss.length > 0, 'questionnaire-specific responsive CSS is missing');
  assert.match(questionnaireCss, /min-(?:height|block-size)\s*:\s*(?:42px|44px|var\(--touch-min(?:,\s*42px)?\))/,
    'interactive questionnaire controls must keep at least the shared 42px floor');
  assert.match(CSS, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    'questionnaire operation state cannot depend on animation');
});

test('Guide readiness is derived from the materialized receipt, exact task and first return', () => {
  const guideContext = functionSource(APP, 'guideV3Context');
  assert.doesNotMatch(guideContext, /questionnaireReady:\s*false|hasGoalSeed:\s*false|returnedAfterFirst:\s*false/,
    'Guide gates must not remain hard-coded after questionnaire materialization');
  assert.match(guideContext, /(?:QuestionnaireV1|questionnaire|guideFlags)/);
  assert.match(guideContext, /materialized/,
    'a typed answer or an AI response alone is not questionnaire readiness');
  assert.match(guideContext, /(?:goalIds|hasGoalSeed)/);
  assert.match(guideContext, /(?:taskIds|firstRealCompletion|selectedTaskId)/,
    'Guide must stay attached to the exact persisted first task');
  assert.match(guideContext, /(?:firstReturnAt|returnedAfterFirst)/,
    'the Goals chapter remains gated until a later real session');
});

test('Every critical questionnaire action ships together in RU/EN/DE/UK/ES', () => {
  const keys = [
    'Что тебе сейчас важнее всего сдвинуть с места?',
    'Какой результат ты хочешь увидеть, почему он важен — и какой небольшой шаг готов сделать уже сегодня?',
    'У меня уже есть план',
    'Настроить позже',
    'Я понял тебя так',
    'Создать и перейти к первому шагу',
    'Продолжить вручную',
  ];
  for (const key of keys) {
    const row = localeRow(key);
    assert.ok(row, `${key}: missing RU source row in the locale manifest`);
    for (const locale of ['en', 'de', 'uk', 'es']) {
      assert.match(row, new RegExp(`\\b${locale}\\s*:`), `${key}: missing ${locale} translation`);
    }
    assert.match(APP, new RegExp(`t\\(\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*\\)`),
      `${key}: authored UI copy must render through t()`);
  }
});
