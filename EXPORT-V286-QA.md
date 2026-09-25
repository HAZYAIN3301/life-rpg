# R04D — export, v286

Scope from the in-repo R04 definition («export»). External CRITERIA.md was not
available in the cloud session. Covered every user-facing export: account archive,
calendar (.ics), «Your week» image and Shadow memory. Applied rules: success only
after a verified result, TY-13, C-04/C-05, SD-08, five locales, R03B icons on the
touched dialogs.

## Before → after

- **Account archive.** A plain `<a href download>`: with an expired session the
  browser silently saved a file containing `{"error":"not logged in"}`. Now a button
  fetches the archive, verifies `format: satoru-account`, saves it under the server
  filename and reports «Архив сохранён: satoru-account-…json · N наборов данных ·
  size». 401, non-archive responses and network errors say that nothing was
  downloaded; account/epoch fence; focus returns to the button.
- **Calendar .ics.** Lines were never folded (long Cyrillic titles broke strict
  importers), CR was not escaped, malformed times were written as-is, titles got a
  «🎯» prefix and the file was `gojo-calendar.ics`. New pure `CalendarExportV1`:
  RFC 5545 folding at 75 octets without splitting UTF-8, §3.3.11 escaping, time/date
  validation (invalid ones skipped and counted), clean title, `CATEGORIES:Satoru`,
  floating local time, and **the same `…@gojo` UIDs** so calendars that imported
  earlier files update instead of duplicating. File `satoru-calendar-YYYY-MM-DD.ics`;
  the toast says how many timed quests were saved and that time is local.
- **«Your week» image.** The PNG was built from an SVG with Russian labels
  («Квестов», «Привычек», «Часов», «ур.») in every language, «Главная сфера недели»
  overlapped the sphere name, the footer showed the old Railway URL and the image
  was 600×340. Now labels/rank/level/durations are localized before rendering, the
  layout has no overlap, the footer is satoruapp.com, the PNG is 1200×680, a failed
  render reports an error (the promise used to hang), and the dialog has a labelled
  close button, focus on open/return on close, Escape and registry icons (the
  calendar «Поделиться» button showed 📤 because its icon id did not exist).
- **Shadow memory.** File name gains the date; a toast confirms the saved file.

No server, data format or import change. Import remains as verified in v279.

## Verification

Synthetic isolated accounts only.

- Unit: 4 CalendarExportV1 tests (stable UID/floating time/clean title, 75-octet
  UTF-8 folding with emoji, invalid time/date skipping, CR/backslash escaping,
  duration bounds, filename) and 1 wiring/localization test.
- Chromium, RU 375 and EN/DE 1280: archive download (`satoru-account-2026-09-25.json`,
  format verified, receipt with data-set count and size, focus back on the button);
  intercepted 401 and HTML responses — no download, clear message; ICS download (DE):
  3 events, max line 75 octets, CRLF only, no emoji, `@gojo` UIDs, German toast;
  week card texts fully localized in EN, PNG 1200×680 saved with status message,
  Escape closes and returns focus to «Твоя неделя».
- Screenshots: EN week card, RU archive card with error state.

**Not verified here:** WebKit/iOS share sheet, importing the .ics into Apple/Google
calendars (RFC structure checked instead), real devices.

## Publication

`1c3adf0` on master 25.09; both domains report it with `satoru-v286`; 18/18 SHA256
matches; login page loads `CalendarExportV1` without console errors; unauthenticated
`/api/account/export` returns 401, which the new button reports instead of saving.

## Remaining

R05/R06 (scope needs NEXT.md). Web Share was only checked for presence.
