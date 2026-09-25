/* Satoru Calendar Export v1 — квесты со временем в .ics по RFC 5545 (R04D).
 *
 * Что было. buildICS() в app.js писал строки любой длины (название на кириллице
 * легко превышает 75 октетов — строгие импортёры отбрасывают событие), не
 * экранировал перевод строки CR, подставлял некорректное время «9:5» как есть
 * («DTSTART:…T9500») и приклеивал к названию эмодзи 🎯. Файл назывался
 * «gojo-calendar.ics» по старому имени продукта.
 *
 * Контракт:
 *   - UID остаётся `${task.id}@gojo`: календари, куда файл уже импортировали,
 *     обновят те же события, а не создадут дубликаты;
 *   - время «плавающее» (без TZID): событие стоит в том же местном времени, в
 *     котором человек поставил его в Satoru;
 *   - строки сворачиваются по 75 октетов UTF-8 (CRLF + пробел), не разрывая
 *     многобайтовые символы; текст экранируется по §3.3.11;
 *   - квест без корректной даты или времени не экспортируется, а считается
 *     в `skipped`, чтобы интерфейс мог это назвать.
 *
 * Чистый модуль: ни DOM, ни State, ни переводчика.
 */
(function exposeCalendarExport(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalendarExportV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCalendarExport() {
  'use strict';

  const VERSION = '1.0.0';
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const MAX_OCTETS = 75;

  function validDate(value) {
    const m = DATE_RE.exec(String(value || ''));
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? `${m[1]}${m[2]}${m[3]}` : null;
  }
  function validTime(value) {
    const raw = String(value || '').trim();
    const short = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
    const normalized = short ? `${short[1].padStart(2, '0')}:${short[2].padStart(2, '0')}` : raw;
    const m = TIME_RE.exec(normalized);
    return m ? `${m[1]}${m[2]}00` : null;
  }
  /** §3.3.11 TEXT: backslash, semicolon, comma, newline. CR is dropped. */
  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }
  /** §3.1: fold lines longer than 75 octets without splitting a UTF-8 character. */
  function foldLine(line) {
    const chars = Array.from(String(line));
    const out = []; let current = '', octets = 0, limit = MAX_OCTETS;
    for (const ch of chars) {
      const size = utf8Length(ch);
      if (octets + size > limit) { out.push(current); current = ' '; octets = 1; limit = MAX_OCTETS; }
      current += ch; octets += size;
    }
    out.push(current);
    return out.join('\r\n');
  }
  function utf8Length(ch) {
    const code = ch.codePointAt(0);
    return code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  function stampOf(now) {
    const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * @param {Array<{id:string,title?:string,date?:string,startTime?:string,estimateMin?:number,done?:boolean}>} tasks
   * @param {{now?:Date, sphereOf?:(task)=>string, calendarName?:string}} [options]
   * @returns {{text:string, count:number, skipped:number}}
   */
  function build(tasks, options) {
    const o = options || {};
    const stamp = stampOf(o.now);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Satoru//Life Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(o.calendarName || 'Satoru')}`];
    let count = 0, skipped = 0;
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || !task.id || !task.startTime) continue;
      const date = validDate(task.date), time = validTime(task.startTime);
      if (!date || !time) { skipped += 1; continue; }
      const minutes = Math.max(5, Math.min(24 * 60, Math.round(Number(task.estimateMin) || 30)));
      const sphere = typeof o.sphereOf === 'function' ? String(o.sphereOf(task) || '') : '';
      lines.push('BEGIN:VEVENT', `UID:${escapeText(task.id)}@gojo`, `DTSTAMP:${stamp}`, `DTSTART:${date}T${time}`, `DURATION:PT${minutes}M`,
        `SUMMARY:${escapeText(String(task.title || '').trim() || 'Satoru')}`,
        `DESCRIPTION:${escapeText(sphere ? `Satoru · ${sphere}` : 'Satoru')}`,
        'CATEGORIES:Satoru', 'END:VEVENT');
      count += 1;
    }
    lines.push('END:VCALENDAR');
    return { text: lines.map(foldLine).join('\r\n') + '\r\n', count, skipped };
  }

  function filename(date) {
    return `satoru-calendar-${validDate(date) ? String(date) : 'export'}.ics`;
  }

  return { VERSION, MAX_OCTETS, escapeText, foldLine, validTime, validDate, build, filename };
});
