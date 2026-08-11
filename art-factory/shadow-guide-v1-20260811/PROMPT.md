# Shadow Spark guide-close — generation record

## Provenance

- Generator: built-in OpenAI ImageGen.
- Mode: edit from a local canonical identity reference.
- Canonical reference: `art-factory/shadow-rig-v3-20260730/runtime/shadow-spark-calm.png`.
- Generated keyed source: `concepts/shadow-spark-guide-close-keyed.png`.
- Transparent approval concept: `concepts/shadow-spark-guide-close.png`.
- Status: concept only; not normalized or approved for runtime.

## Final prompt

```text
Use case: stylized-concept
Asset type: Satoru in-app interactive guide character frame, approval concept
Primary request: Create a NEW guide-specific close conversational pose of the exact Shadow Spark character from the supplied canonical reference. This is not the existing calm/idle frame. Shadow leans subtly toward the viewer as if entering personal conversational distance, with a gentle attentive head tilt and a small warm speaking mouth. Her gaze is directed at the user. The flame crown and two small side wisps angle slightly forward to create an inviting, guiding gesture without adding limbs.
Input image: the supplied image is the absolute identity, silhouette-family, facial-design, material and palette reference.
Subject invariants: unmistakably the same Spark; compact single rounded flame body; no torso; no arms or hands; exactly the same lavender oval eyes, tiny mouth language, layered flame crown, dark indigo/muted purple palette and handcrafted cut-paper construction. Preserve the serious warm Satoru life-OS tone.
Style/medium: matte layered cut-paper vector look, restrained smoky-watercolour texture printed inside the paper, soft shallow shadows only between paper layers, crisp readable silhouette at small sizes.
Composition/framing: front-facing close character portrait, subject approximately 70% of canvas height, centered with generous padding, fully visible and uncropped.
Background: perfectly flat uniform #00FF00 chroma-key field for deterministic removal; no lighting variation.
Lighting/mood: warm, attentive, quietly intelligent, safe and slightly mysterious; never childish, clownish, or hyper-cheerful.
Constraints: one character only; no text; no logo; no watermark; no scenery; no props; no floor; no cast shadow; no halo; no added symbols; no extra eyes; no limbs; do not turn it into 3D.
Avoid: reusing the exact calm pose, generic fireball, glossy 3D, anime chibi gloss, photoreal smoke, horror, aggression, wink, huge smile, green spill, gradients or texture in the chroma background.
```

## Alpha extraction

```sh
python3 /Users/al.prokopets/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
  concepts/shadow-spark-guide-close-keyed.png \
  --output concepts/shadow-spark-guide-close.png \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```
