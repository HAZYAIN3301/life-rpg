/* Satoru Goal Resolve v1 — «все цели про бег» → точные id, до того как что-то произойдёт.
 *
 * `assistant-actions-v1` требует, чтобы действие ссылалось на объект по id, а не по
 * описанию — именно потому, что свободный текст в качестве цели и есть способ задеть
 * не то. Но человек говорит описанием. Этот модуль стоит между: превращает фразу в
 * список кандидатов, который человек видит и подтверждает.
 *
 * ⚠️ Ключевое: модуль возвращает КАНДИДАТОВ, а не решение. Он не исполняет, не
 * выбирает за человека и не «догадывается» при слабом совпадении. Уверенное
 * совпадение и слабое различаются явно, потому что цена ошибки несимметрична:
 * лишняя цель в списке — две секунды на снятие галочки, пропущенная архивация —
 * незамеченная потеря из виду.
 *
 * Почему без эмбеддингов. Резолвер обязан работать без сети, без ключа и
 * детерминированно: он стоит на пути массовой операции, и «сегодня совпало иначе»
 * здесь недопустимо. Морфология русского и немецкого закрывается нормализацией и
 * сравнением по основам — этого достаточно для «бег/бега/пробежки» и «Jugend
 * Forscht/jugend-forscht».
 *
 * ⚠️ Отдельно про `\b`: в проекте уже дважды ловили баг на том, что в JS граница
 * слова определена только для ASCII и молча не срабатывает на кириллице. Здесь
 * границы слов не используются вовсе — только явная разбивка на токены.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeGoalResolve(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoalResolveV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGoalResolve() {
  'use strict';

  const VERSION = '1.0.0';

  // Порог уверенного совпадения. Ниже — кандидат показывается отдельно и НЕ
  // отмечается заранее: человек должен добавить его сам.
  const STRONG = 0.6;
  // Совсем слабые в выдачу не попадают: список, где половина случайна, не читают.
  const FLOOR = 0.25;
  const MAX_CANDIDATES = 50;
  // Короткие токены («в», «на», «до») совпадают со всем подряд и только шумят.
  const MIN_TOKEN = 3;

  // Слова, которые есть почти в каждой цели и потому ничего не различают.
  const STOP = Object.freeze(new Set([
    'цель', 'цели', 'целей', 'все', 'всё', 'весь', 'про', 'для', 'мои', 'мой', 'моя',
    'the', 'all', 'goal', 'goals', 'about', 'my', 'and', 'und', 'alle', 'ziel', 'ziele',
  ]));

  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      // дефисы и подчёркивания — разделители, а не буквы: «jugend-forscht» = два токена
      .replace(/[-_/\\]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    return normalize(s).split(' ').filter((w) => w.length >= MIN_TOKEN && !STOP.has(w));
  }

  /**
   * Основа слова. Грубое отсечение частых окончаний русского и немецкого — не
   * лингвистика, а способ свести «бег/бега/бегу/пробежки» к сравнимому виду.
   * Достаточно короткое, чтобы не склеивать разные слова.
   */
  function stem(w) {
    let s = String(w);
    if (s.length <= 3) return s;
    // Глагольные окончания идут первыми и длинными: без них «бегать» не сводится
    // к «бег», и запрос «бег» промахивается мимо цели «Бегать три раза в неделю».
    const endings = [
      'ываться', 'иваться', 'оваться', 'аться', 'яться', 'иться', 'еться', 'ется', 'ются',
      'ывать', 'ивать', 'овать', 'ать', 'ять', 'еть', 'ить', 'уть', 'ешь', 'ишь',
      'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
      'ей', 'ой', 'ый', 'ий', 'ая', 'яя', 'ов', 'ев', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ую', 'юю',
      'а', 'я', 'у', 'ю', 'ы', 'и', 'е', 'о',
      'en', 'er', 'es', 'em', 'e', 's',
    ];
    for (let i = 0; i < endings.length; i += 1) {
      const end = endings[i];
      // Остаток не короче трёх букв: иначе основа перестаёт что-либо различать.
      if (s.length - end.length >= 3 && s.slice(-end.length) === end) { s = s.slice(0, -end.length); break; }
    }
    return s;
  }

  function stems(list) { return list.map(stem); }

  /**
   * Совпадение одного токена запроса с текстом цели. Возвращает вес, а не булево:
   * точное слово надёжнее совпадения основ, а совпадение основ надёжнее вхождения
   * подстроки.
   */
  function tokenScore(queryToken, goalTokens, goalStems) {
    if (goalTokens.indexOf(queryToken) >= 0) return 1;
    const qs = stem(queryToken);
    if (goalStems.indexOf(qs) >= 0) return 0.85;
    // Вхождение как часть слова: «forscht» внутри «jugendforscht».
    for (let i = 0; i < goalTokens.length; i += 1) {
      const g = goalTokens[i];
      if (qs.length >= 3 && (g.indexOf(qs) >= 0 || qs.indexOf(g) >= 0)) return 0.6;
    }
    return 0;
  }

  function goalText(goal) {
    if (!goal || typeof goal !== 'object') return '';
    // Название, группа и проект: человек называет цель любым из них.
    return [goal.title, goal.group, goal.project, goal.sphere].filter(Boolean).join(' ');
  }

  /**
   * Разбор фразы в кандидатов.
   *
   * @param {string} query — то, что сказал человек
   * @param {Array} goals — его цели (чужих здесь быть не может)
   * @returns {{query, tokens, strong, weak, ambiguous}}
   *   strong    — уверенные совпадения, их можно отметить заранее
   *   weak      — показываются, но НЕ отмечены: человек добавляет сам
   *   ambiguous — true, если уверенных нет вовсе; вызывающий обязан спросить
   */
  function resolve(query, goals) {
    const qTokens = tokens(query);
    const list = Array.isArray(goals) ? goals : [];
    const out = { query: String(query == null ? '' : query), tokens: qTokens, strong: [], weak: [], ambiguous: true };
    if (!qTokens.length || !list.length) return out;

    const qStems = stems(qTokens);
    const scored = [];
    for (let i = 0; i < list.length; i += 1) {
      const goal = list[i];
      const id = goal && typeof goal.id === 'string' ? goal.id : '';
      if (!id) continue;
      const gTokens = tokens(goalText(goal));
      if (!gTokens.length) continue;
      const gStems = stems(gTokens);
      let sum = 0;
      for (let k = 0; k < qTokens.length; k += 1) sum += tokenScore(qTokens[k], gTokens, gStems);
      // Доля токенов запроса, нашедших опору. Длина цели не влияет: длинное
      // название не должно проигрывать короткому только за многословность.
      const score = Math.round((sum / qTokens.length) * 100) / 100;
      if (score >= FLOOR) {
        scored.push({ id, title: String(goal.title || ''), score, archived: !!goal.archived });
      }
    }
    // Порядок: увереннее → по id. Стабильность обязательна: список не должен
    // перетасовываться между показом и подтверждением.
    scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const capped = scored.slice(0, MAX_CANDIDATES);
    out.strong = capped.filter((c) => c.score >= STRONG);
    out.weak = capped.filter((c) => c.score < STRONG);
    out.ambiguous = out.strong.length === 0;
    return out;
  }

  /** Id, которые можно отметить заранее. Слабые сюда не попадают намеренно. */
  function preselectIds(resolved) {
    if (!resolved || !Array.isArray(resolved.strong)) return [];
    return resolved.strong.map((c) => c.id);
  }

  return Object.freeze({
    VERSION, STRONG, FLOOR, MAX_CANDIDATES, MIN_TOKEN,
    normalize, tokens, stem, resolve, preselectIds,
  });
});
