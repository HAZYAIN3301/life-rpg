# Den v3 — canonical room background

Дата: 2026-07-30
Статус: art staging, готово к runtime-интеграции
Runtime-код в рамках этого пакета не менялся.

## Результат

- `den-v3-master-source.png` — выбранный мастер, PNG, 1672×941, RGB, без альфа-канала.
- `den-v3-runtime-1536x864.png` — нормализованная runtime-версия 16:9, PNG, 1536×864, RGB, без альфа-канала.
- `qa-report.md` — технический и визуальный QA.

Это намеренно один цельный фон без Traveller, питомцев и Тени. Персонажи, погодные эффекты и огонь должны накладываться отдельными runtime-слоями.

## Композиционный контракт

- Камин находится слева; центр его топки — примерно `x=17%`.
- Окно находится справа; его рабочая область — примерно `x=69–91%`.
- Топка тёмная, пустая и не содержит нарисованного огня. Это слот для будущего animated-fire overlay.
- Стекло окна не перекрыто предметами. Это слот для дождя, молний, птиц и смены времени суток.
- Центральная и нижняя средняя часть сцены оставлена свободной: основной безопасный коридор — примерно `x=31–67%`.
- Пол непрерывен и подходит для общего `ground/contact plane` Traveller и питомцев.
- Мелкий декор, центральные лампы и свисающая ткань удалены после генерации, чтобы не пересекать риг и не создавать визуальный шум.

## Визуальные референсы

Референсы использовались только для материала, палитры, детализации и глубины бумажных слоёв:

1. `traveller-v1-corrected-delivery/previews/current-assembled-corrected.png`
2. `runtime-staging/life-rpg/public/art/pets/fortune-v2/fortune-v2-preview.png`
3. `integration-staging/public/art/companions/shadow-v3-20260730/shadow-spirit-calm.png`

Персонажи и их элементы не переносились в фон.

## Финальный generation prompt

```text
Use case: stylized-concept
Asset type: canonical wide runtime background for the Satoru “Den” screen.
Create ONE finished, richly detailed but compositionally simple traveller’s den interior that belongs to the same visual world as the supplied Traveller, Fortune Cat, and Shadow style references.

REFERENCE RULES:
- Image 1 is STYLE AND MATERIAL ONLY: use its tactile layered paper, muted teal/copper/parchment palette, clean anime-painterly finish, dimensional contact shadows, and detail density. Do NOT include or copy the human, face, body, costume, backpack, gear, pose, or silhouette.
- Image 2 is STYLE AND MATERIAL ONLY: use its embossed paper texture, crisp layered edges, leather/wood/aged-metal detailing, and soft depth shadows. Do NOT include or copy the cat, face, body, ears, paws, backpack, coin, or silhouette.
- Image 3 is STYLE AND MATERIAL ONLY: borrow only its restrained violet accent and curled layered-paper depth. Do NOT include or copy a spirit, face, eyes, flame-person, body, or silhouette.

EXACT RUNTIME LAYOUT — THIS IS CRITICAL:
- Wide 16:9 landscape, nearly frontal, gentle shallow three-quarter depth, straight verticals.
- FIREPLACE MUST BE ON THE LEFT, centered around x=12–22% of the frame and primarily in the lower two-thirds. It is a compact built-in stone-and-dark-wood fireplace with a clearly readable EMPTY BLACK/DARK HEARTH. Absolutely no visible flame, fire, ember, smoke, or glow inside it; future animated fire will be overlaid there.
- WINDOW MUST BE ON THE RIGHT, occupying approximately x=70–88% and the upper/middle portion. Use one large arched window with clean, unobstructed glass and a calm deep-blue night sky, suitable for future rain and bird overlays.
- Keep the CENTER and LOWER-MIDDLE completely open: roughly x=30–68% from floor to mid-wall must be an uncluttered staging zone for a full-body Traveller, a floating Shadow, and pets at the feet. Show a clear continuous floor/contact plane.
- Keep all architecture and any fixed furniture outside that central staging zone. No foreground object may overlap it.

SCENE:
An intimate traveller’s attic-workshop room with warm wooden beams, parchment-toned plaster, restrained stonework, one low built-in bench against an outer wall, and broad simple architectural surfaces. It should feel cozy, premium, and lived-in through MATERIAL DETAIL rather than many props.

STYLE/MEDIUM:
Premium 2D cut-paper / paper-craft environment illustration with sophisticated painterly finish; tactile paper fibers, hand-cut layered edges, subtle paper relief, worn wood grain, hand-cut stone, stitched fabric, aged brass, restrained gradients, and soft contact shadows between layers. Detailed enough to match the characters, yet with large readable shapes for mobile. Not simple SVG geometry and not a flat vector illustration.

LIGHTING/MOOD:
Warm quiet evening; soft amber indirect lamplight from outside the central staging area balanced by cool blue window light; comforting, calm, and slightly magical, never dark-horror.

PALETTE:
Deep navy and charcoal, muted teal, warm copper and leather brown, parchment cream, restrained violet accents, small amber highlights.

STRICT NEGATIVE CONSTRAINTS:
Absolutely no characters, humans, animals, pets, spirits, faces, eyes, body-like silhouettes, mannequins, statues, character shadows, or portraits. No visible fire, flame, ember, smoke, or glow in the fireplace. No chests, loose scrolls, loose books, bottles, pots, plants, maps, weapons, trophies, ornaments, table clutter, or collections of small props. No text, letters, numbers, runes, UI, logo, signature, or watermark. No pixel art. No photorealism. No flat SVG/vector look. No extreme perspective or fisheye. Do not swap the sides: fireplace LEFT, window RIGHT.
```

## Финальный cleanup/edit prompt

```text
Edit the supplied image in place as a game-background cleanup. Preserve the exact 16:9 composition, camera, walls, ceiling beams, stone fireplace on the LEFT, arched window on the RIGHT, bench, floor, palette, paper-craft/painterly rendering, textures, and lighting quality.

Make ONLY these cleanup changes:
1. Remove all three lantern fixtures entirely: remove the small lantern sitting on the fireplace mantel and remove both hanging lanterns from the upper-center ceiling. Reconstruct the wood, stone, ceiling beams, and plaster naturally behind them.
2. Remove the purple cloth draped over the right bench. Reconstruct the teal bench cushion naturally.
3. Remove any diamond-shaped decorative emblems that read like loose ornaments from the fireplace mantel and lower right bench support; leave the architecture plain and tasteful.
4. Keep the fireplace hearth completely black, empty, and unlit: no flame, ember, smoke, glow, logs, or objects inside.
5. Keep the central and lower-middle staging zone completely empty and unobstructed from floor through the middle wall, suitable for a full-body character, floating companion, and pets.

Do not add anything new. No characters, humans, animals, pets, spirits, faces, eyes, silhouettes, statues, portraits, lamps, props, books, plants, maps, text, letters, UI, logo, signature, or watermark. Do not move the fireplace or window. Do not change the overall style. Result must remain a richly textured premium 2D cut-paper/painterly interior, not photorealistic and not flat vector art.
```

## Runtime-нормализация

Runtime PNG получен из мастера детерминированным масштабированием и центральным crop:

```text
scale=1536:864:force_original_aspect_ratio=increase,crop=1536:864
```

Соотношение сторон исходника уже практически 16:9, поэтому crop минимален и не меняет расположение ключевых якорей.
