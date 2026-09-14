/* Ревизия журнала внимания: короткая метка состояния, по которой и клиент, и
 * сервер одинаково отвечают на один вопрос — «это всё ещё то, что я читал?».
 *
 * Зачем вообще. До этого модуля `PUT /api/attention` принимал весь конверт
 * целиком и без базы. Два клиента, прочитавшие одно состояние, сохраняли каждый
 * своё, и запись второго молча стирала правило первого: оба запроса отвечали 200.
 * Воспроизводится в четыре вызова. Существовавший забор ловил только полное
 * обнуление непустого журнала, но не потерю отдельного правила или эпизода.
 *
 * Остальные writers этого проекта решают это одинаково: клиент присылает базу,
 * сервер сверяет её с тем, что лежит у него, и при расхождении отказывает.
 * Здесь базой служит метка, а не копия журнала, потому что журнал бывает крупным,
 * а сравнивать нужно только факт изменения.
 *
 * Это ДЕТЕКТОР ИЗМЕНЕНИЙ, а не криптография. Он не подписывает и не защищает от
 * подделки: подделать метку может только уже авторизованный владелец собственных
 * данных, и выигрыш от этого ровно тот же, что от записи без базы. Задача метки —
 * не дать честному клиенту молча затереть чужую честную запись. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionRevisionV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const EMPTY = 'empty';

  // Ключи сортируются, поэтому порядок полей в JSON не влияет на метку: сервер
  // и клиент сериализуют одно состояние независимо и обязаны сойтись.
  function canonical(value) {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object') {
      const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    return 'null';
  }

  // FNV-1a, две 32-битные половины. Выбран не за стойкость, а за то, что даёт
  // идентичный результат в Node и в браузере без единой зависимости и без
  // асинхронного crypto. Коллизия означает пропущенный конфликт, а не порчу данных.
  function digest(text) {
    let hi = 0x811c9dc5, lo = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      hi ^= code; hi = Math.imul(hi, 0x01000193) >>> 0;
      lo ^= (code + i) & 0xffff; lo = Math.imul(lo, 0x85ebca6b) >>> 0;
    }
    return `${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
  }

  /** Метка состояния. Отсутствующий или нечитаемый журнал — это `empty`, а не ошибка:
   *  первый клиент на новом аккаунте обязан суметь записать что-то поверх пустоты. */
  function of(envelope) {
    if (envelope === null || envelope === undefined) return EMPTY;
    if (typeof envelope !== 'object' || Array.isArray(envelope)) return EMPTY;
    const policies = Array.isArray(envelope.policies) ? envelope.policies : [];
    const sessions = Array.isArray(envelope.sessions) ? envelope.sessions : [];
    const episodes = Array.isArray(envelope.episodes) ? envelope.episodes : [];
    if (!policies.length && !sessions.length && !episodes.length) return EMPTY;
    return digest(canonical({ policies, sessions, episodes }));
  }

  /** Валидна ли присланная база по форме. Клиент старой сборки базы не шлёт вовсе;
   *  это отдельный случай, и он решается вызывающим, а не здесь. */
  function valid(base) {
    return typeof base === 'string' && /^(empty|[0-9a-f]{16})$/.test(base);
  }

  /** Можно ли применять запись. Разделено на три ответа, а не на да/нет:
   *  `legacy` — база не прислана вовсе, и это не то же самое, что несовпадение. */
  function decide(base, current) {
    if (base === undefined || base === null || base === '') return 'legacy';
    if (!valid(base)) return 'invalid';
    return base === current ? 'ok' : 'conflict';
  }

  return Object.freeze({ EMPTY, canonical, digest, of, valid, decide });
});
