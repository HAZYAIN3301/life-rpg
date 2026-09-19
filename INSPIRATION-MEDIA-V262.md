# Вдохновение: Pinterest и TikTok, v262

> Этот пакет выпущен в составе [v265](./INSPIRATION-VISUAL-V265.md).
> `mediaType:unknown` не объявляется статичным фото, но безопасное официальное
> thumbnail разрешено как превью конкретного поста. Его полный просмотр — embed.

`public/inspiration-media-v1.js` — чистый browser/Node adapter. Он не отправляет
запросы, не загружает сторонний JavaScript в Satoru, не сохраняет профиль и не
подтверждает доступность, права или просмотр материала. Допуск и история остаются
у supply/profile и существующего owner settings writer.

## API

- `parseSource(url | {url})` возвращает `{provider, id, url, format, authorHandle}`
  либо `null`. Поддерживаются конкретные HTTPS Pinterest pins и TikTok videos;
  tracking query/fragment удаляются. Доски, профили, поиск, сокращённые ссылки,
  credentials, посторонние hosts/ports не принимаются. Pinterest `format:'image'`
  — исходный тип ссылки, а не проверка содержимого: автоматически показывать можно
  только проверенный статичный pin. Pinterest также содержит видео.
- `buildEmbed(source | url)` возвращает single-media URL либо пустую строку.
  Pinterest использует `https://assets.pinterest.com/ext/embed.html?id=…`;
  TikTok — `https://www.tiktok.com/player/v1/…` с `autoplay=0`, `loop=0`, `rel=0`,
  controls, описанием и атрибуцией. Внешний `pinit.js` в authenticated SPA не нужен.
- `isAllowedEmbed(url, expectedSource?)` проверяет точные host/path/query и,
  когда передан source, provider/id. Второй аргумент следует передавать при
  открытии карточки. Дубликаты query, autoplay/loop, Pinterest grids и чужой id
  не допускаются. Это отдельный allowlist двух новых providers; старые источники
  по-прежнему проверяются собственным существующим policy.
- `safeImage(url, provider?)` допускает конкретные `i.pinimg.com` hash-path images
  JPG/PNG/WebP, `p16.muscdn.com/obj/tos-…` из официального oEmbed примера TikTok и
  `p16-common-sign.tiktokcdn-eu.com/tos-…/*.image` из фактического ответа 13.09.
  Нет data/blob/SVG/GIF, неизвестных CDN или arbitrary URLs. Пустая строка означает
  отсутствие разрешённого preview. Poster не является доказательством playback.
- `parsePlayerEvent(event, iframe.contentWindow, source?)` проверяет точные
  `event.source`, `https://www.tiktok.com` origin и boolean `x-tiktok-player`.
  Возвращает `{type:'ready'|'init'|'playing'|'paused'|'buffering'|'ended'}`,
  `{type:'time',currentTime,duration}`, `{type:'error',code}` или `null`.
  Строки JSON, чужие frames/origins и неверные значения отклоняются.

## Серверные metadata конкретного референса

`server-inspiration-media-v1.js` экспортирует
`createMetadataResolver({fetchImpl?, timeoutMs?, maxBytes?, maxConcurrent?, now?})`.
Экземпляр имеет `resolve(url | source, {signal?})`. Defaults: 6.5 секунды на весь
запрос вместе с body, 128 KiB JSON, максимум четыре одновременных обращения.
Авторизацию, ограничения частоты API и отмену после ухода клиента подключает
серверный route интегратора; модуль не регистрирует endpoint сам.

Успех возвращает `{status:'resolved', source, title, description, authorName,
authorUrl, attributionKind, thumbnailUrl, thumbnailWidth, thumbnailHeight,
mediaType, embedUrl, checkedAt}`. `resolved` означает только metadata.
`attributionKind:'pinner'` не выдаёт сохранившего pin за автора изображения.
`mediaType:'image'` требует явный `is_video:false` без story; video и неизвестный
тип не подходят для автоматического показа как статичной фотографии. У первого
референса владельца title/description отсутствуют — они остаются пустыми.

Отказ возвращает `{status:'invalid'|'busy'|'unavailable', reason, source}`.
Причины включают `unsupported_source`, `cancelled`, `timeout`, `not_found`,
`provider_unavailable`, `invalid_response`, `invalid_json`, `invalid_metadata`,
`response_too_large`, `redirect_refused`, `network`. Raw provider errors, HTML,
биографии, счётчики вовлечения и исходный полный JSON не возвращаются.

Сетевые адреса формируются только из проверенного id/canonical URL:

- TikTok: `https://www.tiktok.com/oembed?url=…`.
- Pinterest: `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=…&sub=www&base_scheme=https`.
  Это публичные данные **того же single-pin widget**, подтверждённые исходником
  [pinterest/widgets/pinit_main.js](https://github.com/pinterest/widgets/blob/master/pinit_main.js):
  `endpoint.pin` и `seek.embedPin` (строки 3165 и 2451–2475 на дату проверки).

Redirects запрещены, cookies/Authorization/Referrer не передаются. Нет чтения
страниц Pinterest, сокращённых ссылок, досок, поиска или private/internal API.
JSONP не исполняется. Изображения/видео не скачиваются. Подпись TikTok thumbnail
сохраняется и может истечь; для обновления нужен новый запрос metadata.

## Обязательства вызывающего UI

Iframe создаётся только после проверки source/admission; видео — по явному клику.
На `ended` **и** `error` удалить iframe и его listener, вернуть конечное состояние
карточки и фокус. При timeout также показать честную недоступность. При переходе
между экранами/аккаунтами закрыть открытый player. Поздние messages старого frame
не должны управлять новой карточкой. `ready` и `iframe.onload` не равны playback;
сообщение `ended` не создаёт скрытую owner-запись «просмотрено».

`rel=0` у TikTok показывает другие ролики того же автора, а не отключает
рекомендации. Поэтому конечность обеспечивает удаление frame вызывающим UI,
включая ошибку. Sandbox не должен разрешать top navigation. Не добавлять
сторонний embed script с доступом к DOM/данным основного приложения.

## Источники и границы проверки

- [Pinterest widgets](https://developers.pinterest.com/docs/web-features/widgets/)
  описывают single `embedPin`; [About add-ons](https://developers.pinterest.com/docs/web-features/add-ons-overview/)
  рекомендуют не размещать их script на страницах с чувствительными данными.
- Корневой интегратор 13.09.2026 открыл официальный `assets.pinterest.com`
  single-pin endpoint для `974818281863152085`: реальный коллаж, атрибуция
  `༺CLAY💋`, без входа и рекомендаций. Это наблюдение отдельного официального
  widget; размеры/встраивание в Satoru проверяет интегратор.
- [TikTok Embed Player](https://developers.tiktok.com/docs/en/embed-player)
  определяет URL, параметры и messages. [Embed Videos](https://developers.tiktok.com/docs/en/embed-videos)
  документирует official oEmbed и thumbnail origin. Проверенный интегратором
  player для `7647936071673629973` отдал metadata, но проигрывание завершилось
  network error; этот опыт **не подтверждает** работоспособность ролика.

Профильная проверка: `node --check` обоих модулей и
`node --test scripts/inspiration-media-v1.test.js scripts/server-inspiration-media-v1.test.js`
— 21/21 PASS. Проверены canonical identity, URL/query injection, чужой id,
source/origin spoofing, некорректные messages, preview hosts, browser export,
redirect/HTML/JSONP/oversize/timeout/cancellation, лимит запросов и отсутствие
сырого provider payload. Реальный resolver 13.09 в 12:01 UTC вернул metadata
для Pinterest pin `974818281863152085` (564×559) и TikTok edit
`7647936071673629973` (poster 1024×576); оба `resolved`, без скачивания файлов.
Root выполняет integrated UI, production bytes и реальный playback после подключения.
