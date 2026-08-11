/* Satoru Board Taste v1 — вкус к заказам (BOARD-OF-CONTRACTS-PLAN §3, §9, §11 в.1).
 *
 * Доска без вкуса предлагает вслепую: «съезди в город, где не был» одному
 * человеку — мечта, другому — тревога. Профиль вкуса делает подбор личным,
 * не спрашивая в лоб «какие приключения ты любишь» (на такой вопрос человек
 * отвечает про желаемую жизнь, а не про фактическую).
 *
 * Вместо анкеты — калибровка: показать N реальных заказов и дать сказать
 * «моё / не моё», по желанию одной строкой почему. Это тот же приём, что в
 * §9 плана: человек осваивает интерфейс, узнавая в нём свои собственные слова.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ банит навсегда. «Не моё» — мягкий вес, а не запрет: вкус меняется, и
 *    человек в марте не тот, что в августе. Свежие вердикты весят больше
 *    старых, поэтому профиль сам перекалибровывается без отдельной кнопки;
 *  — НЕ читает и не интерпретирует комментарии. Свободный текст хранится как
 *    есть и передаётся наружу — для ИИ. Локальная логика работает на тегах,
 *    чтобы подбор жил и без ключа и не стоил денег на каждом открытии доски;
 *  — НЕ отдаёт ничего для сравнения между людьми: вкус приватен, как и счёт
 *    схваток (§15 ARENA);
 *  — НЕ возвращает готовых фраз.
 *
 * Чистый модуль: только данные на входе, все операции иммутабельны.
 */
(function exposeBoardTaste(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardTasteV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardTaste() {
  'use strict';

  const VERSION = '1.0.0';

  // Сколько заказов показываем на первом заходе. Десять — решение Альберта:
  // достаточно, чтобы покрыть разные грани, и не столько, чтобы это стало
  // анкетой, которую бросают на середине.
  const CALIBRATION_SIZE = 10;

  // Ниже этого числа вердиктов профиль считается непрокалиброванным.
  const CALIBRATED_AT = 6;

  const LIKE = 'like', SKIP = 'skip';
  const VERDICTS = [LIKE, SKIP];

  // Свежий вердикт весит вдвое больше вердикта полугодовой давности.
  // Это и есть «калибруется, исходя из изменения пользователя»: ничего не
  // нужно пересматривать вручную, старое мнение само уступает новому.
  const HALFLIFE_DAYS = 180;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }
  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  function emptyState() { return { version: 1, verdicts: {} }; }

  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    const v = src.verdicts && typeof src.verdicts === 'object' ? src.verdicts : {};
    for (const id of Object.keys(v)) {
      const rec = v[id];
      if (!rec || typeof rec !== 'object' || !VERDICTS.includes(rec.v)) continue;
      const clean = { v: rec.v };
      if (typeof rec.note === 'string' && rec.note.trim()) clean.note = rec.note.trim().slice(0, 280);
      if (isDay(rec.at)) clean.at = rec.at;
      out[String(id)] = clean;
    }
    return { version: 1, verdicts: out };
  }

  function verdictCount(state) { return Object.keys(normalize(state).verdicts).length; }
  function isCalibrated(state) { return verdictCount(state) >= CALIBRATED_AT; }

  /** Записать «моё / не моё». Комментарий необязателен — гейт: калибровка не форма. */
  function recordVerdict(state, orderId, verdict, note, today) {
    const s = normalize(state);
    if (!VERDICTS.includes(verdict) || orderId == null) return s;
    const rec = { v: verdict };
    if (typeof note === 'string' && note.trim()) rec.note = note.trim().slice(0, 280);
    if (isDay(today)) rec.at = today;
    return { version: 1, verdicts: Object.assign({}, s.verdicts, { [String(orderId)]: rec }) };
  }

  function clearVerdict(state, orderId) {
    const s = normalize(state);
    const next = Object.assign({}, s.verdicts);
    delete next[String(orderId)];
    return { version: 1, verdicts: next };
  }

  function tagsOf(order) {
    return Array.isArray(order && order.tags) ? order.tags.filter((x) => typeof x === 'string') : [];
  }

  function weightOf(rec, today) {
    if (!rec.at || !isDay(today)) return 1;
    const age = Math.max(0, daysBetween(rec.at, today));
    return Math.pow(0.5, age / HALFLIFE_DAYS);
  }

  /**
   * Вес каждого тега: сумма свежести «моё» минус сумма свежести «не моё».
   * Возвращается сырая карта — чтобы UI мог показать человеку, что о нём поняли.
   */
  function tagWeights(state, pool, today) {
    const s = normalize(state);
    const byId = {};
    for (const o of Array.isArray(pool) ? pool : []) if (o && o.id != null) byId[String(o.id)] = o;
    const w = {};
    for (const id of Object.keys(s.verdicts)) {
      const order = byId[id];
      if (!order) continue;
      const rec = s.verdicts[id];
      const k = weightOf(rec, today) * (rec.v === LIKE ? 1 : -1);
      for (const tag of tagsOf(order)) w[tag] = (w[tag] || 0) + k;
    }
    return w;
  }

  /**
   * Оценка заказа: средний вес его тегов. Среднее, а не сумма — иначе заказ с
   * пятью тегами всегда обгонял бы заказ с одним, независимо от вкуса.
   */
  function scoreOrder(order, weights) {
    const tags = tagsOf(order);
    if (!tags.length) return 0;
    let sum = 0;
    for (const tag of tags) sum += (weights && weights[tag]) || 0;
    return sum / tags.length;
  }

  /**
   * Набор для калибровки: максимально РАЗНЫЕ заказы, а не первые попавшиеся.
   * Десять похожих не скажут о человеке ничего — жадно берём тот, что приносит
   * больше всего ещё не показанных тегов.
   *
   * Уже оценённые заказы не повторяются.
   */
  function calibrationSet(pool, state, size) {
    const s = normalize(state);
    const n = Number(size) > 0 ? Math.floor(Number(size)) : CALIBRATION_SIZE;
    const left = (Array.isArray(pool) ? pool : []).filter((o) => o && o.id != null && !s.verdicts[String(o.id)]);
    const picked = [], seen = new Set();
    while (picked.length < n && left.length) {
      let best = 0, bestGain = -1;
      for (let i = 0; i < left.length; i++) {
        const gain = tagsOf(left[i]).filter((tg) => !seen.has(tg)).length;
        // При равной новизне — стабильный порядок по id, чтобы набор не прыгал.
        if (gain > bestGain || (gain === bestGain && String(left[i].id) < String(left[best].id))) {
          best = i; bestGain = gain;
        }
      }
      const [chosen] = left.splice(best, 1);
      tagsOf(chosen).forEach((tg) => seen.add(tg));
      picked.push(chosen);
    }
    return picked;
  }

  /** Комментарии для ИИ: сырой материал, без интерпретации. */
  function notesForAi(state, pool) {
    const s = normalize(state);
    const byId = {};
    for (const o of Array.isArray(pool) ? pool : []) if (o && o.id != null) byId[String(o.id)] = o;
    const out = [];
    for (const id of Object.keys(s.verdicts)) {
      const rec = s.verdicts[id];
      if (!rec.note) continue;
      out.push({ title: byId[id] ? byId[id].title : null, verdict: rec.v, note: rec.note });
    }
    return out;
  }

  return {
    VERSION, CALIBRATION_SIZE, CALIBRATED_AT, HALFLIFE_DAYS, LIKE, SKIP,
    emptyState, normalize, verdictCount, isCalibrated,
    recordVerdict, clearVerdict, tagWeights, scoreOrder, calibrationSet, notesForAi,
  };
});
