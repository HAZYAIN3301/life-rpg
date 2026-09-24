# Coherence batch — v279, 2026-09-24

Owner requested combined implementation without confirmation after each small fix.
Scope: R08, package 03B verification, R02A shared sphere picker, and mobile overflow
found while checking these flows. R02B and the remaining whole-app review are open.

## Before → after

- Damage notice counted replacement characters while repair counted fields; a
  zero-result repair returned as the same invitation after reload. Both now count
  fields. A durable receipt shows checked/restored/remaining, explains missing
  intact backups, and survives reload. Explicit dismissal lasts for the tab.
  A changed damage fingerprint shows a fresh notice. Session state is account-scoped.
- Repair fallback could use a different record at the same array index. Identified
  records now require a matching carrier id; unrelated text is not substituted.
  Late responses cannot update the next account. Unconfirmed responses offer retry.
- Sphere selection was a flat list and would not let a draft remove its final main
  sphere. The shared task/goal picker now has expandable branches, separate parent
  selection, full-path search and removable selected chips beside the search.
  Drafts may be empty; saving explains the required main sphere before any write.
- Dense mobile results could overlap. Rows now retain their height and ordinary
  choices have quieter styling. Long time labels wrap; closed task menus do not
  contribute to page width in WebKit.

## Verification

All browser work used synthetic local accounts; no owner records or media were
uploaded or repaired. Evidence is outside the repository in the release plan's
`work/complex/` directory. No changes to rewards, owner/CAS/WAL or storage formats.

- Damage fixture: two fields (one containing 24 replacement characters), one
  same-id intact backup, one unrelated-id backup, and valid multilingual/emoji text.
  Results 2/1/1 and 1/0/1, reload, dismissal, fresh tab, 503/retry and delayed A→B
  response checked. Three behavioral unit regressions added.
- Real UI export/import: all eight portable datasets match after import and retry
  following a lost response after commit. Invalid archive rejected. Another tab's
  change after preview produces 409 and preserves every current dataset. Existing
  import implementation passed; it was not rewritten.
- Picker fixture: 78 nodes, six roots, three levels and duplicate leaf names.
  Chrome and WebKit × RU/EN/DE/UK/ES × 375/1280: no page overflow, overlapping rows
  or clipped button labels. Keyboard branch toggle and German light theme checked;
  dark-theme matrix screenshots and light mobile screenshot visually reviewed.
- Task and goal create: empty selection blocked, main/background persistence read
  back from server; existing goal reopens with its saved selection after reload.
- Targeted suites pass (67 import/repair tests before the additions; 28 sphere,
  goal and repair tests including the additions). Final full suite: **3088/3088
  PASS**, zero skipped. JS syntax and diff checks pass. Initial full run found four
  stale v278 cache-pin expectations; updated to v279 before the passing final run.

## Limits / remaining

Browser WebKit is not verification of the owner's installed native build. Manual
color inheritance/recovery controls (R02B), whole-app icons/type/copy (R03), progress
semantics (R04), remaining routes/companion (R05/R06) and release gates remain open.
Do not interpret this batch as completion of the entire video review.
