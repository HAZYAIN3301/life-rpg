# Shadow Den v1 — ImageGen prompts

Provider: OpenAI built-in ImageGen.

## Spark base generation

```text
Use case: stylized-concept
Asset type: Satoru Den atomic Traveller + Shadow pair interaction frame, Spark tier
Primary request: Create one new whole-pair interaction frame for the Den. The exact Traveller from Image 1 sits calmly cross-legged on the right, turned slightly toward the exact Shadow Spark from Image 2. Spark floats close at his left shoulder and just above his open gloved palm; they make quiet eye contact, like a private check-in between long-term companions. Traveller's gesture is gentle and non-controlling. This must read as a deliberate shared interaction, not two independent character stickers.
Input images: Image 1 is the absolute Traveller identity, outfit, proportions, goggles, face and cut-paper material reference. Image 2 is the absolute Shadow Spark identity, silhouette, eyes, flame layers, scale-family and purple palette reference. Image 3 is composition and pair-contact quality reference only; do not include the slug, leaves, or any object from it.
Style/medium: exact Satoru matte layered cut-paper illustration with restrained paper grain and shallow inter-layer shadows; serious warm life-OS, not generic game UI.
Composition/framing: square full-pair transparent-asset composition; both characters completely visible and uncropped; group occupies lower 68% of canvas; generous padding; shared ground baseline; Spark is much smaller than Traveller, approximately the size of his head and upper chest combined.
Background: perfectly flat uniform #FF0000 chroma-key field for deterministic removal, with no floor, shadow, gradient, texture or lighting variation.
Lighting/mood: quiet trust, attentive presence, subtle warmth, no exaggerated celebration.
Constraints: exactly one Traveller and exactly one Spark; preserve Traveller's teal coat, rust scarf, goggles, gloves, trousers and boots; preserve Spark's compact limbless flame body and lavender eyes; no extra limbs on Spark; no props; no text; no logo; no watermark; no aura cut off by frame.
Avoid: other pets, duplicate characters, altered costume, anime gloss, 3D plastic, photoreal smoke, romance, hug, childish mascot expression, huge grin, generic fireball, red color anywhere in the characters, red spill on edges.
```

References: canonical Traveller idle; canonical Shadow Spark; Katsuyu restore pair only as a composition/contact quality reference.

## Spirit precise edit

```text
Use case: precise-object-edit
Primary request: Preserve the exact Traveller, pose, framing, cut-paper material, lighting and perfectly flat #FF0000 background from Image 1. Replace only the small Spark above his palm with the exact Shadow Spirit from Image 2. Spirit must preserve its taller layered violet flame silhouette, lavender eyes and canonical proportions. It may be larger than Spark but must remain secondary to Traveller and fully uncropped. Keep the same quiet eye contact and gentle, non-controlling hand relationship.
Constraints: exactly one Traveller and one Shadow Spirit; no other character, pet, prop, text, logo or watermark; do not redesign Traveller; do not turn Spirit into a generic ghost or fireball; no red inside either character and no red spill on edges.
```

References: generated Spark pair as the locked composition; canonical Shadow Spirit as the locked replacement identity.

## Guardian precise edit

```text
Use case: precise-object-edit
Primary request: Preserve the exact Traveller, seated pose, framing, cut-paper material, lighting and perfectly flat #FF0000 background from Image 1. Replace only the Shadow form above his palm with the exact Shadow Guardian from Image 2. Preserve Guardian's canonical layered violet flame body, lavender eyes, small arms and central crystal detail. Guardian is larger and more articulated than Spirit but remains clearly secondary to Traveller, fully visible and uncropped. Keep the same calm mutual gaze and private check-in.
Constraints: exactly one Traveller and one Shadow Guardian; no other character, pet, prop, text, logo or watermark; no extra limbs; no costume drift; no generic demon, ghost or fireball; no red inside either character and no red spill on edges.
```

References: generated Spark pair as the locked composition; canonical Shadow Guardian as the locked replacement identity.

## Keeper precise edit

```text
Use case: precise-object-edit
Primary request: Preserve the exact Traveller, seated pose, framing, cut-paper material, lighting and perfectly flat #FF0000 background from Image 1. Replace only the Shadow form above his palm with the exact Shadow Keeper from Image 2. Preserve Keeper's canonical mature violet flame silhouette, complete halo architecture, top diamond, lavender eyes and layered paper construction. Keeper may occupy more vertical space than Guardian but must remain secondary to Traveller, fully visible and uncropped. Keep the same calm mutual gaze and trusted-companion mood.
Constraints: exactly one Traveller and one Shadow Keeper; no other character, pet, prop, text, logo or watermark; do not simplify or crop the halo; no costume drift; no generic demon, ghost or fireball; no red inside either character and no red spill on edges.
```

References: generated Spark pair as the locked composition; canonical Shadow Keeper as the locked replacement identity.

## Raw ImageGen results

- Spark: `/Users/al.prokopets/.codex/generated_images/019ff140-43e0-7263-82c3-6b21c552f651/exec-02687a20-4920-4bfa-92d0-c9f14684fe07.png`
- Spirit: `/Users/al.prokopets/.codex/generated_images/019ff140-43e0-7263-82c3-6b21c552f651/exec-87de07ac-6495-4a6f-9097-e334c1c8f5ab.png`
- Guardian: `/Users/al.prokopets/.codex/generated_images/019ff140-43e0-7263-82c3-6b21c552f651/exec-91843282-e2b6-4cb1-869e-999790971431.png`
- Keeper: `/Users/al.prokopets/.codex/generated_images/019ff140-43e0-7263-82c3-6b21c552f651/exec-4f39fcbd-fd3b-4b70-9f0c-aa118a5fe8c3.png`
