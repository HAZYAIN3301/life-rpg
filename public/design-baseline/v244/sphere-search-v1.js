/* Satoru Sphere Search v1 — поиск сферы по дереву любой глубины.
 *
 * Два репорта об одном месте:
 *  — fb_msi16wnqpyrs: «даже при ручном выборе конкретной сферы выпадает очень
 *    неудобное окно с обычным списком всех сфер. когда их много, то очень
 *    неудобно искать»;
 *  — fb_mqdgi36249e4: «я могу выбрать только основные сферы и их подсферы, но не
 *    могу выбрать учеба > школа > математика».
 *
 * Оба лечатся одним: плоский список заменяется поиском, который возвращает лист
 * ЛЮБОЙ глубины вместе с его полным путём. Путь обязателен: без него «Математика»
 * из «Школы» и «Математика» из «Университета» неразличимы, и человек выбирает
 * наугад — то есть меняет одну неудобную форму на другую.
 *
 * ⚠️ Что модуль НЕ делает:
 *  — не решает, какую сферу назначить. Он ранжирует и показывает; выбор всегда
 *    за человеком (в отличие от `guessCategoryFromHistory`, у которого своя роль);
 *  — не переводит названия. Имена сфер задаёт пользователь, это его слова;
 *  — не режет глубину. Ограничение «два уровня» и было багом.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeSphereSearch(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SphereSearchV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSphereSearch() {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_RESULTS = 12;
  // Защита от кривых данных: сфера, чей родитель ссылается сам на себя или
  // образует петлю, не должна вешать построение пути.
  const MAX_DEPTH = 12;

  /**
   * Нормализация под сравнение: регистр, ё→е и комбинирующие знаки. Человек ищет
   * «елка», «Ёлка» и «ёлка» одним и тем же движением, и все три должны найтись.
   */
  function norm(value) {
    return String(value == null ? '' : value)
      .normalize('NFC')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .trim();
  }

  function byId(list, id) {
    for (const s of list) if (s && s.id === id) return s;
    return null;
  }

  /** Путь от корня к сфере: ['Учёба', 'Школа', 'Математика']. */
  function pathOf(list, id) {
    const out = [];
    let cur = byId(list, id), guard = 0;
    const seen = new Set();
    while (cur && guard++ < MAX_DEPTH) {
      if (seen.has(cur.id)) break;      // петля в данных — обрываем, а не зависаем
      seen.add(cur.id);
      out.unshift(String(cur.name == null ? '' : cur.name));
      cur = cur.parentId ? byId(list, cur.parentId) : null;
    }
    return out;
  }

  function hasChildren(list, id) {
    for (const s of list) if (s && s.parentId === id) return true;
    return false;
  }

  /**
   * Совпадение и его качество. Порядок значим — он же порядок ожиданий человека:
   * точное имя, потом начало слова, потом вхождение. Совпадение по РОДИТЕЛЮ
   * слабее любого совпадения по самому листу: набрав «школа», человек ждёт
   * сначала саму «Школу», а уже потом всё, что внутри неё.
   */
  function scoreOf(name, path, q) {
    const n = norm(name);
    if (!q) return 1;
    if (n === q) return 1000;
    if (n.startsWith(q)) return 800 - n.length;
    // Начало любого слова: «мат» находит «Высшая математика».
    if (new RegExp('(^|[\\s\\-–—/(,.])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(n)) return 600 - n.length;
    if (n.includes(q)) return 400 - n.length;
    // Совпал предок — лист показываем, но заметно ниже.
    for (let i = 0; i < path.length - 1; i++) if (norm(path[i]).includes(q)) return 150 - i;
    return 0;
  }

  /**
   * Поиск.
   *
   * @param {Array<{id:*,name:string,parentId?:*}>} skills
   * @param {string} query — пустой запрос вернёт первые MAX_RESULTS
   * @param {{limit?:number, leavesOnly?:boolean}} [opts]
   * @returns {Array<{id:*, name:string, path:string[], label:string, isLeaf:boolean, depth:number}>}
   */
  function search(skills, query, opts) {
    const list = (Array.isArray(skills) ? skills : []).filter((s) => s && s.id != null);
    const o = opts || {};
    const limit = Math.max(1, Math.min(50, Number(o.limit) || MAX_RESULTS));
    const q = norm(query);

    const rows = [];
    for (const s of list) {
      const leaf = !hasChildren(list, s.id);
      // Столбы остаются выбираемыми: «Здоровье» без подсфер — законный выбор.
      if (o.leavesOnly && !leaf) continue;
      const path = pathOf(list, s.id);
      const score = scoreOf(s.name, path, q);
      if (q && score <= 0) continue;
      rows.push({
        id: s.id,
        name: String(s.name == null ? '' : s.name),
        path,
        // Полный путь — то, что отличает две одноимённые сферы друг от друга.
        label: path.join(' › '),
        isLeaf: leaf,
        depth: Math.max(0, path.length - 1),
        _score: score,
      });
    }

    rows.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      // Тай-брейк детерминированный: короче путь → раньше по алфавиту → id.
      if (a.depth !== b.depth) return a.depth - b.depth;
      const c = a.label.localeCompare(b.label, 'ru');
      if (c) return c;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });

    return rows.slice(0, limit).map((r) => {
      const out = { ...r };
      delete out._score;
      return out;
    });
  }

  return { VERSION, MAX_RESULTS, MAX_DEPTH, norm, pathOf, search };
});
