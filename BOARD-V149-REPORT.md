# Board of Contracts v149 — implementation report

## Итог

Вкладка «Сегодня → Доска» пересобрана как цельная игровая доска заказов, а не набор одинаковых карточек. Визуальная метафора берёт у референсов Witcher/Skyrim дерево, приколотые листы и отдельное чтение выбранного заказа, но остаётся в каноне Satoru: cut-paper, высокая читаемость, серьёзный life OS и доступные реальные controls.

## Что построено

- один framed board вместо слабой flex-ленты;
- один общий сезонный заказ с отдельной иерархией и три личных заказа;
- выбранный заказ всегда открыт в reading rail — пустого detail-state больше нет;
- на mobile detail и CTA идут раньше декоративной раскладки бумаг;
- native buttons, `aria-pressed`, visible focus, coarse/mobile targets не меньше `42×42`;
- состояния `take / complete / return / keep` используют один серверный transaction endpoint;
- завершение атомарно сохраняет Board settings и созданный task, rollback защищает от частичной награды;
- при offline/500 UI не показывает false-success и не меняет локальное состояние;
- старый ошибочный ключ `boardMedia` заменён на разрешённый `boardmedia`;
- приватный «Путевой журнал» принимает только изображения, которые текущая версия умеет безопасно уменьшать и показывать;
- 31/31 authored orders получили RU/EN/DE/UK/ES titles через stable ids;
- PWA cache поднят `satoru-v148 → satoru-v149`.

## Принятая граница social-функции

В v149 намеренно нет глобальной ленты, лайков, follower graph, popularity/ranking и автоматической публикации. Фото остаётся приватным доказательством внутри выполненного заказа. Общая media-сеть требует отдельного релиза с явным consent, audience/privacy controls, moderation/reporting, delete/export, minors/DSGVO и понятным ownership. Это не пропуск дизайна, а защита от запуска social/data-функции без безопасного контракта.

## QA

- focused Board/data/account: `12/12 PASS`;
- полный объединённый suite после merge с release-hotfix: `168/168 PASS`;
- syntax app/pool/server/SW: PASS;
- CSS braces и whitespace diff: PASS;
- `360×800`: document overflow `0`, minimum Board target `42px`, CTA на `97.5px` выше fixed nav;
- `375×812`: document overflow `0`, CTA на `151.5px` выше fixed nav;
- `1280×900`, DE/light: document overflow `0`, 0 русских утечек внутри Board;
- console errors: `0`;
- offline Take: active state остаётся `0`, CTA остаётся, появляется честная ошибка «Ничего не изменено»;
- успешные Take и Complete проверены live, focus после commit возвращается на authored heading.

## Визуальные артефакты

- `docs/design-qa/2026-08-12-board-v149/board-360x800-dark.jpg`
- `docs/design-qa/2026-08-12-board-v149/board-375x812-dark.jpg`
- `docs/design-qa/2026-08-12-board-v149/board-1280x900-light-de.jpg`
- `docs/design-qa/2026-08-12-board-v149/board-journal-360.jpg`
- дополнительные full-page captures лежат в той же папке.

Файлы имеют JPEG/JFIF bytes и корректное расширение `.jpg`.

## Изменённый release scope

- `public/app.js`
- `public/styles.css`
- `public/board-pool-v1.js`
- `public/sw.js`
- `server.js`
- `scripts/board-design-v149.test.js`
- `scripts/board-data-v149.test.js`
- `scripts/account-lifecycle-v1.test.js`
- SW-pin tests
- `DEVLOG.md`
- `docs/design-qa/2026-08-12-board-v149/*.jpg`

Art-деревья и runtime-art не менялись.

## Следующий отдельный релиз

Если запускать публичные выполнения сезонных заказов, сначала нужен контракт social proof: отдельное согласие на каждый upload/publication, audience и removal, moderation/reporting, no-rank/no-like default, лимиты/anti-abuse, media retention/export/delete, legal review и RU/EN/DE/UK/ES QA. Только после этого текущий приватный journal можно расширять в общую сеть.
