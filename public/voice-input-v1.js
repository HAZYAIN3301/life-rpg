/* Satoru Voice Input v1 — голос везде, где можно писать.
 *
 * fb_msp3icn49ttl: «везде где можно записывать нужно добавить возможность
 * голосового ввода. особенно в рефлексиях и коммуникации с ИИ и особенно везде
 * где много ценной информации от пользователя». Решение Альберта 13.08: делаем.
 *
 * ПОЧЕМУ БРАУЗЕРНОЕ РАСПОЗНАВАНИЕ, А НЕ WHISPER.
 * Тот же довод, по которому в Shadow Voice v2.2 отказались от OpenAI TTS в
 * пользу локального Piper: владелец не должен платить за каждую реплику, а
 * пользователь — заводить ключ. Рефлексия и разговор с Тенью это самые частые
 * длинные тексты в продукте; на Whisper они стали бы самой дорогой функцией
 * приложения и первой, которую пришлось бы гейтить за Pro. Whisper остаётся
 * возможным opt-in для тех, кому не хватит качества.
 *
 * ПОЧЕМУ ОДНА КНОПКА, А НЕ КНОПКА У КАЖДОГО ПОЛЯ.
 * «Везде» — это про доступность, а не про количество кнопок. Вставлять кнопку
 * рядом с каждым полем значит менять раскладку тридцати мест сразу (многие поля
 * лежат во flex-строках и адресуются из кода по id), а каждое новое поле в
 * будущем пришлось бы не забыть. Здесь одна кнопка ходит за фокусом: раскладка
 * не трогается вообще, и поля, которых ещё нет, поддержаны заранее.
 *
 * ⚠️ ГЛАВНЫЙ ГЕЙТ: НИКОГДА НЕ СЛУШАТЬ СЕКРЕТЫ.
 * Пароль, PIN, код восстановления и ИИ-ключ голосом не вводятся ни при каких
 * условиях. Продиктованный вслух пароль уходит в облачный распознаватель и
 * звучит в комнате — это вред, а не неудобство. Список исключений закрыт
 * тестами; при сомнении поле считается секретным.
 *
 * Модуль не читает State и не зовёт t(): язык берётся из документа, тексты
 * приходят через setLabels() от вызывающего кода.
 */
(function exposeVoiceInput(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VoiceInputV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildVoiceInput() {
  'use strict';

  const VERSION = '1.0.0';

  // Поля, куда голос не идёт никогда. Проверяется по типу, по имени/id и по
  // autocomplete — совпадения любого из признаков достаточно.
  const SECRET_TYPES = ['password'];
  // Интерфейс живёт на пяти языках, и поле ИИ-ключа подписано «Вставь ключ», а
  // не «key». Список обязан покрывать языки интерфейса, иначе гейт защищает
  // только английскую версию.
  const SECRET_HINTS = [
    'password', 'passwd', 'pass', 'pin', 'secret', 'token', 'apikey', 'api-key',
    'key', 'recovery', 'code', 'otp', 'cvv', 'card',
    'пароль', 'пин', 'ключ', 'секрет', 'токен', 'код', 'восстановления',
    'passwort', 'schlüssel', 'contraseña', 'clave', 'пароля',
  ];
  const SECRET_AUTOCOMPLETE = ['current-password', 'new-password', 'one-time-code', 'cc-number', 'cc-csc'];
  // Типы, где голос бессмысленен: значение не является речью.
  const NON_TEXT_TYPES = ['number', 'range', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'file', 'checkbox', 'radio', 'submit', 'button', 'hidden', 'image', 'reset'];

  const LANGS = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', uk: 'uk-UA', es: 'es-ES' };

  function attr(el, name) {
    if (!el) return '';
    if (typeof el.getAttribute === 'function') { const v = el.getAttribute(name); if (v != null) return String(v); }
    const direct = el[name] != null ? el[name] : el[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    return direct == null ? '' : String(direct);
  }

  function looksSecret(el) {
    // ⚠️ camelCase разбивается ДО приведения к нижнему регистру. Без этого
    // `newPin` превращался в `newpin`, граница слова не срабатывала, и голос
    // допускался к полю смены PIN — а поля в приложении названы именно так
    // (`oldPin`, `newPin`, `apiKey`). Дефект поймал тест.
    const hay = [attr(el, 'name'), attr(el, 'id'), attr(el, 'placeholder'), attr(el, 'aria-label'), attr(el, 'class')]
      .join(' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase();
    // Границы слова важны: «keyword», «decode» и «Ключевые мысли» не должны
    // считаться секретом, а «pin-code», «api_key» и «вставь ключ» — должны.
    //
    // ⚠️ Граница задана как «не буква и не цифра» ЧЕРЕЗ \p{L} с флагом `u`, а не
    // как [^a-z] и не как \b. Оба коротких пути ломаются на кириллице: для них
    // русская буква — «не буква», поэтому «Ключевые» совпало бы с «ключ». Это те
    // же грабли, что уже дважды стоили нам багов в других регулярках проекта.
    const EDGE = '[^\\p{L}\\p{N}]';
    for (const hint of SECRET_HINTS) {
      const esc = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('(^|' + EDGE + ')' + esc + '(' + EDGE + '|$)', 'u').test(hay)) return true;
    }
    const ac = attr(el, 'autocomplete').toLowerCase();
    return SECRET_AUTOCOMPLETE.includes(ac);
  }

  /**
   * Годится ли поле для голоса. При любом сомнении — нет.
   * Работает и на настоящем элементе, и на простом объекте той же формы.
   */
  function isEligible(el) {
    if (!el || typeof el !== 'object') return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (el.disabled || el.readOnly) return false;
    if (typeof el.closest === 'function' && el.closest('[data-no-voice]')) return false;
    if (attr(el, 'data-no-voice')) return false;

    if (tag === 'TEXTAREA') return !looksSecret(el);
    if (tag === 'INPUT') {
      const type = (attr(el, 'type') || 'text').toLowerCase();
      if (SECRET_TYPES.includes(type)) return false;
      if (NON_TEXT_TYPES.includes(type)) return false;
      // email/tel голосом набирать мучительно и ошибочно — не мешаем, но и не зовём.
      if (type === 'email' || type === 'tel') return false;
      return !looksSecret(el);
    }
    if (el.isContentEditable === true) return !looksSecret(el);
    return false;
  }

  /** Код языка для распознавателя. Неизвестный — русский, это язык владельца. */
  function langTag(code) {
    return LANGS[String(code || '').toLowerCase().slice(0, 2)] || LANGS.ru;
  }

  /**
   * Куда и как класть распознанное.
   *
   * Дописываем, а не заменяем: в рефлексии человек часто уже что-то напечатал, и
   * стереть это было бы худшим из возможных поведений. Пробел ставится сам,
   * если его нет, — но не в начале поля.
   *
   * @returns {{value:string, caret:number}}
   */
  function insertText(value, start, end, text) {
    const src = String(value == null ? '' : value);
    const chunk = String(text == null ? '' : text).trim();
    if (!chunk) return { value: src, caret: src.length };
    let from = Number.isFinite(start) ? Math.max(0, Math.min(src.length, start)) : src.length;
    let to = Number.isFinite(end) ? Math.max(from, Math.min(src.length, end)) : from;
    const before = src.slice(0, from);
    const after = src.slice(to);
    // Пробелы нужны с ОБЕИХ сторон: диктовка в середину текста иначе склеивает
    // слова («начало|конец» + «середина» давало «начало серединаконец»).
    const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
    const tail = after.length > 0 && !/^[\s.,!?:;)]/.test(after) ? ' ' : '';
    const insert = lead + chunk;
    return { value: before + insert + tail + after, caret: (before + insert).length };
  }

  /** Поддерживается ли распознавание вообще. Без поддержки кнопки не будет. */
  function supported(win) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    return !!(w && (w.SpeechRecognition || w.webkitSpeechRecognition));
  }

  // ── Всё ниже требует DOM и в тестах не исполняется ───────────────────────────
  const LABELS = { start: 'Записать голосом', stop: 'Остановить запись', denied: 'Нет доступа к микрофону' };
  // Подписи можно прислать и ПОСЛЕ создания кнопки: модуль подключается сам при
  // загрузке, а переводы у приложения появляются позже. Поэтому setLabels чинит
  // и уже стоящую кнопку, иначе она навсегда осталась бы на языке по умолчанию.
  function setLabels(next) {
    Object.assign(LABELS, next || {});
    const w = typeof window !== 'undefined' ? window : null;
    const btn = w && w.document && w.document.getElementById('voice-input-btn');
    if (btn && btn.getAttribute('aria-pressed') !== 'true') {
      btn.setAttribute('aria-label', LABELS.start);
      btn.title = LABELS.start;
    }
  }

  function attach(win) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    if (!w || !w.document || !supported(w)) return null;
    const doc = w.document;
    if (doc.getElementById('voice-input-btn')) return null;

    const style = doc.createElement('style');
    style.textContent = `
      #voice-input-btn{position:absolute;z-index:60;display:none;align-items:center;justify-content:center;
        width:42px;height:42px;padding:0;border-radius:50%;border:1px solid var(--line,#2a3350);
        background:var(--card,#161d33);color:var(--text,#e8ecf7);cursor:pointer;font-size:17px;line-height:1}
      #voice-input-btn:focus-visible{outline:2px solid var(--accent,#7c8cff);outline-offset:2px}
      #voice-input-btn[aria-pressed="true"]{border-color:var(--accent,#7c8cff)}
      @media (prefers-reduced-motion:no-preference){#voice-input-btn[aria-pressed="true"]{animation:viPulse 1.4s ease-in-out infinite}}
      @keyframes viPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`;
    doc.head.appendChild(style);

    const btn = doc.createElement('button');
    btn.id = 'voice-input-btn';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', LABELS.start);
    btn.title = LABELS.start;
    btn.textContent = '🎤';
    doc.body.appendChild(btn);

    let field = null, rec = null, listening = false, baseValue = '', baseStart = 0, baseEnd = 0;

    const place = () => {
      if (!field) { btn.style.display = 'none'; return; }
      const r = field.getBoundingClientRect();
      if (!r.width && !r.height) { btn.style.display = 'none'; return; }
      btn.style.display = 'flex';
      // Снаружи правого края, если есть место, иначе внутри — поле не перекрываем.
      const outside = r.right + 46 < (w.innerWidth || 0);
      const x = outside ? r.right + 4 : r.right - 46;
      // У однострочного поля кнопка по центру высоты, у textarea — у нижнего
      // края: там она не закрывает набираемый текст, который растёт сверху вниз.
      const y = r.height > 60 ? r.bottom - 46 : r.top + (r.height - 42) / 2;
      btn.style.left = Math.round(x + (w.scrollX || 0)) + 'px';
      btn.style.top = Math.round(Math.max(r.top, y) + (w.scrollY || 0)) + 'px';
    };

    const stop = () => { if (rec) { try { rec.stop(); } catch {} } };

    const start = () => {
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
      rec = new Ctor();
      rec.lang = langTag(doc.documentElement && doc.documentElement.lang);
      rec.interimResults = true;
      rec.continuous = true;
      baseValue = field.value != null ? field.value : field.textContent;
      baseStart = field.selectionStart;
      baseEnd = field.selectionEnd;
      rec.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
        const next = insertText(baseValue, baseStart, baseEnd, text);
        if (field.value != null) {
          field.value = next.value;
          try { field.setSelectionRange(next.caret, next.caret); } catch {}
        } else { field.textContent = next.value; }
        // Обязательно: приложение сохраняет и реагирует по событию input, а
        // программная установка value его не порождает.
        field.dispatchEvent(new w.Event('input', { bubbles: true }));
      };
      rec.onerror = (e) => {
        if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
          btn.setAttribute('aria-label', LABELS.denied);
          btn.title = LABELS.denied;
        }
      };
      rec.onend = () => {
        listening = false;
        btn.setAttribute('aria-pressed', 'false');
        field && field.dispatchEvent(new w.Event('change', { bubbles: true }));
      };
      rec.start();
      listening = true;
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', LABELS.stop);
    };

    // Palec/мышь по кнопке не должны уводить фокус из поля — иначе некуда писать.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (!field) return;
      if (listening) stop(); else start();
    });

    doc.addEventListener('focusin', (e) => {
      if (!isEligible(e.target)) { if (!listening) { field = null; btn.style.display = 'none'; } return; }
      field = e.target; place();
    });
    doc.addEventListener('focusout', () => {
      if (listening) return;             // запись продолжается — кнопка остаётся
      setTimeout(() => {
        const active = doc.activeElement;
        if (active === btn) return;
        if (!isEligible(active)) { field = null; btn.style.display = 'none'; }
      }, 0);
    });
    w.addEventListener('scroll', place, true);
    w.addEventListener('resize', place);

    return btn;
  }

  // Самоподключение. «Везде» не должно зависеть от того, вспомнил ли кто-то
  // позвать attach() — иначе фича снова становится списком мест, который надо
  // не забыть пополнять. Так подключение сводится к одному тегу <script>, и
  // `app.js` для него не нужен вовсе. Отказаться можно заранее:
  // window.SATORU_NO_VOICE = true.
  (function autoAttach() {
    const w = typeof window !== 'undefined' ? window : null;
    if (!w || !w.document || w.SATORU_NO_VOICE) return;
    if (!supported(w)) return;                       // без поддержки — молча ничего
    const run = () => { try { attach(w); } catch {} };
    if (w.document.readyState === 'loading') w.document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  })();

  return {
    VERSION, SECRET_HINTS, SECRET_AUTOCOMPLETE, NON_TEXT_TYPES, LANGS,
    isEligible, looksSecret, langTag, insertText, supported, setLabels, attach,
  };
});
