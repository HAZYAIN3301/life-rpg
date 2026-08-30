# Guide v3 × Tree v4 — release handoff v205

Дата: 2026-08-30

Статус: готово к production release

## Что изменилось

Contextual-глава Guide v3 больше не учит тратить очко на старом perk-графе. Теперь она
объясняет честную модель Tree v4:

1. `Путь` хранит реальные результаты, criterion и ближайший следующий шаг.
2. `Игровые бонусы` меняют только Satoru и не доказывают навык.
3. Безопасное действие главы — выбрать подсвеченную сферу. Гайд не нажимает
   «Уже сделано», не создаёт proof и не списывает bonus points.

## Runtime contract

- Registry Tree: version `3`, action `inspect-real-path`.
- Eligibility: уровень `>= 3` и существующая ближайшая доступная capability; bonus points
  не участвуют в trigger.
- Candidate: сначала недавно активная сфера, затем больший skill level, затем стабильный
  пользовательский порядок.
- `intro`: spotlight на навигацию «Герой».
- `engage`: exact `[data-action="select-tree"][data-skill="…"]`, слой `Path`.
- `complete`: exact `[data-guide-target="tree-v4-next"][data-node="…"]`.
- `tree-select-node` относится к `Game bonuses` и не завершает главу.
- Legacy milestone без `nextAction` не получает выдуманного шага: Guide предлагает сначала
  уточнить его с Тенью.

## Copy и локализация

- Runtime copy выпущена атомарно на RU/EN/DE/UK/ES.
- Versions: RU `1.4.0`; EN/DE/UK/ES `0.5.0`.
- Русский review mirror синхронизирован с runtime.
- Термины разделены последовательно: `Путь / Path` и
  `Игровые бонусы / Game bonuses`.

## Проверки

- Full repository: `1237/1237 PASS`.
- `node --check`: `public/app.js`, Guide model, presenter и пять copy-модулей — PASS.
- `git diff --check` — PASS.
- Browser `1280×900` и `375×812`: intro → exact sphere → nearest capability → durable finish.
- После полного reload сохранены `tree:intro`, `tree:engage`, `tree:complete`, глава `tree`
  находится в `completedChapters`.
- Нет horizontal overflow; FAB Тени видим; browser console: `0` warnings/errors.

## PWA release

- Shell/cache: `satoru-v205`.
- `index.html` атомарно пинит app, Guide model, presenter и пять copy-модулей build
  `20260830-guide-tree-v205-1`.
- Старые аккаунты, уже завершившие Tree-главу, не заставляются проходить её повторно.
  Новые прохождения и replay используют актуальную семантику Tree v4.

## Связанные документы

- `TASK-CODEX-GUIDE-V3.md` — актуальный Guide contract.
- `TREE-V4-SPEC.md` — продуктовый и data contract Tree v4.
- `TREE-V4-QA.md` — общий Tree v4 release gate.
- `SKILLTREE-MASTERNAK-RESEARCH.md` — evidence note по исследовательской работе.
