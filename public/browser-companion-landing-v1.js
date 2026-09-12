(function browserCompanionLanding() {
  'use strict';

  const LANGUAGE_KEY = 'satoru-browser-companion-language';
  const SUPPORTED_LANGUAGES = new Set(['ru', 'en', 'de', 'uk', 'es']);
  const BROWSERS = Object.freeze({
    chrome: { name: 'Chrome', address: 'chrome://extensions', package: 'downloads/satoru-attention-chromium-v260.zip', step: 'step3Chromium' },
    edge: { name: 'Microsoft Edge', address: 'edge://extensions', package: 'downloads/satoru-attention-chromium-v260.zip', step: 'step3Chromium' },
    brave: { name: 'Brave', address: 'brave://extensions', package: 'downloads/satoru-attention-chromium-v260.zip', step: 'step3Chromium' },
    firefox: { name: 'Firefox', address: 'about:debugging#/runtime/this-firefox', package: 'downloads/satoru-attention-firefox-v215.zip', step: 'step3Firefox' },
    opera: { name: 'Opera', address: 'opera://extensions', package: 'downloads/satoru-attention-chromium-v260.zip', step: 'step3Chromium' },
    vivaldi: { name: 'Vivaldi', address: 'vivaldi://extensions', package: 'downloads/satoru-attention-chromium-v260.zip', step: 'step3Chromium' },
    safari: { name: 'Safari', address: 'Safari → Settings → Developer', package: 'downloads/satoru-attention-safari-v215.zip', step: 'step3Safari' },
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

  const connectionCopy = {
    en: { connectTitle: 'Installed? Connect and test', connectLead: 'Use this page in the same browser as the extension. After installing or reloading the extension, reload this page once.', connectRefresh: 'Check connection', connectOptions: 'Set up and test one site', connectPrivacy: 'Only the version, counts, bounded session state and check results reach this page. Site addresses and your reasons stay in the extension.', connection_wait: 'Checking the extension…', connection_missing: 'No response. Install or enable the extension in this browser, then reload this page.', connection_active: 'Connected · configured rules are applied', connection_permission_removed: 'Connected · site access is missing. Restore permission in the browser.', connection_not_configured: 'Connected · add your first site or enable protection', connection_unknown: 'Connected before · current protection is unconfirmed. Refresh or update the extension.', connection_age: 'Last confirmed signal: {seconds} seconds ago · version {version}', connection_no_age: 'This version does not report a fresh protection check. Update the test build.', test_never: 'Next: open settings and test one configured site.', test_pending: 'A real boundary test is in progress. Return after the new tab reaches the boundary.', test_passed: 'Last test: the real boundary appeared for one site.', test_failed: 'Last test: the boundary was not confirmed. Open settings and retry.', test_outdated: 'Rules or version changed. Repeat the boundary test.', signedText: 'Chrome and Brave use the same Chrome Web Store listing after approval. No listing is published here yet. Test ZIPs require manual Reload; owner account details, store assets, review and signed-update checks remain.', benefit3Title: 'Chrome and Brave', benefit3Text: 'The same Chromium extension and Chrome Web Store delivery path. Test each browser separately.' },
    ru: { connectTitle: 'Установил? Подключи и проверь', connectLead: 'Открой эту страницу в том же браузере, где стоит расширение. После его установки или Reload один раз обнови страницу.', connectRefresh: 'Проверить подключение', connectOptions: 'Настроить и проверить один сайт', connectPrivacy: 'Эта страница получает только версию, счётчики, ограниченный статус сессии и результаты проверок. Адреса сайтов и твои причины остаются в расширении.', connection_wait: 'Проверяем расширение…', connection_missing: 'Ответа нет. Установи или включи расширение в этом браузере, затем обнови страницу.', connection_active: 'Подключено · настроенные правила применены', connection_permission_removed: 'Подключено · нет доступа к сайту. Верни разрешение в браузере.', connection_not_configured: 'Подключено · добавь первый сайт или включи защиту', connection_unknown: 'Раньше было подключено · текущая защита не подтверждена. Обнови статус или расширение.', connection_age: 'Последний подтверждённый сигнал: {seconds} сек. назад · версия {version}', connection_no_age: 'Эта версия не передаёт свежую проверку защиты. Обнови тестовую сборку.', test_never: 'Дальше: открой настройки и проверь один настроенный сайт.', test_pending: 'Идёт проверка настоящей границы. Вернись, когда новая вкладка дойдёт до неё.', test_passed: 'Последняя проверка: настоящая граница появилась на одном сайте.', test_failed: 'Последняя проверка: граница не подтверждена. Открой настройки и повтори.', test_outdated: 'Правила или версия изменились. Повтори проверку границы.', signedText: 'Chrome и Brave используют одну публикацию в Chrome Web Store после одобрения. Опубликованной ссылки здесь пока нет. Тестовый ZIP требует Reload; ещё нужны данные владельца, материалы магазина, модерация и проверка подписанного обновления.', benefit3Title: 'Chrome и Brave', benefit3Text: 'Одно Chromium-расширение и доставка через Chrome Web Store. Каждый браузер проверяется отдельно.' },
    de: { connectTitle: 'Installiert? Verbinden und testen', connectLead: 'Öffne diese Seite im Browser mit der Erweiterung. Lade nach Installation oder Reload der Erweiterung diese Seite einmal neu.', connectRefresh: 'Verbindung prüfen', connectOptions: 'Eine Website einrichten und testen', connectPrivacy: 'Diese Seite erhält nur Version, Anzahlen, begrenzten Sitzungsstatus und Prüfergebnisse. Website-Adressen und deine Gründe bleiben in der Erweiterung.', connection_wait: 'Erweiterung wird geprüft…', connection_missing: 'Keine Antwort. Installiere oder aktiviere die Erweiterung in diesem Browser und lade die Seite neu.', connection_active: 'Verbunden · eingerichtete Regeln angewendet', connection_permission_removed: 'Verbunden · Website-Zugriff fehlt. Erlaube ihn wieder im Browser.', connection_not_configured: 'Verbunden · füge eine Website hinzu oder aktiviere den Schutz', connection_unknown: 'Zuvor verbunden · aktueller Schutz unbestätigt. Status oder Erweiterung aktualisieren.', connection_age: 'Letztes bestätigtes Signal: vor {seconds} Sekunden · Version {version}', connection_no_age: 'Diese Version meldet keine aktuelle Schutzprüfung. Aktualisiere die Testversion.', test_never: 'Als Nächstes: Einstellungen öffnen und eine Website testen.', test_pending: 'Eine echte Grenze wird getestet. Kehre zurück, wenn sie im neuen Tab erscheint.', test_passed: 'Letzter Test: Die echte Grenze erschien für eine Website.', test_failed: 'Letzter Test: Grenze unbestätigt. Öffne die Einstellungen und wiederhole den Test.', test_outdated: 'Regeln oder Version geändert. Teste die Grenze erneut.', signedText: 'Chrome und Brave nutzen nach Freigabe denselben Chrome-Web-Store-Eintrag. Hier ist noch kein Eintrag veröffentlicht. Test-ZIPs brauchen Reload; Kontodaten, Store-Material, Prüfung und signierter Update-Test stehen noch aus.', benefit3Title: 'Chrome und Brave', benefit3Text: 'Dieselbe Chromium-Erweiterung und Veröffentlichung im Chrome Web Store. Jeder Browser wird separat getestet.' },
    uk: { connectTitle: 'Установив? Підключи й перевір', connectLead: 'Відкрий цю сторінку в браузері з розширенням. Після встановлення чи Reload розширення один раз онови сторінку.', connectRefresh: 'Перевірити з’єднання', connectOptions: 'Налаштувати й перевірити один сайт', connectPrivacy: 'Сторінка отримує лише версію, кількості, обмежений стан сесії та результати перевірок. Адреси сайтів і твої причини лишаються в розширенні.', connection_wait: 'Перевіряємо розширення…', connection_missing: 'Немає відповіді. Установи або ввімкни розширення в цьому браузері й онови сторінку.', connection_active: 'Підключено · налаштовані правила застосовані', connection_permission_removed: 'Підключено · немає доступу до сайту. Поверни дозвіл у браузері.', connection_not_configured: 'Підключено · додай перший сайт або ввімкни захист', connection_unknown: 'Раніше було підключено · поточний захист не підтверджено. Онови статус або розширення.', connection_age: 'Останній підтверджений сигнал: {seconds} с тому · версія {version}', connection_no_age: 'Ця версія не передає свіжу перевірку захисту. Онови тестову збірку.', test_never: 'Далі: відкрий налаштування й перевір один сайт.', test_pending: 'Триває перевірка справжньої межі. Повернись, коли вона з’явиться в новій вкладці.', test_passed: 'Остання перевірка: справжня межа з’явилася на одному сайті.', test_failed: 'Остання перевірка: межу не підтверджено. Відкрий налаштування й повтори.', test_outdated: 'Правила або версія змінилися. Повтори перевірку межі.', signedText: 'Chrome та Brave використовують одну публікацію в Chrome Web Store після схвалення. Опублікованого посилання тут ще немає. Тестовий ZIP потребує Reload; ще потрібні дані власника, матеріали магазину, модерація й перевірка підписаного оновлення.', benefit3Title: 'Chrome та Brave', benefit3Text: 'Одне Chromium-розширення й доставка через Chrome Web Store. Кожен браузер перевіряється окремо.' },
    es: { connectTitle: '¿Instalado? Conecta y prueba', connectLead: 'Abre esta página en el navegador con la extensión. Después de instalar o recargar la extensión, recarga esta página una vez.', connectRefresh: 'Comprobar conexión', connectOptions: 'Configurar y probar un sitio', connectPrivacy: 'Esta página solo recibe versión, cantidades, estado limitado de sesión y resultados. Las direcciones y tus motivos permanecen en la extensión.', connection_wait: 'Comprobando la extensión…', connection_missing: 'Sin respuesta. Instala o activa la extensión en este navegador y recarga la página.', connection_active: 'Conectado · reglas configuradas aplicadas', connection_permission_removed: 'Conectado · falta acceso al sitio. Restaura el permiso del navegador.', connection_not_configured: 'Conectado · añade un sitio o activa la protección', connection_unknown: 'Conectado antes · protección actual sin confirmar. Actualiza el estado o la extensión.', connection_age: 'Última señal confirmada: hace {seconds} segundos · versión {version}', connection_no_age: 'Esta versión no informa de una comprobación reciente. Actualiza la versión de prueba.', test_never: 'Siguiente: abre los ajustes y prueba un sitio.', test_pending: 'Prueba de límite real en curso. Vuelve cuando aparezca en la nueva pestaña.', test_passed: 'Última prueba: apareció el límite real para un sitio.', test_failed: 'Última prueba: límite sin confirmar. Abre los ajustes y reintenta.', test_outdated: 'Las reglas o la versión cambiaron. Repite la prueba del límite.', signedText: 'Chrome y Brave usarán la misma ficha de Chrome Web Store tras la aprobación. Todavía no hay una ficha publicada aquí. Los ZIP necesitan Recargar; faltan datos del propietario, materiales de tienda, revisión y prueba de actualización firmada.', benefit3Title: 'Chrome y Brave', benefit3Text: 'La misma extensión Chromium y publicación en Chrome Web Store. Cada navegador se prueba por separado.' },
  };
  Object.assign(en, connectionCopy.en);
  for (const lang of ['ru', 'de', 'uk', 'es']) Object.assign(patches[lang], connectionCopy[lang]);
  en.updatesLead = 'After an approved store release, Chrome and Brave can apply updates. No store release is published here yet. Test ZIPs use manual Reload.';
  patches.ru.updatesLead = 'После одобренной публикации Chrome и Brave смогут получать обновления из магазина. Опубликованной версии здесь пока нет. Тестовый ZIP обновляется вручную через Reload.';
  patches.de.updatesLead = 'Nach einer freigegebenen Store-Veröffentlichung können Chrome und Brave Updates erhalten. Hier ist noch keine Store-Version veröffentlicht. Test-ZIPs werden manuell neu geladen.';
  patches.uk.updatesLead = 'Після схваленої публікації Chrome та Brave зможуть отримувати оновлення з магазину. Опублікованої версії тут ще немає. Тестовий ZIP оновлюється вручну через Reload.';
  patches.es.updatesLead = 'Tras aprobarse la publicación, Chrome y Brave podrán recibir actualizaciones de la tienda. Aún no hay una versión publicada aquí. Los ZIP de prueba se recargan manualmente.';

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
  const Status = globalThis.BrowserCompanionStatusV1;
  let lastStatus = null;
  let receivedAt = 0;
  let disconnected = false;
  let pendingStatus = null;
  let pendingOptions = null;
  const openOptions = document.querySelector('#bc-open-options');

  function renderConnection() {
    const view = Status.view(lastStatus, receivedAt);
    const state = pendingStatus ? 'wait' : disconnected ? 'missing' : !lastStatus ? 'missing' : view.state;
    const stateNode = document.querySelector('#bc-connection-state');
    if (stateNode.textContent !== table[`connection_${state}`]) stateNode.textContent = table[`connection_${state}`];
    document.querySelector('#bc-connection-age').textContent = !lastStatus ? '' : view.ageSeconds === null ? table.connection_no_age
      : table.connection_age.replace('{seconds}', view.ageSeconds).replace('{version}', lastStatus.version);
    document.querySelector('#bc-test-state').textContent = table[`test_${lastStatus?.selfTest.state || 'never'}`];
    openOptions.disabled = !lastStatus || disconnected || !!pendingOptions;
  }
  function checkConnection() {
    if (pendingStatus || document.hidden) return;
    const requestId = `status:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    pendingStatus = { requestId, timeout: setTimeout(() => { pendingStatus = null; disconnected = true; renderConnection(); }, 3000) };
    renderConnection();
    window.postMessage({ source: 'satoru-app', type: 'SATORU_ATTENTION_STATUS_REQUEST', requestId }, location.origin);
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'satoru-attention-extension') return;
    const data = event.data;
    if (data.type === 'SATORU_ATTENTION_EXTENSION_READY') { checkConnection(); return; }
    if (data.type === 'SATORU_ATTENTION_STATUS_RESPONSE' && data.requestId === pendingStatus?.requestId) {
      const normalized = Status.normalize(data.status);
      if (!normalized) return;
      clearTimeout(pendingStatus.timeout); pendingStatus = null;
      lastStatus = normalized; receivedAt = Date.now(); disconnected = false; renderConnection();
    }
    if (data.type === 'SATORU_ATTENTION_OPEN_OPTIONS_RESULT' && data.requestId === pendingOptions?.requestId) {
      clearTimeout(pendingOptions.timeout); pendingOptions = null;
      if (!data.ok) say(table.connection_missing);
      renderConnection();
    }
  });
  document.querySelector('#bc-connect-refresh').addEventListener('click', checkConnection);
  openOptions.addEventListener('click', () => {
    if (openOptions.disabled) return;
    const requestId = `options:${Date.now()}`;
    pendingOptions = { requestId, timeout: setTimeout(() => { pendingOptions = null; say(table.connection_missing); renderConnection(); }, 3000) };
    window.postMessage({ source: 'satoru-app', type: 'SATORU_ATTENTION_OPEN_OPTIONS', requestId }, location.origin);
    renderConnection();
  });
  window.addEventListener('focus', checkConnection);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkConnection(); });
  setInterval(() => { if (!document.hidden) renderConnection(); }, 15_000);

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
    renderConnection();
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
  checkConnection();
  if (!requestedBrowser && navigator.brave?.isBrave) navigator.brave.isBrave().then((isBrave) => {
    if (isBrave) selectBrowser('brave', false);
  }).catch(() => {});
})();
