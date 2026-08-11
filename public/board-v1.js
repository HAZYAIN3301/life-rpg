/* Satoru Board v1 — доска заказов (BOARD-OF-CONTRACTS-PLAN, этап 1).
 *
 * «Люди хотят приключений… однако проблема в том, что они не знают, что именно
 * им делать, и слишком боятся рисковать. Они привыкли к игровому формату, где
 * квест, награды и боссы заранее заданы.»
 *
 * Механизм тот же, что у «первой строки назавтра» и «Захода», только на
 * масштабе жизненного опыта: снимается стоимость РЕШЕНИЯ, а не мотивации.
 * «Сходи в приключение» не является выполнимой инструкцией. «Съезди в город,
 * где не был, и привези оттуда одну фотографию» — является.
 *
 * Подбор, а не генерация (§11 в.1): из курируемого пула, с предпочтением
 * запущенным сферам. Заказ в пустую сферу — самый естественный способ
 * напомнить о ней, не читая нотаций про баланс (§3). Кто именно запущен,
 * решает не этот модуль: список приходит снаружи, и его умеет считать
 * `sphere-frequency-v1`.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ наказывает за возврат. Гейт §3: заказ возвращается на доску без всяких
 *    последствий, взятый и невыполненный НЕ считается провалом и НЕ входит в
 *    схватки. Здесь нет ни одного поля, по которому можно было бы посчитать
 *    «брошенные», и это намеренно;
 *  — НЕ даёт ленты. Гейт §5: мы строим приложение против доомскролла и не
 *    можем добавить в него ленту. Никаких лайков, подписчиков, рейтингов,
 *    «популярного» и ранжирующей выдачи — API для этого нет;
 *  — НЕ решает, идёт ли выполненный заказ в баланс сфер (§11 в.6 открыт).
 *    Возвращает `sphereId` наружу, решает вызывающий;
 *  — НЕ начисляет опыт и значки: это дело вызывающего, здесь только факт;
 *  — НЕ возвращает готовых фраз — только идентификаторы и структуры.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Все операции иммутабельны.
 */
(function exposeBoard(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoard() {
  'use strict';

  const VERSION = '1.0.0';

  // §11 в.2: 3 личных + 1 сезонный. Больше — снова шум и снова стоимость
  // выбора, ради снятия которой доска и существует.
  const BOARD_PERSONAL = 3;
  const BOARD_SEASONAL = 1;

  // Столько заказов можно держать взятыми одновременно. Та же причина:
  // десять взятых заказов — это снова список дел, а не приключение.
  const MAX_ACTIVE = 3;

  // Выполненный заказ не возвращается на доску сразу — иначе «съезди в город,
  // где не был» превращается в ежедневную рутину.
  const DONE_COOLDOWN_DAYS = 120;

  // Возвращённый заказ пропадает с доски ненадолго. Это НЕ штраф: смысл в том,
  // чтобы отказ не мозолил глаза на следующий же день. Через две недели он
  // вернётся как ни в чём не бывало.
  const RETURN_REST_DAYS = 14;

  // Решение Альберта 10.08: сезонные живут до конца сезона, личные — без срока.
  // Сезонный заказ привязан ко времени года по своей природе: «искупайся в
  // озере» в ноябре бессмысленно. Истечение — НЕ провал: заказ просто
  // заканчивается, как заканчивается лето.
  const SEASON_MAX_DAYS = 92; // страховка от «взят летом 2026, сегодня лето 2027»

  // Личный заказ не истекает никогда, но через три недели уместно один раз
  // спросить «он всё ещё твой?». Это не срок и не упрёк — это защита от того,
  // чтобы три взятых заказа молча занимали потолок полгода.
  const STALE_ASK_DAYS = 21;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }

  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  /**
   * Сезон по дате (§7). Календарные границы, а не астрономические: заказы
   * про «позднее лето и возврат в темп» имеют смысл с сентября, а не с 23-го.
   */
  function seasonOf(day) {
    if (!isDay(day)) return null;
    const m = Number(day.slice(5, 7));
    if (m === 12 || m <= 2) return 'winter';
    if (m <= 5) return 'spring';
    if (m <= 8) return 'summer';
    return 'autumn';
  }

  /**
   * Неделя как единица обновления доски. Доска обязана быть СТАБИЛЬНОЙ: если
   * состав меняется на каждом рендере, человек не успевает решиться, а заказ,
   * который он присмотрел утром, к вечеру исчезает.
   */
  function periodKey(day) {
    if (!isDay(day)) return 0;
    const t = Date.parse(day + 'T00:00:00Z');
    return isNaN(t) ? 0 : Math.floor(t / 86400000 / 7);
  }

  // Детерминированный порядок вместо случайного: доска одна и та же всю неделю
  // и одинаковая после перезагрузки. Math.random() дал бы новую доску на каждый
  // рендер — ровно то, чего быть не должно.
  function hash(str) {
    let h = 5381;
    const s = String(str);
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }

  function emptyState() { return { version: 1, active: [], done: [], rested: [] }; }

  function cleanTaken(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const orderId = raw.orderId == null ? '' : String(raw.orderId);
    if (!orderId || !isDay(raw.takenAt)) return null;
    const out = { orderId, takenAt: raw.takenAt };
    if (raw.sphereId != null) out.sphereId = String(raw.sphereId);
    if (raw.seasonal) out.seasonal = true;
    if (isDay(raw.askedAt)) out.askedAt = raw.askedAt;
    return out;
  }

  function cleanStamp(raw, field) {
    if (!raw || typeof raw !== 'object') return null;
    const orderId = raw.orderId == null ? '' : String(raw.orderId);
    if (!orderId || !isDay(raw[field])) return null;
    const out = { orderId };
    out[field] = raw[field];
    if (raw.sphereId != null) out.sphereId = String(raw.sphereId);
    return out;
  }

  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const active = [], seenActive = new Set();
    for (const it of Array.isArray(src.active) ? src.active : []) {
      const c = cleanTaken(it);
      if (!c || seenActive.has(c.orderId)) continue;
      seenActive.add(c.orderId);
      active.push(c);
    }
    const done = [], seenDone = new Set();
    for (const it of Array.isArray(src.done) ? src.done : []) {
      const c = cleanStamp(it, 'doneAt');
      if (!c) continue;
      // Один и тот же заказ можно выполнить снова спустя время — храним последний.
      if (seenDone.has(c.orderId)) {
        const prev = done.find((d) => d.orderId === c.orderId);
        if (prev && c.doneAt > prev.doneAt) prev.doneAt = c.doneAt;
        continue;
      }
      seenDone.add(c.orderId);
      done.push(c);
    }
    const rested = [], seenRest = new Set();
    for (const it of Array.isArray(src.rested) ? src.rested : []) {
      const c = cleanStamp(it, 'restedAt');
      if (!c || seenRest.has(c.orderId)) continue;
      seenRest.add(c.orderId);
      rested.push(c);
    }
    return { version: 1, active, done, rested };
  }

  function cleanOrder(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id == null ? '' : String(raw.id);
    if (!id) return null;
    const out = { id };
    if (raw.sphereId != null) out.sphereId = String(raw.sphereId);
    if (Array.isArray(raw.seasons)) out.seasons = raw.seasons.filter((s) => typeof s === 'string');
    if (raw.seasonal) out.seasonal = true;
    return Object.assign({}, raw, out);
  }

  function lastDay(list, orderId, field) {
    let best = null;
    for (const it of list) {
      if (it.orderId !== orderId) continue;
      if (!best || it[field] > best) best = it[field];
    }
    return best;
  }

  /**
   * Что сейчас лежит на доске.
   *
   * Взятые заказы на доске не показываются — их сорвали с неё; они живут в
   * `activeOrders()`. Недавно выполненные и только что возвращённые тоже
   * скрыты (см. константы: и то и другое ради того, чтобы доска оставалась
   * доской, а не списком одного и того же).
   *
   * @param {Array} pool — курируемый пул заказов `{id, sphereId?, seasons?, seasonal?}`
   * @param {{neglectedSpheres?:string[], activeSpheres?:string[]}} ctx
   * @param {object} state
   * @param {string} today — YYYY-MM-DD
   * @returns {{season:(string|null), personal:Array, seasonal:(object|null)}}
   */
  function board(pool, ctx, state, today) {
    const s = normalize(state);
    const c = ctx || {};
    const season = seasonOf(today);
    const key = periodKey(today);
    const neglected = new Set((c.neglectedSpheres || []).map(String));
    const mine = new Set((c.activeSpheres || []).map(String));
    const takenIds = new Set(s.active.map((a) => a.orderId));

    const available = (Array.isArray(pool) ? pool : [])
      .map(cleanOrder)
      .filter((o) => {
        if (!o || takenIds.has(o.id)) return false;
        const doneAt = lastDay(s.done, o.id, 'doneAt');
        if (doneAt && daysBetween(doneAt, today) < DONE_COOLDOWN_DAYS) return false;
        const restedAt = lastDay(s.rested, o.id, 'restedAt');
        if (restedAt && daysBetween(restedAt, today) < RETURN_REST_DAYS) return false;
        return true;
      });

    // Сезонный: только те, что заявлены на текущий сезон.
    const seasonalPool = available.filter((o) => o.seasonal && (!o.seasons || !season || o.seasons.includes(season)));
    const seasonal = pickStable(seasonalPool, BOARD_SEASONAL, key, () => 0)[0] || null;

    // Личные: сумма двух сигналов, а не строгий приоритет одного.
    //
    // Сфера (§3): заказ в пустую сферу — самый естественный способ напомнить о
    // ней, не читая нотаций про баланс. Вкус (§9): подбор обязан быть личным,
    // иначе доска предлагает вслепую.
    //
    // Вкус намеренно весит вдвое: сильное «не моё» должно перебивать запущенную
    // сферу. Напоминание о заброшенном ремесле бесполезно, если человеку
    // отвратительна сама форма заказа — он просто перестанет открывать доску.
    const personalPool = available.filter((o) => !o.seasonal && (!seasonal || o.id !== seasonal.id));
    const taste = c.tasteWeights || null;
    const scoreOf = (o) => {
      const tier = neglected.has(o.sphereId) ? 2 : mine.has(o.sphereId) ? 1 : 0;
      const tasteScore = taste && typeof c.scoreOrder === 'function' ? c.scoreOrder(o, taste) : 0;
      return tier + tasteScore * 2;
    };
    // rank = «меньше значит раньше», поэтому оценку инвертируем.
    const personal = pickStable(personalPool, BOARD_PERSONAL, key, (o) => -scoreOf(o));

    return { season, personal, seasonal };
  }

  function pickStable(list, limit, key, rank) {
    return list
      .slice()
      .sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        // Оценки — дробные, поэтому сравниваем с допуском: иначе разница в
        // 1e-15 давала бы «разный» порядок и доска дрожала бы между рендерами.
        if (Math.abs(ra - rb) > 1e-9) return ra - rb;
        const ha = hash(a.id + '#' + key), hb = hash(b.id + '#' + key);
        if (ha !== hb) return ha - hb;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .slice(0, limit);
  }

  /** Взятые и ещё не закрытые заказы. */
  function activeOrders(state) { return normalize(state).active.slice(); }

  /**
   * Взять заказ.
   * @returns {{ok:true, state:object}|{ok:false, error:('limit'|'already'|'invalid')}}
   */
  function takeOrder(state, order, today) {
    const s = normalize(state);
    const o = cleanOrder(order);
    if (!o || !isDay(today)) return { ok: false, error: 'invalid' };
    if (s.active.some((a) => a.orderId === o.id)) return { ok: false, error: 'already' };
    if (s.active.length >= MAX_ACTIVE) return { ok: false, error: 'limit' };
    const entry = { orderId: o.id, takenAt: today };
    if (o.sphereId != null) entry.sphereId = o.sphereId;
    if (o.seasonal) entry.seasonal = true;
    return { ok: true, state: { ...s, active: s.active.concat([entry]) } };
  }

  /**
   * Закрыть заказ.
   *
   * `sphereId` возвращается наружу, чтобы вызывающий сам решил, идёт ли это в
   * баланс сфер (§11 в.6 всё ещё открыт). Опыт и значки — тоже его дело.
   *
   * @returns {{ok:true, state:object, sphereId:(string|null)}|{ok:false, error:string}}
   */
  function completeOrder(state, orderId, today) {
    const s = normalize(state);
    const id = String(orderId);
    const entry = s.active.find((a) => a.orderId === id);
    if (!entry || !isDay(today)) return { ok: false, error: 'invalid' };
    const record = { orderId: id, doneAt: today };
    if (entry.sphereId != null) record.sphereId = entry.sphereId;
    return {
      ok: true,
      sphereId: entry.sphereId == null ? null : entry.sphereId,
      state: {
        ...s,
        active: s.active.filter((a) => a.orderId !== id),
        done: s.done.filter((d) => d.orderId !== id).concat([record]),
      },
    };
  }

  /**
   * Вернуть заказ на доску.
   *
   * Гейт §3: без всяких последствий. Ничего не записывается о том, что заказ
   * был брошен — только отметка, чтобы он не появился на доске завтра же.
   * Считать возвраты было бы прямым нарушением: доска приключений превратилась
   * бы в ещё один источник вины, против чего написан весь ALTERNEYT.
   */
  function returnOrder(state, orderId, today) {
    const s = normalize(state);
    const id = String(orderId);
    if (!s.active.some((a) => a.orderId === id)) return s;
    const rest = isDay(today) ? [{ orderId: id, restedAt: today }] : [];
    return {
      ...s,
      active: s.active.filter((a) => a.orderId !== id),
      rested: s.rested.filter((r) => r.orderId !== id).concat(rest),
    };
  }

  /**
   * Сезонный заказ, чей сезон прошёл. Личные не истекают никогда.
   *
   * Истечение — НЕ провал и НЕ возврат: заказ просто заканчивается вместе с
   * сезоном. Поэтому никакой отметки об этом не остаётся, и посчитать
   * «сколько сезонных ты не успел» негде.
   */
  function isExpired(entry, today) {
    if (!entry || !entry.seasonal || !isDay(today) || !isDay(entry.takenAt)) return false;
    if (daysBetween(entry.takenAt, today) > SEASON_MAX_DAYS) return true;
    return seasonOf(entry.takenAt) !== seasonOf(today);
  }

  /**
   * Убрать истёкшие сезонные из взятых.
   * @returns {{state:object, expired:string[]}}
   */
  function sweepExpired(state, today) {
    const s = normalize(state);
    const expired = s.active.filter((a) => isExpired(a, today)).map((a) => a.orderId);
    if (!expired.length) return { state: s, expired: [] };
    return { state: { ...s, active: s.active.filter((a) => !isExpired(a, today)) }, expired };
  }

  /**
   * Один залежавшийся личный заказ, про который уместно спросить «он всё ещё
   * твой?» — или null.
   *
   * Один за раз и не чаще, чем раз в STALE_ASK_DAYS: тот же принцип, что у
   * `after-lapse-v1`. Повтор превращает заботу в напоминание о вине.
   * Сезонные сюда не попадают — у них есть свой конец.
   */
  function staleAsk(state, today) {
    if (!isDay(today)) return null;
    const s = normalize(state);
    const candidates = s.active.filter((a) => {
      if (a.seasonal || isExpired(a, today)) return false;
      if (daysBetween(a.takenAt, today) < STALE_ASK_DAYS) return false;
      if (a.askedAt && daysBetween(a.askedAt, today) < STALE_ASK_DAYS) return false;
      return true;
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.takenAt < b.takenAt ? -1 : a.takenAt > b.takenAt ? 1 : (a.orderId < b.orderId ? -1 : 1)));
    const top = candidates[0];
    return { orderId: top.orderId, heldDays: daysBetween(top.takenAt, today) };
  }

  /** Отметить, что про заказ уже спрашивали. */
  function noteAsked(state, orderId, today) {
    const s = normalize(state);
    if (!isDay(today)) return s;
    const id = String(orderId);
    return { ...s, active: s.active.map((a) => (a.orderId === id ? { ...a, askedAt: today } : a)) };
  }

  return {
    VERSION, BOARD_PERSONAL, BOARD_SEASONAL, MAX_ACTIVE,
    DONE_COOLDOWN_DAYS, RETURN_REST_DAYS, SEASON_MAX_DAYS, STALE_ASK_DAYS,
    emptyState, normalize, seasonOf, periodKey,
    board, activeOrders, takeOrder, completeOrder, returnOrder,
    isExpired, sweepExpired, staleAsk, noteAsked, daysBetween,
  };
});
