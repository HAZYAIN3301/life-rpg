/* Satoru AI Memory Policy v1 — AG-35 «Personalization должна быть explainable,
 * editable и portable».
 *
 * Что уже есть и что этот модуль НЕ заменяет. Память ассистента живёт в
 * `users/<uid>/profile.json` и состоит из свободного текста, который ведёт
 * `profile-memory-v1`: ИИ переписывает, человек правит, бюджет 3000 символов.
 * Этот текст остаётся ровно там, где был, в том же файле и в том же поле. Здесь
 * НЕ создаётся второй источник правды: модуль добавляет в тот же файл массив
 * `entries` — структурные записи, у которых до сих пор не было своего места, —
 * и читает старый текст, не мигрируя и не переписывая его.
 *
 * Дыра, ради которой это заведено: полезная память тихо превращается в
 * поведенческое досье. Человек не знает, откуда Тень взяла утверждение о нём,
 * и не может его поправить, не снося аккаунт. AG-35 требует трёх вещей —
 * объяснимости, редактируемости и переносимости — и все три держатся на том,
 * что у каждой записи есть источник.
 *
 * Правила, которые здесь исполняются механически, а не по договорённости:
 *   - явно сказанное человеком старше выведенного программой;
 *   - выведенное не перезаписывает явно сказанное;
 *   - чувствительное нельзя создать выводом — только словами человека;
 *   - убранное из памяти не попадает в промпт;
 *   - каждая запись объясняет и свой источник, и причину попадания в промпт;
 *   - старый профиль читается без разрушительной миграции;
 *   - правка и удаление одной записи не трогают ни профиль, ни цели.
 *
 * Модуль без DOM, без сети, без часов: время приходит в операции.
 */
(function exposeAiMemoryPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AiMemoryPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAiMemoryPolicy() {
  'use strict';

  const VERSION = '1.0.0';

  // Порядок = приоритет. `explicit` — человек сказал сам; `imported` — приехало из
  // его собственного архива, то есть тоже авторское; `inferred` — посчитала
  // программа. Вывод всегда младше слов.
  const SOURCE_TYPES = Object.freeze(['explicit', 'imported', 'inferred']);
  const SENSITIVITIES = Object.freeze(['normal', 'sensitive']);
  const STATUSES = Object.freeze(['active', 'dismissed']);
  const CATEGORIES = Object.freeze([
    'identity', 'preference', 'constraint', 'pattern', 'goal_context', 'history', 'other',
  ]);
  // Кто имеет право читать запись. Пустой список — запись не уходит никуда;
  // это законное состояние «помню, но не рассказываю».
  const SCOPES = Object.freeze(['assistant_prompt', 'planning', 'reflection', 'shadow_voice']);

  const ENTRY_SCHEMA_VERSION = 1;
  // Версия формы файла: 1 — только старый свободный текст, 2 — текст + entries.
  const STORE_SCHEMA_VERSION = 2;

  const MAX_ENTRIES = 200;
  const MAX_TEXT = 400;
  const MAX_SOURCE_REF = 200;
  // Бюджет структурной части промпта. Свободный текст профиля живёт по своему
  // бюджету в profile-memory-v1 и сюда не входит.
  const MAX_PROMPT_CHARS = 1500;

  // Поля, которые человек может править у своей записи. `sourceType`, `confidence`
  // и `createdAt` в список не входят: их правит не человек, а сам факт правки.
  const PATCHABLE = Object.freeze(['text', 'category', 'scopes', 'sensitivity', 'status']);

  // ---------------------------------------------------------------- helpers --

  function text(value, max) {
    const s = String(value == null ? '' : value).trim();
    return max > 0 ? s.slice(0, max) : s;
  }
  function iso(value) {
    const s = text(value, 40);
    return s && Number.isFinite(Date.parse(s)) ? s : '';
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function oneOf(value, allowed) {
    return allowed.indexOf(value) >= 0 ? value : '';
  }
  function unit(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(1, Math.max(0, n));
  }
  function normalizeScopes(value) {
    const seen = [];
    for (const scope of list(value)) {
      const s = oneOf(text(scope, 40), SCOPES);
      if (s && seen.indexOf(s) < 0) seen.push(s);
    }
    return seen.sort();
  }
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return Object.freeze(value);
  }
  function clone(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
  }
  // Нормализация текста для поиска дублей: регистр и пробелы не делают из одного
  // факта два.
  function fingerprint(entry) {
    return `${entry.category}::${entry.text.toLowerCase().replace(/\s+/g, ' ')}`;
  }

  // ---------------------------------------------------------------- entries --

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = text(raw.id, 120);
    const body = text(raw.text, MAX_TEXT);
    const category = oneOf(text(raw.category, 40), CATEGORIES);
    const sourceType = oneOf(text(raw.sourceType, 40), SOURCE_TYPES);
    const createdAt = iso(raw.createdAt);
    const updatedAt = iso(raw.updatedAt) || createdAt;
    if (!id || !body || !category || !sourceType || !createdAt) return null;
    const sensitivity = oneOf(text(raw.sensitivity, 20), SENSITIVITIES) || 'normal';
    // Выводом чувствительное не создаётся вообще — ни новой операцией, ни чтением
    // с диска. Файл, в котором такая пара оказалась, испорчен или подделан, и
    // тихо «починить» его понижением чувствительности нельзя: это тот самый
    // случай, когда молчаливое исправление хуже отказа.
    if (sourceType === 'inferred' && sensitivity === 'sensitive') return null;
    return {
      id,
      schemaVersion: ENTRY_SCHEMA_VERSION,
      text: body,
      category,
      scopes: normalizeScopes(raw.scopes),
      sourceType,
      sourceRef: text(raw.sourceRef, MAX_SOURCE_REF),
      // Человек не «примерно» сказал то, что сказал.
      confidence: sourceType === 'explicit' ? 1 : unit(raw.confidence, 0.5),
      sensitivity,
      status: oneOf(text(raw.status, 20), STATUSES) || 'active',
      createdAt,
      updatedAt,
    };
  }

  function sourceRank(sourceType) {
    const i = SOURCE_TYPES.indexOf(sourceType);
    return i < 0 ? SOURCE_TYPES.length : i;
  }

  // Полный детерминированный порядок: источник → уверенность → свежесть → id.
  // Последняя ступень нужна ради воспроизводимости: без неё две одинаково
  // сильные записи менялись бы местами от прогона к прогону.
  function compareEntries(a, b) {
    const bySource = sourceRank(a.sourceType) - sourceRank(b.sourceType);
    if (bySource) return bySource;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.updatedAt !== a.updatedAt) return b.updatedAt < a.updatedAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  // ------------------------------------------------------------------ store --

  function emptyStore() {
    return {
      version: 1,
      schemaVersion: STORE_SCHEMA_VERSION,
      legacy: { text: '', updatedAt: null, auto: true },
      entries: [],
      damaged: false,
      dropped: 0,
      safeToWrite: true,
    };
  }

  function damagedStore() {
    const store = emptyStore();
    store.damaged = true;
    store.safeToWrite = false;
    return store;
  }

  /**
   * Читает `profile.json` в любой из его форм: старую (только свободный текст),
   * новую (текст + entries), архив экспорта и голую строку.
   *
   * Fail-safe устроен в два уровня, и это не перестраховка:
   *   - `damaged` — файл не разобран вообще. Читать нечего, ПИСАТЬ нельзя.
   *   - `dropped` — часть записей нечитаема. Показать можно то, что уцелело, но
   *     писать всё равно нельзя: перезапись потеряла бы непрочитанное навсегда.
   * Поэтому `safeToWrite` ложь в обоих случаях, а пустой результат никогда не
   * выдаётся за «памяти нет».
   */
  function normalizeMemoryStore(input) {
    if (input == null) return emptyStore();
    if (typeof input === 'string') {
      // Голая строка — это старейшая форма профиля, до того как у него появились
      // updatedAt и auto. Читаем как текст, ничего не выдумывая.
      const store = emptyStore();
      store.legacy = { text: text(input, 100000), updatedAt: null, auto: true };
      return store;
    }
    if (typeof input !== 'object' || Array.isArray(input)) return damagedStore();

    const store = emptyStore();
    // Архив экспорта кладёт старый текст в `legacy`, живой profile.json — в корень.
    // Обе формы читаются одним кодом, иначе round-trip держался бы на честном слове.
    const src = input;
    const legacy = src.legacy && typeof src.legacy === 'object' && !Array.isArray(src.legacy) ? src.legacy : src;

    store.legacy = {
      // Текст переносится дословно. Ни обрезки, ни переписывания, ни разбора на
      // записи: это авторский артефакт, и он остаётся первичным.
      text: typeof legacy.text === 'string' ? legacy.text : '',
      updatedAt: iso(legacy.updatedAt) || null,
      auto: legacy.auto === false ? false : true,
    };

    if (!('entries' in src) || src.entries == null) {
      // Старый файл без entries — совершенно валидное состояние, а не поломка.
      store.schemaVersion = typeof src.schemaVersion === 'number' && src.schemaVersion >= 2 ? src.schemaVersion : 1;
      return store;
    }
    if (!Array.isArray(src.entries)) return damagedStore();

    const seen = new Set();
    const entries = [];
    let dropped = 0;
    for (const raw of src.entries) {
      const entry = normalizeEntry(raw);
      if (!entry) { dropped += 1; continue; }
      if (seen.has(entry.id)) { dropped += 1; continue; }
      seen.add(entry.id);
      entries.push(entry);
    }
    if (entries.length > MAX_ENTRIES) {
      dropped += entries.length - MAX_ENTRIES;
      entries.length = MAX_ENTRIES;
    }
    store.schemaVersion = STORE_SCHEMA_VERSION;
    store.entries = entries.sort(compareEntries);
    store.dropped = dropped;
    store.safeToWrite = dropped === 0;
    return store;
  }

  // ------------------------------------------------------------- operations --

  // Обёртка замораживается, а store — нет. freezeDeep по всему результату
  // заморозил бы объект ВЫЗЫВАЮЩЕГО на пути отказа: чтение не имеет права
  // менять чужие данные, пусть даже «безопасно».
  function result(ok, reason, store, entryId) {
    return Object.freeze({ ok, reason, store, entryId: entryId || '' });
  }

  function findEntry(entries, id) {
    for (let i = 0; i < entries.length; i += 1) if (entries[i].id === id) return i;
    return -1;
  }

  function withEntries(store, entries) {
    const next = clone(store);
    next.entries = entries.slice().sort(compareEntries);
    return next;
  }

  /**
   * Применяет одну операцию и возвращает НОВЫЙ store. Вход не мутируется.
   * При отказе store возвращается прежним, а `reason` называет причину: молчаливый
   * отказ в памяти выглядел бы как «я запомнил» и был бы хуже ошибки.
   *
   * `operation.at` (ISO) обязателен для всего, что пишет: часов внутри нет.
   *
   * Операции: create · upsert · update · dismiss · restore · delete.
   */
  function applyMemoryOperation(store, operation) {
    const current = store && store.version === 1 && Array.isArray(store.entries) ? store : normalizeMemoryStore(store);
    const op = operation && typeof operation === 'object' ? operation : {};
    const kind = text(op.op, 20);
    const at = iso(op.at);

    if (!kind) return result(false, 'invalid_operation', current);
    // Писать поверх непрочитанного нельзя ни одной операцией, включая удаление:
    // «удалить одну» на файле, из которого не разобрались три, потеряет три.
    if (!current.safeToWrite) return result(false, 'store_not_writable', current);
    if (!at) return result(false, 'invalid_operation_time', current);

    if (kind === 'create' || kind === 'upsert') {
      const raw = op.entry && typeof op.entry === 'object' ? op.entry : null;
      if (!raw) return result(false, 'invalid_entry', current);
      const sourceType = oneOf(text(raw.sourceType, 40), SOURCE_TYPES);
      const sensitivity = oneOf(text(raw.sensitivity, 20), SENSITIVITIES) || 'normal';
      // Главный запрет AG-35: чувствительное о человеке не появляется из вывода.
      // Отказ идёт ДО нормализации, чтобы причина была названа честно, а не
      // спряталась за общим «invalid_entry».
      if (sourceType === 'inferred' && sensitivity === 'sensitive') {
        return result(false, 'sensitive_inference_rejected', current, text(raw.id, 120));
      }
      const entry = normalizeEntry(Object.assign({ createdAt: at, updatedAt: at }, raw));
      if (!entry) return result(false, 'invalid_entry', current);

      const index = findEntry(current.entries, entry.id);
      if (index < 0) {
        if (current.entries.length >= MAX_ENTRIES) return result(false, 'too_many_entries', current, entry.id);
        return result(true, 'created', withEntries(current, current.entries.concat([entry])), entry.id);
      }
      if (kind === 'create') return result(false, 'duplicate_id', current, entry.id);

      const existing = current.entries[index];
      // Вывод не спорит со словами. Программа, которая «уточнила» то, что человек
      // сказал сам, — это ровно то досье, против которого написана карточка.
      if (entry.sourceType === 'inferred' && existing.sourceType !== 'inferred') {
        return result(false, 'inferred_cannot_overwrite_explicit', current, entry.id);
      }
      const merged = Object.assign({}, entry, { createdAt: existing.createdAt, updatedAt: at });
      const nextEntries = current.entries.slice();
      nextEntries[index] = merged;
      return result(true, 'updated', withEntries(current, nextEntries), entry.id);
    }

    const id = text(op.id, 120);
    if (!id) return result(false, 'invalid_operation', current);
    const index = findEntry(current.entries, id);
    if (index < 0) return result(false, 'not_found', current, id);
    const existing = current.entries[index];

    if (kind === 'delete') {
      const nextEntries = current.entries.slice();
      nextEntries.splice(index, 1);
      return result(true, 'deleted', withEntries(current, nextEntries), id);
    }

    if (kind === 'dismiss' || kind === 'restore') {
      const status = kind === 'dismiss' ? 'dismissed' : 'active';
      if (existing.status === status) return result(true, 'unchanged', current, id);
      const nextEntries = current.entries.slice();
      nextEntries[index] = Object.assign({}, existing, { status, updatedAt: at });
      return result(true, kind === 'dismiss' ? 'dismissed' : 'restored', withEntries(current, nextEntries), id);
    }

    if (kind === 'update') {
      const patch = op.patch && typeof op.patch === 'object' && !Array.isArray(op.patch) ? op.patch : null;
      if (!patch) return result(false, 'invalid_patch', current, id);
      const keys = Object.keys(patch);
      if (!keys.length || keys.some((key) => PATCHABLE.indexOf(key) < 0)) return result(false, 'invalid_patch', current, id);

      const byUser = text(op.actor, 20) !== 'system';
      const draft = Object.assign({}, existing);
      if ('text' in patch) draft.text = patch.text;
      if ('category' in patch) draft.category = patch.category;
      if ('scopes' in patch) draft.scopes = patch.scopes;
      if ('sensitivity' in patch) draft.sensitivity = patch.sensitivity;
      if ('status' in patch) draft.status = patch.status;

      // Человек, поправивший выведенное, тем самым сказал это сам: запись
      // становится explicit. Именно это делает ошибочный вывод исправимым без
      // сноса аккаунта — обещание AG-35 одной строкой.
      if (byUser) {
        draft.sourceType = 'explicit';
        draft.confidence = 1;
        draft.sourceRef = 'user_edit';
      } else if (existing.sourceType !== 'inferred') {
        // Системная правка поверх сказанного человеком — это и есть перезапись
        // выводом, только через другую дверь. Дверь закрыта так же.
        return result(false, 'inferred_cannot_overwrite_explicit', current, id);
      }
      const wantsSensitive = oneOf(text(draft.sensitivity, 20), SENSITIVITIES) === 'sensitive';
      if (!byUser && wantsSensitive) return result(false, 'sensitive_inference_rejected', current, id);

      draft.updatedAt = at;
      const normalized = normalizeEntry(draft);
      if (!normalized) return result(false, 'invalid_patch', current, id);
      const nextEntries = current.entries.slice();
      nextEntries[index] = normalized;
      return result(true, 'updated', withEntries(current, nextEntries), id);
    }

    return result(false, 'unknown_op', current, id);
  }

  // ------------------------------------------------------------- explanation --

  const ORIGIN_TEXT = Object.freeze({
    explicit: 'Вы сказали это сами',
    imported: 'Пришло из вашего архива при импорте',
    inferred: 'Посчитано программой по вашим данным',
  });
  const SELECTION_REASON = Object.freeze({
    explicit: 'explicit_statement',
    imported: 'imported_from_archive',
    inferred: 'inferred_pattern',
  });

  /**
   * Объясняет одну запись человеческим языком: откуда она взялась, кто её увидит
   * и что с ней можно сделать. Без этого «редактируемость» остаётся кнопкой над
   * непонятной строкой.
   */
  function explainMemoryEntry(entry) {
    const e = normalizeEntry(entry);
    if (!e) return null;
    const origin = ORIGIN_TEXT[e.sourceType] || '';
    const where = e.status !== 'active'
      ? 'Убрано из памяти: в подсказки ассистента не попадает.'
      : e.scopes.length
        ? `Используется в: ${e.scopes.join(', ')}.`
        : 'Хранится, но никуда не передаётся.';
    return freezeDeep({
      id: e.id,
      text: e.text,
      category: e.category,
      sourceType: e.sourceType,
      sourceRef: e.sourceRef,
      confidence: e.confidence,
      sensitivity: e.sensitivity,
      status: e.status,
      scopes: e.scopes,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      origin: e.sourceRef ? `${origin} (${e.sourceRef})` : origin,
      usage: where,
      selectionReason: SELECTION_REASON[e.sourceType] || '',
      // Обе кнопки доступны всегда: память, которую нельзя убрать, — это досье.
      editable: true,
      deletable: true,
    });
  }

  // --------------------------------------------------------------- selection --

  /**
   * Собирает структурную часть контекста для модели.
   *
   * Возвращает и то, что вошло, и то, что НЕ вошло, с причиной. Список
   * исключённых — не отладка: без него «почему Тень этого не знает» остаётся
   * без ответа ровно так же, как «откуда Тень это взяла».
   *
   * Старый свободный текст отдаётся отдельным полем и дословно. Он не режется на
   * записи и не смешивается с ними: для старых пользователей ассистент обязан
   * работать ровно как раньше.
   */
  function selectMemoryForPrompt(store, context) {
    const current = store && store.version === 1 && Array.isArray(store.entries) ? store : normalizeMemoryStore(store);
    const ctx = context && typeof context === 'object' ? context : {};
    const scope = oneOf(text(ctx.scope, 40), SCOPES) || 'assistant_prompt';
    const maxChars = Number.isFinite(Number(ctx.maxChars)) && Number(ctx.maxChars) > 0 ? Number(ctx.maxChars) : MAX_PROMPT_CHARS;
    const limit = Number.isInteger(ctx.limit) && ctx.limit > 0 ? ctx.limit : MAX_ENTRIES;
    const allowSensitive = ctx.allowSensitive === true;

    const chosen = [];
    const excluded = [];
    const byFingerprint = new Map();
    let chars = 0;
    let truncated = false;

    for (const entry of current.entries.slice().sort(compareEntries)) {
      if (entry.status !== 'active') { excluded.push({ id: entry.id, reason: 'dismissed' }); continue; }
      if (entry.scopes.indexOf(scope) < 0) { excluded.push({ id: entry.id, reason: 'out_of_scope' }); continue; }
      // Чувствительное уходит в модель только по явному решению вызывающего.
      // Умолчание «не отправлять» здесь важнее удобства: отправить один раз
      // нельзя отменить.
      if (entry.sensitivity === 'sensitive' && !allowSensitive) {
        excluded.push({ id: entry.id, reason: 'sensitive_not_allowed' });
        continue;
      }
      const print = fingerprint(entry);
      const winner = byFingerprint.get(print);
      if (winner) { excluded.push({ id: entry.id, reason: `superseded_by:${winner}` }); continue; }
      if (chosen.length >= limit) { excluded.push({ id: entry.id, reason: 'limit_reached' }); truncated = true; continue; }
      // Бюджет режется по целым записям: обрезанная на полуслове память врёт
      // сильнее, чем отсутствующая.
      if (chars + entry.text.length > maxChars) {
        excluded.push({ id: entry.id, reason: 'budget_exhausted' });
        truncated = true;
        continue;
      }
      byFingerprint.set(print, entry.id);
      chars += entry.text.length;
      chosen.push(Object.assign({}, entry, {
        rank: chosen.length + 1,
        selectionReason: SELECTION_REASON[entry.sourceType] || '',
      }));
    }

    return freezeDeep({
      version: 1,
      scope,
      legacyText: current.legacy.text,
      legacySource: 'profile-memory-v1',
      entries: chosen,
      excluded: excluded.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      chars,
      maxChars,
      truncated,
      // Если файл не прочитан целиком, промпт обязан это признать, а не выглядеть
      // как полная память.
      partial: !current.safeToWrite,
    });
  }

  // ------------------------------------------------------------------ export --

  /**
   * Человекочитаемый и обратно читаемый архив. `normalizeMemoryStore(exportMemory(s))`
   * возвращает тот же store — переносимость без round-trip это обещание, а не
   * свойство.
   */
  function exportMemory(store) {
    const current = store && store.version === 1 && Array.isArray(store.entries) ? store : normalizeMemoryStore(store);
    return freezeDeep({
      format: 'satoru-ai-memory',
      version: 1,
      schemaVersion: current.schemaVersion,
      legacy: {
        text: current.legacy.text,
        updatedAt: current.legacy.updatedAt,
        auto: current.legacy.auto,
        source: 'profile-memory-v1',
      },
      entries: current.entries.map((entry) => Object.assign({}, entry)),
      counts: {
        total: current.entries.length,
        active: current.entries.filter((e) => e.status === 'active').length,
        dismissed: current.entries.filter((e) => e.status === 'dismissed').length,
        sensitive: current.entries.filter((e) => e.sensitivity === 'sensitive').length,
        unreadable: current.dropped,
      },
    });
  }

  return {
    VERSION,
    SOURCE_TYPES,
    SENSITIVITIES,
    STATUSES,
    CATEGORIES,
    SCOPES,
    PATCHABLE,
    ENTRY_SCHEMA_VERSION,
    STORE_SCHEMA_VERSION,
    MAX_ENTRIES,
    MAX_PROMPT_CHARS,
    normalizeMemoryStore,
    applyMemoryOperation,
    selectMemoryForPrompt,
    explainMemoryEntry,
    exportMemory,
  };
});
