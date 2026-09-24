# R03A / scoped R03B — Today and shared controls, v282

## Before → after

- Companion streak/chest artwork measured 22/25px in dense Today. Both now render
  at 48×48 with separate localized labels/value, outside the companion name. The
  chest remains a navigation button and no longer pulses indefinitely.
- Nested support borders became one quiet separator and a readable action/help
  hierarchy. This only affects the optional nudge state, preserving active/error
  control presentations and every action.
- Activity-derived “No energy” / evening judgement became “Choose something for
  10 minutes”, with the existing bond/gold/no-XP result explained. Eligibility and
  reward math are unchanged. RU/EN/DE/UK/ES provided.
- Shared task core/goal/commitment/entry-completion, observation and Today support
  controls use the existing icon registry. User content is untouched.
- Floating voice input uses the registry microphone, a theme-aware panel and a
  44×44 target. Placement geometry updated consistently, neighboring controls
  still avoided. No microphone recording or real AI request in QA.

## Verification

Synthetic A only, localhost:51848, isolated data/tmp; no production account content.
- Chrome + WebKit × five languages × 375/1280: dense Today and real task menu
  clicks, no horizontal overflow; start/duration/actual/completion/core retained.
- Before/after action inventories have identical unique action sets.
- Reward navigation leaves tasks/reward state unchanged; entry dialog opens/closes;
  companion disclosure works by keyboard; support icons/targets verified.
- Voice icon present after focusing a real title input; measured 44×44. Unsaved
  fixture edit discarded. Existing voice placement tests updated to new geometry.
- Render-only empty-task/zero-chest fixture: chest hidden, streak retained, no
  overflow. This is a display check, not a storage or reward-grant test.
- Light/dark measured text contrast at least 5.97:1 on progress labels, values,
  companion line and support kicker. Reduced-motion enabled; reward animation none.
- Loaded Russo One confirmed for heading; body keeps system UI fallback stack.
  Visually inspected RU desktop/mobile, DE light WebKit mobile, and voice field.
- Full final suite: 3094/3094 PASS, 0 skipped; JS syntax and diff checks PASS.

Evidence: `work/today/evidence/`, capture/matrix/interactions/contrast harnesses,
full test log. Evidence is local, excluded from git (contains synthetic auth/data).
Shell/SW v282; changed voice/app/CSS pins updated, offline assets already in SHELL.

## Remaining scope

R03A reference sample now implemented with existing sphere picker/menu improvements.
R03B continues per screen; this is not an assertion that every application emoji,
text, typography state or error has been reviewed. R04A load semantics, R04B charts,
R04C AI timeout/cancel/late response, R04D export; R05/R06 routes/companion; native
and release gates remain. Real-device microphone and screen-reader QA not performed.
