'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');
const Pacing = require('../public/board-v2-pacing.js');

const ROOT = path.join(__dirname, '..');

function quest(id, adventureClass, score, options) {
  const settings = options || {};
  const template = BoardV2.compileTemplate({
    schema: BoardV2.TEMPLATE_SCHEMA,
    id,
    revision: 1,
    kind: settings.kind || 'challenge',
    scale: adventureClass === 'legendary' ? 'arc' : 'expedition',
    tags: settings.tags || ['unexpected'],
    interests: ['adventure'],
    slots: [],
    copy: { title: `Квест ${id}`, details: 'Конкретный неожиданный заказ.' },
    completion: { proofModes: ['result'], share: 'optional' },
    adventure: {
      class: adventureClass,
      safetyTier: settings.safetyTier || 'ordinary',
      requiredFlags: settings.requiredFlags || [],
    },
  });
  const resolved = BoardV2.instantiate(template, {
    readinessFlags: settings.readinessFlags || [],
    fit: { confidence: score, interest: score, distanceKm: 0 },
  });
  return resolved.ok ? resolved.quest : null;
}

test('пассивный Wildcard разрешён максимум один раз за локальную неделю', () => {
  const wildcard = quest('weekly-wildcard', 'wildcard', 1);
  const state = Pacing.emptyState();
  const planned = Pacing.planUnexpected(BoardV2, [wildcard], {}, state, {
    mode: 'passive', day: '2026-08-25', weekKey: '2026-W35', seed: 'account-a',
  });
  assert.equal(planned.ok, true);
  assert.equal(Pacing.passiveEligibility(state, '2026-W35').ok, true, 'selection itself must not consume the week');

  const displayed = Pacing.recordDisplayed(state, planned.plan, planned.quest);
  assert.deepEqual(Pacing.passiveEligibility(displayed, '2026-W35'), { ok: false, reason: 'weekly-cap' });
  assert.equal(Pacing.passiveEligibility(displayed, '2026-W36').ok, true);
});

test('ручная кнопка не подчиняется недельному cap и может предложить Legendary', () => {
  const wildcard = quest('manual-wildcard', 'wildcard', 0.1);
  const legendary = quest('manual-legendary', 'legendary', 1);
  const passive = Pacing.planUnexpected(BoardV2, [wildcard], {}, Pacing.emptyState(), {
    mode: 'passive', day: '2026-08-25', weekKey: '2026-W35', seed: 'fixed',
  });
  const usedWeek = Pacing.recordDisplayed(Pacing.emptyState(), passive.plan, passive.quest);
  const manual = Pacing.planUnexpected(BoardV2, [wildcard, legendary], {}, usedWeek, {
    mode: 'manual-unexpected', day: '2026-08-25', weekKey: '2026-W35', seed: 'fixed',
  });
  assert.equal(manual.ok, true);
  assert.equal(manual.quest.templateId, 'manual-legendary');
  assert.equal(Pacing.MANUAL_LABEL_RU, 'Дай что-нибудь неожиданное');
});

test('пассивный режим не подсовывает Legendary как недельный сюрприз', () => {
  const legendary = quest('passive-legendary', 'legendary', 1);
  const planned = Pacing.planUnexpected(BoardV2, [legendary], {}, Pacing.emptyState(), {
    mode: 'passive', day: '2026-08-25', weekKey: '2026-W35', seed: 'fixed',
  });
  assert.deepEqual(planned, { ok: false, reason: 'no-eligible-quest' });
});

test('ручной режим не обходит hard avoid из профиля', () => {
  const heights = quest('high-place', 'wildcard', 1, { tags: ['heights'] });
  const planned = Pacing.planUnexpected(BoardV2, [heights], { avoidTags: ['heights'] }, Pacing.emptyState(), {
    mode: 'manual-unexpected', day: '2026-08-25', seed: 'fixed',
  });
  assert.deepEqual(planned, { ok: false, reason: 'no-eligible-quest' });
});

test('неразрешённая readiness не превращается в неожиданный заказ', () => {
  const unsafe = quest('unsafe-flip', 'wildcard', 1, {
    safetyTier: 'professional-supervision',
    requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready'],
    readinessFlags: [],
  });
  assert.equal(unsafe, null);
  const planned = Pacing.planUnexpected(BoardV2, [unsafe], {}, Pacing.emptyState(), {
    mode: 'manual-unexpected', day: '2026-08-25', seed: 'fixed',
  });
  assert.deepEqual(planned, { ok: false, reason: 'no-eligible-quest' });
});

test('недавний показ и явный отказ дают разные cooldown', () => {
  const wildcard = quest('cooldown-wildcard', 'wildcard', 1);
  const first = Pacing.planUnexpected(BoardV2, [wildcard], {}, Pacing.emptyState(), {
    mode: 'manual-unexpected', day: '2026-08-01', seed: 'first',
  });
  const shown = Pacing.recordDisplayed(Pacing.emptyState(), first.plan, first.quest);
  assert.equal(Pacing.planUnexpected(BoardV2, [wildcard], {}, shown, {
    mode: 'manual-unexpected', day: '2026-08-07', seed: 'again',
  }).reason, 'no-eligible-quest');
  assert.equal(Pacing.planUnexpected(BoardV2, [wildcard], {}, shown, {
    mode: 'manual-unexpected', day: '2026-08-08', seed: 'again',
  }).ok, true);

  const rejected = Pacing.recordRejected(Pacing.emptyState(), wildcard.templateId, '2026-08-01');
  assert.equal(Pacing.planUnexpected(BoardV2, [wildcard], {}, rejected, {
    mode: 'manual-unexpected', day: '2026-08-30', seed: 'again',
  }).reason, 'no-eligible-quest');
  assert.equal(Pacing.planUnexpected(BoardV2, [wildcard], {}, rejected, {
    mode: 'manual-unexpected', day: '2026-08-31', seed: 'again',
  }).ok, true);
});

test('одинаковый seed даёт детерминированный результат', () => {
  const quests = [
    quest('deterministic-a', 'wildcard', 0.5),
    quest('deterministic-b', 'wildcard', 0.5),
    quest('deterministic-c', 'wildcard', 0.5),
  ];
  const request = { mode: 'manual-unexpected', day: '2026-08-25', seed: 'account-request-42' };
  const first = Pacing.planUnexpected(BoardV2, quests, {}, Pacing.emptyState(), request);
  const second = Pacing.planUnexpected(BoardV2, quests.slice().reverse(), {}, Pacing.emptyState(), request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.quest.templateId, second.quest.templateId);
  assert.equal(first.plan.nonce, second.plan.nonce);
});

test('поддельный display-plan не расходует недельный шанс', () => {
  const wildcard = quest('forged-plan-wildcard', 'wildcard', 1);
  const forged = {
    schema: 'satoru.board-offer-plan/2', mode: 'passive', day: '2026-08-25', weekKey: '2026-W35',
    questId: wildcard.id, templateId: wildcard.templateId, nonce: 'forged',
  };
  const state = Pacing.recordDisplayed(Pacing.emptyState(), forged, wildcard);
  assert.deepEqual(state, Pacing.emptyState());
});

test('повреждённое pacing state нормализуется fail-closed и bounded', () => {
  const offers = Array.from({ length: 120 }, (_, index) => ({
    templateId: `quest-${index}`, at: '2026-08-25', mode: 'manual-unexpected',
  }));
  offers.unshift({ templateId: '', at: 'today', mode: 'bad' });
  const state = Pacing.normalizeState({ passiveWeeks: ['bad', '2026-W35'], offers, rejections: [{}] });
  assert.deepEqual(state.passiveWeeks, ['2026-W35']);
  assert.equal(state.offers.length, 100);
  assert.deepEqual(state.rejections, []);
});

test('pacing загружен до offer/runtime bridge и доступен offline', () => {
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.ok(index.indexOf('board-v2-pacing.js') < index.indexOf('board-v2-offers.js'));
  assert.match(sw, /'board-v2-pacing\.js'/);
});
