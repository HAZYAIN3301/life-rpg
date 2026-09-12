# Satoru Attention — cross-store listing draft

The product copy and permission rationale are shared by Chrome Web Store, Microsoft Edge
Add-ons, Opera Add-ons, Firefox AMO and Apple App Store. Store-specific package names and
signing steps live in `PUBLISH-CHECKLIST.md`; do not claim that a listing is live before its
real URL and signed update path have been verified.

## Name

Satoru Attention

## Short description (EN)

Set a purpose and time boundary, or locally block distracting sites and categories.

## Full description (EN)

Satoru Attention replaces an open-ended feed with a deliberate contract. Choose an exact
website and approve its allowed entry scenarios before the impulse. At entry, choose one of
those scenarios, name the concrete task and optionally shorten its bounded time window.
When the window ends, the extension returns you to a boundary screen.

The first setup is intentionally small: one website and one prebuilt scenario pack. A shared
daily time budget, entry count and cooldown keep repeated short entries from becoming an
unlimited loophole. Looser Control changes wait until the next local day; tighter changes
apply now. Trust, Adaptive and Control modes change extensions and emergency access, but none
of them removes data, spends money, changes a Satoru profile or punishes a lapse.

Optional Browser Protection adds local category blocking, deny/allow lists, scheduled
Recreation Time, strict search parameters, YouTube Restricted Mode and browser-visible
bypass-domain blocking. It is disabled by default and asks for all-site access only when the
person enables it. The bundled catalog is local; browsing addresses are not transmitted.

Rules, active sessions and the last 100 minimal outcomes remain in `chrome.storage.local`.
The extension does not collect browsing history, page titles, watched items, cookies or the
reason for an emergency exit. The current local session may include your entered detail,
topic and expected outcome. The Satoru web app can read only the installed version, counts
of enabled/permitted sites, bounded current-session state, rule-application status, and the
state/time of the latest boundary test. Site addresses and those private details stay local.

After setup, test entry into one configured website from extension settings. The test opens
the site's real homepage in a new tab and records success only when its local boundary
responds. If blocking fails the site can load. This is a test of one entry, not a guarantee
about all sites, timer expiry, other browsers or resistance to uninstalling the extension.

## Short description (RU)

Назови цель и время или локально заблокируй отвлекающие сайты и категории.

## Full description (RU)

Satoru Attention заменяет бесконечную ленту на заранее принятое решение. Выбери точный сайт
и заранее разрешённые сценарии входа. На входе останется выбрать один сценарий, назвать
конкретную задачу и при необходимости сократить ограниченное окно. Когда окно закончится,
расширение вернёт тебя на экран границы.

Первая настройка намеренно короткая: один сайт и готовый набор сценариев. Общий дневной
бюджет, число входов и пауза не позволяют превратить серию коротких заходов в безлимитный
обход. Ослабление Control вступает в силу только на следующий локальный день, усиление —
сразу. Режимы Доверие, Адаптивный и Контроль отличаются правилами продления и аварийного
доступа, но не удаляют данные, не тратят деньги и не наказывают за срыв.

Опциональная защита браузера добавляет категории, чёрный и белый списки, расписание отдыха,
строгий поиск, ограниченный режим YouTube и блокировку известных браузерных способов обхода.
Она выключена по умолчанию и запрашивает доступ ко всем сайтам только при явном включении.

Правила, активная сессия и последние 100 минимальных исходов остаются в локальном хранилище
браузера. Расширение не собирает историю, названия страниц, просмотренные материалы, cookie
или причину аварийного выхода. Текущая локальная сессия может содержать введённые детали
задачи, тему и ожидаемый результат. Satoru видит только версию, число включённых сайтов
и разрешений, ограниченное состояние сессии, состояние применения правил и время/результат
проверки границы. Адреса сайтов и личные детали остаются в расширении.

После настройки можно проверить вход на один сайт. Расширение откроет его главную страницу
в новой вкладке и сохранит успех только после ответа локальной границы. При отказе блокировки
сайт может загрузиться. Проверка одного входа не подтверждает окончание таймера, все сайты,
другие браузеры или защиту от удаления расширения.

## Permission rationale

- `storage`: stores the user-created rules, current bounded session, emergency budget and
  minimal outcomes locally. Nothing is synced through `chrome.storage.sync`.
- `declarativeNetRequest`: redirects configured attention hosts to the local gate and, when
  Browser Protection is explicitly enabled, applies the selected local block/filter rules.
- `scripting`: installs a local guard only for exact sites explicitly selected and approved
  by the user, so already-open tabs observe the same boundary.
- `alarms`: wakes the extension at a chosen deadline and retries local reconciliation after
  a browser API failure.
- Permanent host access is limited to the Satoru production origin. Exact-site Attention
  requests one hostname at a time. Browser Protection separately requests optional all-site
  access only after its master switch is enabled.

## Privacy answers

- Personally identifiable information: not collected.
- Health information: not collected.
- Authentication information: not collected.
- Personal communications: not collected.
- Location: not collected.
- Web history: the browser history database is not read. Permitted addresses are processed
  in memory for enforcement; minimal session outcomes remain local, and no history is uploaded.
- User activity: the current local boundary and minimal outcome are stored locally and are
  used only for the extension’s single stated purpose.
- Selling, advertising, credit decisions: none.

## Single purpose

Help a person deliberately enter selected websites with a bounded purpose or locally block
chosen distracting websites and categories in the same browser.

## Store assets and final owner inputs

- 1280×800 Chrome screenshots of settings and gate: `store-kit-v260/chrome-*.png`.
- 128×128 icon and 440×280 small promo tile: `store-kit-v260/store-icon-128.png` and
  `store-kit-v260/small-promo-440x280.png`. The existing mark is preserved.
- Optional 1400×560 promotional tile.
- Public privacy-policy URL: owner must publish the reviewed `store-kit-v260/PRIVACY-DRAFT.md`.
  Do not point the dashboard to an invented or unpublished page.
