'use strict';

/* Targeted v215 runtime regressions.
 *
 * These are intentionally source contracts: the browser shell is not a CommonJS
 * module, so extracting the small controller bodies catches wiring regressions
 * without inventing a DOM/network harness for the whole application.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing source end marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function functionSource(source, name) {
  const marker = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const found = marker.exec(source);
  assert.ok(found, `${name} must exist`);
  // A destructured/default parameter can contain `{}` (for example
  // `options = {}`), so the first brace after the function marker is not
  // necessarily the function body.
  const openParen = source.indexOf('(', found.index + found[0].length - 1);
  let parens = 0;
  let quoteInParams = '';
  let escapedInParams = false;
  let brace = -1;
  for (let i = openParen; i < source.length; i += 1) {
    const c = source[i];
    if (quoteInParams) {
      if (escapedInParams) escapedInParams = false;
      else if (c === '\\') escapedInParams = true;
      else if (c === quoteInParams) quoteInParams = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quoteInParams = c; continue; }
    if (c === '(') parens += 1;
    else if (c === ')' && --parens === 0) { brace = source.indexOf('{', i + 1); break; }
  }
  assert.ok(brace >= 0, `${name} must have a body`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i += 1; continue; }
    if (c === '/' && n === '*') { blockComment = true; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return source.slice(found.index, i + 1);
  }
  assert.fail(`${name} body is not closed`);
}

function actionHandler(action, nextAction) {
  return between(APP, `if (action === '${action}')`, `} else if (action === '${nextAction}')`);
}

test('retaking an archived commitment reopens it before revising the boundary', () => {
  const source = functionSource(APP, 'takeQuestCommitment');
  const reopen = source.indexOf('commitmentApi.reopen');
  const revise = source.indexOf('commitmentApi.revise');
  assert.ok(reopen >= 0, 'retake path must reopen the archived deterministic commitment');
  assert.ok(revise > reopen, 'retake must reopen before applying the new boundary');
  assert.match(source, /archivedAt|archived|existing|current/, 'retake path does not distinguish archived history');
});

test('undo only reopens a winning completion and tolerates the active-item limit', () => {
  const source = actionHandler('toggle-task', 'toggle-task-backdated');
  const reopen = source.indexOf('commitmentApi.reopen');
  assert.ok(reopen >= 0, 'task undo must contain the commitment reopen path');
  const beforeReopen = source.slice(0, reopen);
  assert.match(beforeReopen, /outcomeOf|log\s*\[|record[\s\S]{0,100}win|win[\s\S]{0,100}record|===\s*['"]win['"]|['"]win['"]\s*===/, 'undo must check the recorded win before reopening');
  assert.match(source, /reopened\.error\s*!==\s*['"]limit['"]|reopened\.error\s*===\s*['"]limit['"]|error\s*!==\s*['"]limit['"]|error\s*===\s*['"]limit['"]/, 'undo must explicitly tolerate a commitment limit response');
});

test('calendar commitment release is gated by a changed date', () => {
  const source = functionSource(APP, 'moveCalendarTask');
  assert.match(source, /dateChanged/, 'calendar move must compute dateChanged before releasing a boundary');
  assert.match(source, /(?:nextDate\s*!==\s*before\.date|before\.date\s*!==\s*nextDate|String\(nextDate\)[^\n]{0,80}before\.date)/, 'dateChanged must compare the old and new dates');
  const release = source.indexOf('releaseActiveQuestCommitmentCandidate');
  assert.ok(release >= 0, 'calendar move must release an active commitment when its date changes');
  const dateChanged = source.indexOf('dateChanged');
  assert.ok(dateChanged < release, 'dateChanged must be computed before release');
  assert.match(source.slice(dateChanged, release), /activeCommitment|if\s*\(/, 'release is not inside the date-change decision');
  assert.match(functionSource(APP, 'releaseActiveQuestCommitmentCandidate'), /commitmentApi\.release/, 'calendar release helper must archive the commitment rather than drop its history');
});

test('assistant rescheduling and bulk overdue moves remain commitment-aware', () => {
  const assistant = functionSource(APP, 'applyChatActions');
  const rescheduleStart = assistant.indexOf("action.kind === 'quest_reschedule'");
  const rescheduleEnd = assistant.indexOf("action.kind === 'quest_done'", rescheduleStart);
  assert.ok(rescheduleStart >= 0 && rescheduleEnd > rescheduleStart, 'assistant quest_reschedule branch must exist');
  assert.match(assistant.slice(rescheduleStart, rescheduleEnd), /questCommitment|CommitmentV1|commitmentDataCommit/, 'assistant reschedule bypasses commitment handling');

  const move = actionHandler('move-overdue', 'bdone-open');
  assert.match(move, /questCommitment|CommitmentV1|commitmentDataCommit|moveCalendarTask|rescheduleQuestDatesWithCommitments/, 'move-overdue bypasses commitment handling');
});

test('generic amnesty undo excludes Control-generated amnesty sources', () => {
  const source = functionSource(APP, 'amnestiedToday');
  assert.match(source, /amnestySource/, 'generic amnesty undo does not know about Control source records');
  assert.match(source, /!\s*(?:x\.)?amnestySource|amnestySource\s*!==|amnestySource\s*===\s*['"](?:trust|generic|bulk)['"]|startsWith\(['"]control-['"]\)/, 'generic undo can still restore a Control amnesty source');
});

test('an unscheduled calendar task opens with an empty time input', () => {
  const source = functionSource(APP, 'openCalendarTaskEditor');
  const input = source.match(/<input name="startTime"[\s\S]{0,260}?\/>/);
  assert.ok(input, 'calendar editor must render its startTime input');
  assert.match(input[0], /calendarTimeValue\(task\.startTime\)\s*\|\|\s*['"]['"]/, 'unscheduled task must keep its time field empty');
  assert.doesNotMatch(input[0], /\|\|\s*['"]09:00['"]/, 'calendar editor invents 09:00 for an unscheduled task');
});

test('bulk amnesty is available only on the Trust path', () => {
  const source = actionHandler('amnesty-overdue', 'amnesty-undo') + functionSource(APP, 'amnestyCandidates');
  assert.match(source, /currentPath\(\)/, 'bulk amnesty has no path gate');
  assert.match(source, /['"]trust['"]/, 'bulk amnesty path gate does not name Trust');
});

test('commitment dialog uses the shared dialog mount and exposes busy/error state', () => {
  const dialog = functionSource(APP, 'openQuestCommitmentDialog');
  assert.match(dialog, /mountAccountDialog\s*\(/, 'commitment dialog bypasses shared focus/inert handling');
  const confirm = actionHandler('commitment-confirm', 'commitment-release');
  assert.match(confirm, /beginCommitmentUiAction\s*\(/, 'commitment confirmation has no busy guard');
  assert.match(confirm, /finally\s*\{\s*endCommitmentUiAction\s*\(/, 'commitment confirmation can leave its busy guard set');
  const busy = functionSource(APP, 'beginCommitmentUiAction');
  assert.match(busy, /disabled\s*=\s*true/, 'commitment confirmation does not disable its control while saving');
  assert.match(busy, /aria-busy/, 'commitment confirmation does not expose its saving state');

  const release = actionHandler('commitment-release', 'delete-task');
  assert.match(release, /(?:if\s*\(\s*!saved\s*\)|else)\s*toast\s*\(/, 'commitment release silently swallows a failed save');
});

test('backdated completion toast is emitted only after a successful save', () => {
  const source = actionHandler('toggle-task-backdated', 'toggle-habit');
  const toast = source.lastIndexOf('toast(');
  assert.ok(toast >= 0, 'backdated action should retain its success toast');
  const beforeToast = source.slice(0, toast);
  assert.match(beforeToast, /(?:const|let)\s+(?:saved|ok|completed)\s*=\s*await\s+completeTask|if\s*\(\s*(?:await\s+)?completeTask|if\s*\(\s*(?:saved|ok|completed)\s*\)/, 'backdated success toast is not gated by completeTask success');
  assert.match(beforeToast, /completeTask\s*\(/, 'backdated action no longer completes the task');
});

test('timer restoration starts ticking only for a restored running timer, and failed mutations restore its snapshot', () => {
  const init = between(APP, 'State.timer = loadTimer();', 'checkAchievements(true);');
  assert.match(init, /State\.timer\s*=\s*loadTimer\(\)/, 'init does not restore the persisted timer');
  assert.match(init, /State\.timer\.running\s*\)\s*startTick\(\)/, 'restored running timer does not resume ticking');

  const complete = functionSource(APP, 'completeTask');
  assert.match(complete, /const\s+timerSnapshot\s*=/, 'completion does not preserve the active timer before mutation');
  assert.match(complete, /stopFocus\s*\(\s*false\s*,\s*true\s*\)/, 'completion cannot include focused time in its atomic save');
  assert.match(complete, /if\s*\(\s*!saved\s*\)[\s\S]*?restoreFocusTimerSnapshot\s*\(\s*timerSnapshot\s*\)/, 'failed completion loses the active timer snapshot');

  const restore = functionSource(APP, 'restoreFocusTimerSnapshot');
  assert.match(restore, /if\s*\(\s*State\.timer\.running\s*\)\s*startTick\s*\(\s*\)/, 'restoring a paused timer incorrectly starts it');

  const remove = actionHandler('delete-task', 'add-stretch');
  assert.match(remove, /const\s+timerSnapshot\s*=/, 'deletion does not preserve the active timer before mutation');
  assert.match(remove, /if\s*\(\s*!saved\s*\)[\s\S]*?restoreFocusTimerSnapshot\s*\(\s*timerSnapshot\s*\)/, 'failed deletion loses the active timer snapshot');
});

test('dedicated commits remember settings/tasks only for the current account write epoch', () => {
  const source = functionSource(APP, 'rememberDedicatedCommitSlots');
  const Store = { _writeEpoch: 7, _persisted: { tasks: { exists: true, value: [{ id: 'old' }] } } };
  const State = { me: { id: 'account-a' } };
  const remember = Function('Store', 'State', 'structuredClone', `${source}; return rememberDedicatedCommitSlots;`)(Store, State, structuredClone);
  const candidate = { settings: { commitmentsV1: { version: 1 } }, tasks: [{ id: 'new' }] };

  assert.equal(remember(candidate, { writeEpoch: 6, accountId: 'account-a' }), false);
  assert.deepEqual(Store._persisted.tasks.value, [{ id: 'old' }], 'an old write epoch advanced the CAS snapshot');
  assert.equal(remember(candidate, { writeEpoch: 7, accountId: 'account-b' }), false);
  assert.deepEqual(Store._persisted.tasks.value, [{ id: 'old' }], 'another account advanced the CAS snapshot');
  assert.equal(remember(candidate, { writeEpoch: 7, accountId: 'account-a' }), true);
  candidate.tasks[0].id = 'mutated-after-confirmation';
  assert.deepEqual(Store._persisted.tasks.value, [{ id: 'new' }], 'the confirmed snapshot was retained by reference');
  assert.deepEqual(Store._persisted.settings.value, { commitmentsV1: { version: 1 } });
});

test('every dedicated settings/tasks client transaction advances the commitment CAS base after HTTP success', () => {
  const names = [
    'commitmentDataCommit', 'economyCommit', 'goalDataCommit', 'habitDataCommit',
    'commitBoardV2Transaction', 'commitBoardState', 'guideV3FeatureCommit',
  ];
  for (const name of names) {
    const source = functionSource(APP, name);
    assert.match(source, /Store\.runExclusive\s*\(/, `${name} is not serialized with ordinary Store writes`);
    const success = source.indexOf('response.ok');
    const remember = source.indexOf('rememberDedicatedCommitSlots');
    assert.ok(success >= 0, `${name} does not verify the dedicated endpoint response`);
    assert.ok(remember > success, `${name} advances Store._persisted before the endpoint confirms success`);
    assert.match(source.slice(remember), /writeEpoch/, `${name} does not pass the captured write epoch`);
    assert.match(source.slice(remember), /accountId|storeAccountId/, `${name} does not pass the captured account id`);
  }
  const goals = functionSource(APP, 'goalDataCommit');
  assert.match(goals, /data\s*=\s*\{\s*goals\s*:\s*nextGoals\s*,\s*tasks\s*:\s*nextTasks/, 'goal commit does not remember the exact task candidate sent to the server');
});

test('the client owns one exact cloned settings/tasks revision base', () => {
  const graphSource = functionSource(APP, 'commitmentGraphProtected');
  const graph = Function(`${graphSource}; return commitmentGraphProtected;`)();
  assert.equal(graph({ commitmentsV1: {} }, []), true);
  assert.equal(graph({}, [{ id: 'q1', oath: { at: '10:00' } }]), true);
  assert.equal(graph({}, [{ id: 'q1', commitmentId: 'quest:q1' }]), true);
  assert.equal(graph({}, [{ id: 'q1' }]), false);

  const baseSource = functionSource(APP, 'commitmentWriteBase');
  const Store = { _persisted: {
    settings: { exists: true, value: { commitmentsV1: { version: 1 } } },
    tasks: { exists: false, value: null },
  } };
  const base = Function('Store', 'structuredClone', `${baseSource}; return commitmentWriteBase;`)(Store, structuredClone)();
  assert.deepEqual(base, Store._persisted);
  base.settings.value.commitmentsV1.version = 9;
  assert.equal(Store._persisted.settings.value.commitmentsV1.version, 1, 'base aliases the mutable persisted cache');
  delete Store._persisted.tasks;
  assert.equal(Function('Store', 'structuredClone', `${baseSource}; return commitmentWriteBase;`)(Store, structuredClone)(), null,
    'a missing counterpart must fail closed');
});

test('ordinary protected settings/tasks writes use the paired commitment endpoint', () => {
  const source = functionSource(APP, 'commitmentGraphProtected')
    + functionSource(APP, 'commitmentWriteBase')
    + functionSource(APP, 'commitmentWriteData')
    + between(APP, 'const Store = {', '// Dedicated multi-file endpoints');
  assert.match(source, /runExclusive\(pairedSlot\s*\?\s*\[['"]settings['"],\s*['"]tasks['"]\]\s*:\s*\[name\]/,
    'settings/tasks Store writes are not serialized across both graph slots before candidate evaluation');
  assert.match(source, /fetch\(['"]\/api\/commitments\/commit['"]/,
    'protected Store writes still use a single-file endpoint');
  assert.match(source, /validateCommitPayload\(payload\)/, 'paired Store candidate bypasses the strict graph validator');
  assert.match(source, /rememberDedicatedCommitSlots\(pair/, 'successful paired Store writes do not advance both snapshots');
  assert.match(source, /commitmentBoundaryRejected\(response[,)]/, 'paired Store writes do not expose revision conflicts');
});

test('every dedicated graph writer attaches the same base and locks both graph slots', () => {
  for (const name of [
    'economyCommit', 'goalDataCommit', 'habitDataCommit',
    'commitBoardV2Transaction', 'commitBoardState', 'guideV3FeatureCommit',
  ]) {
    const source = functionSource(APP, name);
    assert.match(source, /dedicatedCommitPayload\s*\(/, `${name} omits the shared graph envelope`);
    assert.match(source, /['"]settings['"][\s\S]{0,220}['"]tasks['"]|['"]tasks['"][\s\S]{0,220}['"]settings['"]/, `${name} does not lock both graph slots`);
    assert.match(source, /commitmentBoundaryRejected\(response[,)]/, `${name} swallows a stale-base response`);
  }
  const questionnaire = functionSource(APP, 'questionnaireCommit');
  assert.match(questionnaire, /const\s+base\s*=\s*commitmentWriteBase\(\)/);
  assert.match(questionnaire, /\bbase\s*,/);
  assert.match(questionnaire, /commitmentBoundaryRejected\(response[,)]/);
});

test('account reset archives quest commitments and import/reset carry the exact base', () => {
  const reset = functionSource(APP, 'accountResetDataCandidate');
  assert.match(reset, /startsWith\(['"]quest:['"]\)/, 'reset does not distinguish quest commitments');
  assert.match(reset, /commitmentApi\.release/, 'reset drops commitment history instead of releasing it');
  assert.match(reset, /tasks\s*=\s*\[\]/, 'reset does not explicitly produce the empty quest list');
  assert.match(reset, /validateCommitPayload/, 'reset candidate is not graph-validated');

  const resetAction = between(APP, "if (action === 'confirm-account-reset')", "if (action === 'confirm-account-import')");
  assert.match(resetAction, /base\s*,\s*data\s*:\s*resetData/);
  assert.match(resetAction, /rememberDedicatedCommitSlots\(resetData/);
  const importAction = between(APP, "if (action === 'confirm-account-import')", "if (action === 'crash-export')");
  assert.match(importAction, /\.\.\.overlay\._archive\s*,\s*base/);
  assert.match(importAction, /runExclusive\(\[['"]settings['"],\s*['"]tasks['"]\]/);
});

test('startup establishes both snapshots before writes and unload never bypasses the graph boundary', () => {
  const init = functionSource(APP, 'initApp');
  const settingsLoad = init.indexOf("Store.loadChecked('settings'");
  const tasksLoad = init.indexOf("Store.loadChecked('tasks'");
  const firstSettingsWrite = Math.min(...['Store.save(\'settings\'', "Store.saveNow('settings'", "Store.updateNow('settings'"]
    .map((needle) => init.indexOf(needle)).filter((index) => index >= 0));
  assert.ok(settingsLoad >= 0 && tasksLoad > settingsLoad && tasksLoad < firstSettingsWrite,
    'init can write settings before the tasks revision base exists');
  const unload = between(APP, "window.addEventListener('beforeunload'", '// Ссылка из письма о сбросе пароля');
  assert.doesNotMatch(unload, /\/api\/data\/(?:settings|tasks)/, 'unload still performs a stale single-file write');
  assert.match(unload, /captureInspirationSetupDraft/, 'removing unsafe unload persistence also removed the local inspiration draft');
});

test('fresh registration primes both absent-file revisions before its first protected write', () => {
  const prime = functionSource(APP, 'ensureCommitmentWriteBase');
  assert.match(prime, /Store\.loadChecked\(['"]settings['"]/);
  assert.match(prime, /Store\.loadChecked\(['"]tasks['"]/);
  assert.match(prime, /commitmentWriteBase\(\)/, 'priming does not verify that both exact snapshots now exist');

  const register = between(APP, "if (f.id === 'register-form')", '// --- Reset (по коду восстановления)');
  const primeAt = register.indexOf('await ensureCommitmentWriteBase()');
  const saveAt = register.indexOf("Store.saveNow('settings'");
  assert.ok(primeAt >= 0 && saveAt > primeAt, 'registration writes protected settings before priming its 404 base');
  assert.match(register, /State\.tasks\s*=\s*primed\.ok/, 'registration leaves the paired task candidate unavailable');

  const onboarding = functionSource(APP, 'onboardingSave');
  assert.ok(onboarding.indexOf('await ensureCommitmentWriteBase()') < onboarding.indexOf('Store.saveNow(name, value)'),
    'program/manual onboarding can write before priming the pair base');
  assert.match(onboarding, /tasksEntry[\s\S]*State\.tasks\s*=\s*structuredClone\(tasksEntry\[1\]\)/,
    'fresh program onboarding does not pair its first settings write with the intended tasks');
});

test('a confirmed habit transaction advances the CAS base before optional UI application', () => {
  const source = functionSource(APP, 'habitDataCommit');
  const remember = source.indexOf('rememberDedicatedCommitSlots');
  const apply = source.indexOf('await applyCommitted');
  assert.ok(remember >= 0 && apply > remember,
    'a server-confirmed habit/settings write can return before its persisted base advances');
});

test('AI proposal import sends one exact five-domain candidate under one lock', () => {
  const base = functionSource(APP, 'proposalWriteBase');
  for (const pair of [
    "['settings', 'settings', 'object']", "['tasks', 'tasks', 'array']",
    "['goals', 'goals', 'array']", "['groups', 'goal-groups', 'array']",
    "['skilltree', 'skilltree', 'object']",
  ]) assert.ok(base.includes(pair), `five-file CAS base is missing ${pair}`);
  assert.match(base, /Store\._persisted\[storeName\]/, 'proposal base is not server-confirmed');
  assert.match(base, /if\s*\(!valid\)\s*return null/, 'a missing five-file snapshot does not fail closed');
  const commit = functionSource(APP, 'proposalDataCommit');
  assert.match(commit, /Object\.keys\(data\)\.sort\(\)\.join\(['"]\s*,\s*['"]\)\s*===\s*['"]goals,groups,settings,skilltree,tasks['"]/,
    'proposal endpoint accepts an ambiguous or partial domain set');
  assert.match(commit, /const slots\s*=\s*\[['"]settings['"],\s*['"]tasks['"],\s*['"]goals['"],\s*['"]goal-groups['"],\s*['"]skilltree['"]\]/,
    'proposal transaction does not lock all five persisted slots');
  assert.match(commit, /Store\.runExclusive\(slots/);
  assert.match(commit, /const base\s*=\s*proposalWriteBase\(\)/, 'proposal transaction omits its exact five-file CAS base');
  assert.match(commit, /const payload\s*=\s*\{\s*base\s*,\s*data\s*\}/, 'proposal transaction does not send the five-file envelope');
  assert.doesNotMatch(commit, /dedicatedCommitPayload\(data\)/, 'proposal transaction silently falls back to the pair-only base');
  assert.match(commit, /fetch\(['"]\/api\/goals\/commit['"]/, 'proposal import bypasses the dedicated server transaction');
  assert.match(commit, /commitmentBoundaryRejected\(response[,)]/, 'proposal import swallows stale-base conflicts');
  assert.match(commit, /rememberDedicatedCommitSlots\(data/, 'proposal import does not advance the confirmed pair base');
});

test('AI proposal base maps and clones all five confirmed store snapshots', () => {
  const source = functionSource(APP, 'proposalWriteBase');
  const Store = { _persisted: {
    settings: { exists: true, value: { skills: [{ id: 's1' }] } },
    tasks: { exists: true, value: [{ id: 't1' }] },
    goals: { exists: false, value: null },
    'goal-groups': { exists: true, value: [] },
    skilltree: { exists: true, value: { s1: { nodes: [] } } },
  } };
  const readBase = Function('Store', 'structuredClone', `${source}; return proposalWriteBase;`)(Store, structuredClone);
  const base = readBase();
  assert.deepEqual(Object.keys(base), ['settings', 'tasks', 'goals', 'groups', 'skilltree']);
  assert.deepEqual(base.groups, Store._persisted['goal-groups']);
  base.settings.value.skills[0].id = 'mutated';
  assert.equal(Store._persisted.settings.value.skills[0].id, 's1', 'five-file base aliases the persisted cache');
  delete Store._persisted.skilltree;
  assert.equal(readBase(), null, 'missing server-confirmed graph snapshot does not fail closed');
});

test('AI proposal draft stays invisible until the five-domain transaction succeeds', () => {
  const apply = functionSource(APP, 'applyAcceptedProposals');
  for (const name of ['settings', 'tasks', 'goals', 'goalGroups', 'tree']) {
    assert.match(apply, new RegExp(`${name}: structuredClone\\(State\\.${name.replace('goalGroups', 'goalGroups')}`),
      `${name} is missing from the isolated proposal draft`);
  }
  assert.match(apply, /settings:\s*draft\.settings,\s*tasks:\s*draft\.tasks,\s*goals:\s*draft\.goals/);
  assert.match(apply, /groups:\s*draft\.goalGroups,\s*skilltree:\s*draft\.tree/);
  const exposeDraft = apply.indexOf('Object.assign(State, draft)');
  const restoreLive = apply.indexOf('Object.assign(State, live)');
  const request = apply.indexOf('await proposalDataCommit(data)');
  const acceptDraft = apply.lastIndexOf('Object.assign(State, draft)');
  assert.ok(exposeDraft >= 0 && restoreLive > exposeDraft && request > restoreLive && acceptDraft > request,
    'live State can retain an unconfirmed proposal while the network request is pending');
  const failedBranch = apply.slice(request, acceptDraft);
  assert.match(failedBranch, /render\(\);\s*return/,
    'a rejected five-domain transaction can fall through and expose its draft');
});

test('proposal construction cannot schedule legacy per-file saves', () => {
  const proposals = functionSource(APP, 'applyProposals');
  assert.doesNotMatch(proposals, /Store\.(?:save|saveNow|updateNow)\s*\(/,
    'proposal construction still starts an independent persisted write');
  assert.match(proposals, /ensureTrees\(\{\s*persist:\s*false\s*\}\)/);
  const ensure = functionSource(APP, 'ensureTrees');
  const milestones = functionSource(APP, 'syncMilestonesFromImport');
  assert.match(ensure, /\{\s*persist\s*=\s*true\s*\}\s*=\s*\{\}/,
    'ordinary ensureTrees callers no longer preserve persistence by default');
  assert.match(ensure, /if\s*\(persist\s*&&\s*treeDataChanged\)\s*Store\.save\(['"]skilltree['"]/);
  assert.match(ensure, /syncMilestonesFromImport\(\{\s*persist\s*\}\)/);
  assert.match(milestones, /\{\s*persist\s*=\s*true\s*\}\s*=\s*\{\}/);
  assert.match(milestones, /if\s*\(persist\s*&&\s*changed\)\s*Store\.save\(['"]skilltree['"]/);
});
