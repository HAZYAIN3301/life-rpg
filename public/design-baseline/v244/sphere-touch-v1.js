/* Satoru Sphere touch days v1
 *
 * `sphere-frequency-v1` меряет ритм сферы по дням, в которые её трогали, но сам
 * этих дней не собирает. Здесь они собираются: события с любого уровня дерева
 * поднимаются к своей верхней сфере, потому что ритм объявляется на уровне оси
 * колеса, а закрывается делом в под-под-сфере.
 *
 * Один день считается один раз, чем бы он ни был занят: три дела в одной сфере —
 * это один день, когда ты ею занимался, а не три. Иначе «два раза в неделю»
 * закрывалось бы одним насыщенным вечером, и частота перестала бы означать ритм.
 *
 * Фоновые слои (`layer: true`) днём касания не считаются: сфера, которую задели
 * попутно, не была тем, чем человек занимался.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов.
 */
(function exposeSphereTouch(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SphereTouchV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSphereTouch() {
  'use strict';

  const MAX_DEPTH = 8;

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyString(value) { return typeof value === 'string' && !!value.trim(); }
  function isDay(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }

  /**
   * Для каждой сферы — id её верхней сферы. Цикл в родителях не роняет обход и не
   * зацикливает его: сфера, чья цепочка замкнулась, остаётся сама себе вершиной.
   */
  function topOwnerMap(spheres) {
    const byId = new Map();
    if (Array.isArray(spheres)) {
      for (const sphere of spheres) {
        if (isObject(sphere) && nonEmptyString(sphere.id) && !byId.has(String(sphere.id))) byId.set(String(sphere.id), sphere);
      }
    }
    const owner = new Map();
    for (const [id, sphere] of byId) {
      let current = sphere, seen = new Set([id]), depth = 0;
      while (current && nonEmptyString(current.parentId) && depth++ < MAX_DEPTH) {
        const parentId = String(current.parentId);
        if (seen.has(parentId) || !byId.has(parentId)) break;
        seen.add(parentId);
        current = byId.get(parentId);
      }
      owner.set(id, current && nonEmptyString(current.id) ? String(current.id) : id);
    }
    return owner;
  }

  /**
   * Дни касания по верхним сферам: `Map<sphereId, string[]>`, дни отсортированы и
   * не повторяются. Сферы без единого дня в карте отсутствуют — пустой список и
   * отсутствие здесь означают одно и то же, и выдумывать разницу незачем.
   */
  function touchDaysBySphere(events, spheres) {
    const owner = topOwnerMap(spheres);
    const days = new Map();
    if (!Array.isArray(events)) return days;
    for (const event of events) {
      if (!isObject(event) || event.layer === true) continue;
      if (!isDay(event.date) || !nonEmptyString(event.skillId)) continue;
      const top = owner.get(String(event.skillId));
      if (!top) continue;
      let set = days.get(top);
      if (!set) { set = new Set(); days.set(top, set); }
      set.add(event.date);
    }
    const out = new Map();
    for (const [id, set] of days) out.set(id, [...set].sort());
    return out;
  }

  /** Дни одной сферы. Пустой день отвечает одним и тем же пустым массивом. */
  const EMPTY = Object.freeze([]);
  function daysFor(index, sphereId) {
    if (!(index instanceof Map) || !nonEmptyString(sphereId)) return EMPTY;
    return index.get(String(sphereId)) || EMPTY;
  }

  return Object.freeze({ topOwnerMap, touchDaysBySphere, daysFor });
});
