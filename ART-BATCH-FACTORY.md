# Satoru Art Factory — Кот Удачи, состояния, скины и Тень

> Производственный бриф для автоматизированной генерации. Пользователь утверждает контактный лист; Codex сам разворачивает задания, генерирует ассеты, очищает фон, проверяет сборку и повторяет неудачные элементы. Контракт рига: `PET-PIPELINE.md`.

## 1. Что генерируется, а что собирается кодом

Не создавать цельную картинку для каждой комбинации состояния, окраса и предмета. Комбинаторика должна собираться из независимых осей:

- **вид:** Fortune Cat;
- **палитра:** `obsidian-gold` и `ivory-vermilion`;
- **состояние сытости:** `hungry`, `thriving`, `full`, `overfed`;
- **повадка:** отдельная короткая анимация или проп, не новый полный риг;
- **экипировка:** независимые слоты `head`, `neck`, `back`, позже `hand`;
- **Тень:** форма тира связи и выражение настроения являются разными слоями.

Так две палитры × четыре состояния × десять предметов не превращаются в 80 цельных изображений. Нужны два набора цветозависимых слоёв, несколько выражений лица и десять независимых предметов.

## 2. Первая production-партия

### Состояния Кота Удачи

Механические состояния уже существуют в `public/app.js`:

| id | Русский статус | Визуальное поведение |
|---|---|---|
| `hungry` | голоден | грустное лицо, опущенная энергия, прижатые уши, медленный хвост |
| `thriving` | растёт | базовое дружелюбное лицо, дыхание, моргание, поднятая лапа |
| `full` | доволен | закрытая довольная улыбка, румянец, активный хвост, лёгкий bounce |
| `overfed` | перекормлен | сонное/переполненное лицо, тяжёлое дыхание, увеличенный корпус, минимум движения |

Для первой версии генерируются только три новых общих слоя лица: `pet-face-hungry.png`, `pet-face-full.png`, `pet-face-overfed.png`. `thriving` использует текущий `pet-face.png`. Изменение размера тела, ушей, хвоста, бубенца и лап выполняется CSS-трансформами. Если поворот существующих ушей не даёт убедительного `hungry`, отдельной второй партией создаются `pet-ear-l-folded.png` и `pet-ear-r-folded.png`.

### Повадки Кота Удачи

Повадки из приложения:

1. что-то подсчитывает;
2. полирует свою монету;
3. пересчитывает мешок и сбивается;
4. машет лапой на удачу;
5. прячет заначку под подушку;
6. звенит бубенцом по важным делам;
7. изучает курс валют, щуря золотые глаза.

Пункты 2, 4 и 6 собираются движением уже существующих `pet-hand-item`, `pet-paw-raised` и `pet-bell`. Для остальных достаточно трёх дополнительных пропов на общем холсте:

- `prop-counting-coins.png` — 3–5 небольших монет перед котом;
- `prop-stash-bag.png` — небольшой мешочек с монетами, частично скрываемый телом;
- `prop-ledger-glasses.png` — круглые очки и маленькая открытая книга/табличка для курса валют.

Не генерировать семь полных котов.

### Каноничная бело-красная палитра

Skin id: `ivory-vermilion`.

- основная шерсть: тёплая слоновая кость, не чистый белый;
- пятна: киноварно-красные;
- внутренние уши: приглушённое золото или тёплая охра;
- глаза, нос, усы и бубенец: золото/тёмно-коричневый;
- ошейник: киноварно-красный с золотым орнаментом;
- рюкзак, монета, бубенец и тень переиспользуются из `obsidian-gold`, если контрольная сборка выглядит цельно.

Цветозависимые файлы:

`pet-tail.png`, `pet-body.png`, `pet-collar.png`, `pet-paw-raised.png`, `pet-paw-holding-arm.png`, `pet-paw-holding.png`, `pet-ear-l.png`, `pet-ear-r.png`, `pet-head-base.png`, `pet-head-patch-l.png`, `pet-head-patch-r.png`.

Геометрия, положение, мастер-холст и встроенные зоны перекрытия должны совпадать с `obsidian-gold` пиксель в пиксель. Это **редактирование существующих слоёв**, а не свободная повторная генерация.

### Стартовая кастомизация

Первая партия предметов — по два предмета на каждый существующий слот:

- `head`: красно-золотая корона удачи, круглые очки счетовода;
- `neck`: церемониальный красный бант, нефритовый амулет;
- `back`: свиток торговца, лёгкий праздничный плащ.

Каждый предмет — отдельный PNG на прозрачном `1024 x 1024` master canvas в финальной позиции. Предмет не содержит голову, тело, ошейник или рюкзак кота.

## 3. Тень: модульная схема

Не генерировать 24 цельных варианта (4 тира × 6 настроений).

Формы тира связи:

- `spark` — Искра;
- `spirit` — Дух;
- `guardian` — Страж;
- `keeper` — Хранитель.

Настроения из приложения:

- `calm`;
- `happy`;
- `radiant`;
- `sleepy`;
- `longing`;
- `caring`.

Production-схема: четыре базовых силуэта/ауры тира + шесть общих слоёв лица/эмоциональных частиц. Крылья, нимб, вторая аура и знаки тира — независимые декоративные слои. Сначала требуется style-check одного `spirit + calm`; остальные варианты генерируются только после его утверждения.

## 4. Мастер-промпт для отдельной задачи Codex

Скопировать целиком в новую задачу вместе с доступом к репозиторию:

```text
Ты работаешь над production-art системой Satoru в репозитории:
/Users/al.prokopets/Documents/Obsidian Vault/life-rpg

Твоя задача — не давать мне по одному ручному промпту, а самостоятельно провести пакетную арт-производственную работу. Я должен только проверить контактный лист и итоговую сборку.

Сначала прочитай полностью:
- STYLE-DECISION.md
- PET-PIPELINE.md
- ART-PIPELINE.md
- ART-BATCH-FACTORY.md
- public/app.js: PET_TRAITS, PET_STATE, PET_SPECIES, fortuneRigV2Markup, shadowVideo/COMP_LINES

Источник истины для геометрии Кота Удачи:
- public/art/pets/fortune-v2/
- public/fortune-rig-v2-demo.html

Правила работы:
1. Используй текущий собранный Fortune Cat v2 как неизменяемый geometry reference.
2. Для каждого входного изображения явно определяй роль: edit target, geometry reference или style/palette reference.
3. Новые растровые слои делай на абсолютно плоском #00ff00 chroma-key фоне без теней, градиента и отражений фона. Не используй #00ff00 в объекте.
4. После генерации сам удаляй chroma-фон штатным remove_chroma_key.py, проверяй alpha channel, прозрачные углы, отсутствие зелёной каймы и лишних объектов.
5. Все production-слои сохраняй на master canvas 1024 x 1024, не обрезай по контуру и не меняй координаты существующего объекта.
6. Никогда не перезаписывай утверждённый obsidian-gold. Создавай versioned skin/state каталоги.
7. Генерируй один distinct asset отдельным image-generation/edit вызовом. Не проси меня вручную запускать следующий промпт.
8. После каждой партии собери автоматический контактный лист и контрольную композицию. Сравни силуэт, позиции, z-order и масштаб с исходным assembled reference.
9. Сам отклоняй и повторяй слой, если геометрия поплыла, добавился фон, тень, обрезанный край, лишний объект или изменился стиль.
10. Не интегрируй ассеты в public/app.js до моего визуального утверждения контактного листа.

Партия A — три выражения состояния:
- pet-face-hungry.png
- pet-face-full.png
- pet-face-overfed.png

Партия B — skin ivory-vermilion, только цветозависимые слои из ART-BATCH-FACTORY.md.

Партия C — три пропа повадок:
- prop-counting-coins.png
- prop-stash-bag.png
- prop-ledger-glasses.png

Партия D — шесть стартовых предметов кастомизации из ART-BATCH-FACTORY.md.

Партия E — только один style-check Тени: tier spirit + mood calm. Не продолжай остальные формы Тени до моего утверждения этого style-check.

Покажи мне:
- контактный лист каждой завершённой партии;
- собранного чёрно-золотого кота в четырёх состояниях;
- собранного бело-красного кота в thriving-состоянии;
- кота с каждым из шести предметов;
- таблицу QA: размер, alpha, прозрачные углы, coverage, chroma fringe, совпадение master canvas.

Не публикуй и не коммить без моего явного разрешения.
```

## 5. Шаблоны внутренних промптов Art Factory

Эти шаблоны предназначены для Codex-оркестратора. Пользователь не должен запускать их по одному.

### A. Выражение состояния

```text
Use case: precise-object-edit
Asset type: animation-safe facial overlay for the Satoru Fortune Cat paper-doll rig
Input images: Image 1 = current pet-face.png edit target and exact geometry reference; Image 2 = assembled Fortune Cat identity/style reference
Primary request: create the <hungry|full|overfed> facial expression only
Style/medium: official Satoru handcrafted layered cut-paper illustration, identical paper grain, edge treatment, line thickness and gold/dark palette
Composition/framing: preserve the exact 1024x1024 master canvas and exact positions of eyes, brows, nose, whiskers and mouth
Constraints: change only the facial expression; no head, ears, body, collar, bell, props, text or symbols; no cast shadow; crisp isolated elements; animation-safe; no geometry drift
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform edge to edge
Avoid: glossy anime eyes, painterly rendering, extra highlights, emoji, tears outside the specified expression, additional objects, crop, scale or camera changes
```

Expression requirements:

- `hungry`: gently worried raised inner brows, slightly tired open eyes, small downturned mouth; sympathetic, never punished or sick.
- `full`: relaxed closed crescent eyes, warm smile, subtle cheek accents; content, not manic.
- `overfed`: heavy sleepy eyes or soft spirals, small open exhausted mouth; comically too full, never injured or grotesque.

### B. Бело-красный skin layer

```text
Use case: precise-object-edit
Asset type: one palette-variant layer for an existing Satoru Fortune Cat paper-doll rig
Input images: Image 1 = exact source layer and edit target; Image 2 = assembled obsidian-gold cat geometry reference; Image 3 = approved ivory-vermilion palette/style reference
Primary request: recolor only the existing layer into the ivory-vermilion skin while preserving its exact silhouette, internal geometry, position, scale, paper texture density, overlap margins and pivot relationship
Color palette: warm ivory fur, vermilion-red markings, muted ochre inner-ear details, dark brown linework and controlled antique-gold accents as appropriate to this layer
Style/medium: official Satoru handcrafted layered cut-paper illustration
Composition/framing: exact unchanged 1024x1024 master canvas; object remains at exactly the same coordinates
Constraints: no shape redesign; no pose change; no new details; no removed details; no external cast shadow; no text; no watermark
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform edge to edge
Avoid: pure clinical white, neon red, glossy surfaces, anime rendering, painterly shading, geometry drift, cropping, extra objects
```

### C. Повадка/проп

```text
Use case: stylized-concept
Asset type: isolated animation prop for the Satoru Fortune Cat paper-doll rig
Primary request: create <prop name and exact contents> as one modular layer
Input images: Image 1 = assembled Fortune Cat placement/scale reference; Image 2 = official cut-paper style reference
Style/medium: official Satoru handcrafted layered cut-paper illustration, quiet paper grain, simple readable shapes, medium detail
Composition/framing: exact 1024x1024 master canvas; prop already placed at its final attachment/ground position relative to the reference cat
Constraints: prop only; no cat body parts; no background shadow; no text, numbers, logos or watermark; clean overlap allowance for animation
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform edge to edge
Avoid: photorealism, glossy metal, tiny noisy decoration, extra coins/items, geometry outside the intended slot
```

### D. Надеваемый предмет

```text
Use case: stylized-concept
Asset type: modular cosmetic wearable for a monetizable Satoru pet skin system
Primary request: create <item> for the <head|neck|back> slot of the Fortune Cat
Input images: Image 1 = assembled Fortune Cat geometry/placement reference; Image 2 = official Satoru cut-paper style reference
Style/medium: official Satoru handcrafted layered cut-paper illustration; iconic silhouette; controlled paper grain; medium detail; premium but readable at 84px
Composition/framing: exact 1024x1024 master canvas; item placed in its final slot coordinates and designed to remain convincing during subtle idle motion
Constraints: item only; preserve clear opening/attachment zone; no cat body parts; no baked skin color; no external cast shadow; no text, logo or watermark
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform edge to edge
Avoid: clipping into eyes/ears, tiny jewelry noise, glossy game-loot rendering, photorealism, painterly detail, extra variants
```

### E. Тень style-check

```text
Use case: stylized-concept
Asset type: modular companion character style-check for Satoru
Primary request: create Shadow in tier Spirit and mood Calm as the canonical base for a later four-tier, six-expression paper-doll system
Input images: Image 1 = current Shadow identity reference; Image 2 = official Satoru cut-paper style reference; Image 3 = current Lair scale/composition reference
Subject: a small warm dark-violet spirit companion made of layered smoke/flame shapes, simple friendly face, quiet inner glow, emotionally safe and present rather than spooky
Style/medium: official Satoru handcrafted layered cut-paper illustration with translucent-paper suggestion, restrained texture and soft inter-layer depth
Composition/framing: front or slight 3/4 view, compact readable silhouette, centered on a 1024x1024 master canvas, modular face and aura zones
Color palette: dark plum, muted violet, soft periwinkle accent, tiny warm cream/gold highlights
Constraints: suitable for separate body, face, aura and tier-decoration layers; no legs required; no text, emoji, logos or watermark
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform edge to edge
Avoid: horror, skulls, realistic smoke, glossy 3D, neon-purple overload, anime eyes, cinematic lighting, random particles, resemblance to the Fortune Cat
```

## 6. Автоматизация без ручного копирования промптов

Целевой рабочий процесс:

1. `art-manifest.json` хранит слои, состояния, палитры, пропы, предметы, pivots и z-order.
2. Генератор промптов разворачивает манифест в задания по шаблонам раздела 5.
3. Codex вызывает image generation/edit для каждого distinct asset.
4. Локальный post-process удаляет chroma, валидирует alpha и master canvas.
5. Сборщик создаёт preview четырёх состояний, двух скинов и экипировки.
6. Visual QA проверяет desktop/mobile размеры и формирует один контактный лист.
7. Пользователь утверждает или помечает конкретные ячейки на повтор.
8. Только утверждённая версия регистрируется в приложении, тестируется и публикуется.

Для полностью автономного API-batch потребуется локальный `OPENAI_API_KEY`. Без него Codex всё равно может оркестрировать встроенную генерацию в отдельной задаче; от пользователя требуется только итоговое визуальное утверждение.
