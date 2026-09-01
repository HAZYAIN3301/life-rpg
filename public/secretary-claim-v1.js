/* Satoru Secretary Claim v1 — кто именно показывает ход (дефекты §12 №10, 11, 18).
 *
 * Утренний ход существует в одном экземпляре, а поверхностей у него две: карточка в
 * открытом приложении и пуш, когда приложение закрыто. Обе живут в разных процессах и
 * узнают об одном и том же поводе независимо. Без арбитра человек получает пуш, потом
 * открывает приложение и видит ту же карточку — и вмешательство, которое должно было
 * прозвучать один раз мягко, превращается в преследование.
 *
 * Поэтому право показать берётся ЗАЯВКОЙ до показа, а не проверкой после.
 *
 * ⚠️ Главное правило и единственное неочевидное: **неопределённый провал доставки не
 * освобождает заявку**. Ответ 404/410 означает, что подписки больше нет — это
 * определённо не доставлено, и другая поверхность может забрать ход. А 429, 500 и
 * оборванное соединение не означают ничего: пуш мог уйти. Показать после них карточку
 * значит рискнуть вторым одинаковым обращением, и здесь выбран противоположный риск —
 * промолчать. Молчание стоит одного пропущенного утра, дубль стоит доверия к самому
 * механизму, а его чинить нечем.
 *
 * ⚠️ Заявка НЕ заменяет кулдаун. Она разводит поверхности внутри одного повода;
 * «не чаще раза в день» остаётся за ledger роутера.
 *
 * Чистый модуль: только данные на входе, время приходит параметром.
 */
(function exposeSecretaryClaim(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryClaimV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryClaim() {
  'use strict';

  const VERSION = '1.0.0';

  // Поверхности, которые могут показать ход. Список закрытый: канал, о котором не
  // знает арбитр, — это канал, способный показать второй ход.
  const CHANNELS = Object.freeze(['card', 'push']);

  // Исходы попытки доставки. Ровно те, что различает `pushDeliveryOutcome` сервера,
  // плюс явный отказ человека.
  const OUTCOMES = Object.freeze(['delivered', 'gone', 'retry', 'dismissed']);

  /* Сколько заявка держит ход за собой. Пятнадцать минут — это компромисс между
   * «карточка успеет показаться после пуша» и «зависший процесс не съест всё утро».
   * По истечении ход может забрать другая поверхность; от повторного обращения
   * за день по-прежнему защищает кулдаун, а не этот срок. */
  const CLAIM_TTL_MS = 15 * 60 * 1000;
  const MAX_CLAIMS = 64;
  const MAX_ID = 160;

  function str(v, max) {
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '';
  }
  function isIso(v) { return typeof v === 'string' && !isNaN(Date.parse(v)); }
  function ms(v) { return isIso(v) ? Date.parse(v) : NaN; }

  function emptyClaims() { return { version: 1, claims: {} }; }

  function cleanClaim(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const token = str(raw.token, 80);
    const channel = CHANNELS.indexOf(raw.channel) >= 0 ? raw.channel : '';
    if (!token || !channel || !isIso(raw.at) || !isIso(raw.expiresAt)) return null;
    const out = { token, channel, at: raw.at, expiresAt: raw.expiresAt };
    if (OUTCOMES.indexOf(raw.outcome) >= 0) out.outcome = raw.outcome;
    if (isIso(raw.settledAt)) out.settledAt = raw.settledAt;
    return out;
  }

  /**
   * Строгая проверка сохранённого файла: `null` на мусоре, а не пустой объект.
   * Пустые заявки означали бы «ход свободен» и разрешили бы показать его повторно.
   */
  function sanitizeClaims(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (Object.prototype.hasOwnProperty.call(raw, 'claims')
      && (!raw.claims || typeof raw.claims !== 'object' || Array.isArray(raw.claims))) return null;
    const src = raw.claims || {};
    const claims = {};
    for (const key of Object.keys(src)) {
      const id = str(key, MAX_ID);
      const c = cleanClaim(src[key]);
      if (!id || !c) return null;      // непонятная запись — отказ, а не тихая потеря
      claims[id] = c;
    }
    return { version: 1, claims };
  }

  /**
   * Заявка, которая прямо сейчас держит ход. Не держит только истёкшая.
   *
   * ⚠️ Закрытая исходом `delivered`/`dismissed` держит ход ДАЛЬШЕ, и это не описка:
   * ход уже был показан. Освобождает его единственный исход — `gone`, и он стирает
   * запись целиком, потому что показа точно не было.
   */
  function activeClaim(claims, offerId, nowIso) {
    const base = sanitizeClaims(claims) || emptyClaims();
    const id = str(offerId, MAX_ID);
    const now = ms(nowIso);
    const c = id ? base.claims[id] : null;
    if (!c || isNaN(now)) return null;
    if (ms(c.expiresAt) <= now) return null;
    return c;
  }

  /**
   * Взять право показать ход.
   *
   * @returns {{ok:true, token, claims, repeat}} — можно показывать
   *          {{ok:false, reason:'held', channel}} — держит другая поверхность
   */
  function claim(claims, offerId, channel, nowIso, tokenSeed) {
    const base = sanitizeClaims(claims);
    if (!base) return { ok: false, reason: 'invalid_claims' };
    const id = str(offerId, MAX_ID);
    if (!id) return { ok: false, reason: 'bad_offer' };
    if (CHANNELS.indexOf(channel) < 0) return { ok: false, reason: 'bad_channel' };
    const now = ms(nowIso);
    if (isNaN(now)) return { ok: false, reason: 'bad_now' };

    const held = activeClaim(base, id, nowIso);
    if (held) {
      // Показанное не показывается снова — даже той же поверхности.
      if (held.outcome === 'delivered' || held.outcome === 'dismissed') {
        return { ok: false, reason: 'settled', channel: held.channel, outcome: held.outcome };
      }
      // Та же поверхность повторяет попытку — обычный retry, а не конфликт.
      if (held.channel === channel) return { ok: true, token: held.token, claims: base, repeat: true };
      return { ok: false, reason: 'held', channel: held.channel };
    }

    // Токен короткий намеренно: `offerId` уже является ключом записи, и вкладывать
    // его внутрь токена значило упереться в предел длины — тогда сохранённый токен
    // молча переставал совпадать с выданным, и заявку нельзя было закрыть.
    const token = str(tokenSeed, 80) || `${channel}-${now}`;
    const next = {
      token, channel, at: new Date(now).toISOString(),
      expiresAt: new Date(now + CLAIM_TTL_MS).toISOString(),
    };
    const all = Object.assign({}, base.claims, { [id]: next });
    // Старые записи подрезаются, чтобы файл не рос вечно: истёкшие и закрытые
    // ничего уже не держат.
    const keys = Object.keys(all);
    if (keys.length > MAX_CLAIMS) {
      const keep = keys
        .sort((a, b) => ms(all[b].at) - ms(all[a].at))
        .slice(0, MAX_CLAIMS);
      for (const k of keys) if (keep.indexOf(k) < 0) delete all[k];
    }
    return { ok: true, token, claims: { version: 1, claims: all }, repeat: false };
  }

  /**
   * Сообщить, чем кончилась попытка.
   *
   * `delivered`  — показано; ход занят до истечения записи.
   * `dismissed`  — человек ответил отказом; ход закрыт.
   * `gone`       — подписки больше нет (404/410). Определённо не доставлено:
   *                заявка снимается, другая поверхность может забрать ход.
   * `retry`      — 429/5xx/обрыв. Ничего не известно, пуш мог уйти. Заявка
   *                СОХРАНЯЕТСЯ до истечения — см. шапку модуля.
   */
  function settle(claims, offerId, token, outcome, nowIso) {
    const base = sanitizeClaims(claims);
    if (!base) return { ok: false, reason: 'invalid_claims' };
    const id = str(offerId, MAX_ID);
    const c = id ? base.claims[id] : null;
    if (!c) return { ok: false, reason: 'not_found' };
    if (c.token !== str(token, 80)) return { ok: false, reason: 'bad_token' };
    if (OUTCOMES.indexOf(outcome) < 0) return { ok: false, reason: 'bad_outcome' };
    if (!isIso(nowIso)) return { ok: false, reason: 'bad_now' };

    if (outcome === 'gone') {
      // Единственный случай, когда ход возвращается в общий доступ.
      const all = Object.assign({}, base.claims);
      delete all[id];
      return { ok: true, claims: { version: 1, claims: all }, released: true, outcome };
    }
    const updated = Object.assign({}, c, { outcome, settledAt: nowIso });
    return {
      ok: true,
      claims: { version: 1, claims: Object.assign({}, base.claims, { [id]: updated }) },
      // `retry` не освобождает: неизвестность — не разрешение показать второй раз.
      released: false,
      outcome,
    };
  }

  /**
   * Текст пуша. Намеренно один и тот же на любой повод.
   *
   * ⚠️ Пуш проходит через чужие серверы и лежит на экране блокировки, где его видит
   * кто угодно. Поэтому в нём нет ни цитаты уговора, ни названия занятия, ни причины,
   * ни заметки — всё это остаётся в приложении, за аутентификацией (§10). Ход теряет
   * в убедительности; приватность здесь дороже.
   */
  function pushCopy() {
    return { title: 'Тень', body: 'Тень подготовила лёгкий вход' };
  }

  return Object.freeze({
    VERSION, CHANNELS, OUTCOMES, CLAIM_TTL_MS, MAX_CLAIMS,
    emptyClaims, sanitizeClaims, activeClaim, claim, settle, pushCopy,
  });
});
