# Design v245 — проверка 08.09.2026

Guest shell follow-up v246: marker нового дизайна поставлен в исходный HTML, чтобы
авторизация выглядела так же до загрузки аккаунта. `auth-mobile-v246.png` — локальная
ширина 390, отсутствие horizontal overflow. Full runtime gates сохраняются.
Production `f51b3ba`: оба Railway service success, 8 exact byte hashes PASS,
archive CSP/browser PASS (0 errors/API), unauthenticated login next design PASS.
`production-receipt.json` + `production-auth.png` + `production-classic-today.png`.
Playwright serviceWorkers:block нельзя применять к opaque iframe: инъекция самого
Playwright читает запрещённый Navigator getter. Финальный прогон — чистый браузер
без этой инъекции, с прежними строгими assertions.

Все данные на снимках вымышленные. Основной аккаунт не использовался.
Локальный server.js: 127.0.0.1:4183, отдельный DATA_DIR в /private/tmp.

## Покрытие

- `qa-design-current.mjs`: 16 маршрутов × desktop 1440/dark и touch 390/light;
  live app.js/style, только authentication bootstrap заменён fixture.
  32 отрисовки, отсутствие pageerror/error-card/document overflow; изображения и
  шрифт декодированы до снимка. JSON не заменяет визуальный просмотр.
- `qa-design-rollout.mjs`: все 16 маршрутов frozen v244 через настоящий iframe;
  0 API requests, 0 pageerrors; проверка исходных hashes — design-baseline-v1.test.js.
- `qa-design-edgecases.mjs`: 8 дополнительных сценариев 320/390/720/1024/1440,
  RU/EN/DE, пустой и плотный день, длинный заголовок, goal dialog, формы,
  mobile More/Escape, профиль/ссылка сравнения, light/dark system.
  Контраст проверенных непрозрачных primary-кнопок ≥4.5:1, reflow без горизонтального
  overflow документа. Ширина 720 — reflow, НЕ физическая проверка browser zoom 200%.
- `qa-design-save.mjs`: настоящий локальный аккаунт + реальные API/CAS:
  draft через render, 503 от ФАКТИЧЕСКОГО `/api/commitments/commit`, rollback и
  сохранённый draft, повтор → запись, reload, edit startTime/estimateMin, выполнение,
  reload, человекочитаемая completed evidence, открытие voice recap.
  Микрофон/ИИ-провайдер не вызываются. Request interception включён только локально.

## Что найдено и исправлено

- Фоновый repaint стирал набранную задачу → сохранён тот же DOM form до durable receipt.
- Старая add-submit grid-row перекрывала поле названия → явные строки формы.
- Touch checkbox привычки перекрывал текст → отдельная сетка 44px/title/time.
- Слишком узкие week columns ломали слова → минимальная ширина и внутренний scroll.
- Старый on-accent делал тёмный текст на тёмно-фиолетовом → единый контрастный токен.
- Completed evidence показывала ID (action resolver исключает done) → отдельная
  display-ветка; eligibility/завершение/экономика не изменены.
- Двойной iframe navigation → src задаётся только controls, не дважды.
- Fixture leaderboard был массивом вместо `{rows:[]}`; goal step имел text вместо title.
  Исправлены fixtures, а не ослаблены проверки error-card.
- Первая попытка fault injection не затронула CAS endpoint: это НЕ успешная проверка.
  Итоговый тест требует полученный 503 и ненулевой счётчик deniedWrites.

## Границы

Это не проверка каждого вложенного состояния всех функций, наполненной команды,
покупки за настоящее золото, работы Push/микрофона или физического iPhone/Safari.
Не менялась экономика, действия агента/entitlements, privacy consent или права аккаунтов.
Предыдущие art/персонаж/питомцы сохранены. Полный regression suite — 1929 тестов.

Отчёты: next-report.json, classic-report.json, edge-report.json, save-receipts.json.
Снимки `next-*`, `classic-*`, `edge-*` принадлежат этим сценариям; не пользовательскому аккаунту.
