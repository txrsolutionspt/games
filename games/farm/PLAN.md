# Little Farm School — Implementation Plan

Companion to `Initial-prompt.md`. That file is the product brief; this file is the
engineering plan for building the MVP it describes: a kid-friendly, educational,
mobile-first farming game with **no backend**, plain HTML/CSS/JS, matching the
conventions already used by the other games in this repo (e.g. `games/kingdom-run`
for its flat `js/` folder of plain `<script>` files, `games/last-little-farm` for
keeping pure game-logic in a Node-testable, DOM-free module).

Working name for the game folder's UI: **"Little Farm School"** (placeholder title,
easy to change in `config.js`).

## 1. Guiding constraints from the brief

- Client-side only: no server, accounts, login, cloud save, chat, ads, or
  paid currency.
- Touch-first, landscape-only on phones/tablets (side-rail HUD and tool
  belt need width, not height); also usable with mouse on desktop. Touch
  devices held in portrait see a "rotate your device" prompt that blocks
  play until they turn sideways — see §11.
- Data-driven: crops, animals, recipes and missions are defined as data, not
  hard-coded into UI/rendering code, so new content is additive.
- Every mechanic maps to a real (simplified but not *wrong*) farming concept.
- No punishment-heavy mechanics: neglect should degrade yield/quality, never
  silently destroy the player's progress or force a restart.
- Ship a small, complete MVP loop first: **Prepare → Plant → Care → Harvest →
  Process → Sell → Improve → Learn**.
- Zero external network calls once the page has loaded: no CDN-hosted
  fonts, icon libraries, images, or scripts. Everything the game needs
  (font stack, glyphs, code) ships in `games/farm/` itself, so "playable
  offline after the initial load" (per the brief) is actually true rather
  than accidentally broken by one `<link href="https://fonts...">` tag.
- Ship a plain-language privacy notice appropriate for a children's,
  no-data-collection game (see `PRIVACY.md` and §11).
- Must support translation into multiple languages, not just be written in
  English: ship **English and Portuguese** at launch, with every
  player-facing string routed through a translation lookup so a new
  language is addable without touching rendering/UI code (see §6).

## 2. Tech stack & why

- Plain HTML5 + CSS + vanilla JS, no build step, no framework, no bundler —
  consistent with every other game in `games/`. Opens directly via
  `index.html` and deploys as-is to GitHub Pages.
- Rendering: **HTML5 Canvas** for the farm grid (pseudo-isometric diamond
  tiles), **DOM** for all UI chrome (HUD, tool belt, modals, mission list).
  Canvas is used only where free-form 2D drawing genuinely helps; DOM/CSS is
  used for anything that is really a button, list, or dialog, because DOM
  gives free accessibility, text wrapping and touch hit-targets.
- No sprite/art assets are available. MVP visuals use simple canvas-drawn
  shapes plus a layer of large emoji/glyphs (🌱🌾🥕🐔🐄🐑) as crop/animal/
  building icons — original, colorful, zero licensing risk, and trivially
  swappable for commissioned art later (see §16). This matches the brief's
  "prioritize fun, clarity, educational value... over graphical complexity."
- Game-logic modules follow the `farm-logic.js` pattern already used by
  `last-little-farm`: plain functions with no DOM access, exported via
  `module.exports` when running under Node so they stay unit-testable, and
  attached to a global namespace in the browser.
- Text uses the OS/browser system font stack (`-apple-system, "Segoe UI",
  Roboto, sans-serif`) in `style.css` — no `@font-face`/Google Fonts/CDN
  request, keeping with the zero-external-network-call constraint above.

## 3. Core systems & gameplay architecture

A player's tap flows down through four layers before it's reflected in the
save file; each layer only calls into the one directly below it:

```
+-----------------------------------------------------------------+
|                       UI & Input Layer                          |
|   Canvas farm grid + DOM chrome — touch/mouse tool belt,        |
|   modal dialogs (render.js, hud.js, modals.js, input.js)        |
+-------------------------------+-----------------------------------+
                                |  tool selection, tile taps
                                v
+-----------------------------------------------------------------+
|                          Game Engine                             |
|   Action handlers, mission tracker, UI event notifications       |
|   (game.js, missions.js, tutorial.js)                            |
+-------------------------------+-----------------------------------+
                                |  validated actions
                                v
+-----------------------------------------------------------------+
|                       Simulation Logic                           |
|   Tick loop — crop growth, animal needs, machine processing      |
|   (simulation.js, economy.js)                                    |
+-------------------------------+-----------------------------------+
                                |  consults
                                v
+-----------------------------------------------------------------+
|                    Data & Rules Registry                         |
|   Crops, animals, recipes, missions, educational text            |
|   (data-*.js, farm-rules.js)                                     |
+-----------------------------------------------------------------+
```

This is a simplified *read path*, not a strict one-way pipeline. `state.js`
is the actual source of truth every layer shares, and both `render.js`
(drawing the current frame) and `persistence.js` (autosave/load) read and
write it directly rather than passing through the Game Engine/Simulation
layers above. The Data & Rules Registry is static reference data consulted
*by* Simulation Logic — it doesn't get written to — while `state.js` and
`persistence.js` handle everything that actually changes and gets saved:

```
              +-----------+          +------------------+
   read/write |  state.js | <------> |  persistence.js   |
   (every     | (canonical|          |  (localStorage     |
   layer      |   game    |          |   autosave/load/   |
   above)     |   state)  |          |   reset)           |
              +-----------+          +------------------+
```

## 4. File layout

```
games/farm/
  index.html
  style.css
  Initial-prompt.md        (existing brief)
  PLAN.md                  (this file)
  PRIVACY.md               plain-language privacy notice (source text for the in-game Settings > Privacy panel)
  js/
    config.js               constants: save key, tick rate, time scale, tool ids
    data-crops.js            crop definitions (data-driven)
    data-animals.js          animal definitions
    data-recipes.js          processing-chain definitions
    data-seasons.js          season + weather tables
    data-missions.js         mission/tutorial step definitions
    events.js                tiny pub/sub event bus
    farm-rules.js            pure simulation rules (DOM-free, Node-testable)
    state.js                 initial-state factory + accessors, schema version
    persistence.js           localStorage load/save/reset, autosave
    simulation.js            tick loop: growth, animal needs, weather/season
    economy.js                buy/sell/unlock costs, currency mutations
    missions.js               mission progress tracking + "what you learned"
    render.js                 canvas grid + isometric tile projection & drawing
    input.js                  pointer/touch handling, tool belt, tile picking
    hud.js                     DOM HUD: currency, clock, season/weather, tools
    modals.js                  shop, processing building, mission, settings/reset
    tutorial.js                first-run guided steps
    i18n.js                    translation lookup: i18n.t(key, fallback), locale switching
    locale-en.js                English UI-chrome strings (English content strings live in data-*.js itself)
    locale-pt.js                Portuguese string overrides
    game.js                    bootstrap, requestAnimationFrame loop, wiring
  test-farm-rules.js         Node-runnable unit tests for farm-rules.js
```

Flat `js/` folder (no nested subfolders) to match `games/kingdom-run`'s
convention of one `<script>` tag per module, loaded in dependency order in
`index.html`.

## 5. Data model (content is data, not code)

Each content type lives in its own `data-*.js` file as a plain array/object
(a `const` assigned in a script-tag-loaded file, not a `.json` fetched over
the network — see the note after the examples), so adding a crop or recipe
never touches rendering, input or simulation code.

**Crop** (`data-crops.js`), MVP set of 6 — wheat, carrot, tomato, corn,
strawberry, potato — chosen to span different growth times, water needs and
seasons. `waterRequired` is a *count*, not a timer: the player can give the
crop that many waterings whenever they like during growth, on their own
schedule, rather than hitting a strict real-time window. That keeps care
forgiving for kids while still teaching that crops need repeated attention,
and leaves room for a "use less water" mission later (reward harvests that
hit the minimum required waterings without over-watering):

```js
{
  id: 'wheat',
  name: 'Wheat',
  icon: '🌾',
  seedCost: 5,
  growthStages: 4,            // seed → sprout → growing → mature
  growTimeSec: 180,           // real-time seconds to fully mature (scaled by config.timeScale)
  waterRequired: 2,           // times the player must water during growth, at their own pace
  season: ['spring', 'summer', 'fall'],
  harvestYield: { item: 'wheat_grain', qty: 3 },
  sellPrice: 4,
  educational: 'Wheat is a grass. Its grain is ground into flour to make bread.'
},
{
  id: 'tomato',
  name: 'Tomato',
  icon: '🍅',
  seedCost: 8,
  growthStages: 4,
  growTimeSec: 260,
  waterRequired: 3,           // thirstier crop — needs more waterings for full-quality fruit
  season: ['summer'],
  harvestYield: { item: 'tomato', qty: 3 },
  sellPrice: 6,
  educational: 'Tomatoes need plenty of sunlight and water before they are ready for sauce.'
}
```

**Animal** (`data-animals.js`), MVP set of 3 — chicken (eggs), cow (milk),
sheep (wool). `needs.feedItemId` points at a real harvested crop item (here,
the `wheat_grain` the player's own wheat produces) rather than an abstract
"feed" resource, so feeding animals is visibly tied to crops the player
actually grows:

```js
{
  id: 'chicken',
  name: 'Chicken',
  icon: '🐔',
  cost: 30,
  needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 120, waterPerCycleSec: 120, shelter: 'coop' },
  produces: { item: 'egg', qty: 1, cycleSec: 90 },
  happinessDecayIfNeglected: true, // lowers yield, never removes the animal
  educational: 'Chickens turn the wheat you grow into eggs — real farms feed animals what they grow.'
},
{
  id: 'cow',
  name: 'Cow',
  icon: '🐄',
  cost: 120,
  needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 180, waterPerCycleSec: 150, shelter: 'barn' },
  produces: { item: 'milk', qty: 1, cycleSec: 200 },
  happinessDecayIfNeglected: true,
  educational: 'Cows eat grain and grass and turn it into milk, which can become butter or cheese.'
}
```

**Recipe** (`data-recipes.js`) — processing chains, `inputs → time → output`.
MVP ships four, satisfying the "at least 3" requirement with headroom:

```js
{ id: 'flour',  building: 'mill',   inputs: [{item:'wheat_grain', qty:3}], timeSec: 60,  output: {item:'flour', qty:1} }
{ id: 'bread',  building: 'bakery', inputs: [{item:'flour', qty:2}],       timeSec: 90,  output: {item:'bread', qty:1} }
{ id: 'butter', building: 'churn',  inputs: [{item:'milk', qty:2}],        timeSec: 60,  output: {item:'butter', qty:1} }
{ id: 'sauce',  building: 'kitchen',inputs: [{item:'tomato', qty:3}],      timeSec: 45,  output: {item:'tomato_sauce', qty:1} }
```

Each recipe carries an `educational` string. It's shown as a popup only the
*first* time that product completes, and is otherwise available on demand —
see §12 for why every completion doesn't launch a modal.

**Season/weather** (`data-seasons.js`): 4 seasons cycling on a fixed in-game
day counter; each day rolls a simple weather state (`sunny | rainy | cloudy`)
from a per-season weighted table. Rain auto-waters crops that day (teaches
"rain is water too"); nothing punishing happens on cloudy/sunny days, they
just don't offer free water.

**Missions** (`data-missions.js`): id, trigger event + condition, reward,
and a short `learned` explainer, e.g.:

```js
{ id:'first-wheat', trigger:'harvest', match:{crop:'wheat'}, count:1,
  title:'Grow your first wheat', reward:{coins:10},
  learned:'Wheat takes time to grow — that time is part of why food takes work to produce.' },
{ id:'grain-to-flour', trigger:'process', match:{recipe:'flour'}, count:1,
  title:'From grain to flour', reward:{coins:15},
  learned:'You ground wheat grain into flour — processing turns a raw crop into a cooking ingredient.' }
```

## 6. Localization (English & Portuguese, extensible)

The brief calls for a game any child can pick up with minimal reading —
that now extends to *which* language they read it in. All player-facing
text must go through a translation lookup rather than being written
directly into rendering/UI code, the same "data, not hard-coded" principle
already applied to crops/animals/recipes/missions (§1).

- `js/locale-en.js` and `js/locale-pt.js` each export a flat
  `key → string` dictionary (English and Portuguese at launch). `js/i18n.js`
  exposes `i18n.t(key, fallback)`: look up `key` in the active locale's
  dictionary, fall back to `fallback` (or plain English) if the key is
  missing, so a partially-translated locale never shows a blank string.
- **UI chrome strings** (tool belt labels, modal titles/buttons, HUD
  labels, the Privacy panel text) live only in the locale files, addressed
  by keys like `ui.toolbelt.water` or `ui.settings.resetGame`.
- **Content strings** (crop/animal/recipe names, educational facts, mission
  titles/descriptions/`learned` text) keep the plain English text already
  shown in the `data-*.js` examples in §5 — that text doubles as the
  built-in English fallback, so `locale-en.js` never needs to duplicate it.
  Every lookup instead goes through a key derived from the entry's `id`,
  e.g. `i18n.t('crop.wheat.name', crop.name)` /
  `i18n.t('crop.wheat.fact', crop.educational)`. `locale-pt.js` only needs
  to supply the keys it wants to translate (`'crop.wheat.name': 'Trigo'`,
  `'crop.wheat.fact': 'O trigo é uma gramínea...'`), so adding a locale is
  additive and never touches `data-*.js`.
- **Locale selection**: `state.settings.locale` (`'en'` or `'pt'`),
  persisted like any other setting. First run guesses from
  `navigator.language` (`pt*` → Portuguese, anything else → English);
  after that, a language toggle in the Settings modal (§11) lets the
  player override it — a simple "EN | PT" pair of large icon-first
  buttons, not a dropdown menu, matching the rest of the UI. Switching
  locale re-renders in place; no page reload needed.
- Adding a third language later is purely additive: drop in
  `js/locale-<code>.js`, add one `<script>` tag, add one button to the
  language toggle — nothing else in the codebase changes.

## 7. State & persistence

- `state.js` builds the canonical shape once (`createInitialState()`):
  `{ version, coins, day, season, weather, farmPlots[], buildings[],
  animals[], inventory{}, unlockedFeatures[], missions{}, tutorialStep,
  settings{}, lastTickTimestamp }`. Plots/animals are plain serializable
  objects (id, position, cropId/animalId, plantedAt, lastWateredAt,
  lastFedAt, growthStage, quality).
- `persistence.js` owns `localStorage`, split across two kinds of keys:
  a **slots index** (`farm-school-slots-v1`) holding the list of "Farms"
  (id, name, createdAt/updatedAt, a lightweight `preview` of coins/day for
  the list UI) plus which one is active, and one **per-slot save**
  (`farm-school-save-v1:<slotId>`) per farm holding that farm's full
  serialized state. JSON-serializes the whole state and debounces autosave
  (~1s after any mutation) so gameplay never blocks on writes. Includes a
  `schemaVersion` and a plot-count shape check so future field/grid-size
  changes don't load a mismatched save.
- No save-on-open: a fresh boot schedules its first autosave
  `CONFIG.initialAutosaveDelayMs` (10s) out rather than writing immediately,
  since just opening the game (and leaving again a moment later) would
  otherwise re-write a save that's often identical to what's already there,
  and needlessly bump the farm's "last played" order in My Farms. It shares
  the same timer a real action's autosave uses, so anything the player
  actually does in those first 10s reschedules straight down to the normal
  short debounce — only truly idle time gets the long delay. The per-tick
  simulation loop (§8) only reschedules a save when the tick actually
  changed something (a day boundary, or a crop/animal/job newly ready), not
  on every tick unconditionally, so ticking alone can't quietly override
  this delay the way an unconditional per-tick save would.
- `game.js` also flushes a synchronous save immediately on `visibilitychange`
  (fires when a mobile browser is backgrounded — the case `beforeunload`
  often misses) and `pagehide` (desktop tab close/navigation), so the last
  action before the player leaves is never sitting unsaved inside that ~1s
  debounce window. A 💾 **Save** button in the HUD rail (next to Market)
  calls the same immediate `saveNow` and shows a "Saved!" toast, so a player
  who wants certainty doesn't have to trust an invisible background
  mechanism.
- `test-persistence.js` (`node test-persistence.js`) exercises the actual
  save/load round trip through `persistence.js` itself — not just
  farm-rules.js's pure math — asserting coins and planted-crop occupants
  come back identical after a save+load. `persistence.js` only ever touches
  `CONFIG`/`localStorage` as ambient globals (same as the browser's
  `<script>` load order provides), so the test stubs an in-memory
  `localStorage` and sets `global.CONFIG` before requiring it, rather than
  needing a browser.
- **Farms (save slots):** the Settings modal's "My Farms" screen lists every
  slot (name, coins/day preview, which one is currently active) with
  Play/Rename/Delete per row and a "New Farm" button. Switching or creating
  a farm flushes the current farm's autosave, updates the active slot id,
  then reloads the page so `game.js` re-boots cleanly against the new slot
  rather than hot-swapping in-memory state and timers. The last remaining
  farm can't be deleted (there must always be at least one). The very first
  time the slots index doesn't exist yet, `persistence.js` auto-migrates any
  pre-slots single-key save it finds into a slot named "Farm 1" (preserving
  its coins/day for the preview) and removes the old key, so existing
  players' progress carries over transparently.
- A **Reset Game** action lives in the settings modal (confirm dialog before
  clearing), satisfying the brief's "mechanism to reset local data for
  dev/testing" requirement. This is also the action the in-game Privacy
  panel points to (§11) when it tells a parent how to clear saved data. Note
  this wipes *every* farm and the slots index itself — it's a full reset,
  distinct from deleting a single farm from "My Farms".
- On load, persistence computes elapsed real time since
  `lastTickTimestamp` and hands it to `simulation.js` as one bounded
  catch-up step (capped, e.g., at 24 in-game hours of progress) so crops/
  animals keep progressing while the tab is closed, without an unbounded
  loop if the player returns after a week.

## 8. Simulation & time model

- `config.js` defines `timeScale` (real seconds per in-game "tick") so the
  whole game can be sped up/slowed for tuning without touching content data.
- `simulation.js` runs on a coarse interval (e.g. every real second) rather
  than every animation frame:
  1. Advance the day/season/weather clock.
  2. For each planted plot: accumulate grow time on its own clock, advancing
     `growthStage`; each player watering (or a rainy day, which counts as
     one free watering for every plot) ticks off one of the crop's
     `waterRequired` count; if the crop matures without enough waterings,
     keep growing but cap `quality` lower instead of killing the plant.
  3. For each animal: accumulate need timers; if fed/watered in time,
     accrue produce; if neglected, happiness (and thus yield) drops, animal
     is never removed or "dies".
  4. For each active processing job: advance timer, complete when done and
     push output into inventory.
  5. Emit events (`cropMatured`, `harvest`, `eggCollected`, `productReady`,
     `seasonChanged`, ...) on the shared bus for `missions.js` and `hud.js`
     to react to, keeping simulation decoupled from UI.
- `farm-rules.js` holds the actual pure decision functions used by both the
  simulation and the UI (`canPlant`, `canWater`, `canHarvest`, `canFeed`,
  `canCollect`, `computeGrowthProgress`, `computeYieldQuality`,
  `canStartRecipe`), so they can be unit-tested exactly like
  `last-little-farm/farm-logic.js` is today.

## 9. Rendering (pseudo-isometric grid)

- `render.js` owns a single `<canvas>` sized to the viewport. The farm is a
  2D grid (`CONFIG.gridCols` × `gridRows`, 60×60 = 3,600 plots) projected
  to diamond ("2:1 pseudo-isometric") screen coordinates with a small,
  well-documented `gridToScreen(x, y)` / `screenToGrid(px, py)` pair of
  pure functions — the same math both draws tiles and interprets taps, so
  hit-testing can't drift from rendering.
- Draw order per frame: ground tiles → fences/paths → buildings → crops/
  animals (back-to-front by grid row for correct overlap) → transient
  effects (sparkle on harvest-ready, water droplet animation).
  Crops/animals/buildings are drawn as flat shapes + emoji glyph, scaled by
  `devicePixelRatio` for crisp mobile screens.
- Idle-but-alive feel: small per-frame bob/sway animation on
  ready-to-harvest crops and animals, done with a time-based sine offset —
  cheap and reads as "friendly and alive" without needing sprite sheets.
- Pinch/scroll-to-zoom and drag-to-pan on the field itself (§10), not a
  tool-belt button.

### Camera & world size

The field is deliberately bigger than any one screen — 3,600 plots is far
more than a phone (or even a desktop frame) can show at a readable size at
once, spanning many screens' worth of scrolling in every direction — so
most of it is only reachable by panning/scrolling, the same as a map.
`computeGeometry()` no longer shrinks the whole grid to fit the canvas; it
picks a natural, readable tile size (bounded so it can't shrink below
legible on a narrow phone or balloon huge on a wide desktop frame)
independent of how big the field is, and centers the initial camera on
the starting unlocked cluster (`FOCUS_COL`/`FOCUS_ROW`) rather than the
grid's overall geometric center — a new player should land looking at
their own plots, not empty locked land in the middle of a big field.

A separate `applyView(baseGeom, {zoom, panX, panY})` scales that baseline
around the canvas center and shifts it by the pan offset every frame,
producing the same `{tileW, tileH, originX, originY, ...}` shape
`gridToScreen`/`screenToGrid` already expect — so neither of those, nor
the object hit-testing above, needs to know zoom/pan exist at all.

`{zoom, panX, panY}` (the "view") lives on the ephemeral `ui` object like
`tool`, not saved game state — it resets to that natural-size,
home-cluster-centered camera on reload, the same as reopening a map app.
`Render.clampView` keeps it sane: zoom is bounded to a sensible min/max
(zooming out further than that would make tiles unreadably small; zooming
in further wouldn't show meaningfully more detail), and pan is bounded to
the field's own extent — past a point there's simply no more world left
in that direction — which scales with both zoom and `CONFIG.gridCols`/
`gridRows`, so a bigger field automatically means more room to pan.

**Why 3,600 plots and not more.** `CONFIG.gridCols`/`gridRows` is a
deliberate ceiling for the current architecture, not an arbitrary number:
`state.plots` holds one object per plot and gets `JSON.stringify`'d into
`localStorage` on every autosave, and `draw()` sorts/iterates every plot
each frame. At 3,600 plots a save is well under 1MB (`localStorage`
quotas are typically ~5–10MB) and the per-frame sort is imperceptible at
60fps — both comfortably safe without changing how state or rendering
work. Going much past that — say, the six-figure-plot-count a literal
1000×1000 field would mean — stops being safe: most of that array would
be default "locked, empty" filler nobody will ever reach, serialized into
every save regardless. That would need a genuinely different, sparser
world model (only store plots that have actually been touched; only draw
what's on screen) rather than just raising this number further.

## 10. Terrain & tile types

The field is no longer visually/functionally uniform farmland — every
unlocked plot has one of four terrain types, each restricting what can be
placed there. This is a placement-and-visuals layer only for now (see the
"not in this pass" note below for the bigger follow-on ideas it deliberately
leaves out).

- **Farmland (soil)** — the default; plantable. Crops and processing
  buildings (mill/bakery/churn/kitchen) can both go here, same as every
  plot could before this feature.
- **Pasture (grassland)** — animals only. Crops and buildings can't be
  placed here; it exists specifically so a farm reads as having a
  dedicated area for livestock, not livestock scattered arbitrarily
  wherever.
- **Lake** — nothing can be placed here. Pure scenery/future-hook for now
  (see below).
- **Mountain** — nothing can be placed here either. Same reasoning as
  Lake.

**Generation is a pure function of position, not saved state.** Rather than
adding a `terrain` field to every one of the 3,600 saved plot objects
(bloating every save and requiring a schema migration — see §7), terrain is
computed on demand from `(col, row)` by `FarmRules.terrainForPlot`, the same
"pure function, shared by every consumer" approach `farm-rules.js` already
uses for crop/animal/recipe math. It's deterministic — the same field
layout every time, for every player, forever — and Node-testable exactly
like the rest of `farm-rules.js`.

- Plots are grouped into `CONFIG.terrainBlockSize` × `terrainBlockSize`
  blocks (default 4×4), and each *block* — not each individual plot — gets
  hashed to a terrain type (the same `Math.sin`-based deterministic-hash
  trick `simulation.js`'s `hashDay` already uses, seeded by the block's own
  coordinates). Hashing per-block rather than per-plot means each terrain
  type forms a readable multi-tile patch instead of a single-tile speckle
  scattered randomly across the field.
- Weighted distribution: soil 65%, pasture 15%, lake 12%, mountain 8% — soil
  stays the common case so the game doesn't feel terrain-starved.
- **Safe zone:** only the starting cluster itself — row 0, `col <
  CONFIG.terrainSafeCols` (kept equal to `initialUnlockedPlots`) — is forced
  to soil regardless of the hash, guaranteeing the tutorial's first "tap an
  empty plot and plant wheat" step always lands on usable ground.
  Deliberately narrow, not a whole safe row: since plots unlock in
  row-major order, forcing all of row 0 to soil would make pasture (and
  therefore animals) unreachable until a player unlocked all the way into
  row 1 — a much bigger, more expensive stretch of the field — which would
  break the early-game loop rather than protect it. Beyond the starting
  cluster, row 0 gets real terrain variety like anywhere else, so an early
  pasture patch (and a first chicken) stays within easy reach.
- Locked plots still render as the same uniform gray padlock tile
  regardless of underlying terrain — terrain is only revealed once a plot
  is unlocked, so a locked tile never looks like it's promising a lake the
  player can't actually reach yet. The unlock-plot modal *does* show the
  terrain (icon + name + one-line hint) before the player spends coins, so
  "why can't I plant here" is answered before the purchase, not after.
- **Every plot starts unlocked, for now.** `state.js`'s `createInitialState`
  sets `unlocked: true` on every plot rather than gating it behind
  `initialUnlockedPlots`/coins, so the whole 60×60 terrain patchwork is
  visible immediately instead of being revealed plot-by-plot as a player
  buys their way outward. The buy-to-expand machinery this bypasses
  (`farm-rules.js` `canUnlockPlot`, `input.js` `unlockPlot`, `Modals.
  showUnlockPlot`, the locked-tile padlock rendering) is left fully in
  place, just unreachable — reverting is a one-line change back to
  `unlocked: i < CONFIG.initialUnlockedPlots`. `initialUnlockedPlots` itself
  stays in `CONFIG` regardless, since it still anchors the starting camera
  focus and sizes the terrain safe zone above.
- Attempting to plant/build on non-soil or place an animal on non-pasture
  shows a specific toast (e.g. "Crops need farmland soil!") rather than
  silently doing nothing — the same "always give feedback" rule the rest of
  the input layer already follows for insufficient coins, etc. The
  plant/animal/building highlight-on-hover while a tool is selected (§11)
  is also terrain-aware, so a player only sees a tile light up if it can
  actually accept what they're about to place.

**Not in this pass — deliberately deferred (§17):** lakes powering
irrigation/watering-can refills, and mountains/quarries yielding a stone or
mineral resource that feeds into building costs. Both are real, separate
systems (a new resource type and its own economy hooks; a new watering
mechanic) rather than an extension of this placement-and-visuals layer, and
are listed as future extensibility so this pass stays a scoped, shippable
step rather than growing into a second economy mid-implementation.

## 11. Input & controls

- Tool belt is a right-hand side rail (large DOM buttons, thumb-reachable
  in landscape, per §11): Seeds
  (opens shop drawer to pick a crop), Water can, Harvest hand, Feed bucket,
  Build/Process. Selecting a tool highlights valid tiles on the canvas
  (computed via `farm-rules.js`, e.g. only empty plots glow when Seeds is
  selected).
- Tap a tile with a tool selected → `input.js` runs the matching
  `farm-rules.can*` check, and if valid, calls into `simulation.js`/
  `economy.js`, then emits the corresponding event for missions/HUD/toast
  feedback (always positive-toned: a friendly shake/"not yet!" icon rather
  than an error dialog when an action isn't valid yet).
- Tapping an animal opens a small info card (needs status, produce ready);
  tapping a building with a completed job collects the output; tapping an
  empty building slot opens the recipe picker modal.
- Pointer events are used (not separate touch/mouse handlers) so the same
  code path serves touch and mouse. Every game *action* (plant, water,
  harvest, feed, ...) is still tap-only, keeping controls simple for
  children; the only drag/multi-touch gestures are the field's own
  zoom/pan (below), which never trigger a tile action by themselves.
- Pinch (two pointers) zooms the field; scroll/trackpad zooms it on
  desktop; a single pointer that moves past a small threshold pans it
  instead of tapping. A double-tap resets the view back "home" (zoom 1,
  centered on the starting cluster — see §9). Because a tap and the
  *start* of a pan look identical until the pointer actually moves, a
  single pointer is provisionally treated as `mode: 'drag'` and only fires
  its tile action on release if it never passed that movement threshold —
  so an accidental tiny wobble mid-tap still counts as a tap, but a real
  drag never fires one. Whenever the view isn't already at home (zoomed
  in, or panned away from the starting cluster — panning happens at zoom
  1 too, since the field is bigger than the screen even there), a tap on
  a tile is held for ~280ms before it fires, specifically so a following
  second tap can cancel it and reset the view instead of *also* acting on
  whatever tile happens to be underneath (e.g. opening an unlock-cost
  modal on a locked plot mid-double-tap). Right at home (the common case
  on a fresh load) taps fire with no delay at all, same as before this
  feature existed.
- Two hit-testing methods, layered: ground-tile selection uses the exact
  `screenToGrid` math from §9 (tiles tile the plane exactly, so this is
  precise and cheap); animals, buildings, and ready-to-harvest crops —
  which render taller/wider than their own tile and are the things kids
  will actually be reaching for — instead use a distance check from the
  tap point to each object's screen-space center, picking the nearest one
  under a generous radius (larger than its drawn size). That gives those
  taps forgiving, fat-finger-friendly targets instead of a strict bounding
  box. Both methods key off the same canvas-to-grid transform, so they're
  recomputed together on resize/orientation change and never drift apart.

## 12. UI structure

- `index.html`: canvas + a thin DOM chrome — a left-hand rail (coins,
  market, full screen, settings), a right-hand tool belt rail, and a
  `#top-info` stack across the top of the stage: a day/season/weather bar
  above the mission tracker banner, and a modal layer (shop, processing,
  mission-complete/"what you learned", settings). The side-rail layout is
  the only layout — see below for why this is landscape-only rather than
  portrait-first. Day/season/weather live in their own full-width bar
  rather than a chip squeezed into the narrow (78px) HUD rail alongside
  the coin count — a chip that width can't fit "Day 12 · Summer · Rainy"
  without truncating it illegibly, which is exactly what a narrower rail
  used to do.
- Modals are simple centered DOM cards with icon-first content and at most
  1–2 short sentences of text, per the brief's "minimal text" requirement.
- **Landscape-only, not responsive portrait/landscape switching.** A
  side-rail HUD and tool belt need width, not height, to stay
  thumb-reachable and readable — cramming them into a portrait phone
  (either as a bottom bar or squeezed rails) fights the brief's "large,
  easy-to-use controls" goal rather than serving it. So instead of a
  portrait-primary layout with a landscape media query, the row-rail
  layout is the only layout, and a `#rotate-overlay` (same pattern as
  `games/last-little-farm`'s `shouldLockLandscape`/rotate prompt) blocks
  play with a "rotate your device" message whenever a touch device is
  held in portrait. Desktop/mouse windows are never locked — there's
  nothing to rotate there — and get a centered, landscape-aspect-ratio
  frame via CSS `aspect-ratio` instead of a portrait-shaped one.
- A full-screen toggle (`Fullscreen`/Screen Orientation APIs, best-effort
  and wrapped defensively since neither is universally supported — e.g.
  iOS Safari has no Fullscreen API for non-video elements) is offered both
  as an explicit HUD button and attempted automatically on a touch
  player's first tap. It's a nice-to-have layered on top of the rotate
  overlay, never a substitute for it: the overlay is what actually
  enforces landscape play on every device, fullscreen or not.
- Settings modal includes a **Privacy** entry alongside Reset Game. It
  renders the "Parent Info" short notice from `PRIVACY.md` directly inline
  (with an expandable "Full notice" toggle for the complete text) — never
  a link out to an external page, per the brief's "no external links from
  gameplay" rule. It's the one screen in the game aimed at a parent rather
  than the child player, so it's allowed plainer, longer text than the
  rest of the UI.
- Settings also shows a small, muted **Version** line (`CONFIG.appVersion`)
  below the Close button — there's no build tooling to stamp this
  automatically, so it's bumped by hand alongside any notable change, the
  same manual discipline `schemaVersion` (§7) already uses. Purely
  informational (confirming which deployment a player/tester is looking
  at), not tied to save compatibility.

## 13. Missions & "what you learned" loop

- `missions.js` subscribes to the event bus; each `data-missions.js` entry
  declares a trigger event + match/count condition. On completion: award
  reward via `economy.js`, mark mission done in state, and show a short
  modal with the `learned` sentence — this is how "education integrated
  into gameplay" (§ brief) is implemented concretely: the explainer only
  appears *after* the player has already done the thing, never before.
- `tutorial.js` is the same mechanism specialized for onboarding: a fixed
  ordered sequence of "first-run" missions (prepare a plot → plant → water
  → wait → harvest → sell) that gate which tool-belt buttons are visible so
  a first-time player can't get lost in menus before understanding the loop.
- Popups are deliberately throttled, not fired on every action: a modal
  only launches on a *first-time* event (first harvest of a given crop,
  first time a recipe completes) or a mission milestone — never on the
  Nth repeat of something the player already knows. Harvesting is the most
  repeated action in the whole game, so a modal on every single harvest
  would turn the core loop into a wall of interruptions, working directly
  against the brief's own "avoid complex menus/long text" and
  minimal-friction goals. To keep the facts available beyond that one
  popup, every crop/animal/recipe tile has a small "i" info tap (via the
  same object hit-testing as §10) that re-shows its `educational` string
  in a lightweight, non-modal tooltip any time a curious kid wants it.

## 14. MVP content checklist (mapped to the brief's MVP list)

| Brief requirement | Plan |
|---|---|
| One farm | Single 60×60 plot grid (spans many screens, panned/scrolled — §9). Every plot starts unlocked *for now* (see §10's note below) rather than expanding via `economy.js` unlock cost |
| 4–6 crops | 6 crops in `data-crops.js` (§5) |
| 2–3 animal types | Chicken, cow, sheep in `data-animals.js` |
| Planting/watering/growing/harvesting | `farm-rules.js` + `simulation.js` (§8) |
| Animal care | Feed/water/shelter needs, happiness-based yield (§8) |
| Inventory | `state.inventory` map, shown in shop/processing modals |
| ≥3 processing chains | 4 recipes shipped (§5) |
| Simple currency | `state.coins`, mutated only via `economy.js` |
| Farm expansion | Buy-more-plots / unlock-building actions exist in `farm-rules.js`/`input.js`/`modals.js`, but are switched off *for now* — every plot starts unlocked (see §10) |
| 5–10 educational missions | `data-missions.js` seeded with ~8 entries from the brief's examples |
| Basic tutorial | `tutorial.js` first-run sequence |
| Local save/load | `persistence.js`, autosave + reset |
| English + Portuguese UI | `i18n.js` + `locale-en.js`/`locale-pt.js` (§6) |
| Responsive smartphone UI | Landscape-only side rails + rotate overlay (§11) |

## 15. Testing

- `test-farm-rules.js` at the repo root of `games/farm/`, run with `node
  test-farm-rules.js` exactly like `last-little-farm`'s existing test file:
  covers growth-stage math, water/feed timing edge cases, yield/quality
  degradation on neglect (never negative/deletion), recipe input
  consumption, and mission trigger matching — all pure, DOM-free logic.
- `test-persistence.js` (`node test-persistence.js`): asserts the actual
  save/load round trip (§7) preserves coins and planted-crop occupants
  exactly, using an in-memory `localStorage` stub rather than a browser.
- Manual QA pass in a real mobile browser (touch target sizes, the rotate
  overlay actually blocking portrait, landscape play on phone and tablet)
  before calling a phase done, since layout/touch feel can't be unit
  tested.
- A small Node script (or an addition to `test-farm-rules.js`) asserts
  every key `locale-pt.js` defines also has an English fallback (in
  `locale-en.js` or a `data-*.js` entry) — catches typos in translation
  keys before they silently fall back to the wrong text.

## 16. Phased build order

1. **Skeleton** — `index.html`/`style.css` shell, canvas boots, empty grid
   renders, save/load round-trips an empty state, reset button works,
   Settings modal includes the Privacy panel from `PRIVACY.md` and an
   EN/PT language toggle wired through `i18n.js` from day one (so nothing
   built afterward has English strings hard-coded into it).
2. **Core loop, one crop** — wheat only: plant → water → grow → harvest →
   sell, with the tool belt and tile-tap input fully wired end-to-end.
3. **Full crop set + inventory UI** — remaining 5 crops, shop drawer,
   inventory display, season gating (a crop just can't be planted out of
   season, with a friendly explanation, not a punishment).
4. **Animals** — chicken/cow/sheep, feed/water care loop, produce
   collection.
5. **Processing chains** — mill/bakery/churn/kitchen buildings, recipe
   picker modal, the 4 MVP recipes.
6. **Missions + tutorial** — event bus wired through everything above,
   `data-missions.js` seeded, first-run tutorial sequence gating the UI.
7. **Seasons/weather + expansion** — day/season/weather cycle, farm
   expansion purchase, remaining educational polish text.
8. **Juice + responsive pass** — idle animations, positive-feedback toasts,
   landscape/desktop layout pass and rotate-overlay check, `test-farm-rules.js`
   filled out, full `locale-pt.js` translation pass reviewed by a
   Portuguese speaker, add the game card to root `index.html`.

## 17. Future extensibility (explicitly not MVP)

Because content is data-driven, later additions are additive, not rewrites:
more crops/animals (goat, pig, apple orchard as a longer-cycle "tree"
type), longer production chains (wool → yarn → clothing), a second farm
plot/biome, harder seasonal challenges, additional languages beyond
English/Portuguese (§6), and (optionally, later) swapping the emoji/shape
placeholder art for a commissioned isometric sprite sheet behind the same
`render.js` drawing calls. Also deferred from §10's terrain pass
specifically: lakes as a refillable water source powering an irrigation
mechanic (a new watering flow, not just a visual), and mountains/quarries
yielding a stone/mineral resource that feeds into building costs (a new
resource type and its own economy hooks) — both real enough in scope to be
their own follow-on features rather than an extension of the placement
rules §10 ships with.
