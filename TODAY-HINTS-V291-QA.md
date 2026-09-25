# R09 — one hint, one action (Today support), v291

Owner decision 25.09 («Одно действие или удалить»). Four Shadow support hints on
Today were rendered but never shown: the support block only accepts a hint with
exactly one action (`secretaryNudgeEligible`), and rest / day overload had none,
mobility had three and the «System» teaser two.

## Before → after

| Hint | Before | After |
|---|---|---|
| «N days without a rest entry» | text only → filtered out; red «danger» text colour (`en-low`) | action «Take a bounded rest» → existing rest-with-a-boundary dialog; neutral text colour |
| «Much more done than usual today» | text only → filtered out; red text | action «Close the day» → existing evening close; neutral text colour |
| «Back and shoulder mobility» | + Stretch / Later / Don't show → filtered out; column layout that would have stretched the button to 190 px | one action «Stretch 10 min»; the medical disclaimer stays as a 12 px line; «Don't show» became a switch in Settings → Sound and Shadow presence → Shadow; «Later» dropped (hints rotate by the existing least-recently-shown rule) |
| «System» mode teaser | Enable / Later → filtered out | removed: the Shadow drip line `d_system` already suggests the mode once and shares the `teaser:system` discovery key |

Also fixed on the way: the quests these hints add were created with Russian titles
in every language («Разминка / прогулка», «Мобилка спины и плеч») — now in the
interface language; movement and mobility detection recognises those titles (and
common words) in all five languages, so the hint goes away once done. The Shadow
settings heading used a 🕯 emoji — now the registry Shadow icon.

## Verification

- Unit: `scripts/today-hints-r09.test.js` (4) — one action each and eligible, teaser
  and its handlers gone while `d_system` remains, Settings switch and handler,
  translated quest titles, five-language movement/mobility detection. `shadow-r06`
  guard updated for the removed teaser.
- Full suite 3142/3142 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Chromium with each hint forced (other signals stubbed, writes intercepted): DE/EN
  375, UK 375 dark, ES 1280 — each hint wins the support slot, one 42–43 px button,
  fully translated; the buttons open «Bounded rest», the evening close setup, or add
  «Back and shoulder mobility» / «Mobility für Rücken und Schultern» / «Мобілка спини
  й плечей» / «Movilidad de espalda y hombros». Shadow audit (Today, chat, Den) RU/DE
  375 and EN 1280: clean, 0 page errors.

**Not verified here:** WebKit, real devices.
