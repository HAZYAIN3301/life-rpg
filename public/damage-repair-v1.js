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

  function carrierAtPath(root, path) {
    let node = root, carrier = idOf(root);
    for (const part of path.match(/\[[0-9]+\]|\.[^.[]+/g) || []) {
      if (node == null) return '';
      node = part[0] === '[' ? node[Number(part.slice(1, -1))] : node[part.slice(1)];
      carrier = idOf(node) || carrier;
    }
    return carrier;
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
        const byPath = !spot.carrier || carrierAtPath(backup.value, spot.path) === spot.carrier
          ? atPath(backup.value, spot.path) : undefined;
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

  function summary(areas) {
    const rows = [], fingerprint = [];
    for (const [area, value] of Object.entries(areas)) {
      const spots = findDamage(value);
      if (spots.length) rows.push({ area, count: spots.length });
      for (const spot of spots) fingerprint.push([area, spot.path, spot.carrier, atPath(value, spot.path)]);
    }
    let hash = 2166136261;
    for (const ch of JSON.stringify(fingerprint)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    return { rows, signature: String(hash >>> 0) };
  }
  function validReceipt(data) {
    const count = n => Number.isSafeInteger(n) && n >= 0;
    return data?.ok === true && data.apply === true && Array.isArray(data.report)
      && ['total', 'fixable', 'done'].every(k => count(data[k]))
      && data.report.every(r => typeof r.file === 'string' && ['spots', 'repairable', 'applied'].every(k => count(r[k])) && r.applied <= r.repairable && r.repairable <= r.spots)
      && data.total === data.report.reduce((s, r) => s + r.spots, 0)
      && data.fixable === data.report.reduce((s, r) => s + r.repairable, 0)
      && data.done === data.report.reduce((s, r) => s + r.applied, 0);
  }
  /*
   * Восстановление без бэкапа (владелец 03.10: «у нас же есть ИИ — пусть исправит»). Байты
   * потеряны, поэтому догадку делает модель, но ей разрешено ТОЛЬКО заполнить дыры: всё вне
   * «�» остаётся символ в символ, а каждая серия из N знаков становится 1…N символами
   * (потерянная кириллическая буква оставляет два знака). Наружу уходят лишь фрагменты
   * вокруг дыр, не весь текст.
   */
  function windows(text, radius = 60) {
    const out = [];
    const re = /�+/g; let m;
    while ((m = re.exec(String(text || '')))) {
      let start = Math.max(0, m.index - radius), end = Math.min(text.length, m.index + m[0].length + radius);
      if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start])) start -= 1; // never split a surrogate pair
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end += 1;
      const last = out[out.length - 1];
      if (last && start <= last.end) last.end = Math.max(last.end, end); else out.push({ start, end });
    }
    return out.map((w) => ({ start: w.start, end: w.end, text: text.slice(w.start, w.end) }));
  }
  function escapeRe(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function restorationValid(damaged, fixed) {
    if (typeof damaged !== 'string' || typeof fixed !== 'string' || !damaged.includes(MARK) || fixed.includes(MARK)) return false;
    const parts = damaged.split(/(�+)/);
    const pattern = parts.map((part, i) => (i % 2 ? `[^\\uFFFD\\r\\n]{1,${[...part].length}}` : escapeRe(part))).join('');
    try { return new RegExp(`^${pattern}$`, 'u').test(fixed); } catch { return false; }
  }
  /** Вставить исправленные фрагменты обратно; хоть один неверный — строка остаётся как была. */
  function spliceWindows(text, wins, fixedTexts) {
    let out = String(text);
    for (let i = wins.length - 1; i >= 0; i -= 1) {
      if (!restorationValid(wins[i].text, fixedTexts[i])) return null;
      out = out.slice(0, wins[i].start) + fixedTexts[i] + out.slice(wins[i].end);
    }
    return out.includes(MARK) ? null : out;
  }
  /** План из готовых восстановлений: только если строка на месте та же и замена честная. */
  function planFromRestorations(current, items) {
    const plan = [];
    for (const item of (items || [])) {
      if (!item || typeof item.path !== 'string') continue;
      const now = atPath(current, item.path);
      if (typeof now !== 'string' || now !== item.from || !restorationValid(item.from, item.to)) continue;
      plan.push({ path: item.path, clean: item.to, source: 'restoration' });
    }
    return plan;
  }

  return Object.freeze({ VERSION, MARK, MAX_SPOTS, findDamage, planRepair, applyRepair, summary, validReceipt,
    windows, restorationValid, spliceWindows, planFromRestorations });
}));
