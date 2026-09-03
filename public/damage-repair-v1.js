/* Ремонт порчи, оставленной разрывом многобайтовых символов (DEVLOG 03.09).
 *
 * Байты потеряны безвозвратно, поэтому НИЧЕГО НЕ УГАДЫВАЕМ. Единственный честный источник
 * целой строки — бэкап, снятый до порчи: там та же запись, тот же ключ, но без «�».
 * Модуль чистый: ни файлов, ни сети, ни времени. Решение о записи принимает вызывающий.
 */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DamageRepairV1 = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const VERSION = 1;
  const MARK = '�';
  const MAX_SPOTS = 500;

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const idOf = (v) => (isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number')) ? String(v.id) : '';

  /** Все строки с потерянными символами: путь, ключ, id ближайшего носителя. */
  function findDamage(value, path = '', carrier = '', out = []) {
    if (out.length >= MAX_SPOTS) return out;
    if (typeof value === 'string') {
      if (value.includes(MARK)) {
        const key = path.slice(path.lastIndexOf('.') + 1);
        out.push({ path, key, carrier, marks: (value.match(/�/g) || []).length, length: value.length });
      }
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => findDamage(item, `${path}[${i}]`, idOf(item) || carrier, out));
      return out;
    }
    if (isObj(value)) {
      const own = idOf(value) || carrier;
      for (const k of Object.keys(value)) findDamage(value[k], `${path}.${k}`, own, out);
    }
    return out;
  }

  function atPath(root, path) {
    let node = root;
    const parts = path.match(/\[[0-9]+\]|\.[^.[]+/g) || [];
    for (const part of parts) {
      if (node == null) return undefined;
      node = part[0] === '[' ? node[Number(part.slice(1, -1))] : node[part.slice(1)];
    }
    return node;
  }

  /** Ищем целую строку по id носителя — индекс в массиве мог сдвинуться. */
  function findByCarrier(value, carrier, key, out = { found: null }) {
    if (out.found !== null) return out;
    if (Array.isArray(value)) { for (const item of value) findByCarrier(item, carrier, key, out); return out; }
    if (isObj(value)) {
      if (idOf(value) === carrier && typeof value[key] === 'string' && !value[key].includes(MARK)) {
        out.found = value[key]; return out;
      }
      for (const k of Object.keys(value)) findByCarrier(value[k], carrier, key, out);
    }
    return out;
  }

  /**
   * План ремонта: для каждой порчи ищем целую строку сначала по id носителя, затем по пути.
   * Бэкапы передаются от НОВОГО к старому — берём первую целую версию.
   */
  function planRepair(current, backups) {
    const spots = findDamage(current);
    const plan = [];
    for (const spot of spots) {
      let clean = null, source = '';
      for (let i = 0; i < (backups || []).length; i += 1) {
        const backup = backups[i];
        if (spot.carrier) {
          const hit = findByCarrier(backup.value, spot.carrier, spot.key).found;
          if (typeof hit === 'string') { clean = hit; source = backup.label || String(i); break; }
        }
        const byPath = atPath(backup.value, spot.path);
        if (typeof byPath === 'string' && !byPath.includes(MARK)) { clean = byPath; source = backup.label || String(i); break; }
      }
      plan.push({ path: spot.path, key: spot.key, carrier: spot.carrier, marks: spot.marks, clean, source });
    }
    return { version: VERSION, spots: spots.length, repairable: plan.filter((p) => p.clean !== null).length, plan };
  }

  /** Применяем только те места, для которых нашлась целая строка. Остальное не трогаем. */
  function applyRepair(current, plan) {
    const next = JSON.parse(JSON.stringify(current));
    let applied = 0;
    for (const item of (plan || [])) {
      if (item.clean === null || item.clean === undefined) continue;
      const parts = item.path.match(/\[[0-9]+\]|\.[^.[]+/g) || [];
      if (!parts.length) continue;
      let node = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        node = part[0] === '[' ? node[Number(part.slice(1, -1))] : node[part.slice(1)];
        if (node == null) break;
      }
      if (node == null) continue;
      const last = parts[parts.length - 1];
      const key = last[0] === '[' ? Number(last.slice(1, -1)) : last.slice(1);
      if (typeof node[key] !== 'string' || !node[key].includes(MARK)) continue;
      node[key] = item.clean; applied += 1;
    }
    return { value: next, applied };
  }

  return Object.freeze({ VERSION, MARK, MAX_SPOTS, findDamage, planRepair, applyRepair });
}));
