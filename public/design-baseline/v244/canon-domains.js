(function exposeCanonDomains(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SatoruCanonDomains = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCanonDomains() {
  'use strict';

  function normalizeCanonName(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
  }

  // Order matters: the first matching domain wins. Keep the patterns explicit
  // enough that a short substring cannot silently steal another domain.
  // In particular, never use "мыш": it matches "мышление" as well as muscles.
  const CANON_DOMAINS = [
    { id: 'body',      name: 'Тело / Здоровье',        icon: '💪', re: /тел[оауые]|здоров|спорт|фитнес|трениров|качал|штанг|жим|мышц|мускул|бег|кардио|вынослив|сил[аеуыо]|питани|нутриц|диет|йог|растяжк|дзюдо|единобор|бокс|плаван|вело|run|gym|workout|health|fitness/ },
    { id: 'relations', name: 'Отношения',              icon: '❤️', re: /отношен|семь|семей|друз|любов|партн[её]р|социал|общени|свидан|родител|дет[иямь]|близк|relationship|family|friends|social/ },
    { id: 'money',     name: 'Деньги / Ресурсы',       icon: '💰', re: /деньг|финанс|бюджет|инвест|капитал|доход|заработ|сбереж|ресурс|money|finance|budget/ },
    { id: 'work',      name: 'Дело / Карьера',         icon: '💼', re: /дел[оауе]|карьер|работ|бизнес|профес|стартап|предприн|job|career|work|business/ },
    { id: 'growth',    name: 'Развитие / Знания',      icon: '📚', re: /развит|знани|уч[её]б|образован|чтени|книг|язык|англ|немец|deutsch|наук|школ|универ|интеллект|мышл|саморазв|программ|код|алгоритм|study|learn|skill/ },
    { id: 'spirit',    name: 'Дух / Смысл',            icon: '🧘', re: /дух|смысл|медит|вер[аыуе]|осознан|психо|ментал|философ|молитв|религ|дзен|дзэн|mindful|spirit/ },
    { id: 'create',    name: 'Творчество / Созидание', icon: '🎨', re: /творч|созид|искусств|музык|рисов|арт|дизайн|видео|блог|пиш|писательств|креат|фото|танц|вокал|косплей|каллиграф|create|craft|art|music/ },
    { id: 'rest',      name: 'Отдых / Восстановление', icon: '🌿', re: /отдых|восстанов|релакс|досуг|перезагруз|выгоран|сон|спат|дрем|пауза|отпуск|recover|rest|sleep|nap|chill|leisure/ },
    { id: 'home',      name: 'Быт / Среда',            icon: '🏠', re: /быт|дом[аоуе]|порядок|уборк|хозяйств|организац|среда|home|chores|household/ },
    { id: 'play',      name: 'Игра / Приключения',     icon: '🎲', re: /игр[аыуо]|приключ|путешеств|хобби|развлеч|adventure|travel|game|fun/ },
  ];

  function canonById(id) {
    return CANON_DOMAINS.find((domain) => domain.id === id) || null;
  }

  function autoCanon(name) {
    const normalized = normalizeCanonName(name);
    const domain = CANON_DOMAINS.find((candidate) => candidate.re.test(normalized));
    return domain ? domain.id : null;
  }

  function canonOf(sphere) {
    if (sphere && sphere.canon && canonById(sphere.canon)) return sphere.canon;
    return autoCanon((sphere && sphere.name) || '');
  }

  return Object.freeze({ CANON_DOMAINS, normalizeCanonName, canonById, autoCanon, canonOf });
});
