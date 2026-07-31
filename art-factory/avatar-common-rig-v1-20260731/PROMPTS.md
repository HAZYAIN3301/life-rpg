# Scholar v2 generation prompt

Built-in `image_gen` was used in identity-preserving edit mode. The canonical
Traveller composite was the edit target. The output was generated on a flat
`#ff00ff` key background and converted to alpha locally.

Core invariants:

- exact Traveller body proportions, pose and joint locations;
- same character identity and restrained anime face;
- detailed Satoru cut-paper material and lighting;
- Scholar wardrobe only: coat, hat, glasses, book pack, field strap, pouch and
  crystal amulet;
- no cast shadow, floating fragments, duplicate features or extra anatomy;
- full-body 1024×1536 composition for deterministic masks.

Exact production prompt used for the selected source:

> Edit the supplied Traveller reference into a Scholar wardrobe master while
> preserving the character's exact body, head, face, pose, silhouette scale,
> limb lengths, hand positions and joint positions. Do not redraw or redesign
> the person. Keep the same restrained anime identity and the established
> Satoru premium cut-paper illustration style: layered fibrous paper edges,
> subtle printed texture, warm cinematic rim light, detailed but readable at
> mobile size. Replace only the wardrobe and equipment with a recognisable
> field scholar set: long teal scholar coat with cream lapels and tails, short
> matching upper sleeves aligned to the existing shoulders, soft brown scholar
> hat, small round glasses, crystal amulet and collar, book-and-scroll field
> backpack behind the body, and a compact field kit at the waist. Every item
> must remain separable and must not paint over the face, skin, hands, hair,
> pants or boots. No lantern, no scarf, no Traveller goggles, no cast shadow,
> no text, no floor, no scenery, no floating fragments, no duplicate facial
> features, no extra fingers or limbs. Center the full character on an exact
> 1024x1536 canvas. Use a perfectly flat solid #ff00ff background with no
> gradient, texture or shadow so deterministic chroma removal can create true
> alpha. Keep all pixels inside the canvas.

The selected keyed source is `sources/scholar-on-common-rig-keyed-v1.png`.

Chroma note: the generic wide magenta matte removed skin and cream paper. The
accepted candidate uses `transparent-threshold=10`, `opaque-threshold=70`, soft
matte and despill. This tighter threshold is mandatory for this source.
