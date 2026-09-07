# Today design preview — QA, 2026-09-07

Scope: isolated Today concept, no Satoru account or production API.

## Character + mobile follow-up

- Two variants, shared state/handlers; query-string switch preserves current work.
- `node qa-character.mjs`: **24/24 viewport/scenario combinations PASS**:
  A/B × 375/390/1280/1440 × regular/dense/empty.
  Browser checks first task or empty CTA above mobile nav; all visible touch controls
  ≥42px; no horizontal overflow; five nav destinations; mobile add/time/duration,
  completion/undo, assistant/More/Notes and reload; independent reduced-motion check.
- Actual Cyrillic heading fonts verified with Chrome platform-font reporting,
  not merely a CSS family string. Eight key foreground/background pairs measured
  per variant/width; each ≥4.5:1. This is the preview palette, not all runtime themes.
- 200% root-font reflow fixture at 375/390: no horizontal page overflow.
  This is not a physical-device OS font-scaling or VoiceOver certification.
- Existing `npm test`: 15/15; updated desktop `node qa.mjs`: PASS, including
  write failure, denied microphone and close while recording.
- Visual review corrected a real first-screen defect that the previous weak check
  missed: completed row and full composer hid the active task. Completed tasks now
  follow pending tasks; phone opens the full composer by a named direct button.
  Start time and duration remain direct in task rows and in that editor.
- Representative current frames + reports: `evidence/character-*`.
  Earlier evidence below documents the initial desktop pass, not current acceptance.
- Source diff check passes excluding the two verbatim upstream OFL files:
  their existing trailing spaces are retained, not treated as authored code.

Not implemented here: real AI integration, multi-sphere/background/difficulty editor,
other screens, light theme, five-locale full UI, physical device or actual account sync.
No new avatar, art generation, custom sound synthesis, XP or reward economy.

## Initial desktop pass (historical)

- `npm run build` — PASS, existing Podkova/den/shadow/audio copied without regeneration.
- `npm test` — 15/15 PASS (fixture validation, completed-task undo, core selection,
  stable-id creation, time validation/overlap, failed write/readback, corrupt state,
  day selection, close-day preservation, focus stop, notes/recap, duration, daily habits).
- `node qa.mjs` — Chrome via existing factory Playwright; 1440×1000 / 1280×900.
  Pass: completion/undo; start time; duration; conflict; create/reload; escaping;
  focus/pause; note; fake-device recording/stop/download affordance; text recap/reload;
  dense/empty; no horizontal overflow; title/metadata separation; reduced motion;
  date switch; close-day preservation; images decode; composer above fold;
  failed storage has no false completion; microphone denial; close while recording.
- Source syntax and `git diff --check` included in final handoff.
- Visual inspection: `qa/today-1440.png`, `qa/dense-1280.png`, `qa/empty-1280.png`,
  `qa/voice-recap.png`; full-page captures (not a Sites deployment thumbnail).
  Durable representative frames and machine receipt are copied to `evidence/`.

Found and corrected during QA: composer below dense list; duration wrapping;
wrong local SVG MIME; dark microphone icon; closing active recording lifecycle;
per-date habit state; focus restoration after render. No new raster art generated.

Not claimed: acoustic/artistic sound audition, physical microphone/device UX, mobile
sign-off, all application screens, five locales, backend receipt/sync, real transcription,
live AI quality, inventory/economy integration, offline/PWA. Existing runtime unchanged;
the full 1924-test application suite was not rerun for this factory-only preview.

Optional WebMCP read-only preview tool is feature-detected; the testing Chrome does
not expose document.modelContext. Native invocation is NOT verified, not a blocker
for the requested visual prototype. No agent-triggered microphone/writes exposed.

Reproduction: `npm run build`, `npm start` (localhost 4179), `npm test`, `node qa.mjs`.
QA script resolves the pinned Playwright already in the sibling avatar factory and
uses installed Google Chrome. It only creates synthetic browser data and mock audio.
Test setup is deliberately not a dependency of the production app.
