(function () {
  'use strict';
  const copy = {
  "en": {
    "title": "Privacy in Satoru Attention",
    "language": "Language",
    "back": "Installation",
    "date": "Updated 13 September 2026 · Extension 0.7.0",
    "lead": "Satoru Attention applies the website boundaries and optional content filters you choose in your browser. This notice covers the extension; the Satoru account website has separate data flows.",
    "localTitle": "What stays in your browser",
    "local": "Local extension storage holds your rules, configured hostnames, entry scenarios, daily budgets, cooldowns, pending changes, emergency-access budget, active session and up to 100 minimal session outcomes. An active session can contain the task detail, topic and expected outcome you enter. Emergency reasons are checked when used and are not saved as free text.",
    "addressesTitle": "How website addresses are used",
    "addresses": "The extension processes permitted addresses to apply a boundary or content rule. It can briefly keep an attempted address in memory to return you to the same page. It does not save a browsing-history log or read your browser history database, cookies, page titles, watched items or account credentials.",
    "bridgeTitle": "What the Satoru page can see",
    "bridge": "On the exact Satoru production website, a local content script exposes the extension version, enabled/permitted site counts, limited session status (service category, phase, mode and time remaining), rule-application status and the latest boundary-test state and time. Site addresses, rules, task details, topics, purposes, outcomes and browsing history are not sent through this connection.",
    "bridgeAction": "The page can open extension settings. It cannot change rules, start sessions or tests, or change your Satoru account through this connection.",
    "testTitle": "When you test a boundary",
    "test": "A test you start opens one configured site's homepage in a new tab. If blocking fails, the site can load and receive the normal browser request. One local test record keeps the result, times, extension version, rule fingerprint and test-tab ID. Changing the rules or version invalidates the old result. The Satoru page receives only the bounded test state and time.",
    "permissionsTitle": "Permissions and removal",
    "permissions": "Installation grants access only to Satoru's exact production origin. Adding a website asks for that hostname over HTTP/HTTPS. Turning on optional category protection separately requests all-site HTTP/HTTPS access so local filtering can work. You can remove permissions, disable or uninstall the extension in your browser.",
    "removal": "Uninstalling removes local extension storage. Any separate browser or profile backups are managed by your browser. There is no extension cloud sync, analytics, remote executable code or separate network upload endpoint.",
    "useTitle": "How the data is used",
    "use": "Data is used for the chosen browser boundaries and their status. Extension data is not sold or used for advertising, credit decisions or unrelated profiling.",
    "supportTitle": "Project and support",
    "supportText": "Satoru Attention is maintained in the public HAZYAIN3301/life-rpg project. You can report a technical problem there. GitHub issues are public: do not include passwords, account archives or private browsing details.",
    "support": "Open project support"
  },
  "ru": {
    "title": "Конфиденциальность в Satoru Attention",
    "language": "Язык",
    "back": "Установка",
    "date": "Обновлено 13 сентября 2026 · Расширение 0.7.0",
    "lead": "Satoru Attention применяет выбранные тобой границы сайтов и необязательные фильтры в браузере. Этот текст описывает расширение; у сайта с аккаунтом Satoru отдельные потоки данных.",
    "localTitle": "Что остаётся в браузере",
    "local": "Локальное хранилище расширения содержит правила, выбранные имена сайтов, сценарии входа, дневные бюджеты, паузы, отложенные изменения, бюджет аварийного доступа, текущую сессию и до 100 минимальных итогов сессий. В текущей сессии могут быть введённые тобой детали задачи, тема и ожидаемый результат. Причины аварийного доступа проверяются в момент действия и не сохраняются свободным текстом.",
    "addressesTitle": "Как используются адреса сайтов",
    "addresses": "Расширение обрабатывает разрешённые адреса для применения границы или фильтра. Адрес попытки входа может ненадолго оставаться в памяти, чтобы вернуть тебя на ту же страницу. Журнал посещений не сохраняется; расширение не читает базу истории браузера, cookie, названия страниц, просмотренные материалы и данные входа в аккаунты.",
    "bridgeTitle": "Что видит страница Satoru",
    "bridge": "На точном production-сайте Satoru локальный скрипт передаёт версию расширения, число включённых сайтов и разрешений, ограниченный статус сессии (категорию сервиса, фазу, режим и оставшееся время), состояние применения правил и результат/время последней проверки границы. Адреса сайтов, правила, детали задач, темы, цели, итоги и история просмотров через это соединение не передаются.",
    "bridgeAction": "Страница может открыть настройки расширения. Через это соединение она не может менять правила, начинать сессии или проверки либо изменять аккаунт Satoru.",
    "testTitle": "Что происходит при проверке границы",
    "test": "Запущенная тобой проверка открывает главную страницу одного выбранного сайта в новой вкладке. Если блокировка не сработает, сайт может загрузиться и получить обычный запрос браузера. Одна локальная запись хранит результат, время, версию расширения, отпечаток правил и ID тестовой вкладки. Смена правил или версии делает прежний результат неактуальным. Страница Satoru получает только ограниченный статус проверки и время.",
    "permissionsTitle": "Разрешения и удаление",
    "permissions": "При установке доступ предоставляется только к точному production-адресу Satoru. Добавление сайта запрашивает доступ к этому имени по HTTP/HTTPS. Включение необязательной защиты по категориям отдельно запрашивает HTTP/HTTPS-доступ ко всем сайтам для локальной фильтрации. В браузере можно отозвать разрешения, отключить или удалить расширение.",
    "removal": "Удаление расширения удаляет его локальное хранилище. Отдельными резервными копиями браузера или профиля управляет браузер. У расширения нет облачной синхронизации, аналитики, удалённого исполняемого кода и отдельного сетевого адреса загрузки данных.",
    "useTitle": "Для чего нужны данные",
    "use": "Данные используются для выбранных границ в браузере и показа их состояния. Данные расширения не продаются и не используются для рекламы, кредитных решений или постороннего профилирования.",
    "supportTitle": "Проект и поддержка",
    "supportText": "Satoru Attention развивается в публичном проекте HAZYAIN3301/life-rpg. Там можно сообщить о технической проблеме. Обращения GitHub публичны: не добавляй пароли, архив аккаунта и личные подробности просмотров.",
    "support": "Открыть поддержку проекта"
  },
  "de": {
    "title": "Datenschutz in Satoru Attention",
    "language": "Sprache",
    "back": "Installation",
    "date": "Aktualisiert am 13. September 2026 · Erweiterung 0.7.0",
    "lead": "Satoru Attention setzt die von dir gewählten Website-Grenzen und optionalen Inhaltsfilter im Browser um. Dieser Hinweis beschreibt die Erweiterung; die Satoru-Kontowebsite hat eigene Datenflüsse.",
    "localTitle": "Was in deinem Browser bleibt",
    "local": "Der lokale Erweiterungsspeicher enthält Regeln, eingerichtete Hostnamen, Eintrittsszenarien, Tagesbudgets, Pausen, vorgemerkte Änderungen, das Notfallzugangsbudget, die aktive Sitzung und bis zu 100 minimale Sitzungsergebnisse. Eine aktive Sitzung kann deine eingegebenen Aufgabendetails, Themen und erwarteten Ergebnisse enthalten. Notfallgründe werden bei der Aktion geprüft und nicht als Freitext gespeichert.",
    "addressesTitle": "Wie Website-Adressen verwendet werden",
    "addresses": "Die Erweiterung verarbeitet freigegebene Adressen, um Grenzen oder Inhaltsregeln anzuwenden. Eine aufgerufene Adresse kann kurz im Arbeitsspeicher bleiben, um zur selben Seite zurückzukehren. Sie speichert kein Besuchsprotokoll und liest weder die Browserverlaufsdatenbank noch Cookies, Seitentitel, angesehene Inhalte oder Zugangsdaten.",
    "bridgeTitle": "Was die Satoru-Seite sehen kann",
    "bridge": "Auf der genauen Satoru-Produktionswebsite stellt ein lokales Skript die Erweiterungsversion, die Anzahl aktivierter und freigegebener Websites, einen begrenzten Sitzungsstatus (Dienstkategorie, Phase, Modus und Restzeit), den Status angewandter Regeln sowie Zustand und Zeit des letzten Grenztests bereit. Website-Adressen, Regeln, Aufgabendetails, Themen, Zwecke, Ergebnisse und Browserverlauf werden über diese Verbindung nicht übertragen.",
    "bridgeAction": "Die Seite kann die Erweiterungseinstellungen öffnen. Sie kann über diese Verbindung keine Regeln ändern, Sitzungen oder Tests starten oder dein Satoru-Konto ändern.",
    "testTitle": "Wenn du eine Grenze testest",
    "test": "Ein von dir gestarteter Test öffnet die Startseite einer eingerichteten Website in einem neuen Tab. Scheitert die Blockierung, kann die Website laden und die normale Browseranfrage erhalten. Ein lokaler Testeintrag enthält Ergebnis, Zeiten, Erweiterungsversion, Regel-Fingerabdruck und Test-Tab-ID. Geänderte Regeln oder eine neue Version machen das alte Ergebnis ungültig. Die Satoru-Seite erhält nur den begrenzten Teststatus und die Zeit.",
    "permissionsTitle": "Berechtigungen und Entfernung",
    "permissions": "Bei der Installation wird nur der Zugriff auf die genaue Satoru-Produktionsadresse gewährt. Beim Hinzufügen einer Website wird HTTP/HTTPS-Zugriff für diesen Hostnamen angefragt. Das Einschalten des optionalen Kategorieschutzes fragt separat HTTP/HTTPS-Zugriff auf alle Websites für die lokale Filterung an. Du kannst Berechtigungen im Browser entziehen sowie die Erweiterung deaktivieren oder deinstallieren.",
    "removal": "Die Deinstallation entfernt den lokalen Erweiterungsspeicher. Separate Browser- oder Profilsicherungen verwaltet dein Browser. Die Erweiterung verwendet keine Cloud-Synchronisierung, Analyse, entfernten ausführbaren Code oder separate Netzwerkadresse zum Hochladen von Daten.",
    "useTitle": "Wofür die Daten verwendet werden",
    "use": "Die Daten dienen den gewählten Browser-Grenzen und ihrer Statusanzeige. Erweiterungsdaten werden weder verkauft noch für Werbung, Kreditentscheidungen oder zweckfremde Profilbildung verwendet.",
    "supportTitle": "Projekt und Support",
    "supportText": "Satoru Attention wird im öffentlichen Projekt HAZYAIN3301/life-rpg gepflegt. Dort kannst du technische Probleme melden. GitHub-Issues sind öffentlich: Füge keine Passwörter, Kontoarchive oder privaten Surfdetails hinzu.",
    "support": "Projekt-Support öffnen"
  },
  "uk": {
    "title": "Конфіденційність у Satoru Attention",
    "language": "Мова",
    "back": "Установлення",
    "date": "Оновлено 13 вересня 2026 · Розширення 0.7.0",
    "lead": "Satoru Attention застосовує вибрані тобою межі сайтів і необов’язкові фільтри в браузері. Цей текст описує розширення; сайт облікового запису Satoru має окремі потоки даних.",
    "localTitle": "Що залишається у браузері",
    "local": "Локальне сховище розширення містить правила, вибрані імена сайтів, сценарії входу, денні бюджети, паузи, відкладені зміни, бюджет аварійного доступу, поточну сесію та до 100 мінімальних підсумків сесій. Поточна сесія може містити введені тобою деталі завдання, тему й очікуваний результат. Причини аварійного доступу перевіряються під час дії та не зберігаються вільним текстом.",
    "addressesTitle": "Як використовуються адреси сайтів",
    "addresses": "Розширення обробляє дозволені адреси для застосування межі або фільтра. Адреса спроби входу може ненадовго залишитися в пам’яті, щоб повернути тебе на ту саму сторінку. Журнал відвідувань не зберігається; розширення не читає базу історії браузера, cookie, назви сторінок, переглянуті матеріали чи дані входу.",
    "bridgeTitle": "Що бачить сторінка Satoru",
    "bridge": "На точному production-сайті Satoru локальний скрипт передає версію розширення, кількість увімкнених сайтів і дозволів, обмежений стан сесії (категорію сервісу, фазу, режим і час, що залишився), стан застосування правил та результат/час останньої перевірки межі. Адреси сайтів, правила, деталі завдань, теми, цілі, підсумки й історія переглядів через це з’єднання не передаються.",
    "bridgeAction": "Сторінка може відкрити налаштування розширення. Через це з’єднання вона не може змінювати правила, починати сесії чи перевірки або змінювати обліковий запис Satoru.",
    "testTitle": "Що відбувається під час перевірки межі",
    "test": "Запущена тобою перевірка відкриває головну сторінку одного вибраного сайту в новій вкладці. Якщо блокування не спрацює, сайт може завантажитися й отримати звичайний запит браузера. Один локальний запис зберігає результат, час, версію розширення, відбиток правил та ID тестової вкладки. Зміна правил або версії робить попередній результат неактуальним. Сторінка Satoru отримує лише обмежений стан перевірки й час.",
    "permissionsTitle": "Дозволи та видалення",
    "permissions": "Під час установлення доступ надається лише до точної production-адреси Satoru. Додавання сайту запитує доступ до цього імені через HTTP/HTTPS. Увімкнення необов’язкового захисту за категоріями окремо запитує HTTP/HTTPS-доступ до всіх сайтів для локальної фільтрації. У браузері можна відкликати дозволи, вимкнути або видалити розширення.",
    "removal": "Видалення розширення видаляє його локальне сховище. Окремими резервними копіями браузера чи профілю керує браузер. Розширення не має хмарної синхронізації, аналітики, віддаленого виконуваного коду чи окремої мережевої адреси завантаження даних.",
    "useTitle": "Для чого потрібні дані",
    "use": "Дані використовуються для вибраних меж у браузері та показу їхнього стану. Дані розширення не продаються й не використовуються для реклами, кредитних рішень або стороннього профілювання.",
    "supportTitle": "Проєкт і підтримка",
    "supportText": "Satoru Attention розвивається у публічному проєкті HAZYAIN3301/life-rpg. Там можна повідомити про технічну проблему. Звернення GitHub публічні: не додавай паролі, архів облікового запису чи особисті подробиці переглядів.",
    "support": "Відкрити підтримку проєкту"
  },
  "es": {
    "title": "Privacidad en Satoru Attention",
    "language": "Idioma",
    "back": "Instalación",
    "date": "Actualizado el 13 de septiembre de 2026 · Extensión 0.7.0",
    "lead": "Satoru Attention aplica los límites de sitios y los filtros de contenido opcionales que eliges en tu navegador. Este aviso describe la extensión; el sitio de la cuenta Satoru tiene sus propios flujos de datos.",
    "localTitle": "Qué permanece en tu navegador",
    "local": "El almacenamiento local de la extensión contiene reglas, nombres de sitios configurados, escenarios de entrada, presupuestos diarios, pausas, cambios pendientes, presupuesto de acceso de emergencia, sesión activa y hasta 100 resultados mínimos de sesiones. La sesión activa puede incluir los detalles de la tarea, el tema y el resultado esperado que introduzcas. Los motivos de emergencia se comprueban al actuar y no se guardan como texto libre.",
    "addressesTitle": "Cómo se usan las direcciones",
    "addresses": "La extensión procesa las direcciones autorizadas para aplicar un límite o una regla de contenido. Puede mantener brevemente en memoria una dirección de entrada para volver a la misma página. No guarda un registro de navegación ni lee la base de datos del historial, cookies, títulos de páginas, contenidos vistos o credenciales de cuentas.",
    "bridgeTitle": "Qué puede ver la página de Satoru",
    "bridge": "En el sitio exacto de producción de Satoru, un script local facilita la versión de la extensión, la cantidad de sitios activados y autorizados, un estado limitado de sesión (categoría del servicio, fase, modo y tiempo restante), el estado de aplicación de reglas y el estado y la hora de la última prueba del límite. Las direcciones, reglas, detalles de tareas, temas, propósitos, resultados e historial no se envían por esta conexión.",
    "bridgeAction": "La página puede abrir los ajustes de la extensión. Mediante esta conexión no puede cambiar reglas, iniciar sesiones o pruebas ni modificar tu cuenta de Satoru.",
    "testTitle": "Cuando compruebas un límite",
    "test": "Una prueba que tú inicias abre la página principal de un sitio configurado en una pestaña nueva. Si falla el bloqueo, el sitio puede cargar y recibir la solicitud normal del navegador. Un registro local guarda el resultado, las horas, la versión de la extensión, la huella de las reglas y el ID de la pestaña de prueba. Cambiar reglas o versión invalida el resultado anterior. La página de Satoru recibe solo el estado limitado y la hora de la prueba.",
    "permissionsTitle": "Permisos y desinstalación",
    "permissions": "La instalación concede acceso solo a la dirección exacta de producción de Satoru. Añadir un sitio solicita acceso HTTP/HTTPS a ese nombre. Activar la protección opcional por categorías solicita por separado acceso HTTP/HTTPS a todos los sitios para filtrar localmente. Puedes retirar permisos, desactivar o desinstalar la extensión en el navegador.",
    "removal": "Desinstalar elimina el almacenamiento local de la extensión. Tu navegador gestiona las copias de seguridad separadas del navegador o del perfil. La extensión no usa sincronización en la nube, analítica, código ejecutable remoto ni una dirección de red separada para subir datos.",
    "useTitle": "Para qué se usan los datos",
    "use": "Los datos se usan para los límites elegidos y su estado. Los datos de la extensión no se venden ni se usan para publicidad, decisiones crediticias o perfiles ajenos a su finalidad.",
    "supportTitle": "Proyecto y soporte",
    "supportText": "Satoru Attention se mantiene en el proyecto público HAZYAIN3301/life-rpg. Allí puedes comunicar problemas técnicos. Los asuntos de GitHub son públicos: no incluyas contraseñas, archivos de tu cuenta ni detalles privados de navegación.",
    "support": "Abrir soporte del proyecto"
  }
};
  const select = document.querySelector('#policy-language');
  const params = new URLSearchParams(location.search);
  function render(value) {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    const language = Object.hasOwn(copy, code) ? code : 'en';
    const text = copy[language];
    document.documentElement.lang = language;
    document.title = text.title;
    document.querySelector('meta[name="description"]').setAttribute('content', text.lead);
    document.querySelectorAll('[data-policy]').forEach(node => {
      if (Object.hasOwn(text, node.dataset.policy)) node.textContent = text[node.dataset.policy];
    });
    select.value = language;
    document.querySelector('#policy-back').href = '/browser-companion.html?lang=' + language;
    return language;
  }
  render(params.get('lang') || navigator.language);
  select.addEventListener('change', () => {
    const language = render(select.value);
    const next = new URL(location.href);
    next.searchParams.set('lang', language);
    history.replaceState(null, '', next.href);
  });
}());
