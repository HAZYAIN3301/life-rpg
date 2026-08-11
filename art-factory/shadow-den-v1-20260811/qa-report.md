# Shadow Den v1 — QA report

Status: PASS

## Asset QA

- Four required evolution forms present: Spark, Spirit, Guardian, Keeper.
- Every runtime output is `1254×1254`, PNG, RGBA.
- Every keyed output has real transparent pixels and zero partial-alpha pixels.
- No generated frame is cropped; Traveller costume and each Shadow silhouette remain recognisable.
- Pair contact, gaze and shared lighting are authored atomically rather than composed from independent portraits.
- Hard-key extraction preserves skin, scarf, gold and violet tones. Red despill was explicitly rejected after visual comparison.

## Runtime QA

- Solo actions: greet, listen, think, speak.
- Pair actions: attune, rest, silence.
- Pair sequence: approach → atomic contact frame → return.
- Originals are hidden during atomic contact and restored afterwards.
- Automatic Den Life beats can use Shadow without adding bond rewards.
- Manual mobile actions bring the room back into view before animation begins.
- A running focus pill no longer traps the resident disclosure beneath fixed mobile UI.
- Shadow action buttons measure `42px` high at `360×800`.
- Keyboard focus remains visible; pair art is non-interactive and hidden from the accessibility tree.
- Reduced-motion media query disables Shadow transitions and pair breathing/quiet loops.
- User-facing additions exist in RU/EN/DE/UK/ES.

## Real-browser captures

- `docs/design-qa/2026-08-11-shadow-den-v143/shadow-den-v143-375x812.png`
- `docs/design-qa/2026-08-11-shadow-den-v143/shadow-den-v143-360x800.png`
- `docs/design-qa/2026-08-11-shadow-den-v143/shadow-den-v143-1280x900.png`

Observed in the live Den with an isolated demo profile. Thin chroma-key fringe is not readable at runtime scale. No browser console warnings or errors were present during the interaction pass.
