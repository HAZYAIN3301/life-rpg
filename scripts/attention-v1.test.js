'use strict';
/* Контракты внимания: политика → сессия → эпизод (DISCIPLINE-ESCAPE-PLAN §9–§11, §17).
 *
 * Тест сторожит три класса вещей, и только первый из них — арифметика:
 *  🔴 этические гейты — их потеря превращает механику в машину вины;
 *  🏁 гонки и повторы — §17 прямо требует, чтобы продление и аварийный выход нельзя
 *     было удвоить обновлением страницы, ретраем или вторым устройством;
 *  📉 честность цифр — доля без знаменателя врёт, а `unknown` не смеет стать `escaped`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const P = require('../public/attention-policy-v1.js');
const S = require('../public/attention-session-v1.js');
const E = require('../public/attention-episode-v1.js');

const T = (min) => new Date(Date.UTC(2026, 7, 25, 10, min, 0)).toISOString();
const DAY_AGO = (d) => new Date(Date.UTC(2026, 7, 25, 10, 0, 0) - d * 86400000).toISOString();

function tiktok() { return P.upsert(P.emptyState(), P.PRESETS.tiktok).state; }

function openSession(over = {}) {
  return S.start(S.emptyState(), Object.assign({
    id: 's1', policyId: 'tiktok', purpose: 'publish', plannedMinutes: 12,
    mode: 'control', extensionsAllowed: 1, extensionMinutes: 5,
  }, over), T(0));
}

// ── Политика ────────────────────────────────────────────────────────────────

test('нормализация переживает мусор во всех трёх модулях', () => {
  for (const junk of [null, undefined, 7, 'нет', [], { policies: 'x' }, { sessions: {} }, { episodes: 5 }]) {
    assert.deepEqual(P.normalize(junk).policies, []);
    assert.deepEqual(S.normalize(junk).sessions, []);
    assert.deepEqual(E.normalize(junk).episodes, []);
  }
});

test('политика без единой цели бессмысленна и не принимается', () => {
  assert.equal(P.upsert(P.emptyState(), { id: 'x', name: 'X', purposes: [] }).ok, false);
  assert.equal(P.upsert(P.emptyState(), { id: 'x', name: 'X' }).ok, false);
});

test('🔴 рабочая цель не открывается без объявленного результата', () => {
  // §4: работа доказывается результатом. Иначе «я по работе» — бесплатная отмазка.
  const s = P.upsert(P.emptyState(), {
    id: 'ig', name: 'Instagram',
    purposes: [{ purpose: 'reply', defaultMinutes: 10, mode: 'trust' }],   // без outcome
  }).state;
  assert.equal(P.canOpen(s, 'ig', 'reply', {}).reason, 'outcome_required');
  assert.equal(P.canOpen(s, 'ig', 'reply', { expectedOutcome: 'ответил пятерым' }).ok, true);
});

test('🔴 «поискать вдохновение» без темы не считается рабочей целью', () => {
  const s = tiktok();
  assert.equal(P.canOpen(s, 'tiktok', 'research', {}).reason, 'topic_required');
  assert.equal(P.canOpen(s, 'tiktok', 'research', { topic: 'переходы' }).ok, true);
});

test('🔴 «пока не знаю» в control не открывает окно', () => {
  // §10. Именно этот вход и заканчивается лентой.
  const s = P.upsert(P.emptyState(), {
    id: 'yt', name: 'YouTube',
    purposes: [{ purpose: 'unsure', defaultMinutes: 5, mode: 'control' }],
  }).state;
  assert.equal(P.canOpen(s, 'yt', 'unsure', {}).reason, 'unsure_in_control');

  const soft = P.upsert(P.emptyState(), {
    id: 'yt', name: 'YouTube',
    purposes: [{ purpose: 'unsure', defaultMinutes: 5, mode: 'trust' }],
  }).state;
  assert.equal(P.canOpen(soft, 'yt', 'unsure', {}).ok, true, 'в доверии право не знать остаётся');
});

test('выключенная цель закрыта, и профиль Альберта никому не навязан', () => {
  const s = tiktok();
  assert.equal(P.canOpen(s, 'tiktok', 'rest', {}).reason, 'purpose_disabled');
  // §8 п.4: пресет — предложение. Пустое состояние не содержит ничьих запретов.
  assert.deepEqual(P.normalize(P.emptyState()).policies, []);
});

test('окно полного закрытия работает и через полночь', () => {
  const s = P.upsert(P.emptyState(), {
    id: 'tt', name: 'TikTok', quietHours: { from: '23:00', to: '07:00' },
    purposes: [{ purpose: 'publish', defaultMinutes: 10, mode: 'trust', outcome: 'опубликовано' }],
  }).state;
  const pol = P.policyById(s, 'tt');
  assert.equal(P.inQuietHours(pol, '23:30'), true);
  assert.equal(P.inQuietHours(pol, '03:00'), true);
  assert.equal(P.inQuietHours(pol, '12:00'), false);
  assert.equal(P.canOpen(s, 'tt', 'publish', { now: '23:30' }).reason, 'quiet_hours');
});

test('режимы дня: политика без modes живёт всегда', () => {
  const s = P.upsert(P.emptyState(), {
    id: 'tt', name: 'TikTok', modes: ['school'],
    purposes: [{ purpose: 'publish', defaultMinutes: 10, mode: 'trust', outcome: 'опубликовано' }],
  }).state;
  assert.equal(P.canOpen(s, 'tt', 'publish', { mode: 'trip' }).reason, 'wrong_mode');
  assert.equal(P.canOpen(s, 'tt', 'publish', { mode: 'school' }).ok, true);
});

test('двухминутный setup: одно приложение, одна цель, разумные defaults', () => {
  // §9 гейт против «продуктивной настройки вместо дела».
  const p = P.minimalPolicy('tt', 'TikTok', 'rest', 10);
  assert.ok(p, 'минимальная политика обязана собираться без заполнения всех полей');
  assert.equal(p.purposes.length, 1);
  assert.equal(p.emergency.delaySeconds, P.DEFAULT_EMERGENCY.delaySeconds);
});

test('🔴 в API политики нет ничего, что ужесточает правила само', () => {
  // §8: политики никогда не меняются автоматически по статистике.
  const surface = Object.keys(P).join(' ').toLowerCase();
  for (const bad of ['tighten', 'autoapply', 'enforce', 'punish', 'xp', 'gold']) {
    assert.equal(surface.includes(bad), false, `в API политики появилось «${bad}»`);
  }
});

// ── Сессия ──────────────────────────────────────────────────────────────────

test('окно считает дедлайн, продление сдвигает границу', () => {
  const r = openSession();
  assert.equal(r.ok, true);
  assert.equal(S.deadlineAt(r.session), T(12));
  assert.equal(S.isOver(r.session, T(13)), true);
  const e = S.extend(r.state, 's1', { seq: 0 }, T(12));
  assert.equal(e.ok, true);
  assert.equal(S.isOver(e.session, T(13)), false, 'после продления граница должна отодвинуться');
  assert.equal(S.deadlineAt(e.session), T(17));
});

test('🏁 повторное продление тем же запросом не удваивается', () => {
  // §17: refresh/retry/multi-device race не имеет права дать два продления.
  const r = openSession({ extensionsAllowed: 2 });
  const first = S.extend(r.state, 's1', { seq: 0 }, T(12));
  assert.equal(first.ok, true);
  const replay = S.extend(first.state, 's1', { seq: 0 }, T(12));   // тот же seq — повтор
  assert.equal(replay.ok, false);
  assert.equal(replay.error, 'stale');
  const fresh = S.extend(first.state, 's1', { seq: 1 }, T(13));    // осознанное второе
  assert.equal(fresh.ok, true);
  assert.equal(fresh.session.extensions.length, 2);
});

test('продления заканчиваются, и это не ошибка вызывающего', () => {
  const r = openSession({ extensionsAllowed: 1 });
  const e = S.extend(r.state, 's1', { seq: 0 }, T(12));
  assert.equal(S.extend(e.state, 's1', { seq: 1 }, T(13)).error, 'no_extensions_left');
});

test('🔴 аварийный выход требует выждать задержку', () => {
  const r = openSession();
  const rule = { passes: 1, perDays: 7, delaySeconds: 90 };
  assert.equal(S.useEmergency(r.state, 's1', {}, T(5), rule).error, 'delay_required');
  const ok = S.useEmergency(r.state, 's1', { delayConfirmed: true, reason: 'звонок' }, T(5), rule);
  assert.equal(ok.ok, true);
  assert.equal(ok.session.emergency.reason, 'звонок');
});

test('🏁 бюджет аварийных выходов считается по политике, а не по сессии', () => {
  // Иначе «один пропуск в неделю» стал бы одним на каждый заход — то есть кнопкой.
  const rule = { passes: 1, perDays: 7, delaySeconds: 0 };
  let st = openSession().state;
  st = S.useEmergency(st, 's1', {}, T(5), rule).state;
  st = S.close(st, 's1', 'done', T(6)).state;

  const second = S.start(st, {
    id: 's2', policyId: 'tiktok', purpose: 'publish', plannedMinutes: 12, mode: 'control',
  }, T(20));
  const denied = S.useEmergency(second.state, 's2', {}, T(21), rule);
  assert.equal(denied.error, 'budget_spent', 'второй пропуск в том же окне обязан быть отклонён');
});

test('бюджет восстанавливается за пределами окна', () => {
  const rule = { passes: 1, perDays: 7, delaySeconds: 0 };
  let st = S.start(S.emptyState(), {
    id: 'old', policyId: 'tiktok', purpose: 'publish', plannedMinutes: 12, mode: 'control',
  }, DAY_AGO(30)).state;
  st = S.useEmergency(st, 'old', {}, DAY_AGO(30), rule).state;
  st = S.close(st, 'old', 'done', DAY_AGO(30), rule).state || st;

  const fresh = S.start(S.normalize(st), {
    id: 'new', policyId: 'tiktok', purpose: 'publish', plannedMinutes: 12, mode: 'control',
  }, T(0));
  assert.equal(S.useEmergency(fresh.state, 'new', {}, T(1), rule).ok, true);
});

test('🔴 только одно открытое окно одновременно', () => {
  const r = openSession();
  const second = S.start(r.state, { id: 's2', policyId: 'yt', purpose: 'watch', plannedMinutes: 30 }, T(1));
  assert.equal(second.error, 'already_open');
});

test('🔴 сессия хранит снимок правил: смена политики не меняет идущее окно', () => {
  const r = openSession({ mode: 'control', extensionsAllowed: 0 });
  // Даже если политику потом ослабили, у этой сессии продлений по-прежнему нет.
  assert.equal(S.canExtend(r.session), false);
  assert.equal(S.boundaryOptions(r.session, T(13)).hardStop, true);
});

test('🔴 «меня унесло» не выставляется автоматически', () => {
  // §17: unknown не превращается в escape. Исход называет человек.
  const r = openSession();
  const opts = S.boundaryOptions(r.session, T(60));
  assert.equal(opts.over, true);
  assert.equal('outcome' in opts, false, 'граница не имеет права назначать исход');
  const closed = S.close(r.state, 's1', 'что-то левое', T(60));
  assert.equal(closed.session.outcome, 'unknown', 'негодный исход падает в unknown, не в escaped');
});

test('🔴 в API сессии нет наказаний', () => {
  const surface = Object.keys(S).join(' ').toLowerCase();
  for (const bad of ['xp', 'gold', 'penalt', 'punish', 'debt', 'streak']) {
    assert.equal(surface.includes(bad), false, `в API сессии появилось «${bad}»`);
  }
});

// ── Эпизод и калибровка ─────────────────────────────────────────────────────

function withEpisodes(rows) {
  let st = E.emptyState();
  rows.forEach((row, i) => {
    st = E.record(st, Object.assign({
      id: 'e' + i, sourcePolicyId: 'tiktok', declaredPurpose: 'research',
      startedAt: DAY_AGO(1), endedAt: DAY_AGO(1), outcome: 'done',
    }, row)).state;
  });
  return st;
}

test('🏁 повторная доставка эпизода не создаёт дубль', () => {
  // §17: retry не теряет эпизод и не создаёт дубль.
  let st = withEpisodes([{ outcome: 'done' }]);
  st = E.record(st, { id: 'e0', sourcePolicyId: 'tiktok', declaredPurpose: 'research', startedAt: DAY_AGO(1), outcome: 'escaped' }).state;
  assert.equal(E.normalize(st).episodes.length, 1, 'тот же id обязан перезаписать, а не удвоить');
  assert.equal(E.byId(st, 'e0').outcome, 'escaped');
});

test('📉 молчание не входит в знаменатель и не считается срывом', () => {
  const st = withEpisodes([
    { outcome: 'escaped' }, { outcome: 'done' }, { outcome: 'unknown' }, { outcome: 'unknown' },
  ]);
  const c = E.calibration(st, 'tiktok', 'research', T(0));
  assert.equal(c.total, 4);
  assert.equal(c.recorded, 2, 'unknown обязан быть вне знаменателя');
  assert.equal(c.silent, 2);
  assert.equal(c.offPlan, 1);
});

test('📉 доля не отдаётся, пока данных мало', () => {
  const few = withEpisodes([{ outcome: 'escaped' }]);
  const c1 = E.calibration(few, 'tiktok', 'research', T(0));
  assert.equal(c1.enough, false);
  assert.equal(c1.ratio, null, 'на одном наблюдении «100%» — арифметическая правда и смысловая ложь');

  const enough = withEpisodes([
    { outcome: 'escaped' }, { outcome: 'escaped' }, { outcome: 'escaped' },
    { outcome: 'escaped' }, { outcome: 'done' },
  ]);
  const c2 = E.calibration(enough, 'tiktok', 'research', T(0));
  assert.equal(c2.enough, true);
  assert.equal(c2.recorded, 5);
  assert.equal(c2.offPlan, 4);
  assert.equal(c2.ratio, 0.8, '«4 из 5» — та самая честная строка из §10');
});

test('📉 знаменатель виден всегда, даже когда доля посчитана', () => {
  const st = withEpisodes(Array(5).fill({ outcome: 'escaped' }));
  const c = E.calibration(st, 'tiktok', 'research', T(0));
  for (const k of ['recorded', 'offPlan', 'total', 'minRecorded']) {
    assert.ok(Object.prototype.hasOwnProperty.call(c, k), `калибровка обязана отдавать ${k}`);
  }
});

test('старые эпизоды выпадают из окна наблюдения', () => {
  const st = withEpisodes([
    { startedAt: DAY_AGO(30), outcome: 'escaped' },
    { startedAt: DAY_AGO(1), outcome: 'done' },
  ]);
  assert.equal(E.calibration(st, 'tiktok', 'research', T(0)).recorded, 1);
});

test('предложение появляется только при достаточных данных и ничего не меняет', () => {
  const few = withEpisodes([{ outcome: 'escaped' }]);
  assert.deepEqual(E.suggestions(few, 'tiktok', T(0)), []);

  const st = withEpisodes(Array(5).fill({ outcome: 'escaped' }));
  const sug = E.suggestions(st, 'tiktok', T(0));
  assert.equal(sug.length, 1);
  assert.equal(sug[0].purpose, 'research');
  // 🔴 Ключевое: это ФАКТ, а не действие. Политику модуль не трогает.
  const surface = Object.keys(E).join(' ').toLowerCase();
  for (const bad of ['apply', 'tighten', 'setmode', 'updatepolicy']) {
    assert.equal(surface.includes(bad), false, `в API эпизодов появилось «${bad}»`);
  }
});

test('📉 returnLatency не выдумывается при неизвестных отметках', () => {
  const st = withEpisodes([
    { id: 'known', endedAt: T(0), returnedAt: T(20) },
    { id: 'noreturn', endedAt: T(0) },
  ]);
  assert.equal(E.returnLatencyMin(E.byId(st, 'known')), 20);
  assert.equal(E.returnLatencyMin(E.byId(st, 'noreturn')), null, 'без returnedAt — «не измерено», а не ноль');
});

test('медиана длины срыва — метрика догфуда, а не «ноль срывов»', () => {
  // §17: целимся в сокращение (24ч → ≤3ч), а не в отсутствие. Ноль как критерий
  // воспроизводит ловушку «больше никогда».
  const st = withEpisodes([
    { outcome: 'escaped', actualMinutes: 60 },
    { outcome: 'escaped', actualMinutes: 180 },
    { outcome: 'escaped', actualMinutes: 1440 },
    { outcome: 'done', actualMinutes: 10 },
  ]);
  assert.equal(E.escapeLengthMedianMin(st, T(0)), 180);
  assert.equal(E.escapeLengthMedianMin(E.emptyState(), T(0)), null, 'без срывов — null, а не ноль');
});

test('эпизод без известной длительности не искажает медиану', () => {
  const st = withEpisodes([
    { outcome: 'escaped', actualMinutes: null, endedAt: undefined },
    { outcome: 'escaped', actualMinutes: 120 },
  ]);
  assert.equal(E.escapeLengthMedianMin(st, T(0)), 120);
});

test('человек может исправить и удалить свою запись о себе', () => {
  let st = withEpisodes([{ outcome: 'escaped' }]);
  st = E.amend(st, 'e0', { outcome: 'rested', note: 'на самом деле осознанно отдыхал' }).state;
  assert.equal(E.byId(st, 'e0').outcome, 'rested');
  st = E.remove(st, 'e0');
  assert.equal(E.normalize(st).episodes.length, 0);
});

// ── Сцепка ──────────────────────────────────────────────────────────────────

test('сессия превращается в эпизод без потери намерения', () => {
  let r = openSession({ purpose: 'research', topic: 'переходы', expectedOutcome: 'три референса' });
  r = S.extend(r.state, 's1', { seq: 0 }, T(12));
  const closed = S.close(r.state, 's1', 'escaped', T(30));
  const ep = S.toEpisode(closed.session);

  assert.equal(ep.declaredPurpose, 'research');
  assert.equal(ep.topic, 'переходы', 'тема обязана дожить до журнала');
  assert.equal(ep.expectedOutcome, 'три референса');
  assert.equal(ep.extensionCount, 1);
  assert.equal(ep.plannedMinutes, 17, 'выданное время = план + продления');
  assert.equal(ep.actualMinutes, 30);
  assert.equal(ep.outcome, 'escaped');

  // И этот эпизод принимается журналом как есть.
  assert.equal(E.record(E.emptyState(), ep).ok, true);
});

test('незакрытая сессия эпизодом не становится', () => {
  const r = openSession();
  assert.equal(S.toEpisode(r.session), null);
});

test('операции всех трёх модулей иммутабельны', () => {
  const p0 = tiktok(); const pBefore = JSON.stringify(p0);
  P.upsert(p0, P.PRESETS.youtube); P.remove(p0, 'tiktok');
  assert.equal(JSON.stringify(p0), pBefore, 'политика мутировала вход');

  const s0 = openSession().state; const sBefore = JSON.stringify(s0);
  S.extend(s0, 's1', { seq: 0 }, T(12)); S.close(s0, 's1', 'done', T(13));
  assert.equal(JSON.stringify(s0), sBefore, 'сессия мутировала вход');

  const e0 = withEpisodes([{ outcome: 'done' }]); const eBefore = JSON.stringify(e0);
  E.record(e0, { id: 'z', sourcePolicyId: 'tiktok', declaredPurpose: 'research', startedAt: T(0) });
  E.remove(e0, 'e0');
  assert.equal(JSON.stringify(e0), eBefore, 'журнал мутировал вход');
});

test('все три модуля чистые: ни DOM, ни State, ни сети', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const f of ['attention-policy-v1.js', 'attention-session-v1.js', 'attention-episode-v1.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    for (const bad of ['document', 'localStorage', 'fetch(', 'State.', 'window.State']) {
      assert.equal(body.includes(bad), false, `${f} потянулся к «${bad}»`);
    }
  }
});

test('🔴 ни один модуль не хранит, ЧТО человек смотрел', () => {
  // §14: ни ссылок, ни запросов, ни истории. Тема поиска — единственное исключение,
  // и она названа человеком заранее, а не собрана слежкой.
  const ep = E.record(E.emptyState(), {
    id: 'x', sourcePolicyId: 'tiktok', declaredPurpose: 'research', startedAt: T(0),
    url: 'https://tiktok.com/@someone', query: 'что я искал', watched: ['видео1'],
  }).state;
  const stored = E.byId(ep, 'x');
  for (const leak of ['url', 'query', 'watched']) {
    assert.equal(leak in stored, false, `в эпизод просочилось поле «${leak}»`);
  }
});
