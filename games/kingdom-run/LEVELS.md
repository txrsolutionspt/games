# Kingdom Run — Level Design Plan

## Status: Shipped

All 5 levels described below (`level-1.json` through `level-5.json`) are built and playable, reachable through the Level Select screen — see § Companion Feature below, which is also now implemented. This document is kept as the design rationale for each level's layout and difficulty choices, not just a pre-build plan.

## Current State

**Five levels exist:** `levels/level-1.json` through `level-5.json`, the arc `README.md` named as an example (Green Forest → Lava Canyon → Sky Temple → Dark Castle → Boss Arena). Sizes and content per level are documented below; each was generated the same way (a small Node generator script, per `GAME_SPEC.md § Level Data Format`) and playtested against the jump-distance envelope noted in § Shared Constraints.

The sections below are kept as originally written (the design plan made before building), with actual-shipped notes added inline where something changed during implementation.

## Engine Constraint: Design Within What's Actually Built

Before laying out content, the important scoping question: **what can a new level actually use today?**

| Feature | Status | Notes |
|---|---|---|
| Ground / platform / one-way platform tiles | ✅ Implemented | `js/collision.js` |
| Question blocks (spawn coin or extra life) | ✅ Implemented | `js/levels.js` |
| Spike hazards | ✅ Implemented | instant death via `js/collision.js` |
| Coins, checkpoints, goal | ✅ Implemented | |
| Basic Walker enemy (patrol + stomp) | ✅ Implemented | `js/enemy.js` — **the only enemy type that exists** |
| Flying enemy, Patrol (waypoint) enemy | ❌ Not implemented | listed as post-MVP in `GAME_SPEC.md § Enemies` |
| Moving platforms | ❌ Not implemented | tile ID 6 is reserved in the level format but nothing renders/collides with it yet |
| Breakable blocks | ❌ Not implemented | tile ID 3 renders as plain solid, no break interaction |
| Power-ups (growth, invincibility, speed, projectile) | ❌ Not implemented | |
| Level Select screen / unlock chain | ❌ Not implemented | `js/game.js` hardcodes `startLevel(1)`; the storage schema's `levels: {}` map is already keyed by ID and ready for this, it's just not wired to a screen yet |

**Decision for this plan:** Levels 2–4 below are designed using **only what's already implemented** — walker enemies, static/one-way platforms, question blocks, spikes, checkpoints — so they can be built and shipped without touching the engine. Level 5 ("Boss Arena") is designed two ways: a **buildable-now version** using the same toolkit at higher intensity, and a **noted enhancement** if a real boss enemy gets built later. This keeps "add more levels" decoupled from "add more mechanics" — two separate, independently reviewable changes.

The **Level Select screen** is a required companion piece once a second level exists (there's no reason to hardcode `startLevel(1)` once players can progress past level 1) — scoped separately at the end of this doc rather than folded into level content design.

## Shared Constraints Across All Levels

- **Height stays fixed at 12 rows (384px)**, matching level 1. The camera's zoom-to-fit (`js/game.js`'s `updateCamera()`) scales off `level.height`; if height varied level-to-level, the zoom would visibly jump between levels, which reads as a bug even though it isn't one. Width is free to vary — that's how difficulty/length progression is expressed instead.
- **Tile size stays 32px**, same tile ID meanings as `GAME_SPEC.md § Level Data Format`.
- **Difficulty progression is expressed through**: level length, gap width/frequency, enemy count and placement, spike density, and platform precision required — not new mechanics, since none exist yet beyond the walker.
- Each level still follows the 9-zone flow from `GAME_SPEC.md § Level Structure` (start → basic movement → first enemy → platforming challenge → collectibles → difficulty ramp → penultimate challenge → goal), scaled to that level's difficulty tier.

**Verified jump envelope (found during implementation):** building levels 2-4's platforming surfaced a real bug in `js/player.js` — the early-release jump-height cut (`vy *= jumpCutMultiplier`) was reapplying every frame the jump key stayed up instead of once, collapsing the jump almost immediately after release instead of trimming it predictably. Fixed by guarding it to fire once per jump (`player.jumpCutApplied`). Measured empirically against the fix: a quick tap covers ~100px horizontally at max run speed; a ~150-250ms hold covers ~64-100px of height and ~126-146px horizontally; full hold apex is ~114px. Every gap and platform-to-platform spacing in levels 2-4 stays at or under 96px (3 tiles) horizontally per single jump, with margin — anything wider uses a stepping-stone platform instead of a single unaided jump. A descending step (jumping down, not up) is more reliable taken by walking off the edge than by pressing jump, same as most platformers — that's normal player behavior, not a level issue.

---

## Level 2 — "Lava Canyon"

**Tier:** Easy–Medium (first real difficulty step up from the tutorial-paced Green Forest)
**Size:** 96 cols × 12 rows (3072×384px) — 20% longer than level 1
**Palette:** Warm canyon tones — dusty orange/red background, darker rock-brown ground instead of grass-capped green, to sell "canyon" without needing new tile art (background color + tile recolor only, no new rendering code)

**What's new relative to level 1** (all within existing mechanics):
- **Spikes appear early and often** — level 1 had exactly one spike tile; this level uses spike-lined pits as the core obstacle, not just enemies.
- **Gaps get wider** (up to 3 tiles instead of level 1's max 2), demanding more precise jump timing.
- **3 walker enemies** instead of 2, including one placed *right after* a gap-jump landing (tests whether the player can chain a jump into an immediate reaction, not just clear the gap).
- **One-way platforms used more deliberately** — a short vertical sequence (jump up through 2 stacked one-way platforms) as the "platforming challenge" zone, rather than level 1's single one-way platform used mostly for the coin-above-it flourish.

**Zone breakdown:**
1. **Start (cols 0–8):** flat, safe, no hazards — mirrors level 1's opener so the difficulty step feels earned, not abrupt.
2. **Basic movement (cols 8–22):** two spike-lined single-tile gaps, floating platform with coins.
3. **First enemy (cols 22–32):** one walker on a flat stretch, coin reward after.
4. **Platforming challenge (cols 32–50):** the wide 3-tile spike gap + the stacked one-way platform climb; **checkpoint 1** placed right after, since this zone is the level's hardest single moment so far.
5. **Collectibles (cols 50–62):** 3 question blocks (mix of coin/coin/life, echoing level 1's ratio), off-path coin alcove.
6. **Difficulty ramp (cols 62–80):** 2 walkers in sequence with a spike gap between them, tight platform-to-platform hop; **checkpoint 2**.
7. **Penultimate challenge (cols 80–90):** back-to-back spike gaps with no flat ground between — the level's tension spike, deliberately placed with no checkpoint immediately before it.
8. **Goal (cols 90–96):** flat, safe landing, flag.

**Approximate counts:** 3 enemies, ~24 coins, 3 question blocks, 2 checkpoints, ~8 spike tiles across 4 gap clusters.

---

## Level 3 — "Sky Temple"

**Tier:** Medium (the vertical-platforming-focused level)
**Size:** 100 cols × 12 rows (3200×384px)
**Palette:** Cooler stone/sky tones — pale blue-grey background, light stone-grey platforms, distinguishing it visually from both the grass of level 1 and the canyon-orange of level 2.

**What's new relative to levels 1–2:** this level's identity is **vertical variety**, not just horizontal gaps — floating platforms at multiple heights within the same screen-width, one-way platforms used as the primary traversal method rather than a novelty, and ground gaps that require landing on an intermediate platform rather than clearing in one jump.

**Zone breakdown:**
1. **Start (cols 0–10):** flat, safe.
2. **Basic movement (cols 10–26):** alternating floating platforms at two different heights (introduces reading vertical spacing, not just horizontal).
3. **First enemy (cols 26–36):** walker patrolling **on a floating platform** (not ground) — first time an enemy fight also requires platforming awareness.
4. **Platforming challenge (cols 36–58):** a 3-platform vertical staircase (each platform higher than the last, one-way so a mistimed jump can still recover by climbing back up through), ending on a high checkpoint (**checkpoint 1**) that rewards having climbed it correctly.
5. **Collectibles (cols 58–70):** coins placed to reward exploring the vertical space (some only reachable by backtracking up), 3 question blocks.
6. **Difficulty ramp (cols 70–86):** 2 enemies on separate platforms + a ground-level spike gap underneath the platform route (so staying elevated is the safer path, not just the interesting one) — **checkpoint 2**.
7. **Penultimate challenge (cols 86–96):** the level's signature moment — cross a gap by jumping platform-to-platform across 3 floating platforms at staggered heights, no ground below at all (fall = death, not just a setback).
8. **Goal (cols 96–100):** flat safe landing.

**Approximate counts:** 3 enemies (2 platform-based, 1 ground), ~26 coins, 3 question blocks, 2 checkpoints, ~6 spike tiles (concentrated under the vertical sections, not spread throughout).

---

## Level 4 — "Dark Castle"

**Tier:** Hard (the pre-finale gauntlet — combines everything from levels 1–3)
**Size:** 110 cols × 12 rows (3520×384px) — the longest level
**Palette:** Dark, desaturated — near-black background, deep purple-grey stone, signaling "this is the hard one" before the player even moves.

**What's new:** nothing mechanically — this level is deliberately a **synthesis**, not an introduction. It combines canyon-style spike gaps, temple-style vertical platforming, and denser enemy placement than either, with less margin for error throughout (narrower platforms, tighter gap-to-landing timing) and checkpoints spaced further apart to raise the stakes.

**Zone breakdown:**
1. **Start (cols 0–8):** flat, safe — kept short since the player has now done this three times.
2. **Basic movement (cols 8–24):** combines a spike gap (canyon-style) immediately followed by a 2-platform vertical hop (temple-style) — establishing early that this level mixes both vocabularies.
3. **First enemy (cols 24–36):** 2 walkers close together (level 1–3 each only ever had one enemy in this zone) — first real "handle two threats at once" moment.
4. **Platforming challenge (cols 36–60):** the level's centerpiece — a long one-way-platform staircase over a full-width spike pit, narrower platforms than level 3's version; **checkpoint 1** only at the very end, so the whole climb is one committed attempt.
5. **Collectibles (cols 60–74):** 4 question blocks (the level's highest count, offset against its difficulty with more extra-life chances), coins placed along the safest route as a small mercy.
6. **Difficulty ramp (cols 74–92):** 3 enemies spread across mixed platform heights + 2 separate spike gaps; **checkpoint 2**.
7. **Penultimate challenge (cols 92–104):** combines a staggered-platform crossing (temple-style) with a walker positioned mid-crossing (forcing a stomp or precise dodge while still mid-jump-sequence) — the hardest single zone in the level set.
8. **Goal (cols 104–110):** flat safe landing, flag.

**Approximate counts:** 6 enemies, ~28 coins, 4 question blocks, 2 checkpoints, ~10 spike tiles.

---

## Level 5 — "Boss Arena"

**Tier:** Finale
**Size:** 70 cols × 12 rows (2240×384px) — shorter than the others; a finale should read as a focused set-piece, not another long traversal level.

This is the one level where "what's buildable now" and "what the name implies" genuinely diverge, so two versions:

### Version A — buildable now ("Gauntlet" finale)

No new enemy type; the finale's intensity comes from **enemy density and arena-style enemy placement** rather than a unique boss encounter:
1. **Start (cols 0–6):** flat, safe, short — the arena begins almost immediately.
2. **Approach (cols 6–20):** 2 walkers guarding the arena entrance, moderate platforming.
3. **The Arena (cols 20–50):** an enclosed flat-ground arena (walled by design, not literally — just no gaps to fall through) containing **4 walker enemies patrolling overlapping ranges**, with 2 question blocks (life-weighted, since this is attrition) placed centrally as a risk/reward pull into the middle of the fight. A checkpoint sits at the arena's entrance, not inside it — dying mid-arena means re-entering the whole fight, which is the intended finale tension.
4. **Cooldown (cols 50–62):** brief safe stretch, coins, breathing room before the goal.
5. **Goal (cols 62–70):** flag.

**Approximate counts:** 6 enemies (all concentrated in the arena), ~14 coins (fewer than other levels — this level is about combat/survival, not collection), 2 question blocks, 1 checkpoint.

### Version B — if a real boss enemy gets built later

Would replace the Arena zone's 4 walkers with a single large enemy requiring multiple hits (needs: a new enemy type with a health counter instead of one-stomp-defeat, a distinct visual size/color so it reads as "the boss," and likely a telegraphed attack pattern rather than simple left-right patrol). That's meaningfully new engine work — a `BossEnemy` type in `js/enemy.js`, a hit-counter in the collision/scoring flow, and probably new state-machine handling — not something to fold into a "just add levels" change. Flagging it here as the natural next step if a true boss fight is wanted, rather than building a half-implementation now.

**Recommendation:** ship Version A now; revisit Version B as its own scoped feature if wanted.

---

## Difficulty Curve Summary

| Level | Name | Cols | Enemies | Coins | Question Blocks | Checkpoints | New emphasis |
|---|---|---|---|---|---|---|---|
| 1 | Green Forest | 80 | 2 | 21 | 4 | 2 | Tutorial pacing |
| 2 | Lava Canyon | 96 | 3 | ~24 | 3 | 2 | Spike gaps, gap width |
| 3 | Sky Temple | 100 | 3 | ~26 | 3 | 2 | Vertical platforming |
| 4 | Dark Castle | 110 | 6 | ~28 | 4 | 2 | Synthesis, tight margins |
| 5 | Boss Arena | 70 | 6 | ~14 | 2 | 1 | Combat density, finale pacing |

Enemy count and gap difficulty both climb steadily; coin/question-block count stays roughly flat (levels aren't meant to out-collect each other, just out-challenge each other) except level 5, which deliberately drops collectibles in favor of combat focus.

---

## Companion Feature: Level Select & Unlock Chain — Built

Implemented as planned:

- **`js/storage.js`** stores per-level `{unlocked, completed, bestScore, bestTimeMs}` keyed by ID, now with default (locked) entries for levels 2-5 (`SAVE_DATA_VERSION` bumped 2→3, with a migration backfilling those entries for existing saves).
- **`js/game.js`** has a `LEVEL_SELECT` game state and screen (`showLevelSelectScreen()` / `renderLevelSelectList()`), fetching each level's `{name, description}` from its own JSON rather than duplicating that metadata in game.js — a card is resilient to a single level failing to load (shows "unavailable" instead of breaking the whole list).
- **Unlock rule:** `KingdomRunStorage.reportLevelResult()` now unlocks `levelId + 1` whenever `completed` is true.
- **Save & Quit / Continue** needed no change, as predicted — `inProgress.levelId` already generalized.
- Title screen's "Start Game" (relabeled "New Game" once a save exists) now routes to Level Select; a "Next Level" button on the Level Complete screen offers the next level directly without a trip back through Select.

---

## Build Order (as actually followed)

1. Level Select screen + unlock chain first, since every level past 1 was unreachable without it.
2. Generated levels 2-4, discovering and fixing the jump-cut bug (see § Shared Constraints) while verifying level 2's platforming — then re-verified levels 3-4 against the corrected physics before finalizing their layouts.
3. Level 5 Version A last.
4. Level 5 Version B (a true boss enemy) remains unbuilt — a separate, later feature if wanted.
