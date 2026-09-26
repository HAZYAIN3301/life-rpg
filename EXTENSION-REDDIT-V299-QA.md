# v299 — Satoru Attention 0.8.0: merged adult list and Reddit NSFW guard

Owner report 26.09 after 0.7.0: playbun, igenfun, dieboerse, viraly, furaffinity, kemono,
candy.ai, joyreactor and NSFW Reddit communities still opened; Reddit itself must keep working
("blocking redgifs is not enough").

## Cause

OISD NSFW alone missed 8 of the reported sites (OISD avoids mixed sites; the AI generators are
too new for any list). Reddit cannot be blocked by domain without losing all of Reddit.

## Change

- **Merged list** (`scripts/build-browser-adult-ruleset-v299.mjs`): OISD NSFW + HaGeZi NSFW
  (GPL-3.0) + StevenBlack porn-only (MIT) + Satoru supplement `rules/adult-extra.txt` (the four
  reported sites no list had, two nudity generators) → **535 578 domains**. General platforms
  (reddit.com, tumblr.com, itch.io, blogspot.com, imgur.com, x.com, …) are never listed as a
  whole; only their adult subdomains are. Versions/SHA-256 of all sources in `adult-list.js`.
- **Reddit guard** (`reddit-guard.js/.css`, registered by the service worker only while the adult
  list is active and all-site access exists, verified by health): a subreddit or profile that
  Reddit marks 18+ (`about.json` `over18` / `subreddit.over_18`) is replaced by the Satoru block
  page with the reason «Reddit marks this community or profile as 18+. The rest of Reddit stays
  open.»; feed posts from 18+ subreddits and posts carrying Reddit's NSFW markers are hidden;
  `r/randnsfw` is closed; SPA navigation is followed. Unknown answers fail open (4 s veil at most).
  Verdicts are cached locally for 7 days. This is the extension's only network read — relative,
  same-origin, on reddit.com; the local-only test now allows exactly this one fetch.
- Privacy page 0.8.0 (5 languages) discloses the Reddit metadata check. Package v299 (5.7 MB).

## Verification

- Chromium with the extension (all other hostnames resolved to a closed local port): all nine
  reported domains and redgifs are blocked; www.reddit.com, old.reddit.com and wikipedia pass.
- Reddit guard against a local HTTPS fake reddit with synthetic metadata: 18+ subreddit, its post,
  18+ profile and randnsfw → block page with the reason; ordinary subreddit/profile and an unknown
  subreddit open; feed: ordinary post shown, posts from the 18+ subreddit / with an NSFW marker /
  old-style card hidden; pushState navigation into the 18+ subreddit → block page. Protection off
  or Adult unchecked → no guard registered, everything open.
- Extension tests 50/50; web suite 3161/3161.

**Not verified:** live reddit.com (not reachable for automation here) — the DOM markers of real
NSFW posts inside ordinary subreddits are best effort. Real Brave on the owner's Mac.
