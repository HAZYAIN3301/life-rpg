# R05 — remaining screens against R03B criteria, v287

Scope chosen by the owner on 25.09 (NEXT.md was not readable in the cloud
session): the remaining app screens — Week, Settings, Pets, Den, Tree, Rewards,
Tribe, Inspiration, Goals, Habits, Notes, Leaderboard, Hero — checked by the R03B
per-screen criteria plus the route audit. Applied rules: registry icons instead of
system emoji in controls/headings, TY-05 (≥12px meaning-bearing text), TY-13,
SD-08 (≥42/44px touch targets), C-04/C-05 (text ≥4.5:1, state colour never on text).

## Method

A Chromium audit walks every route with dense synthetic data and reports emoji in
controls/headings, text below 4.5:1 (3:1 for large text), text <11px, ellipsised
meaning and touch targets <42px at 375. Before → after (RU dark 375, DE light 375,
EN dark 1280):

| Screen | Before | After |
|---|---|---|
| Settings | 10 user-facing emoji headings/buttons (🔑 🔐 ⚠️ 💎 ✨ 📊 💛 🧍 🤖 🎨) | registry icons or plain translated text; only admin-only panels and user avatars keep emoji |
| Week / Calendar | 🪙 🎯 🔄 in summary, 📆 📅 🔔/🔕 tools, day count 1.72:1, task check 28×28 | registry icons, on-accent count, 44×44 check with the 28px circle drawn inside |
| Pets | state badge text in state colour 2.0–3.9:1, 9–10.5px texts, 🪞, 24px intro summary | badge text in text colour with coloured frame, ≥12px, registry icon, 44px summary |
| Hero | ⚖️ 🧍 panel icons, 10–11px avatar labels | registry icons, ≥12px |
| Tree | ⚑ Path / ⚑ milestone, ◇ bonuses | registry icons (Path, summit, trophy) |
| Notes / Habits | 📝 link, ⏱ labels | registry icon, plain translated label |
| Tribe | 10px kicker | 12px |
| Admin analytics | labels cut with «…» | wrap |

`emojiFree()` reuses the existing five-language translation of an emoji-prefixed key
and strips the emoji, so no duplicate keys were added. `status.milestone` did not
exist in the icon registry (Tree and a companion receipt silently showed «⚑»); all
57 literal icon ids used by the app now exist and a test guards it.

Intentionally unchanged: emoji inside sentences (Notes empty hint), canon domain
icons in the Hero domain hint (data identity), user avatars, admin-only panels;
Today (R03A scope). Upgrade/paywall behaviour (the server answers «soon») is a
monetisation release gate, not part of R05.

## Verification

- Unit: 4 R05 guards (registry ids incl. conditional ones, pet badge colour, week
  check/day count CSS, `emojiFree` and its use for the replaced keys).
- Chromium audit after the change: 0 horizontal overflow, 0 untranslated Cyrillic
  in EN/DE/ES, 0 page errors, 0 low-contrast texts and 0 texts <11px on the listed
  screens; remaining <42px targets: none on these screens except visually hidden
  file inputs. Screenshots: DE light pets card, RU week checks (done/open), EN
  Tree switch, RU subscription card.

**Not verified here:** WebKit, real devices, screen readers.
