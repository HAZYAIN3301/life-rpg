# Board v2 — discovery provider и city-level privacy

Дата решения: 2026-08-25. Статус: архитектурный контракт, bounded Brave adapter и строгий JSON-LD verifier готовы; `server.js` endpoint, fallback extractor и UI ещё не подключены.

## Решение

Первичный provider для первого production-среза — **Brave Web Search API**. Он используется только как поиск возможных официальных страниц. Результат Brave сам по себе не становится заказом.

После поиска отдельный verifier обязан открыть прямой источник организатора, площадки или официального маршрута и подтвердить:

- точное название;
- адрес;
- для события/секции — будущие дату и время;
- цену или явно подтверждённое `бесплатно`;
- актуальную доступность;
- одну открываемую HTTPS-ссылку действия.

Если хотя бы одного обязательного факта нет, Board не показывает расплывчатую замену.

## Почему Brave Web Search

Актуальный на 25 августа 2026 года public price Brave Search — **$5 за 1000 запросов**, с **$5 бесплатных кредитов каждый месяц**. Web Search поддерживает country/language targeting и freshness filters. Это дешевле Tavily basic ($0.008 за credit/request) и OpenAI web search ($10 за 1000 вызовов плюс токены модели).

Brave Place Search существует и принимает `location` строкой вида `city + country`, поэтому точные координаты технически не обязательны. Но Place Search тарифицируется отдельно, а его POI-ID временные и истекают примерно через 8 часов. Поэтому он остаётся опциональным вторым адаптером, а не источником долговечной идентичности заказа.

Google Custom Search не рассматривается: API уже закрыт для новых клиентов и прекращает работу 1 января 2027 года. Google Places не выбран ядром из-за более высокой стоимости расширенных полей и ограничений на кеширование Places content. Public Nominatim не подходит как production dependency: максимум один запрос в секунду, нет autocomplete и сервис может изменить политику/доступность без предупреждения.

Официальные источники решения:

- Brave Search API pricing: <https://brave.com/search/api/>
- Brave Web Search targeting/freshness: <https://api-dashboard.search.brave.com/app/documentation/web-search/get-started>
- Brave Place Search: <https://api-dashboard.search.brave.com/documentation/services/place-search>
- Tavily pricing: <https://docs.tavily.com/documentation/api-credits>
- OpenAI pricing: <https://platform.openai.com/pricing>
- Google Custom Search lifecycle: <https://developers.google.com/custom-search/v1/overview>
- Google Maps pricing: <https://developers.google.com/maps/billing-and-pricing/pricing>
- Google Places policies: <https://developers.google.com/maps/documentation/places/web-service/policies>
- Public Nominatim policy: <https://operations.osmfoundation.org/policies/nominatim/>

## Privacy

Согласие выдаётся на **город**, страну, язык и timezone. В аккаунт Board не пишет:

- GPS/точные координаты;
- домашний адрес;
- provider snippets или полный provider payload;
- временные Brave POI-ID;
- произвольный пользовательский текст в поисковый запрос.

Поисковый запрос собирается из authored tags шаблона и city-level context. Отзыв согласия выключает новые локальные запросы. Это отдельное согласие Board, а не скрытое продолжение разрешения браузерной геолокации.

## Кеш и права хранения

Без отдельно подтверждённых storage rights raw-ответ Brave не сохраняется. Допустимый кеш содержит только минимальный нормализованный snapshot, повторно подтверждённый прямым источником:

- источник и время проверки;
- пользовательские факты заказа;
- expiry;
- ни одного provider snippet/ID/координаты.

Shared cross-user cache остаётся выключенным до юридической проверки тарифного плана. Персональный snapshot уже принятого заказа хранится как часть данных пользователя, но никогда не маскируется под актуальный после expiry.

TTL:

| Тип | Максимальная жизнь |
|---|---:|
| секция / событие | 12 часов, но не позже начала |
| место | 24 часа |
| маршрут | 7 дней |

## Выдача

Resolver возвращает:

1. один основной verified candidate;
2. максимум один запасной;
3. прямую ссылку и источник;
4. `no-verified-candidate`, если свежих вариантов нет.

Никакой стены вариантов и никакого «попробуй что-нибудь похожее».

## Текущий adapter boundary

`server-board-v2-discovery-v1.js` уже:

1. собирает Brave-запрос только из authored tags + city/country;
2. ищет не больше восьми HTTPS URL и отправляет verifier не больше четырёх;
3. не возвращает и не кеширует raw provider response;
4. принимает candidate только через `BoardV2Discovery`;
5. возвращает primary + один reserve и безопасный billing/audit;
6. честно выключен без server key.

`server-board-v2-page-verifier-v1.js` уже добавляет public-HTTPS/DNS/redirect/size/timeout gates и принимает только прямой organizer/venue JSON-LD. Это намеренно узкий первый слой: сайт без достаточного structured data не превращается в квест через догадку.

Следующий change-set: server-owned template→search registry + account-owned consent/cache endpoint, затем fallback extractor для официальных страниц без JSON-LD. Board UI не подключается, пока реальный Bielefeld smoke не проходит end-to-end QA.
