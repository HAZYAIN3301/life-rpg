# Economy Art v208 — prompt and processing contract

## Reference assets

- `public/art/icons/emblems/system-rewards-chest-v2.png`
- `public/art/icons/emblems/system-achievement-trophy.png`
- `public/art/rewards/reward-atlas-v1.png`
- `public/art/gear/inventory/w1-training-blade.png`

## Shared style clause

> Premium handcrafted fantasy game item for Satoru Life RPG. Match the attached Satoru art: dimensional painted illustration, folded-paper and lightly carved-stone material texture, clean sculpted planes, controlled soft highlights and shadows, navy / parchment ivory / antique brass / restrained teal palette. Friendly sophisticated adventure UI, not childish. One centered object or tightly unified set, generous empty margin, crisp silhouette that remains recognizable at 72–82 px. No SVG or line-icon style, generic badge/card, emoji, text, letters, numbers, watermark or UI panel.

## Achievement clause

Achievements are individual collection medals, not recolors of one template. The central object carries the meaning: bootprint/compass for the first quest, scroll stack for quest totals, sunrise bird for early activity, owl/moon for late activity, skill tree for a completed tree, prism for full spectrum, and so on. Milestone rank is communicated through material, rays, ribbons and composition rather than generated text.

## Reward clause

Rewards show the reward itself: a cup, chocolate, pizza slice, bath, book, suitcase, restaurant cloche or other concrete object. Small sets are allowed only when they read as one purchase or experience. No achievement wreath or universal container.

## Arsenal clause

Arsenal shows the equipped item itself. Weapons, armor and amulets use different silhouettes. Rarity is expressed through craftsmanship and material complexity, not through a colored slot frame. The canonical Training Blade is retained as `gear/w1.png`; every other item is an authored companion asset.

## Isolation and conversion

Generated masters use a perfectly flat `#FF00FF` background and prohibit that hue inside the object. Production conversion:

```sh
ffmpeg -i source.png -vf "colorkey=0xff00ff:0.13:0.06,format=rgba,scale=384:384:flags=lanczos" output.png
```

Final QA never judges the chroma master directly. It composites the RGBA result over `#08131f`, checks the silhouette at runtime scale and verifies a transparent corner plus PNG color type 6.
