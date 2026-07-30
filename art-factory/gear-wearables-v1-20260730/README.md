# GEAR wearables v1

Арт-контракт для визуальной проекции 15 существующих предметов `GEAR`.
Runtime не изменён.

## Главные файлы

- `GEAR-WEARABLE-MATRIX.md` — дизайн и production-порядок всех 15 предметов;
- `art-manifest.json` — машинный split `inventoryIcon` / character-specific
  `avatarLayers`;
- `inventory/w1-training-blade.png` — QA-passed inventory pilot;
- `previews/w1-contact-sheet.png` — визуальный geometry gate;
- `WEAPON-GRIP-CONTRACT.md` и `contracts/weapon-grip-v1.json` — что нужно
  добавить в Traveller и Scholar, прежде чем оружие можно честно держать;
- `qa-report.json` / `qa-report.md` — автоматические и визуальные проверки.

## Пересборка w1

```bash
python3 gear-wearables-v1/build_w1_pilot.py
```

Скрипт использует уже очищенный material source
`generated/w1-material-alpha.png`, заново строит inventory icon,
character-specific placement/hand masks, prototype layers, contact sheet и
QA. Production avatar layers намеренно не создаются, пока не готов
closed-grip hand bundle.
