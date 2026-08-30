# Tree v4 — QA and release handoff

Дата: 2026-08-30

Версия shell: `satoru-v205`

Статус: Tree v4 implementation complete; Guide v3 adapter v205 проходит release verification

## Что проверяем

Tree v4 должен отвечать правдиво на два разных вопроса:

- `Путь`: что человек реально уже может и какой проверяемый результат идёт следующим;
- `Игровые бонусы`: какие эффекты он открыл внутри Satoru за очки практики.

Покупка бонуса не может называться подтверждением способности. Подтверждённая веха не может молча исчезнуть из истории.

## Automated gate

Запуск из корня проекта:

```bash
npm test
```

Профильные suite:

```bash
node --test scripts/skill-tree-v4.test.js
node --test scripts/guide-tree-v4-v205.test.js
node --test scripts/tree-v4-server-contract.test.js
node --test scripts/skill-tree-craft-v1.test.js
node --check public/app.js
node --check server.js
```

Результат перед релизом: `1237/1237 PASS`, `node --check` для клиента и сервера — PASS, `git diff --check` — PASS.

Покрытие Tree v4:

- default `Path`, отдельный `Game bonuses` и явный non-mastery copy;
- additive/idempotent migration `schemaVersion:4` без потери IDs, unlocks, perks и координат;
- criterion/evidence/provenance с HTML escaping;
- `saveNow` до закрытия claim sheet и rollback при ошибке;
- запрет dependency cycles и удаления подтверждённых capability;
- write fence повреждённого `skilltree`;
- AI schema `title + criterion + nextAction`, 4–6 полных ступеней;
- crash-export redaction для `criterion`, `nextAction`, `proofNote` при полном owner export;
- RU/EN/DE/UK/ES literal-copy gate;
- 360/375/1280, touch, light/dark и reduced-motion CSS contracts;
- Guide v3 registry v3 для Tree: capability-кандидат без зависимости от bonus points;
- contextual action открывает exact sphere на `Path`, а receipt указывает на ближайшую реальную веху;
- старый `tree-select-node` больше не может завершить новую главу игровым бонусом;
- синхронный PWA bump `app.js / sw.js / index.html` до v205.

## Browser matrix

Обязательные состояния:

1. Новый/legacy account: Path открывается первым, одна ближайшая веха выше future disclosure.
2. Подтверждение: criterion виден до действия; пустое proof допустимо; failure не закрывает sheet.
3. Earned trace: source/date/proof остаются после reload; HTML в proof выводится как текст.
4. Game bonuses: очки, perks, capstone и editor находятся только во вторичном слое.
5. Editor: capability/practice выбираются явно; confirmed capability нельзя удалить или превратить в practice; cycle rejected.
6. Personal path: preview показывает criterion и nextAction; выбранная карта сохраняется durable; прошлые claims остаются.
7. Guide v3: contextual Tree chapter открывает `Path`, подсвечивает сферу с ближайшей capability и после выбора переводит spotlight на саму веху. Подтверждать веху ради гайда не требуется.
8. Width/theme matrix: `360×800`, `375×812`, `1280×900`; dark/light; `prefers-reduced-motion`.
9. Keyboard: tabs, next CTA, future disclosure, claim trap/escape, editor controls.
10. PWA: v204 client видит v205 update; app shell и stable URLs доступны после reload.

Локальный acceptance перед релизом:

- `1280×900`, `375×812`, `360×800`: document overflow отсутствует;
- все видимые действия Tree имеют высоту не меньше `42px`;
- Path открывается первым в свежей сессии, Game bonuses переключается отдельно;
- criterion виден до claim; Escape закрывает sheet и возвращает фокус;
- claim с HTML-подобной заметкой сохраняет её как текст, без DOM injection;
- подтверждённую capability нельзя сменить на practice или удалить;
- dark/light проверены визуально; reduced-motion и пять локалей закрыты автоматическими контрактами;
- browser console: `0` warnings/errors после полного сценария.

Guide v3 adapter acceptance (`1280×900`, `375×812`):

- intro открывает Tree на `Path`, а не на `Game bonuses`;
- spotlight сначала указывает на точную сферу с доступной capability, затем на её ближайшую реальную веху;
- criterion и безопасный fallback для отсутствующего legacy `nextAction` видны до любого подтверждения;
- финальная кнопка закрывает главу только после durable write: `tree:intro`, `tree:engage`, `tree:complete` и глава `tree` переживают полный reload;
- горизонтального overflow нет, FAB Тени остаётся видимым, browser console: `0` warnings/errors.

## Privacy boundary

- `/api/account/export`: полный пользовательский Tree, включая его собственные criterion/nextAction/proof.
- Full admin userdata: полный Tree в разрешённом владельцем административном контуре.
- Crash reproduction export: структура графа остаётся, но свободный личный текст `criterion`, `nextAction`, `proofNote` удаляется рекурсивно.

## Связанные документы

- `SKILLTREE-MASTERNAK-RESEARCH.md` — разбор источника и степень доказательности.
- `TREE-V4-SPEC.md` — runtime/UI/data contract.
- `DESIGN-CRAFT-RULES.md` — surface, typography, touch и motion gates.
- `TREE-V3-PLAN.md` — история предыдущей модели.
