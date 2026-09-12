/* Confirmed evening settings/day writes. Transport and data ownership stay in Store. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EveningWritesV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const stamp = Date.parse(value + 'T00:00:00.000Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
  }
  function intent(kind, input, today) {
    if (!object(input) || !day(today)) return null;
    if (kind === 'setup' && typeof input.dailyReminder === 'boolean'
      && (time(input.eveningTime) || input.eveningTime === '' && !input.dailyReminder)) {
      return { kind, day: today, eveningTime: input.eveningTime, dailyReminder: input.dailyReminder };
    }
    if (kind === 'close' && typeof input.closed === 'boolean'
      && (input.reflection === undefined || typeof input.reflection === 'string' && input.reflection.length <= 6000)) {
      return { kind, day: today, closed: input.closed, ...(input.reflection === undefined ? {} : { reflection: input.reflection }) };
    }
    return kind === 'prompt' && day(input.day) ? { kind, day: input.day } : null;
  }
  function validIntent(value) {
    if (!object(value)) return false;
    const canonical = intent(value.kind, value, value.day);
    return !!canonical && Object.keys(value).length === Object.keys(canonical).length
      && Object.keys(canonical).every(key => value[key] === canonical[key]);
  }
  function sameIntent(a, b) {
    // A retry closes the originally selected day even after midnight/reload.
    const comparable = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'day' || value.kind === 'prompt'));
    return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
  }
  function patch(base, pending) {
    const next = clone(base);
    if (pending.kind === 'close') {
      next[pending.day] = { ...(object(next[pending.day]) ? next[pending.day] : {}), closed: pending.closed };
      if (pending.reflection !== undefined) next[pending.day].reflection = pending.reflection;
    } else {
      next.secretary = { ...(object(next.secretary) ? next.secretary : {}), ...(pending.kind === 'setup'
        ? { eveningTime: pending.eveningTime, dailyReminder: pending.dailyReminder, configured: true }
        : { lastEveningPromptDate: pending.day }) };
    }
    return next;
  }
  function matches(base, pending) {
    if (!object(base)) return false;
    if (pending.kind === 'close') return base[pending.day]?.closed === pending.closed
      && (pending.reflection === undefined || base[pending.day]?.reflection === pending.reflection);
    const cfg = base.secretary;
    return pending.kind === 'setup' ? cfg?.configured === true && cfg.eveningTime === pending.eveningTime
      && cfg.dailyReminder === pending.dailyReminder : cfg?.lastEveningPromptDate === pending.day;
  }
  const COPY = Object.freeze({
    ru: { unconfirmed: 'Запись не подтверждена. Проверь соединение и повтори.', pending_intent: 'Сначала подтверди предыдущую запись. Её значения восстановлены.', invalid_pending: 'Не удалось прочитать ожидающую запись. Обнови страницу.', storage: 'Не удалось сохранить запрос для повтора. Запись не отправлена.', invalid: 'Проверь время и параметры записи.', busy: 'Сохранение ещё идёт.' },
    en: { unconfirmed: 'The save is unconfirmed. Check your connection and retry.', pending_intent: 'Confirm the previous save first. Its values have been restored.', invalid_pending: 'The pending save could not be read. Reload the page.', storage: 'The retry request could not be saved. Nothing was sent.', invalid: 'Check the time and save settings.', busy: 'The save is still in progress.' },
    de: { unconfirmed: 'Das Speichern ist nicht bestätigt. Prüfe die Verbindung und versuche es erneut.', pending_intent: 'Bestätige zuerst die vorherige Speicherung. Ihre Werte wurden wiederhergestellt.', invalid_pending: 'Die ausstehende Speicherung konnte nicht gelesen werden. Lade die Seite neu.', storage: 'Die Anfrage zum Wiederholen konnte nicht gespeichert werden. Es wurde nichts gesendet.', invalid: 'Prüfe die Uhrzeit und die Einstellungen.', busy: 'Die Speicherung läuft noch.' },
    uk: { unconfirmed: 'Збереження не підтверджено. Перевір з’єднання та повтори.', pending_intent: 'Спочатку підтвердь попереднє збереження. Його значення відновлено.', invalid_pending: 'Не вдалося прочитати незавершене збереження. Онови сторінку.', storage: 'Не вдалося зберегти запит для повтору. Нічого не надіслано.', invalid: 'Перевір час і параметри збереження.', busy: 'Збереження ще триває.' },
    es: { unconfirmed: 'El guardado no está confirmado. Comprueba la conexión y vuelve a intentarlo.', pending_intent: 'Confirma primero el guardado anterior. Se han restaurado sus valores.', invalid_pending: 'No se pudo leer el guardado pendiente. Recarga la página.', storage: 'No se pudo guardar la solicitud para reintentar. No se envió nada.', invalid: 'Comprueba la hora y los ajustes.', busy: 'El guardado sigue en curso.' },
  });
  function message(code, lang) { return (COPY[lang] || COPY.en)[code] || (COPY[lang] || COPY.en).unconfirmed; }
  function create(env) {
    const scope = env.scope(), key = 'satoru.evening.writes.' + scope.accountId;
    let pending = {}, busy = false, corrupt = false;
    try {
      const saved = env.storage.getItem(key);
      if (saved != null) {
        const raw = JSON.parse(saved);
        if (!object(raw) || raw.version !== 1 || !object(raw.intents)
          || Object.keys(raw.intents).some(kind => !validIntent(raw.intents[kind]) || raw.intents[kind].kind !== kind)) corrupt = true;
        else pending = raw.intents;
      }
    } catch { corrupt = true; }
    const current = () => {
      const now = env.scope();
      return scope.accountId !== '' && now.accountId === scope.accountId && now.epoch === scope.epoch;
    };
    function remember(next) {
      try {
        if (Object.keys(next).length) env.storage.setItem(key, JSON.stringify({ version: 1, intents: next }));
        else env.storage.removeItem(key);
        pending = next; return true;
      } catch { return false; }
    }
    async function run(kind, input) {
      if (!current()) return { ok: false, error: 'account_changed' };
      if (corrupt) return { ok: false, error: 'invalid_pending' };
      if (busy) return { ok: false, error: 'busy' };
      const requested = intent(kind, input, env.scope().day);
      if (!requested) return { ok: false, error: 'invalid' };
      if (pending[kind] && !sameIntent(pending[kind], requested)) return { ok: false, error: 'pending_intent', intent: clone(pending[kind]) };
      const selected = pending[kind] || requested;
      if (!pending[kind] && !remember({ ...pending, [kind]: selected })) return { ok: false, error: 'storage' };
      const slot = kind === 'close' ? 'days' : 'settings';
      const failed = () => ({ ok: false, error: current() ? 'unconfirmed' : 'account_changed', intent: clone(selected) });
      function confirmed(value) {
        if (!current()) return failed();
        env.apply(slot, clone(value));
        const next = { ...pending }; delete next[kind]; remember(next);
        return { ok: true, day: selected.day, intent: clone(selected) };
      }
      busy = true;
      try {
        const before = await env.read(slot);
        if (!current() || !object(before)) return failed();
        if (matches(before, selected)) return confirmed(before);
        let written;
        const saved = await env.write(slot, async () => {
          // Read inside Store's write queue: another owner write may have finished
          // while this operation waited. Preserve all fields outside this intent.
          const base = await env.read(slot);
          return current() && object(base) ? patch(base, selected) : undefined;
        }, value => { if (!current()) return false; written = clone(value); return true; });
        if (!current()) return failed();
        if (saved === true && written) return confirmed(written);
        // A lost reply is uncertainty, not proof that the server kept old data.
        const after = await env.read(slot);
        return current() && matches(after, selected) ? confirmed(after) : failed();
      } catch { return failed(); }
      finally { busy = false; }
    }
    return Object.freeze({ run, pending: kind => pending[kind] ? clone(pending[kind]) : null });
  }
  return Object.freeze({ create, message, validIntent });
});
