# Den v3 starter furniture — exact prompts

Режим: built-in `image_gen`
Стратегия: один prompt = один green-key source = один runtime layer.

Во всех четырёх вызовах использованы одни и те же reference roles:

1. `den-v3-20260730/den-v3-runtime-1536x864.png` — room perspective, palette, placement and material reference only.
2. `traveller-v1-wardrobe-v5/previews/neutral-transparent.png` — cut-paper material and detail reference only.

## wall-map

```text
Use case: stylized-concept
Asset type: rig-ready game furniture layer for Satoru Den v3, slot `wall-map`
Primary request: create one isolated premium wall-hanging traveller map named “Карта странника”, designed to mount high on the open center wall of the supplied Den background.
Input images:
- Image 1 is a ROOM PERSPECTIVE, PALETTE, AND MATERIAL REFERENCE ONLY. Match the nearly frontal shallow perspective, warm wood, parchment plaster, stone, deep navy, muted teal, copper, and tactile paper relief. Do not reproduce the room or any architecture in the output.
- Image 2 is a STYLE AND DETAIL REFERENCE ONLY. Match the premium layered cut-paper construction, clean anime-painterly finish, hand-cut edges, subtle paper fibers, restrained gradients, embossed depth, and soft contact shadows between internal layers. Do not include or copy the person, clothing, backpack, gear, face, body, or silhouette.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for deterministic removal. One uniform green color only; no gradient, texture, floor plane, lighting variation, reflection, or shadow on the background.
Subject: one landscape-format parchment travel map hanging from a slim dark-walnut top rail with two small aged-brass mounting tabs; slightly irregular layered paper perimeter; abstract teal and copper landmasses, a winding stitched route with small circular waypoint marks, and a simple compass-star motif with no letters. No readable writing, symbols, runes, labels, borders, or character imagery.
Style/medium: premium 2D cut-paper / paper-craft game asset with painterly material detail, tactile fibers, layered parchment pieces, worn wood grain, aged brass, stitched route, crisp readable silhouette; same polish as the Den v3 background and Traveller reference; not flat vector art.
Composition/framing: single object centered on a square canvas, nearly frontal with a subtle perspective slant matching the Den wall; complete object visible, generous even padding, no cropping. Wide horizontal silhouette approximately 1.45:1 to 1.65:1.
Lighting/mood: soft warm ambient light from upper left, restrained internal contact shadows only; no cast shadow outside the object.
Color palette: parchment cream, deep walnut, muted teal, warm copper, aged brass, charcoal linework. Do not use bright green or #00ff00 anywhere in the object.
Constraints: exactly one standalone wall-map layer; no room, wall, hook shadows, furniture, people, animals, pets, spirits, faces, eyes, silhouettes, text, letters, numbers, UI, logo, signature, watermark, frame mockup, cast shadow, contact shadow on background, glow, transparency, blur, smoke, or loose props. Edges must be crisp and fully separated from the green background for chroma removal.
```

## seat-cushion

```text
Use case: stylized-concept
Asset type: rig-ready game furniture layer for Satoru Den v3, slot `seat-cushion`
Primary request: create one isolated removable traveller’s bench cushion named “Подушка привала”, designed to sit across the built-in bench directly beneath the arched window on the RIGHT side of the supplied Den background.
Input images:
- Image 1 is a ROOM PERSPECTIVE, SCALE, PALETTE, AND PLACEMENT REFERENCE ONLY. Match the shallow three-quarter view of the right bench, the warm/cool balance, and the tactile paper materials. Do not reproduce the room, window, bench frame, floor, wall, or architecture.
- Image 2 is a STYLE AND DETAIL REFERENCE ONLY. Match the premium layered cut-paper construction, clean anime-painterly finish, hand-cut edges, embossed paper texture, restrained gradients, stitched fabric detail, and soft internal contact shadows. Do not include or copy the person, clothing, backpack, gear, face, body, or silhouette.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for deterministic removal. One uniform green color only; no gradient, texture, floor plane, lighting variation, reflection, or shadow on the background.
Subject: exactly one long low rectangular bench cushion/pad, wide enough for a traveller to sit on, with a gently domed muted-teal top, warm copper leather piping, subtle stitched seams, three restrained tuft points, slightly pinched hand-made corners, and a narrow darker front gusset. No separate pillows, no bench, no legs, no blanket, no tassels.
Style/medium: premium 2D cut-paper / paper-craft game asset with painterly textile detail; layered stitched paper-fabric, visible fibers, crisp silhouette, tasteful wear, dimensional internal seams; same polish as the Den v3 background and Traveller reference; not flat vector art.
Composition/framing: one isolated object centered on a wide landscape canvas with generous even padding and no cropping. Strong horizontal silhouette approximately 2.6:1 to 3.1:1. Show a shallow top plane and front edge in the same near-frontal, slight top-down perspective as the right bench in Image 1; right and left ends remain fully visible.
Lighting/mood: soft warm room light from upper left with restrained internal contact shading only; no cast shadow outside the cushion.
Color palette: muted deep teal, charcoal-teal underside, warm copper-brown piping, tiny parchment stitch highlights. Do not use bright green or #00ff00 anywhere in the object.
Constraints: exactly one standalone cushion layer; no room, bench, chair, furniture frame, wall, window, floor, people, animals, pets, spirits, faces, eyes, silhouettes, text, letters, numbers, UI, logo, signature, watermark, cast shadow, contact shadow on background, glow, transparency, blur, smoke, or loose props. Edges must be crisp and fully separated from the green background for chroma removal.
```

## light-lantern

```text
Use case: stylized-concept
Asset type: rig-ready game furniture layer for Satoru Den v3, slot `light-lantern`
Primary request: create one isolated hanging traveller lantern named “Фонарь странника”, designed to hang near the upper-left edge of the open center wall in the supplied Den background and to support a gentle pendulum animation around its top pivot.
Input images:
- Image 1 is a ROOM PERSPECTIVE, PALETTE, SCALE, AND LIGHTING REFERENCE ONLY. Match the shallow near-frontal perspective, warm wood and stone, amber evening light, and premium tactile materials. Do not reproduce the room, fireplace, window, wall, beams, bench, or architecture.
- Image 2 is a STYLE AND DETAIL REFERENCE ONLY. Match the premium layered cut-paper construction, clean anime-painterly finish, hand-cut edges, embossed fibers, aged metal and leather detail, restrained gradients, and soft shadows between internal layers. Do not include or copy the person, clothing, backpack, existing lantern, gear, face, body, or silhouette.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for deterministic removal. One uniform green color only; no gradient, texture, floor plane, lighting variation, reflection, or shadow on the background.
Subject: exactly one compact hanging lantern with a short dark-brass chain and a clearly defined single top attachment ring/pivot; faceted aged-brass frame; four warm parchment-vellum light panels rather than transparent glass; a small stylized amber flame shape fully enclosed inside the lantern; dark walnut cap and base; simple sturdy traveller craftsmanship. Keep all glow inside the opaque parchment panels and object silhouette.
Style/medium: premium 2D cut-paper / paper-craft game asset with painterly material detail; layered brass, wood, parchment vellum, crisp readable silhouette, subtle fibers and internal depth shadows; same polish as the Den v3 background and Traveller reference; not flat vector art.
Composition/framing: one vertical object centered on a portrait-friendly square canvas, complete chain, top ring, body and base visible, generous even padding, no cropping. Near-frontal view with a very slight right-facing three-quarter turn matching Image 1. Top ring centered precisely so it can be used as the animation pivot.
Lighting/mood: warm amber light contained within the lantern panels; restrained internal highlights only; absolutely no outer bloom, cast shadow, or green-background illumination.
Color palette: aged brass, dark walnut brown, parchment cream, warm amber and copper, charcoal joints. Do not use bright green or #00ff00 anywhere in the object.
Constraints: exactly one standalone hanging lantern layer; no room, ceiling beam, wall hook, hand, character, people, animals, pets, spirits, faces, eyes, silhouettes, text, letters, numbers, UI, logo, signature, watermark, extra lamps, smoke, particles, outer glow, cast shadow, contact shadow on background, reflection, transparent glass, blur, or loose props. Crisp closed edges fully separated from the green background for chroma removal.
```

## floor-traveller

```text
Use case: stylized-concept
Asset type: rig-ready game furniture layer for Satoru Den v3, slot `floor-traveller`
Primary request: create one isolated floor rug named “Ковёр путника”, designed to lie beneath the full-body Traveller in the open lower-center staging area of the supplied Den background.
Input images:
- Image 1 is a ROOM PERSPECTIVE, FLOOR ANGLE, SCALE, PALETTE, AND MATERIAL REFERENCE ONLY. Match the shallow foreshortening of the wooden floor, warm evening light, deep teal/copper/parchment palette, and tactile paper relief. Do not reproduce the room, floorboards, fireplace, window, bench, wall, or architecture.
- Image 2 is a STYLE AND DETAIL REFERENCE ONLY. Match the premium layered cut-paper construction, clean anime-painterly finish, hand-cut edges, embossed fibers, stitched textile/leather detail, restrained gradients, and soft shadows between internal layers. Do not include or copy the person, boots, clothing, backpack, gear, face, body, or silhouette.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for deterministic removal. One uniform green color only; no gradient, texture, floor plane, lighting variation, reflection, or shadow on the background.
Subject: exactly one low-profile oval traveller rug, already drawn in the correct floor perspective: a broad foreshortened ellipse approximately 2.25:1 to 2.55:1. Layered muted-teal outer border with a darker charcoal edge, parchment-tan inner field, warm copper stitched trim, and one large simple eight-point compass-star / pathfinder motif in the center made from layered paper. Add only restrained geometric corner/edge stitching; no letters, labels, runes, text, character, footprints, objects, or separate tassels.
Style/medium: premium 2D cut-paper / paper-craft game asset with painterly woven-paper detail; layered textile paper, hand-cut perimeter, subtle wear, crisp readable silhouette, internal fiber texture and restrained contact depth; same polish as the Den v3 background and Traveller reference; not flat vector art.
Composition/framing: one isolated rug centered on a wide landscape canvas, complete perimeter visible, generous even padding, no cropping. Perspective must be baked into the asset: near edge slightly wider and more detailed, far edge subtly narrower, suitable for placement at the bottom-center of Image 1 without additional vertical squashing.
Lighting/mood: soft warm room light from upper left, restrained internal shading only; no cast shadow, floor contact shadow, ambient occlusion outside the rug, or background illumination.
Color palette: muted deep teal, charcoal, parchment cream and tan, warm copper-brown, tiny aged-brass highlights. Do not use bright green or #00ff00 anywhere in the object.
Constraints: exactly one standalone rug layer; no room, wooden floor, furniture, feet, boots, character, people, animals, pets, spirits, faces, eyes, silhouettes, text, letters, numbers, UI, logo, signature, watermark, extra props, cast shadow, contact shadow on background, glow, transparency, blur, smoke, or separate loose tassels. Crisp closed edges fully separated from the green background for chroma removal.
```
