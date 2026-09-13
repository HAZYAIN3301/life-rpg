# Chrome/Brave — публикация v261

13.09.2026. Владелец явно разрешил публикацию расширения. Его runtime остаётся
0.6.0: готовые ZIP/скриншоты/иконка и точная SHA256 — store-kit-v260.
Новая страница не требует пересборки или смены версии ZIP.

## Готовые адреса после deployment v261

- Privacy: https://life-rpg-production-416a.up.railway.app/browser-companion-privacy.html
- Установка: https://life-rpg-production-416a.up.railway.app/browser-companion.html
- Поддержка: https://github.com/HAZYAIN3301/life-rpg/issues

Privacy — фактическое описание расширения 0.6.0 на RU/EN/DE/UK/ES, со статическим
English fallback без JavaScript. Данные аккаунта приложения не объявлены покрытыми
этим текстом. Описаны local storage/100 минимальных исходов, обработка адресов,
bounded status bridge, добровольный real-site test, разрешения и удаление.
GitHub repo PUBLIC и issues включены, проверено gh 13.09; приватный support email
не выдуман. Публичные обращения явно не предназначены для паролей/архивов аккаунта.

## Фактический доступ к магазину

13.09 доступный браузер Codex открыл Google sign-in вместо кабинета разработчика.
Доступ к рабочему Brave отклонён browser tool. Это не подтверждает отсутствие
аккаунта разработчика у владельца. Вкладка входа передана владельцу, отдельно
запрошено только действие входа. ZIP ещё НЕ uploaded/submitted/reviewed/published.
Пароли, регистрация, платежи и owner declarations не выполнялись.

После входа: проверить существующие items (не создавать дубликат), загрузить
точный Chrome store ZIP v260, заполнить listing/privacy/testing/distribution
по фактическим полям кабинета. Не подменять publisher/contact неизвестными значениями.
После review записать настоящий item URL и проверить обычный signed install/update
в Chrome и Brave. Старые ограничения QA в store-kit-v260 остаются.

Официальный порядок и privacy fields сверены 13.09:
[Publish](https://developer.chrome.com/docs/webstore/publish),
[Privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
Описание на сайте можно публиковать по уже полученному разрешению; отправка
в магазин пока зависит от доступной сессии владельца.

## Проверки страницы

20 сочетаний пяти языков, 375/1280 и dark/light без горизонтального overflow;
7 разделов, controls/links ≥44px, видимый keyboard focus. Светлая тема проверена
через изолированную CSS-копию, настройки браузера владельца не менялись.
200% text-size fixture: 32px body при фиксированном viewport 375/1280, 5 языков,
без overflow. Ошибка relative history URL в cross-origin base fixture исправлена
на собственный абсолютный URL; повторные переключения проходят без console errors.
Контраст вторичного текста: минимум 5.08:1 в проверенных palette/background парах;
обычные policy links используют основной текст и подчёркивание.
Страница не подключает account runtime, bridge, аналитику или внешние шрифты.

Факт deployment/production-byte verification фиксируется в DEVLOG и release receipt.
