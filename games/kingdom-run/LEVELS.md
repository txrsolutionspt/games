# Kingdom Run — Level Design Plan

## Current State

**One level exists:** `levels/level-1.json` ("Green Forest") — 80×12 tiles (2560×384px), 2 enemies, 21 coins, 4 question blocks, 2 checkpoints. It's the intro level referenced throughout `GAME_SPEC.md` and `README.md`.

This document plans levels 2–5 to complete the arc `README.md` already named as an example (Green Forest → Lava Canyon → Sky Temple → Dark Castle → Boss Arena), with enough concrete detail to generate each level's JSON the same way level 1 was built (a small Node generator script, per `GAME_SPEC.md § Level Data Format`).

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

## Companion Feature: Level Select & Unlock Chain

Not level *content*, but required once level 2 exists — noting the scope here so it isn't discovered as a surprise mid-implementation:

- **`js/storage.js`** already stores per-level `{unlocked, completed, bestScore, bestTimeMs}` keyed by ID — no schema change needed, it was built forward-compatible.
- **`js/game.js`** needs a `LEVEL_SELECT` game state (already named in `GAME_SPEC.md § Game States` but never implemented, since MVP had nothing to select) and a screen matching the mockup in `GAME_SPEC.md § HUD & UI § Level Select Screen`.
- **Unlock rule:** completing level N sets `levels[N+1].unlocked = true` (extending `KingdomRunStorage.reportLevelResult`, which currently only marks the *completed* level, not the next one).
- **Save & Quit / Continue** (already implemented) needs no change — `inProgress.levelId` already generalizes to any level, not just 1.
- The title screen's "Start Game" → level 1 directly should become "Start Game" → Level Select once level 2 exists, so returning players aren't stuck replaying level 1 to reach a level select screen that doesn't exist yet.

---

## Suggested Order of Work

1. Confirm this plan (level themes, sizing, difficulty curve, the Version A boss decision) before generating any JSON — content decisions are cheap to change on paper, expensive after hand-tuned platforming is built around them.
2. Build the Level Select screen + unlock chain first, since every subsequent level is unreachable without it.
3. Generate levels 2–4 (same Node-generator-script approach as level 1), each independently playtestable against the existing engine with zero new code.
4. Level 5 Version A last, since it's the simplest content-wise but benefits most from the engine having already been proven across 2–4.
5. Revisit Level 5 Version B (true boss) as a separate, later feature if wanted.
