/* Satoru Fights v1 — схватки (DISCIPLINE-ARENA-PLAN §1, решения §15).
 *
 * Сквозная находка документа: страдание без формы унижает, то же страдание с
 * формой — именем, счётом, длительностью — становится игрой. Потерянный день
 * не был восемнадцатью часами борьбы; он был четырьмя короткими моментами,
 * и всё остальное вытекло из них автоматически.
 *
 * Схватка ≠ привычка. Привычка отвечает на «сделал ли ты X за 30 минут» — это
 * про объём. Схватка отвечает на «выиграл ли ты десятисекундный момент» — это
 * про точку разлома. Разные объекты, и отсюда `MAX_SECONDS`: как только момент
 * перестаёт быть коротким, это уже дело, а не схватка, и его место в квестах.
 *
 * Решения Альберта 07.08 (§15): вариант C (ручные + предложения из детектора),
 * потолок 5, счёт приватный. §10 (зоны) схлопнут сюда: «вход в опасную зону» —
 * это и есть схватка с триггером-моментом, а не отдельная подсистема.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ считает XP, золото, урон серии и любые штрафы. Гейт §13: проигранная
 *    схватка ничего не отнимает, иначе получается Duolingo-вина через заднюю
 *    дверь. Здесь нет ни одной функции, которую можно было бы к этому
 *    подключить, и это намеренно;
 *  — НЕ отдаёт ничего для лидерборда и пати: счёт приватный (§15). Экспорт
 *    наружу пришлось бы добавлять специально — случайно это не произойдёт;
 *  — НЕ считает неотмеченную схватку проигранной. Молчание — не поражение;
 *  — НЕ возвращает готовых фраз: только сырые значения и идентификаторы,
 *    текст на языке пользователя собирает вызывающий код (RU/EN/DE/UK/ES).
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Все операции иммутабельны — возвращают новое состояние, сохраняет вызывающий.
 */
(function exposeFights(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FightsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildFights() {
  'use strict';

  const VERSION = '1.0.0';

  // Потолок из §15. Больше — снова шум и снова та же ошибка, что с восемью
  // паттернами: назвать человеку восемь его проблем — способ не починить ни одной.
  const MAX_FIGHTS = 5;

  // Схватка обязана оставаться короткой — в этом вся идея. Пять минут это уже
  // щедрая граница: примеры из плана — 4 секунды (будильник), 10 секунд (рука
  // к телефону), минута (первое действие блока).
  const MIN_SECONDS = 1;
  const MAX_SECONDS = 300;
  const MAX_TITLE = 60;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const RESULTS = ['won', 'lost'];

  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }

  function emptyState() { return { version: 1, fights: [], log: {} }; }

  function cleanTrigger(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.kind === 'time' && typeof raw.at === 'string' && HHMM.test(raw.at)) {
      return { kind: 'time', at: raw.at };
    }
    // Момент без часов: «вход в опасную зону», «первое действие блока».
    // Именно сюда схлопнулся §10 — место называет сам человек, геолокации нет
    // и не будет (гейт §13: не трекать геолокацию ради зон).
    if (raw.kind === 'moment') return { kind: 'moment' };
    return null;
  }

  function cleanFight(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title == null ? '' : raw.title).trim().slice(0, MAX_TITLE);
    if (!title) return null;
    const secs = Math.round(Number(raw.seconds));
    if (!Number.isFinite(secs) || secs < MIN_SECONDS || secs > MAX_SECONDS) return null;
    const id = raw.id == null ? null : String(raw.id);
    if (!id) return null;
    const out = { id, title, seconds: secs, trigger: cleanTrigger(raw.trigger) };
    if (isDay(raw.createdAt)) out.createdAt = raw.createdAt;
    if (isDay(raw.archivedAt)) out.archivedAt = raw.archivedAt;
    if (typeof raw.fromPattern === 'string' && raw.fromPattern) out.fromPattern = raw.fromPattern;
    return out;
  }

  /** Терпимое чтение чужих/старых данных: мусор отбрасывается, а не роняет экран. */
  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fights = [];
    const seen = new Set();
    for (const f of Array.isArray(src.fights) ? src.fights : []) {
      const c = cleanFight(f);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      fights.push(c);
    }
    const log = {};
    const srcLog = src.log && typeof src.log === 'object' ? src.log : {};
    for (const day of Object.keys(srcLog)) {
      if (!isDay(day)) continue;
      const row = srcLog[day];
      if (!row || typeof row !== 'object') continue;
      const kept = {};
      for (const fid of Object.keys(row)) {
        if (seen.has(fid) && RESULTS.includes(row[fid])) kept[fid] = row[fid];
      }
      if (Object.keys(kept).length) log[day] = kept;
    }
    return { version: 1, fights, log };
  }

  function activeFights(state) {
    return normalize(state).fights.filter((f) => !f.archivedAt);
  }

  /**
   * @returns {{ok:true, state:object}|{ok:false, error:string}}
   * error: 'limit' | 'invalid'
   */
  function addFight(state, draft) {
    const s = normalize(state);
    const fight = cleanFight(draft);
    if (!fight) return { ok: false, error: 'invalid' };
    if (s.fights.filter((f) => !f.archivedAt).length >= MAX_FIGHTS) return { ok: false, error: 'limit' };
    if (s.fights.some((f) => f.id === fight.id)) return { ok: false, error: 'invalid' };
    return { ok: true, state: { ...s, fights: s.fights.concat([fight]) } };
  }

  /**
   * Архив, а не удаление: прошлые отметки остаются честными. Стереть историю
   * задним числом — значит соврать в собственной статистике.
   */
  function archiveFight(state, id, day) {
    const s = normalize(state);
    const at = isDay(day) ? day : null;
    return {
      ...s,
      fights: s.fights.map((f) => (f.id === String(id) && !f.archivedAt ? { ...f, archivedAt: at || f.createdAt || '1970-01-01' } : f)),
    };
  }

  /** Отметить исход. result: 'won' | 'lost'. Некорректный вход — состояние не меняется. */
  function mark(state, fightId, day, result) {
    const s = normalize(state);
    const fid = String(fightId);
    if (!isDay(day) || !RESULTS.includes(result)) return s;
    if (!s.fights.some((f) => f.id === fid)) return s;
    const row = { ...(s.log[day] || {}) };
    row[fid] = result;
    return { ...s, log: { ...s.log, [day]: row } };
  }

  /** Снять отметку — обратный ход без последствий (асимметрия входа/выхода). */
  function clearMark(state, fightId, day) {
    const s = normalize(state);
    if (!isDay(day) || !s.log[day]) return s;
    const row = { ...s.log[day] };
    delete row[String(fightId)];
    const log = { ...s.log };
    if (Object.keys(row).length) log[day] = row; else delete log[day];
    return { ...s, log };
  }

  /**
   * Счёт дня. `undecided` существует отдельно и НИКОГДА не сливается с `lost`:
   * не отметил — не проиграл. Иначе человек, забывший открыть приложение,
   * наутро получает 0:5 и вывод про себя, которого он не делал.
   *
   * @returns {{won:number, lost:number, undecided:number, total:number}}
   */
  function dayScore(state, day) {
    const s = normalize(state);
    const live = s.fights.filter((f) => !f.archivedAt || (isDay(day) && f.archivedAt > day));
    const row = (isDay(day) && s.log[day]) || {};
    let won = 0, lost = 0;
    for (const f of live) {
      if (row[f.id] === 'won') won += 1;
      else if (row[f.id] === 'lost') lost += 1;
    }
    return { won, lost, undecided: live.length - won - lost, total: live.length };
  }

  /**
   * Главное число фичи: сколько всего секунд настоящей борьбы в дне.
   * План §1: «без этой цифры фича превращается в обычный чеклист». Именно она
   * переворачивает рамку — день это не восемнадцать часов провала, а минута
   * коротких решений.
   */
  function secondsPerDay(state) {
    return activeFights(state).reduce((sum, f) => sum + f.seconds, 0);
  }

  /**
   * Арифметика по схватке за период — материал для рамки «проигранная схватка
   * это второй акт, а не приговор» (§1) и для контекста провала (§4: числа,
   * а не утешение). Диапазон включительный.
   */
  function fightStats(state, fightId, from, to) {
    const s = normalize(state);
    const fid = String(fightId);
    let won = 0, lost = 0, lastResult = null, lastDay = null;
    for (const day of Object.keys(s.log).sort()) {
      if (isDay(from) && day < from) continue;
      if (isDay(to) && day > to) continue;
      const r = s.log[day][fid];
      if (r === 'won') won += 1;
      else if (r === 'lost') lost += 1;
      else continue;
      lastResult = r; lastDay = day;
    }
    const decided = won + lost;
    return { won, lost, decided, rate: decided ? won / decided : null, lastResult, lastDay };
  }

  // ── Вариант B/C: предложения из уже посчитанных паттернов ───────────────────
  // Ключи — id из BOUNDARY_PATTERNS. Возвращаются СЫРЫЕ идентификаторы, а не
  // русские строки: название схватки человек всё равно правит под себя, а текст
  // предложения собирает вызывающий код через t(). Детектор уже построен — его
  // выхлоп сейчас уходит только в промпт ИИ, а мог бы порождать схватки.
  const SUGGESTIONS = {
    nightdebt: { suggestionId: 'evening-phone', seconds: 10, trigger: { kind: 'time', at: '23:00' } },
    nostart: { suggestionId: 'first-action', seconds: 60, trigger: { kind: 'moment' } },
    noend: { suggestionId: 'close-laptop', seconds: 30, trigger: { kind: 'time', at: '21:00' } },
    weekend: { suggestionId: 'weekend-start', seconds: 60, trigger: { kind: 'moment' } },
    norecover: { suggestionId: 'return-one-small', seconds: 60, trigger: { kind: 'moment' } },
  };

  /**
   * `norest` намеренно без предложения: отдых — не схватка. Превратить отдых в
   * ещё один выигрываемый момент значит сделать ровно то, от чего продукт уходит.
   * @returns {{suggestionId:string, seconds:number, trigger:object}|null}
   */
  function suggestFor(patternId) {
    const s = SUGGESTIONS[String(patternId)];
    return s ? { ...s, trigger: { ...s.trigger } } : null;
  }

  return {
    VERSION, MAX_FIGHTS, MIN_SECONDS, MAX_SECONDS, MAX_TITLE,
    emptyState, normalize, activeFights,
    addFight, archiveFight, mark, clearMark,
    dayScore, secondsPerDay, fightStats, suggestFor,
  };
});
