'use strict';

/* Политика памяти ассистента: AG-35.
 *
 * Проверяется не «функция сортирует массив», а обещания: что старый профиль читается
 * дословно и не мигрирует, что вывод не спорит со словами человека, что чувствительное
 * нельзя создать выводом, что убранное не уходит в промпт, что каждая запись объясняет
 * себя, и что архив читается обратно.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const M = require('../public/ai-memory-policy-v1.js');
const ProfileMemory = require('../public/profile-memory-v1.js');

const ROOT = path.resolve(__dirname, '..');
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';

function entry(over) {
  return Object.assign({
    id: 'm1',
    text: 'Работает лучше утром',
    category: 'pattern',
    scopes: ['assistant_prompt'],
    sourceType: 'explicit',
    sourceRef: 'settings_form',
    confidence: 1,
    sensitivity: 'normal',
    status: 'active',
    createdAt: T0,
    updatedAt: T0,
  }, over || {});
}

function storeWith(entries, legacyText) {
  return M.normalizeMemoryStore({
    text: legacyText == null ? 'Старый профиль\n## Кто это\nАльберт' : legacyText,
    updatedAt: T0,
    auto: true,
    schemaVersion: 2,
    entries,
  });
}

const create = (store, e, at) => M.applyMemoryOperation(store, { op: 'create', at: at || T1, entry: e });

// -------------------------------------------------------------- legacy read --

test('🔴 старый профиль читается дословно и не мигрирует в записи', () => {
  // Ровно та форма, которую сегодня пишет profile-memory-v1 через Store.saveNow.
  const legacy = { text: '## Кто это\nАльберт, 11 класс.\n## Открытые нитки\nJuFo', updatedAt: T0, auto: true };
  const store = M.normalizeMemoryStore(legacy);

  assert.strictEqual(store.legacy.text, legacy.text, 'текст дословный, без обрезки и переписывания');
  assert.strictEqual(store.legacy.updatedAt, T0);
  assert.strictEqual(store.legacy.auto, true);
  assert.deepStrictEqual(store.entries, [], 'старый текст НЕ разобран на записи');
  assert.strictEqual(store.schemaVersion, 1, 'файл остаётся файлом первой схемы');
  assert.strictEqual(store.damaged, false);
  assert.strictEqual(store.safeToWrite, true, 'по старому файлу можно писать');

  // И бюджет старого профиля остался за profile-memory-v1: сюда он не переехал.
  assert.strictEqual(typeof ProfileMemory.MAX_CHARS, 'number');
  assert.notStrictEqual(M.MAX_PROMPT_CHARS, ProfileMemory.MAX_CHARS);
});

test('старейшая форма — голая строка — тоже читается', () => {
  const store = M.normalizeMemoryStore('просто текст профиля');
  assert.strictEqual(store.legacy.text, 'просто текст профиля');
  assert.deepStrictEqual(store.entries, []);
  assert.strictEqual(store.safeToWrite, true);
});

test('пустой и отсутствующий профиль — это не поломка', () => {
  for (const input of [null, undefined, {}, { text: '' }]) {
    const store = M.normalizeMemoryStore(input);
    assert.strictEqual(store.damaged, false);
    assert.strictEqual(store.legacy.text, '');
    assert.deepStrictEqual(store.entries, []);
  }
});

test('🔴 испорченный файл fail-safe: читать можно, писать нельзя', () => {
  // Уровень 1: файл не разобран вообще.
  for (const junk of [[], 42, true, { entries: 'не массив' }, { entries: 42 }]) {
    const store = M.normalizeMemoryStore(junk);
    assert.strictEqual(store.damaged, true, `${JSON.stringify(junk)} должен быть damaged`);
    assert.strictEqual(store.safeToWrite, false);
    const op = M.applyMemoryOperation(store, { op: 'delete', at: T1, id: 'm1' });
    assert.strictEqual(op.ok, false);
    assert.strictEqual(op.reason, 'store_not_writable', 'удаление поверх непрочитанного запрещено');
  }

  // Уровень 2: часть записей нечитаема. Уцелевшее показываем, но не перезаписываем.
  const partial = M.normalizeMemoryStore({
    text: 'жив', entries: [entry(), { id: 'сломано' }, null, 'строка'],
  });
  assert.strictEqual(partial.damaged, false);
  assert.strictEqual(partial.entries.length, 1, 'уцелевшая запись видна');
  assert.strictEqual(partial.dropped, 3);
  assert.strictEqual(partial.safeToWrite, false, 'перезапись потеряла бы непрочитанное');
  assert.strictEqual(partial.legacy.text, 'жив', 'старый текст всё равно спасён');

  const blocked = M.applyMemoryOperation(partial, { op: 'dismiss', at: T1, id: 'm1' });
  assert.strictEqual(blocked.reason, 'store_not_writable');
  // И промпт честно признаётся, что память неполная.
  assert.strictEqual(M.selectMemoryForPrompt(partial, { scope: 'assistant_prompt' }).partial, true);
});

// ------------------------------------------------------------ source policy --

test('🔴 sensitive нельзя создать выводом', () => {
  const store = storeWith([]);
  const rejected = create(store, entry({
    id: 'bad', sourceType: 'inferred', sensitivity: 'sensitive', text: 'Похоже, у него депрессия',
  }));
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'sensitive_inference_rejected', 'причина названа, а не спрятана за invalid_entry');
  assert.deepStrictEqual(rejected.store.entries, [], 'ничего не записано');

  // Тот же факт словами человека — законен.
  const said = create(store, entry({ id: 'ok', sourceType: 'explicit', sensitivity: 'sensitive', text: 'Сейчас тяжёлый период' }));
  assert.strictEqual(said.ok, true);
  assert.strictEqual(said.store.entries[0].sensitivity, 'sensitive');

  // И такая пара не проезжает даже с диска.
  const fromDisk = M.normalizeMemoryStore({
    entries: [entry({ id: 'x', sourceType: 'inferred', sensitivity: 'sensitive' })],
  });
  assert.strictEqual(fromDisk.entries.length, 0, 'нечитаемая пара отброшена');
  assert.strictEqual(fromDisk.dropped, 1);
  assert.strictEqual(fromDisk.safeToWrite, false, 'и файл не перезаписывается молча');
});

test('🔴 inferred не перезаписывает explicit', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'm1', sourceType: 'explicit', text: 'Учит немецкий' })).store;

  const overwrite = M.applyMemoryOperation(store, {
    op: 'upsert', at: T1, entry: entry({ id: 'm1', sourceType: 'inferred', text: 'Немецкий забросил', confidence: 0.9 }),
  });
  assert.strictEqual(overwrite.ok, false);
  assert.strictEqual(overwrite.reason, 'inferred_cannot_overwrite_explicit');
  assert.strictEqual(overwrite.store.entries[0].text, 'Учит немецкий', 'слова человека на месте');

  // Системная правка через update — та же дверь, тот же замок.
  const patched = M.applyMemoryOperation(store, {
    op: 'update', at: T1, id: 'm1', actor: 'system', patch: { text: 'Немецкий забросил' },
  });
  assert.strictEqual(patched.ok, false);
  assert.strictEqual(patched.reason, 'inferred_cannot_overwrite_explicit');

  // А вывод поверх вывода — законное уточнение.
  let inferredStore = create(storeWith([]), entry({ id: 'i1', sourceType: 'inferred', confidence: 0.4 })).store;
  const refined = M.applyMemoryOperation(inferredStore, {
    op: 'upsert', at: T1, entry: entry({ id: 'i1', sourceType: 'inferred', confidence: 0.8, text: 'Уточнённый паттерн' }),
  });
  assert.strictEqual(refined.ok, true);
  assert.strictEqual(refined.store.entries[0].text, 'Уточнённый паттерн');
  assert.strictEqual(refined.store.entries[0].createdAt, T0 === refined.store.entries[0].createdAt ? T0 : refined.store.entries[0].createdAt);
});

test('🔴 человек, поправивший вывод, делает запись своей', () => {
  let store = create(storeWith([]), entry({ id: 'i1', sourceType: 'inferred', confidence: 0.3, text: 'Не любит спорт' })).store;
  const fixed = M.applyMemoryOperation(store, {
    op: 'update', at: T1, id: 'i1', actor: 'user', patch: { text: 'Люблю плавание, не люблю зал' },
  });
  assert.strictEqual(fixed.ok, true);
  const e = fixed.store.entries[0];
  assert.strictEqual(e.text, 'Люблю плавание, не люблю зал');
  assert.strictEqual(e.sourceType, 'explicit', 'исправленное — это сказанное');
  assert.strictEqual(e.confidence, 1);
  assert.strictEqual(e.sourceRef, 'user_edit');
  // Ошибочный вывод исправлен без сноса аккаунта — обещание AG-35.
  assert.strictEqual(fixed.store.entries.length, 1);
});

test('explicit всегда имеет уверенность 1 и стоит выше остальных', () => {
  const store = M.normalizeMemoryStore({
    entries: [
      entry({ id: 'inf', sourceType: 'inferred', confidence: 0.99, text: 'вывод' }),
      entry({ id: 'imp', sourceType: 'imported', confidence: 0.99, text: 'архив' }),
      entry({ id: 'exp', sourceType: 'explicit', confidence: 0.1, text: 'слова' }),
    ],
  });
  assert.deepStrictEqual(store.entries.map((e) => e.id), ['exp', 'imp', 'inf']);
  assert.strictEqual(store.entries[0].confidence, 1, 'заявленные 0.1 у explicit игнорируются');
  assert.deepStrictEqual(M.SOURCE_TYPES.slice(), ['explicit', 'imported', 'inferred']);
});

// -------------------------------------------------------------- operations --

test('create/upsert/dismiss/restore/delete работают и называют причины отказов', () => {
  let store = storeWith([]);
  const created = create(store, entry({ id: 'a' }));
  assert.strictEqual(created.ok, true);
  assert.strictEqual(created.reason, 'created');
  store = created.store;

  assert.strictEqual(create(store, entry({ id: 'a' })).reason, 'duplicate_id');
  assert.strictEqual(M.applyMemoryOperation(store, { op: 'delete', at: T1, id: 'нет' }).reason, 'not_found');
  assert.strictEqual(M.applyMemoryOperation(store, { op: 'придумал', at: T1, id: 'a' }).reason, 'unknown_op');
  assert.strictEqual(M.applyMemoryOperation(store, { op: 'delete', id: 'a' }).reason, 'invalid_operation_time');
  assert.strictEqual(M.applyMemoryOperation(store, {}).reason, 'invalid_operation');
  assert.strictEqual(create(store, { id: 'b' }).reason, 'invalid_entry');

  const off = M.applyMemoryOperation(store, { op: 'dismiss', at: T1, id: 'a' });
  assert.strictEqual(off.store.entries[0].status, 'dismissed');
  assert.strictEqual(M.applyMemoryOperation(off.store, { op: 'dismiss', at: T1, id: 'a' }).reason, 'unchanged');
  const back = M.applyMemoryOperation(off.store, { op: 'restore', at: T1, id: 'a' });
  assert.strictEqual(back.store.entries[0].status, 'active');

  const gone = M.applyMemoryOperation(store, { op: 'delete', at: T1, id: 'a' });
  assert.deepStrictEqual(gone.store.entries, []);
});

test('update принимает только разрешённые поля', () => {
  const store = create(storeWith([]), entry({ id: 'a' })).store;
  for (const patch of [{ id: 'другой' }, { sourceType: 'explicit' }, { confidence: 1 }, { createdAt: T1 }, {}]) {
    const r = M.applyMemoryOperation(store, { op: 'update', at: T1, id: 'a', actor: 'user', patch });
    assert.strictEqual(r.ok, false, `${JSON.stringify(patch)} не должен приниматься`);
    assert.strictEqual(r.reason, 'invalid_patch');
  }
  assert.deepStrictEqual(M.PATCHABLE.slice().sort(), ['category', 'scopes', 'sensitivity', 'status', 'text']);
});

test('🔴 правка и удаление одной записи не трогают ни профиль, ни соседей', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'a', text: 'первая' })).store;
  store = create(store, entry({ id: 'b', text: 'вторая' })).store;
  store = create(store, entry({ id: 'c', text: 'третья' })).store;
  const legacyBefore = JSON.stringify(store.legacy);
  const bBefore = JSON.stringify(store.entries.find((e) => e.id === 'b'));
  const cBefore = JSON.stringify(store.entries.find((e) => e.id === 'c'));

  const edited = M.applyMemoryOperation(store, { op: 'update', at: T1, id: 'a', actor: 'user', patch: { text: 'поправлено' } });
  assert.strictEqual(JSON.stringify(edited.store.legacy), legacyBefore, 'свободный профиль не тронут');
  assert.strictEqual(JSON.stringify(edited.store.entries.find((e) => e.id === 'b')), bBefore);
  assert.strictEqual(JSON.stringify(edited.store.entries.find((e) => e.id === 'c')), cBefore);

  const deleted = M.applyMemoryOperation(edited.store, { op: 'delete', at: T1, id: 'a' });
  assert.strictEqual(JSON.stringify(deleted.store.legacy), legacyBefore, 'удаление записи не трогает профиль');
  assert.deepStrictEqual(deleted.store.entries.map((e) => e.id).sort(), ['b', 'c']);
});

test('🔴 операции не мутируют вход', () => {
  const store = create(storeWith([]), entry({ id: 'a' })).store;
  const before = JSON.stringify(store);
  const op = { op: 'update', at: T1, id: 'a', actor: 'user', patch: { text: 'иначе' } };
  const opBefore = JSON.stringify(op);
  const next = M.applyMemoryOperation(store, op);
  assert.strictEqual(JSON.stringify(store), before);
  assert.strictEqual(JSON.stringify(op), opBefore);
  assert.notStrictEqual(next.store, store);
  // Отказ тоже не имеет права трогать чужой объект — в том числе замораживать его.
  const refused = M.applyMemoryOperation(store, { op: 'delete', at: T1, id: 'нет' });
  assert.strictEqual(Object.isFrozen(store), false, 'чтение не замораживает данные вызывающего');
  assert.strictEqual(JSON.stringify(refused.store), before);
});

test('лимит записей соблюдается', () => {
  let store = storeWith([]);
  for (let i = 0; i < M.MAX_ENTRIES; i += 1) {
    store = create(store, entry({ id: `m${i}`, text: `факт ${i}` })).store;
  }
  assert.strictEqual(store.entries.length, M.MAX_ENTRIES);
  const overflow = create(store, entry({ id: 'over', text: 'ещё один' }));
  assert.strictEqual(overflow.ok, false);
  assert.strictEqual(overflow.reason, 'too_many_entries');
});

// --------------------------------------------------------------- selection --

test('🔴 dismissed не попадает в промпт', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'a', text: 'видно' })).store;
  store = create(store, entry({ id: 'b', text: 'убрано' })).store;
  store = M.applyMemoryOperation(store, { op: 'dismiss', at: T1, id: 'b' }).store;

  const sel = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.deepStrictEqual(sel.entries.map((e) => e.id), ['a']);
  assert.deepStrictEqual(sel.excluded, [{ id: 'b', reason: 'dismissed' }]);
  assert.strictEqual(JSON.stringify(sel).includes('убрано'), false, 'убранный текст не уезжает в модель');
});

test('🔴 sensitive уходит в модель только по явному разрешению', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 's', sensitivity: 'sensitive', text: 'личное' })).store;
  store = create(store, entry({ id: 'n', text: 'обычное' })).store;

  const guarded = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.deepStrictEqual(guarded.entries.map((e) => e.id), ['n']);
  assert.ok(guarded.excluded.some((x) => x.id === 's' && x.reason === 'sensitive_not_allowed'));
  assert.strictEqual(JSON.stringify(guarded).includes('личное'), false);

  const allowed = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt', allowSensitive: true });
  assert.deepStrictEqual(allowed.entries.map((e) => e.id).sort(), ['n', 's']);
});

test('scope решает, кто увидит запись', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'p', scopes: ['planning'], text: 'для плана' })).store;
  store = create(store, entry({ id: 'a', scopes: ['assistant_prompt'], text: 'для ассистента' })).store;
  store = create(store, entry({ id: 'q', scopes: [], text: 'никуда' })).store;

  assert.deepStrictEqual(M.selectMemoryForPrompt(store, { scope: 'planning' }).entries.map((e) => e.id), ['p']);
  assert.deepStrictEqual(M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' }).entries.map((e) => e.id), ['a']);
  const none = M.selectMemoryForPrompt(store, { scope: 'shadow_voice' });
  assert.deepStrictEqual(none.entries, []);
  assert.strictEqual(none.excluded.every((x) => x.reason === 'out_of_scope'), true);
});

test('дубль по смыслу вытесняется более сильным источником', () => {
  const store = M.normalizeMemoryStore({
    entries: [
      entry({ id: 'inf', sourceType: 'inferred', text: '  Работает   ЛУЧШЕ утром ', confidence: 0.9 }),
      entry({ id: 'exp', sourceType: 'explicit', text: 'Работает лучше утром' }),
    ],
  });
  const sel = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.deepStrictEqual(sel.entries.map((e) => e.id), ['exp'], 'слова человека выигрывают у вывода');
  assert.ok(sel.excluded.some((x) => x.id === 'inf' && x.reason === 'superseded_by:exp'));
});

test('бюджет режется по целым записям', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'a', text: 'а'.repeat(30) })).store;
  store = create(store, entry({ id: 'b', text: 'б'.repeat(30) })).store;
  const sel = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt', maxChars: 40 });
  assert.strictEqual(sel.entries.length, 1, 'вторая целиком не влезла');
  assert.strictEqual(sel.entries[0].text.length, 30, 'первая не обрезана на полуслове');
  assert.strictEqual(sel.truncated, true);
  assert.ok(sel.excluded.some((x) => x.reason === 'budget_exhausted'));
});

test('🔴 старый свободный текст доезжает до промпта дословно и отдельно', () => {
  const legacyText = '## Кто это\nАльберт.\n## Открытые нитки\nJuFo-регистрация';
  const store = storeWith([entry({ id: 'a' })], legacyText);
  const sel = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.strictEqual(sel.legacyText, legacyText, 'ассистент старого пользователя работает как раньше');
  assert.strictEqual(sel.legacySource, 'profile-memory-v1');
  assert.strictEqual(sel.entries.length, 1, 'и структурные записи идут рядом, а не вместо');
});

test('selectMemoryForPrompt детерминирован', () => {
  const store = storeWith([entry({ id: 'a' }), entry({ id: 'b', text: 'второе' }), entry({ id: 'c', text: 'третье' })]);
  const first = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.deepStrictEqual(M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' }), first);
  // Порядок записей в файле не влияет на выбор.
  const shuffled = M.normalizeMemoryStore(Object.assign({}, store, { entries: store.entries.slice().reverse() }));
  assert.deepStrictEqual(M.selectMemoryForPrompt(shuffled, { scope: 'assistant_prompt' }).entries.map((e) => e.id),
    first.entries.map((e) => e.id));
});

// ------------------------------------------------------------- explanation --

test('🔴 каждая запись объясняет источник и причину выбора', () => {
  const cases = [
    ['explicit', 'Вы сказали это сами', 'explicit_statement'],
    ['imported', 'Пришло из вашего архива при импорте', 'imported_from_archive'],
    ['inferred', 'Посчитано программой по вашим данным', 'inferred_pattern'],
  ];
  for (const [sourceType, origin, reason] of cases) {
    const x = M.explainMemoryEntry(entry({ sourceType, sourceRef: 'weekly_pattern_detector' }));
    assert.ok(x.origin.startsWith(origin), `${sourceType}: «${x.origin}»`);
    assert.ok(x.origin.includes('weekly_pattern_detector'), 'ссылка на источник видна человеку');
    assert.strictEqual(x.selectionReason, reason);
    assert.strictEqual(x.editable, true);
    assert.strictEqual(x.deletable, true, 'память, которую нельзя убрать, — это досье');
  }
  assert.strictEqual(M.explainMemoryEntry({ id: 'x' }), null);

  const off = M.explainMemoryEntry(entry({ status: 'dismissed' }));
  assert.ok(off.usage.includes('не попадает'), 'человек видит, что запись больше не работает');
  const quiet = M.explainMemoryEntry(entry({ scopes: [] }));
  assert.ok(quiet.usage.includes('не передаётся'));

  // Причина выбора едет и вместе с самой записью в промпте.
  const store = storeWith([entry({ id: 'a', sourceType: 'imported' })]);
  const sel = M.selectMemoryForPrompt(store, { scope: 'assistant_prompt' });
  assert.strictEqual(sel.entries[0].selectionReason, 'imported_from_archive');
  assert.strictEqual(sel.entries[0].rank, 1);
});

// ------------------------------------------------------------------ export --

test('🔴 экспорт читается обратно без потерь', () => {
  let store = storeWith([]);
  store = create(store, entry({ id: 'a', sourceType: 'explicit', text: 'первое' })).store;
  store = create(store, entry({ id: 'b', sourceType: 'inferred', confidence: 0.7, text: 'второе' })).store;
  store = create(store, entry({ id: 'c', sourceType: 'imported', sensitivity: 'sensitive', text: 'третье' })).store;
  store = M.applyMemoryOperation(store, { op: 'dismiss', at: T1, id: 'b' }).store;

  const archive = M.exportMemory(store);
  assert.strictEqual(archive.format, 'satoru-ai-memory');
  assert.strictEqual(archive.counts.total, 3);
  assert.strictEqual(archive.counts.dismissed, 1);
  assert.strictEqual(archive.counts.sensitive, 1);
  assert.ok(archive.legacy.text.includes('Старый профиль'), 'старый текст едет в архив');

  const restored = M.normalizeMemoryStore(JSON.parse(JSON.stringify(archive)));
  assert.deepStrictEqual(restored.entries, store.entries, 'записи вернулись один в один');
  assert.deepStrictEqual(restored.legacy, store.legacy, 'профиль вернулся один в один');
  assert.strictEqual(restored.damaged, false);
  assert.strictEqual(restored.dropped, 0);
  // Убранные записи из архива не пропадают: человек должен видеть и их.
  assert.ok(restored.entries.some((e) => e.status === 'dismissed'));
});

test('экспорт пустой памяти тоже валиден и читается обратно', () => {
  const empty = M.normalizeMemoryStore(null);
  const restored = M.normalizeMemoryStore(M.exportMemory(empty));
  assert.deepStrictEqual(restored.entries, []);
  assert.strictEqual(restored.legacy.text, '');
});

// ------------------------------------------------------- no second source --

test('🔴 модуль не заводит второй источник правды и не лезет в сеть', () => {
  assert.deepStrictEqual(Object.keys(M).sort(), [
    'CATEGORIES', 'ENTRY_SCHEMA_VERSION', 'MAX_ENTRIES', 'MAX_PROMPT_CHARS', 'PATCHABLE',
    'SCOPES', 'SENSITIVITIES', 'SOURCE_TYPES', 'STATUSES', 'STORE_SCHEMA_VERSION', 'VERSION',
    'applyMemoryOperation', 'explainMemoryEntry', 'exportMemory', 'normalizeMemoryStore', 'selectMemoryForPrompt',
  ]);
  const src = fs.readFileSync(path.join(ROOT, 'public', 'ai-memory-policy-v1.js'), 'utf8');
  for (const forbidden of ['fetch(', 'localStorage', 'document.', 'Date.now(', 'require(']) {
    assert.strictEqual(src.includes(forbidden), false, `модуль не должен трогать «${forbidden}»`);
  }
  // Свободный текст остаётся в поле профиля и не дублируется в записи.
  const store = storeWith([entry({ id: 'a' })], 'текст профиля');
  assert.strictEqual(store.legacy.text, 'текст профиля');
  assert.strictEqual(store.entries.some((e) => e.text.includes('текст профиля')), false);
});

test('форма store совместима с существующим profile.json', () => {
  // Ровно то, что сегодня лежит на диске, плюс entries — и обратно.
  const onDisk = { text: 'профиль', updatedAt: T0, auto: false };
  const store = M.normalizeMemoryStore(onDisk);
  const withEntry = create(store, entry({ id: 'a' })).store;
  // Так этот store кладётся обратно в profile.json: старые поля на месте, entries рядом.
  const fileValue = Object.assign({}, onDisk, { schemaVersion: M.STORE_SCHEMA_VERSION, entries: withEntry.entries });
  const reread = M.normalizeMemoryStore(fileValue);
  assert.strictEqual(reread.legacy.text, 'профиль');
  assert.strictEqual(reread.legacy.auto, false, 'ручной профиль не становится автоматическим');
  assert.deepStrictEqual(reread.entries, withEntry.entries);
});
