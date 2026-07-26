# Satoru Design Direction

> Working design direction for the Satoru redesign. This is the source of truth for visual decisions before touching production UI. The goal is not to copy any one reference, but to compose a durable Satoru language from the best patterns in game dashboards, Discord-like app shells, Duolingo-like daily loops, Fortnite event systems, Runeterra event screens, and the chosen cut-paper vector avatar style.

## North Star

Satoru should feel like a serious life operating system wearing an RPG skin, not like a toy, casino dashboard, or generic AI SaaS template.

The core blend:
- **App shell:** modern dark productivity interface, close to Discord / Framer / premium dashboard logic.
- **Daily loop:** warm, simple, character-led, close to Duolingo / workout / micro-habit apps.
- **Character and lair:** modular avatar scene in the Satoru cut-paper vector style.
- **Skill tree:** glowing game progression map with readable tooltips and locked/unlocked states.
- **Events, path choice, raids, rewards:** Fortnite / Runeterra-style event presentation, with dramatic full-bleed moments.

## Reference Map

### Main App Shell

Use references like:
- Quark manufacturing dashboard.
- Framer product UI.
- Dark finance / VPN / analytics dashboards.
- Discord-style information density.

Adopt:
- dense but calm dark surfaces;
- clear primary content column;
- layered panels instead of flat identical cards;
- strong typography for XP, level, streak, timers, and progress;
- compact navigation with clear active state;
- restrained accent usage.

Avoid:
- every panel glowing;
- random glassmorphism everywhere;
- too many equal-weight tabs;
- tiny unreadable dashboard labels.

### Today / Daily Loop

Use references like:
- language learning app;
- workout tracker app;
- micro-habit / energy tracker app;
- Duolingo as a behavioral pattern, not as a visual clone.

Adopt:
- one obvious primary action;
- "what should I do now?" as the first-screen question;
- companion/mentor presence;
- short quest cards with clear reward;
- energy-aware recommendations;
- progress feedback after every completion.

Avoid:
- showing the whole product map to a new user;
- turning Today into a statistics dashboard;
- hiding the actual tasks behind decorative RPG chrome.

### Lair / Character / Wardrobe

Use references like:
- gamified avatar dashboard / leaderboard;
- RPG character interface screens.

Adopt:
- character as the central visual object;
- equipment slots around the character;
- pet and room as emotional/progression anchors;
- inventory/wardrobe as drawers or panels, not huge permanent clutter;
- clear rarity framing for cosmetics and gear.

Avoid:
- realistic 3D/AI character renders in the production UI;
- inconsistent art styles between avatar, pets, and items;
- many tiny equipment slots in v1.

### Skill Tree

Use references like:
- Dead as Disco skill tree;
- Skill Tree Concept;
- Hyper Charts / skill-tree widget;
- Daily UI Game UI Skill Tree.

Adopt:
- node map with clear lines;
- selected-node detail panel;
- locked / available / unlocked states;
- capstone nodes with special framing;
- rarity/glow language for major bonuses;
- zoom/pan later, but not required for v1.

Avoid:
- neon-pink chaos as the base palette;
- too many node shapes at once;
- unreadable decorative labels;
- gamepad-specific UI affordances that do not fit web/mobile.

### Events / Seasons / Rewards

Use references like:
- Legends of Runeterra Spirit Blossom Event;
- Legends of Runeterra Sentinels of Light Event;
- Fortnite battle pass / seasons / quests.

Adopt:
- event pages as themed worlds, not ordinary settings panels;
- side rail for event sections;
- reward track with free/premium-style slots if monetization later needs it;
- daily/event quests as a right-side task stack;
- large visual theme background;
- strong "continue / claim / join" CTA.

Avoid:
- making the whole app seasonal all the time;
- excessive monetization cues before product value is proven;
- lootbox/casino visual language.

## Fortnite Lessons For Satoru

Fortnite is useful because it turned complex systems into simple, theatrical loops. Satoru should borrow the structure, not the exact loudness.

### Battle Pass Pattern

Use for:
- reward tracks;
- weekly challenges;
- boss/raid seasons;
- discipline path progression;
- long-term habit campaigns.

Design rules:
- show a horizontal or vertical reward path with 5-10 visible rewards at a time;
- always show the next claimable reward;
- make "claimed", "available", and "locked" visually obvious;
- use rarity colors and frames consistently;
- include one premium-looking capstone reward at the end of a segment;
- show remaining time and progress in one glance;
- keep the primary CTA simple: `Claim`, `Continue`, `Start`, or `Join`.

Satoru adaptation:
- "Battle Pass" should not be named literally in v1 unless the tone supports it. Better names: `Season Path`, `Путь сезона`, `Путь босса`, `Карта наград`.
- Rewards should be about identity and progress: cosmetics, pet items, titles, room objects, small boosters.
- Do not lead with payment. The pattern is for motivation first, monetization later.

### Team Select / Side Choice Pattern

Use for:
- Trust vs Control;
- Shadow vs Flint;
- raid faction choices;
- temporary seasonal teams;
- philosophical path selection.

Design rules:
- two large full-height panels;
- each side has its own color, symbol, short pitch, and visible consequences;
- central divider/tension line;
- hover/selection state should feel like committing to a side;
- show community/team counters only if real data exists or the text clearly frames it as local progress;
- after selection, give a small ceremony: animation, line from mentor, badge/title unlock.

Satoru adaptation:
- Trust side: warmer violet/indigo, soft spirit glow, Shadow voice.
- Control side: cyan/steel/ember, forge geometry, Flint voice.
- Avoid moralizing one side as "good" and one as "bad". It should feel like two viable philosophies.

### Quest Board Pattern

Use for:
- Today;
- boss preparation;
- weekly challenges;
- event tasks.

Design rules:
- group tasks into 2-3 lanes: `Main`, `Bonus`, `Recovery` or `Daily`, `Weekly`, `Event`;
- each task card has reward chips;
- completion produces immediate feedback;
- hard tasks look valuable, not scary;
- avoid long table-like lists on first screen.

Satoru adaptation:
- Today remains practical and calm.
- Event quest boards can be more dramatic.
- Recovery/rest tasks should be treated as valid quests, not failures.

### Item Shop / Locker Pattern

Use for:
- wardrobe;
- pets;
- room items;
- titles;
- cosmetics.

Design rules:
- items appear in a clean grid with rarity frames;
- selected item previews on the avatar/room immediately;
- filters are compact: type, rarity, owned/new;
- owned state is more important than price state in v1.

Satoru adaptation:
- Start with three visible equipment slots: head, neck, back.
- Add more slots only after the avatar rig proves itself.

### Event Landing Pattern

Use for:
- boss raids;
- seasonal arcs;
- major updates;
- discipline challenges.

Design rules:
- full-bleed illustrated/themed header;
- one clear event title;
- one main CTA;
- progress strip;
- reward preview;
- event tasks in a side panel or lower band.

Satoru adaptation:
- Boss pages should feel like temporary "episodes" inside the life RPG.
- The visual drama belongs here, not on every utility screen.

## Visual Rules

### Color

Base:
- keep dark foundation near `#0f1320`;
- use deeper panels and raised surfaces;
- add accent gradients sparingly.

Core accents:
- Satoru blue/violet for default focus;
- cyan/steel for Flint/control/forge;
- violet/spirit for Shadow/trust;
- warm gold for legendary/capstone/reward moments;
- red/ember only for danger, boss, failure pressure, or control-side intensity.

Do not:
- make purple-blue gradients dominate every screen;
- use casino neon as the default;
- overuse pink/magenta outside event skins.

### Surfaces

Use a 4-level surface stack:
1. Background: app world / grid / radial ambient light.
2. Base panel: ordinary content sections.
3. Raised panel: interactive modules, selected cards, quest groups.
4. Event/rarity glow: active state, claimable reward, boss, capstone.

Cards should not all look equally important. The strongest glow must be rare.

### Typography

Needs two layers:
- readable UI font for body, controls, task lists;
- display/numeric font for level, XP, timers, event titles, boss names.

Rules:
- big numbers are a feature, not decoration;
- headings inside panels must stay compact;
- no tiny fake-dashboard text that looks good only in Dribbble shots.

### Iconography

Recommended hybrid:
- inline SVG for navigation and repeated actions;
- emoji only for flavor, mentor voice, rarity, quick emotional cues;
- rarity, quest type, gear type, and skill tree icons should become consistent over time.

### Motion

Use motion for meaning:
- hover lift for important cards;
- pulse for claimable rewards;
- short bounce for quest completion;
- glow sweep for level-up/reward unlock;
- calmer idle motion for Today/Lair.

Avoid:
- constant movement everywhere;
- motion that competes with task completion;
- long transitions before productive actions.

## Information Architecture

The current and future feature load is the biggest product risk. Visual polish alone will not fix it.

### Simple vs Advanced

Simple mode:
- Today;
- quick capture;
- mentor/companion;
- Lair glimpse;
- one "More" entry.

Advanced mode:
- all detailed systems;
- skill tree;
- rewards;
- tribe;
- analytics;
- settings;
- full customization.

### Progressive Disclosure

Rule: a new major feature should not appear without a mentor introduction.

Use:
- Shadow/Flint drip messages;
- level gates;
- "new" badges;
- small first-use tutorials;
- one-call-to-action empty states.

### Navigation

Recommended structure:
- top status: character, level, XP, streak, currency;
- primary sections: Today, Plan, Habits, Rewards, Hero, Tribe;
- secondary Hero tabs: Lair, Character, Pets, Skills, Progress;
- future: command palette for power users.

The interface should never feel like every subsystem is yelling at once.

## Screen Direction

### Today

Goal: daily cockpit.

Composition:
- compact status header;
- main "ready / focus / capture" action;
- prioritized quest list;
- companion message;
- small energy/streak/progress summary;
- one visible path to deeper systems.

Reference mix:
- language learning simplicity;
- micro-habit energy recommendations;
- Discord-like surface discipline.

### Lair

Goal: emotional home.

Composition:
- avatar + pet in room scene;
- room objects as progression;
- small status strip;
- wardrobe/rewards/zoo as drawers;
- no giant technical controls in the main scene.

Reference mix:
- avatar dashboard;
- cut-paper vector style;
- cozy game room.

### Character / Wardrobe

Goal: customization proof.

Composition:
- avatar preview;
- three v1 slots: head, neck, back;
- item grid;
- rarity frames;
- clear selected/owned/new states.

### Trust vs Control

Goal: philosophical commitment moment.

Composition:
- two full-height choice panels;
- large title and mentor portrait/mark;
- visible consequences;
- animated selection confirmation;
- clear "you can change later" or "this is a commitment" copy.

Reference mix:
- Fortnite team select;
- Runeterra event faction panels.

### Boss / Raid Victory

Goal: earned ceremony.

Composition:
- full-screen overlay;
- boss name and outcome;
- reward cards;
- contribution/party summary if relevant;
- one continue CTA.

Reference mix:
- Fortnite victory/reward moment;
- Runeterra event art framing.

### Skill Tree

Goal: readable long-term growth.

Composition:
- node graph;
- selected-node detail panel;
- skill points visible;
- bonus chips;
- capstone glow;
- filters by sphere/path later.

Reference mix:
- dark glowing skill tree;
- premium dashboard readability.

## Anti-Rules

Do not:
- copy Dribbble screens directly;
- make Satoru look like a crypto casino;
- use realistic AI characters in the main product UI;
- turn every screen into a battle pass;
- hide real productivity under too much game chrome;
- keep all features visible at equal weight;
- use emoji as the only icon system forever;
- use glow without meaning;
- add more avatar slots before the first three slots work.

## Current Implementation Status

This direction is now implemented in `public/styles.css` as five phases. The implementation stays CSS-first where possible because the app already has a lot of working logic and a dirty worktree. Phase 5 adds only the small JavaScript shell changes required for a genuinely mobile information architecture.

### Phase 1: Premium Shell + Daily Cockpit

Status: implemented in CSS.

Covered:
- app background and surface hierarchy;
- top status/header/nav polish;
- daily cockpit feel for Today;
- primary action emphasis;
- task/reward card polish;
- reduced flat-card sameness.

Still needs visual QA:
- desktop and mobile screenshots;
- onboarding/new-user state;
- dense existing-user state.

### Phase 2: Lair, Locker, Skill Map, Reward Path

Status: implemented in CSS and matched to existing classes.

Covered:
- Lair scene polish;
- character/avatar editor surface;
- avatar preset presentation;
- skill tree hero, node map, capstone glow;
- rewards/season path treatment;
- locker/reward framing;
- raid/path choice visual language.

Still needs visual QA:
- level-gated screens on a profile where Hero is unlocked;
- real avatar/pet art in the Lair;
- reward track with many owned/unowned states.

### Phase 3: Planning Cockpit, Habits Lab, Settings Console

Status: implemented in CSS.

Covered:
- day calendar as a planning cockpit;
- weekly planner columns;
- habit builder as a clearer method lab;
- anti-habit and Atomic Habits sections;
- settings form surfaces, skill rows, import rows, sticky actions.

Still needs visual QA:
- calendar drag/drop states;
- narrow mobile layout;
- settings with many skills and many habits.

### Phase 4: Goals, Progress, Tribe, Leaderboard

Status: implemented in CSS.

Covered:
- goals filters, guide, form, metric blocks, steps, metadata chips;
- progress cards, balance meter, rank rows, charts;
- party/raid/season cards;
- Trust vs Control leaderboard banner;
- leaderboard rows and opt-out surface.

Still needs visual QA:
- empty goals vs many goals;
- Pro-locked analytics state;
- party absent / party active / raid won states;
- leaderboard with enough users for team banner.

### Phase 5: Mobile Product Pass

Status: implemented and browser-verified on 2026-07-13.

Mobile contract for `<=600px`:
- five persistent primary destinations only: Today, Plan, Habits, Hero, More;
- Rewards, Tribe, Assistant, Settings, Pro, Help, and Logout live in the More sheet;
- the More sheet traps the interaction layer: background scrolling is locked, backdrop/Escape dismiss it, and focus returns to the opener;
- the status header uses two compact rows and keeps XP, gold, and streak visible;
- secondary sub-navigation may scroll horizontally, but primary controls and content may not overflow;
- Today leads with the current day and its primary action, not companion exposition;
- Habits leads with identity plus the first real habit; the four-law reference remains under Method;
- Plan keeps all seven days and calendar tools visible at 360px;
- the AI assistant is reachable through More instead of floating over task content;
- touch controls target at least 42px, respect safe areas, and preserve stable dimensions;
- motion is quiet, short, and optional through `prefers-reduced-motion`.

The boot seal uses an original spiral/orbit construction as a subtle cyclical-myth reference. It must not reproduce a copyrighted character, logo, or named anime effect.

### Verification Notes

Code checks currently pass:
- `node --check public/app.js`
- `node --check server.js`
- CSS braces are balanced;
- `git diff --check` is clean.

Live browser QA is complete for the redesigned core:
- 390x844: Today, More, Plan, Habits, Lair, Character, and Skill Tree;
- 360x800: primary nav and Plan geometry, including seven visible days and three calendar tools;
- 1440x900: full desktop nav and desktop Plan preserved;
- no horizontal overflow on checked screens;
- no browser console errors.

Dense data states, onboarding overlays, drag/drop, multiplayer edge states, and every modal still need their own regression pass when those areas are changed.

## Implementation Order

1. **Design tokens:** spacing, radii, depth, glow, motion, typography.
2. **App shell:** header/nav/surface hierarchy.
3. **Today:** daily cockpit and overload reduction.
4. **Rarity language:** gear, pets, rewards, titles, capstones.
5. **Trust vs Control:** Fortnite-style team select.
6. **Lair/Character:** cut-paper avatar presentation and three equipment slots.
7. **Skill tree:** node states, detail panel, capstone treatment.
8. **Event/Boss screens:** Runeterra/Fortnite event language.

Every implementation step must be checked with screenshots before it is considered done.

## Success Criteria

The redesign is working if:
- a new user understands the first action in under 5 seconds;
- advanced systems feel discoverable, not dumped;
- the app feels premium before any art-heavy features are complete;
- game moments feel special because they are not everywhere;
- avatar/pets/rewards share one coherent visual language;
- screens remain readable on mobile and desktop.
