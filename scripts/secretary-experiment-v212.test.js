'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

const EXPERIMENT_FUNCTIONS = Object.freeze([
  'secretaryExperimentState',
  'secretaryExperimentDay',
  'startSecretaryExperiment',
  'endSecretaryExperiment',
  'recordSecretaryExperimentOffer',
  'secretaryMorningRecoveryOffer',
  'secretaryExperimentFeedbackDue',
  'saveSecretaryExperimentFeedback',
  'secretaryExperimentMetrics',
  'secretaryExperimentReviewDue',
  'secretaryExperimentReviewHTML',
  'secretaryExperimentOfferHTML',
]);

function functionSource(name) {
  const token = `function ${name}(`;
  const start = APP.indexOf(token);
  assert.notEqual(start, -1, `missing ${name}()`);
  const next = APP.indexOf('\nfunction ', start + token.length);
  return APP.slice(start, next === -1 ? APP.length : next);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertLocaleRow(key) {
  const encoded = escapeRegExp(key);
  const rows = APP.match(new RegExp(
    `^\\s*'${encoded}':\\s*\\{[^\\n]*en:\\s*'[^']+'[^\\n]*de:\\s*'[^']+'[^\\n]*uk:\\s*'[^']+'[^\\n]*es:\\s*'[^']+'`,
    'gm',
  )) || [];
  assert.equal(rows.length, 1, `${key}: missing, duplicate, or incomplete EN/DE/UK/ES row`);
}

function cssBlocks(selector) {
  const escaped = escapeRegExp(selector);
  return [...CSS.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1]);
}

test('the personal experiment persists one explicit inclusive 30-day interval', () => {
  assert.match(APP, /const SECRETARY_EXPERIMENT_DAYS\s*=\s*30\s*;/);

  const state = functionSource('secretaryExperimentState');
  assert.match(state, /State\.settings/);
  const fromSettings = functionSource('secretaryExperimentFromSettings');
  assert.match(fromSettings, /secretary/);
  assert.match(fromSettings, /experimentV1/,
    'the experiment belongs to the existing Secretary settings envelope, not a new store');
  for (const field of ['startedOn', 'endsOn', 'checkIns', 'profileSnapshot', 'refs']) assert.match(fromSettings, new RegExp(field));

  const start = functionSource('startSecretaryExperiment');
  assert.match(start, /\bstartedOn\b/);
  assert.match(start, /endsOn\s*:\s*addDays\([^,]+,\s*SECRETARY_EXPERIMENT_DAYS\s*-\s*1\s*\)/,
    'day 1 and day 30 must form one inclusive interval');
  for (const field of ['baselineWindowDays', 'profileSnapshot', 'refs', 'checkIns']) assert.match(start, new RegExp(field));
  assert.match(start, /await persistSecretaryExperiment\(/,
    'starting the experiment must use the checked durable experiment writer');
  const writer = functionSource('persistSecretaryExperiment');
  assert.match(writer, /await Store\.updateNow\('settings'/,
    'experiment writes must merge against the latest settings snapshot');
  const savedAt = start.indexOf('await persistSecretaryExperiment(');
  const announcedAt = Math.min(
    ...['toast(', 'render('].map((token) => {
      const index = start.indexOf(token);
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    }),
  );
  assert.ok(savedAt >= 0 && savedAt < announcedAt,
    'the UI must not announce an experiment that failed to persist');

  const day = functionSource('secretaryExperimentDay');
  assert.match(day, /startedOn/);
  assert.match(day, /endsOn/);
  assert.match(day, /SECRETARY_EXPERIMENT_DAYS/);
  assert.match(day, /Math\.(?:min|max)/,
    'the displayed day number must be clamped to the persisted 30-day interval');
  assert.doesNotMatch(day, /(?:day|count)\s*(?:\+\+|\+=\s*1)/,
    'current day must be derived from dates, not incremented on app opens');

  assert.doesNotMatch(APP, /State\.(?:experiments|secretaryExperiments)\s*=/,
    'the personal experiment must not create another top-level state domain');
});

test('the experiment creates no new destination and is projected by the one Today Shadow surface', () => {
  const nav = functionSource('renderNav');
  assert.doesNotMatch(nav, /['"]experiment['"]|['"]эксперимент['"]/i,
    'a 30-day experiment is not a sixth destination');
  assert.doesNotMatch(APP, /function render(?:Secretary)?Experiment\s*\(/,
    'the experiment must compose existing domains instead of owning a page');
  assert.doesNotMatch(APP, /State\.view\s*=\s*['"]experiment['"]|[?&]view=experiment/);

  const control = functionSource('attentionTodayControlHTML');
  assert.match(control, /secretaryExperimentOfferHTML\(/,
    'the personal experiment must flow through the existing Shadow arbiter');
  assert.match(control, /class="secretary-primary-offer/,
    'the experiment shares the one primary offer slot instead of adding a sibling card');
});

test('draft setup is explicit, dismissible, and never steals Today before launch', () => {
  const html = functionSource('secretaryExperimentOfferHTML');
  assert.match(html, /status === 'draft'\) && !State\._secretaryExperimentSetupOpen\) return ''/,
    'a missing experiment must stay invisible until the person explicitly opens setup');
  assert.match(html, /data-action="secretary-experiment-start"/);
  assert.match(html, /data-action="secretary-experiment-later"/,
    'setup needs a Not now exit');

  const control = functionSource('attentionTodayControlHTML');
  assert.match(control, /data-action="secretary-experiment-open"/,
    'manual setup belongs behind Other support');
  const click = APP.slice(APP.indexOf("if (action === 'secretary-experiment-open')"), APP.indexOf("if (action === 'browser-companion-refresh')"));
  assert.match(click, /State\._secretaryExperimentSetupOpen = true/);
  assert.match(click, /State\._secretaryExperimentSetupOpen = false/);
});

test('a quiet morning is never diagnosed and only a known signal can produce one recovery plan', () => {
  const morning = functionSource('secretaryMorningRecoveryOffer');
  const signature = morning.match(/^function secretaryMorningRecoveryOffer\(([^)]*)\)/);
  assert.ok(signature && signature[1].trim(), 'the morning decision must receive an explicit signal/context');

  assert.match(morning, /(?:pendingReturn|known|sourceEpisodeId)/,
    'a recovery offer needs an explicit return/boundary signal');
  assert.match(morning,
    /!signal\s*\|\|\s*!signal\.known[\s\S]{0,180}return null/,
    'missing or unknown evidence must remain unknown');
  assert.match(morning, /(?:morning|hour\s*[<>=])/,
    'the morning intercept must state its time boundary');
  assert.match(morning, /hour >= 5 && hour < 13/,
    'the personal morning window is exactly 05:00–13:00');

  const signal = functionSource('secretaryExperimentLatestSignal');
  assert.match(signal, /const yesterday = addDays\(date, -1\)/);
  assert.match(signal, /fmtDate\(new Date\(episode\.endedAt\)\) === yesterday/,
    'an old escaped episode must not reappear every morning');

  for (const inferredFromSilence of ['dayLoadNow', 'arenaDayHistory', 'doneCount', 'plannedCount', 'currentStreak']) {
    assert.equal(morning.includes(inferredFromSilence), false,
      `${inferredFromSilence} must not turn a quiet day into a diagnosis`);
  }
  assert.doesNotMatch(morning, /срыв|провал|потерянн|лень|ленив|дисциплин/i,
    'morning copy must describe a possible return, not label the person or the day');

  assert.match(morning, /\bplan\s*:/,
    'the result must contain one concrete recovery plan');
  assert.match(morning, /\baction\s*:/,
    'the plan must end in one executable action');
  assert.doesNotMatch(morning, /\bplans\s*:|\bactions\s*:|\.map\s*\(/,
    'the low-resource intercept must not return a menu of plans');
});

test('experiment feedback is tied to the accepted return and requires one honest after-effect', () => {
  const due = functionSource('secretaryExperimentFeedbackDue');
  assert.match(due, /offerOutcome === 'accepted'/);
  assert.match(due, /signal\?\.completedRecovery\?\.id === row\.recoveryPlanId/,
    'feedback needs the exact accepted recovery projection, not any ended Attention episode');
  assert.match(due, /row\.afterEffect === 'unknown'/,
    'the same useful boundary must not ask twice after a known answer');
  assert.doesNotMatch(due, /setTimeout|setInterval|hour\s*[<>=]/,
    'elapsed clock time or opening the app is not a useful feedback boundary');

  const html = functionSource('secretaryExperimentOfferHTML');
  assert.match(html, /data-experiment-feedback="afterEffect"/);
  for (const value of ['better', 'same', 'worse']) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(html, /data-experiment-feedback="enjoyment"/,
    'enjoyment remains an optional independent detail');
  assert.match(html, /data-experiment-feedback="regret"/);
  assert.match(html, /data-experiment-feedback="boundaryHeld"/,
    'whether the chosen boundary held remains an optional honest answer');
  assert.match(html, /data-action="secretary-experiment-feedback"/);

  const save = functionSource('saveSecretaryExperimentFeedback');
  for (const field of ['afterEffect', 'enjoyment', 'regret', 'boundaryHeld']) assert.match(save, new RegExp(field));
  assert.match(save, /\['yes', 'no', 'unknown'\]\.includes\(boundaryHeld\)/,
    'returnedAt proves a return but must not invent whether its boundary held');
  assert.match(save, /await persistSecretaryExperiment\(/,
    'feedback must use the same checked settings envelope as experiment state');
  assert.ok(save.indexOf('await persistSecretaryExperiment(') < save.indexOf('render('),
    'feedback must persist before the prompt disappears');
});

test('an accepted return can complete after midnight without losing its feedback', () => {
  const signal = functionSource('secretaryExperimentLatestSignal');
  assert.match(signal, /Object\.entries\(experiment\?\.checkIns/);
  assert.match(signal, /checkDate/);
  assert.match(signal, /feedbackDate/);
  assert.doesNotMatch(signal, /const checkIn = experiment[^\n]*checkIns\[date\]/,
    'completed feedback must not be restricted to the current calendar row');

  const due = functionSource('secretaryExperimentFeedbackDue');
  assert.match(due, /signal\?\.feedbackDate/);
  assert.match(due, /secretaryExperimentInWindow\(experiment, feedbackDate\)/);
});

test('check-ins are bounded, sequenced, stoppable and contain no copied content', () => {
  const row = functionSource('secretaryExperimentCheckIn');
  for (const field of ['seq', 'sourceOfferId', 'recoveryPlanId', 'offerOutcome', 'boundaryHeld', 'enjoyment', 'afterEffect', 'regret', 'note']) {
    assert.match(row, new RegExp(field));
  }
  const end = functionSource('endSecretaryExperiment');
  assert.match(end, /\['completed', 'stopped'\]/);
  assert.match(end, /await persistSecretaryExperiment\(/);
  assert.doesNotMatch(row, /url|hostname|query|stringify\(.*episode/i);

  const record = functionSource('recordSecretaryExperimentOffer');
  assert.match(record, /boundaryHeld:\s*'unknown'/,
    'accepting an offer alone must not be recorded as a success or failure');

  const validatorAt = APP.indexOf('if (secretary.experimentV1 != null)');
  const validator = APP.slice(validatorAt, APP.indexOf('if (value.browserCompanionDiscovery', validatorAt));
  assert.match(validator, /date < experiment\.startedOn \|\| date > experiment\.endsOn/,
    'forged out-of-window check-ins must fail validation');
  assert.match(validator, /answer\.seq/);
  assert.match(validator, /https\?:/,
    'free notes must reject copied URLs');
});

test('the final denominator includes every elapsed experiment day, including silence', () => {
  const metrics = functionSource('secretaryExperimentMetrics');
  assert.match(metrics, /eligibleDays\s*-\s*effects\.known/,
    'unknown must mean elapsed days without known feedback, not only opened check-ins');
  assert.doesNotMatch(metrics, /rows\.length\s*-\s*effects\.known/,
    'quiet days must remain visible in the denominator rather than disappearing');
});

test('metric arithmetic executes with honest denominators, sample sizes, and no invented exposures', () => {
  const context = {
    experiment: {
      startedOn: '2026-09-01',
      baselineWindowDays: 14,
      checkIns: {
        '2026-09-01': { offerOutcome: 'accepted', recoveryPlanId: 'r1', boundaryHeld: 'yes', afterEffect: 'better', regret: 'none' },
        '2026-09-02': { offerOutcome: 'accepted', recoveryPlanId: 'r2', boundaryHeld: 'no', afterEffect: 'worse', regret: 'some' },
        '2026-09-03': { offerOutcome: 'dismissed', boundaryHeld: 'unknown', afterEffect: 'unknown', regret: 'unknown' },
      },
    },
    episodes: [
      { id: 'r1', outcome: 'escaped', endedAt: '2026-09-01T10:00:00.000Z', returnedAt: '2026-09-01T10:10:00.000Z' },
      { id: 'r2', outcome: 'escaped', endedAt: '2026-09-02T10:00:00.000Z', returnedAt: '2026-09-02T10:30:00.000Z' },
      { id: 'b1', outcome: 'escaped', endedAt: '2026-08-25T10:00:00.000Z', returnedAt: '2026-08-25T10:40:00.000Z' },
    ],
    secretaryExperimentEpisodes: () => [],
    secretaryExperimentDay: () => 7,
    SECRETARY_EXPERIMENT_DAYS: 30,
    addDays: (date, amount) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10),
    fmtDate: (date) => date.toISOString().slice(0, 10),
  };
  const result = vm.runInNewContext(
    `${functionSource('secretaryMedianMinutes')}\n${functionSource('secretaryExperimentMetrics')}\nsecretaryExperimentMetrics(experiment, episodes)`,
    context,
  );
  assert.equal(result.eligibleDays, 7);
  assert.equal(result.knownDays, 2);
  assert.equal(result.unknownDays, 5);
  assert.equal(result.offers.offered, null);
  assert.deepEqual([result.offers.decided, result.offers.accepted, result.offers.dismissed], [3, 2, 1]);
  assert.deepEqual([result.returnLatency.n, result.returnLatency.medianMin], [2, 20]);
  assert.deepEqual([result.returnLatency.baselineN, result.returnLatency.baselineMedianMin], [1, 40]);
  assert.equal(result.returnLatency.status, 'faster');
  assert.deepEqual([result.boundaryHeld.yes, result.boundaryHeld.no, result.boundaryHeld.known], [1, 1, 2]);
});

test('cross-midnight projection executes against the exact accepted recovery episode', () => {
  const context = {
    experiment: {
      startedOn: '2026-09-01', endsOn: '2026-09-30',
      checkIns: { '2026-09-02': { offerOutcome: 'accepted', recoveryPlanId: 'return-1', afterEffect: 'unknown' } },
    },
    secretaryExperimentEpisodes: () => [{
      id: 'return-1', outcome: 'escaped', endedAt: '2026-09-02T23:50:00.000Z', returnedAt: '2026-09-03T00:10:00.000Z',
    }],
    todayStr: () => '2026-09-03',
    addDays: (date, amount) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10),
    fmtDate: (date) => date.toISOString().slice(0, 10),
  };
  const signal = vm.runInNewContext(
    `${functionSource('secretaryExperimentLatestSignal')}\nsecretaryExperimentLatestSignal(experiment, '2026-09-03')`,
    context,
  );
  assert.equal(signal.pendingReturn, false);
  assert.equal(signal.feedbackDate, '2026-09-02');
  assert.equal(signal.completedRecovery.id, 'return-1');
});

test('concurrent sibling decisions execute as one serialized check-in', async () => {
  const initialExperiment = {
    version: 1, status: 'active', startedOn: '2026-09-01', endsOn: '2026-09-30', checkIns: {},
  };
  const context = {
    State: { settings: { secretary: { experimentV1: initialExperiment } } },
    structuredClone,
    secretaryExperimentFromSettings: (settings) => settings.secretary.experimentV1,
    secretarySettings: (settings) => settings.secretary || {},
    secretaryExperimentInWindow: (experiment, date) => date >= experiment.startedOn && date <= experiment.endsOn,
    todayStr: () => '2026-09-02',
    toast: () => {},
    t: (value) => value,
  };
  let stored = structuredClone(context.State.settings);
  let queue = Promise.resolve();
  context.Store = {
    updateNow: (_name, updater, apply) => {
      const run = queue.then(() => {
        const next = updater(structuredClone(stored));
        if (next === undefined) return false;
        stored = structuredClone(next);
        return apply(structuredClone(stored));
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  const result = await vm.runInNewContext(
    `${functionSource('persistSecretaryExperiment').replace(/^function /, 'async function ')}\n${functionSource('recordSecretaryExperimentOffer').replace(/^function /, 'async function ')}\nPromise.all([
      recordSecretaryExperimentOffer('accepted', { offerId: 'offer-1', sourceEpisodeId: 'episode-1' }, '2026-09-02'),
      recordSecretaryExperimentOffer('dismissed', { offerId: 'offer-1', sourceEpisodeId: 'episode-1' }, '2026-09-02')
    ])`,
    context,
  );
  assert.deepEqual(Array.from(result), [true, false]);
  assert.equal(stored.secretary.experimentV1.checkIns['2026-09-02'].offerOutcome, 'accepted');
});

test('review metrics include offers, latency, boundaries and regret with an inclusive final day', () => {
  const metrics = functionSource('secretaryExperimentMetrics');
  for (const field of ['offers', 'returnLatency', 'baselineN', 'baselineMedianMin', 'boundaryHeld', 'afterEffect', 'regret']) {
    assert.match(metrics, new RegExp(field));
  }
  assert.match(metrics, /endedAt/);
  assert.match(metrics, /returnedAt/);
  assert.match(metrics, /offered:\s*null/,
    'without a delivery ledger the local experiment must not invent exposure count');
  assert.match(metrics, /decided/);

  const reviewHtml = functionSource('secretaryExperimentReviewHTML');
  for (const sample of ['latency.n', 'latency.baselineN', 'metrics.afterEffect', 'metrics.regret', 'metrics.boundaryHeld']) {
    assert.match(reviewHtml, new RegExp(escapeRegExp(sample)));
  }

  const review = functionSource('secretaryExperimentReviewDue');
  assert.match(review, /date > experiment\.endsOn/,
    'the final sheet may replace recovery only after the inclusive day 30 has elapsed');
  assert.doesNotMatch(review, /date >= experiment\.endsOn/);
  assert.match(review, /\[7, 14, 21\]/);
});

test('the personal dogfood setup is owner-only and explains its data boundary', () => {
  const available = functionSource('secretaryExperimentAvailable');
  assert.match(available, /State\.me\?\.isAdmin === true/);
  const start = functionSource('startSecretaryExperiment');
  assert.match(start, /!secretaryExperimentAvailable\(\)/);
  const html = functionSource('secretaryExperimentOfferHTML');
  assert.match(html, /!secretaryExperimentAvailable\(\)/);
  assert.match(html, /время возврата, ответы и снимок личных рамок/);
  assert.match(html, /Без ссылок, страниц и просмотренного контента/);
});

test('experiment writes serialize against the latest in-tab settings snapshot', () => {
  const persist = functionSource('persistSecretaryExperiment');
  assert.match(persist, /Store\.updateNow\('settings'/,
    'lazy updateNow is required so queued writes do not overwrite a stale full settings clone');
  assert.match(persist, /secretaryExperimentFromSettings\(nextSettings\)/);
  const record = functionSource('recordSecretaryExperimentOffer');
  assert.match(record, /persistSecretaryExperiment\(\(experiment\) =>/);
  assert.match(record, /experiment\.checkIns\?\.\[date\]/);
});

test('feedback drafts are keyed to the exact date and episode', () => {
  const html = functionSource('secretaryExperimentOfferHTML');
  assert.match(html, /feedbackKey/);
  assert.match(html, /data-experiment-feedback-key/);
  const change = APP.slice(APP.indexOf('function onChange(e)'), APP.indexOf('\nasync function onWkDrop'));
  assert.match(change, /dataset\.experimentFeedbackKey/);
  assert.match(change, /State\._secretaryExperimentFeedbackDraft\?\.key === key/);
});

test('the experiment cannot mint progress, punish a skip, or create shame debt', () => {
  const runtime = EXPERIMENT_FUNCTIONS.map(functionSource).join('\n');

  assert.doesNotMatch(runtime,
    /\b(?:addXp|itemXp|xpAwarded|goldAwarded|currentStreak|checkAchievements|awardLoot|grantReward)\b/,
    'the experiment measures usefulness; it does not pay for compliance');
  assert.doesNotMatch(runtime, /State\.(?:tasks|habitlog|antihabits|fights)\b/,
    'a missed experiment day must not become an overdue task or a broken habit');
  assert.doesNotMatch(runtime, /срыв|провал|стыд|вина|виноват|наказ|штраф|долг|серия\s+сброш/i,
    'experiment copy must not moralize an unknown or skipped day');
  assert.doesNotMatch(runtime, /\b(?:XP|streak|clean days?)\b/i,
    'streak language and game progress do not belong to this personal experiment');
});

test('all experiment copy is complete in RU, EN, DE, UK and ES', () => {
  const runtime = EXPERIMENT_FUNCTIONS.map(functionSource).join('\n');
  const keys = [...new Set([...runtime.matchAll(/\bt\('((?:\\'|[^'])+)'\)/g)].map((match) => match[1]))];

  assert.ok(keys.length >= 6,
    'the experiment needs localized title, day status, plan, action, feedback and neutral unknown copy');
  for (const key of keys) assertLocaleRow(key);
});

test('experiment controls remain touch-safe and motion-optional', () => {
  for (const selector of [
    '.secretary-experiment-offer',
    '.secretary-experiment-action',
    '.secretary-experiment-feedback',
  ]) {
    assert.ok(cssBlocks(selector).length, `${selector} style is missing`);
  }

  assert.ok(cssBlocks('.secretary-experiment-action').some((body) =>
    /min-(?:height|block-size)\s*:\s*var\(--touch-min(?:,\s*42px)?\)/.test(body)),
  'the experiment action needs the shared touch target minimum');
  assert.match(CSS,
    /\.secretary-experiment-feedback[\s\S]{0,500}(?:button|input|label)[^{]*\{[^}]*min-(?:height|block-size)\s*:\s*var\(--touch-min(?:,\s*42px)?\)/,
    'feedback choices must be usable by touch');
  assert.match(CSS,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.secretary-experiment-(?:offer|feedback)/,
    'the compact experiment needs an explicit one-column mobile layout');
  assert.match(CSS,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.secretary-experiment-(?:offer|action|feedback)[\s\S]*?(?:animation|transition)\s*:\s*none\s*!important/,
    'experiment motion must stop when reduced motion is requested');
  assert.doesNotMatch(CSS,
    /\.secretary-experiment-(?:offer|action|feedback)[^{]*\{[^}]*(?:animation|transition)[^}]*infinite/s,
    'the 30-day experiment must not demand attention with endless motion');
});
