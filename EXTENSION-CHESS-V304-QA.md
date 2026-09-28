# v304 — Satoru Attention 0.10.0: chess puzzle every N minutes, motivation before entering

Owner decision 26.09 (doomscroll): «5 minutes of scrolling, then a hard chess puzzle to continue»
and a motivation screen before entering. Lane: Claude (extension), LANES-20260927.md.

## Change

- **Puzzles** (`puzzles.js`, `scripts/build-browser-puzzles-v1.mjs`): 2 400 positions from the
  Lichess puzzle database (CC0), sampled by streaming; three tiers — normal 1500–1799, hard
  1800–2099, brutal 2100–2499 — popularity ≥ 85, ≥ 2000 plays, rating deviation ≤ 80, 2–4 player
  moves. Every stored solution replays move by move (test).
- **Logic** (`puzzle-core.js`): FEN, applying known moves incl. castling, en passant, promotion;
  public start without the solution; exact-move check. Shared rules for native:
  `PUZZLES-CONTRACT.md`.
- **Rule and boundary** (`core.js`): `policy.puzzle = { everyMinutes 1–30, tier }`. When the window
  ends, `boundaryOptions().puzzle` offers N minutes (never past the daily budget or the 240-minute
  session cap); `puzzleExtend` grants them. Removing, spacing out or easing the puzzle is
  loosening (next day), and while the protection lock runs any loosening of a site rule —
  including switching the rule off — is refused.
- **Service worker:** `PUZZLE_NEW` / `PUZZLE_MOVE`; the solution stays in `chrome.storage.session`,
  the page gets only the start position; one wrong move ends the puzzle and reveals the move.
- **Gate:** motivation (Shadow's line + the person's reasons) on the entry screen; puzzle panel on
  the boundary screen: click-to-move board with coordinates, orientation for the player's colour,
  promotion picker, 44 px squares/buttons, focus rings, labelled squares («e4, white knight»).
- **Options:** «Chess puzzle» block per site rule; new TikTok/YouTube/Instagram rules start with it
  on (5 min, hard); saved rules keep their choice. Five languages. Package v304 (5.8 MB).

## Verification

- Extension tests 54/54 (new: all 2 400 puzzles replay, tiers, special moves, public start hides
  the solution, exact/queen-default promotion, boundary within budget 12 → 5 + 5 + 2 then none,
  loosening rules, worker/gate wiring). Web suite 3167/3167.
- Chromium, unpacked copy and the v304 ZIP (all hosts on a closed local port): 1-minute session on
  a synthetic TikTok rule → boundary shows the puzzle → deliberate wrong move shows «c3–d5» and
  «Another puzzle» → the next puzzle solved move by move → back to the site, +1 min, puzzleCount 1;
  under the lock dropping the puzzle and switching the rule off are refused, a harder puzzle is
  accepted after the session; entry screen shows the line and reasons. RU and EN.

**Published:** `6a8742d`, both domains `satoru-v304` at 06:35 UTC 28.09; SHA-256 16/16 (app.js,
index.html, sw.js, browser-companion.html/-landing/-privacy files and the v304 ZIP); sign-in smoke
in WebKit (iPhone) and Chromium without page errors. `scripts/qa/hashcheck.sh` now allows 120 s per
download (a 5.8 MB ZIP could be cut at 20 s and read as a false mismatch).

**Not verified:** the owner's Brave; real TikTok/YouTube pages (the boundary itself is unchanged).
