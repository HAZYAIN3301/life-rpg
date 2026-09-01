/* Satoru Commitment v1 — уговор (DISCIPLINE-ESCAPE-PLAN §5, аудит 14 пунктов 25.08).
 *
 * Сквозная находка брифа Альберта от 05.08: **неопределённая граница всегда
 * проигрывает дофамину** — не из-за нехватки воли, а потому что в момент решения
 * воли по определению нет. Лечится одним и тем же приёмом в шести разных областях:
 * решение принимается ОДИН раз, ЗАРАНЕЕ, в ресурсном состоянии; граница — конкретное
 * время или условие, а не самочувствие.
 *
 * Этот приём в коде уже реализован ЧЕТЫРЕ раза и каждый раз по-своему: «первая строка
 * назавтра» (в `days`), «ядро дня»/«закрытие дня» (в `settings`), «клятва Кремню»
 * (поле на квесте), «схватки» (`fights-v1`, свой стор). Ни у одной из четырёх нет
 * общих полей «когда решено / какая граница / что считалось выигрышем / что вышло».
 * Из-за этого пункты 12 (режимы дня), 13 (якорь подъёма) и 14 (ритуалы) не построены
 * вовсе: каждый стал бы пятой и шестой реализацией того же самого.
 *
 * Уговор — это и есть недостающий примитив: одно решение, принятое в момент A,
 * про момент B, с явной границей и **явно названным выигрышем**.
 *
 * Чем отличается от соседей (границы важны, иначе получится «объект про всё»):
 *  — привычка отвечает «сделал ли ты X за день» — это про объём;
 *  — схватка отвечает «выиграл ли ты десятисекундный момент» — это про точку разлома;
 *  — уговор отвечает «сдержал ли ты то, что решил заранее» — это про РЕШЕНИЕ,
 *    принятое другим (ресурсным) человеком, чем тот, кто его исполняет.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ считает XP, золото, урон серии и любые штрафы. Гейт `ALTERNEYT` и §6 плана:
 *    провал уговора ничего не отнимает. Здесь нет ни одной функции, к которой это
 *    можно было бы подключить, и это намеренно;
 *  — НЕ считает неотмеченный день проигранным. Молчание — не поражение (тот же гейт,
 *    что в `fights-v1`). Но и не врёт: `streakOf` отдаёт рядом `recorded`, чтобы
 *    «7 подряд» нельзя было показать, скрыв, что записано 7 дней из 20;
 *  — НЕ блокирует и не запрещает. Граница — это когда приложение замолкает, а не
 *    когда оно не пускает (§6 плана, гейт «не блокировать»);
 *  — НЕ принимает уговор без названного выигрыша. Гейт §5 плана границ: «каждая
 *    граница обязана нести заявленный выигрыш, а не только норму» — иначе она
 *    становится ещё одним способом быть собой недовольным;
 *  — НЕ решает, что показать и когда. Отдаёт «что сейчас живо», решает вызывающий.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Все операции иммутабельны — возвращают новое состояние, сохраняет вызывающий.
 */
(function exposeCommitment(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CommitmentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCommitment() {
  'use strict';

  const VERSION = '1.0.0';

  // Потолок из той же логики, что MAX_FIGHTS=5 в схватках: список уговоров длиной
  // в двадцать — это снова шум и снова стоимость выбора, ради снятия которой уговор
  // и существует. Ядро ритуала (§14) в реальном разборе Альберта — 4-5 пунктов.
  const MAX_ITEMS = 12;
  const MAX_TITLE = 80;
  const MAX_WIN = 120;

  // Виды уговоров. Специально закрытый список: открытый превратил бы модуль в
  // «объект про всё», а каждый вид здесь отвечает конкретному пункту брифа.
  const KINDS = Object.freeze({
    step:   'step',    // §2 — одно первое действие, решённое накануне
    edge:   'edge',    // §1 — граница блока/дня по времени
    moment: 'moment',  // §8 — короткий момент разлома (мост к fights-v1)
    anchor: 'anchor',  // §13 — якорь подъёма, единственный рычаг сна
    care:   'care',    // §10/§14 — пункт заботы о себе до работы
  });

  // Режим дня (§12). Пустой список `modes` у уговора = живёт во всех режимах, то есть
  // это ядро, которое не пересобирается при смене контекста. Именно эта находка из
  // §12 брифа: если якорь подъёма выбран близко к школьному, вечерняя часть вообще
  // не требует пересборки — общее ядро плюс разные надстройки.
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

  function emptyState() { return { version: 1, mode: DEFAULT_MODE, items: [], log: {} }; }

  // Граница уговора. `none` — законный случай: у пункта заботы (§10) может не быть
  // часа, важен только порядок «сначала еда, потом работа».
  function cleanEdge(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'none' };
    if (raw.kind === 'time' && isTime(raw.at)) return { kind: 'time', at: raw.at };
    if (raw.kind === 'window' && isTime(raw.from) && isTime(raw.to)) return { kind: 'window', from: raw.from, to: raw.to };
    if (raw.kind === 'trigger' && typeof raw.on === 'string' && raw.on.trim()) {
      return { kind: 'trigger', on: raw.on.trim().slice(0, 40) };
    }
    return { kind: 'none' };
  }

  // Бюджет промахов (§13): «отдельный бюджет на поздние отбои, который не ломает
  // серию, если используется в рамках лимита». Без него любая серия по подъёму
  // рвётся на первом же тренировочном вечере — и человек бросает саму затею.
  function cleanBudget(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const misses = Math.floor(Number(raw.misses));
    const perDays = Math.floor(Number(raw.perDays));
    if (!Number.isFinite(misses) || misses < 1 || misses > 7) return null;
    if (!Number.isFinite(perDays) || perDays < 2 || perDays > 60) return null;
    return { misses, perDays };
  }

  function cleanHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-30).map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      if (!['revised', 'released'].includes(entry.type) || !isDay(entry.day)) return null;
      const out = { type: entry.type, day: entry.day };
      if (entry.from && typeof entry.from === 'object') out.from = cleanEdge(entry.from);
      if (entry.to && typeof entry.to === 'object') out.to = cleanEdge(entry.to);
      return out;
    }).filter(Boolean);
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    // Выигрыш обязателен — см. шапку. Уговор без названного выигрыша это норма,
    // а норма без выигрыша производит вину, а не движение.
    const win = typeof raw.win === 'string' ? raw.win.trim() : '';
    if (!id || !title || !win) return null;
    if (!Object.prototype.hasOwnProperty.call(KINDS, raw.kind)) return null;
    const out = {
      id,
      kind: raw.kind,
      title: title.slice(0, MAX_TITLE),
      win: win.slice(0, MAX_WIN),
      edge: cleanEdge(raw.edge),
      core: raw.core !== false,          // по умолчанию ядро: §14, «работает вообще всегда»
      modes: Array.isArray(raw.modes)
        ? [...new Set(raw.modes.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim().slice(0, 24)))]
        : [],
      history: cleanHistory(raw.history),
    };
    if (isDay(raw.decidedOn)) out.decidedOn = raw.decidedOn;
    if (isDay(raw.revisedOn)) out.revisedOn = raw.revisedOn;
    const budget = cleanBudget(raw.budget);
    if (budget) out.budget = budget;
    if (isDay(raw.archivedAt)) out.archivedAt = raw.archivedAt;
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
    return { version: 1, mode, items, log: cleanLog(raw.log) };
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

  // Пересмотр — нормальное действие над планом, а не нарушение обещания.
  function revise(state, id, patch, day) {
    const s = normalize(state);
    const key = String(id);
    if (!isDay(day) || !patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'invalid', state: s };
    const current = s.items.find((item) => item.id === key && !item.archivedAt);
    if (!current) return { ok: false, error: 'missing', state: s };
    const candidate = cleanItem({ ...current, ...patch, id: current.id, history: current.history });
    if (!candidate) return { ok: false, error: 'invalid', state: s };
    candidate.history = current.history.concat([{ type: 'revised', day, from: current.edge, to: candidate.edge }]).slice(-30);
    candidate.revisedOn = day;
    return { ok: true, state: { ...s, items: s.items.map((item) => item.id === key ? candidate : item) } };
  }

  // Снять уговор можно всегда и бесплатно; история остаётся для честной калибровки.
  function release(state, id, day) {
    const s = normalize(state);
    const key = String(id);
    if (!isDay(day)) return { ok: false, error: 'invalid', state: s };
    const current = s.items.find((item) => item.id === key && !item.archivedAt);
    if (!current) return { ok: false, error: 'missing', state: s };
    const released = {
      ...current,
      archivedAt: day,
      history: current.history.concat([{ type: 'released', day }]).slice(-30),
    };
    return { ok: true, state: { ...s, items: s.items.map((item) => item.id === key ? released : item) } };
  }

  // Архивация, а не удаление: история уговора — единственное, из чего потом видно,
  // подходил ли он этому человеку. Стирать её значит стирать основание для §7 плана
  // границ («сигнал ушёл — граница остаётся, не ушёл — предлагаем другую»).
  function archive(state, id, day) {
    const s = normalize(state);
    if (!isDay(day)) return s;
    return { ...s, items: s.items.map((i) => (i.id === String(id) && !i.archivedAt ? { ...i, archivedAt: day } : i)) };
  }

  // Undo завершения квеста должен вернуть и связанное обязательство. Иначе
  // архивная запись блокирует повторный take тем же deterministic id, а UI
  // показывает незавершённый квест без возможности снова выбрать границу.
  function reopen(state, id, day) {
    const s = normalize(state);
    const key = String(id);
    if (!isDay(day)) return { ok: false, error: 'invalid', state: s };
    const current = s.items.find((item) => item.id === key && item.archivedAt);
    if (!current) return { ok: false, error: 'missing', state: s };
    if (s.items.filter((item) => !item.archivedAt).length >= MAX_ITEMS) return { ok: false, error: 'limit', state: s };
    const reopened = { ...current, revisedOn: day };
    delete reopened.archivedAt;
    return { ok: true, state: { ...s, items: s.items.map((item) => item.id === key ? reopened : item) } };
  }

  function setMode(state, mode) {
    const s = normalize(state);
    const next = typeof mode === 'string' && mode.trim() ? mode.trim().slice(0, 24) : DEFAULT_MODE;
    return { ...s, mode: next };
  }

  /**
   * Что живо в этот день при этом режиме.
   * Пустой `modes` = живёт всегда (ядро). Непустой — только в перечисленных режимах.
   */
  function dueOn(state, day, mode) {
    const s = normalize(state);
    const m = typeof mode === 'string' && mode.trim() ? mode.trim().slice(0, 24) : s.mode;
    return s.items.filter((i) => {
      if (i.archivedAt && isDay(day) && daysBetween(i.archivedAt, day) >= 0) return false;
      if (i.archivedAt && !isDay(day)) return false;
      if (i.decidedOn && isDay(day) && daysBetween(i.decidedOn, day) < 0) return false; // решён позже этого дня
      return !i.modes.length || i.modes.includes(m);
    });
  }

  // Ядро против расширения (§14): ядро работает везде — дома, в отеле, в дороге.
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

  // Снять отметку — вернуться к молчанию, а не к поражению. Человек имеет право
  // передумать про то, что он записал о себе.
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

  /**
   * Серия по уговору.
   *
   * Три решения, каждое из которых спорно и потому объяснено:
   *  1. Неотмеченный день ПРОПУСКАЕТСЯ, а не рвёт серию — молчание не поражение.
   *  2. Но рядом отдаётся `recorded` и `covered`, чтобы интерфейс не мог показать
   *     «14 подряд», умолчав, что записано три дня из четырнадцати. Гейт честности:
   *     этика «не наказывать» не даёт права на приятную неправду.
   *  3. Промах прощается, если он в пределах бюджета за окно (§13). Сверх бюджета —
   *     серия заканчивается, но это НЕ штраф: ничего не отнимается, просто счёт
   *     начинается заново.
   *
   * @returns {{streak:number, recorded:number, covered:number, forgiven:number}}
   */
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
      if (res === null) continue;              // молчание — прозрачно
      recorded += 1;
      if (res === 'win') { streak += 1; continue; }
      // Промах: прощаем, пока укладываемся в бюджет за его окно.
      if (!budget) break;
      missDays.push(day);
      const inWindow = missDays.filter((m) => daysBetween(m, today) < budget.perDays).length;
      if (inWindow > budget.misses) break;
      forgiven += 1;
    }
    return { streak, recorded, covered, forgiven };
  }

  /**
   * Уговоры, по которым день прошёл без отметки. Это НЕ список провалов — это то,
   * о чём уместно спросить один раз, и только за вчера: спрашивать за неделю назад
   * значит превращать заботу в допрос.
   */
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

  return Object.freeze({
    VERSION, MAX_ITEMS, MAX_TITLE, MAX_WIN, KINDS, DEFAULT_MODE,
    emptyState, normalize, activeItems,
    add, revise, release, archive, reopen, setMode,
    dueOn, coreOf, extrasOf,
    mark, clearMark, outcomeOf,
    streakOf, unsettled, dayScore,
  });
});
