# Return Shelf R2 · v179 release QA

Final-byte local QA for the finite Return Shelf action loop. The fixture is an isolated `demo=x7` account; no production account data was changed.

## Accepted surfaces

- `360×800`: DE/light dense, document `scrollWidth = 360`, clipped controls `0`, visible targets below `42×42` = `0`.
- `375×812`: DE light/dark dense and true empty, document `scrollWidth = 375`, mobile assistant FAB hidden only on the Shelf.
- `1280×900`: DE light/dark dense and true empty, document `scrollWidth = 1280`; first completion action bottom `876.0625`, gate `884`.
- Malformed fixture: `role=alert`, no empty-state copy, Retry retains focus, source bytes remain identical, valid restore returns the live material.
- Transitions exercised: More → Shelf with heading focus; source → Attention Gate; completion → Notes and Goals composer with draft/focus; postpone without penalty; archive/delete dialog with inert background, Escape and opener return.
- Console errors/warnings: `0`.
- Reduced motion is pinned by a static contract test: Shelf descendants use no animation and `0ms` transition/delay under `prefers-reduced-motion: reduce`.

## Final artifacts

- `shelf-dense-360-light.jpg`
- `shelf-dense-375-light.jpg`
- `shelf-dense-375-dark.jpg`
- `shelf-dense-1280-light.jpg`
- `shelf-dense-1280-dark.jpg`
- `shelf-empty-375-light.jpg`
- `shelf-empty-1280-light.jpg`
- `shelf-error-375-light.jpg`

The extension is `.jpg` because the Browser capture API returns JPEG/JFIF bytes; files are not mislabeled as PNG.
