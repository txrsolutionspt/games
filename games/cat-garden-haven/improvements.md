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

---

## Product Owner Feature Proposals

The following features were generated from a product owner perspective — focused on player retention, emotional attachment, and depth without breaking the calm/cosy feel.

---

### Cat Mood Memory

**Player pitch:** Cats remember how well you've treated them, so returning visitors feel like old friends rather than strangers.

**Mechanic:** Each cat gets a persistent `affection` score (0–100) in `localStorage`, separate from the per-visit `mood`. Petting raises `affection` by 5. When a cat spawns, its starting mood is seeded from affection (`0.3 + affection * 0.004`). Cats above 70 affection occasionally arrive with a guaranteed gift and show a ♥ in thought bubbles.

**Files:** `data.js`, `cats.js`, `main.js`, `ui.js`
**Effort:** small
**Retention hook:** Rewards consistent petting across sessions. The journal's growing heart indicators give a clear per-cat progress bar.

---

### Seasonal Garden Snapshots

**Player pitch:** Capture a postcard-perfect picture of your garden and revisit it any time.

**Mechanic:** A 📷 button in the toolbar calls `canvas.toDataURL()` and stores up to 4 base64 snapshots in `localStorage` (one per season). A "Gallery" tab inside the Cat Journal shows thumbnails with season emoji, date, and cat count. Saving over an existing season prompts overwrite or keep-both.

**Files:** `ui.js`, `main.js`, `style.css`
**Effort:** small
**Retention hook:** Players naturally want one snapshot per season — a concrete four-slot collection goal that resets every in-game year.

---

### Cat Birthdays

**Player pitch:** On a cat's birthday, they show up in a party hat and leave an extra-big gift.

**Mechanic:** Each cat definition gets a `birthday` season (at least one per season). When a cat spawns in their birthday season, a 40 % chance flags the visit as a birthday: the cat renders with a coloured party hat, confetti particles burst (reuse existing particle system with a multi-colour array), and `tryGift` payout is doubled. Notification: "🎂 It's Muffin's birthday! A special gift!"

**Files:** `data.js`, `cats.js`, `particles.js`, `main.js`
**Effort:** small
**Retention hook:** Periodic surprise events players share ("Zoom had a birthday today!"). Anticipating the next birthday is a gentle daily pull.

---

### Garden Prestige: Seasonal Trophies

**Player pitch:** At the end of each season, earn a permanent trophy that passively boosts your garden forever.

**Mechanic:** On season advance, the game evaluates the just-completed season (yarn earned, cats hosted, items placed) and awards a trophy. Each trophy grants a small permanent passive: e.g. Spring Trophy → cats arrive 5 % more often; Autumn Trophy → offline reward cap +10 yarn. A Trophies section in the journal shows all four slots with silhouettes for unearned ones.

**Files:** `data.js`, `main.js`, `ui.js`, `style.css`
**Effort:** medium
**Retention hook:** Gives every 10-minute season a satisfying conclusion and a reason to stay engaged throughout rather than only checking in at the end.

---

### Personalised Cat Nicknames

**Player pitch:** Give your most-visited cats a personal nickname that shows up everywhere in the game.

**Mechanic:** In the Cat Journal, clicking a seen cat's name turns it into an inline `<input>` (max 12 chars). On blur/Enter the nickname is saved to `localStorage`. Wherever the cat's name appears — tooltip, gift notifications, thought bubbles — the nickname is used, with the default name faintly in parentheses. Nicknamed cats show a 🏷 tag in the journal.

**Files:** `ui.js`, `main.js`, `cats.js`
**Effort:** small
**Retention hook:** Personalisation is one of the strongest idle-game retention levers. Players who name their cats form emotional attachments and return to check on "their" cats.

---

### Twilight Golden Hour

**Player pitch:** For a few minutes each in-game day, the garden glows amber — and the rarest cats love it.

**Mechanic:** A "golden hour" window (timeOfDay ≈ 0.45–0.55) shifts the sky to warm amber/gold, tints the grass orange, and overlays a radial vignette haze. During golden hour the two rare cats (Duke, Marble) get a ×2 spawn-weight bonus. A shimmer particle floats upward from the ground. A faint "✨ Golden Hour" label fades in/out.

**Files:** `garden.js`, `cats.js`, `main.js`, `particles.js`
**Effort:** small–medium
**Retention hook:** Creates a specific daily appointment — players learn rare cats prefer golden hour and start timing sessions accordingly.

---

### Cat Visitor Log (Time-Stamped Diary)

**Player pitch:** Flip through a charming diary of every cat that has visited, with what they did and when.

**Mechanic:** On each cat departure, append a compact entry to a `visitLog` array in `localStorage` (capped at 50): `{ catId, season, timeOfDay, gifted, yarn, petted, timestamp }`. A "Diary" tab in the Cat Journal renders entries newest-first as illustrated sentences: "🌙 Midnight — Shadow visited, left you 18 🧶". Time of day maps to four labels: Morning / Afternoon / Dusk / Night.

**Files:** `main.js`, `ui.js`, `data.js`
**Effort:** medium
**Retention hook:** The diary gives players something to read on open — a sense of life happening while away. It also surfaces patterns ("Shadow always visits at night") encouraging deliberate garden-crafting.

---

### Item Upgrade Tokens

**Player pitch:** Spend a little extra yarn to upgrade a placed item so it attracts cats faster and keeps them happier.

**Mechanic:** Right-clicking a placed item shows an "Upgrade (20 🧶)" option. Upgraded items gain `tier: 1` and render with a soft golden ring beneath them. Cats settling near an upgraded item have `stateDuration` extended by 30 % and `mood` boosted by 0.1 on arrival. Tier is serialised in `garden.serialize()`.

**Files:** `garden.js`, `main.js`, `cats.js`, `ui.js`, `style.css`
**Effort:** medium
**Retention hook:** Gives experienced players a continuous yarn sink that visibly improves their garden, preventing the "too much yarn, nothing to do" stall.

---

### Friendship Biscuit (Daily Treat)

**Player pitch:** Leave a little treat out once a day — whichever cat arrives next will stay extra long and always leave a gift.

**Mechanic:** A "Leave a Treat 🍪" button in the toolbar is enabled once every real 24 hours (gated by `lastTreatTime` in `localStorage`). Clicking places an ephemeral cookie sprite at the garden centre. The next cat spawned heads to the treat first, has `visitDuration` extended by 60 s, and `tryGift` is guaranteed to fire. Button shows "Available tomorrow" while on cooldown.

**Files:** `main.js`, `garden.js`, `cats.js`, `ui.js`, `style.css`
**Effort:** small
**Retention hook:** A lightweight "daily login reward" that feels organic. Players return to place it because it triggers a guaranteed positive moment.

---

### Garden Ambience Customiser

**Player pitch:** Choose your garden's background soundscape — birdsong, rain, or quiet breeze — and make the space truly yours.

**Mechanic:** Using the Web Audio API (already flagged in `soundEnabled`), three procedural ambient modes: Birds (random short tonal chirps), Rain (white-noise `AudioBuffer`), Breeze (low-pass filtered sine). A 🔊 button cycles Off → Birds → Rain → Breeze. Rain mode also applies a visual blue-grey sky tint and boosts Shadow's spawn weight — tying audio and gameplay together. No audio assets required. Mode saved to `localStorage`.

**Files:** `main.js`, `ui.js`, `garden.js`, `cats.js`, `style.css`
**Effort:** medium
**Retention hook:** Ambient sound is a powerful session-length driver in cosy games — players leave the tab open longer when it's pleasant to have in the background. The Shadow/rain tie-in gives gameplay incentive to actually use the modes.
