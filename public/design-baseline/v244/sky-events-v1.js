/* Satoru Sky Events v1 — что происходит на небе над конкретной точкой в конкретную ночь.
 *
 * Зачем модуль вообще существует (идея Альберта 15.08): доска предлагает выполнимые
 * поводы выйти из привычного маршрута, но все они «всегда доступны». Событие, которое
 * работает только сегодня вечером и только здесь, — это другой тип повода: его нельзя
 * отложить, и именно поэтому он двигает.
 *
 * ⚠️ ГЛАВНОЕ РЕШЕНИЕ: здесь НЕТ и не будет ИИ.
 * Соблазн был очевидный — попросить модель «подкинуть концерт в городе». Но у такого
 * ответа нет источника: модель уверенно назовёт площадку, дату и группу, человек выйдет
 * из дома, и там не окажется ничего. Один такой вечер убивает доверие ко всей доске
 * навсегда, а выигрыш — пара строк текста. Поэтому небо считается формулами (метеорные
 * потоки, фаза луны, время темноты), а всё, чего посчитать нельзя, доска честно называет
 * поводом посмотреть афишу, а не фактом.
 *
 * Всё детерминировано: те же вход и дата дают тот же ответ. Ни сети, ни ключей, ни зависимостей.
 * Модуль ничего не знает про DOM, State и переводы — на вход числа, на выход данные.
 */
(function exposeSkyEvents(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SkyEventsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSkyEvents() {
  'use strict';

  const VERSION = '1.0.0';
  const SYNODIC = 29.530588853;            // средний синодический месяц, суток
  const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // известное новолуние, в сутках от эпохи JS

  // Метеорные потоки: даты пиков почти не плавают год от года (±1 сутки), поэтому таблица
  // честнее любого API — она не отвалится и не соврёт. `hemisphere` говорит, где радиант
  // реально высоко над горизонтом: Эта-Аквариды с севера почти не видно, и обещать их нельзя.
  const SHOWERS = Object.freeze([
    Object.freeze({ id: 'quadrantids', name: 'Квадрантиды', month: 1, day: 3, zhr: 110, window: 2, hemisphere: 'north' }),
    Object.freeze({ id: 'lyrids', name: 'Лириды', month: 4, day: 22, zhr: 18, window: 3, hemisphere: 'north' }),
    Object.freeze({ id: 'eta-aquariids', name: 'Эта-Аквариды', month: 5, day: 6, zhr: 50, window: 4, hemisphere: 'south' }),
    Object.freeze({ id: 'perseids', name: 'Персеиды', month: 8, day: 12, zhr: 100, window: 4, hemisphere: 'north' }),
    Object.freeze({ id: 'orionids', name: 'Ориониды', month: 10, day: 21, zhr: 20, window: 4, hemisphere: 'both' }),
    Object.freeze({ id: 'leonids', name: 'Леониды', month: 11, day: 17, zhr: 15, window: 3, hemisphere: 'both' }),
    Object.freeze({ id: 'geminids', name: 'Геминиды', month: 12, day: 14, zhr: 120, window: 3, hemisphere: 'both' }),
    Object.freeze({ id: 'ursids', name: 'Урсиды', month: 12, day: 22, zhr: 10, window: 2, hemisphere: 'north' }),
  ]);

  const MOON_NAMES = Object.freeze(['новолуние', 'растущий серп', 'первая четверть', 'растущая луна', 'полнолуние', 'убывающая луна', 'последняя четверть', 'убывающий серп']);

  function isDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function utcOf(day) { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function dayOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(day, n) { return dayOf(utcOf(day) + n * 86400000); }
  function clampLat(v) { return Math.max(-89.9, Math.min(89.9, Number(v) || 0)); }
  function wrapLon(v) { const x = Number(v) || 0; return ((x + 180) % 360 + 360) % 360 - 180; }

  /** Фаза луны на полночь UTC указанной даты. */
  function moonPhase(day) {
    if (!isDay(day)) return null;
    const days = utcOf(day) / 86400000;
    let age = (days - NEW_MOON_EPOCH) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const frac = age / SYNODIC;
    // Освещённость — косинус фазового угла; для наших целей (мешает ли луна смотреть
    // метеоры) точности этой формулы с запасом достаточно.
    const illumination = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    const idx = Math.floor((frac + 1 / 16) * 8) % 8;
    return { age: Math.round(age * 100) / 100, illumination: Math.round(illumination * 1000) / 1000, name: MOON_NAMES[idx], index: idx };
  }

  /**
   * Восход/заход солнца и конец астрономических сумерек (когда небо реально тёмное).
   * Стандартное «уравнение восхода»; на средних широтах ошибка — минуты, что для
   * «выйди смотреть после половины одиннадцатого» несущественно.
   * Возвращает минуты от полуночи UTC либо null, если светило не заходит/не восходит.
   */
  function sunTimes(day, lat, lon) {
    if (!isDay(day)) return null;
    const latitude = clampLat(lat), longitude = wrapLon(lon);
    const n = Math.floor(utcOf(day) / 86400000 - 10957.5 + 0.0008); // дни от 2000-01-01
    const rad = Math.PI / 180;
    const mean = (357.5291 + 0.98560028 * n) % 360;
    const center = 1.9148 * Math.sin(mean * rad) + 0.02 * Math.sin(2 * mean * rad) + 0.0003 * Math.sin(3 * mean * rad);
    const ecliptic = (mean + center + 180 + 102.9372) % 360;
    const transit = 2451545.0 + n + 0.0053 * Math.sin(mean * rad) - 0.0069 * Math.sin(2 * ecliptic * rad);
    const declination = Math.asin(Math.sin(ecliptic * rad) * Math.sin(23.44 * rad)) / rad;

    const hourAngle = (angle) => {
      const cos = (Math.sin(angle * rad) - Math.sin(latitude * rad) * Math.sin(declination * rad))
        / (Math.cos(latitude * rad) * Math.cos(declination * rad));
      if (cos > 1 || cos < -1) return null;   // полярный день или полярная ночь
      return Math.acos(cos) / rad;
    };
    const toMinutes = (jd) => {
      const minutes = Math.round((jd - Math.floor(jd - 0.5) - 0.5) * 1440);
      return ((minutes % 1440) + 1440) % 1440;
    };
    const solve = (angle) => {
      const ha = hourAngle(angle);
      if (ha === null) return null;
      const offset = (ha + longitude) / 360;
      return { rise: toMinutes(transit - offset), set: toMinutes(transit + (ha - longitude) / 360) };
    };
    const daylight = solve(-0.833);          // верхний край диска у горизонта + рефракция
    const astro = solve(-18);                // конец астрономических сумерек: небо тёмное
    return {
      sunrise: daylight ? daylight.rise : null,
      sunset: daylight ? daylight.set : null,
      darkStart: astro ? astro.set : null,
      darkEnd: astro ? astro.rise : null,
      polar: !daylight,
    };
  }

  /** Активен ли поток в этот день и насколько близко к пику. */
  function showersOn(day, lat) {
    if (!isDay(day)) return [];
    const [, month, date] = day.split('-').map(Number);
    const latitude = clampLat(lat);
    const out = [];
    for (const shower of SHOWERS) {
      // Пик может лежать в соседнем месяце — сравниваем по расстоянию в сутках внутри года.
      const peakDay = `${day.slice(0, 4)}-${String(shower.month).padStart(2, '0')}-${String(shower.day).padStart(2, '0')}`;
      let diff = Math.round((utcOf(day) - utcOf(peakDay)) / 86400000);
      if (diff > 182) diff -= 365; if (diff < -182) diff += 365;
      if (Math.abs(diff) > shower.window) continue;
      if (shower.hemisphere === 'north' && latitude < -10) continue;   // радиант не поднимется
      if (shower.hemisphere === 'south' && latitude > 25) continue;
      out.push({ ...shower, peakDay, offsetDays: diff, isPeak: diff === 0, month, date });
    }
    return out;
  }

  /**
   * События неба на ближайшие дни для точки на Земле.
   * @param {{lat:number, lon:number, from:string, days?:number}} input
   * @returns {Array<{id,kind,day,title,detail,quality,startMin,endMin}>}
   */
  function skyEvents(input) {
    const inp = input || {};
    if (!isDay(inp.from)) return [];
    const lat = clampLat(inp.lat), lon = wrapLon(inp.lon);
    const days = Math.max(1, Math.min(30, Number(inp.days) || 7));
    const out = [];
    for (let i = 0; i < days; i += 1) {
      const day = addDays(inp.from, i);
      const moon = moonPhase(day);
      const sun = sunTimes(day, lat, lon);
      for (const shower of showersOn(day, lat)) {
        // Луна — главный враг метеоров: в полнолуние сильный поток выглядит слабым, и
        // звать человека на улицу обещанием «сто метеоров в час» было бы обманом.
        const washed = moon.illumination > 0.7;
        const quality = shower.isPeak && !washed ? 'отличные' : washed ? 'мешает луна' : 'хорошие';
        out.push({
          id: `sky-${shower.id}-${day}`,
          kind: 'meteor',
          day,
          title: shower.isPeak ? `${shower.name} — пик` : shower.name,
          detail: `до ${shower.zhr} метеоров в час в идеале · луна ${Math.round(moon.illumination * 100)}%`,
          quality,
          startMin: sun && sun.darkStart != null ? sun.darkStart : null,
          endMin: sun && sun.darkEnd != null ? sun.darkEnd : null,
          washedOut: washed,
        });
      }
      // Полнолуние — само по себе повод выйти, и оно точно видно всем без оборудования.
      if (moon.index === 4 && moonPhase(addDays(day, -1)).index !== 4) {
        out.push({
          id: `sky-fullmoon-${day}`, kind: 'moon', day,
          title: 'Полнолуние', detail: `освещённость ${Math.round(moon.illumination * 100)}%`,
          quality: 'видно везде',
          startMin: sun ? sun.sunset : null, endMin: sun ? sun.sunrise : null, washedOut: false,
        });
      }
    }
    return out;
  }

  /** Минуты от полуночи → «22:41». Часовой пояс не применяется — это делает вызывающий код. */
  function hhmm(minutes) {
    if (minutes == null || !Number.isFinite(minutes)) return null;
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  return { VERSION, SHOWERS, moonPhase, sunTimes, showersOn, skyEvents, hhmm };
});
