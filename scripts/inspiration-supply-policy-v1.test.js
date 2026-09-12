'use strict';

/* Inspiration Supply Policy v1 — качество наполнения, а не второй ranking.
 *
 * Проверяется не «функция считает», а обещания, нарушение которых делает раздел
 * вредным: «официальный» не значит «наш», удалённое медиа не становится пустой
 * карточкой, нехватка остаётся нехваткой и не добивается чем попало, а обратная
 * связь по-прежнему живёт в профиле, а не в новом хранилище вкусов.
 *
 * Фикстуры лежат отдельно — `fixtures/inspiration-supply-v1.json`, всё синтетическое.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const P = require('../public/inspiration-supply-policy-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');
const Catalog = require('../public/inspiration-catalog-v1.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public', 'inspiration-supply-policy-v1.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'inspiration-supply-v1.json'), 'utf8'));

const CTX = F.context;
const DAY = '2026-09-09';
const admitted = () => P.admit(F.candidates, CTX).items;
const clone = (value) => JSON.parse(JSON.stringify(value));

/* ── Согласованность с тем, что уже работает ────────────────────────────────── */

test('форматы и локали не разошлись с профилем и каталогом', () => {
  assert.deepEqual(P.FORMATS.slice().sort(), Profile.FORMATS.slice().sort());
  assert.deepEqual(P.LOCALES.slice().sort(), Catalog.LOCALES.slice().sort());
});

test('allowlist встраивания совпадает с фактической границей app.js', () => {
  // Расхождение означало бы, что policy допустит материал, который приложение
  // молча не покажет: iframe просто не создастся, а карточка останется пустой.
  const fn = APP.slice(APP.indexOf('function inspirationEmbedAllowed'));
  const arr = /\[((?:\s*'[^']+',?)+)\]\s*\.includes\(url\.hostname\)/.exec(fn);
  assert.ok(arr, 'не удалось найти список хостов в inspirationEmbedAllowed — проверь app.js');
  const hosts = arr[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepEqual(hosts.slice().sort(), P.PRODUCTION_EMBED_HOSTS.slice().sort());
});

test('модуль не читает часы, сеть, DOM и состояние приложения', () => {
  const body = SRC.split('function buildInspirationSupplyPolicy()')[1] || '';
  for (const re of [/Date\.now\s*\(/, /new\s+Date\s*\(/, /\bfetch\s*\(/, /\bdocument\b/, /\blocalStorage\b/, /['"`]\/api\//, /\bState\./, /Math\.random/]) {
    assert.ok(!re.test(body), `в теле модуля не должно быть ${re}`);
  }
});

test('в модуле нет ранжирования, популярности и вовлечения', () => {
  for (const name of Object.keys(P)) {
    assert.ok(!/score|rank|popular|trend|recommend|engag|viral/i.test(name), `экспорт ${name} выглядит как ранжирование`);
  }
  const rows = P.toCatalogRows(admitted(), 'ru');
  const dump = JSON.stringify(rows);
  for (const re of [/views/i, /likes/i, /"score"/i, /\bxp\b/i, /reward/i, /streak/i, /rarity/i, /trending/i]) {
    assert.ok(!re.test(dump), `в выдаче не должно быть ${re}`);
  }
});

/* ── Права ──────────────────────────────────────────────────────────────────── */

test('«официальный источник» никогда не даёт права положить файл к себе', () => {
  for (const c of admitted()) {
    if (c.rights.kind === 'official-source') {
      assert.equal(P.selfHostAllowed(c), false, `${c.id}: official-source не самохостится`);
      assert.equal(c.rights.downloadAllowed, false, c.id);
    }
  }
  // И это не вопрос аккуратности данных: объявить одновременно нельзя.
  const bad = clone(F.candidates[0]);
  bad.rights.kind = 'official-source';
  bad.rights.downloadAllowed = true;
  const res = P.admit([bad], CTX);
  assert.equal(res.items.length, 0);
  assert.equal(res.rejected[0].code, P.REJECT.RIGHTS_CONFLICT);
});

test('официальный embed не может произвести план локального хранения', () => {
  const embeds = admitted().filter((c) => c.tier === 'official-embed');
  assert.ok(embeds.length >= 5, 'в фикстурах должен быть заметный слой embed');
  for (const c of embeds) {
    assert.equal(P.selfHostAllowed(c), false, `${c.id}: embed не превращается в локальный файл`);
    assert.equal(c.assetPath, undefined, `${c.id}: у embed нет пути к файлу`);
  }
});

test('уровень поставки выводится, а не объявляется поставщиком', () => {
  const lying = clone(F.candidates[0]);
  lying.tier = 'licensed-local';
  const c = P.admit([lying], CTX).items[0];
  assert.equal(c.tier, 'official-embed', 'заявленный tier игнорируется');
  assert.equal(P.selfHostAllowed(c), false);
});

test('право хранить есть только у своего, public domain и явных лицензий', () => {
  assert.ok(!P.SELF_HOSTABLE_RIGHTS.includes('official-source'));
  for (const kind of P.SELF_HOSTABLE_RIGHTS) assert.ok(P.RIGHTS_KINDS.includes(kind));
});

/* ── Свежесть и доступность ─────────────────────────────────────────────────── */

test('граница свежести проходит ровно там, где объявлена', () => {
  const base = clone(F.candidates[0]);              // official-embed, 30 дней
  base.lastCheckedAt = '2026-08-10T09:00:00.000Z';  // ровно 30 дней до now
  assert.equal(P.admit([base], CTX).items.length, 1, '30 дней — ещё допустимо');
  base.lastCheckedAt = '2026-08-09T08:59:00.000Z';  // чуть больше 30
  const late = P.admit([base], CTX);
  assert.equal(late.items.length, 0);
  assert.equal(late.rejected[0].code, P.REJECT.STALE);
});

test('своё не протухает за месяц, чужое протухает', () => {
  const own = clone(F.candidates.find((c) => c.id === 'sat-forge-plate'));
  own.lastCheckedAt = '2026-05-01T08:00:00.000Z';   // 131 день
  assert.equal(P.admit([own], CTX).items.length, 1);
  const foreign = clone(F.candidates[0]);
  foreign.lastCheckedAt = '2026-05-01T08:00:00.000Z';
  assert.equal(P.admit([foreign], CTX).items.length, 0);
});

test('проверка из будущего — это неисправность поставщика, а не свежесть', () => {
  const c = clone(F.candidates[0]);
  c.lastCheckedAt = '2026-09-20T09:00:00.000Z';
  const res = P.admit([c], CTX);
  assert.equal(res.items.length, 0);
  assert.equal(res.rejected[0].code, P.REJECT.CHECKED_AT);
});

test('«не знаю, жив ли» допустимо только для того, что лежит у нас', () => {
  const own = clone(F.candidates.find((c) => c.id === 'sat-forge-plate'));
  own.available = 'unknown';
  assert.equal(P.admit([own], CTX).items.length, 1, 'свой файл либо есть, либо нет');
  const foreign = clone(F.candidates[0]);
  foreign.available = 'unknown';
  assert.equal(P.admit([foreign], CTX).rejected[0].code, P.REJECT.AVAILABILITY_UNKNOWN);
});

/* ── Дедуп и детерминизм ────────────────────────────────────────────────────── */

test('один материал из двух поставок остаётся одним, побеждает надёжная', () => {
  const res = P.admit(F.duplicates.candidates, CTX);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].id, F.duplicates.expectWinner);
  const dup = res.rejected.find((r) => r.code === P.REJECT.DUPLICATE);
  assert.ok(dup, 'проигравший обязан быть назван дублем, а не исчезнуть молча');
  assert.equal(dup.id, F.duplicates.expectRejected);
});

test('порядок входа не меняет результат', () => {
  const straight = P.admit(F.candidates, CTX);
  const shuffled = P.admit(F.candidates.slice().reverse(), CTX);
  assert.deepEqual(shuffled.items.map((c) => c.id), straight.items.map((c) => c.id));
  const ids = straight.items.map((c) => c.id);
  assert.deepEqual(ids, ids.slice().sort(), 'порядок стабилен по id, а не по «качеству»');
});

test('повторный допуск даёт тот же результат', () => {
  assert.deepEqual(P.admit(F.candidates, CTX), P.admit(F.candidates, CTX));
});

test('без времени или с мусорным временем допуск не выполняется', () => {
  assert.equal(P.admit(F.candidates, Object.assign({}, CTX, { now: 'сегодня' })).error, P.ERRORS.TIME);
  assert.equal(P.admit(F.candidates, Object.assign({}, CTX, { now: '2026-02-30T09:00:00.000Z' })).error, P.ERRORS.TIME);
  assert.equal(P.admit('не массив', CTX).error, P.ERRORS.CONTEXT);
});

/* ── Частота, повторы и обратная связь ──────────────────────────────────────── */

test('один источник не занимает больше объявленной доли', () => {
  const many = [];
  for (let i = 0; i < 8; i += 1) {
    const c = clone(F.candidates[0]);
    c.id = `mono-${i}`; c.externalId = `mono-${i}`;
    many.push(c);
  }
  for (let i = 0; i < 2; i += 1) {
    const c = clone(F.candidates.find((x) => x.id === 'ps-valley-morning'));
    c.id = `other-${i}`; c.externalId = `other-${i}`;
    many.push(c);
  }
  const items = P.admit(many, CTX).items;
  assert.equal(items.length, 10);
  const res = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], ctx: CTX });
  const overflow = res.blocked.filter((b) => b.code === P.BLOCK.SOURCE_SHARE);
  assert.equal(res.pool.length, 7, 'предел = floor(10 * 0.5) на источник + второй источник');
  assert.equal(overflow.length, 3);
  assert.ok(overflow.every((b) => b.detail === 'openfilm'));
});

test('уже показанное не возвращается внутри cooldown и возвращается после', () => {
  const items = admitted();
  const recent = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], shown: [{ id: 'pd-run-58', day: '2026-08-30' }], ctx: CTX });
  assert.ok(recent.blocked.some((b) => b.id === 'pd-run-58' && b.code === P.BLOCK.REPEAT));
  const old = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], shown: [{ id: 'pd-run-58', day: '2026-06-01' }], ctx: CTX });
  assert.ok(old.pool.some((c) => c.id === 'pd-run-58'));
});

test('«не моё» скрывает материал, но модуль не заводит своего хранилища вкусов', () => {
  const res = P.eligibleToday(admitted(), { day: DAY, locales: ['ru', 'en'], hiddenIds: ['of-light-study'], ctx: CTX });
  assert.ok(res.blocked.some((b) => b.id === 'of-light-study' && b.code === P.BLOCK.HIDDEN));
  assert.ok(!res.pool.some((c) => c.id === 'of-light-study'));
  // Скрытые id приходят снаружи — из существующего профиля. Своей записи нет.
  for (const name of Object.keys(P)) {
    assert.ok(!/record|save|store|persist|feedback/i.test(name), `экспорт ${name} выглядит как запись вкусов`);
  }
});

test('материал со словами на чужом языке не предлагается, без слов — предлагается', () => {
  const res = P.eligibleToday(admitted(), { day: DAY, locales: ['de'], ctx: CTX });
  assert.ok(res.blocked.some((b) => b.id === 'sat-draft-out' && b.code === P.BLOCK.LANGUAGE));
  assert.ok(res.pool.some((c) => c.id === 'of-light-study'), 'материал без слов подходит любому языку');
  assert.ok(res.pool.every((c) => c.lang === 'none'));
});

/* ── Нехватка вместо подмены ────────────────────────────────────────────────── */

test('подмена запрещена явным флагом и на деле', () => {
  const items = admitted();
  const pool = P.eligibleToday(items, { day: DAY, locales: ['ru'], ctx: CTX }).pool;
  const report = P.shortageReport(pool, { interests: ['philosophy', 'reading', 'study', 'focus'], formats: ['quote', 'image'], ctx: CTX });
  assert.equal(report.fillerAllowed, false);
  assert.equal(report.status, 'shortage');
  assert.ok(report.deliverable < report.requested, 'подборка обязана стать короче');
  const wanted = new Set(['philosophy', 'reading', 'study', 'focus']);
  for (const id of report.matchingIds) {
    const row = items.find((c) => c.id === id);
    assert.ok(row.interestIds.some((i) => wanted.has(i)), `${id} попал в выдачу без совпадения интереса`);
    assert.ok(['quote', 'image'].includes(row.format), `${id} попал в выдачу вне выбранных форматов`);
  }
});

test('пустой запас даёт честный ноль, а не случайную карточку', () => {
  const report = P.shortageReport([], { interests: ['anime'], ctx: CTX });
  assert.equal(report.status, 'empty');
  assert.equal(report.available, 0);
  assert.equal(report.deliverable, 0);
  assert.deepEqual(report.matchingIds, []);
  assert.deepEqual(report.missingInterests, ['anime']);
});

test('матрица покрытия различает «минимум набран», «мало» и «нет вообще»', () => {
  // Статус называется `minimal`, а не `covered`, намеренно: два материала — это нижняя
  // граница пригодности, после которой можно показывать, а НЕ «интерес закрыт».
  const cov = P.coverage(admitted(), { interests: ['nature', 'running', 'minecraft'], ctx: CTX });
  assert.equal(cov.byInterest.nature.status, 'minimal');
  assert.equal(cov.byInterest.running.status, 'thin');
  assert.equal(cov.byInterest.minecraft.status, 'missing');
  assert.deepEqual(cov.missing, ['minecraft']);
  assert.deepEqual(cov.thin, ['running']);
  assert.ok(!('covered' in cov), 'слова «закрыто» в отчёте быть не должно');
  assert.equal(cov.byInterest.running.byFormat.edit, 1);
});


test('свой материал не протухает, а чужой — протухает и требует доказанного воспроизведения', () => {
  const own = clone(F.candidates.find((c) => c.id === 'sat-forge-plate'));
  own.lastCheckedAt = '2019-01-01T08:00:00.000Z';       // семь лет назад
  assert.equal(P.admit([own], CTX).items.length, 1, 'файл лежит у нас — год ничего не меняет');

  const foreign = clone(F.candidates[0]);
  foreign.lastCheckedAt = '2019-01-01T08:00:00.000Z';
  assert.equal(P.admit([foreign], CTX).rejected[0].code, P.REJECT.STALE);
});

test('успешный HEAD не считается доказательством, что плеер работает', () => {
  const c = clone(F.candidates[0]);
  c.checkMethod = 'head';
  assert.equal(P.admit([c], CTX).rejected[0].code, P.REJECT.PLAYBACK_UNVERIFIED);
  for (const proof of P.PLAYBACK_PROOFS) {
    c.checkMethod = proof;
    assert.equal(P.admit([c], CTX).items.length, 1, `${proof} — достаточное доказательство`);
  }
  // Для своего материала способ проверки не важен: он не воспроизводится через чужой плеер.
  const own = clone(F.candidates.find((x) => x.id === 'sat-forge-plate'));
  own.checkMethod = 'head';
  assert.equal(P.admit([own], CTX).items.length, 1);
});

test('таймаут отличается от удаления — иначе оператор выбросит живую запись', () => {
  const base = clone(F.candidates[0]);
  const cases = [
    ['removed', P.REJECT.UNAVAILABLE],
    ['embed_denied', P.REJECT.UNAVAILABLE],
    ['temporary_error', P.REJECT.AVAILABILITY_UNKNOWN],
    ['not_checked', P.REJECT.AVAILABILITY_UNKNOWN],
  ];
  for (const [reason, code] of cases) {
    const c = Object.assign({}, base, { available: false, availabilityReason: reason });
    const res = P.admit([c], CTX);
    assert.equal(res.items.length, 0);
    assert.equal(res.rejected[0].code, code, reason);
    assert.equal(res.rejected[0].detail, reason);
  }
});

test('явно попрошенное человеком не блокируется кулдауном повторов', () => {
  const items = admitted();
  const shown = [{ id: 'pd-run-58', day: '2026-08-30' }];
  const blockedRun = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], shown, ctx: CTX });
  assert.ok(blockedRun.blocked.some((b) => b.id === 'pd-run-58' && b.code === P.BLOCK.REPEAT));

  const asked = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], shown, requestedIds: ['pd-run-58'], ctx: CTX });
  assert.ok(asked.pool.some((c) => c.id === 'pd-run-58'), '«хочу пересмотреть» — решение человека, а не ошибка');
  assert.ok(!asked.blocked.some((b) => b.id === 'pd-run-58'));

  // Но «не моё» просьбой не отменяется: это разные вещи.
  const hidden = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], hiddenIds: ['pd-run-58'], requestedIds: ['pd-run-58'], ctx: CTX });
  assert.ok(hidden.blocked.some((b) => b.id === 'pd-run-58' && b.code === P.BLOCK.HIDDEN));
});

test('квота на источник не отменяет конкретную просьбу человека', () => {
  // Ограничение разнообразия придумано для автоматической подборки. Применять его к
  // «покажи вот это» — значит отказать человеку в его же выборе ради красивой статистики.
  const many = [];
  for (let i = 0; i < 8; i += 1) {
    const c = clone(F.candidates[0]);
    c.id = `mono-${i}`; c.externalId = `mono-${i}`;
    many.push(c);
  }
  for (let i = 0; i < 2; i += 1) {
    const c = clone(F.candidates.find((x) => x.id === 'ps-valley-morning'));
    c.id = `other-${i}`; c.externalId = `other-${i}`;
    many.push(c);
  }
  const items = P.admit(many, CTX).items;

  const auto = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], ctx: CTX });
  const dropped = auto.blocked.filter((b) => b.code === P.BLOCK.SOURCE_SHARE).map((b) => b.id);
  assert.ok(dropped.length >= 1, 'без просьбы квота работает');

  const asked = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], requestedIds: [dropped[0]], ctx: CTX });
  assert.ok(asked.pool.some((c) => c.id === dropped[0]), `${dropped[0]} попросили — он обязан быть в пуле`);
  assert.ok(!asked.blocked.some((b) => b.id === dropped[0]));
  // Просьба не расширяет квоту для остальных: она выводит из-под неё только себя.
  assert.equal(asked.blocked.filter((b) => b.code === P.BLOCK.SOURCE_SHARE).length, dropped.length - 1);
});

/* ── Шов с существующим выбором подборки ────────────────────────────────────── */

test('строки допуска принимает существующий InspirationProfileV1, и подборка конечна', () => {
  const items = admitted();
  const pool = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], ctx: CTX }).pool;
  const rows = P.toCatalogRows(pool, 'ru');
  const profile = Profile.configure({
    interests: [{ id: 'animation', label: 'Анимация' }, { id: 'nature', label: 'Природа' }, { id: 'space', label: 'Космос' }],
    formats: Profile.FORMATS.slice(),
  });
  const chosen = Profile.choose(rows, profile, DAY);
  assert.ok(chosen.length > 0 && chosen.length <= Profile.DIGEST_SIZE, `подборка ${chosen.length} вне 1..3`);
  const poolIds = new Set(pool.map((c) => c.id));
  for (const row of chosen) assert.ok(poolIds.has(row.id), `${row.id} пришёл не из допущенного пула`);
  // Тот же день — та же тройка: раздел не перетасовывается при перезагрузке.
  assert.deepEqual(Profile.choose(rows, profile, DAY).map((r) => r.id), chosen.map((r) => r.id));
});

test('перевод в строки каталога сохраняет права и не выдумывает медиаполитику', () => {
  const rows = P.toCatalogRows(admitted(), 'ru');
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.get('of-light-study').mediaPolicy, 'iframe');
  assert.equal(byId.get('ob-sun-hum').mediaPolicy, 'link');
  assert.equal(byId.get('sat-next-decision').mediaPolicy, 'text');
  assert.equal(byId.get('sat-forge-plate').mediaPolicy, 'local');
  assert.equal(byId.get('of-light-study').durationLabel, '7:44');
  assert.equal(byId.get('sat-next-decision').durationLabel, '');
  for (const row of rows) {
    if (row.rightsKind !== 'satoru-original') {
      assert.ok(row.attribution, `${row.id}: чужой материал без указания правообладателя`);
      assert.ok(row.rightsUrl, `${row.id}: чужой материал без ссылки на права`);
    }
  }
});

/* ── Что придётся мигрировать в существующем каталоге ───────────────────────── */

test('11 строк мигрированы: свои тексты полны, внешние не получают вымышленную проверку', () => {
  const missingByRow = Catalog.CATALOG.map((row) => P.fromCatalogV1Row(row));
  assert.equal(missingByRow.length, 11, 'стартовых материалов по-прежнему одиннадцать');
  for (let i = 0; i < missingByRow.length; i += 1) {
    const res = missingByRow[i];
    if (Catalog.CATALOG[i].rightsKind === 'satoru-original') {
      assert.equal(res.ok, true, Catalog.CATALOG[i].id);
      assert.equal(res.draft.delivery.policy, 'text');
      assert.equal(res.draft.available, true);
      assert.equal(res.draft.checkMethod, 'manual');
    } else {
      assert.equal(res.ok, false, Catalog.CATALOG[i].id);
      assert.ok(res.missing.includes('lastCheckedAt'));
      assert.equal(res.draft.available, 'unknown');
      assert.equal(res.draft.availabilityReason, 'not_checked');
    }
  }
  // Длительность выводится там, где она подписана, и отсутствует там, где нет.
  const spring = P.fromCatalogV1Row(Catalog.CATALOG.find((r) => r.id === 'blender-spring'));
  assert.equal(spring.draft.durationSec, 464);
  const bunny = P.fromCatalogV1Row(Catalog.CATALOG.find((r) => r.id === 'blender-bunny'));
  assert.ok(bunny.missing.includes('durationSec'), 'у видео без подписи длительность неизвестна');
});

/* ── Фикстуры и прогон всех случаев ─────────────────────────────────────────── */

test('фикстуры честно помечены синтетическими и не выдают себя за проверенные', () => {
  assert.equal(F.synthetic, true);
  assert.equal(F.verified, false);
  const dump = JSON.stringify(F.candidates) + JSON.stringify(F.rejections) + JSON.stringify(F.duplicates);
  for (const url of dump.match(/https?:\/\/[^"\\ ]+/g) || []) {
    assert.match(new URL(url).hostname, /\.invalid$/, `${url} выглядит как настоящий адрес`);
  }
  assert.ok(!/(youtube|tiktok|instagram|twitch|netflix|nasa|blender)/i.test(dump), 'настоящие площадки в фикстурах не упоминаются');
  for (const c of F.candidates) {
    assert.equal(c.synthetic, true, `${c.id}: кандидат не помечен синтетическим`);
    assert.equal(c.verified, false, `${c.id}: кандидат не помечен непроверенным`);
  }
});

test('все 20 кандидатов фикстуры проходят допуск', () => {
  const res = P.admit(F.candidates, CTX);
  assert.equal(res.ok, true);
  assert.deepEqual(res.rejected, [], 'ни один валидный кандидат не должен отваливаться');
  assert.equal(res.items.length, F.candidates.length);
  assert.ok(Object.keys(res.stats.byTier).length === 3, 'в запасе должны быть все три уровня поставки');
});

for (const row of F.rejections) {
  test(`отказ: ${row.candidate.id} — ${row.why.slice(0, 80)}`, () => {
    const res = P.admit([row.candidate], CTX);
    assert.equal(res.items.length, 0, 'кандидат не должен быть допущен');
    assert.equal(res.rejected.length, 1);
    assert.equal(res.rejected[0].code, row.expect);
  });
}

for (const profile of F.profiles) {
  test(`профиль: ${profile.id} — ${profile.why.slice(0, 80)}`, () => {
    const items = admitted();
    const el = P.eligibleToday(items, { day: DAY, locales: profile.locales, ctx: CTX });
    assert.equal(el.ok, true);
    const report = P.shortageReport(el.pool, { interests: profile.interests, formats: profile.formats, ctx: CTX });
    const e = profile.expect;

    assert.equal(report.status, e.status);
    assert.equal(report.available, e.available);
    assert.equal(report.deliverable, e.deliverable);
    assert.ok(report.deliverable <= report.requested);
    assert.equal(report.fillerAllowed, false);
    if (e.distinctFormats !== undefined) assert.equal(report.distinctFormats, e.distinctFormats);
    if (e.matchingIds) assert.deepEqual(report.matchingIds, e.matchingIds);
    if (e.thinInterests) assert.deepEqual(report.thinInterests.slice().sort(), e.thinInterests.slice().sort());
    if (e.missingInterests) assert.deepEqual(report.missingInterests.slice().sort(), e.missingInterests.slice().sort());
    if (e.blockedCodes) {
      const codes = [...new Set(el.blocked.map((b) => b.code))].sort();
      assert.deepEqual(codes, e.blockedCodes.slice().sort());
    }
    // Ни один материал в выдаче не может быть вне заявленных интересов.
    const wanted = new Set(profile.interests);
    for (const id of report.matchingIds) {
      const c = items.find((x) => x.id === id);
      assert.ok(c.interestIds.some((i) => wanted.has(i)), `${id}: filler вместо совпадения`);
    }
  });
}

test('нехватка «нет на твоём языке» отличима от «нет вообще»', () => {
  // Разные сообщения человеку: материал существует, но недоступен — это не то же
  // самое, что материала нет ни на одном языке. Отчёт обязан их различать.
  const items = admitted();
  const de = P.eligibleToday(items, { day: DAY, locales: ['de'], ctx: CTX });
  const niche = P.eligibleToday(items, { day: DAY, locales: ['ru', 'en'], ctx: CTX });
  const deReport = P.shortageReport(de.pool, { interests: ['business', 'product'], ctx: CTX });
  const nicheReport = P.shortageReport(niche.pool, { interests: ['anime', 'superhero'], ctx: CTX });
  assert.equal(deReport.status, 'empty');
  assert.equal(nicheReport.status, 'empty');
  assert.ok(de.blocked.some((b) => b.code === P.BLOCK.LANGUAGE), 'языковая причина обязана быть видна');
  assert.ok(!niche.blocked.some((b) => b.code === P.BLOCK.LANGUAGE));
  // Доказательство, что материал действительно существует — просто не на этом языке.
  assert.ok(items.some((c) => c.interestIds.includes('business')));
});
