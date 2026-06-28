# Cat Garden Haven — Improvements & New Features

A living reference for ideas to explore in future sessions. Grouped by theme; rough effort noted per item.

---

## Visual / Feel

### Cats enter from both sides
Currently `this.x = -60` is hardcoded, so every cat always walks in from the left. They should randomly enter from the right edge too (`x = canvasW + 60`, `facing = -1`).
- Effort: tiny (1–2 lines in `Cat` constructor)

### Unique emoji per cat in the journal
`openJournal()` falls back to `🐾` for Biscuit, Bubbles, Duke, and Marble. Every cat should have their own icon so the journal feels personal.
- Effort: small (add an `emoji` field to each `CAT_DEFS` entry, use it in `ui.js`)

### Rarity indicator in journal and tooltip
Cats have `rarity: 'common' | 'uncommon' | 'rare'` but it is never surfaced to the player. Show it in the journal entry (e.g. ⭐ / ⭐⭐ / ⭐⭐⭐) and optionally in the hover tooltip.
- Effort: small

### Seasonal ambient particles
Each season could have a passive ambient effect that plays in the background:
- Spring → slow falling cherry blossom petals 🌸
- Summer → occasional butterfly 🦋 drifting across
- Autumn → falling leaves 🍂 (particle type already exists)
- Winter → gentle snowfall ❄️
Could be driven directly in `Garden.drawBackground` using a time-based loop, similar to how fireflies work.
- Effort: medium (new particle/sprite logic per season)

### Night sky improvements
Stars are currently simple dots. Could add a shooting star that arcs across occasionally, or a subtle moon glow (radial gradient halo). The existing `timeOfDay` system makes this straightforward to gate.
- Effort: small–medium

### Cat name tag on hover / tap
The tooltip shows name + personality + mood. A persistent small name tag drawn just above the cat's head (very faint, only on hover) could make the garden feel more alive without cluttering the canvas.
- Effort: small

### Item shadow quality
Placed items use a blurred drop shadow via `ctx.filter = 'blur(3px)'`. On some browsers the filter approach is slow. Replacing with a hand-drawn ellipse shadow would be faster and look better at scale.
- Effort: small

---

## Gameplay / Progression

### Season progress indicator
The season advances every 600 s of active play but the player has no feedback on how close the next change is. A small arc, bar, or season icon that fills up in the header (next to the yarn counter) would make the timer feel meaningful.
- Effort: small (draw arc on canvas or update a CSS width)

### Favourite-season spawn boost
`favSeason` currently only multiplies gift amounts. Cats should also be slightly more likely to visit during their favourite season (e.g. spawn weight ×1.3 on top of the existing rarity weight). Ties the season system to the spawning system.
- Effort: tiny (one condition in `CatManager._trySpawnCat`)

### Cat mood affects visit duration
Currently visit duration is random (30–90 s) regardless of how petted/happy a cat is. A cat with high mood could stay longer; a cat that's never petted and has low mood could leave earlier. Would make petting feel more consequential.
- Effort: small (`_startLeaving` could check `this.mood`)

### Rare cat teaser silhouettes
Locked rare cats (Duke, Marble) could appear in the garden as a faint silhouette that drifts through and then vanishes, giving the player a hint that they exist before unlocking them via the journal.
- Effort: medium (new ghost-cat rendering pass in `CatManager`)

### Combo petting bonus
Petting multiple cats in quick succession (e.g. 3 cats within 30 s) triggers a brief "Garden Harmony" bonus: spawning is slightly faster or the next gift is guaranteed for a short window.
- Effort: medium (needs a combo timer in `Game`)

### Offline reward scaling
The offline reward currently caps at 50 🧶 at 0.8/min. Could scale by number of unlocked cats or placed items (more items = more cats visited while away = more yarn), giving the item system a passive-income dimension.
- Effort: small (adjust `_startOfflineReward` formula)

---

## Achievements

The current 7 achievements are a good start. Additions to consider:

| ID | Emoji | Label | Trigger |
|---|---|---|---|
| `all_uncommon` | 🌙 | Uncommon Friends | All uncommon cats seen |
| `all_rare` | 💎 | Rare Collector | Both rare cats seen |
| `yarn_500` | 🏆 | Yarn Master | 500 total yarn earned |
| `yarn_1000` | 👑 | Yarn Royalty | 1 000 total yarn earned |
| `pets_10` | 🤝 | Garden Favourite | Pet cats 10 times total |
| `all_seasons` | 🌍 | Witness to All Seasons | See all 4 seasons change |
| `full_garden` | 🌳 | Full House | 20 items placed at once |
| `night_owl` | 🌙 | Night Owl | Have 3+ cats visit at night (timeOfDay > 0.65) |
| `zen_5` | 🧘 | Serenity | Stay in Zen Mode for 5 consecutive minutes |

---

## UI / UX

### Achievement viewer
Achievements are earned but only visible as fleeting notifications. An Achievements tab inside the Cat Journal modal (alongside the cat list) would let players see what they've earned and what's still locked, with a clear description of each trigger.
- Effort: medium (new tab + render loop in `ui.js`)

### Randomised hint order
`_showHint` cycles hints in fixed index order. Shuffling or picking randomly would make the garden feel less scripted.
- Effort: tiny

### Tooltip boundary clamping
The tooltip `left` / `top` position is calculated with a fixed +10/-30 px offset and can clip off-screen on small viewports. Clamping it to canvas bounds would fix this.
- Effort: tiny

### Clarify undo vs right-click removal
The ↩️ button removes the *last placed* item; right-click removes the *item under cursor*. These are different operations but the hint text calls them the same thing. Rename the button to "Undo last" in the tooltip and update the relevant hint.
- Effort: tiny

### Sound toggle
`game.soundEnabled = false` is set but sound is never implemented. Either add a simple oscillator-based purr/chime when petting and a soft bell for gifts (Web Audio API, no assets needed), or remove the flag entirely to avoid confusion.
- Effort: medium (Web Audio) or tiny (remove flag)

### Mobile long-press to remove item
Right-click removal works on desktop but not on touch. A long-press handler (pointer held > 500 ms without movement) on the canvas would enable the same behaviour on mobile.
- Effort: small (add `touchstart` + `setTimeout` + cancel on move/end)

---

## Stretch / Bigger Ideas

### Cat relationships
Some cats could have relationships: Muffin and Zoom are friends and get a mood boost when both are present; Princess and Duke won't visit at the same time. Adds narrative texture without extra content.

### Garden weather system
Separate from the day/night cycle — occasional rain (lines of particles, darker sky) or fog in Autumn. Weather could influence which cats visit (Shadow loves rain; Zoom hides from it).

### Seasonal shop rotations
Certain items are only available in specific seasons (e.g. "Snowman" decor in Winter, "Pumpkin" in Autumn). Resets each season to give players something to look forward to.

### Named garden / sharing
Let the player name their garden. Display the name in the header and encode a shareable URL fragment with the garden name + season + cat count so players can share a snapshot on social media.

### Cats leave footprints
When a cat walks across a soft-ground area, leave a brief fading paw-print trail. Purely cosmetic, very charming.

### Daily visit streak
Track consecutive days the player opens the game. A streak badge in the header (🔥 3 days) with a small bonus yarn reward for each new day.
