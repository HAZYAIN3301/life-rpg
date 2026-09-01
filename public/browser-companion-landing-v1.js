(function browserCompanionLanding() {
  'use strict';

  const LANGUAGE_KEY = 'satoru-browser-companion-language';
  const SUPPORTED_LANGUAGES = new Set(['ru', 'en', 'de', 'uk', 'es']);
  const BROWSERS = Object.freeze({
    chrome: { name: 'Chrome', address: 'chrome://extensions', package: 'downloads/satoru-attention-chromium-v212.zip', step: 'step3Chromium' },
    edge: { name: 'Microsoft Edge', address: 'edge://extensions', package: 'downloads/satoru-attention-chromium-v212.zip', step: 'step3Chromium' },
    brave: { name: 'Brave', address: 'brave://extensions', package: 'downloads/satoru-attention-chromium-v212.zip', step: 'step3Chromium' },
    firefox: { name: 'Firefox', address: 'about:debugging#/runtime/this-firefox', package: 'downloads/satoru-attention-firefox-v212.zip', step: 'step3Firefox' },
    opera: { name: 'Opera', address: 'opera://extensions', package: 'downloads/satoru-attention-chromium-v212.zip', step: 'step3Chromium' },
    vivaldi: { name: 'Vivaldi', address: 'vivaldi://extensions', package: 'downloads/satoru-attention-chromium-v212.zip', step: 'step3Chromium' },
    safari: { name: 'Safari', address: 'Safari → Settings → Developer', package: 'downloads/satoru-attention-safari-v212.zip', step: 'step3Safari' },
  });

  const en = {
    pageTitle: 'Satoru Attention — browser extension', pageDescription: 'Satoru Attention — a local attention boundary for the most popular desktop browsers.', language: 'Language', back: 'Back to the app', kicker: 'Extension for major desktop browsers', title: 'The feed starts only after your decision', lead: 'Name a purpose and short window or locally block distracting services and categories. Browsing history is never sent anywhere.', download: 'Download the test build', chooseBrowser: 'Choose a browser', updatesTitle: 'Updates without downloading again.', updatesLead: 'After the signed store release, install once: Chrome, Edge, Firefox and Safari apply future versions automatically. Until review is complete, test ZIPs still use Reload.', benefit1Title: 'Before entry, not after a lapse', benefit1Text: 'TikTok, YouTube and selected sites first show a purpose and time-limit screen.', benefit2Title: 'Local', benefit2Text: 'Rules, sessions and outcomes stay in the extension. Satoru sees only a safe status.', benefit3Title: 'One source, three engines', benefit3Text: 'Separate Chromium, Firefox and Safari manifests are built from one audited codebase.', browserKicker: 'Desktop browser support', browserTitle: 'Choose where Satoru should work', browserLead: 'The page detects your browser, but you can choose another one. Chromium browsers share one build; Firefox and Safari receive their own manifests.', chromiumBuild: 'Chromium build', firefoxBuild: 'Firefox MV3 build', safariBuild: 'Safari Web Extension build', showSteps: 'Show steps', testKicker: 'Test installation before store publication', installTitle: 'Install in', step1Title: 'Download and unzip', step1Text: 'The archive contains a ready extension folder.', downloadPackage: 'Download package', step2Title: 'Open the extensions page', step2Text: 'Paste this address into the browser bar.', copy: 'Copy', step3Title: 'Load the folder', step3Chromium: 'Enable Developer mode, choose Load unpacked and select the unzipped Satoru Attention folder.', step3Firefox: 'Unzip the package, choose Load Temporary Add-on and select its manifest.json. A signed AMO release will install permanently and auto-update.', step3Safari: 'On macOS, choose Add Temporary Extension and select the unzipped folder. The App Store build will install permanently on macOS, iPhone and iPad.', signedTitle: 'Why the test build still needs Reload', signedText: 'Consumer browsers only auto-update signed store installations. The packages above are ready for review; store accounts and signatures are the remaining publication step.', limitTitle: 'An honest boundary', limitText: 'Protection applies to this browser. It can be disabled or removed; it does not replace system DNS/VPN or control native phone apps.', openApp: 'Open Satoru', copied: 'Address copied', copyFailed: 'Copy the address manually', selected: 'Selected',
  };
  const patches = {
    ru: {
      pageTitle: 'Satoru Attention — расширение для браузера', pageDescription: 'Satoru Attention — локальная граница внимания для популярных настольных браузеров.', language: 'Язык', back: 'Вернуться в приложение', kicker: 'Расширение для популярных браузеров', title: 'Лента начинается только после твоего решения', lead: 'Назови цель и короткое окно или включи локальную блокировку сервисов и категорий. История просмотров никуда не отправляется.', download: 'Скачать тестовую сборку', chooseBrowser: 'Выбрать браузер', updatesTitle: 'Обновления без повторного скачивания.', updatesLead: 'После публикации подписанной версии установи её один раз: Chrome, Edge, Firefox и Safari будут применять следующие версии автоматически. До завершения модерации тестовый ZIP обновляется кнопкой Reload.', benefit1Title: 'До входа, не после срыва', benefit1Text: 'TikTok, YouTube и выбранные сайты сначала показывают экран цели и лимита.', benefit2Title: 'Локально', benefit2Text: 'Правила, сессии и исходы остаются в расширении. Satoru видит только безопасный статус.', benefit3Title: 'Один исходник, три движка', benefit3Text: 'Отдельные manifest-файлы Chromium, Firefox и Safari собираются из одной проверяемой кодовой базы.', browserKicker: 'Поддержка настольных браузеров', browserTitle: 'Выбери, где должен работать Satoru', browserLead: 'Сайт определяет браузер автоматически, но можно выбрать другой. Chromium-браузеры используют одну сборку; Firefox и Safari получают свои manifest-файлы.', chromiumBuild: 'Сборка Chromium', firefoxBuild: 'Сборка Firefox MV3', safariBuild: 'Сборка Safari Web Extension', showSteps: 'Показать шаги', testKicker: 'Тестовая установка до публикации в магазине', installTitle: 'Установка в', step1Title: 'Скачай и распакуй', step1Text: 'В архиве находится готовая папка расширения.', downloadPackage: 'Скачать пакет', step2Title: 'Открой страницу расширений', step2Text: 'Вставь этот адрес в строку браузера.', copy: 'Скопировать', step3Title: 'Загрузи папку', step3Chromium: 'Включи «Режим разработчика», нажми «Загрузить распакованное» и выбери распакованную папку Satoru Attention.', step3Firefox: 'Распакуй архив, нажми «Загрузить временное дополнение» и выбери manifest.json. Подписанная версия AMO установится постоянно и будет обновляться автоматически.', step3Safari: 'На macOS выбери Add Temporary Extension и укажи распакованную папку. Версия из App Store установится постоянно на macOS, iPhone и iPad.', signedTitle: 'Почему тестовой сборке всё ещё нужен Reload', signedText: 'Обычные браузеры автообновляют только подписанные установки из магазина. Пакеты готовы к модерации; остались аккаунты магазинов и подписи.', limitTitle: 'Честная граница', limitText: 'Защита действует в этом браузере. Её можно выключить или удалить; она не заменяет системный DNS/VPN и не контролирует нативные приложения.', openApp: 'Открыть Satoru', copied: 'Адрес скопирован', copyFailed: 'Скопируй адрес вручную', selected: 'Выбрано',
    },
    de: {
      pageTitle: 'Satoru Attention — Browser-Erweiterung', pageDescription: 'Satoru Attention — eine lokale Aufmerksamkeitsgrenze für verbreitete Desktop-Browser.', language: 'Sprache', back: 'Zurück zur App', kicker: 'Erweiterung für verbreitete Desktop-Browser', title: 'Der Feed beginnt erst nach deiner Entscheidung', lead: 'Nenne einen Zweck und ein kurzes Zeitfenster oder blockiere störende Dienste und Kategorien lokal. Der Browserverlauf wird nicht gesendet.', download: 'Testversion herunterladen', chooseBrowser: 'Browser wählen', updatesTitle: 'Updates ohne erneuten Download.', updatesLead: 'Nach der signierten Store-Veröffentlichung reicht eine Installation: Chrome, Edge, Firefox und Safari aktualisieren automatisch. Bis zur Freigabe braucht das Test-ZIP weiterhin „Neu laden“.', benefit1Title: 'Vor dem Öffnen, nicht nach dem Abrutschen', benefit1Text: 'TikTok, YouTube und ausgewählte Websites zeigen zuerst Zweck und Zeitlimit.', benefit2Title: 'Lokal', benefit2Text: 'Regeln, Sitzungen und Ergebnisse bleiben in der Erweiterung. Satoru sieht nur einen sicheren Status.', benefit3Title: 'Eine Quelle, drei Engines', benefit3Text: 'Separate Manifeste für Chromium, Firefox und Safari entstehen aus derselben geprüften Codebasis.', browserKicker: 'Desktop-Browser-Unterstützung', browserTitle: 'Wähle, wo Satoru arbeiten soll', browserLead: 'Die Seite erkennt deinen Browser, du kannst aber einen anderen wählen. Chromium-Browser teilen eine Version; Firefox und Safari erhalten eigene Manifeste.', chromiumBuild: 'Chromium-Version', firefoxBuild: 'Firefox-MV3-Version', safariBuild: 'Safari-Web-Extension-Version', showSteps: 'Schritte zeigen', testKicker: 'Testinstallation vor der Store-Veröffentlichung', installTitle: 'Installation in', step1Title: 'Herunterladen und entpacken', step1Text: 'Das Archiv enthält einen fertigen Erweiterungsordner.', downloadPackage: 'Paket herunterladen', step2Title: 'Erweiterungsseite öffnen', step2Text: 'Füge diese Adresse in die Browserleiste ein.', copy: 'Kopieren', step3Title: 'Ordner laden', step3Chromium: 'Aktiviere den Entwicklermodus, wähle „Entpackte Erweiterung laden“ und öffne den Satoru-Attention-Ordner.', step3Firefox: 'Entpacke das Paket, wähle „Temporäres Add-on laden“ und öffne manifest.json. Die signierte AMO-Version bleibt installiert und aktualisiert sich automatisch.', step3Safari: 'Wähle auf macOS „Add Temporary Extension“ und den entpackten Ordner. Die App-Store-Version bleibt auf macOS, iPhone und iPad installiert.', signedTitle: 'Warum die Testversion noch „Neu laden“ braucht', signedText: 'Browser aktualisieren für normale Nutzer nur signierte Store-Installationen automatisch. Die Pakete sind prüfbereit; Store-Konten und Signaturen fehlen noch.', limitTitle: 'Eine ehrliche Grenze', limitText: 'Der Schutz gilt für diesen Browser. Er ersetzt weder System-DNS/VPN noch native Apps und kann deaktiviert oder entfernt werden.', openApp: 'Satoru öffnen', copied: 'Adresse kopiert', copyFailed: 'Adresse manuell kopieren', selected: 'Ausgewählt',
    },
    uk: {
      pageTitle: 'Satoru Attention — розширення для браузера', pageDescription: 'Satoru Attention — локальна межа уваги для популярних настільних браузерів.', language: 'Мова', back: 'Повернутися в застосунок', kicker: 'Розширення для популярних браузерів', title: 'Стрічка починається лише після твого рішення', lead: 'Назви мету й коротке вікно або локально заблокуй сервіси та категорії. Історія переглядів нікуди не надсилається.', download: 'Завантажити тестову збірку', chooseBrowser: 'Обрати браузер', updatesTitle: 'Оновлення без повторного завантаження.', updatesLead: 'Після виходу підписаної версії встанови її один раз: Chrome, Edge, Firefox і Safari оновлюватимуться автоматично. До завершення перевірки тестовий ZIP потребує Reload.', benefit1Title: 'До входу, а не після зриву', benefit1Text: 'TikTok, YouTube та вибрані сайти спочатку показують мету й ліміт.', benefit2Title: 'Локально', benefit2Text: 'Правила, сесії й результати залишаються в розширенні. Satoru бачить лише безпечний статус.', benefit3Title: 'Одне джерело, три рушії', benefit3Text: 'Окремі маніфести Chromium, Firefox і Safari збираються з однієї перевіреної кодової бази.', browserKicker: 'Підтримка настільних браузерів', browserTitle: 'Обери, де має працювати Satoru', browserLead: 'Сайт визначає браузер, але можна обрати інший. Chromium-браузери мають спільну збірку; Firefox і Safari — власні маніфести.', chromiumBuild: 'Збірка Chromium', firefoxBuild: 'Збірка Firefox MV3', safariBuild: 'Збірка Safari Web Extension', showSteps: 'Показати кроки', testKicker: 'Тестове встановлення до публікації', installTitle: 'Установлення в', step1Title: 'Завантаж і розпакуй', step1Text: 'В архіві є готова папка розширення.', downloadPackage: 'Завантажити пакет', step2Title: 'Відкрий сторінку розширень', step2Text: 'Встав цю адресу в рядок браузера.', copy: 'Скопіювати', step3Title: 'Завантаж папку', step3Chromium: 'Увімкни режим розробника, натисни «Завантажити розпаковане» й обери папку Satoru Attention.', step3Firefox: 'Розпакуй пакет, обери «Завантажити тимчасовий додаток» і відкрий manifest.json. Підписана AMO-версія встановиться назавжди й оновлюватиметься автоматично.', step3Safari: 'На macOS обери Add Temporary Extension і розпаковану папку. Версія App Store постійно працюватиме на macOS, iPhone та iPad.', signedTitle: 'Чому тестовій збірці ще потрібен Reload', signedText: 'Браузери автоматично оновлюють лише підписані версії з магазинів. Пакети готові до перевірки; лишилися акаунти магазинів і підписи.', limitTitle: 'Чесна межа', limitText: 'Захист діє в цьому браузері. Його можна вимкнути або видалити; він не замінює системний DNS/VPN і не контролює нативні застосунки.', openApp: 'Відкрити Satoru', copied: 'Адресу скопійовано', copyFailed: 'Скопіюй адресу вручну', selected: 'Обрано',
    },
    es: {
      pageTitle: 'Satoru Attention — extensión del navegador', pageDescription: 'Satoru Attention: un límite local de atención para los navegadores de escritorio más populares.', language: 'Idioma', back: 'Volver a la aplicación', kicker: 'Extensión para los principales navegadores', title: 'El feed empieza solo después de tu decisión', lead: 'Indica un propósito y una ventana breve o bloquea servicios y categorías localmente. El historial no se envía.', download: 'Descargar versión de prueba', chooseBrowser: 'Elegir navegador', updatesTitle: 'Actualizaciones sin volver a descargar.', updatesLead: 'Tras publicar la versión firmada, basta instalar una vez: Chrome, Edge, Firefox y Safari se actualizan automáticamente. Hasta terminar la revisión, el ZIP de prueba aún necesita Recargar.', benefit1Title: 'Antes de entrar, no después de caer', benefit1Text: 'TikTok, YouTube y los sitios elegidos muestran primero el propósito y el límite.', benefit2Title: 'Local', benefit2Text: 'Las reglas, sesiones y resultados permanecen en la extensión. Satoru solo ve un estado seguro.', benefit3Title: 'Una fuente, tres motores', benefit3Text: 'Los manifiestos separados de Chromium, Firefox y Safari se crean desde una base de código auditada.', browserKicker: 'Compatibilidad con navegadores de escritorio', browserTitle: 'Elige dónde debe funcionar Satoru', browserLead: 'La página detecta el navegador, pero puedes elegir otro. Los navegadores Chromium comparten versión; Firefox y Safari tienen manifiestos propios.', chromiumBuild: 'Versión Chromium', firefoxBuild: 'Versión Firefox MV3', safariBuild: 'Versión Safari Web Extension', showSteps: 'Ver pasos', testKicker: 'Instalación de prueba antes de publicar', installTitle: 'Instalar en', step1Title: 'Descarga y descomprime', step1Text: 'El archivo contiene una carpeta de extensión lista.', downloadPackage: 'Descargar paquete', step2Title: 'Abre la página de extensiones', step2Text: 'Pega esta dirección en la barra del navegador.', copy: 'Copiar', step3Title: 'Carga la carpeta', step3Chromium: 'Activa Modo desarrollador, elige Cargar descomprimida y selecciona la carpeta Satoru Attention.', step3Firefox: 'Descomprime el paquete, elige Cargar complemento temporal y abre manifest.json. La versión firmada de AMO quedará instalada y se actualizará sola.', step3Safari: 'En macOS, elige Add Temporary Extension y la carpeta. La versión de App Store quedará instalada en macOS, iPhone y iPad.', signedTitle: 'Por qué la prueba aún necesita Recargar', signedText: 'Los navegadores solo actualizan automáticamente instalaciones firmadas de tiendas. Los paquetes están listos; faltan las cuentas de tienda y las firmas.', limitTitle: 'Un límite honesto', limitText: 'La protección se aplica a este navegador. Puede desactivarse; no sustituye DNS/VPN del sistema ni controla apps nativas.', openApp: 'Abrir Satoru', copied: 'Dirección copiada', copyFailed: 'Copia la dirección manualmente', selected: 'Elegido',
    },
  };

  const params = new URLSearchParams(location.search);
  const normalizedLanguage = (value) => {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGUAGES.has(code) ? code : 'en';
  };
  const queryLanguage = params.get('lang');
  let storedLanguage = '';
  try { storedLanguage = localStorage.getItem(LANGUAGE_KEY) || ''; } catch { /* Private mode may deny storage. */ }
  let language = normalizedLanguage(queryLanguage || storedLanguage || navigator.language);
  let table = language === 'en' ? en : { ...en, ...(patches[language] || {}) };

  function detectBrowser() {
    const ua = navigator.userAgent || '';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\//.test(ua)) return 'opera';
    if (/Vivaldi\//.test(ua)) return 'vivaldi';
    if (/Safari\//.test(ua) && !/(Chrome|Chromium|CriOS)\//.test(ua)) return 'safari';
    return 'chrome';
  }

  const requestedBrowser = params.get('browser');
  let selectedBrowser = Object.prototype.hasOwnProperty.call(BROWSERS, requestedBrowser) ? requestedBrowser : detectBrowser();
  const languageSelect = document.querySelector('#bc-language');
  const toast = document.querySelector('#bc-toast');
  let timer;

  function say(message) {
    clearTimeout(timer);
    toast.textContent = message;
    toast.classList.add('on');
    timer = setTimeout(() => toast.classList.remove('on'), 1800);
  }

  function rememberQuery() {
    const next = new URL(location.href);
    next.searchParams.set('lang', language);
    next.searchParams.set('browser', selectedBrowser);
    history.replaceState(null, '', next);
  }

  function applyLanguage() {
    table = language === 'en' ? en : { ...en, ...(patches[language] || {}) };
    document.documentElement.lang = language;
    document.title = table.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', table.pageDescription);
    document.querySelectorAll('[data-copy]').forEach((node) => {
      const copy = table[node.dataset.copy];
      if (copy) node.textContent = copy;
    });
    languageSelect.value = language;
    selectBrowser(selectedBrowser, false);
  }

  function selectBrowser(browser, scroll = true) {
    if (!Object.prototype.hasOwnProperty.call(BROWSERS, browser)) return;
    selectedBrowser = browser;
    const config = BROWSERS[browser];
    document.querySelector('#bc-browser-name').textContent = config.name;
    document.querySelector('#bc-extension-address').textContent = config.address;
    document.querySelector('#bc-load-copy').textContent = table[config.step];
    for (const selector of ['#bc-package-download', '#bc-primary-download']) document.querySelector(selector).href = config.package;
    document.querySelectorAll('[data-browser]').forEach((card) => {
      const active = card.dataset.browser === browser;
      card.classList.toggle('is-current', active);
      if (active) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
    });
    rememberQuery();
    if (scroll) document.querySelector('#install').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  languageSelect.addEventListener('change', () => {
    language = normalizedLanguage(languageSelect.value);
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Query parameter still persists the choice. */ }
    applyLanguage();
  });
  document.addEventListener('click', async (event) => {
    const browserButton = event.target.closest('[data-select-browser]');
    if (browserButton) { selectBrowser(browserButton.dataset.selectBrowser); return; }
    if (!event.target.closest('#bc-copy-address')) return;
    const address = BROWSERS[selectedBrowser].address;
    try { await navigator.clipboard.writeText(address); say(table.copied); }
    catch { say(`${table.copyFailed}: ${address}`); }
  });

  applyLanguage();
  if (!requestedBrowser && navigator.brave?.isBrave) navigator.brave.isBrave().then((isBrave) => {
    if (isBrave) selectBrowser('brave', false);
  }).catch(() => {});
})();
