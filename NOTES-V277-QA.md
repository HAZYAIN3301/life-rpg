# Notes / R01B — v277, 2026-09-24

## Before → after

- Today’s Notes button used `data-view` outside `#nav`, so its click was ignored.
  It now uses the existing notes action and focuses the Notes heading.
- The circular plus inside the save button was ambiguous. A localized Save label
  now fits the desktop composer and mobile layout, with 44px controls.
- After a confirmed text capture, Today shows Saved → Open note. The link focuses
  that exact note’s existing editor. Receipt is scoped to the current account and
  only displayed while the saved note still exists.
- Notes has an explicit Today return with keyboard focus restored to its opener.
  It bypasses the section switcher, which skips navigation within one section.
- The note-text placeholder and Open note label have RU/UK/DE/EN/ES coverage.

Existing inbox ownership, `commitInbox`/durable saving, storage shape, note editor,
voice/video capture and conversion actions are retained. No new data owner.

## Evidence

Synthetic localhost account only; no owner content or production writes.
Local plan artifacts: `work/r01b/evidence`, `qa.cjs`, `visual.cjs`, test logs.

- Chrome: empty state, Today → Notes → Today; saved-note link focuses exact text;
  edit and reload with server readback. Delayed write has one PUT and no premature
  receipt. HTTP 503 preserves draft; retry saves one note.
- Five UI languages at 375/1280 widths: real touch navigation, no page overflow.
- WebKit: existing note opens; new text capture survives server readback; return.
- Keyboard Enter opens Notes and restores focus on return. Light/dark and reduced
  motion checked; Save/return/media controls at least 44px, no button text overflow.
- JS syntax and diff checks; full final suite **3083/3083 PASS**. Current shell
  cache/pins and their existing expectations updated to v277; archived builds untouched.

Publication receipts are recorded in the external release-plan checkpoint after
commit. Installed native build and installed service-worker upgrade were not tested.
Global typography/icon changes and the remaining video-review packages are separate.
