# Economy Icons v206 — achievements, rewards, arsenal

## Outcome

The old content-icon pack reused one decorative container for almost every item: a jagged medal, a hexagonal plaque or a square card with a small motif. At runtime different achievements, rewards and gear therefore read as the same object with a changed sticker.

v206 replaces that pack with 96 transparent, scalable SVG assets:

- 48 achievements use one coherent medal grammar, but each medal has a large semantic motif and milestone marks such as `7`, `100`, `1K` or `25K`;
- 33 personal rewards are object-first pictograms without a universal frame: coffee is a cup, a trip is luggage, a course is a laptop and graduation cap, and so on;
- 15 arsenal items show the item itself. Weapons, armor/robes/shields and amulets have different silhouettes; rarity is a restrained accent, not a replacement for shape.

The visual language follows the existing Satoru contract: dark calm UI, rounded five-pixel ink contour, paper/steel base, and a restrained teal/brass/leather/violet palette. There are no rasterized emoji, loud gradients behind every icon or casino-style glow.

## Runtime integration

- Canonical files remain under `public/art/icons/content/{achievements,rewards,gear}` and keep their registry IDs, so saved accounts and custom rewards do not migrate.
- The legacy PNG override on the first training blade was removed; all arsenal cards now use the same SVG family.
- Arsenal headings and slot labels use actual gear icons (`gear.w4`, `gear.w1`, `gear.a2`, `gear.m1`) instead of difficulty symbols.
- Runtime sizes are explicit: achievements `72px`, rewards `80px`, gear `82px`; card labels remain the accessible name, while the repeated image stays decorative.
- All 96 files are part of `ECONOMY_ICON_SHELL`, so the section does not fall back to empty art when opened offline for the first time.
- Shell lifecycle is `satoru-v206`; `app.js`, `styles.css`, and the icon registry receive the `20260830-economy-icons-v206-1` release pin.

## Reproducible asset pipeline

`node scripts/build-economy-icons-v206.mjs` deterministically rebuilds all 96 SVGs. It contains the canonical palettes, shapes, semantic mapping and accessible SVG titles. The generated assets carry `data-icon-family` and `data-icon-version="2"` markers.

The visual contact sheet is `public/art/icons/economy-v2-preview.html`. It shows every asset at approximately the real runtime scale rather than evaluating it only at an enlarged art-board size.

## QA contract

Automated gate: `node --test scripts/economy-icons-v206.test.js`.

It verifies:

1. exact inventory: `48 + 33 + 15 = 96`;
2. valid `128×128` SVG surface, title, family and v2 marker for every file;
3. one unique file hash per item inside each family;
4. absence of the three old generic plaque templates;
5. exact icon-registry mapping and offline-shell membership;
6. removal of the legacy arsenal PNG override and difficulty-icon headings;
7. coherent v206 PWA and index pins.

Browser QA covers the complete contact sheet and the real Rewards screen, including the dense five-column arsenal at desktop scale. Required responsive smoke sizes remain `375×812` and `1280×900`; SVGs do not introduce page width, text, focus or motion changes. Icons are static, so `prefers-reduced-motion` behavior is unchanged.
