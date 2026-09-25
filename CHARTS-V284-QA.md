# R04B — dense, understandable charts, v284

Scope from the in-repo R04 definition («crowded chart labels») and the dataviz
method (form first, selective labels, text in text tokens, thin marks, no value on
every point, empty states as text). External CRITERIA.md was not available in the
cloud session. Applied craft rules: TY-05 (≥11px floor, meta ≥12px), TY-09 (every
number labelled), TY-13 (no truncated names), SD-07 (empty/dense), C-04/C-05.

## Before → after

- **XP by day (Progress).** SVG viewBox 600×190 was scaled to ~330px on a phone:
  dates and values ≈5px, a number over each of 14 columns. Now an HTML column
  chart with 12–14px ticks (day numbers, thinned only if they would collide), values
  only on the peak and today, dimmed other days, and a summary line: range · peak
  (date) · today · average per day. Every column keeps `date: N XP` for screen
  readers and as a hover title.
- **Time by area (Progress + Calendar week).** Angled 5px names cut by the card
  edge and «750» without a unit. Now horizontal bars sorted by time with a colour
  key beside the (wrapping) name, `12ч 30м` at the bar end, zero spheres folded
  into one «Без записанного времени: …» line, and «Всего 19ч 40м; длина — доля от
  самой большой сферы». Layout follows the chart's own width (container query), so
  the same chart works in the wide Progress card and the narrow Calendar sidebar.
- **Rhythm wheel (Hero → Ритм сфер).** The panel was placed by the composition
  layer into the 197px left column of the wardrobe preview on phones and clipped by
  the card on 1280×900 desktops (unreachable). It now spans the full width and is
  never clipped. Radar labels were 5.4px and cut to «Восстановл…»; now ≥11px, no
  ellipsis, wrapped per available side space, long words hyphenated with ≥4 chars
  left, text in text colour instead of the series colour. Rows below no longer cut
  names («Восста…»): name + time + state on one line, bar underneath. The balance
  chip left the heading (it overflowed) and uses R04A's 7-day gate and wording.
  🔥/💤/⚖️/📊 on these charts replaced with registry icons or words; the hint close
  control is 44×44 and no longer overlaps text.
- Default sphere names are translated again in R04A load/nudge/balance texts (R04A
  had marked them `data-noi18n` without translating — fixed via `sphereNameHTML`).

New pure module `public/progress-charts-v1.js` (`columns`, `bars`); `ChartLabelsV1`
is reused for date thinning; `barChartSVG` removed. No data, XP, economy or storage
change.

## Verification

Synthetic isolated accounts only (dense 35 days × RU/EN/DE/UK/ES, 3-day RU, empty RU).

- Unit: 3 ProgressChartsV1 tests (selective labels and ties, empty/invalid series,
  sorting with entity colour, zero folding, shares).
- Chromium metrics: 18 combinations (7 accounts × 375/1280, RU/DE light) × Progress,
  Calendar week and Hero rhythm: 0 horizontal overflow, 0 overflowing chart
  containers, 0 radar labels outside the SVG; minimum rendered chart text 11.1px on
  375 (radar), 14px elsewhere; 0 page errors. Empty account shows three text empty
  states and no blank charts.
- Contrast (DE dark/light): ticks/summary/zero line ≥5.97:1, names/values ≥11.5:1.
  (Automated value-over-column reading uses the bar as background; the label sits
  on the card surface in `--text`, same as `.dchart-num`.)
- Large screenshots: XP chart RU 375 dark / DE 1280 light, time bars RU 375 /
  ES 1280 calendar sidebar / DE 1280 Progress, rhythm card RU/DE 375 and DE 1280.

**Not verified here:** WebKit (not installed), real devices, screen readers.

## Publication

`06e7002` on master 25.09; both domains report it with `satoru-v284`; 18/18 SHA256
matches; unauthenticated login page loads the v284 pin and `ProgressChartsV1`
without console errors. No production account was opened.

## Remaining

R04C AI lifecycle, R04D export, R05/R06. DE duration format «10Std 30Min» comes from
the existing `fmtDur` translation and was not changed.
