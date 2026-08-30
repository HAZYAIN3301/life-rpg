# Economy Art v208 — achievements, rewards, arsenal

## Outcome

v208 replaces the v206 SVG content family with actual rendered game objects. The target is the visual language already established by the Satoru reward chest and Training Blade: dimensional painted construction, folded-paper/light carved-stone texture, calm navy and parchment surfaces, antique brass, restrained teal, crisp silhouettes and no universal plaque pretending to be the item.

The runtime inventory is exact:

- 48 achievement collectibles;
- 33 personal reward objects;
- 15 arsenal items;
- 96 unique transparent `384×384` RGBA PNGs total.

The previous SVG files remain as a historical v206 source pack only. They are absent from the current registry routes and offline manifest.

## Runtime contract

- Stable IDs do not change: saved `achievement.*`, `reward.*` and `gear.*` references need no migration.
- Current files live at `public/art/icons/content-raster-v208/{achievements,rewards,gear}`.
- Runtime sizes remain deliberately compact: achievements `72px`, rewards `80px`, arsenal `82px`; the PNG resolution retains detail on high-density displays.
- `satoruIconHTML()` still renders the image as decorative because the adjacent card title is the accessible name.
- All 96 files are pre-cached by `ECONOMY_ICON_SHELL` for first offline entry.
- Release lifecycle: `CACHE/PWA_CACHE_VERSION = satoru-v208`; index pin `20260830-economy-art-v208-1`.

## Art direction and source trail

The durable prompt contract is stored in `art-factory/economy-art-v208-20260830/PROMPTS.md`. Generation used the existing chest, trophy, reward atlas and Training Blade as style references. Standalone assets were generated against a flat chroma background, converted to RGBA, scaled with Lanczos and evaluated composited on the real dark surface.

Contact sheets:

- `art-factory/economy-art-v208-20260830/previews/achievements-contact-sheet.png`
- `art-factory/economy-art-v208-20260830/previews/rewards-contact-sheet.png`
- `art-factory/economy-art-v208-20260830/previews/gear-contact-sheet.png`

## Automated gate

Run:

```sh
node --test scripts/economy-art-v208.test.js
```

The gate verifies exact inventory, PNG signature, `384×384`, 8-bit RGBA, non-placeholder file size, unique hashes, stable registry IDs, `.png` runtime paths, complete offline-shell membership, removal of v206 SVG routes and coherent PWA pins.

The full repository suite remains the release gate. Browser QA covers the real Rewards view at desktop and `375×812`, especially cropped silhouettes, dense arsenal rows, horizontal overflow, broken images, console errors and service-worker delivery.

Release results (2026-08-30):

- focused Economy Art gate: `3/3` passed;
- complete repository suite: `1282/1282` passed;
- desktop browser QA at `1280×900`: 70 rendered instances / 63 unique visible assets, every source decoded as RGBA `384×384`, zero broken images and zero horizontal overflow;
- mobile browser QA at `375×812`: zero broken images, zero horizontal overflow, no visible button below the `42px` touch floor;
- browser console: zero errors and zero warnings;
- visual inspection: chest hero, reward cards, dense arsenal rows and expanded achievement grid retain distinct silhouettes without SVG plaques or clipping.

## Known boundary

The rendered art is intentionally static. Existing CSS entry motion may move the `<img>` element, but the PNG itself has no embedded animation and `prefers-reduced-motion` behavior does not change. v206 remains documented in `ECONOMY-ICONS-V206-QA.md` only as superseded history.
