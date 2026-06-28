# Cat Garden Haven — Change Log & Design Decisions

This file tracks structural changes and the reasoning behind each decision.
Update it whenever game logic, data shape, or architecture changes.

---

## Session 6 — 2026-06-28

### Features Added

**Twilight Golden Hour**
- A "golden hour" window is active when `garden.timeOfDay` is between 0.45 and 0.55 (centred on sunset in the 120-second day cycle).
- `Garden._goldenProgress()` — triangle 0→1→0 value over that range.
- `Garden.isGoldenHour` getter — used by `Game` to pass state into `CatManager`.
- **Visual:** Warm amber/orange radial vignette overlaid on the full canvas, opacity proportional to `goldenProgress`. Faint "✨ Golden Hour" label at the bottom-left of the garden canvas.
- **Particles:** Each frame `Game._loop` has a chance to emit a `shimmer` particle (slow upward drift, glyphs ✨ 🌟 💛) scaled by `goldenProgress × dt`.
- **Gameplay:** Rare cats (Duke, Marble — `rarity === 'rare'`) receive an additional ×2 spawn-weight bonus during golden hour.
- `shimmer` type added to `ParticleSystem` draw switch, spawned via `spawnSingle`.
- Golden-hour tip added to the hint rotation.

### Architecture changes
- `CatManager.update`: added `goldenHour = false` as 11th param (non-breaking).
- `CatManager._trySpawnCat`: added `goldenHour = false` as 6th param; rare cat weight is doubled when active.
- Shimmer spawning lives in `Game._loop`, keeping `Garden` free of particle dependencies.

---

## Session 5 — 2026-06-28

### Features Added

**Personalised Cat Nicknames**
- `game.nicknames` — plain object mapping `catId → nickname string`, stored in `localStorage`.
- `game.setNickname(catId, name)` — trims, clamps to 12 chars, deletes entry if empty, then auto-saves.
- `game._catDisplayName(def)` — returns the nickname if set, otherwise the default name. Used everywhere a cat's name appears in UI text: tooltip, gift notifications (petting and auto-leave), birthday announcement.
- In the Cat Journal, tapping a seen cat's name replaces it with an inline `<input maxlength="12">`. Committing on blur or Enter saves the nickname and re-renders the journal. Escape cancels without saving.
- When a nickname is active, the journal entry shows "🏷 {nickname}" with "(Default Name)" in smaller grey text alongside it.
- Unseen cats are unaffected (still show "???").

### Save data additions
```json
{ "nicknames": { "muffin": "Fluffy" } }
```

---

## Session 4 — 2026-06-28

### Features Added

**Garden Prestige: Seasonal Trophies**
- `TROPHIES` constant added to `data.js` — one entry per season with a `condition` (yarn and/or visits), a passive effect field, label, and description.
- Trophies are evaluated at the end of each season inside `_advanceSeason`, just before the season index advances. Stats tracked: `seasonYarn` (yarn earned this season) and season visits (delta between `catManager.visitCounts` total and `seasonStartVisits`).
- Earning a trophy fires an achievement-style notification and immediately calls `_applyTrophyPassives()`.
- `_applyTrophyPassives()` recomputes all passive bonuses from the full `trophies` set and writes them into four live fields: `catManager.spawnInterval`, `giftBonus`, `offlineRewardBonus`, `moodBonus`. Called on load to restore bonuses from save.
- `giftBonus` is applied in both the `onYarn` callback and the petting gift handler (`Math.ceil(yarn * this.giftBonus)`).
- `moodBonus` flows into `CatManager.update` as a 10th param → `_trySpawnCat` → `new Cat(..., moodBonus)`.
- `offlineRewardBonus` raises the offline reward cap in `_startOfflineReward`.

**Trophy passives by season:**
| Season | Condition | Passive |
|---|---|---|
| 🌸 Spring | 25🧶 in one season | Cats spawn 5% more often |
| ☀️ Summer | 4 visits in one season | All gifts 10% larger |
| 🍂 Autumn | 50🧶 in one season | Offline cap +10🧶 |
| ❄️ Winter | 6 visits in one season | Cats arrive happier (+0.1 mood) |

**Trophy UI in Cat Journal**
- A "🏆 Season Trophies" section appended below the cat list shows a 2×2 grid.
- Earned slots glow gold with the trophy emoji, label, and passive description.
- Unearned slots are dimmed with the season name and the unlock condition as hint text.

### Architecture changes
- `Cat` constructor: new optional `moodBonus = 0` param added to starting mood calculation.
- `CatManager.update`: added `moodBonus = 0` as 10th param (non-breaking).
- `CatManager._trySpawnCat`: passes `moodBonus` to `Cat` constructor.
- Gift bonus is applied at the `Game` level (not inside `Cat.tryGift`) so cats.js stays unaware of trophy state.

### Save data additions
```json
{ "trophies": [], "seasonYarn": 0, "seasonStartVisits": 0 }
```

---

## Session 3 — 2026-06-28

### Features Added

**Cat Birthdays**
- Each cat has a `birthday` season (0–3) in `CAT_DEFS`:
  - Spring (0): Princess, Bubbles
  - Summer (1): Muffin, Zoom
  - Autumn (2): Shadow, Biscuit
  - Winter (3): Duke, Marble
- On spawn, if the current season matches a cat's `birthday`, a 40 % dice roll flags `cat.isBirthday = true`.
- Birthday cats wear a party hat (red cone, yellow stripes, yellow pompom) drawn in `Cat._drawPartyHat`, rendered above the head after ears are drawn.
- When a birthday cat finishes entering the garden (state transitions away from ENTERING), a `confetti` particle burst fires and the cat thinks "🎂 It's my birthday!".
- `tryGift` for birthday cats has gift chance boosted by ×1.5 (capped at 100 %) and payout doubled (×2). Both fav-season and birthday bonuses stack.
- Gift notifications are birthday-aware: "🎂 [Name]'s birthday gift: N🧶!" instead of generic copy.
- Tooltip shows 🎂 tag next to birthday cats.
- Cat Journal shows each cat's birthday season; if the current season matches it shows "🎂" inline.
- New achievement `birthday_pet` (🎂 "Happy Birthday!") — earned by petting a birthday cat at least once.

**New particle type: `confetti`**
- Count 14, glyphs cycle through 🎊 🎉 🎈 ⭐ 🎀.
- Used for the birthday entrance burst and birthday gift effect.

### Architecture changes
- `CatManager._trySpawnCat` now accepts a `season` parameter and returns the spawned `Cat` (or `null`). The `update` method checks the return value and fires an `onBirthday(cat)` callback if provided.
- `CatManager.update` signature: added `onBirthday = null` as 9th parameter (non-breaking; all prior call sites omit it safely).
- `Cat` constructor: two new flags `isBirthday` (set by CatManager post-construction) and `birthdayAnnounced` (gates the entrance confetti burst to fire only once).
- `Cat.update` now captures `prevState` at the top of the method to detect the ENTERING → first real state transition.

### Save data additions
```json
{ "birthdayPetsCount": 0 }
```

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
