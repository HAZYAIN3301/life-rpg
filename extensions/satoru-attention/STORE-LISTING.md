# Satoru Attention — Chrome Web Store listing draft

## Name

Satoru Attention

## Short description (EN)

Set a purpose and a time boundary before opening distracting websites.

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

Rules, active sessions and the last 100 minimal outcomes remain in `chrome.storage.local`.
The extension does not collect browsing history, page titles, watched items, cookies or the
reason for an emergency exit. The Satoru web app can read only the installed version, number
of configured sites, and the bounded state of the current session.

## Short description (RU)

Назови цель и поставь временную границу до открытия отвлекающего сайта.

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

Правила, активная сессия и последние 100 минимальных исходов остаются в локальном хранилище
браузера. Расширение не собирает историю, названия страниц, просмотренные материалы, cookie
или причину аварийного выхода. Веб-приложение Satoru видит только версию, число настроенных
сайтов и ограниченное состояние текущей сессии.

## Permission rationale

- `storage`: stores the user-created rules, current bounded session, emergency budget and
  minimal outcomes locally. Nothing is synced through `chrome.storage.sync`.
- `declarativeNetRequest`: redirects only configured exact hostnames to the local gate when
  no valid window is active.
- `scripting`: installs a local guard only for exact sites explicitly selected and approved
  by the user, so already-open tabs observe the same boundary.
- `alarms`: wakes the extension at a chosen deadline and retries local reconciliation after
  a browser API failure.
- Permanent host access is limited to the Satoru production origin for its read-only status
  bridge. All other hosts are optional permissions requested one exact hostname at a time.

## Privacy answers

- Personally identifiable information: not collected.
- Health information: not collected.
- Authentication information: not collected.
- Personal communications: not collected.
- Location: not collected.
- Web history: not collected or transmitted.
- User activity: the current local boundary and minimal outcome are stored locally and are
  used only for the extension’s single stated purpose.
- Selling, advertising, credit decisions: none.

## Single purpose

Help a person enter selected websites with an explicit purpose and bounded duration, and
restore the chosen boundary when that duration ends.

## Store assets still required

- 1280×800 or 640×400 store screenshot: options page with one configured website.
- 1280×800 or 640×400 store screenshot: gate with purpose and duration.
- Optional 1400×560 promotional tile.
- Public privacy-policy URL (can point to the Satoru privacy page once published).
