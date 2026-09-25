# Synthetic QA scripts (R04A–R12)

Browser audits used to verify packages R04A–R12. They run against a **local server
with an isolated data directory and synthetic accounts only** — never against real
accounts, never with real AI requests (all `/api/ai/*` calls are intercepted) and
never with the microphone. They are not part of `npm test` (`scripts/*.test.js`).

## Setup (once)

```bash
npm i --no-save playwright            # keeps package.json unchanged
npx playwright install chromium webkit
```

## Run

```bash
# 1. isolated server (separate terminal)
PORT=51900 HOST=127.0.0.1 DATA_DIR=./qa-data node server.js

# 2. synthetic accounts (cookies land in ./qa-accounts, git-ignored)
mkdir -p qa-accounts
for l in ru en de uk es; do node scripts/qa/seed.mjs dense $l qadense$l$RANDOM > qa-accounts/dense-$l.json; done
for l in ru en de uk es; do node scripts/qa/seed-full.mjs $l; done   # goals, habits, notes, rewards via app flows

# 3. audits — QA_BROWSER=chromium|webkit|firefox
QA_BROWSER=webkit node scripts/qa/hidden-audit.mjs full-en 375 dark     # every route + collapsed sections + Settings groups
QA_BROWSER=webkit node scripts/qa/dialog-audit.mjs full-de 375 light    # ~30 dialogs: role/label/Escape/focus/emoji/i18n/sizes
QA_BROWSER=webkit node scripts/qa/shadow-audit.mjs full-ru 1280 light   # Today support, Shadow chat, Den
QA_BROWSER=webkit node scripts/qa/aisurf-audit.mjs full-es 375 light    # AI dialogs (recap, episode, proposals, map)
QA_BROWSER=webkit node scripts/qa/aisurf-flow.mjs full-en               # timeout / cancel / late answer with a fake clock
QA_BROWSER=webkit node scripts/qa/auth-audit.mjs 375 light              # sign-in, registration, reset in 5 languages
QA_BROWSER=webkit node scripts/qa/ob-audit.mjs 375 light                # first-run questionnaire in 5 languages
```

Environment: `QA_BASE` (default `http://127.0.0.1:51900`), `QA_ACCOUNTS` (default
`./qa-accounts`), `PLAYWRIGHT_PATH` (if Playwright is installed elsewhere),
`QA_SUFFIX` (name suffix for seeded accounts). The registration rate limit of the
server trips after many registrations — restart the QA server.

## Known, intentional results (not defects)

- `settings:life` emoji 🕊 ⚔️ and program icons — content identity marks.
- `desire-pop` faces, `path-choice-modal` glyphs — content marks.
- `recovery-modal`, `loot-modal` do not close on Escape — must be acknowledged.
- `avatar-forge-overlay` «no close» — the close button lives inside its iframe page.
- `paywall` 11 px fine print — monetisation on hold by the owner.
- `stats` `dchart-colval` low contrast — false positive (label sits above the bar).
- inline links «Get a key →» 14 px — inline targets are exempt.
- «focus-not-returned» for `cat-pop`/`habit-edit-modal`/`avatar-forge-overlay` — the
  synthetic opener is removed by a re-render; the real opener is found by data attributes.
- desktop (1280) controls between 24 and 42 px — fine pointer; touch floors are 42–44 px.

`hashcheck.sh <commit> app.js design-next-v1.css index.html sw.js styles.css`
compares production files on both domains with the commit.
