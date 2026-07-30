# Kling handoff — Shadow Rig v3

В пакете 40 независимых image-to-video jobs: 4 canonical формы × 10 состояний.

## Сначала только pilot

Не запускай все 40 сразу. Первый гейт — 8 jobs с пометкой **PILOT**: `calm` и `speaking` для каждой формы. Они проверяют две главные вещи: Kling сохраняет новый canonical дизайн и Тень умеет спокойно говорить без мутации лица/конечностей. После одобрения пилота запускаются остальные 32.

## Настройки Kling

1. Режим: image-to-video.
2. Загрузи только файл из **Primary image**. Отдельный style image не нужен.
3. Duration: 5 seconds.
4. Creativity / imagination: low; character or reference fidelity: maximum.
5. Camera: locked; motion: restrained.
6. Вставь Prompt и Negative prompt целиком.
7. Сохрани файл под **Output name**.

Зелёный фон — технический chroma key. Не удаляй его в Kling: после возврата исходников он будет превращён в настоящую alpha, затем ролики пройдут crop, loop и edge-fringe QA.

## 01. Искра · Спокойствие · PILOT

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-calm-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. Animate a restrained idle: slow breathing through the layered paper body, a gentle vertical hover of only a few pixels, one natural blink and tiny independent movement in the outer flame tips. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 02. Искра · Слушает

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-listening-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The character leans toward the viewer by only a few degrees, the eyes become attentive, then the body settles back. Add one very soft inward pulse through the nearest paper wisps. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 03. Искра · Думает

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-thinking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. Add a small thoughtful head tilt and a brief upward eye movement. The central highlight or rune, only where one already exists, pulses once; two tiny violet motes rise and disappear. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 04. Искра · Говорит · PILOT

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-speaking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. Animate believable quiet speech: small rhythmic mouth shapes, restrained head nods on phrase accents and minimal movement of the existing arms or side wisps. Do not create new limbs and do not use continuous chewing motion. Finish the phrase and return to the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 05. Искра · Радость

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-happy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The mouth becomes a warm smile, the eyes brighten and the character makes one soft buoyant upward bounce. The outer flame tips lift briefly, then everything returns to the exact starting pose. Friendly, never hyperactive. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 06. Искра · Сияние

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-radiant-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The character briefly radiates quiet pride: the lavender eye and rune glow intensifies, the layered silhouette expands by only a few percent and four tiny paper-light fragments bloom outward and fade. End at the original brightness and pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 07. Искра · Забота

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-caring-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The posture softens and leans slightly toward the viewer. The eyes become reassuring; the existing hands or side wisps make one small welcoming gesture. A tiny warm gold-violet heart glow appears near the chest, pulses once and dissolves. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 08. Искра · Сонливость

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-sleepy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. Use a very slow side-to-side drift, one heavy gentle blink and slightly drooping outer flame tips. Two small violet sleep wisps rise and fade. No falling down and no large deformation. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 09. Искра · Скучает

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-longing-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The gaze lowers quietly for a moment and returns to the viewer. The silhouette contracts and expands by only a few percent, like a careful breath. Keep the emotion tender and welcoming, never guilty or tragic. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 10. Искра · Важный сигнал

- **Primary image:** `runtime/shadow-spark-calm.png`
- **Output name:** `shadow-v3-spark-alert-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Do not invent arms, hands, armour, a torso, a halo or a rune. The character straightens into a calm attentive pose, the eyes sharpen and the existing central glow flashes once. One clean violet ring expands behind the silhouette and disappears. Protective and clear, never aggressive. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 11. Дух · Спокойствие · PILOT

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-calm-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. Animate a restrained idle: slow breathing through the layered paper body, a gentle vertical hover of only a few pixels, one natural blink and tiny independent movement in the outer flame tips. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 12. Дух · Слушает

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-listening-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The character leans toward the viewer by only a few degrees, the eyes become attentive, then the body settles back. Add one very soft inward pulse through the nearest paper wisps. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 13. Дух · Думает

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-thinking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. Add a small thoughtful head tilt and a brief upward eye movement. The central highlight or rune, only where one already exists, pulses once; two tiny violet motes rise and disappear. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 14. Дух · Говорит · PILOT

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-speaking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. Animate believable quiet speech: small rhythmic mouth shapes, restrained head nods on phrase accents and minimal movement of the existing arms or side wisps. Do not create new limbs and do not use continuous chewing motion. Finish the phrase and return to the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 15. Дух · Радость

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-happy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The mouth becomes a warm smile, the eyes brighten and the character makes one soft buoyant upward bounce. The outer flame tips lift briefly, then everything returns to the exact starting pose. Friendly, never hyperactive. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 16. Дух · Сияние

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-radiant-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The character briefly radiates quiet pride: the lavender eye and rune glow intensifies, the layered silhouette expands by only a few percent and four tiny paper-light fragments bloom outward and fade. End at the original brightness and pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 17. Дух · Забота

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-caring-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The posture softens and leans slightly toward the viewer. The eyes become reassuring; the existing hands or side wisps make one small welcoming gesture. A tiny warm gold-violet heart glow appears near the chest, pulses once and dissolves. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 18. Дух · Сонливость

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-sleepy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. Use a very slow side-to-side drift, one heavy gentle blink and slightly drooping outer flame tips. Two small violet sleep wisps rise and fade. No falling down and no large deformation. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 19. Дух · Скучает

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-longing-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The gaze lowers quietly for a moment and returns to the viewer. The silhouette contracts and expands by only a few percent, like a careful breath. Keep the emotion tender and welcoming, never guilty or tragic. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 20. Дух · Важный сигнал

- **Primary image:** `runtime/shadow-spirit-calm.png`
- **Output name:** `shadow-v3-spirit-alert-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Keep both short wisp arms attached and preserve the simple unarmoured silhouette. The character straightens into a calm attentive pose, the eyes sharpen and the existing central glow flashes once. One clean violet ring expands behind the silhouette and disappears. Protective and clear, never aggressive. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 21. Страж · Спокойствие · PILOT

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-calm-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. Animate a restrained idle: slow breathing through the layered paper body, a gentle vertical hover of only a few pixels, one natural blink and tiny independent movement in the outer flame tips. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 22. Страж · Слушает

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-listening-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The character leans toward the viewer by only a few degrees, the eyes become attentive, then the body settles back. Add one very soft inward pulse through the nearest paper wisps. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 23. Страж · Думает

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-thinking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. Add a small thoughtful head tilt and a brief upward eye movement. The central highlight or rune, only where one already exists, pulses once; two tiny violet motes rise and disappear. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 24. Страж · Говорит · PILOT

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-speaking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. Animate believable quiet speech: small rhythmic mouth shapes, restrained head nods on phrase accents and minimal movement of the existing arms or side wisps. Do not create new limbs and do not use continuous chewing motion. Finish the phrase and return to the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 25. Страж · Радость

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-happy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The mouth becomes a warm smile, the eyes brighten and the character makes one soft buoyant upward bounce. The outer flame tips lift briefly, then everything returns to the exact starting pose. Friendly, never hyperactive. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 26. Страж · Сияние

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-radiant-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The character briefly radiates quiet pride: the lavender eye and rune glow intensifies, the layered silhouette expands by only a few percent and four tiny paper-light fragments bloom outward and fade. End at the original brightness and pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 27. Страж · Забота

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-caring-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The posture softens and leans slightly toward the viewer. The eyes become reassuring; the existing hands or side wisps make one small welcoming gesture. A tiny warm gold-violet heart glow appears near the chest, pulses once and dissolves. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 28. Страж · Сонливость

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-sleepy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. Use a very slow side-to-side drift, one heavy gentle blink and slightly drooping outer flame tips. Two small violet sleep wisps rise and fade. No falling down and no large deformation. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 29. Страж · Скучает

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-longing-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The gaze lowers quietly for a moment and returns to the viewer. The silhouette contracts and expands by only a few percent, like a careful breath. Keep the emotion tender and welcoming, never guilty or tragic. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 30. Страж · Важный сигнал

- **Primary image:** `runtime/shadow-guardian-calm.png`
- **Output name:** `shadow-v3-guardian-alert-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon. The character straightens into a calm attentive pose, the eyes sharpen and the existing central glow flashes once. One clean violet ring expands behind the silhouette and disappears. Protective and clear, never aggressive. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 31. Хранитель · Спокойствие · PILOT

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-calm-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. Animate a restrained idle: slow breathing through the layered paper body, a gentle vertical hover of only a few pixels, one natural blink and tiny independent movement in the outer flame tips. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 32. Хранитель · Слушает

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-listening-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The character leans toward the viewer by only a few degrees, the eyes become attentive, then the body settles back. Add one very soft inward pulse through the nearest paper wisps. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 33. Хранитель · Думает

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-thinking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. Add a small thoughtful head tilt and a brief upward eye movement. The central highlight or rune, only where one already exists, pulses once; two tiny violet motes rise and disappear. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 34. Хранитель · Говорит · PILOT

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-speaking-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. Animate believable quiet speech: small rhythmic mouth shapes, restrained head nods on phrase accents and minimal movement of the existing arms or side wisps. Do not create new limbs and do not use continuous chewing motion. Finish the phrase and return to the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 35. Хранитель · Радость

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-happy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The mouth becomes a warm smile, the eyes brighten and the character makes one soft buoyant upward bounce. The outer flame tips lift briefly, then everything returns to the exact starting pose. Friendly, never hyperactive. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 36. Хранитель · Сияние

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-radiant-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The character briefly radiates quiet pride: the lavender eye and rune glow intensifies, the layered silhouette expands by only a few percent and four tiny paper-light fragments bloom outward and fade. End at the original brightness and pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 37. Хранитель · Забота

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-caring-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The posture softens and leans slightly toward the viewer. The eyes become reassuring; the existing hands or side wisps make one small welcoming gesture. A tiny warm gold-violet heart glow appears near the chest, pulses once and dissolves. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 38. Хранитель · Сонливость

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-sleepy-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. Use a very slow side-to-side drift, one heavy gentle blink and slightly drooping outer flame tips. Two small violet sleep wisps rise and fade. No falling down and no large deformation. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 39. Хранитель · Скучает

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-longing-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The gaze lowers quietly for a moment and returns to the viewer. The silhouette contracts and expands by only a few percent, like a careful breath. Keep the emotion tender and welcoming, never guilty or tragic. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```

## 40. Хранитель · Важный сигнал

- **Primary image:** `runtime/shadow-keeper-calm.png`
- **Output name:** `shadow-v3-keeper-alert-kling-source.mp4`
- **Duration:** 5s

### Prompt

```text
Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source. Preserve exactly the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond. Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design. Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like. The character straightens into a calm attentive pose, the eyes sharpen and the existing central glow flashes once. One clean violet ring expands behind the silhouette and disappears. Protective and clear, never aggressive. End in the exact starting pose. Keep the complete character centred and fully inside the frame with generous padding. Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge. The green is a technical key only: it must not illuminate, tint or reflect onto the character. No floor plane, contact shadow, reflection, gradient or texture. Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity. The fifth second must visually reconnect to the first frame without a jump.
```

### Negative prompt

```text
No camera movement, zoom, crop change, cuts, scene change or parallax. No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting. No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory. No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection. No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face. No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.
```
