## Codex 29.09 — v313: привычки продвигают совместные проекты

Сохранённые полные и двухминутные отметки доступны рядом с делами. Одна привычка за
один день — один вклад: отмена/повтор не удваивают прогресс, дополнительных наград нет.
Названия остаются личными; старые task-вклады совместимы без миграции.
Контракт и приёмка: [MULTIPLAYER-HABITS-V313.md](./MULTIPLAYER-HABITS-V313.md).
Браузер: 120 состояний Chrome/WebKit, оба проекта через задачи и привычки, без ошибок.
Production receipt после публикации — во внешнем CHECKPOINT.
Фокус пока не подключён: таймер хранит сумму минут, нужна отдельная запись завершения.
Новые главы, пилот, баланс золота, G03 и отдельный аватар остаются в очереди.

## Codex 28.09 — v312: совместные проекты меняют общее Логово

Владелец выбрал проекты. В Племени доступны «Вечерний очаг» (6 сохранённых дел) и
«Зелёное окно» (8): промежуточные изменения, огонь/вечер и растения остаются в общей сцене.
Два участника для завершения; без срока/штрафов/новых начислений. Названия дел приватны.
Повтор, CAS, выход/rejoin и удаление аккаунта сохраняют общий результат корректно.

Контракт: [MULTIPLAYER-PROJECTS-V312.md](./MULTIPLAYER-PROJECTS-V312.md);
[QA](./MULTIPLAYER-PROJECTS-V312-QA.md): 3241/3241 tests, 120 UI-состояний Chrome/WebKit,
два сквозных прохождения обоих проектов, контраст ≥6.40:1. Публикация ещё не подтверждена;
квитанция будет во внешнем CHECKPOINT. Остались привычки/фокус как источники, новые главы,
пилот, баланс золота, G03, монетизация и отдельный аватар. Это первый цикл, не бесконечная игра.

## Codex 28.09 — v311, M04A: общее Логово в приложении

После отрицательной приёмки M01 сделан live-маршрут: цель мебели в «Сегодня» → обычное
выполнение дела → покупка существующим владельцем экономики → размещение в общей комнате
Племени. Оба участника видят свои вещи; права, CAS, повтор после потери ответа и выход из
группы проверяются отдельно от личного кошелька. Нового заработка/цены/Pro нет.

Контракт и границы: [MULTIPLAYER-M04-SHARED-DEN.md](./MULTIPLAYER-M04-SHARED-DEN.md).
QA: [MULTIPLAYER-M04-QA.md](./MULTIPLAYER-M04-QA.md). Публикация ещё не подтверждена;
финальная квитанция — во внешнем CHECKPOINT. Это **часть M04**, не завершение multiplayer.
Далее: продуктовая приёмка этой связки; личные зоны/общие проекты и памятный предмет,
M05, проверка баланса, G03 и пилот. Старый M01 отвергнут; не возвращать его как готовый продукт.

**Codex 28.09 — M03B + M01, кандидат:** серверное ядро подключено к API;
выход/распад компании восстанавливаются через журнал, удаление аккаунта обезличивает вклад.
Игровой прототип для телефона: `/experiments/lighthouse-m01.html` — две роли, два маршрута,
три пары инструментов, совместный финал. **Это отдельный прототип, не live-маршрут Племени**;
золото/инвентарь не меняются. Контракт: [MULTIPLAYER-M03B-M01.md](./MULTIPLAYER-M03B-M01.md),
[приёмка](./MULTIPLAYER-M03B-M01-QA.md). Полный suite 3233/3233; M01 — 48 прохождений,
292 состояния Chrome/WebKit. Следующий gate: реакция владельца на игровую механику M01,
затем versioned события/награда/inventory/сквозной UI. Shell v310 сохранён (SHELL не менялся).
Deployment пока не подтверждён; итоговая квитанция — сверху внешнего CHECKPOINT.


**Codex 28.09 — M03A, кандидат серверного фундамента multiplayer:** отдельный журнал
главы/использованных действий, согласие, постоянная цель, replay/conflict, отзыв и
обезличивание. 21 целевая проверка; полный suite **3224/3224**. Контракт:
[MULTIPLAYER-FOUNDATION-M03A.md](./MULTIPLAYER-FOUNDATION-M03A.md),
[QA](./MULTIPLAYER-FOUNDATION-M03A-QA.md). **Пока не подключено к server.js/UI**:
следующий пакет — authenticated API + lifecycle + один доступный маршрут Маяка.
Золото/рейды/Pro/Senku не менялись. PWA v310 сохранён: кешируемые файлы не менялись.
Публикация ещё не подтверждена; квитанция будет во внешнем CHECKPOINT.

**Codex 28.09 — G02 опубликован / v309:** runtime `9a9a940e`, Railway
`5ae65f18-8e30-4bfb-8576-15e44936e4a2` SUCCESS. Оба домена, SHA-256 **22/22**;
Chromium/WebKit production без page errors; существующий PWA v308→v309.
Goal module и все 4 WebP в новом кеше, мебель декодируется при отключённой сети.
3189/3189 tests, 320 UI states, durable flows и CAS двух вкладок.
Приёмка: [GOLD-G02-V309-QA.md](./GOLD-G02-V309-QA.md). Остаток — G03 и далее;
оплата/Pro, общий гардероб, device/Apple gates не закрыты этим выпуском.

**Codex 28.09 — G02 / v309 candidate:** «Тихий вечер» — три рисованных предмета
с прежними правами/ценами, дневная чистая сцена, примерка до накопления и одна
сохраняемая цель без резервирования золота. 3189/3189 tests; 320 UI states,
Chromium/WebKit durable flows и две вкладки. [GOLD-G02-V309-QA.md](./GOLD-G02-V309-QA.md).
Следующее: G03 — применение/планирование личных наград. Pro/платежи не менялись.
Deployment ещё не подтверждён; публикационная квитанция будет сверху.

**Codex 28.09 — G01 опубликован / v308:** runtime `84adecd2`, Railway
`0b0ea068-73cb-4405-b504-08585f294d57` SUCCESS. Оба домена подтверждены,
SHA-256 10/10; production Chromium/WebKit без page errors; существующий PWA
v307→v308 с активным worker. 3186/3186 tests. Подробности: [GOLD-G01-V308-QA.md](./GOLD-G01-V308-QA.md).
Дальше: авторская мебель 3–5 предметов + цель накопления, затем остальные пакеты
G02–G08. Общий гардероб Traveller, новая мебель и монетизация ещё не реализованы.

**Codex 28.09 — G01 / v308 candidate:** видимая рамка/фон портрета, подтверждённое
сохранение старого гардероба, предпросмотр покупки мебели/темы и world-space размещение
семи платных предметов. 3186/3186 tests; 200 modal + 120 screen states Chrome/WebKit,
реальные synthetic purchase/refusal/lost-response/retry/reload. Детали и границы:
[GOLD-G01-V308-QA.md](./GOLD-G01-V308-QA.md). Новая авторская мебель — следующий приоритет
перед сложным аватаром; цены/Pro/платежи не изменены. Deployment пока не подтверждён.


**Codex 28.09, 09:02 UTC — v307 опубликован.** Runtime `dd3c903`, Railway
`bdffc55b-4f21-406f-a9b1-dde5cf719c51` SUCCESS. Оба домена отдают этот commit и
`satoru-v307`; SHA-256 пяти shell-файлов **10/10**. Вход Chromium/WebKit на двух
доменах: 0 ошибок страницы. Уже открытый синтетический клиент обновился v306→v307
с активным service worker. Финальный suite: **3179/3179**, без пропусков.
Что изменилось и что ещё блокирует первый выпуск: [WEB-FINAL-V307-QA.md](./WEB-FINAL-V307-QA.md).
До решения владельца каталог Вдохновения не заменён; native/store gates не закрыты.

**Codex 28.09 — v307 candidate, единая web-приёмка:**
Подтверждённые достижения/повтор с той же датой, локализованный PiP, мгновенный
выход из помощника, контраст/типографика/цели нажатия. Матрица маршрутов и точные
границы: [WEB-FINAL-V307-QA.md](./WEB-FINAL-V307-QA.md).
R05/R06/04/06/07/09/10 — синтетическая web-приёмка сведена; 08 остаётся PARTIAL:
вкусы сохраняются, но каталог пуст для интерьеров/спортивных эдитов, TikTok playback
не подтверждён. Решение владельца по составу первого выпуска ожидается.
Native/device/App Store и полоса Claude — отдельные gates. Senku исключён владельцем.
Публикация ещё не подтверждена; актуальная квитанция будет добавлена сверху.

**Codex 28.09 — v306 опубликован:** `e8d73d1`, Railway
`19cb7802-07c3-480e-b72b-db6d9896860a` SUCCESS. Оба домена в 07:58 UTC
отдают `e8d73d1` / `satoru-v306`; SHA-256 app/index/sw — 6/6.
Вход Chromium на обоих адресах: 0 ошибок JS. 3175/3175 тестов;
WEB-RECEIPTS-V306-QA.md описывает изменения и границы приёмки.
Новые запуски эксперимента отложены по решению владельца; история сохранена.

**Codex 28.09 — v306 candidate:** owner approved deferring new experiment runs;
history/stop/export preserved. Entry completion and bond now share the durable owner
transaction; undo/replay cannot award bond again. Rename waits for persistence;
duplicate toasts suppressed. 3175/3175 tests, 40 Chromium/WebKit form layouts.
Details and remaining scope: WEB-RECEIPTS-V306-QA.md. Publication receipt pending.

# Release queue R04A → R06 — checkpoint (in-repo mirror)

## Codex — v303 published, 27.09

Runtime `b04258c`; Railway `981d77db-6bdd-4a1a-9eee-ada6f2039df2` SUCCESS;
both domains app/index/sw **6/6 SHA-256**, suite **3166/3166 PASS**.
Remaining gates and owner experiment choice are unchanged (see top BACKLOG).

## Codex — v302 receipt / v303 candidate

v303 full suite **3166/3166 PASS**, syntax/diff and five mobile locale checks PASS.

v302 `611cec0`: Railway `d7728c4b-6dd8-48fb-9d37-fd7d3afdfce8` SUCCESS, 6/6 hashes.
v303 discloses disconnected experiment observation intake; owner choice defer/integrate
pending. R05/R06 remain partially accepted. Habit pause/resume/next-day check passed.

## Codex — 27.09, v301 receipt / v302 candidate

v302 full suite **3166/3166 PASS**; six feature-write browser groups PASS.

- v301 `4eeb435`: Railway `d6ac1065-7ceb-4396-821b-ffff2909d7e9` SUCCESS, both domains
  return commit/cache at 20:10 UTC, app/index/sw **6/6 SHA-256**. Suite 3163/3163.
- v302 candidate: confirmed Pet and check-in, saved daily deduplication;
  COMPANION-CARE-V302-QA.md. R06 whole-package acceptance remains open.

## Codex — web/native, 27.09: v301 candidate

Full suite **3163/3163 PASS**; app/sw syntax and diff checks PASS.

R05 saved-route repairs and browser receipts: ROUTES-R05-V301-QA.md. Status/export of
the owner experiment and return to saved Board work are fixed. Proactive offer and
feedback/review timing remain open; R06 rewards is still a separate acceptance gate.
Publication/test receipt will be prepended after verification.

The owner's plan lives outside the repository (`satoru-release-plan-20260924/`:
START, CHECKPOINT, NEXT, video-review CRITERIA/EXECUTION). The cloud session that
works this queue cannot read it, so this file mirrors the queue state for the next
agent. Whoever has the local plan: copy the rows below into its CHECKPOINT/START/NEXT.

Base: v282 `c1f30ed` (published, 3094/3094 on the owner's machine).

| Package | Scope | State | Commit | Deploy / hashes |
|---|---|---|---|---|
| R04A | honest XP / load / insufficient base | **published** v283 | `65a58bb` | both domains `/api/version` commit `65a58bb`, `satoru-v283` at 09:10 UTC 25.09; 20/20 SHA256 (10 files × 2 domains); login page smoke, 0 errors |
| R04B | dense, understandable charts | **published** v284 | `06e7002` | both domains commit `06e7002`, `satoru-v284` at 09:37 UTC; 18/18 SHA256 (9 files × 2); login smoke 0 errors |
| R04C | AI lifecycle: timeout, cancel, late response | **published** v285 | `e4adff1` | both domains commit `e4adff1`, `satoru-v285` at 09:5x UTC; 16/16 SHA256 (8 files × 2); login smoke 0 errors, `/api/ai/analyze` unauthenticated 401 |
| R04D | export | **published** v286 | `1c3adf0` | both domains commit `1c3adf0`, `satoru-v286`; 18/18 SHA256 (9 files × 2); login smoke 0 errors; unauthenticated `/api/account/export` 401 (now reported in UI) |
| R05 | remaining screens by R03B (owner choice 25.09: «Экраны + Тень») | **published** v287 | `6a036a5` | both domains commit `6a036a5`, `satoru-v287`; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R06 | Shadow companion coherence: chat, support hints, Den, voice, states and tone | **published** v288 | `3a34a13` | both domains commit `3a34a13`, `satoru-v288` at 11:52 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R07 | follow-up: AI lifecycle on the remaining surfaces (owner 25.09: «делай дальше запланированное») | **published** v289 | `4af8474` | both domains commit `4af8474`, `satoru-v289` at 12:31 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R08 | follow-up: Today touch-target floors (R05 audit remainder) | **published** v290 | `c1e2856` | both domains commit `c1e2856`, `satoru-v290` at 12:36 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| R09 | owner decision: one Today hint — one action (rest, overload, mobility; teaser removed) | **published** v291 | `2e345bf` | both domains commit `2e345bf`, `satoru-v291` at 12:48 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| R10 | follow-up: hidden content (collapsed sections, Settings groups, light theme) | **published** v292 | `41e00cb` | both domains commit `41e00cb`, `satoru-v292` at 13:10 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R11 | follow-up: dialogs and real content (programs, sphere names, legacy windows) | **published** v293 | `e1d4989` | both domains commit `e1d4989`, `satoru-v293` at 13:36 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| v310 | owner exception 28.09: Senku bridge phase 1 — facts shown on Today, no economy effects | **published** v310 | `305f386` | both domains commit `305f386`, `satoru-v310` at 14:04 UTC 28.09; 8/8 SHA256 (4 files × 2); logged-out Chromium/WebKit iPhone 0 page errors; bridge routes 401 without session; 3203/3203 tests |
| v305 | Claude lane 28.09: extension 0.10.1 — bridge and links on satoruapp.com; store candidate | **published** v305 | `f67e8a3` | both domains commit `f67e8a3`, `satoru-v305` at 07:02 UTC 28.09; 16/16 SHA256 (7 site files + ZIP × 2); sign-in smoke WebKit+Chromium 0 page errors |
| v304 | Claude lane 28.09: extension 0.10.0 — chess puzzle every N minutes, motivation before entering | **published** v304 | `6a8742d` | both domains commit `6a8742d`, `satoru-v304` at 06:35 UTC 28.09; 16/16 SHA256 (7 site files + ZIP × 2); sign-in smoke WebKit+Chromium 0 page errors |
| v300 | owner 26.09: extension 0.9.0 — lock without early unlock, block-page motivation, store kit | **published** v300 | `1e6fffe` | both domains commit `1e6fffe`, `satoru-v300` at 19:45 UTC; 16/16 SHA256 (7 site files + ZIP × 2) |
| v299 | owner 26.09: extension 0.8.0 — merged adult list (535 578), Reddit NSFW guard | **published** v299 | `bd1d29d` | both domains commit `bd1d29d`, `satoru-v299` at 19:34 UTC; 16/16 SHA256 (7 site files + ZIP × 2) |
| v298 | owner 26.09: Mac app still showed the ZIP as text — shell downloads go to the other domain (system browser) | **published** v298 | `54234d4` | both domains commit `54234d4`, `satoru-v298` at 15:23 UTC; app.js, index.html, sw.js SHA-256 match on both domains |
| v297 | owner 26.09: extension 0.7.0, OISD NSFW adult list (505 602 domains), Adult on by default | **published** v297 | `4b34a47` | both domains commit `4b34a47`, `satoru-v297` at 14:43 UTC 26.09; 16/16 SHA256 (7 site files + ZIP × 2); login smoke WebKit+Chromium 0 page errors |
| v296 | owner reports 26.09: extension package in the Mac app, goal import blocked by legacy quests | **published** v296 | `3accbc7` | both domains commit `3accbc7`, `satoru-v296` at 14:23 UTC 26.09; 10/10 SHA256 (5 files × 2); login smoke WebKit+Chromium 0 page errors |
| R13 | local session 26.09: WebKit parity (Safari click focus, Settings → App on Safari/iOS) | **published** v295 | `b6bb1a8` | both domains commit `b6bb1a8`, `satoru-v295` at 09:02 UTC 26.09; 10/10 SHA256 (5 files × 2); login smoke WebKit+Chromium 0 page errors |
| R12 | follow-up: sign-in, registration and first run | **published** v294 | `0d7f3f5` | both domains commit `0d7f3f5`, `satoru-v294` at 14:02 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |

## Environment notes for this queue

- Full suite must run as a non-root user in the cloud container
  (`HOME=/tmp runuser -u nobody -- node --test --test-concurrency=2 scripts/*.test.js`).
  As root, two morning-outcome write-failure subtests cannot simulate a read-only
  directory and one test self-skips; as `nobody` they pass, matching the owner's Mac.
- Cloud container: only Chromium. WebKit matrix was run locally on 26.09 (R13).
- Settings writes go through `/api/commitments/commit` (WAL); intercept that URL,
  with service workers blocked, to test rejected writes.
- Production exposes `/api/version` (`commit`, `shellCache`) on both domains; deploy
  verification compares it and SHA256 of changed public files with the commit.

## Receipts

- **R04A / v283** `65a58bb` — full suite 3105/3105 PASS, 0 skipped (non-root);
  syntax and `git diff --check` PASS. Pushed fast-forward `c1f30ed..65a58bb` to master.
  Railway web deployed on both domains (~4 min after push). SHA256 match for app.js,
  design-next-v1.css, index.html, sw.js, sphere-load-v1.js, styles.css,
  interface-composition-v1.js, day-load-v1.js, chart-labels-v1.js,
  failure-context-v1.js on satoruapp.com and the Railway domain. Piper/TTS
  unchanged by this package (not re-verified). QA: PROGRESS-MEANING-V283-QA.md.
- **R04B / v284** `06e7002` — full suite 3108/3108 PASS, 0 skipped (non-root);
  fast-forward `64668d8..06e7002`. Both domains deployed (~3 min). SHA256 match for
  app.js, design-next-v1.css, index.html, sw.js, progress-charts-v1.js,
  chart-labels-v1.js, sphere-load-v1.js, styles.css, interface-composition-v1.js.
  QA: CHARTS-V284-QA.md.
- **R04C / v285** `e4adff1` — full suite 3115/3115 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (against the commit's blobs) for app.js,
  design-next-v1.css, index.html, sw.js, ai-request-v1.js, progress-charts-v1.js,
  sphere-load-v1.js, styles.css on both domains. Server change (provider idle
  timeout) is live with the same commit. QA: AI-LIFECYCLE-V285-QA.md.
- **R04D / v286** `1c3adf0` — full suite 3120/3120 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (commit blobs) for app.js, design-next-v1.css,
  index.html, sw.js, calendar-export-v1.js, ai-request-v1.js, progress-charts-v1.js,
  sphere-load-v1.js, styles.css on both domains. QA: EXPORT-V286-QA.md.

## R05/R06 preparation — route audit (Chromium, synthetic dense data)

16 routes (today, notes, calendar, habits, shelf, den, character, pets, goals, tree,
rewards, weekly, stats, party, leaderboard, settings) × RU/EN/DE/UK/ES at 375 and
RU/EN/DE at 1280: 0 horizontal overflow, 0 untranslated Cyrillic in EN/DE/ES,
0 page errors. Objective findings to fold into R05 once its scope is confirmed:
- weekly: task checkbox `toggle-task` 28×28 (SD-08 floor 42);
- settings (RU): labels cut with «…» — «Разбор недели», «Тень подбирает слова
  подсказки», «Чат-помощник» (TY-13); the last also at 1280;
- today: task title edit buttons 23px high and companion toggle 42×40 (R03A area;
  deliberately not changed without the owner's R05 scope);
- pets: disclosure summary 24px high.
- **R05 / v287** `6a036a5` — full suite 3124/3124 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (commit blobs) for app.js, design-next-v1.css,
  index.html, sw.js, styles.css, calendar-export-v1.js on both domains.
  QA: SCREENS-V287-QA.md.
- **R06 / v288** `3a34a13` — full suite 3128/3128 PASS, 0 skipped (non-root);
  fast-forward `c6b27aa..3a34a13` to master. Both domains deployed (~3 min). SHA256
  match (commit blobs) for app.js, design-next-v1.css, index.html, sw.js (changed)
  and styles.css, icon-registry.js (unchanged) on both domains; login page loads the
  v288 shell without console errors. QA: SHADOW-V288-QA.md.

- **R07 / v289** `4af8474` — full suite 3136/3136 PASS, 0 skipped (non-root);
  fast-forward `2bf47a4..4af8474` to master. Both domains deployed (~3 min). SHA256
  match against the commit blobs for app.js, design-next-v1.css, index.html, sw.js
  (changed) and styles.css, ai-request-v1.js on both domains; login page loads the
  v289 shell without console errors. QA: AI-SURFACES-V289-QA.md.

- **R08 / v290** `c1e2856` — full suite 3138/3138 PASS, 0 skipped (non-root);
  fast-forward `d1fdd07..c1e2856`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: TODAY-FLOORS-V290-QA.md.

- **R09 / v291** `2e345bf` — full suite 3142/3142 PASS, 0 skipped (non-root);
  fast-forward `a807e8d..2e345bf`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: TODAY-HINTS-V291-QA.md.

- **R10 / v292** `41e00cb` — full suite 3146/3146 PASS, 0 skipped (non-root);
  fast-forward `d9916eb..41e00cb`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css, telemetry-consent-v1.js on both domains; login smoke clean.
  QA: HIDDEN-CONTENT-V292-QA.md.

- **R11 / v293** `e1d4989` — full suite 3150/3150 PASS, 0 skipped (non-root);
  fast-forward `22806a1..e1d4989`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: DIALOGS-V293-QA.md.

- **R12 / v294** `0d7f3f5` — full suite 3152/3152 PASS, 0 skipped (non-root);
  fast-forward `8acdc36..0d7f3f5`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: FIRST-RUN-V294-QA.md.

- **R13 / v295** `b6bb1a8` — local session on the owner's Mac. WebKit matrix (69 runs,
  same as Chromium) found three WebKit-only issues, fixed; full suite 3154/3154 PASS,
  0 skipped; fast-forward `58fbe27..b6bb1a8`. Both domains deployed (~2.5 min). SHA256
  match for app.js, design-next-v1.css, index.html, sw.js, styles.css on both domains;
  logged-out page loads v295 in WebKit (iPhone profile) and Chromium without page errors.
  QA: WEBKIT-PARITY-V295-QA.md. Real-device checks: owner checklist (pending).

## Status 27.09 (local session on the owner's Mac)

Published: v295 (R13 WebKit parity), v296 (goal import + app-shell ZIP), v297/v299/v300
(Satoru Attention 0.7.0 → 0.9.0), v298 (shell downloads via the other domain) — rows and
receipts above. Owner decisions 26.09: no early unlock for the lock; bundled merged adult
list with Adult checked by default; Reddit stays open with the NSFW guard; doomscroll = chess
puzzle every N minutes + motivation (next: 0.10.0); iOS Family Controls in the native session;
store submission and the Brave lock profile are the owner's actions. Open: owner device
checklist answers, Chrome Web Store submission (then site link + profile ID), extension 0.10.0,
native blob exports and Family Controls. Current overview: START-HERE.md.

## Queue status after R06

All packages R04A → R12 are published. Owner decisions 25.09: monetisation gate —
no change until the owner's documents arrive; the companion name «Тень» stays.
The four filtered-out Today hints were resolved in R09 by the owner's choice.
26.09 local session: external plan synced; WebKit matrix done and its three WebKit-only
issues fixed in R13 / v295. Open: real-device checks (owner checklist — VoiceOver,
installed PWA, .ics import in Apple/Google Calendar, iOS share sheet, select height). The next
local session starts from LOCAL-SESSION-PROMPT.md; the synthetic browser audits used
for R04A–R12 are in `scripts/qa/` (Chromium/WebKit/Firefox via QA_BROWSER).
