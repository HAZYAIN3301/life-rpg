# Today + Plan design preview — QA, 2026-09-08

## Current: connected Today / calendar / goals

- `npm test`: **24/24 PASS** (15 existing + 9 planning contracts).
- `node qa-plan.mjs`: **32 rendered states PASS**, light/dark ×
  375/390/1280/1440 × day/week/month/goals; no page overflow or browser errors.
  Visible mobile Plan buttons/summary targets ≥42px.
- Cross-screen behavior at each viewport/theme: existing goal step is not duplicated;
  completion updates goal progress; next step creates one task; shared editor persists
  date/time/difficulty/two primary spheres/background; reschedule survives reload;
  ICS download; exact bulk archive preserves tasks; Undo; modal storage failure visible.
- `node qa-character.mjs`: **24 Today theme/viewport/scenario states PASS** again,
  including actual Cyrillic font, 11 contrast pairs, long titles, first full mobile card,
  touch, theme lifecycle, reduced motion and 200% root-font reflow.
- `node qa.mjs`: PASS again for existing Today/voice/failure behaviors.
- Build and diff-check pass. Runtime files/dependencies unchanged; full runtime suite
  not rerun. Fresh production code comparison baseline: 29423b9 (see PLAN-DESIGN-V1.md).
- Screens visually inspected: light/dark mobile week and goals, desktop week/goals,
  dense mobile Today. Fixed deadline crowding, repeated empty-state CTA, small touch
  targets, empty goal caption, hidden desktop day selector, modal error stacking.
- Current evidence: `evidence/plan-*`, `evidence/connected-today-*`,
  `evidence/connected-theme-report.json`, `evidence/connected-behavior-report.json`.

Not certified: physical phone/VoiceOver; live account / server CAS / notifications;
actual calendar client import; drag/drop across all browsers; complete app feature parity;
AI, projects/import, actualMin/commitment, five locales. Existing runtime is retained.

Scope: isolated connected design concept, no Satoru account or production API.

## Historical: selected hybrid + light/dark, 2026-09-07

- `npm test`: 15/15; `node qa.mjs`: PASS (including local write failure and mock voice).
- `node qa-character.mjs`: 24/24 light/dark × 375/390/1280/1440 × regular/dense/empty.
  Same responsive/direct-action coverage as the historical A/B run below.
- 11 text contrast pairs per theme/width ≥4.5:1, including completed title, habit
  button and theme selection; real Cyrillic Russo One verified with Chrome.
- Keyboard Escape returns focus to the time control. All visible mobile controls
  ≥42px; first task/empty CTA above navigation; five destinations; 200% root reflow.
- Theme query, saved preference, system changes, explicit override, invalid/legacy URL,
  storage denial, draft preservation, no task/focus mutation; sound starts off.
  Browser media-query change is awaited by state, not assumed synchronous.
- Original images decode; day/night artwork switches; screenshot review light/dark
  mobile and desktop. Profile control overflow found and corrected.
- Current evidence: `evidence/theme-*.png`, `evidence/theme-report.json`;
  behavior receipt: `evidence/theme-behavior-report.json`.
- Not claimed: actual phone/VoiceOver, other screens, five locales, account/AI/backend,
  acoustic audition, PWA, economy, production integration. This remains a Today lab.
- No full runtime suite rerun: runtime files/dependencies have not changed.

## Character + mobile follow-up (historical A/B)

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

Not implemented in that historical pass: real AI integration, multi-sphere/background/difficulty editor,
other screens, light theme (now covered above), five-locale full UI, physical device or actual account sync.
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
