(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrowserCompanionStatusV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_AGE_MS = 90_000;
  const STATES = ['active', 'permission_removed', 'not_configured', 'unknown'];
  const TEST_STATES = ['never', 'pending', 'passed', 'failed', 'outdated'];
  const COPY = {
    ru: { title: 'Контроль сайтов в Chrome и Brave', active: 'Настроенные правила применены', permission_removed: 'Нет доступа к сайту — верни разрешение в браузере', not_configured: 'Добавь первый сайт или включи защиту', unknown: 'Текущая защита не подтверждена', never: 'Настоящая граница ещё не проверена', pending: 'Ждём границу в тестовой вкладке', passed: 'Последняя проверка: граница появилась на одном сайте', failed: 'Граница не подтверждена — открой настройки и повтори', outdated: 'Правила или версия изменились — повтори проверку', freshness: 'Последний сигнал: {seconds} сек. назад', stale: 'Статус устарел — проверь связь', privacy: 'В приложении видны версия, число сайтов, ограниченный статус сессии, состояние правил и время проверок. Адреса сайтов, история и твои причины остаются в расширении.', installedTestCopy: 'Тестовый ZIP для Chrome и Brave готов. Подписанной версии в магазине пока нет; тестовую сборку обновляют вручную.', refresh: 'Проверить связь', setup: 'Настроить и проверить сайт' },
    en: { title: 'Website boundaries in Chrome and Brave', active: 'Configured rules are applied', permission_removed: 'Site access is missing — restore permission in the browser', not_configured: 'Add your first site or enable protection', unknown: 'Current protection is unconfirmed', never: 'The real boundary has not been tested yet', pending: 'Waiting for the boundary in the test tab', passed: 'Last test: the boundary appeared for one site', failed: 'Boundary unconfirmed — open settings and retry', outdated: 'Rules or version changed — repeat the test', freshness: 'Last signal: {seconds} seconds ago', stale: 'Status is stale — check the connection', privacy: 'The app sees version, site counts, bounded session state, rule status and check times. Site addresses, history and your reasons stay in the extension.', installedTestCopy: 'A test ZIP for Chrome and Brave is ready. No signed store release is available yet; test builds update manually.', refresh: 'Check connection', setup: 'Set up and test a site' },
    de: { title: 'Website-Grenzen in Chrome und Brave', active: 'Die eingestellten Regeln sind angewendet', permission_removed: 'Website-Zugriff fehlt — erlaube ihn wieder im Browser', not_configured: 'Füge eine Website hinzu oder aktiviere den Schutz', unknown: 'Aktueller Schutz unbestätigt', never: 'Die echte Grenze wurde noch nicht getestet', pending: 'Warten auf die Grenze im Test-Tab', passed: 'Letzter Test: Die Grenze erschien für eine Website', failed: 'Grenze unbestätigt — Einstellungen öffnen und erneut testen', outdated: 'Regeln oder Version geändert — Test wiederholen', freshness: 'Letztes Signal: vor {seconds} Sekunden', stale: 'Status veraltet — Verbindung prüfen', privacy: 'Die App sieht Version, Website-Anzahl, begrenzten Sitzungsstatus, Regelstatus und Prüfzeiten. Website-Adressen, Verlauf und deine Gründe bleiben in der Erweiterung.', installedTestCopy: 'Ein Test-ZIP für Chrome und Brave ist bereit. Es gibt noch keine signierte Store-Version; Testversionen werden manuell aktualisiert.', refresh: 'Verbindung prüfen', setup: 'Website einrichten und testen' },
    uk: { title: 'Контроль сайтів у Chrome та Brave', active: 'Налаштовані правила застосовані', permission_removed: 'Немає доступу до сайту — поверни дозвіл у браузері', not_configured: 'Додай перший сайт або ввімкни захист', unknown: 'Поточний захист не підтверджено', never: 'Справжню межу ще не перевірено', pending: 'Чекаємо межу в тестовій вкладці', passed: 'Остання перевірка: межа з’явилася на одному сайті', failed: 'Межу не підтверджено — відкрий налаштування й повтори', outdated: 'Правила або версія змінилися — повтори перевірку', freshness: 'Останній сигнал: {seconds} с тому', stale: 'Статус застарів — перевір зв’язок', privacy: 'Застосунок бачить версію, кількості сайтів, обмежений стан сесії, стан правил і час перевірок. Адреси сайтів, історія й твої причини лишаються в розширенні.', installedTestCopy: 'Тестовий ZIP для Chrome та Brave готовий. Підписаної версії в магазині ще немає; тестову збірку оновлюють вручну.', refresh: 'Перевірити зв’язок', setup: 'Налаштувати й перевірити сайт' },
    es: { title: 'Límites de sitios en Chrome y Brave', active: 'Las reglas configuradas están aplicadas', permission_removed: 'Falta acceso al sitio — restaura el permiso del navegador', not_configured: 'Añade un sitio o activa la protección', unknown: 'Protección actual sin confirmar', never: 'Aún no se ha probado el límite real', pending: 'Esperando el límite en la pestaña de prueba', passed: 'Última prueba: apareció el límite para un sitio', failed: 'Límite sin confirmar — abre los ajustes y reintenta', outdated: 'Las reglas o la versión cambiaron — repite la prueba', freshness: 'Última señal: hace {seconds} segundos', stale: 'Estado desactualizado — comprueba la conexión', privacy: 'La app ve versión, cantidades de sitios, estado limitado de sesión, estado de reglas y horas de comprobación. Las direcciones, el historial y tus motivos permanecen en la extensión.', installedTestCopy: 'El ZIP de prueba para Chrome y Brave está listo. Aún no hay una versión firmada en la tienda; las pruebas se actualizan manualmente.', refresh: 'Comprobar conexión', setup: 'Configurar y probar un sitio' },
  };
  function text(key, language = 'en', values = {}) {
    const table = COPY[String(language).toLowerCase().split(/[-_]/)[0]] || COPY.en;
    return Object.entries(values).reduce((copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)), table[key] || COPY.en[key] || key);
  }
  const count = value => Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
  function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
  function normalize(raw) {
    if (!raw || raw.installed !== true || typeof raw.version !== 'string' || raw.version.length > 32 || !/^\d+(\.\d+){1,3}$/.test(raw.version)) return null;
    const enforcement = raw.enforcement || {};
    const test = raw.selfTest || {};
    const active = raw.active && ['active', 'boundary'].includes(raw.active.phase) ? {
      app: ['tiktok', 'youtube', 'instagram', 'x', 'reddit', 'web'].includes(raw.active.app) ? raw.active.app : 'web',
      phase: raw.active.phase, remainingSeconds: Math.max(0, Math.min(86400, Math.floor(Number(raw.active.remainingSeconds) || 0))),
      mode: ['trust', 'adaptive', 'control'].includes(raw.active.mode) ? raw.active.mode : 'trust',
    } : null;
    return { installed: true, version: String(raw.version).slice(0, 32), configuredSites: count(raw.configuredSites), active,
      checkedAt: timestamp(raw.checkedAt),
      enforcement: { state: STATES.includes(enforcement.state) ? enforcement.state : 'unknown', enabledSites: count(enforcement.enabledSites), permittedSites: count(enforcement.permittedSites), protectionEnabled: enforcement.protectionEnabled === true },
      selfTest: { state: TEST_STATES.includes(test.state) ? test.state : 'never', checkedAt: timestamp(test.checkedAt) } };
  }
  function view(status, receivedAt, now = Date.now()) {
    const safe = normalize(status);
    const signalAt = safe?.checkedAt ? Date.parse(safe.checkedAt) : NaN;
    const elapsed = now - receivedAt;
    const ageMs = now - signalAt;
    const fresh = !!safe && Number.isFinite(receivedAt) && elapsed >= 0 && elapsed <= MAX_AGE_MS && Number.isFinite(ageMs) && ageMs >= -5000 && ageMs <= MAX_AGE_MS;
    return { state: fresh ? safe.enforcement.state : 'unknown', fresh, ageSeconds: safe && Number.isFinite(signalAt) ? Math.max(0, Math.floor(ageMs / 1000)) : null };
  }
  return Object.freeze({ MAX_AGE_MS, normalize, view, text });
});
