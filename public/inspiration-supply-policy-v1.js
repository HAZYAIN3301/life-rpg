/* Satoru Inspiration Supply Policy v1 — чем наполнять «Вдохновение».
 *
 * Что это и чего тут нет. `InspirationProfileV1.choose()` уже умеет выбрать три
 * карточки на день из каталога. Проблема не в выборе, а в том, что выбирать не из
 * чего: каталог — одиннадцать строк. Этот модуль отвечает на другой вопрос —
 * **что вообще имеет право попасть в каталог** и **что честно сказать, когда
 * подходящего материала нет**.
 *
 * Поэтому здесь намеренно НЕТ ранжирования. Ни одной функции «лучше/хуже», ни
 * популярности, ни просмотров, ни рекомендаций. Второй ranking поверх одиннадцати
 * строк был бы ровно тем, чего просили не делать. Порядок на выходе стабильный по id.
 *
 * Разделение труда:
 *
 *   кандидаты источника (много, внешние, непроверенные)
 *            ↓  admit()          — схема, права, свежесть, доступность, дедуп
 *   допустимый каталог
 *            ↓  eligibleToday()  — повторы и частота источника
 *   конечный пул на день
 *            ↓  InspirationProfileV1.choose()   ← существует, не трогается
 *   подборка ≤3
 *            ↓  shortageReport() — если пула не хватило, честный дефицит,
 *                                  а не нерелевантный filler
 *
 * ⚠️ Правила, без которых наполнение становится вредным:
 *
 *  — **`official` не разрешает копировать файл.** Официальный embed — это право
 *    показать через источник, а не право положить его файл себе на сервер.
 *    Кандидат, объявляющий и то и другое, отвергается как конфликт прав.
 *  — **Массовой выкачки TikTok/YouTube нет и не будет.** Tier `official-embed`
 *    физически не может произвести план локального хранения.
 *  — **Удалённое медиа не превращается в пустую карточку.** Недоступный или
 *    непроверенный давно материал не допускается, а не показывается с кнопкой
 *    «смотреть», которая ведёт в 404.
 *  — **Нехватка — это отчёт, а не подмена.** Если по интересам человека материала
 *    мало, модуль возвращает меньше и называет дефицит. Добивать пачку тем, что
 *    просто оказалось под рукой, запрещено.
 *  — **Конечная пачка.** Ни endless, ни auto-next, ни XP за просмотр, ни счётчиков.
 *    В выдаче нет ни одного поля, из которого их можно было бы собрать.
 *  — **Обратная связь остаётся в текущем профиле.** Модуль её только читает как
 *    список скрытых id и не заводит своего хранилища вкусов.
 *
 * Чистый модуль: время приходит параметром, ни DOM, ни сети, ни случайности.
 */
(function exposeInspirationSupplyPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationSupplyPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildInspirationSupplyPolicy() {
  'use strict';

  const VERSION = '1.0.0';

  // Совпадает с `InspirationProfileV1.FORMATS`. Расхождение ловит тест.
  const FORMATS = Object.freeze(['edit', 'video', 'image', 'quote', 'podcast']);
  const LOCALES = Object.freeze(['ru', 'en', 'de', 'uk', 'es']);
  // `none` — материал без слов: инструментальная музыка, немой ролик, фотография.
  // Это не «неизвестно», а осознанное свойство: такой материал подходит любому языку.
  const LANGS = Object.freeze(['ru', 'en', 'de', 'uk', 'es', 'ja', 'none']);

  /* Три уровня поставки. Разница между ними — не техническая, а правовая.
   *  licensed-local  — можно положить файл к себе: своё, public domain, явная лицензия.
   *  official-embed  — можно показать через официальный проигрыватель источника.
   *                    Копировать файл НЕЛЬЗЯ, даже если технически получится.
   *  link-only       — можно только дать ссылку; открытие идёт через attention boundary. */
  const TIERS = Object.freeze(['licensed-local', 'official-embed', 'link-only']);
  // Надёжность поставки, а НЕ качество материала. Используется только в дедупе:
  // из двух одинаковых записей остаётся та, которая переживёт исчезновение чужого
  // сервера. Ранжирования содержимого в модуле нет и быть не должно.
  const TIER_RELIABILITY = Object.freeze({ 'licensed-local': 3, 'official-embed': 2, 'link-only': 1 });

  const RIGHTS_KINDS = Object.freeze([
    'satoru-original', 'public-domain', 'cc0', 'cc-by-3.0', 'cc-by-4.0', 'cc-by-sa-4.0',
    'licensed-direct', 'official-source',
  ]);
  // Права, при которых файл в принципе можно хранить у себя. `official-source`
  // здесь отсутствует намеренно: «официальный» не значит «наш».
  const SELF_HOSTABLE_RIGHTS = Object.freeze(['satoru-original', 'public-domain', 'cc0', 'cc-by-3.0', 'cc-by-4.0', 'cc-by-sa-4.0', 'licensed-direct']);

  // `text` — материал, содержимое которого и есть строка каталога (цитата). Такая
  // политика уже существует в рантайме (`mediaPolicy: 'text'` в app.js), поэтому
  // схема обязана её знать: иначе собственные цитаты не пройдут собственный допуск.
  const DELIVERY = Object.freeze(['local', 'embed', 'link', 'text']);

  /* Чем именно подтверждена живость материала. Различие не формальное: успешный HEAD
   * доказывает, что сервер ответил, и НЕ доказывает, что плеер проигрывает. У YouTube
   * «видео недоступно» и «встраивание запрещено» — разные ошибки, и обе приходят уже
   * внутри плеера. Поэтому для embed и ссылок `head` недостаточен. */
  const CHECK_METHODS = Object.freeze(['playback', 'manual', 'head']);
  const PLAYBACK_PROOFS = Object.freeze(['playback']);

  /* Почему материал недоступен. `temporary_error` — это «повторить проверку», а не
   * «удалено»: таймаут не является доказательством исчезновения. */
  const AVAILABILITY_REASONS = Object.freeze(['removed', 'embed_denied', 'temporary_error', 'not_checked']);

  /* Фактическая граница рантайма: `inspirationEmbedAllowed()` в app.js. Держится
   * здесь копией, и отдельный тест сверяет её с app.js — расхождение означает, что
   * policy допустит материал, который приложение молча не покажет. */
  const PRODUCTION_EMBED_HOSTS = Object.freeze(['www.youtube-nocookie.com', 'www.nps.gov', 'www.dvidshub.net']);
  const PRODUCTION_IMAGE_HOSTS = Object.freeze(['science.nasa.gov']);

  const REJECT = Object.freeze({
    SCHEMA: 'invalid_schema',
    FORMAT: 'unknown_format',
    LANG: 'unknown_lang',
    INTERESTS: 'no_interests',
    RIGHTS_KIND: 'unknown_rights',
    ATTRIBUTION: 'missing_attribution',
    RIGHTS_URL: 'missing_rights_url',
    RIGHTS_CONFLICT: 'rights_conflict',
    DELIVERY: 'invalid_delivery',
    EMBED_HOST: 'embed_host_not_allowed',
    IMAGE_HOST: 'image_host_not_allowed',
    AUTOPLAY: 'autoplay_in_url',
    INSECURE: 'insecure_url',
    DURATION: 'duration_out_of_range',
    CHECKED_AT: 'never_checked',
    STALE: 'stale_unverified',
    UNAVAILABLE: 'unavailable',
    AVAILABILITY_UNKNOWN: 'availability_unknown',
    DUPLICATE: 'duplicate',
    TEXT: 'missing_text',
    PLAYBACK_UNVERIFIED: 'playback_unverified',
    CHECK_METHOD: 'unknown_check_method',
  });

  const BLOCK = Object.freeze({
    REPEAT: 'repeat_cooldown',
    HIDDEN: 'hidden_by_feedback',
    SOURCE_SHARE: 'source_share_exceeded',
    LANGUAGE: 'language_mismatch',
  });

  const ERRORS = Object.freeze({ TIME: 'invalid_time', CONTEXT: 'invalid_context' });

  /* Пределы длительности по форматам. Смысл не в аккуратности, а в обещании
   * конечной пачки: материал, который нельзя закончить, ломает весь раздел. */
  const DURATION_LIMITS = Object.freeze({
    edit: Object.freeze([5, 900]),
    video: Object.freeze([5, 7200]),
    podcast: Object.freeze([30, 10800]),
    image: null,
    quote: null,
  });

  function defaultContext() {
    return {
      embedHosts: PRODUCTION_EMBED_HOSTS.slice(),
      imageHosts: PRODUCTION_IMAGE_HOSTS.slice(),
      // Своё не протухает; чужое, показываемое по ссылке или через embed, — протухает.
      maxAgeDays: { 'licensed-local': 365, 'official-embed': 30, 'link-only': 30 },
      repeatCooldownDays: 45,
      maxSharePerSource: 0.5,
      minPerInterest: 2,
      locales: LOCALES.slice(),
    };
  }

  /* ── Даты без Date ───────────────────────────────────────────────────────────
   * Та же причина, что и в остальных чистых модулях: `Date.parse` принимает
   * невозможные даты и молча их сдвигает, а системные часы делают тест недетерминированным. */
  function daysFromCivil(y, m, d) {
    const yy = y - (m <= 2 ? 1 : 0);
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
  const DAY_MS = 86400000;

  function isDay(value) {
    const m = typeof value === 'string' ? DAY_RE.exec(value) : null;
    if (!m) return false;
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2999) return false;
    return daysFromCivil(y, mo, d) >= 0 && dayIsReal(y, mo, d);
  }
  function dayIsReal(y, mo, d) {
    const len = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    return d <= len;
  }
  function dayToEpoch(day) {
    const m = DAY_RE.exec(day);
    return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3])) * DAY_MS;
  }
  function parseIso(value) {
    const m = typeof value === 'string' ? ISO_RE.exec(value) : null;
    if (!m) return null;
    const dayPart = `${m[1]}-${m[2]}-${m[3]}`;
    if (!isDay(dayPart)) return null;
    const hh = Number(m[4]); const mi = Number(m[5]); const ss = Number(m[6]);
    if (hh > 23 || mi > 59 || ss > 59) return null;
    let epoch = dayToEpoch(dayPart) + hh * 3600000 + mi * 60000 + ss * 1000 + (m[7] ? Number(m[7].padEnd(3, '0')) : 0);
    if (m[8] !== 'Z') {
      const sign = m[8][0] === '-' ? -1 : 1;
      const oh = Number(m[8].slice(1, 3)); const om = Number(m[8].slice(4, 6));
      if (oh > 23 || om > 59) return null;
      epoch -= sign * (oh * 60 + om) * 60000;
    }
    return epoch;
  }
  function daysBetween(laterMs, earlierMs) { return (laterMs - earlierMs) / DAY_MS; }

  /* ── Нормализация кандидата ──────────────────────────────────────────────────
   * Отвергает, а не чинит. Кандидат без прав, языка или проверки — это не «почти
   * годный материал», это неизвестность, которую нельзя показывать человеку. */

  const text = (value, max) => {
    const out = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return out ? out.slice(0, max) : '';
  };
  const slug = (value) => text(value, 80).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48);

  function localeMap(raw, max) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    for (const code of LOCALES) {
      const value = text(raw[code], max);
      if (value) out[code] = value;
    }
    // Русский обязателен: это язык владельца и fallback локализации в каталоге.
    return out.ru ? Object.freeze(out) : null;
  }

  function httpsUrl(value, hosts) {
    const raw = text(value, 500);
    if (!raw) return { ok: false, code: REJECT.SCHEMA };
    let url;
    try { url = new URL(raw); } catch { return { ok: false, code: REJECT.SCHEMA }; }
    if (url.protocol !== 'https:') return { ok: false, code: REJECT.INSECURE };
    if (url.searchParams.has('autoplay')) return { ok: false, code: REJECT.AUTOPLAY };
    if (hosts && hosts.indexOf(url.hostname) < 0) return { ok: false, code: null, host: url.hostname };
    return { ok: true, url: raw, host: url.hostname };
  }

  /**
   * Сырой кандидат → канонический вид или отказ с кодом.
   * @returns {{ok:true, candidate:object}|{ok:false, id:string, code:string, detail?:string}}
   */
  function normalizeCandidate(raw, ctx) {
    const c = ctx || defaultContext();
    const fail = (code, detail) => ({ ok: false, id: raw && typeof raw === 'object' ? text(raw.id, 64) : '', code, detail: detail || '' });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(REJECT.SCHEMA, 'not an object');

    const id = text(raw.id, 64);
    const source = slug(raw.source);
    const externalId = text(raw.externalId, 120);
    if (!id || !source) return fail(REJECT.SCHEMA, 'id и source обязательны');

    if (FORMATS.indexOf(raw.format) < 0) return fail(REJECT.FORMAT, String(raw.format));
    if (LANGS.indexOf(raw.lang) < 0) return fail(REJECT.LANG, String(raw.lang));

    const interestIds = [...new Set((Array.isArray(raw.interestIds) ? raw.interestIds : []).map(slug).filter(Boolean))].slice(0, 16);
    if (!interestIds.length) return fail(REJECT.INTERESTS);

    const title = localeMap(raw.title, 140);
    const body = localeMap(raw.body, 1600);
    if (!title || !body) return fail(REJECT.TEXT, 'нужны как минимум ru-заголовок и ru-описание');

    // Права
    const rights = raw.rights && typeof raw.rights === 'object' ? raw.rights : null;
    if (!rights) return fail(REJECT.RIGHTS_KIND, 'блок rights отсутствует');
    const kind = text(rights.kind, 40);
    if (RIGHTS_KINDS.indexOf(kind) < 0) return fail(REJECT.RIGHTS_KIND, kind);
    const holder = text(rights.holder, 120);
    if (kind !== 'satoru-original' && !holder) return fail(REJECT.ATTRIBUTION);
    const embedAllowed = rights.embedAllowed === true;
    const downloadAllowed = rights.downloadAllowed === true;

    // Доставка
    const delivery = raw.delivery && typeof raw.delivery === 'object' ? raw.delivery : null;
    if (!delivery || DELIVERY.indexOf(delivery.policy) < 0) return fail(REJECT.DELIVERY, delivery ? String(delivery.policy) : 'нет блока');
    const policy = delivery.policy;

    // Права на самостоятельное хранение. Главное правило пакета: «официальный»
    // источник даёт право показать, а не право скопировать.
    if (downloadAllowed && SELF_HOSTABLE_RIGHTS.indexOf(kind) < 0) {
      return fail(REJECT.RIGHTS_CONFLICT, `${kind} не разрешает хранение файла у себя`);
    }
    if (policy === 'local' && !downloadAllowed) return fail(REJECT.RIGHTS_CONFLICT, 'локальная поставка без права хранения');
    if (policy === 'embed' && !embedAllowed) return fail(REJECT.RIGHTS_CONFLICT, 'embed без права встраивания');
    if (policy === 'link' && embedAllowed) return fail(REJECT.RIGHTS_CONFLICT, 'link-only с объявленным embed — выбери одно');
    // Воспроизводить чужой текст целиком можно только на явном основании.
    if (policy === 'text' && SELF_HOSTABLE_RIGHTS.indexOf(kind) < 0) {
      return fail(REJECT.RIGHTS_CONFLICT, `${kind} не разрешает воспроизводить текст целиком`);
    }
    if (policy === 'text' && embedAllowed) return fail(REJECT.RIGHTS_CONFLICT, 'у текста нет embed');

    const out = { id, source, externalId, format: raw.format, lang: raw.lang, interestIds: Object.freeze(interestIds), title, body };
    // Translated text is readable in each complete authored locale. This must
    // never turn translated captions into a claim about an external video's audio.
    if (policy === 'text' && Array.isArray(raw.contentLocales)) {
      out.contentLocales = Object.freeze([...new Set(raw.contentLocales)]
        .filter((code) => LOCALES.includes(code) && title[code] && body[code]));
    }
    if (raw.visual) out.visual = text(raw.visual, 48);

    if (policy === 'embed') {
      const embed = httpsUrl(delivery.embedUrl, c.embedHosts);
      if (!embed.ok) return fail(embed.code || REJECT.EMBED_HOST, embed.host || '');
      out.embedUrl = embed.url;
      const src = httpsUrl(delivery.sourceUrl, null);
      if (!src.ok) return fail(src.code || REJECT.SCHEMA, 'sourceUrl');
      out.sourceUrl = src.url;
    } else if (policy === 'link') {
      const src = httpsUrl(delivery.sourceUrl, null);
      if (!src.ok) return fail(src.code || REJECT.SCHEMA, 'sourceUrl');
      out.sourceUrl = src.url;
    } else if (policy === 'local') {
      const asset = text(delivery.assetPath, 200);
      // Локальный материал живёт относительным путём внутри приложения. Абсолютный
      // URL здесь означал бы, что мы на самом деле не храним его, а тянем чужой.
      if (!asset || !/^[a-z0-9][a-z0-9/_.-]*$/i.test(asset) || asset.indexOf('..') >= 0) {
        return fail(REJECT.DELIVERY, 'assetPath должен быть относительным путём внутри приложения');
      }
      out.assetPath = asset;
      if (delivery.sourceUrl) {
        const src = httpsUrl(delivery.sourceUrl, null);
        if (!src.ok) return fail(src.code || REJECT.SCHEMA, 'sourceUrl');
        out.sourceUrl = src.url;
      }
    }

    if (raw.imageUrl) {
      const img = httpsUrl(raw.imageUrl, c.imageHosts);
      if (!img.ok) return fail(img.code || REJECT.IMAGE_HOST, img.host || '');
      out.imageUrl = img.url;
    }

    // Ссылка на права обязательна для всего, что не наше: иначе через полгода никто
    // не сможет проверить, на каком основании материал вообще показывается.
    const rightsUrl = kind === 'satoru-original' ? '' : (() => {
      const r = httpsUrl(rights.url, null);
      return r.ok ? r.url : null;
    })();
    if (rightsUrl === null) return fail(REJECT.RIGHTS_URL);

    out.rights = Object.freeze({ kind, holder, url: rightsUrl, embedAllowed, downloadAllowed });
    out.delivery = Object.freeze({ policy });

    // Длительность
    const limits = DURATION_LIMITS[raw.format];
    if (limits) {
      const seconds = Number(raw.durationSec);
      if (!Number.isInteger(seconds) || seconds < limits[0] || seconds > limits[1]) {
        return fail(REJECT.DURATION, `${raw.format}: ${raw.durationSec}`);
      }
      out.durationSec = seconds;
    } else {
      if (raw.durationSec != null) return fail(REJECT.DURATION, `${raw.format} не имеет длительности`);
      out.durationSec = null;
    }

    // Проверка живости
    const checkedAt = parseIso(raw.lastCheckedAt);
    if (checkedAt === null) return fail(REJECT.CHECKED_AT);
    out.lastCheckedAt = raw.lastCheckedAt;
    out.available = raw.available === true ? true : raw.available === false ? false : 'unknown';
    const reason = text(raw.availabilityReason, 40);
    if (reason && AVAILABILITY_REASONS.indexOf(reason) < 0) return fail(REJECT.SCHEMA, `availabilityReason: ${reason}`);
    out.availabilityReason = reason || (out.available === true ? '' : 'not_checked');

    const method = text(raw.checkMethod, 20);
    if (method && CHECK_METHODS.indexOf(method) < 0) return fail(REJECT.CHECK_METHOD, method);
    out.checkMethod = method || 'head';

    out.tier = classifyTier(out);
    if (!out.tier) return fail(REJECT.DELIVERY, 'не удалось определить уровень поставки');

    if (raw.synthetic === true) out.synthetic = true;
    if (raw.verified === false) out.verified = false;

    return { ok: true, candidate: Object.freeze(out) };
  }

  /** Уровень поставки выводится из способа доставки и прав, а не объявляется. */
  function classifyTier(candidate) {
    if (!candidate || !candidate.delivery) return null;
    if (candidate.delivery.policy === 'local' || candidate.delivery.policy === 'text') return 'licensed-local';
    if (candidate.delivery.policy === 'embed') return 'official-embed';
    if (candidate.delivery.policy === 'link') return 'link-only';
    return null;
  }

  /**
   * Можно ли положить файл этого кандидата к себе. Отдельная функция, потому что
   * это самый дорогой по последствиям вопрос во всём пакете.
   */
  function selfHostAllowed(candidate) {
    if (!candidate || !candidate.rights || !candidate.delivery) return false;
    if (candidate.delivery.policy !== 'local') return false;
    return candidate.rights.downloadAllowed === true && SELF_HOSTABLE_RIGHTS.indexOf(candidate.rights.kind) >= 0;
  }

  /** Ключ дедупликации: один и тот же материал из двух поставок — один материал. */
  function dedupeKey(candidate) {
    if (candidate.externalId) return `${candidate.source}|${candidate.externalId}`;
    const target = candidate.embedUrl || candidate.sourceUrl || candidate.assetPath || '';
    return `${candidate.source}|${slug(target) || candidate.id}`;
  }

  /* ── Допуск ──────────────────────────────────────────────────────────────────
   * `admit` НЕ ранжирует. Он отвечает «да/нет» и объясняет «нет». Порядок выхода
   * стабилен по id, чтобы каталог не перетасовывался между сборками. */
  function admit(rawCandidates, rawCtx) {
    const ctx = Object.assign(defaultContext(), rawCtx || {});
    const nowMs = parseIso(ctx.now);
    if (nowMs === null) return { ok: false, error: ERRORS.TIME };
    if (!Array.isArray(rawCandidates)) return { ok: false, error: ERRORS.CONTEXT };

    const rejected = [];
    const accepted = [];
    for (const raw of rawCandidates) {
      const res = normalizeCandidate(raw, ctx);
      if (!res.ok) { rejected.push({ id: res.id, code: res.code, detail: res.detail }); continue; }
      const c = res.candidate;

      // Доступность. `unknown` допустим только для того, что лежит у нас: там
      // «неизвестно» невозможно по построению — файл либо есть, либо нет.
      if (c.available === false) {
        // Таймаут — не доказательство удаления. Отказ в обоих случаях, но оператору
        // важно знать, повторять проверку или выбрасывать запись.
        const permanent = c.availabilityReason === 'removed' || c.availabilityReason === 'embed_denied';
        rejected.push({
          id: c.id,
          code: permanent ? REJECT.UNAVAILABLE : REJECT.AVAILABILITY_UNKNOWN,
          detail: c.availabilityReason || 'not_checked',
        });
        continue;
      }
      if (c.available === 'unknown' && c.tier !== 'licensed-local') {
        rejected.push({ id: c.id, code: REJECT.AVAILABILITY_UNKNOWN, detail: '' }); continue;
      }

      const age = daysBetween(nowMs, parseIso(c.lastCheckedAt));
      if (age < -1) { rejected.push({ id: c.id, code: REJECT.CHECKED_AT, detail: 'проверка из будущего' }); continue; }

      // Свой материал не протухает. Он лежит у нас: файл либо есть, либо нет, и через
      // год он не становится бесполезным сам по себе. Срок годности имеет смысл только
      // для чужого — там исчезнуть может источник, а не наш диск.
      if (c.tier !== 'licensed-local') {
        const maxAge = Number(ctx.maxAgeDays[c.tier]);
        if (age > maxAge) {
          rejected.push({ id: c.id, code: REJECT.STALE, detail: `${Math.round(age)}д > ${maxAge}д` });
          continue;
        }
        // Успешный HEAD говорит, что сервер ответил, а не что плеер проигрывает.
        const manualStatic = c.delivery.policy === 'link' && !DURATION_LIMITS[c.format] && c.checkMethod === 'manual';
        if (PLAYBACK_PROOFS.indexOf(c.checkMethod) < 0 && !manualStatic) {
          rejected.push({ id: c.id, code: REJECT.PLAYBACK_UNVERIFIED, detail: c.checkMethod });
          continue;
        }
      }
      accepted.push(c);
    }

    // Дедуп. Побеждает более надёжная поставка, затем более свежая проверка,
    // затем стабильный id. Это не «лучше», а «надёжнее» — популярности здесь нет.
    const byKey = new Map();
    for (const c of accepted) {
      const key = dedupeKey(c);
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, c); continue; }
      const better = TIER_RELIABILITY[c.tier] - TIER_RELIABILITY[prev.tier]
        || (parseIso(c.lastCheckedAt) - parseIso(prev.lastCheckedAt))
        || (prev.id < c.id ? -1 : 1);
      const winner = better > 0 ? c : prev;
      const loser = better > 0 ? prev : c;
      byKey.set(key, winner);
      rejected.push({ id: loser.id, code: REJECT.DUPLICATE, detail: key });
    }

    const items = [...byKey.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const bySource = {};
    const byTier = {};
    const byFormat = {};
    for (const c of items) {
      bySource[c.source] = (bySource[c.source] || 0) + 1;
      byTier[c.tier] = (byTier[c.tier] || 0) + 1;
      byFormat[c.format] = (byFormat[c.format] || 0) + 1;
    }

    return {
      ok: true,
      items: Object.freeze(items),
      rejected: Object.freeze(rejected),
      stats: Object.freeze({ total: rawCandidates.length, admitted: items.length, bySource, byTier, byFormat }),
    };
  }

  /* ── Кто уместен сегодня ─────────────────────────────────────────────────────
   * Здесь живут правила частоты. Тоже без ранжирования: только «нельзя показывать
   * сейчас» с названной причиной. */
  function eligibleToday(items, options) {
    const opts = options || {};
    const ctx = Object.assign(defaultContext(), opts.ctx || {});
    if (!isDay(opts.day)) return { ok: false, error: 'invalid_day' };
    const dayMs = dayToEpoch(opts.day);

    const hidden = new Set((Array.isArray(opts.hiddenIds) ? opts.hiddenIds : []).map(String));
    // То, что человек явно попросил показать снова.
    const requested = new Set((Array.isArray(opts.requestedIds) ? opts.requestedIds : []).map(String));
    const shownAt = new Map();
    for (const row of Array.isArray(opts.shown) ? opts.shown : []) {
      if (!row || !isDay(row.day)) continue;
      const id = String(row.id || '');
      const at = dayToEpoch(row.day);
      if (!id) continue;
      if (!shownAt.has(id) || shownAt.get(id) < at) shownAt.set(id, at);
    }
    const locales = Array.isArray(opts.locales) && opts.locales.length ? opts.locales : ctx.locales;

    const blocked = [];
    const survivors = [];
    for (const c of Array.isArray(items) ? items : []) {
      if (hidden.has(c.id)) { blocked.push({ id: c.id, code: BLOCK.HIDDEN }); continue; }
      // Явно попрошенное человеком не блокируется кулдауном повторов: при небольшом
      // каталоге запрет на 45 дней иначе опустошает подборку, а «хочу пересмотреть» —
      // это его решение, а не ошибка.
      if (shownAt.has(c.id) && !requested.has(c.id)) {
        const ago = (dayMs - shownAt.get(c.id)) / DAY_MS;
        if (ago < ctx.repeatCooldownDays) { blocked.push({ id: c.id, code: BLOCK.REPEAT, detail: `${Math.round(ago)}д` }); continue; }
      }
      // Материал со словами на языке, которого человек не читает, — это не выбор,
      // а препятствие. Материал без слов подходит всегда.
      const readable = c.delivery.policy === 'text' && c.contentLocales && c.contentLocales.some((code) => locales.includes(code));
      if (c.lang !== 'none' && locales.indexOf(c.lang) < 0 && !readable) { blocked.push({ id: c.id, code: BLOCK.LANGUAGE, detail: c.lang }); continue; }
      survivors.push(c);
    }

    // Частота источника. Смысл — не дать разделу превратиться в витрину одного
    // поставщика. Отбрасываются самые новые проверки того же источника, порядок
    // детерминированный, поэтому результат воспроизводим.
    const cap = Number(ctx.maxSharePerSource);
    const pool = [];
    const overflow = [];
    if (survivors.length && cap > 0 && cap < 1) {
      const limit = Math.max(1, Math.floor(survivors.length * cap));
      const counts = {};
      for (const c of survivors) {
        // Ограничение разнообразия уместно для автоматической подборки и неуместно для
        // конкретной просьбы человека. Попрошенное проходит мимо квоты и в неё не считается.
        if (requested.has(c.id)) { pool.push(c); continue; }
        counts[c.source] = (counts[c.source] || 0) + 1;
        if (counts[c.source] > limit) overflow.push(c); else pool.push(c);
      }
    } else {
      pool.push(...survivors);
    }
    for (const c of overflow) blocked.push({ id: c.id, code: BLOCK.SOURCE_SHARE, detail: c.source });

    return { ok: true, pool: Object.freeze(pool), blocked: Object.freeze(blocked) };
  }

  /* ── Матрица покрытия ────────────────────────────────────────────────────────
   * Отвечает на вопрос владельца «по каким интересам мне вообще есть что показать»,
   * а не «что показать сейчас». */
  function coverage(items, options) {
    const opts = options || {};
    const ctx = Object.assign(defaultContext(), opts.ctx || {});
    const interests = [...new Set((Array.isArray(opts.interests) ? opts.interests : []).map(slug).filter(Boolean))];
    const formats = (Array.isArray(opts.formats) && opts.formats.length ? opts.formats : FORMATS).filter((f) => FORMATS.indexOf(f) >= 0);
    const min = Math.max(1, Math.floor(Number(ctx.minPerInterest) || 2));

    const byInterest = {};
    for (const interest of interests) {
      const rows = (Array.isArray(items) ? items : []).filter((c) => c.interestIds.indexOf(interest) >= 0 && formats.indexOf(c.format) >= 0);
      const perFormat = {};
      for (const f of formats) perFormat[f] = rows.filter((c) => c.format === f).length;
      byInterest[interest] = {
        total: rows.length,
        byFormat: perFormat,
        status: rows.length === 0 ? 'missing' : rows.length < min ? 'thin' : 'minimal',
      };
    }
    const missing = interests.filter((i) => byInterest[i].status === 'missing');
    const thin = interests.filter((i) => byInterest[i].status === 'thin');
    return Object.freeze({
      interests, formats, minPerInterest: min, byInterest,
      missing: Object.freeze(missing), thin: Object.freeze(thin),
      // `minimal` означает «минимум набран», а НЕ «интерес закрыт». Два материала —
      // это нижняя граница пригодности, после которой можно показывать, а не потолок.
      minimal: Object.freeze(interests.filter((i) => byInterest[i].status === 'minimal')),
    });
  }

  /**
   * Честный отчёт о нехватке. Возвращает, сколько материала реально доступно под
   * интересы человека и чего не хватает — и НИКОГДА не предлагает замену.
   *
   * Это ответ на «отчёт shortage вместо нерелевантного filler»: вызывающий обязан
   * показать меньше карточек и назвать причину, а не добить пачку чем попало.
   */
  function shortageReport(pool, options) {
    const opts = options || {};
    const size = Math.max(1, Math.min(3, Math.floor(Number(opts.size) || 3)));
    const cov = coverage(pool, opts);
    const matching = (Array.isArray(pool) ? pool : []).filter((c) => {
      if (opts.formats && opts.formats.length && opts.formats.indexOf(c.format) < 0) return false;
      return c.interestIds.some((id) => cov.interests.indexOf(id) >= 0);
    });
    const distinctFormats = new Set(matching.map((c) => c.format)).size;
    const available = matching.length;
    const deliverable = Math.min(size, available);

    const status = available === 0 ? 'empty' : available < size ? 'shortage' : distinctFormats < Math.min(size, cov.formats.length) ? 'thin_formats' : 'ok';

    return Object.freeze({
      status,
      requested: size,
      available,
      deliverable,
      distinctFormats,
      // Ровно те материалы, которые вызывающий имеет право передать в
      // `InspirationProfileV1.choose`. Это не ранжирование: порядок стабилен по id.
      matchingIds: Object.freeze(matching.map((c) => c.id).sort()),
      missingInterests: cov.missing,
      thinInterests: cov.thin,
      // Явный флаг для вызывающего: подмена запрещена, даже если очень хочется.
      fillerAllowed: false,
      coverage: cov,
    });
  }

  /* ── Мост к существующему каталогу ───────────────────────────────────────────
   * Строки текущего `inspiration-catalog-v1.js` не удовлетворяют схеме: у них нет
   * языка, времени проверки и признака доступности. Этот адаптер переводит то, что
   * есть, и честно перечисляет, чего не хватает — это и есть список миграции. */
  function fromCatalogV1Row(row, options) {
    const opts = Object.assign({}, row && row.supply || {}, options || {});
    if (!row || typeof row !== 'object') return { ok: false, missing: ['row'] };
    const missing = [];
    if (!row.lang && !opts.lang) missing.push('lang');
    if (!row.lastCheckedAt && !opts.lastCheckedAt) missing.push('lastCheckedAt');
    if (row.available === undefined && opts.available === undefined) missing.push('available');
    // Свой материал сам себе внешний id; чужой выводится из адреса. В дефиците
    // остаются только те строки, где его действительно неоткуда взять.
    const externalId = opts.externalId || row.externalId
      || externalIdFromUrl(row.embedUrl || row.sourceUrl || row.imageUrl || '')
      || (row.rightsKind === 'satoru-original' ? row.id : '');
    if (!externalId) missing.push('externalId');

    const kindMap = {
      'satoru-original': 'satoru-original', 'public-domain': 'public-domain',
      'cc-by-4.0': 'cc-by-4.0', 'cc-by-3.0': 'cc-by-3.0', 'official-source': 'official-source',
    };
    const kind = kindMap[row.rightsKind] || null;
    if (!kind) missing.push(`rightsKind:${row.rightsKind}`);

    const policy = row.mediaPolicy === 'iframe' ? 'embed' : row.mediaPolicy === 'link' ? 'link'
      : row.mediaPolicy === 'remote-image' ? 'link' : row.mediaPolicy === 'local' ? 'local'
        : row.mediaPolicy === 'text' || (row.format === 'quote' && row.rightsKind === 'satoru-original') ? 'text' : null;
    if (!policy) missing.push(`mediaPolicy:${row.mediaPolicy}`);

    const seconds = opts.durationSec != null ? opts.durationSec : row.durationSec != null ? row.durationSec : durationLabelToSeconds(row.durationLabel);
    if (DURATION_LIMITS[row.format] && seconds === null) missing.push('durationSec');

    return {
      ok: missing.length === 0,
      missing: Object.freeze(missing),
      // Черновик кандидата: то, что уже выводимо из существующей строки.
      draft: Object.freeze({
        id: row.id, source: slug(row.provider || row.attribution || 'satoru'),
        externalId,
        format: row.format, lang: opts.lang || row.lang || null,
        contentLocales: opts.contentLocales || row.contentLocales,
        visual: row.visual,
        durationSec: seconds, interestIds: row.interestIds,
        title: row.title, body: row.body,
        rights: { kind, holder: row.attribution, url: row.rightsUrl, embedAllowed: opts.embedAllowed === true, downloadAllowed: kind === 'satoru-original' },
        delivery: { policy, embedUrl: row.embedUrl, sourceUrl: row.sourceUrl, assetPath: row.assetPath },
        imageUrl: row.imageUrl,
        lastCheckedAt: opts.lastCheckedAt || row.lastCheckedAt || null,
        available: row.available !== undefined ? row.available : opts.available,
        availabilityReason: opts.availabilityReason ?? row.availabilityReason ?? 'not_checked',
        checkMethod: opts.checkMethod || row.checkMethod,
      }),
    };
  }

  function durationLabelToSeconds(label) {
    const raw = text(label, 12);
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(raw);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const h = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(raw);
    if (h) return Number(h[1]) * 3600 + Number(h[2]) * 60 + Number(h[3]);
    return null;
  }
  function externalIdFromUrl(value) {
    const raw = text(value, 500);
    if (!raw) return '';
    let url;
    try { url = new URL(raw); } catch { return ''; }
    const fromQuery = url.searchParams.get('v') || url.searchParams.get('id');
    if (fromQuery) return fromQuery.slice(0, 120);
    const last = url.pathname.split('/').filter(Boolean).pop() || '';
    return last.slice(0, 120);
  }

  /**
   * Кандидаты → строки в том виде, который принимает `InspirationProfileV1.catalogRow`.
   * Единственный шов между этим пакетом и существующим выбором подборки.
   */
  function toCatalogRows(items, locale) {
    const code = LOCALES.indexOf(String(locale || 'ru')) >= 0 ? String(locale) : 'ru';
    const pick = (map) => (map && (map[code] || map.ru)) || '';
    return (Array.isArray(items) ? items : []).map((c) => Object.freeze({
      id: c.id,
      format: c.format,
      interestIds: c.interestIds,
      title: pick(c.title),
      body: pick(c.body),
      visual: c.visual || '',
      attribution: c.rights.holder || 'Satoru',
      rightsKind: c.rights.kind,
      rightsUrl: c.rights.url || '',
      provider: c.source,
      mediaPolicy: c.delivery.policy === 'embed' ? 'iframe'
        : c.delivery.policy === 'local' ? 'local'
          : c.delivery.policy === 'text' ? 'text' : c.imageUrl ? 'remote-image' : 'link',
      embedUrl: c.embedUrl || '',
      sourceUrl: c.sourceUrl || '',
      imageUrl: c.imageUrl || '',
      assetPath: c.assetPath || '',
      durationLabel: c.durationSec === null ? '' : secondsToLabel(c.durationSec),
    }));
  }
  function secondsToLabel(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  return Object.freeze({
    VERSION, FORMATS, LOCALES, LANGS, TIERS, TIER_RELIABILITY, RIGHTS_KINDS, SELF_HOSTABLE_RIGHTS,
    DELIVERY, CHECK_METHODS, PLAYBACK_PROOFS, AVAILABILITY_REASONS, DURATION_LIMITS, REJECT, BLOCK, ERRORS,
    PRODUCTION_EMBED_HOSTS, PRODUCTION_IMAGE_HOSTS,
    defaultContext, isDay, parseIso,
    normalizeCandidate, classifyTier, selfHostAllowed, dedupeKey,
    admit, eligibleToday, coverage, shortageReport,
    fromCatalogV1Row, toCatalogRows, durationLabelToSeconds,
  });
});
