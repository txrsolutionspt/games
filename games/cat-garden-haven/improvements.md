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

## Mobile & Touch UX (Primary Target Platform)

The game is primarily played on tablets and smartphones. The issues below affect core gameplay on touch screens and should be prioritised over polish features. Ordered by severity.

---

### [CRITICAL] Long-press to open item context menu

Right-click (which opens the upgrade/remove menu) is impossible on touch. The `contextmenu` event only fires reliably on desktop; on mobile it never arrives or is swallowed by the browser.

**Spec:** On `touchstart` on the canvas, start a 480 ms `setTimeout`. If the finger hasn't moved more than 8 px **and** the timer fires, treat it as a long-press: cancel any pending pet or drag, then open the item context menu at that position (same as the existing right-click path). Cancel the timer immediately on `touchmove` (> 8 px), `touchend`, or `touchcancel`. After a confirmed long-press, set a flag that suppresses the subsequent `touchend` so it doesn't also fire as a pet tap.

- Files: `main.js` (`_bindInput`)
- Effort: small

---

### [CRITICAL] Cat info on touch (tooltip is hover-only)

The cat tooltip (name, mood emoji, season bonus ✨, birthday 🎂) is driven by `mousemove` and never fires on touch. Players on phones can't tell which cat is which before committing to a pet.

**Spec:** On `touchstart` landing on a cat, start a 160 ms delay. If the finger hasn't moved by then, show a floating label above the cat — same content as the desktop tooltip — as a `<div id="touch-label">` positioned in `#main-area`. Dismiss it after 2 s or on the next `touchend`/`touchstart`. If the finger lifts before 160 ms with no movement, treat it as a normal pet-tap (suppress the label). Short tap = pet; slow-then-hold = info. The 160 ms threshold is below the human reaction floor for deliberate taps, so accidental info-shows are rare.

- Files: `main.js` (`_bindInput`), `style.css`
- Effort: small

---

### [CRITICAL] Ghost placement visible above the finger

During item drag, the ghost emoji renders at the exact touch coordinate — directly under the player's thumb and invisible. The player can't see where the item will land or whether placement is valid (green/grey ghost).

**Spec:** Detect touch drags via `e.touches` in `onMove`. When the source event is a touch, apply a −64 px Y offset to the ghost render position so it floats above the fingertip. Apply the **same offset** when computing `garden.canPlace()` and when committing the drop in `onUp`, so the visual matches the actual placement point. Mouse drags keep offset 0.

- Files: `main.js` (`onMove`, `onUp`, ghost rendering in `_render`)
- Effort: small

---

### [HIGH] Touch targets — minimum 44 × 44 px

Several interactive elements fall below the iOS HIG / Material Design recommended 44 × 44 px minimum:

| Element | Current approx. hit area | Problem |
|---|---|---|
| `.hdr-btn` | ~28 × 30 px | All six header buttons |
| `.close-modal` ✕ | ~28 × 28 px | Easy to miss |
| `.journal-tab-btn` | ~32 × 36 px | Three tabs now, crowded |
| `.tab-btn` (shop) | ~36 × 36 px | Four tabs, small phones |

**Spec:** Increase `.hdr-btn` to `min-width: 36px; min-height: 36px; padding: 5px 9px`. Increase `.close-modal` padding to `8px 14px`. Add `touch-action: manipulation` to all buttons and tab elements to eliminate the 300 ms tap-delay on older Android browsers.

- Files: `style.css`
- Effort: small

---

### [HIGH] Cancel item selection — visible on-canvas button

Escape deselects a chosen shop item on desktop. Mobile users have no keyboard. The only current option is tapping the item again in the shop list, which is not discoverable — especially after the player has scrolled the shop or switched tabs.

**Spec:** When an item is selected, show a floating pill button (`<button id="btn-cancel-place">✕ Cancel</button>`) anchored to the top-centre of `#main-area`, above the canvas. Tapping it clears `ui.selectedItem`, resets the canvas cursor, and hides itself. Hide it whenever no item is selected. Style as a rounded chip with semi-transparent background so it doesn't obscure too much garden space.

- Files: `main.js`, `ui.js`, `style.css`
- Effort: small

---

### [HIGH] Haptic feedback

Physical confirmation of actions dramatically improves feel on touch. The Vibration API is available on Android Chrome/Firefox; iOS Safari silently ignores it — no harm done.

**Spec:** Guard every call: `navigator.vibrate?.([...])`. Pulse durations:

| Action | Pattern |
|---|---|
| Cat petted | `[18]` — single light tap |
| Gift received | `[25, 12, 25]` — double pulse |
| Achievement unlocked | `[15, 20, 50]` — rising emphasis |
| Season changes | `[40]` |
| Item placed | `[12]` |
| Treat placed | `[20]` |

- Files: `main.js`, `ui.js`
- Effort: tiny

---

### [HIGH] Swipe to switch shop tabs

Tapping tiny tab buttons while an item is selected (canvas in `placing` mode) is error-prone — a mis-tap places an item instead of switching tabs. Horizontal swipe on the shop area is far more natural on touch.

**Spec:** Track `touchstart` X on `#bottom-panel`. On `touchend`, if `|ΔX| > 50 px` and `|ΔY| < 40 px` (to exclude vertical scrolls), advance (`ΔX < 0`) or retreat (`ΔX > 0`) the active tab in the tabs array `['plants','furniture','toys','decor']`, apply the `.active` class, and call `renderShop()`. Add a faint gradient shadow on the left/right edges of `#shop-items` when more items exist in that direction.

- Files: `ui.js`, `style.css`
- Effort: small–medium

---

### [MEDIUM] Swipe-down to dismiss modals

The native mobile pattern for dismissing bottom-sheet-style panels is a downward swipe. Currently the only options are the ✕ button or tapping the backdrop — both require precise tapping of a small target.

**Spec:** On `.modal-header` `touchstart`, record Y. On `touchmove`, apply `transform: translateY(Math.max(0, ΔY))` to `.modal-inner` (no upward movement). On `touchend`: if `ΔY > 80 px` or swipe velocity > 300 px/s, slide the modal to `translateY(100%)` then `classList.add('hidden')` and reset `transform`. Otherwise snap back with `transition: transform 0.22s ease`. The backdrop tap path remains unchanged.

- Files: `ui.js`, `style.css`
- Effort: medium

---

### [MEDIUM] Landscape phone — recover canvas height

On phones in landscape orientation the canvas collapses to ~180–240 px tall after the header, season bar, and bottom panel — barely enough to see any garden. 

**Spec:** At `@media (max-height: 420px) and (orientation: landscape)`:
- `#game-header`: reduce to `min-height: 32px; padding: 2px 8px`.
- `#header-center h1`: `display: none` (save space; the game is already loaded, the title isn't needed mid-session).
- `#bottom-panel`: collapse to a single-row height of 52 px with no visible tab labels (icons only or abbreviated).
- `#season-bar`: reduce to 2 px.

This recovers ~40–50 px of garden height.

- Files: `style.css`
- Effort: small

---

### [MEDIUM] Shop scroll — containment and snap

Swiping the horizontal shop row on iOS/Android can accidentally trigger the browser's back/forward gesture or page-bounce.

**Spec:** Add to `#shop-items`:
```css
overscroll-behavior-x: contain;        /* prevent browser swipe-back */
scroll-snap-type: x proximity;         /* soft snapping */
```
Add to `.shop-item`:
```css
scroll-snap-align: start;
```
The `proximity` variant only snaps when the item is close to a snap point, avoiding interference with fast flick-scrolling.

- Files: `style.css`
- Effort: tiny

---

### [LOW] Nickname input — scroll into view on keyboard open

When a player taps a cat name in the journal to edit a nickname, the virtual keyboard opens and can push the modal content up or cover the input entirely.

**Spec:** After inserting the `<input>` element, wait one tick (`setTimeout(..., 0)`) then call `input.scrollIntoView({ behavior: 'smooth', block: 'center' })`. This lets the browser finish resizing the viewport before we scroll. No resize listener needed.

- Files: `ui.js`
- Effort: tiny

---

### [LOW] Prevent rubber-band scroll on canvas

On iOS, vertically dragging on the canvas can trigger the page rubber-band effect even though `touch-action: none` is set on `#garden-canvas`. This happens because `#main-area` or `body` still participates in scroll.

**Spec:** Add `overscroll-behavior: none` to `body` and `#main-area`. This is a one-line CSS addition that stops all elastic overscroll without affecting any interactive element.

- Files: `style.css`
- Effort: tiny

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
