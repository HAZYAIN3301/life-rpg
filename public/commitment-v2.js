/* Satoru Commitment v2 — уговор про внимание + миграция v1 без потери истории.
 *
 * v1 остаётся нетронутым: его файл не меняется, его двадцать тестов продолжают
 * проверять его же. Это не педантизм. Файл уговоров у человека уже лежит на диске,
 * и он единственный, где записано, что человек решил про себя в ресурсном
 * состоянии. Ошибка в миграции стирает не строку в базе, а его собственные слова.
 *
 * Зачем v2. Разбор 01.09 разделил два провала и показал, что секретарь работает не
 * потому, что «замечает момент», а потому что держит решение ресурсного человека и
 * возвращает его истощённому — его же формулировкой. Router уже умеет цитировать
 * уговор (`ownWords`), но словарь v1 не мог описать самое частое решение владельца:
 *
 *     «В TikTok захожу только выложить ролик. Двенадцать минут. Дальше выхожу.»
 *
 * Это не привычка (та про объём за день), не схватка (та про десятисекундный
 * момент) и не `edge` (та про границу дня, а не занятия). Отсюда шестой вид —
 * `attention` — и шестой вид границы, `duration`: «двенадцать минут» не выражается
 * ни временем суток, ни окном.
 *
 * ⚠️ Что здесь НЕ изменилось и почему трогать нельзя:
 *  — словарь журнала остался `'win' | 'miss'`. Перевод его в булевы ничего не давал
 *    бы и стоил бы всей истории отметок при первом же чтении старого файла;
 *  — выигрыш по-прежнему обязателен (гейт §5): граница без названного выигрыша
 *    становится ещё одним способом быть собой недовольным;
 *  — ни XP, ни золота, ни серий-штрафов. Провал уговора не отнимает ничего, и здесь
 *    нет функции, к которой это можно подключить;
 *  — молчание не поражение: `unsettled` и `silent` в `dayScore` отдают неотмеченное
 *    отдельно, а `streakOf` рядом с серией отдаёт `recorded`, чтобы «14 подряд»
 *    нельзя было показать, умолчав, что записано три дня из четырнадцати;
 *  — архивация вместо удаления: история — единственное основание понять, подходил
 *    ли уговор этому человеку.
 *
 * ⚠️ Приватность `target`: это ярлык, который человек выбрал сам («tiktok», «игры»),
 * а не адрес, домен и не что-либо, прочитанное с экрана. Обрезается до 40 символов
 * и никуда не отправляется — тот же запрет, что на `ref` в словаре событий.
 *
 * Чистый модуль: только данные на входе, все операции иммутабельны.
 */
(function exposeCommitmentV2(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CommitmentV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCommitmentV2() {
  'use strict';

  const VERSION = '2.0.0';

  const MAX_ITEMS = 12;
  const MAX_TITLE = 80;
  const MAX_WIN = 120;
  const MAX_TARGET = 40;

  // Пять видов v1 плюс attention. Список закрытый: открытый превратил бы уговор в
  // «объект про всё», ради ухода от которого он и выделялся из четырёх реализаций.
  const KINDS = Object.freeze({
    step:      'step',       // §2 — одно первое действие, решённое накануне
    edge:      'edge',       // §1 — граница блока/дня по времени
    moment:    'moment',     // §8 — короткий момент разлома (мост к fights-v1)
    anchor:    'anchor',     // §13 — якорь подъёма, единственный рычаг сна
    care:      'care',       // §10/§14 — пункт заботы о себе до работы
    attention: 'attention',  // v2 — граница конкретного занятия, решённая заранее
  });
  // Виды, существовавшие в v1. Нужны миграции и тесту совместимости.
  const V1_KINDS = Object.freeze(['step', 'edge', 'moment', 'anchor', 'care']);

  const DEFAULT_MODE = 'default';

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }
  function isTime(s) { return typeof s === 'string' && HHMM.test(s); }

  function dayShift(day, delta) {
    if (!isDay(day)) return null;
    const t = Date.parse(day + 'T00:00:00Z');
    if (isNaN(t)) return null;
    return new Date(t + delta * 86400000).toISOString().slice(0, 10);
  }
  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  function emptyState() { return { version: 2, mode: DEFAULT_MODE, items: [], log: {} }; }

  function cleanEdge(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'none' };
    if (raw.kind === 'time' && isTime(raw.at)) return { kind: 'time', at: raw.at };
    if (raw.kind === 'window' && isTime(raw.from) && isTime(raw.to)) return { kind: 'window', from: raw.from, to: raw.to };
    if (raw.kind === 'trigger' && typeof raw.on === 'string' && raw.on.trim()) {
      return { kind: 'trigger', on: raw.on.trim().slice(0, 40) };
    }
    // v2: граница длительностью. Потолок в 600 минут — не ограничение свободы, а
    // защита от опечатки, которая иначе молча превратится в «десять часов можно».
    if (raw.kind === 'duration') {
      const m = Math.floor(Number(raw.minutes));
      if (Number.isFinite(m) && m >= 1 && m <= 600) return { kind: 'duration', minutes: m };
    }
    return { kind: 'none' };
  }

  function cleanBudget(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const misses = Math.floor(Number(raw.misses));
    const perDays = Math.floor(Number(raw.perDays));
    if (!Number.isFinite(misses) || misses < 1 || misses > 7) return null;
    if (!Number.isFinite(perDays) || perDays < 2 || perDays > 60) return null;
    return { misses, perDays };
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const win = typeof raw.win === 'string' ? raw.win.trim() : '';
    if (!id || !title || !win) return null;
    if (!Object.prototype.hasOwnProperty.call(KINDS, raw.kind)) return null;
    const out = {
      id,
      kind: raw.kind,
      title: title.slice(0, MAX_TITLE),
      win: win.slice(0, MAX_WIN),
      edge: cleanEdge(raw.edge),
      core: raw.core !== false,
      modes: Array.isArray(raw.modes)
        ? [...new Set(raw.modes.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim().slice(0, 24)))]
        : [],
    };
    if (isDay(raw.decidedOn)) out.decidedOn = raw.decidedOn;
    const budget = cleanBudget(raw.budget);
    if (budget) out.budget = budget;
    if (isDay(raw.archivedAt)) out.archivedAt = raw.archivedAt;
    // Ярлык занятия — только у attention, и только если человек его назвал.
    if (raw.kind === KINDS.attention && typeof raw.target === 'string' && raw.target.trim()) {
      out.target = raw.target.trim().slice(0, MAX_TARGET);
    }
    return out;
  }

  function cleanLog(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [day, rows] of Object.entries(raw)) {
      if (!isDay(day) || !rows || typeof rows !== 'object' || Array.isArray(rows)) continue;
      const clean = {};
      for (const [id, result] of Object.entries(rows)) {
        if (result === 'win' || result === 'miss') clean[id] = result;
      }
      if (Object.keys(clean).length) out[day] = clean;
    }
    return out;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const seen = new Set();
    const items = [];
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      const c = cleanItem(it);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      items.push(c);
    }
    const mode = typeof raw.mode === 'string' && raw.mode.trim() ? raw.mode.trim().slice(0, 24) : DEFAULT_MODE;
    return { version: 2, mode, items, log: cleanLog(raw.log) };
  }

  /**
   * Миграция v1 → v2. Односторонняя, неразрушающая, идемпотентная.
   *
   * ⚠️ Главное свойство: **ни один уговор и ни одна отметка не исчезают молча**.
   * Схема v2 — надмножество v1, поэтому в норме `dropped` пуст. Если запись всё же
   * не прошла (файл правили руками, диск подпортил строку), она попадает в
   * `dropped` и остаётся видимой вызывающему. Молчаливая потеря недопустима:
   * человек обнаружил бы пропажу своих решений через недели и не понял бы, когда.
   *
   * Журнал переносится целиком и без перевода значений: `'win' | 'miss'` — тот же
   * словарь, что в v1. История дороже красоты схемы.
   *
   * Состояние `version: 2` проходит насквозь: повторный вызов ничего не меняет.
   *
   * @returns {{state: object, migrated: boolean, dropped: Array<{id: ?string, why: string}>}}
   */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { state: emptyState(), migrated: false, dropped: [] };
    }
    const already = Number(raw.version) === 2;
    const dropped = [];
    const seen = new Set();
    const items = [];
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      const c = cleanItem(it);
      if (!c) { dropped.push({ id: it && typeof it.id === 'string' ? it.id : null, why: 'invalid' }); continue; }
      if (seen.has(c.id)) { dropped.push({ id: c.id, why: 'duplicate' }); continue; }
      seen.add(c.id);
      items.push(c);
    }
    const mode = typeof raw.mode === 'string' && raw.mode.trim() ? raw.mode.trim().slice(0, 24) : DEFAULT_MODE;
    return { state: { version: 2, mode, items, log: cleanLog(raw.log) }, migrated: !already, dropped };
  }

  function activeItems(state) {
    return normalize(state).items.filter((i) => !i.archivedAt);
  }

  function add(state, draft) {
    const s = normalize(state);
    const item = cleanItem(draft);
    if (!item) return { ok: false, error: 'invalid' };
    if (s.items.some((i) => i.id === item.id)) return { ok: false, error: 'duplicate' };
    if (s.items.filter((i) => !i.archivedAt).length >= MAX_ITEMS) return { ok: false, error: 'limit' };
    return { ok: true, state: { ...s, items: s.items.concat([item]) } };
  }

  function archive(state, id, day) {
    const s = normalize(state);
    if (!isDay(day)) return s;
    return { ...s, items: s.items.map((i) => (i.id === String(id) && !i.archivedAt ? { ...i, archivedAt: day } : i)) };
  }

  function setMode(state, mode) {
    const s = normalize(state);
    const next = typeof mode === 'string' && mode.trim() ? mode.trim().slice(0, 24) : DEFAULT_MODE;
    return { ...s, mode: next };
  }

  function dueOn(state, day, mode) {
    const s = normalize(state);
    const m = typeof mode === 'string' && mode.trim() ? mode.trim().slice(0, 24) : s.mode;
    return s.items.filter((i) => {
      if (i.archivedAt && isDay(day) && daysBetween(i.archivedAt, day) >= 0) return false;
      if (i.archivedAt && !isDay(day)) return false;
      if (i.decidedOn && isDay(day) && daysBetween(i.decidedOn, day) < 0) return false;
      return !i.modes.length || i.modes.includes(m);
    });
  }

  function coreOf(state, day, mode) { return dueOn(state, day, mode).filter((i) => i.core); }
  function extrasOf(state, day, mode) { return dueOn(state, day, mode).filter((i) => !i.core); }

  function mark(state, id, day, result) {
    const s = normalize(state);
    if (!isDay(day)) return s;
    if (result !== 'win' && result !== 'miss') return s;
    const key = String(id);
    if (!s.items.some((i) => i.id === key)) return s;
    return { ...s, log: { ...s.log, [day]: { ...(s.log[day] || {}), [key]: result } } };
  }

  function clearMark(state, id, day) {
    const s = normalize(state);
    if (!isDay(day) || !s.log[day]) return s;
    const row = { ...s.log[day] };
    delete row[String(id)];
    const log = { ...s.log };
    if (Object.keys(row).length) log[day] = row; else delete log[day];
    return { ...s, log };
  }

  function outcomeOf(state, id, day) {
    const s = normalize(state);
    return (s.log[day] && s.log[day][String(id)]) || null;
  }

  function streakOf(state, id, today, lookback = 120) {
    const s = normalize(state);
    const key = String(id);
    const item = s.items.find((i) => i.id === key);
    if (!item || !isDay(today)) return { streak: 0, recorded: 0, covered: 0, forgiven: 0 };
    const budget = item.budget;
    let streak = 0, recorded = 0, covered = 0, forgiven = 0;
    const missDays = [];
    for (let d = 0; d < lookback; d += 1) {
      const day = dayShift(today, -d);
      if (!day) break;
      covered += 1;
      const res = outcomeOf(s, key, day);
      if (res === null) continue;
      recorded += 1;
      if (res === 'win') { streak += 1; continue; }
      if (!budget) break;
      missDays.push(day);
      const inWindow = missDays.filter((m) => daysBetween(m, today) < budget.perDays).length;
      if (inWindow > budget.misses) break;
      forgiven += 1;
    }
    return { streak, recorded, covered, forgiven };
  }

  function unsettled(state, day, mode) {
    return dueOn(state, day, mode).filter((i) => outcomeOf(state, i.id, day) === null);
  }

  function dayScore(state, day, mode) {
    const live = dueOn(state, day, mode);
    let win = 0, miss = 0;
    for (const i of live) {
      const r = outcomeOf(state, i.id, day);
      if (r === 'win') win += 1; else if (r === 'miss') miss += 1;
    }
    return { win, miss, silent: live.length - win - miss, total: live.length };
  }

  /**
   * Самый уместный уговор, чтобы процитировать человека в разговоре о занятии.
   *
   * Router цитирует своими словами человека, и цитата про то самое занятие, которое
   * вчера утащило, весомее общего якоря подъёма. Порядок: attention с совпавшим
   * ярлыком → любой attention → якорь → граница. Сравнение ярлыков — точное после
   * приведения к нижнему регистру: угадывать «похожие» занятия здесь нельзя, иначе
   * человеку предъявят его решение про одно как решение про другое.
   *
   * Возвращает `null`, если живых уговоров нет. Выдумывать «твоё решение» запрещено.
   */
  function bestFor(state, target, day, mode) {
    const live = (isDay(day) ? dueOn(state, day, mode) : activeItems(state)).filter((i) => !i.archivedAt);
    if (!live.length) return null;
    const key = typeof target === 'string' ? target.trim().toLowerCase() : '';
    if (key) {
      const exact = live.find((i) => i.kind === KINDS.attention && typeof i.target === 'string' && i.target.toLowerCase() === key);
      if (exact) return exact;
    }
    return live.find((i) => i.kind === KINDS.attention)
      || live.find((i) => i.kind === KINDS.anchor)
      || live.find((i) => i.kind === KINDS.edge)
      || live[0];
  }

  return Object.freeze({
    VERSION, MAX_ITEMS, MAX_TITLE, MAX_WIN, MAX_TARGET, KINDS, V1_KINDS, DEFAULT_MODE,
    emptyState, normalize, migrate, activeItems,
    add, archive, setMode,
    dueOn, coreOf, extrasOf,
    mark, clearMark, outcomeOf,
    streakOf, unsettled, dayScore, bestFor,
  });
});
