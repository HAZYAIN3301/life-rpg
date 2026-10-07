(function () {
  'use strict';
  const copy = {
  "en": {
    "title": "Privacy in Satoru Attention",
    "language": "Language",
    "back": "Installation",
    "date": "7 October 2026 · Extension 0.10.3",
    "lead": "Satoru Attention applies the website boundaries and optional content filters you choose in your browser. This notice covers the extension; the Satoru account website has separate data flows.",
    "localTitle": "What stays in your browser",
    "local": "Local extension storage holds your rules, configured hostnames, entry scenarios, daily budgets, cooldowns, pending changes, emergency-access budget, active session and up to 100 minimal session outcomes. An active session can contain the task detail, topic and expected outcome you enter. Emergency reasons are checked when used and are not saved as free text. Since 0.9.0 it also keeps the protection lock (start and remaining time), today's count of blocked attempts (a number, no addresses) and the reasons you type for the block page. During a chess puzzle the current puzzle is held only in the browser session and discarded afterwards. Local category lists and chess puzzles are bundled with the extension. Protection can be locked for 7, 30 or 90 days; this does not prevent browser-level removal.",
    "addressesTitle": "How website addresses are used",
    "addresses": "The extension processes permitted addresses to apply a boundary or content rule. It can briefly keep an attempted address in memory to return you to the same page. It does not save a browsing-history log or read your browser history database, cookies, page titles, watched items or account credentials. When the Adult category is on, on reddit.com the extension asks Reddit's own about.json whether a community or profile you open or see in a feed is marked 18+.  The Reddit request uses your browser session cookies when present; Reddit receives the requested community/profile and normal connection metadata, including your IP address. The extension does not read cookie values itself. Verdicts are used for 7 days; stored entries are cleared on later cache updates or extension removal.",
    "bridgeTitle": "What the Satoru page can see",
    "bridge": "On the exact Satoru production websites (satoruapp.com and its Railway host), a local content script exposes the extension version, enabled/permitted site counts, limited session status (service category, phase, mode and time remaining), rule-application status and the latest boundary-test state and time. Site addresses, rules, task details, topics, purposes, outcomes and browsing history are not sent through this connection.",
    "bridgeAction": "The page can open extension settings. It cannot change rules, start sessions or tests, or change your Satoru account through this connection.",
    "testTitle": "When you test a boundary",
    "test": "A test you start opens one configured site's homepage in a new tab. If blocking fails, the site can load and receive the normal browser request. One local test record keeps the result, times, extension version, rule fingerprint and test-tab ID. Changing the rules or version invalidates the old result. The Satoru page receives only the bounded test state and time.",
    "permissionsTitle": "Permissions and removal",
    "permissions": "Installation grants access only to Satoru's two exact production addresses (satoruapp.com and its Railway host). Adding a website asks for that hostname over HTTP/HTTPS. Turning on optional category protection separately requests all-site HTTP/HTTPS access so local filtering can work. You can remove permissions, disable or uninstall the extension in your browser.",
    "removal": "Uninstalling removes local extension storage. Any separate browser or profile backups are managed by your browser. There is no extension cloud sync, analytics, remote executable code or separate network upload endpoint.",
    "useTitle": "How the data is used",
    "use": "Data is used for the chosen browser boundaries and their status. Extension data is not sold or used for advertising, credit decisions or unrelated profiling.",
    "supportTitle": "Project and support",
    "supportText": "Support: satoru@satoruapp.com. Do not send passwords or private browsing details.",
    "support": "Contact support"
  },
  "ru": {
    "title": "Конфиденциальность в Satoru Attention",
    "language": "Язык",
    "back": "Установка",
    "date": "7 октября 2026 · Расширение 0.10.3",
    "lead": "Satoru Attention применяет выбранные тобой границы сайтов и необязательные фильтры в браузере. Этот текст описывает расширение; у сайта с аккаунтом Satoru отдельные потоки данных.",
    "localTitle": "Что остаётся в браузере",
    "local": "Локальное хранилище расширения содержит правила, выбранные имена сайтов, сценарии входа, дневные бюджеты, паузы, отложенные изменения, бюджет аварийного доступа, текущую сессию и до 100 минимальных итогов сессий. В текущей сессии могут быть введённые тобой детали задачи, тема и ожидаемый результат. Причины аварийного доступа проверяются в момент действия и не сохраняются свободным текстом. С версии 0.9.0 там же хранятся замок защиты (начало и оставшееся время), число заблокированных попыток за сегодня (только число, без адресов) и причины, которые ты вписал для страницы блокировки. Во время шахматной задачи текущая задача хранится только в сессии браузера и затем удаляется. Списки категорий и шахматные задачи входят в пакет расширения. Защиту можно запереть на 7, 30 или 90 дней; это не запрещает удаление средствами браузера.",
    "addressesTitle": "Как используются адреса сайтов",
    "addresses": "Расширение обрабатывает разрешённые адреса для применения границы или фильтра. Адрес попытки входа может ненадолго оставаться в памяти, чтобы вернуть тебя на ту же страницу. Журнал посещений не сохраняется; расширение не читает базу истории браузера, cookie, названия страниц, просмотренные материалы и данные входа в аккаунты. Когда включена категория «18+», на reddit.com расширение спрашивает у самого Reddit (его about.json), помечено ли открытое или показанное в ленте сообщество либо профиль как 18+.  Запрос к Reddit использует cookies вашей браузерной сессии, если они есть; Reddit получает имя сообщества/профиля и обычные данные соединения, включая IP-адрес. Само расширение не читает значения cookies. Ответы используются 7 дней; сохранённые записи очищаются при последующих обновлениях кеша или удалении расширения.",
    "bridgeTitle": "Что видит страница Satoru",
    "bridge": "На точных production-сайтах Satoru (satoruapp.com и адрес на Railway) локальный скрипт передаёт версию расширения, число включённых сайтов и разрешений, ограниченный статус сессии (категорию сервиса, фазу, режим и оставшееся время), состояние применения правил и результат/время последней проверки границы. Адреса сайтов, правила, детали задач, темы, цели, итоги и история просмотров через это соединение не передаются.",
    "bridgeAction": "Страница может открыть настройки расширения. Через это соединение она не может менять правила, начинать сессии или проверки либо изменять аккаунт Satoru.",
    "testTitle": "Что происходит при проверке границы",
    "test": "Запущенная тобой проверка открывает главную страницу одного выбранного сайта в новой вкладке. Если блокировка не сработает, сайт может загрузиться и получить обычный запрос браузера. Одна локальная запись хранит результат, время, версию расширения, отпечаток правил и ID тестовой вкладки. Смена правил или версии делает прежний результат неактуальным. Страница Satoru получает только ограниченный статус проверки и время.",
    "permissionsTitle": "Разрешения и удаление",
    "permissions": "При установке доступ предоставляется только к двум точным production-адресам Satoru (satoruapp.com и его адрес на Railway). Добавление сайта запрашивает доступ к этому имени по HTTP/HTTPS. Включение необязательной защиты по категориям отдельно запрашивает HTTP/HTTPS-доступ ко всем сайтам для локальной фильтрации. В браузере можно отозвать разрешения, отключить или удалить расширение.",
    "removal": "Удаление расширения удаляет его локальное хранилище. Отдельными резервными копиями браузера или профиля управляет браузер. У расширения нет облачной синхронизации, аналитики, удалённого исполняемого кода и отдельного сетевого адреса загрузки данных.",
    "useTitle": "Для чего нужны данные",
    "use": "Данные используются для выбранных границ в браузере и показа их состояния. Данные расширения не продаются и не используются для рекламы, кредитных решений или постороннего профилирования.",
    "supportTitle": "Проект и поддержка",
    "supportText": "Поддержка: satoru@satoruapp.com. Не отправляйте пароли и личные подробности просмотров.",
    "support": "Связаться с поддержкой"
  },
  "de": {
    "title": "Datenschutz in Satoru Attention",
    "language": "Sprache",
    "back": "Installation",
    "date": "7. Oktober 2026 · Erweiterung 0.10.3",
    "lead": "Satoru Attention setzt die von dir gewählten Website-Grenzen und optionalen Inhaltsfilter im Browser um. Dieser Hinweis beschreibt die Erweiterung; die Satoru-Kontowebsite hat eigene Datenflüsse.",
    "localTitle": "Was in deinem Browser bleibt",
    "local": "Der lokale Erweiterungsspeicher enthält Regeln, eingerichtete Hostnamen, Eintrittsszenarien, Tagesbudgets, Pausen, vorgemerkte Änderungen, das Notfallzugangsbudget, die aktive Sitzung und bis zu 100 minimale Sitzungsergebnisse. Eine aktive Sitzung kann deine eingegebenen Aufgabendetails, Themen und erwarteten Ergebnisse enthalten. Notfallgründe werden bei der Aktion geprüft und nicht als Freitext gespeichert. Seit 0.9.0 enthält er außerdem das Schutzschloss (Beginn und Restzeit), die heutige Zahl blockierter Versuche (nur eine Zahl, keine Adressen) und die Gründe, die du für die Sperrseite einträgst. Während einer Schachaufgabe liegt die aktuelle Aufgabe nur in der Browsersitzung und wird danach verworfen. Kategorielisten und Schachaufgaben sind im Erweiterungspaket enthalten. Der Schutz kann für 7, 30 oder 90 Tage gesperrt werden; die Deinstallation im Browser bleibt möglich.",
    "addressesTitle": "Wie Website-Adressen verwendet werden",
    "addresses": "Die Erweiterung verarbeitet freigegebene Adressen, um Grenzen oder Inhaltsregeln anzuwenden. Eine aufgerufene Adresse kann kurz im Arbeitsspeicher bleiben, um zur selben Seite zurückzukehren. Sie speichert kein Besuchsprotokoll und liest weder die Browserverlaufsdatenbank noch Cookies, Seitentitel, angesehene Inhalte oder Zugangsdaten. Ist die Kategorie 18+ aktiv, fragt die Erweiterung auf reddit.com Reddits eigenes about.json, ob eine geöffnete oder im Feed gezeigte Community oder ein Profil als 18+ markiert ist.  Die Reddit-Anfrage verwendet vorhandene Sitzungscookies des Browsers; Reddit erhält den Namen der Community/des Profils und übliche Verbindungsdaten einschließlich IP-Adresse. Die Erweiterung selbst liest keine Cookie-Werte. Ergebnisse werden 7 Tage verwendet; gespeicherte Einträge werden bei späteren Cache-Aktualisierungen oder der Deinstallation entfernt.",
    "bridgeTitle": "Was die Satoru-Seite sehen kann",
    "bridge": "Auf den genauen Satoru-Produktionswebsites (satoruapp.com und die Railway-Adresse) stellt ein lokales Skript die Erweiterungsversion, die Anzahl aktivierter und freigegebener Websites, einen begrenzten Sitzungsstatus (Dienstkategorie, Phase, Modus und Restzeit), den Status angewandter Regeln sowie Zustand und Zeit des letzten Grenztests bereit. Website-Adressen, Regeln, Aufgabendetails, Themen, Zwecke, Ergebnisse und Browserverlauf werden über diese Verbindung nicht übertragen.",
    "bridgeAction": "Die Seite kann die Erweiterungseinstellungen öffnen. Sie kann über diese Verbindung keine Regeln ändern, Sitzungen oder Tests starten oder dein Satoru-Konto ändern.",
    "testTitle": "Wenn du eine Grenze testest",
    "test": "Ein von dir gestarteter Test öffnet die Startseite einer eingerichteten Website in einem neuen Tab. Scheitert die Blockierung, kann die Website laden und die normale Browseranfrage erhalten. Ein lokaler Testeintrag enthält Ergebnis, Zeiten, Erweiterungsversion, Regel-Fingerabdruck und Test-Tab-ID. Geänderte Regeln oder eine neue Version machen das alte Ergebnis ungültig. Die Satoru-Seite erhält nur den begrenzten Teststatus und die Zeit.",
    "permissionsTitle": "Berechtigungen und Entfernung",
    "permissions": "Bei der Installation wird nur der Zugriff auf die zwei genauen Satoru-Produktionsadressen gewährt (satoruapp.com und die Railway-Adresse). Beim Hinzufügen einer Website wird HTTP/HTTPS-Zugriff für diesen Hostnamen angefragt. Das Einschalten des optionalen Kategorieschutzes fragt separat HTTP/HTTPS-Zugriff auf alle Websites für die lokale Filterung an. Du kannst Berechtigungen im Browser entziehen sowie die Erweiterung deaktivieren oder deinstallieren.",
    "removal": "Die Deinstallation entfernt den lokalen Erweiterungsspeicher. Separate Browser- oder Profilsicherungen verwaltet dein Browser. Die Erweiterung verwendet keine Cloud-Synchronisierung, Analyse, entfernten ausführbaren Code oder separate Netzwerkadresse zum Hochladen von Daten.",
    "useTitle": "Wofür die Daten verwendet werden",
    "use": "Die Daten dienen den gewählten Browser-Grenzen und ihrer Statusanzeige. Erweiterungsdaten werden weder verkauft noch für Werbung, Kreditentscheidungen oder zweckfremde Profilbildung verwendet.",
    "supportTitle": "Projekt und Support",
    "supportText": "Support: satoru@satoruapp.com. Keine Passwörter oder privaten Surfdetails senden.",
    "support": "Support kontaktieren"
  },
  "uk": {
    "title": "Конфіденційність у Satoru Attention",
    "language": "Мова",
    "back": "Установлення",
    "date": "7 жовтня 2026 · Розширення 0.10.3",
    "lead": "Satoru Attention застосовує вибрані тобою межі сайтів і необов’язкові фільтри в браузері. Цей текст описує розширення; сайт облікового запису Satoru має окремі потоки даних.",
    "localTitle": "Що залишається у браузері",
    "local": "Локальне сховище розширення містить правила, вибрані імена сайтів, сценарії входу, денні бюджети, паузи, відкладені зміни, бюджет аварійного доступу, поточну сесію та до 100 мінімальних підсумків сесій. Поточна сесія може містити введені тобою деталі завдання, тему й очікуваний результат. Причини аварійного доступу перевіряються під час дії та не зберігаються вільним текстом. З версії 0.9.0 там також зберігаються замок захисту (початок і залишок часу), кількість заблокованих спроб за сьогодні (лише число, без адрес) і причини, які ти вписав для сторінки блокування. Під час шахової задачі поточна задача зберігається лише в сесії браузера й потім видаляється. Списки категорій і шахові задачі входять до пакета розширення. Захист можна замкнути на 7, 30 або 90 днів; це не забороняє видалення засобами браузера.",
    "addressesTitle": "Як використовуються адреси сайтів",
    "addresses": "Розширення обробляє дозволені адреси для застосування межі або фільтра. Адреса спроби входу може ненадовго залишитися в пам’яті, щоб повернути тебе на ту саму сторінку. Журнал відвідувань не зберігається; розширення не читає базу історії браузера, cookie, назви сторінок, переглянуті матеріали чи дані входу. Коли ввімкнено категорію «18+», на reddit.com розширення запитує в самого Reddit (його about.json), чи позначено відкриту або показану в стрічці спільноту чи профіль як 18+. Запит до Reddit використовує cookies вашої браузерної сесії, якщо вони є; Reddit отримує назву спільноти/профілю та звичайні дані з’єднання, зокрема IP-адресу. Саме розширення не читає значення cookies. Відповіді використовуються 7 днів; збережені записи очищаються під час наступних оновлень кешу або видалення розширення.",
    "bridgeTitle": "Що бачить сторінка Satoru",
    "bridge": "На точних production-сайтах Satoru (satoruapp.com і адреса на Railway) локальний скрипт передає версію розширення, кількість увімкнених сайтів і дозволів, обмежений стан сесії (категорію сервісу, фазу, режим і час, що залишився), стан застосування правил та результат/час останньої перевірки межі. Адреси сайтів, правила, деталі завдань, теми, цілі, підсумки й історія переглядів через це з’єднання не передаються.",
    "bridgeAction": "Сторінка може відкрити налаштування розширення. Через це з’єднання вона не може змінювати правила, починати сесії чи перевірки або змінювати обліковий запис Satoru.",
    "testTitle": "Що відбувається під час перевірки межі",
    "test": "Запущена тобою перевірка відкриває головну сторінку одного вибраного сайту в новій вкладці. Якщо блокування не спрацює, сайт може завантажитися й отримати звичайний запит браузера. Один локальний запис зберігає результат, час, версію розширення, відбиток правил та ID тестової вкладки. Зміна правил або версії робить попередній результат неактуальним. Сторінка Satoru отримує лише обмежений стан перевірки й час.",
    "permissionsTitle": "Дозволи та видалення",
    "permissions": "Під час установлення доступ надається лише до двох точних production-адрес Satoru (satoruapp.com і його адреса на Railway). Додавання сайту запитує доступ до цього імені через HTTP/HTTPS. Увімкнення необов’язкового захисту за категоріями окремо запитує HTTP/HTTPS-доступ до всіх сайтів для локальної фільтрації. У браузері можна відкликати дозволи, вимкнути або видалити розширення.",
    "removal": "Видалення розширення видаляє його локальне сховище. Окремими резервними копіями браузера чи профілю керує браузер. Розширення не має хмарної синхронізації, аналітики, віддаленого виконуваного коду чи окремої мережевої адреси завантаження даних.",
    "useTitle": "Для чого потрібні дані",
    "use": "Дані використовуються для вибраних меж у браузері та показу їхнього стану. Дані розширення не продаються й не використовуються для реклами, кредитних рішень або стороннього профілювання.",
    "supportTitle": "Проєкт і підтримка",
    "supportText": "Підтримка: satoru@satoruapp.com. Не надсилайте паролі й особисті подробиці переглядів.",
    "support": "Зв’язатися з підтримкою"
  },
  "es": {
    "title": "Privacidad en Satoru Attention",
    "language": "Idioma",
    "back": "Instalación",
    "date": "7 de octubre de 2026 · Extensión 0.10.3",
    "lead": "Satoru Attention aplica los límites de sitios y los filtros de contenido opcionales que eliges en tu navegador. Este aviso describe la extensión; el sitio de la cuenta Satoru tiene sus propios flujos de datos.",
    "localTitle": "Qué permanece en tu navegador",
    "local": "El almacenamiento local de la extensión contiene reglas, nombres de sitios configurados, escenarios de entrada, presupuestos diarios, pausas, cambios pendientes, presupuesto de acceso de emergencia, sesión activa y hasta 100 resultados mínimos de sesiones. La sesión activa puede incluir los detalles de la tarea, el tema y el resultado esperado que introduzcas. Los motivos de emergencia se comprueban al actuar y no se guardan como texto libre. Desde la 0.9.0 también guarda el candado de protección (inicio y tiempo restante), el número de intentos bloqueados de hoy (solo un número, sin direcciones) y las razones que escribes para la página de bloqueo. Durante un problema de ajedrez, el problema actual se guarda solo en la sesión del navegador y luego se descarta. Las listas de categorías y los problemas de ajedrez vienen incluidos en la extensión. La protección se puede bloquear durante 7, 30 o 90 días; esto no impide desinstalarla desde el navegador.",
    "addressesTitle": "Cómo se usan las direcciones",
    "addresses": "La extensión procesa las direcciones autorizadas para aplicar un límite o una regla de contenido. Puede mantener brevemente en memoria una dirección de entrada para volver a la misma página. No guarda un registro de navegación ni lee la base de datos del historial, cookies, títulos de páginas, contenidos vistos o credenciales de cuentas. Con la categoría 18+ activa, en reddit.com la extensión consulta el about.json del propio Reddit para saber si una comunidad o perfil que abres o ves en el feed está marcado como 18+. La solicitud a Reddit utiliza las cookies de sesión del navegador si existen; Reddit recibe el nombre de la comunidad/perfil y los datos habituales de conexión, incluida la dirección IP. La extensión no lee directamente los valores de las cookies. Los resultados se usan durante 7 días; los registros se eliminan en actualizaciones posteriores de la caché o al desinstalar la extensión.",
    "bridgeTitle": "Qué puede ver la página de Satoru",
    "bridge": "En los sitios exactos de producción de Satoru (satoruapp.com y su dirección en Railway), un script local facilita la versión de la extensión, la cantidad de sitios activados y autorizados, un estado limitado de sesión (categoría del servicio, fase, modo y tiempo restante), el estado de aplicación de reglas y el estado y la hora de la última prueba del límite. Las direcciones, reglas, detalles de tareas, temas, propósitos, resultados e historial no se envían por esta conexión.",
    "bridgeAction": "La página puede abrir los ajustes de la extensión. Mediante esta conexión no puede cambiar reglas, iniciar sesiones o pruebas ni modificar tu cuenta de Satoru.",
    "testTitle": "Cuando compruebas un límite",
    "test": "Una prueba que tú inicias abre la página principal de un sitio configurado en una pestaña nueva. Si falla el bloqueo, el sitio puede cargar y recibir la solicitud normal del navegador. Un registro local guarda el resultado, las horas, la versión de la extensión, la huella de las reglas y el ID de la pestaña de prueba. Cambiar reglas o versión invalida el resultado anterior. La página de Satoru recibe solo el estado limitado y la hora de la prueba.",
    "permissionsTitle": "Permisos y desinstalación",
    "permissions": "La instalación concede acceso solo a las dos direcciones exactas de producción de Satoru (satoruapp.com y su dirección en Railway). Añadir un sitio solicita acceso HTTP/HTTPS a ese nombre. Activar la protección opcional por categorías solicita por separado acceso HTTP/HTTPS a todos los sitios para filtrar localmente. Puedes retirar permisos, desactivar o desinstalar la extensión en el navegador.",
    "removal": "Desinstalar elimina el almacenamiento local de la extensión. Tu navegador gestiona las copias de seguridad separadas del navegador o del perfil. La extensión no usa sincronización en la nube, analítica, código ejecutable remoto ni una dirección de red separada para subir datos.",
    "useTitle": "Para qué se usan los datos",
    "use": "Los datos se usan para los límites elegidos y su estado. Los datos de la extensión no se venden ni se usan para publicidad, decisiones crediticias o perfiles ajenos a su finalidad.",
    "supportTitle": "Proyecto y soporte",
    "supportText": "Soporte: satoru@satoruapp.com. No envíes contraseñas ni detalles privados de navegación.",
    "support": "Contactar con soporte"
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
