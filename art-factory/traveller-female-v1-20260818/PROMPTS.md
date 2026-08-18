# Traveller female v1 — generation prompts

These prompts produce material candidates only. Save accepted generations on a
flat `#FF00FF` background under
`sources/approval-batches/<batch-id>/<frame>-keyed.png`; the factory performs
normalization and alpha extraction. Do not generate `idle-blink`.

## Shared reference block

Use the approved Traveller and the approved female identity frame together as
visual references after the identity gate exists.

> Draw the exact same adult female Traveller from the approved identity
> reference, in Satoru's premium cut-paper vector illustration style. Preserve
> her face, head and hair silhouette, slim adult proportions, costume
> construction, teal coat, cream shirt, red scarf, dark cropped trousers,
> gloves, boots, brass goggles, restrained palette, paper fibres, layered edges
> and lighting direction. Full connected body with generous clear padding on a
> perfectly flat solid #FF00FF technical background. No scene, floor, contact
> shadow, gradient background, text, logo, backpack, bag, lantern, extra prop,
> blur, glow, extra limb, detached hand, floating garment, cropped anatomy,
> chibi proportions, glossy 3D, generic game UI or geometric SVG drift.

The female design must remain recognisable without caricature or sexualisation.
Clothing may accommodate the new morphology, but its identity and construction
must not change between poses.

## Approval batch 01

Generate `idle` first and approve identity before requesting the other poses.

### `idle-keyed.png`

> Apply the shared reference block. Neutral relaxed standing pose, three-quarter
> view facing screen-right, balanced weight, both boots fully visible, arms and
> hands naturally separated from the torso enough to read at Den scale. Calm,
> attentive expression. This is the canonical female Traveller identity and
> scale reference, not a fashion pose.

### `walk-a-keyed.png`

> Apply the shared reference block and preserve the approved idle identity
> exactly. Genuine full-body walking phase facing screen-right: left boot
> forward and bearing weight, right leg trailing with a bent knee, right arm
> forward, left arm backward. Connected shoulders, elbows, hips, knees and
> boots. The gait must read without translation or a caption.

### `walk-b-keyed.png`

> Apply the shared reference block and preserve the approved idle identity
> exactly. Complementary opposite walking phase facing screen-right: right boot
> forward and bearing weight, left leg trailing, left arm forward, right arm
> backward. Match `walk-a` in scale, camera, costume, paper material and gait
> energy. Do not mirror lettering or alter asymmetric costume details.

### `window-back-keyed.png`

> Apply the shared reference block and preserve the approved idle identity
> exactly. Full-body back view standing calmly at a window, feet grounded and
> slightly apart, shoulders relaxed, head subtly attentive to the view. Show
> coherent rear construction of hair, coat, scarf, trousers and boots. No
> window, room or exterior may appear in the generated asset.

## Post-core room-action prompts

These belong in a new batch only after approval batch 01 passes.

### `arms-up-keyed.png`

> Same approved female Traveller, front three-quarter view, performing a clear
> overhead mobility stretch with both arms raised and connected, shoulders
> engaged and feet grounded. Preserve identity and costume; no prop.

### `seated-keyed.png`

> Same approved female Traveller in a readable relaxed seated pose authored for
> the existing Den bench height. Complete legs, boots, torso and hands; no chair
> or bench rendered into the asset. Preserve the canonical camera and costume.

### `bench-rest-keyed.png`

> Same approved female Traveller resting on the implied Den bench, shoulders
> released and hands settled naturally. The invisible seat contact must read
> clearly, but render no furniture, shadow or background.

### `bench-read-a-keyed.png`

> Same approved female Traveller seated at the implied Den bench, holding an
> open paper book naturally with both hands and reading. The book is the only
> permitted prop. Complete contact anatomy and stable seated silhouette.

### `bench-read-b-keyed.png`

> Exact complementary reading beat to `bench-read-a`: preserve body, book,
> costume and camera while making one authored page-turn or small gaze change.
> It must loop without an identity or scale jump.

## Atomic contact prompt contract

Contact batches use the exact filenames in `contact-families.json`. Every
source is one complete female Traveller + guardian/Shadow plate on a uniform
`#FF00FF` field. Do not generate two independent stickers for later assembly.

For Gamabunta, use the matching active male `pair-v4` frame as the locked
choreography, contact, occlusion and group-composition reference. Replace only
the Traveller morphology and preserve Gamabunta, the action phase and all
props exactly. The complete pair must remain visible and physically grounded.

For Shadow, use the matching `attune-<form>` plate as the locked composition
and the canonical Shadow form as the identity reference. Replace only the
Traveller morphology. Preserve the exact Spark, Spirit, Guardian or Keeper
silhouette, violet layers, gaze, scale hierarchy and hand relationship. The
background remains technical magenta even though the actor is violet; the
factory uses brightness-aware extraction to preserve semantic purple.

No contact candidate may change actor count, rebuild a hand touch with a gap,
hide a limb behind the key field, alter the pet/Shadow identity, add particles
as the action itself, or include room furniture and UI.

## Generation rejection checklist

Reject before factory processing if any of the following is visible:

- a changed face, hair design, age, body scale or costume between frames;
- a pin-up stance, infantilisation or exaggerated sexual anatomy;
- a pose readable only from its filename;
- broken hand/boot contact, fused limbs, impossible joints or sliced edges;
- background variation instead of a flat technical magenta field;
- a baked room, shadow, particles, caption, UI or unrelated prop;
- airbrushed 3D, anime screenshot, painterly render or SVG-icon drift instead
  of the canonical layered cut-paper family.
