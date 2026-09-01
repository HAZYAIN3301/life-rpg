'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

function between(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `missing end token after ${startToken}: ${endToken}`);
  return source.slice(start, end);
}

function occurrences(source, token) {
  return source.split(token).length - 1;
}

function firstIndexAfter(source, start, tokens) {
  const indexes = tokens
    .map((token) => source.indexOf(token, start))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
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

test('Today support owns one Shadow surface and has no legacy sibling offers', () => {
  const today = between(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  const composition = today.slice(today.lastIndexOf("if (tab === 'board')"));
  const support = between(composition, '<aside class="today-support"', '</aside>');

  assert.equal(occurrences(support, 'companionCard('), 1,
    'Today support must have one visual owner: the Shadow companion card');
  assert.match(support, /companionCard\(attentionTodayControlHTML\((?!\))/,
    'the selected nudge/offer must be passed into the Shadow control');

  for (const sibling of ['activeNudge', 'pathTeaserCard', 'timerCard', 'installBanner']) {
    assert.equal(support.includes(sibling), false,
      `${sibling} must not render as a sibling support card`);
  }
});

test('Shadow control accepts one selected offer and exposes one primary offer slot', () => {
  const control = between(APP, 'function attentionTodayControlHTML(', '\nfunction attentionPolicyId(');
  const signature = control.match(/^function attentionTodayControlHTML\(([^)]*)\)/);
  assert.ok(signature, 'attentionTodayControlHTML signature is missing');
  assert.notEqual(signature[1].trim(), '',
    'attentionTodayControlHTML must accept the nudge/offer selected by Today');

  assert.equal(occurrences(control, 'class="secretary-primary-offer'), 1,
    'all priority branches must project through exactly one primary offer slot');
  assert.match(control,
    /class="secretary-primary-offer[^"]*"[^>]*(?:aria-live="polite"|role="status"|aria-labelledby="[^"]+")/,
    'the changing primary offer needs an accessible name or polite status semantics');
});

test('manual alternatives live only behind a collapsed Other support disclosure', () => {
  const control = between(APP, 'function attentionTodayControlHTML(', '\nfunction attentionPolicyId(');
  const other = between(control, '<details class="secretary-other-support"', '</details>');
  const openingTag = other.slice(0, other.indexOf('>') + 1);

  assert.doesNotMatch(openingTag, /\sopen(?:\s|=|>)/,
    'Other support must be collapsed by default');
  assert.match(other, /<summary[^>]*>[\s\S]*t\('Другая поддержка'\)[\s\S]*<\/summary>/,
    'the disclosure needs a visible localized label');
  assert.match(other, /data-action="recovery-open"/);
  assert.match(other, /data-action="evening-open"/);
  assert.match(other, /data-action="attention-open-(?:setup|entry)"/);
  assert.doesNotMatch(other, /class="secretary-primary-offer/,
    'the primary offer must not be duplicated inside the secondary disclosure');
});

test('primary arbitration is active boundary, return, evening, nudge, then fallback', () => {
  const control = between(APP, 'function attentionTodayControlHTML(', '\nfunction attentionPolicyId(');
  const signature = control.match(/^function attentionTodayControlHTML\(([^)=,\s]+)/);
  assert.ok(signature, 'selected offer parameter is missing');
  const selectedName = signature[1];

  const activeAt = firstIndexAfter(control, 0, ['if (active)', 'active ?']);
  const returnAt = firstIndexAfter(control, activeAt + 1, ['pendingReturn']);
  const eveningAt = firstIndexAfter(control, returnAt + 1, ['State._eveningDue', 'eveningDue']);
  const nudgeAt = firstIndexAfter(control, eveningAt + 1, [selectedName, 'selectedNudge', 'selectedOffer']);
  const fallbackAt = firstIndexAfter(control.toLowerCase(), nudgeAt + 1,
    ['fallback', 'defaultoffer', 'defaultprimary']);

  assert.ok(activeAt >= 0, 'active attention/browser boundary must be the first arbitration branch');
  assert.ok(returnAt > activeAt, 'pending return must follow an active boundary');
  assert.ok(eveningAt > returnAt, 'an evening boundary must follow pending return');
  assert.ok(nudgeAt > eveningAt, 'the selected nudge must follow the evening boundary');
  assert.ok(fallbackAt > nudgeAt, 'the neutral fallback must be last');
});

test('a closed day suppresses proactive work while preserving non-work support', () => {
  const picker = between(APP, 'function pickNudge(signals)', '\n// ── Джарвис-2 Фаза B2:');
  const control = between(APP, 'function attentionTodayControlHTML(', '\nfunction attentionPolicyId(');

  assert.match(picker, /if\s*\(dayClosed\(\)\)\s*return null/,
    'closed days must not yield a proactive nudge');
  assert.match(control, /(?:const\s+\w*closed\w*\s*=\s*dayClosed\(\)|if\s*\(dayClosed\(\)\))/i,
    'the Shadow primary selector must know that the day is closed');
  assert.match(control,
    /(?:dayClosed\(\)|\bclosed\b)[\s\S]{0,900}(?:work|nudge|offer|primary)[\s\S]{0,900}(?:null|false|fallback)/i,
    'dayClosed must explicitly suppress a work/nudge primary offer rather than relying on CSS');
  const closedAt = control.indexOf('else if (closed)');
  const returnAt = control.indexOf('else if (pendingReturn)');
  const eveningAt = control.indexOf('else if (eveningDue)');
  assert.ok(closedAt >= 0 && closedAt < returnAt && closedAt < eveningAt,
    'a closed day must suppress pending return and evening offers, not only ordinary nudges');
});

test('legacy nudges enter the primary slot only when they expose exactly one action', () => {
  const eligible = between(APP, 'function secretaryNudgeEligible(', '\nfunction secretaryNudgeInlineHTML(');
  assert.match(eligible, /match\(\/\\sdata-action=/);
  assert.match(eligible, /length === 1/);

  const today = between(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  assert.match(today, /filter\(\(candidate\) => secretaryNudgeEligible\(candidate\.html\)\)/,
    'multi-choice and information-only legacy cards must not masquerade as one primary CTA');
  assert.ok(today.indexOf('attentionTodayPrimaryReserved()') < today.indexOf('pickNudge(['),
    'higher-priority Shadow state must reserve the slot before pickNudge records a view');
});

test('extension heartbeat preserves the selected offer and in-progress experiment controls', () => {
  const patcher = between(APP, 'function patchBrowserCompanionSurfaces()', '\nfunction handleBrowserCompanionMessage(');
  assert.match(patcher, /attentionTodayControlHTML\(State\._todaySelectedNudge \|\| null\)/,
    'heartbeat must not erase the selected Today offer');
  const focus = between(APP, 'function browserCompanionFocusKey(', '\nfunction replaceBrowserCompanionSurface(');
  assert.match(focus, /data-experiment-feedback/);
  const change = between(APP, 'function onChange(e)', '\nasync function onWkDrop(');
  assert.match(change, /State\._secretaryExperimentFeedbackDraft/,
    'feedback values must survive a status-driven surface replacement');

  const guard = between(APP, 'function secretarySurfaceInteractionActive(', '\nfunction replaceBrowserCompanionSurface(');
  assert.match(guard, /details\[open\]/,
    'heartbeat must not close a disclosure the person is using');
  assert.match(guard, /State\._secretaryExperimentBusy/);
  assert.match(patcher, /!secretarySurfaceInteractionActive\(control\)/,
    'the heartbeat must yield while the Shadow surface is interactive or saving');
});

test('experiment actions share one busy fence instead of racing sibling buttons', () => {
  const busy = between(APP, 'function setSecretaryExperimentBusy(', '\nfunction secretaryExperimentReviewHTML(');
  assert.match(busy, /State\._secretaryExperimentBusy/);
  assert.match(busy, /querySelectorAll\([^\n]*secretary-experiment-offer[^\n]*select[^\n]*data-action\^="secretary-experiment-"/,
    'accept, dismiss, and feedback fields must be disabled together');
  const click = APP.slice(APP.indexOf("if (action === 'secretary-experiment-start')"), APP.indexOf("if (action === 'browser-companion-refresh')"));
  assert.match(click, /if \(State\._secretaryExperimentBusy\) return/);
  assert.match(click, /finally \{ setSecretaryExperimentBusy\(false\); \}/);
});

test('primary and secondary support are touch-safe, responsive, and motion-optional', () => {
  for (const selector of ['.secretary-primary-offer', '.secretary-other-support', '.secretary-other-support > summary']) {
    assert.match(CSS, new RegExp(escapeRegExp(selector) + '\\s*\\{'), `${selector} style is missing`);
  }

  assert.match(CSS,
    /\.secretary-primary-offer[^\{]*(?:button|:is\()[^\{]*\{[^}]*min-(?:height|block-size):\s*var\(--touch-min\)/s,
    'the primary action needs the shared touch target minimum');
  assert.match(CSS,
    /\.secretary-other-support\s*>\s*summary\s*\{[^}]*min-(?:height|block-size):\s*var\(--touch-min\)/s,
    'the Other support summary needs the shared touch target minimum');
  assert.match(CSS,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.secretary-primary-offer[\s\S]*?\.secretary-other-support/,
    'both support levels need an explicit mobile layout');
  assert.match(CSS,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.secretary-(?:primary-offer|other-support)[\s\S]*?(?:animation|transition):\s*none\s*!important/,
    'support motion must stop under reduced-motion');
  assert.doesNotMatch(CSS,
    /\.secretary-primary-offer[^\{]*\{[^}]*(?:animation|transition)[^}]*infinite/s,
    'the main support decision must not demand attention forever');
});

test('the new disclosure and its surrounding landmarks are localized and semantic', () => {
  for (const key of ['Другая поддержка', 'Поддержка дня', 'Тень рядом']) assertLocaleRow(key);

  const today = between(APP, 'function renderToday() {', '\nfunction goalDeadlineHTML(');
  assert.match(today, /<aside class="today-support" aria-label="\$\{t\('Поддержка дня'\)\}"/);

  const control = between(APP, 'function attentionTodayControlHTML(', '\nfunction attentionPolicyId(');
  assert.match(control, /<details class="secretary-other-support"/,
    'native details/summary supplies keyboard disclosure semantics without custom key handlers');
  assert.match(control, /<summary[^>]*>[\s\S]*t\('Другая поддержка'\)[\s\S]*<\/summary>/);
});
