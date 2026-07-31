# Den v4 ambient assets — production prompts

Shared direction for every asset:

> Premium handcrafted cut-paper RPG illustration for Satoru. Layered fibrous
> paper, slightly irregular hand-cut edges, restrained warm fantasy palette,
> physically believable material and light, readable at mobile size. One
> isolated object only, centered, complete silhouette, bright chroma-key green
> background, no room, no frame, no text, no logo, no cropped edges.

## Fireplace grate and logs

> A low blackened wrought-iron fireplace grate holding three dry split logs,
> emberless and completely unlit. Front three-quarter view matching a cozy
> fantasy hearth. Detailed charcoal, bark and forged metal cut-paper layers.
> No flame, no glow, no smoke, no sparks.

## Fireplace flame

> One compact living fireplace flame cluster rising from a narrow log bed:
> layered amber, orange and pale-gold translucent paper tongues, naturally
> asymmetric, warm inner glow, designed to sit over a separate grate-and-logs
> asset. No fireplace, no grate, no smoke cloud, no cartoon circles.

## Window robin

> A small European robin in the established Satoru companion-animal style,
> perched naturally on a short wooden window peg, side three-quarter pose,
> russet breast, alert friendly expression, layered feather-shaped paper,
> believable feet gripping the perch. No floating pose, no cage, no scenery.

## Traveller headphones

> A wearable pair of over-ear headphones designed for the Traveller v1 head:
> compact dark teal and aged-brass fantasy-tech ear cups, soft cream cushions,
> articulated paper headband, symmetric front view, clean opening around the
> face, no character, no ears, no background objects.

## Runtime processing

The keyed generation is not used directly. Each source is converted with
`remove_chroma_key.py` using border key sampling, a soft matte and green
despill. The transparent master is then resized without changing its aspect
ratio. Placement and geometry are deterministic in `den-scene-v4.js`.
