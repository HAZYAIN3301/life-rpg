'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function cssBlocks(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...CSS.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1]);
}

function lastCssBlockWith(selector, property) {
  const blocks = cssBlocks(selector).filter((body) => property.test(body));
  assert.ok(blocks.length, `${selector} must declare ${property}`);
  return blocks.at(-1);
}

test('Calendar has one add entry and reveals its form progressively', () => {
  const calendar = between(APP, 'function renderCalendarView()', '\n// ============================================================\n//  Быстрый захват');
  assert.equal(count(calendar, 'data-action="cal-focus-add"'), 1,
    'day view must not render a second Add quest CTA in its empty state');
  assert.match(calendar, /State\._calendarAddOpen/,
    'the add form needs an explicit progressive-disclosure state');
  assert.match(calendar, /calendar-add-open/);
  assert.match(calendar, /id="add-task"/);

  const actionAt = APP.indexOf("action === 'cal-focus-add'");
  assert.notEqual(actionAt, -1);
  const action = APP.slice(actionAt, actionAt + 900);
  assert.match(action, /(?:_calendarAddOpen\s*=\s*true|\.open\s*=\s*true|setAttribute\(['"]open)/,
    'the entry action must open the disclosure before moving focus');
  assert.match(action, /(?:focus\(|_calendarFocusAfterCommit\s*=)/,
    'the opened form must receive focus directly or through the post-render focus contract');
});

test('Month day cells keep the 42px touch floor at the final mobile cascade', () => {
  const body = lastCssBlockWith('.calendar-month-shell .cm-cell', /min-(?:block-size|height)\s*:/);
  const value = body.match(/min-(?:block-size|height)\s*:\s*([^;]+)/)?.[1]?.trim() || '';
  if (/^\d+(?:\.\d+)?px$/.test(value)) {
    assert.ok(Number.parseFloat(value) >= 42, `final month-cell minimum is only ${value}`);
  } else {
    assert.match(value, /var\(--touch-min(?:,\s*42px)?\)/,
      `month-cell minimum must resolve through --touch-min, got ${value}`);
    assert.match(CSS, /--touch-min\s*:\s*(?:42px|2\.625rem)/);
  }
});

test('Progress leads with a compact summary and discloses secondary analytics', () => {
  const stats = between(APP, 'function renderStats()', '\n// ============================================================\n//  Вид «Настройки»');
  assert.ok(count(stats, '<div class="kpi">') <= 4,
    'the first viewport must not be six equal KPI cards');
  assert.ok(count(stats, '<details') >= 2,
    'ranks, charts, loads, episodes and reflections need progressive disclosure');
  assert.match(stats, /<details class="[^"]*stats-progressive/,
    'secondary analytics need the shared quiet disclosure treatment');
  assert.match(stats, /(?:stats-(?:lead|summary|primary|insight)|weekly-(?:insight|summary))/,
    'Progress needs one named leading insight/summary surface');

  assert.doesNotMatch(stats, /<div class="card locked-card" data-action="show-paywall"/,
    'the Pro analytics gate must be a real control, not a clickable div');
  assert.match(stats, /<button[^>]+data-action="show-paywall"[^>]+data-feature="Расширенная аналитика"/);
  assert.match(stats, /data-action="toggle-restores"[^>]+aria-(?:pressed|label)=/,
    'restore-state controls need an announced state/name');
  assert.match(stats, /data-action="ep-del"[^>]+aria-label=/,
    'episode removal needs an accessible name');
});

test('Habit design edits one selected item instead of rendering a form wall', () => {
  const build = between(APP, 'function habitsBuildHTML()', '\nfunction habitsBreakHTML()');
  assert.match(build, /<details[^>]*habit-compact-card/,
    'identity, cue and two-minute fields must sit behind a selected disclosure');
  assert.match(build, /<summary/);

  const breaking = between(APP, 'function habitsBreakHTML()', '\nfunction atomicMethodHTML()');
  assert.ok(breaking.indexOf('${rows}') < breaking.indexOf('id="add-antihabit"'),
    'existing anti-habits and their useful actions must come before creation');
  assert.match(breaking, /<details[^>]*anti-(?:add|create|new)/,
    'the anti-habit creation form must be collapsed until requested');

  const method = between(APP, 'function atomicMethodHTML()', '\n// ============================================================\n//  ИИ-ассистент');
  assert.ok(count(method, '<details') >= 2,
    'long Atomic Habits reference material must not remain an equal card wall');
  assert.match(method, /habit-method-section/);
});

test('A saved reward is claimable immediately while its ceremony remains optional', () => {
  const commit = between(APP, 'async function commitDailyRewardDialog', '\n// ── Честная лента сундука');
  const savedAt = commit.indexOf('State.lootbox = next');
  const reelAt = commit.indexOf('startChestReel(overlay)');
  assert.ok(savedAt >= 0 && reelAt > savedAt, 'the durable save must still precede ceremony');
  const success = commit.slice(savedAt, reelAt);
  assert.match(success, /loot-capsule-result/,
    'the confirmed result must be exposed before the reel starts');
  assert.match(success, /claim[^\n]*(?:disabled\s*=\s*false|removeAttribute\(['"]disabled)/,
    'Claim must become available immediately after the successful save');
  assert.match(success, /skip[^\n]*(?:hidden\s*=\s*false|removeAttribute\(['"]hidden)/,
    'the optional ceremony must remain immediately skippable');

  const open = between(APP, 'function openChest(', '\n// Ваучер именной');
  assert.match(open, /data-action="skip-capsule-reveal"/);
  assert.match(open, /class="loot-reel"/);
  assert.doesNotMatch(open, /Результат уже сохранён/,
    'the modal must not claim success while the write is still pending');
  assert.match(open, /Сохраняю награду/);
  const collection = between(APP, 'function collectionCard()', '\nasync function commitDailyRewardDialog');
  const arsenal = between(APP, 'function arsenalCard()', '\nfunction renderRewards()');
  assert.match(collection, /<details class="[^"]*rewards-disclosure/);
  assert.match(arsenal, /<details class="[^"]*rewards-disclosure/);
  const rewards = between(APP, 'function renderRewards()', '\n// ============================================================\n//  Вид «Неделя»');
  assert.ok(count(rewards, 'rewards-disclosure') >= 2,
    'long rules, history and achievements must stay secondary disclosures');
});

test('Party entry asks for one intent before revealing one form', () => {
  const party = between(APP, 'function partyEmptyHTML()', '\nfunction partyHTML(');
  assert.match(party, /State\._partyEntryMode/);
  assert.match(party, /data-action="party-entry-create"/);
  assert.match(party, /data-action="party-entry-join"/);
  assert.match(party, /_partyEntryMode\s*===\s*['"]create['"]/);
  assert.match(party, /_partyEntryMode\s*===\s*['"]join['"]/);
  assert.match(party, /aria-(?:expanded|pressed)=/,
    'the selected entry path must be exposed to assistive technology');
});

test('Today keeps quick capture to one line while Notes exposes the full toolset', () => {
  const capture = between(APP, 'function captureBar(', '\nfunction validateInboxPayload');
  assert.match(capture, /options\.expanded\s*===\s*true/);
  assert.match(capture, /class="capture-tools"/,
    'voice, video, recap and Notes link need one secondary disclosure on Today');
  assert.match(capture, /class="card capture-card \$\{expanded \? 'is-expanded' : 'is-compact'\}"/);
  const today = between(APP, 'function renderToday()', '\n// ============================================================\n//  Вид «Цели»');
  assert.match(today, /\$\{captureBar\(\)\}/,
    'Today must use the compact default capture line');
  const notes = between(APP, 'function renderNotes()', '\nfunction closeNoteDeleteDialog');
  assert.match(notes, /captureBar\(\{ expanded: true \}\)/,
    'Notes is the dedicated surface where all capture tools may be visible');
});

test('Experience and Party disclose secondary systems instead of repeating card walls', () => {
  const settings = between(APP, "groupStart('experience'", '${groupEnd()}', APP.indexOf("groupStart('experience'"));
  assert.match(settings, /settings-appearance-card/);
  assert.ok(count(settings, 'settings-disclosure') >= 2,
    'sound/Shadow and app/attention belong behind two purpose disclosures');
  assert.match(settings, /Звук и присутствие Тени/);
  assert.match(settings, /Приложение и границы внимания/);

  const party = between(APP, 'function partyHTML(', '\n// Кинематографичная победа');
  assert.match(party, /party-progress-details/);
  assert.doesNotMatch(party, /party-top-grid|party-event-grid|season-card-event|class="card raid-card/,
    'raid and season must not duplicate the event hero as equal cards');
  assert.equal(count(party, 'class="event-metrics"'), 1,
    'the leading raid metrics should appear only once');

  const labelOverride = lastCssBlockWith('.settings-appearance-card .theme-lbl', /width\s*:/);
  assert.match(labelOverride, /(?:inline-size|width)\s*:\s*auto/,
    'translated setting labels must not inherit the legacy 64px column and wrap by letter');
});

test('Today uses one grid rhythm between its tabs and the day itself', () => {
  const shell = lastCssBlockWith('.today-shell', /row-gap\s*:/);
  assert.match(shell, /row-gap\s*:\s*var\(--sp-4\)/,
    'Today should use one canonical row gap instead of stacking a grid gap and tab margin');
  const tabMargins = cssBlocks('.today-tabs').filter((body) => /margin-bottom\s*:/.test(body));
  assert.ok(tabMargins.some((body) => /margin-bottom\s*:\s*0/.test(body)),
    'desktop tabs must not add a second gap on top of the grid rhythm');
  assert.ok(tabMargins.some((body) => /margin-bottom\s*:\s*var\(--sp-3\)/.test(body)),
    'the one-column mobile flow keeps a deliberate compact gap');
});

test('Global shell spends the header on identity and navigation, not a persistent sphere wall', () => {
  const header = between(APP, 'function renderHeader(', '\n// ============================================================\n//  Вид «Сегодня»');
  assert.doesNotMatch(header, /skill-pill|sphere-pill|skills-row|header-skills/,
    'life spheres must remain contextual rather than follow every screen');
  assert.match(header, /char-main/);
  assert.doesNotMatch(CSS, /transition\s*:\s*all\b/,
    'new design rules forbid animating unrelated layout properties');
});

test('Focus duration and paywall use the shared semantic dialog lifecycle', () => {
  for (const [name, source] of [
    ['focus duration', between(APP, 'function openFocusDurationPicker(', '\nfunction startFocus(')],
    ['paywall', between(APP, 'function showPaywall(', '\n// ============================================================\n//  Гайд')],
  ]) {
    assert.match(source, /role="dialog"/i, `${name}: missing dialog role`);
    assert.match(source, /aria-modal="true"/i, `${name}: missing aria-modal`);
    assert.match(source, /aria-labelledby=/i, `${name}: missing accessible title`);
    assert.match(source, /class="modal-x"[^>]+aria-label=/i, `${name}: close control is unnamed`);
    assert.match(source, /mountAccountDialog\(ov/, `${name}: no Escape, focus trap or return-focus lifecycle`);
  }
  const lifecycle = between(APP, 'function mountAccountDialog(', '\nfunction showPartyExitDialog(');
  assert.match(lifecycle, /event\.key === 'Escape'/);
  assert.match(lifecycle, /event\.key !== 'Tab'/);
  assert.match(lifecycle, /app\) app\.inert = true/);
  assert.match(APP, /function closeAccountDialog[\s\S]*?_accountDialogReturnFocus[\s\S]*?\.focus\(/);
});

test('Assistant conversation is one live log, not a collection of competing statuses', () => {
  const helper = between(APP, 'function openHelperChat(', '\nfunction renderChatMessages()');
  assert.match(helper, /id="chat-msgs"[^>]*role="log"/);
  assert.match(helper, /id="chat-msgs"[^>]*aria-live="polite"/);
  assert.match(helper, /id="chat-msgs"[^>]*aria-relevant="additions text"/);
  const messages = between(APP, 'function renderChatMessages()', '\n// ── Assistant v181');
  assert.doesNotMatch(messages, /class="chat-msg ai typing" role="status" aria-live="polite"/,
    'the typing indicator must not create a second nested live region');
});

test('Profile memory precedes advanced AI-provider setup in Connections', () => {
  const settings = between(APP, "groupStart('connections'", "groupEnd()", APP.indexOf("groupStart('connections'"));
  assert.ok(settings.indexOf('${profileCard()}') >= 0, 'profile card missing from Connections');
  assert.ok(settings.indexOf('${profileCard()}') < settings.indexOf('${aiKeysCard()}'),
    'the user-facing profile must appear before provider plumbing');
  assert.match(settings, /<details[^>]*(?:ai|connections|provider)/,
    'AI provider setup must be a secondary disclosure');
});

test('Rendered level labels cannot interpolate undefined object fields', () => {
  assert.doesNotMatch(APP, /ур\.undefined/);
  const raw = [...APP.matchAll(/ур\.\$\{([^}]+)\}/g)].map((match) => match[1].trim());
  assert.ok(raw.length, 'expected rendered level labels');
  for (const expression of raw) {
    assert.doesNotMatch(expression, /^(?:p\.level|it\.lvl)$/,
      `unsafe level interpolation can render ур.undefined: ${expression}`);
  }
});

test('Mobile navigation remains exactly four primary destinations plus More', () => {
  assert.match(APP, /const MOBILE_PRIMARY_SECTION_IDS = Object\.freeze\(\['today', 'plan', 'habits', 'hero'\]\)/);
  assert.match(APP, /const MOBILE_MORE_SECTION_IDS = Object\.freeze\(\['library', 'rewards', 'tribe'\]\)/);
  const nav = between(APP, 'function renderNav()', '\nfunction mobileNavFocusable');
  assert.equal((nav.match(/<button class="navsec mobile-nav-more/g) || []).length, 1,
    'exactly one More destination must be rendered');
  assert.match(nav, /aria-haspopup="dialog"/);
  assert.match(nav, /MOBILE_PRIMARY_SECTION_IDS\.includes\(s\.id\)/);

  assert.match(CSS, /\.navrow > \.navsec,[\s\S]*?\.navrow > \.navgear\s*\{[^}]*display:\s*none/s);
  assert.match(CSS, /\.navrow > \.navsec\.mobile-primary,[\s\S]*?\.navrow > \.mobile-nav-more\s*\{[^}]*display:\s*flex/s);
  const mobileContract = CSS.slice(CSS.indexOf('/* Mobile navigation v128'), CSS.indexOf('/* Notes v129'));
  assert.ok(mobileContract.length > 0, 'mobile navigation contract CSS missing');
  assert.doesNotMatch(mobileContract, /(?:^|\n)\s*order\s*:/m,
    'mobile navigation must follow DOM order rather than CSS order');
});
