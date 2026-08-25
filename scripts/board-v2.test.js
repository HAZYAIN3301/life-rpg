'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const BoardV2 = require('../public/board-v2.js');

function rawTemplate(overrides) {
  const base = {
    schema: BoardV2.TEMPLATE_SCHEMA,
    id: 'try-climbing-bielefeld',
    revision: 1,
    kind: 'experience',
    scale: 'session',
    tags: ['body', 'bold', 'local'],
    interests: ['sport'],
    slots: [
      { id: 'class', type: 'local-class', required: true },
    ],
    copy: {
      title: 'Попробуй {class}',
      details: 'Конкретное пробное занятие рядом с тобой.',
    },
    completion: {
      proofModes: ['checkin', 'photo', 'reflection'],
      proofRequired: false,
      share: 'optional',
    },
    followUp: {
      interventionId: 'new-sport-class',
      question: 'Ты хотел бы прийти на такое занятие ещё раз?',
      contextTags: ['routine-stuck', 'needs-novelty'],
    },
  };
  return Object.assign(base, overrides || {});
}

function localClass(name, extra) {
  return Object.assign({
    name,
    address: 'Universitätsstraße 25, Bielefeld',
    startsAt: '2026-08-25T19:30:00+02:00',
    url: 'https://example.test/class',
  }, extra || {});
}

function resolvedQuest(overrides, resolution) {
  const template = BoardV2.compileTemplate(rawTemplate(overrides));
  const result = BoardV2.instantiate(template, Object.assign({
    slots: { class: localClass('скалолазание в Universität Bielefeld') },
    primaryAction: { label: 'Открыть занятие', url: 'https://example.test/class' },
    fit: { interest: 1, confidence: 0.9, distanceKm: 4 },
  }, resolution || {}));
  assert.equal(result.ok, true);
  return result.quest;
}

test('компилирует только точный Board v2 schema и immutable template', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  assert.equal(compiled.schema, BoardV2.TEMPLATE_SCHEMA);
  assert.equal(Object.isFrozen(compiled), true);
  assert.equal(Object.isFrozen(compiled.completion), true);
  assert.throws(() => BoardV2.compileTemplate({}), { code: 'invalid-schema' });
});

test('бытовая routine-задача не может занять место на доске приключений', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({ kind: 'routine' })), {
    code: 'routine-not-a-board-quest',
  });
});

test('копирайт-гейт отклоняет подтверждённые ИИшно-кринжовые конструкции', () => {
  const bad = [
    'Привези физический артефакт',
    'Сделай это не на автомате',
    'Сравни ощущения до и после',
    'Не открывай алгоритмические ленты',
    'Дойди до точки на карте',
    'Проведи там десять минут',
    'Запиши результат',
  ];
  for (const title of bad) {
    assert.throws(() => BoardV2.compileTemplate(rawTemplate({ copy: { title, details: 'Конкретное действие.' } })), {
      code: 'copy-contract',
    }, title);
  }
});

test('placeholder обязан иметь объявленный resolver slot', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({
    copy: { title: 'Попробуй {venue}', details: 'Сегодня.' },
  })), { code: 'unknown-placeholder' });
});

test('локальный квест fail-closed без конкретного занятия', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  assert.deepEqual(BoardV2.instantiate(compiled, {}), {
    ok: false,
    error: 'unresolved-slot',
    slot: 'class',
  });
});

test('для локальной секции недостаточно одного названия: нужны где и когда', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const result = BoardV2.instantiate(compiled, {
    slots: { class: { name: 'Скалолазание' } },
    primaryAction: { label: 'Открыть', url: 'https://example.test/class' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'unresolved-slot');
});

test('маршрут обязан быть готовым маршрутом, а не абстрактным направлением', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate({
    id: 'walk-exact-route',
    slots: [{ id: 'route', type: 'local-route', required: true }],
    copy: { title: 'Пройди {route}', details: 'Старт и сложность уже выбраны.' },
  }));
  const vague = BoardV2.instantiate(compiled, {
    slots: { route: { name: 'что-нибудь в лесу', url: 'https://example.test/route' } },
    primaryAction: { label: 'Открыть маршрут', url: 'https://example.test/route' },
  });
  assert.deepEqual(vague, { ok: false, error: 'unresolved-slot', slot: 'route' });
  const exact = BoardV2.instantiate(compiled, {
    slots: { route: {
      name: 'Hermannshöhen: Bielefeld — Oerlinghausen',
      address: 'Sparrenburg, Bielefeld',
      url: 'https://example.test/route',
      distanceKm: 14.78,
      difficulty: 'средняя',
    } },
    primaryAction: { label: 'Открыть маршрут', url: 'https://example.test/route' },
  });
  assert.equal(exact.ok, true);
  assert.equal(exact.quest.resolvedSlots.route.distanceKm, 14.78);
  assert.equal(exact.quest.resolvedSlots.route.difficulty, 'средняя');
});

test('видео-комплекс обязан иметь конкретную HTTPS-ссылку и кнопку запуска', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate({
    id: 'long-stretch-video',
    kind: 'recovery',
    slots: [{ id: 'routine', type: 'video', required: true }],
    copy: { title: 'Сделай растяжку по {routine}', details: 'Остановись, если появилась боль.' },
  }));
  assert.equal(BoardV2.instantiate(compiled, { slots: { routine: 'любое видео' } }).ok, false);
  const result = BoardV2.instantiate(compiled, {
    slots: { routine: { name: '40-минутная растяжка', url: 'https://example.test/stretch' } },
    primaryAction: { label: 'Открыть видео', url: 'https://example.test/stretch' },
  });
  assert.equal(result.ok, true);
});

test('«вечером» не считается конкретным расписанием локального события', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const result = BoardV2.instantiate(compiled, {
    slots: { class: localClass('скалолазание', { startsAt: 'вечером' }) },
    primaryAction: { label: 'Открыть', url: 'https://example.test/class' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'unresolved-slot');
});

test('разрешённый local slot превращается в конкретный пользовательский квест', () => {
  const quest = resolvedQuest();
  assert.equal(quest.title, 'Попробуй скалолазание в Universität Bielefeld');
  assert.equal(quest.primaryAction.label, 'Открыть занятие');
  assert.equal(quest.resolvedSlots.class.startsAt, '2026-08-25T19:30:00+02:00');
  assert.equal(quest.reward.xp, 80);
});

test('нелокальный slot может быть конкретной строкой из профиля', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate({
    id: 'invite-old-friend',
    kind: 'social',
    slots: [{ id: 'person', type: 'person', required: true }],
    copy: { title: 'Позови {person} погулять', details: 'Вы давно не общались.' },
  }));
  const result = BoardV2.instantiate(compiled, { slots: { person: 'Макса' } });
  assert.equal(result.ok, true);
  assert.equal(result.quest.title, 'Позови Макса погулять');
});

test('instantiate не замораживает и не удерживает mutable resolver input', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const source = localClass('скалолазание');
  const result = BoardV2.instantiate(compiled, {
    slots: { class: source },
    primaryAction: { label: 'Открыть', url: 'https://example.test/class' },
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(source), false);
  source.name = 'подменённое занятие';
  assert.equal(result.quest.resolvedSlots.class.name, 'скалолазание');
});

test('локальный квест без одного следующего тапа не показывается', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const result = BoardV2.instantiate(compiled, {
    slots: { class: localClass('скалолазание') },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'missing-primary-action');
});

test('primary action принимает только нормальную HTTPS-ссылку без credentials', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,bad',
    'http://example.test/class',
    'https://user:password@example.test/class',
  ]) {
    const result = BoardV2.instantiate(compiled, {
      slots: { class: localClass('скалолазание') },
      primaryAction: { label: 'Открыть', url },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing-primary-action');
  }
});

test('внутри рекомендации разрешён максимум один запасной вариант', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const result = BoardV2.instantiate(compiled, {
    slots: { class: localClass('скалолазание') },
    primaryAction: { label: 'Открыть', url: 'https://example.test/class' },
    alternatives: [{ name: 'A' }, { name: 'B' }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'choice-overload');
});

test('запасной вариант тоже обязан быть конкретным и открываемым', () => {
  const compiled = BoardV2.compileTemplate(rawTemplate());
  const result = BoardV2.instantiate(compiled, {
    slots: { class: localClass('скалолазание') },
    primaryAction: { label: 'Открыть', url: 'https://example.test/class' },
    alternatives: [{ name: 'что-нибудь ещё' }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid-alternative');
});

test('публичный шеринг может быть только опциональным или выключенным', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({
    completion: { proofModes: ['photo'], share: 'required' },
  })), { code: 'sharing-must-be-optional' });
});

test('квест обязан иметь естественный способ зафиксировать завершение', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({
    completion: { proofModes: [] },
  })), { code: 'missing-proof-mode' });
});

test('большой квест получает заметно больше XP и может дать звание', () => {
  const expedition = BoardV2.compileTemplate(rawTemplate({
    id: 'run-first-tabletop-session',
    kind: 'social',
    scale: 'expedition',
    reward: { title: 'Dungeon Master' },
  }));
  assert.equal(expedition.reward.xp, 220);
  assert.equal(expedition.reward.title, 'Dungeon Master');
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({ reward: { title: 'Dungeon Master' } })), {
    code: 'title-requires-large-quest',
  });
});

test('легендарный заказ не маскируется под короткую session-задачу', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({
    adventure: { class: 'legendary' },
  })), { code: 'legendary-requires-large-quest' });
  const compiled = BoardV2.compileTemplate(rawTemplate({
    id: 'run-a-marathon',
    scale: 'arc',
    adventure: { class: 'legendary', safetyTier: 'planned', requiredFlags: ['health-ready'] },
  }));
  assert.equal(compiled.adventure.class, 'legendary');
  assert.equal(compiled.reward.xp, 500);
});

test('опасный wildcard fail-closed без разрешённого места и профессионального контроля', () => {
  assert.throws(() => BoardV2.compileTemplate(rawTemplate({
    id: 'learn-a-flip-unsafe',
    scale: 'expedition',
    slots: [],
    copy: { title: 'Научись делать сальто с тренером', details: 'Только в оборудованном зале.' },
    adventure: { class: 'wildcard', safetyTier: 'professional-supervision', requiredFlags: [] },
  })), { code: 'unsafe-supervised-quest' });

  const compiled = BoardV2.compileTemplate(rawTemplate({
    id: 'learn-a-flip-with-coach',
    scale: 'expedition',
    slots: [],
    copy: { title: 'Научись делать сальто с тренером', details: 'Только в оборудованном зале.' },
    adventure: {
      class: 'wildcard',
      safetyTier: 'professional-supervision',
      requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready'],
    },
  }));
  assert.deepEqual(BoardV2.instantiate(compiled, {}), {
    ok: false,
    error: 'readiness-required',
    missingFlags: ['professional-supervision', 'permitted-venue', 'health-ready'],
  });
  assert.equal(BoardV2.instantiate(compiled, {
    readinessFlags: ['professional-supervision', 'permitted-venue', 'health-ready'],
  }).ok, true);
});

test('selection отдаёт одну основную рекомендацию и не больше двух резервных', () => {
  const a = resolvedQuest({ id: 'quest-a' }, { fit: { interest: 0, confidence: 0.2, distanceKm: 2 } });
  const b = resolvedQuest({ id: 'quest-b' }, { fit: { interest: 1, confidence: 1, distanceKm: 3 } });
  const c = resolvedQuest({ id: 'quest-c' }, { fit: { interest: 0, confidence: 0.8, distanceKm: 1 } });
  const d = resolvedQuest({ id: 'quest-d' }, { fit: { interest: 0, confidence: 0.7, distanceKm: 1 } });
  const picked = BoardV2.select([a, b, c, d], { interests: ['body'] }, { reserveLimit: 99 });
  assert.equal(picked.primary.templateId, 'quest-b');
  assert.equal(picked.reserves.length, 2);
});

test('wildcard и legendary не попадают в обычную выдачу без явного режима', () => {
  const standard = resolvedQuest({ id: 'standard-quest' });
  const wildcard = resolvedQuest({
    id: 'wildcard-quest',
    scale: 'expedition',
    adventure: { class: 'wildcard' },
  }, { fit: { interest: 10, confidence: 1, distanceKm: 0 } });
  assert.equal(BoardV2.select([wildcard, standard], {}).primary.templateId, 'standard-quest');
  assert.equal(BoardV2.select([wildcard, standard], {}, {
    adventureClasses: ['wildcard'],
  }).primary.templateId, 'wildcard-quest');
});

test('жёсткое «не моё» полностью убирает квест, а не только снижает score', () => {
  const quest = resolvedQuest({ id: 'hard-avoid', tags: ['heights', 'travel'] });
  const picked = BoardV2.select([quest], { avoidTags: ['heights'] });
  assert.equal(picked.primary, null);
  assert.deepEqual(picked.reserves, []);
});

test('selection не доверяет поддельному quest schema', () => {
  const real = resolvedQuest({ id: 'real-quest' });
  const forged = Object.assign({}, real, { templateId: 'forged', fit: { confidence: 100, interest: 100, distanceKm: 0 } });
  const picked = BoardV2.select([forged, real], {});
  assert.equal(picked.primary.templateId, 'real-quest');
});

test('явное не моё перебивает близость и confidence', () => {
  const sport = resolvedQuest({ id: 'sport-local', tags: ['body', 'bold'] }, {
    fit: { interest: 2, confidence: 1, distanceKm: 1 },
  });
  const quiet = resolvedQuest({ id: 'quiet-local', tags: ['quiet', 'solo'] }, {
    fit: { interest: 0, confidence: 0.6, distanceKm: 4 },
  });
  const picked = BoardV2.select([sport, quiet], { avoidTags: ['body', 'bold'], interests: ['quiet'] });
  assert.equal(picked.primary.templateId, 'quiet-local');
});

test('скрытый или недавно отклонённый template не возвращается primary', () => {
  const a = resolvedQuest({ id: 'hidden-quest' });
  const b = resolvedQuest({ id: 'visible-quest' });
  const picked = BoardV2.select([a, b], {}, { hiddenTemplateIds: ['hidden-quest'] });
  assert.equal(picked.primary.templateId, 'visible-quest');
});

test('ответ Тени сохраняет не настроение вообще, а эффект конкретного действия', () => {
  const quest = resolvedQuest({
    id: 'long-stretch-recovery',
    kind: 'recovery',
    followUp: {
      interventionId: 'long-stretch',
      question: 'Тебе стало спокойнее или голова всё ещё перегружена?',
      contextTags: ['overloaded', 'tense'],
    },
  });
  const memory = BoardV2.recordOutcome(BoardV2.emptyMemory(), quest, 'helped', '2026-08-24');
  assert.deepEqual(memory.records[0], {
    interventionId: 'long-stretch',
    outcome: 'helped',
    contextTags: ['overloaded', 'tense'],
    at: '2026-08-24',
  });
});

test('Тень может найти уже опробованное решение для похожего состояния', () => {
  const memory = {
    schema: BoardV2.MEMORY_SCHEMA,
    records: [
      { interventionId: 'long-stretch', outcome: 'helped', contextTags: ['overloaded', 'tense'], at: '2026-08-20' },
      { interventionId: 'doomscroll-break', outcome: 'did-not-help', contextTags: ['overloaded'], at: '2026-08-21' },
      { interventionId: 'long-stretch', outcome: 'helped', contextTags: ['overloaded'], at: '2026-08-22' },
    ],
  };
  assert.deepEqual(BoardV2.knownHelp(memory, ['overloaded']), [
    { interventionId: 'long-stretch', score: 4 },
  ]);
});

test('квест без follow-up не создаёт выдуманную психологическую память', () => {
  const quest = resolvedQuest({ followUp: null });
  const before = BoardV2.emptyMemory();
  assert.deepEqual(BoardV2.recordOutcome(before, quest, 'helped', '2026-08-24'), before);
});

test('повреждённая outcome memory нормализуется fail-closed и ограничена 100 записями', () => {
  const records = Array.from({ length: 110 }, (_, i) => ({
    interventionId: `safe-${i}`,
    outcome: 'helped',
    contextTags: ['overloaded'],
    at: '2026-08-24',
  }));
  records.unshift({ interventionId: 'bad', outcome: 'yes', contextTags: [], at: 'today' });
  const normalized = BoardV2.normalizeMemory({ records });
  assert.equal(normalized.records.length, 100);
  assert.equal(normalized.records.some((record) => record.interventionId === 'bad'), false);
});
