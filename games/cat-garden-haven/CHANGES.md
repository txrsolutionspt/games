# Cat Garden Haven — Change Log & Design Decisions

This file tracks structural changes and the reasoning behind each decision.
Update it whenever game logic, data shape, or architecture changes.

---

## Session 2 — 2026-06-28

### Features Added

**Auto-Season Progression**
- Seasons now advance automatically every 10 minutes of active play (`SEASON_PLAY_DURATION = 600` seconds in `main.js`).
- Tracked via `activePlayTime` (accumulated in `_loop`, persisted in save).
- Season change triggers a leaf particle burst, a notification, and an achievement check.
- *Decision:* Tied to active play time rather than real-world clock so casual players who visit briefly aren't surprised by a season change they missed.

**Seasonal Cat Bonuses**
- Added `favSeason` (0=Spring, 1=Summer, 2=Autumn, 3=Winter) to every entry in `CAT_DEFS` (`data.js`).
- In their favourite season, a cat's gift amount is multiplied by ×1.5 (`cats.js → tryGift`).
- The tooltip shows a ✨ when the active season matches a cat's `favSeason`.
- The Cat Journal entry shows the cat's favourite season once seen.
- `CatManager.update` now accepts a `season` parameter (passed from `main.js`) to forward it to `tryGift`.

**Favourite seasons assigned:**
| Cat | Season |
|---|---|
| Muffin | ❄️ Winter |
| Shadow | 🍂 Autumn |
| Zoom | ☀️ Summer |
| Princess | 🌸 Spring |
| Biscuit | ☀️ Summer |
| Bubbles | 🌸 Spring |
| Duke | 🍂 Autumn |
| Marble | ❄️ Winter |

**Achievement System**
- `ACHIEVEMENTS` array defined in `data.js` as an array of `{ id, emoji, label, check(game) }` objects.
- The `check` function receives the `Game` instance so it can read any live state.
- `game._checkAchievements()` is called after: a cat is petted, a cat leaves a gift, a season changes.
- Achievements are persisted in `localStorage` as an array of earned IDs.
- Displayed as a gold pulsing notification (`.achievement` CSS modifier on `#notification`).

**Achievements defined:**
| ID | Trigger |
|---|---|
| `first_visitor` | First cat ever seen |
| `first_pet` | First cat petted |
| `yarn_50` | 50 total yarn earned |
| `yarn_250` | 250 total yarn earned |
| `visits_20` | 20 total cat visits |
| `season_change` | Witnessed first season change |
| `all_common` | All common-rarity cats seen |

**Fireflies at Night**
- Managed directly in `Garden` class (`garden.js`) as a `fireflies[]` array — not through `ParticleSystem`, because they are ambient/persistent rather than burst effects.
- Each firefly has `x`, `y`, `phase`, `dir`, `speed`. They drift slowly and reverse direction at canvas edges.
- Rendered in `drawBackground` before the sun/moon, visible when `timeOfDay > 0.62` or `< 0.12` (dusk through night to pre-dawn). Alpha fades in/out at transition edges.
- Regenerated on `resize()`.

**Item Overlap Prevention**
- `garden.canPlace(x, y, itemId)` now rejects positions within 38px of existing items (52px if the existing item has `w > 1`).
- *Decision:* Threshold chosen to feel snug but not overly restrictive on small screens. Players can still build dense gardens; they just cannot stack on the exact same spot.

**Cat Mood in Tooltip**
- Hover tooltip (`main.js → onMove`) now appends a mood emoji after the cat's personality: 😾 / 😺 / 😸 / 😻.
- `cat.mood` was already simulated (0–1) but was never exposed to the player.

### Bugs Fixed

**`timeOfDay` dead code in `garden.js`**
- The `update` method had `this.timeOfDay = (this.timeOfDay + 1) % 4;` inside the `dayTimer` reset block, but the very next line `this.timeOfDay = this.dayTimer / this.dayDuration` unconditionally overwrote it.
- Removed the dead line. `timeOfDay` is always a 0–1 float representing progress through the day cycle.

### Save Data Shape (after this session)
```json
{
  "yarn": 0,
  "unlocked": [],
  "items": [],
  "catsSeen": {},
  "catVisits": {},
  "catUnlocked": [],
  "season": 0,
  "activePlayTime": 0,
  "totalYarnEarned": 0,
  "pettedCount": 0,
  "achievements": [],
  "seasonChanges": 0
}
```

### File Responsibilities (current)
| File | Responsibility |
|---|---|
| `data.js` | Static data: `ITEMS`, `CAT_DEFS`, `SEASONS`, `ACHIEVEMENTS` |
| `cats.js` | `Cat` class (behaviour, drawing) + `CatManager` (spawning, visit lifecycle) |
| `garden.js` | Canvas background, placed items, fireflies, day/night cycle, collision |
| `particles.js` | Burst particle system (hearts, sparkle, yarn, leaves, gift, star) |
| `main.js` | `Game` class — game loop, input, save/load, season progression, achievements |
| `ui.js` | Shop panel, tabs, journal modal, notifications, hints |
| `style.css` | All visual styling including notification variants |

---

## Session 1 — Initial Build

### Architecture

- Pure vanilla JS, no build step. Five `<script>` tags loaded in dependency order.
- `localStorage` key `catgarden_save` for persistence.
- Canvas-based rendering; UI chrome (shop, header) is HTML/CSS overlay.
- Offline reward: on page load, elapsed minutes since last visit convert to bonus yarn (capped at 50🧶, 0.8🧶/min).

### Core Systems

**Currency:** Yarn (🧶) — earned from cat gifts, spent to unlock items and cats.

**Item shop:** Four tabs (Plants / Furniture / Toys / Decor). Items start locked; cost yarn to unlock; free to place once unlocked. Items are placed by drag-on-canvas. Right-click or the ↩️ button removes the last-placed item.

**Cat spawning:** `CatManager` spawns one cat every 18 seconds up to a max of 5 on screen. Weighted random selection by rarity (common 3×, uncommon 2×, rare 1×), doubled if the cat is attracted by a placed item. A cat won't spawn if another of the same type is already present.

**Cat attraction:** Each item definition has an `attract` array of trait strings. A cat is attracted if any of its `traits` appear in any placed item's `attract`. The `'all'` tag attracts every cat (used by Fountain).

**Cat lifecycle states:** ENTERING → WANDERING → SITTING / PLAYING / SLEEPING ↔ WANDERING → LEAVING. Petted cats enter PETTING state briefly. Cats leave after `visitDuration` (30–90 s). Gifts are attempted once on leaving.

**Seasons:** `SEASONS` array of 4 entries, each with `name`, `emoji`, and `palette` (sky, ground, accent hex colours). Season index stored in save; used by `Garden.drawBackground` for colour palette.

**Day/night cycle:** `dayTimer` counts 0–120 s per full cycle. `timeOfDay` (0–1) drives sky colour lerp, sun/moon arc, and star rendering. Clouds hidden at night.

**Zen Mode:** Pauses cat spawning and movement entirely. Toggled by 🌿 button.

**Cat Journal:** Modal showing all `CAT_DEFS` entries. Unseen cats appear greyed out as "???". Locked cats (Duke, Marble) can be unlocked from the journal by spending yarn.

### Rendering Order (per frame)
1. `garden.drawBackground` — sky, ground, path, clouds, fireflies, trees, grass blades, sun/moon/stars
2. `garden.drawItems` — placed emoji items, sorted by Y
3. Cats — sorted by Y (painter's algorithm depth)
4. `particles.draw` — burst effects on top
5. Ghost placement preview
6. Season label (faint, bottom-right)
