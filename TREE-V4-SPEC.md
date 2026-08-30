# Satoru Tree v4 — Real Path / Game Bonuses

Дата: 2026-08-30

Статус: accepted implementation contract
Исследовательская опора: `SKILLTREE-MASTERNAK-RESEARCH.md`

## Outcome

Tree v4 отвечает на один вопрос без подмены терминов: **что человек уже умеет в реальности и какой проверяемый шаг идёт следующим?** Внутренние бонусы Satoru остаются полезной игрой, но отделяются в слой «Игровые бонусы».

## Information architecture

### Tab 1 — Путь

- Default при входе.
- Hero: сфера, число подтверждённых вех, ближайшая веха.
- `Следующая реальная веха`: название, criterion, next action, prerequisites, один CTA.
- `Пройденный путь`: постоянная хронология claimed milestones с source/date/proof.
- `Дальше по маршруту`: закрытый disclosure с оставшимися вехами; без красного, дедлайнов и CTA на каждой строке.
- `Личная карта`: AI помогает уточнить именно capability path.

### Tab 2 — Игровые бонусы

- Существующий coordinate map игровых perk-узлов.
- Вверху прямое пояснение: «Бонусы работают внутри Satoru и не подтверждают реальное мастерство».
- Points, active perks, capstone и editor живут только здесь.
- В edit mode показывается полный исходный граф для сохранения power-user совместимости.

## Claim transaction

1. Пользователь открывает ближайшую доступную веху.
2. До решения видит criterion.
3. Может оставить proof note / ссылку.
4. Подтверждает self-attestation либо откладывает.
5. Client повторно проверяет prerequisites и состояние.
6. Claim записывает `unlocked`, `claimedAt`, `claimSource`, `proofNote`.
7. `Store.saveNow('skilltree', ...)` обязан завершиться до ceremony/journal receipt.
8. При ошибке state откатывается и показывается retry-safe сообщение.

Импортированные claims имеют `claimSource:'import'`, `claimedAt:'import'`; UI не пытается форматировать `import` как ISO-date.

## AI contract

Server возвращает 4–6 ordered proposals:

```json
{
  "proposals": [
    {
      "title": "short real result",
      "criterion": "one observable completion condition",
      "nextAction": "one action feasible in the coming week"
    }
  ]
}
```

Provider compatibility: client принимает legacy `desc` как fallback для `criterion`, но новые nodes хранят `criterion` и дублируют его в `desc` для старого export/UI.

## Additive migration

- Tree получает `schemaVersion: 4` при первом безопасном ensure.
- Missing `kind`: `milestone === true ? 'capability' : 'practice'`.
- Missing `criterion` у capability: локализованное `desc` остаётся runtime fallback; канонический RU-текст не копируется в пользовательское поле.
- Missing `claimSource`: `claimedAt === 'import' ? 'import' : unlocked milestone ? 'self' : absent`.
- Ни одно существующее поле не удаляется и не переименовывается.
- Custom/unlocked/position/requirements/perks/capstone/title keys остаются byte-semantic эквивалентны.

## Design contract

- Те же cards/tokens/type roles, без новой эстетики.
- Path first contour: один primary CTA; не больше двух structural surfaces до следующего действия.
- Locked future — flat rows inside disclosure, не card forest.
- Earned trace uses stable green semantics; next capability uses amber milestone semantics; practice uses existing cyan/area color.
- State различим без цвета: label + icon + border style.
- Touch targets ≥42px.
- 360×800, 375×812, 1280×900; dark/light; RU/EN/DE/UK/ES; 200% text scaling; keyboard; screen-reader labels.
- Motion only finite reveal/receipt; reduced motion disables it. Existing three-cycle recommendation pulse stays only in Practices.
- Assistant FAB remains visible on both layers.

## Non-goals

- Автоматическая профессиональная сертификация.
- Общая публичная taxonomy всех человеческих навыков.
- Cross-sphere shared-node UI.
- Leaderboard реальных навыков.
- Удаление старой perk economy или editor.

## Release gates

- Legacy/corrupt/custom saves.
- One next capability, future collapsed, earned trace permanent.
- Practice layer explicit non-mastery language.
- Claim is durable before celebration and rolls back on save failure.
- AI schema + legacy fallback.
- Guide v3 открывает Path, находит ближайшую доступную capability и объясняет семантическую границу до знакомства с perk economy. Ради прохождения гайда capability подтверждать нельзя.
- Реальное безопасное действие Guide — открыть точную подсвеченную сферу; receipt переносит spotlight на её ближайшую веху. Game Bonuses остаются отдельным самостоятельным слоем.
- Full focused tests + syntax + local DOM/browser matrix.
- Cache/index pins and service worker bumped together.
