/* Satoru Return Shelf v1 — Полка возвращения (DISCIPLINE-ESCAPE-PLAN §13).
 *
 * Задача, названная Альбертом: «была идея сделать небольшую ленту, куда можно скидывать
 * цитаты, картинки, подкасты и эдиты — тогда не надо будет заходить в тикток ради
 * мотивации, подвергаясь риску думскролла». То есть сейчас за одним полезным роликом
 * приходится входить в среду, спроектированную так, чтобы человек не вышел.
 *
 * ⚠️ Главный риск этой фичи — что она сама станет тем, от чего спасает. Приложение
 * против доомскролла, которое отрастило собственную бесконечную ленту, — это провал
 * дороже, чем отсутствие фичи. Поэтому ограничения ниже не настройки, а конструкция:
 *
 *  — пачка КОНЕЧНА: default 3, максимум 5. Не «первые 3 из бесконечности», а всё,
 *    что выдаётся за вход. Дальше выдавать нечего, и это не баг;
 *  — порядок ДЕТЕРМИНИРОВАННЫЙ, без случайности и без «рекомендаций». Случайная
 *    выдача «ещё одного» — механика игрового автомата, здесь её нет и не будет;
 *  — просмотр НЕ даёт ни XP, ни золота. Иначе смотреть вдохновение станет выгоднее,
 *    чем делать дело, и Полка превратится в способ фармить прогресс;
 *  — никаких лайков, просмотров и любых публичных счётчиков популярности;
 *  — у каждого материала есть СЛЕДУЮЩЕЕ ДЕЙСТВИЕ. Материал без выхода в действие —
 *    это потребление, ради замены которого всё и строится.
 *
 * Контур наполнения замкнут (§13): рабочая цель «найти N референсов» кладёт материалы
 * прямо сюда и закрывается по достижении N. Отдельного входа «зайду в TikTok ради
 * Полки» не существует — иначе Полка стала бы оправданием для ленты.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ рекомендует. Здесь нет ранжирования, «похожего» и персонализации;
 *  — НЕ хранит чужое медиа: только ссылка, разрешённое preview и своя заметка (§13);
 *  — НЕ начисляет ничего — подключить награду физически некуда;
 *  — НЕ открывает внешний источник сам: это отдельное решение и своя attention policy.
 *
 * Чистый модуль: только данные на входе. Все операции иммутабельны.
 */
(function exposeReturnShelf(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReturnShelfV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildReturnShelf() {
  'use strict';

  const VERSION = '1.0.0';

  // §13: конечная пачка. Три — сколько человек реально усваивает за один заход;
  // пять — потолок, за которым это снова просмотр ленты, только своей.
  const BATCH_DEFAULT = 3;
  const BATCH_MAX = 5;

  // Полка не склад. Больше сорока — это уже «когда-нибудь посмотрю», то есть та же
  // прокрастинация, только аккуратно сложенная.
  const MAX_ITEMS = 40;

  const MAX_TITLE = 120;
  const MAX_WHY = 200;      // «что именно я отсюда беру» — обязательное поле
  const MAX_NOTE = 500;
  const MAX_URL = 500;

  // Энергетический меняет состояние за 30–90 секунд и отправляет дальше.
  // Практический требует времени и обязан иметь ожидаемый вывод (§13).
  const KINDS = Object.freeze({ energy: 'energy', practical: 'practical' });

  // Чем заканчивается материал. «Отложить» — полноправный выход без наказания:
  // иначе Полка станет ещё одним местом, где ты кому-то должен.
  const NEXT_ACTIONS = Object.freeze(['quest', 'focus', 'note', 'project', 'postpone']);

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const isDay = (s) => typeof s === 'string' && ISO_DAY.test(s);
  const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return null;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  /**
   * Ссылка хранится, чужое медиа — нет (§13). Схема ограничена http/https: `javascript:`
   * и `data:` в поле, которое потом попадёт в разметку, — это XSS, а не гибкость.
   */
  function cleanUrl(raw) {
    const s = str(raw, MAX_URL);
    if (!s) return null;
    return /^https?:\/\/[^\s]+$/i.test(s) ? s : null;
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = str(raw.id, 40);
    const title = str(raw.title, MAX_TITLE);
    // «Что я отсюда беру» обязательно. Без этого материал — просто ссылка, которую
    // однажды сохранили, и Полка превращается в свалку вкладок.
    const why = str(raw.why, MAX_WHY);
    if (!id || !title || !why) return null;
    if (!Object.prototype.hasOwnProperty.call(KINDS, raw.kind)) return null;

    const out = { id, kind: raw.kind, title, why, seenCount: 0 };
    const url = cleanUrl(raw.url); if (url) out.url = url;
    const note = str(raw.note, MAX_NOTE); if (note) out.note = note;
    const source = str(raw.source, 40); if (source) out.source = source;
    if (isDay(raw.addedOn)) out.addedOn = raw.addedOn;

    // Практический обязан нести ожидаемый вывод и точку остановки — иначе «саморазвитие»
    // без практики, то есть потребление под уважительным предлогом (§13).
    if (raw.kind === KINDS.practical) {
      const expect = str(raw.expect, MAX_WHY);
      if (!expect) return null;
      out.expect = expect;
      const stop = str(raw.stopAt, 60); if (stop) out.stopAt = stop;
      const mins = Math.floor(Number(raw.minutes));
      if (Number.isFinite(mins) && mins > 0 && mins <= 240) out.minutes = mins;
    }

    for (const [k, max] of [['goalId', 40], ['taskId', 40], ['projectId', 40]]) {
      const v = str(raw[k], max); if (v) out[k] = v;
    }
    if (isDay(raw.expiresOn)) out.expiresOn = raw.expiresOn;
    if (isDay(raw.archivedOn)) out.archivedOn = raw.archivedOn;
    const seen = Math.floor(Number(raw.seenCount));
    if (Number.isFinite(seen) && seen > 0) out.seenCount = Math.min(seen, 99);
    if (isIso(raw.lastSeenAt)) out.lastSeenAt = raw.lastSeenAt;
    if (NEXT_ACTIONS.includes(raw.lastAction)) out.lastAction = raw.lastAction;
    return out;
  }

  function emptyState() { return { version: 1, items: [] }; }

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
    return { version: 1, items };
  }

  function isLive(item, today) {
    if (!item || item.archivedOn) return false;
    if (item.expiresOn && isDay(today)) {
      const left = daysBetween(today, item.expiresOn);
      if (left !== null && left < 0) return false;
    }
    return true;
  }

  function liveItems(state, today) { return normalize(state).items.filter((i) => isLive(i, today)); }

  function add(state, draft) {
    const s = normalize(state);
    const item = cleanItem(draft);
    if (!item) return { ok: false, error: 'invalid' };
    if (s.items.some((i) => i.id === item.id)) return { ok: false, error: 'duplicate' };
    if (s.items.filter((i) => !i.archivedOn).length >= MAX_ITEMS) return { ok: false, error: 'full' };
    return { ok: true, state: { ...s, items: s.items.concat([item]) } };
  }

  function archive(state, id, today) {
    const s = normalize(state);
    if (!isDay(today)) return s;
    return { ...s, items: s.items.map((i) => (i.id === String(id) && !i.archivedOn ? { ...i, archivedOn: today } : i)) };
  }

  function remove(state, id) {
    const s = normalize(state);
    return { ...s, items: s.items.filter((i) => i.id !== String(id)) };
  }

  /**
   * Пачка на один заход.
   *
   * Порядок ДЕТЕРМИНИРОВАННЫЙ и объяснимый: сначала невиденное, затем виденное реже,
   * при равенстве — то, что дольше лежит. Никакой случайности: «ещё одно наугад» —
   * это механика автомата, а не библиотеки. Человек должен уметь предсказать, что
   * увидит, иначе Полка начнёт работать как лента.
   *
   * `kind` сужает выдачу: перед делом нужен энергетический на минуту, а не лекция.
   */
  function batch(state, today, opts) {
    const o = Object.assign({ size: BATCH_DEFAULT, kind: null }, opts || {});
    const size = Math.max(1, Math.min(BATCH_MAX, Math.floor(Number(o.size)) || BATCH_DEFAULT));
    let live = liveItems(state, today);
    if (o.kind && Object.prototype.hasOwnProperty.call(KINDS, o.kind)) {
      live = live.filter((i) => i.kind === o.kind);
    }
    return live
      .slice()
      .sort((a, b) => (a.seenCount - b.seenCount)
        || String(a.addedOn || '').localeCompare(String(b.addedOn || ''))
        || a.id.localeCompare(b.id))
      .slice(0, size);
  }

  /**
   * Материал показан и завершён выбранным действием.
   *
   * Действие обязательно: §13 «просмотренное архивируется или получает следующее
   * действие». Материал, который просто посмотрели и оставили лежать, — это и есть
   * потребление, от которого Полка спасает.
   *
   * `postpone` не наказывается ничем и не считается хуже остальных: право отложить
   * без последствий — то же самое, что возврат заказа на доске.
   */
  function complete(state, id, action, at, today) {
    const s = normalize(state);
    const key = String(id);
    const item = s.items.find((i) => i.id === key);
    if (!item) return { ok: false, error: 'not_found' };
    if (!NEXT_ACTIONS.includes(action)) return { ok: false, error: 'action_required' };
    const next = { ...item, seenCount: Math.min(99, (item.seenCount || 0) + 1), lastAction: action };
    if (isIso(at)) next.lastSeenAt = at;
    // Практический материал одноразовый: гайд, который «посмотрю ещё раз», обычно
    // не смотрят, а держат как незакрытый долг. Энергетический живёт дальше — эдит
    // на то и эдит, чтобы работать много раз.
    if (item.kind === KINDS.practical && action !== 'postpone' && isDay(today)) next.archivedOn = today;
    return { ok: true, state: { ...s, items: s.items.map((i) => (i.id === key ? next : i)) }, item: next };
  }

  /**
   * Доля заходов, после которых человек перешёл к делу. §13: «главная метрика —
   * переход к выбранному действию, а не число просмотров».
   *
   * `postpone` считается просмотром без перехода, но НЕ провалом: он честно попадает
   * в знаменатель и не попадает в числитель, и всё. Знаменатель отдаётся наружу —
   * доля без него врёт на малых числах, тот же гейт, что в калибровке внимания.
   */
  function actionRate(state) {
    const seen = normalize(state).items.filter((i) => i.seenCount > 0 && i.lastAction);
    const moved = seen.filter((i) => i.lastAction !== 'postpone');
    return {
      seen: seen.length,
      moved: moved.length,
      ratio: seen.length ? moved.length / seen.length : null,
    };
  }

  /** Материалы, у которых вышел срок, — их можно убрать без спроса и без сожаления. */
  function expired(state, today) {
    return normalize(state).items.filter((i) => !i.archivedOn && i.expiresOn
      && isDay(today) && (daysBetween(today, i.expiresOn) ?? 0) < 0);
  }

  /**
   * Свободные места под текущую сессию поиска референсов (§13, замкнутый контур).
   * Сессия закрывается по достижении N — модуль отдаёт остаток, решает вызывающий.
   */
  function captureRoom(state, cap, today) {
    const n = Math.floor(Number(cap));
    if (!Number.isFinite(n) || n <= 0) return 0;
    const room = MAX_ITEMS - liveItems(state, today).length;
    return Math.max(0, Math.min(n, room));
  }

  return Object.freeze({
    VERSION, KINDS, NEXT_ACTIONS, BATCH_DEFAULT, BATCH_MAX, MAX_ITEMS,
    emptyState, normalize, liveItems, isLive,
    add, archive, remove, complete,
    batch, actionRate, expired, captureRoom,
  });
});
