# Browser Companion v215 — protection activation contract

Date: 2026-09-01
Runtime: Satoru Attention 0.5.4
Release packages: v215

## Reproduced failure

The options page stored seven selected categories while the Browser Protection master
switch remained off. The UI rendered checked category cards, but `enabled: false` made
`Protection.buildRules()` correctly return no DNR rules. Reddit and Netflix were present in
the local catalog and the compiler blocked both when evaluated with `enabled: true`; the
failure was the activation workflow, not missing domains.

## Product contract

1. Selected rules with protection off must never look applied. The badge says **Not
   applied** and an inline warning explains that nothing is blocked.
2. Selecting a category, SafeSearch, YouTube Restricted Mode, bypass blocking, or the
   recreation switch enables protection and applies the complete form from the same user
   gesture. That gesture can open the browser's one-time all-site permission prompt.
3. Enabling or disabling the master switch applies immediately. The Apply button remains a
   manual retry/fallback.
4. Adding a deny/allow domain enables and applies protection. Removing a domain is applied
   immediately while protection is active.
5. Fast consecutive changes are serialized. A change made while one enforcement
   transaction is running is queued and applied after the transaction finishes.
6. Permission denial restores the stored master state, retains a visible unapplied warning,
   and never claims that protection is active.

## Enforcement checks

- `reddit.com` is in `social`; `netflix.com` is in `video`.
- With all seven categories enabled, the local compiler covers 3,350 normalized domains.
- Main-frame redirects and subresource blocks remain separate; allowlist priority remains
  above both.
- Chromium, Firefox and Safari v215 packages contain runtime 0.5.4 and the same activation
  workflow.

## Required live Brave gate

1. Reload the unpacked v215 folder and open a fresh options page.
2. Confirm an existing selected/off draft reads **Не применена** and shows **Включить и
   применить**.
3. Press the activation button and approve the one-time all-site prompt.
4. Confirm the badge reads **Включена** and the status reports a non-zero domain count.
5. Open `https://www.reddit.com/` and `https://www.netflix.com/`; both must land on the local
   `block.html` page before site content loads.
6. Disable only Video services and confirm Netflix opens while Reddit remains blocked.
7. Disable Browser Protection and confirm both sites open; re-enable it and confirm both are
   blocked again without a second permission prompt.
