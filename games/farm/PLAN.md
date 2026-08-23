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
- Touch-first, mobile-portrait-first, also usable with mouse on desktop.
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
  swappable for commissioned art later (see §15). This matches the brief's
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
see §11 for why every completion doesn't launch a modal.

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

## 6. State & persistence

- `state.js` builds the canonical shape once (`createInitialState()`):
  `{ version, coins, day, season, weather, farmPlots[], buildings[],
  animals[], inventory{}, unlockedFeatures[], missions{}, tutorialStep,
  settings{}, lastTickTimestamp }`. Plots/animals are plain serializable
  objects (id, position, cropId/animalId, plantedAt, lastWateredAt,
  lastFedAt, growthStage, quality).
- `persistence.js` owns `localStorage` under a single namespaced key
  (`farm-school-save-v1`), JSON-serializes the whole state, and debounces
  autosave (~1s after any mutation) so gameplay never blocks on writes.
  Includes a `SCHEMA_VERSION` and a tiny migration hook so future field
  additions don't wipe existing saves.
- A **Reset Game** action lives in the settings modal (confirm dialog before
  clearing), satisfying the brief's "mechanism to reset local data for
  dev/testing" requirement.
- On load, persistence computes elapsed real time since
  `lastTickTimestamp` and hands it to `simulation.js` as one bounded
  catch-up step (capped, e.g., at 24 in-game hours of progress) so crops/
  animals keep progressing while the tab is closed, without an unbounded
  loop if the player returns after a week.

## 7. Simulation & time model

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

## 8. Rendering (pseudo-isometric grid)

- `render.js` owns a single `<canvas>` sized to the viewport. The farm is a
  simple 2D grid (e.g. 6×6 MVP plots) projected to diamond ("2:1
  pseudo-isometric") screen coordinates with a small, well-documented
  `gridToScreen(x, y)` / `screenToGrid(px, py)` pair of pure functions —
  the same math both draws tiles and interprets taps, so hit-testing can't
  drift from rendering.
- Draw order per frame: ground tiles → fences/paths → buildings → crops/
  animals (back-to-front by grid row for correct overlap) → transient
  effects (sparkle on harvest-ready, water droplet animation).
  Crops/animals/buildings are drawn as flat shapes + emoji glyph, scaled by
  `devicePixelRatio` for crisp mobile screens.
- Idle-but-alive feel: small per-frame bob/sway animation on
  ready-to-harvest crops and animals, done with a time-based sine offset —
  cheap and reads as "friendly and alive" without needing sprite sheets.

## 9. Input & controls

- Bottom tool belt (large DOM buttons, thumb-reachable in portrait): Seeds
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
  code path serves touch and mouse; no drag-required gestures in the MVP
  (tap-only), keeping controls simple for children.
- Two hit-testing methods, layered: ground-tile selection uses the exact
  `screenToGrid` math from §8 (tiles tile the plane exactly, so this is
  precise and cheap); animals, buildings, and ready-to-harvest crops —
  which render taller/wider than their own tile and are the things kids
  will actually be reaching for — instead use a distance check from the
  tap point to each object's screen-space center, picking the nearest one
  under a generous radius (larger than its drawn size). That gives those
  taps forgiving, fat-finger-friendly targets instead of a strict bounding
  box. Both methods key off the same canvas-to-grid transform, so they're
  recomputed together on resize/orientation change and never drift apart.

## 10. UI structure

- `index.html`: canvas + a thin DOM chrome — top bar (coins, day/season,
  weather icon, settings gear), bottom tool belt, a collapsible mission
  tracker chip, and modal layer (shop, processing, mission-complete/
  "what you learned", settings).
- Modals are simple centered DOM cards with icon-first content and at most
  1–2 short sentences of text, per the brief's "minimal text" requirement.
- Responsive via CSS: portrait is the primary layout (tool belt full-width
  along the bottom); a landscape media query moves the tool belt to a side
  rail so the play area stays large; desktop just gets a max-width centered
  frame with mouse cursor affordances.

## 11. Missions & "what you learned" loop

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
  same object hit-testing as §9) that re-shows its `educational` string
  in a lightweight, non-modal tooltip any time a curious kid wants it.

## 12. MVP content checklist (mapped to the brief's MVP list)

| Brief requirement | Plan |
|---|---|
| One farm | Single 6×6 (or similar) plot grid, expandable via `economy.js` unlock cost |
| 4–6 crops | 6 crops in `data-crops.js` (§5) |
| 2–3 animal types | Chicken, cow, sheep in `data-animals.js` |
| Planting/watering/growing/harvesting | `farm-rules.js` + `simulation.js` (§7) |
| Animal care | Feed/water/shelter needs, happiness-based yield (§7) |
| Inventory | `state.inventory` map, shown in shop/processing modals |
| ≥3 processing chains | 4 recipes shipped (§5) |
| Simple currency | `state.coins`, mutated only via `economy.js` |
| Farm expansion | Buy-more-plots / unlock-building actions in `economy.js` |
| 5–10 educational missions | `data-missions.js` seeded with ~8 entries from the brief's examples |
| Basic tutorial | `tutorial.js` first-run sequence |
| Local save/load | `persistence.js`, autosave + reset |
| Responsive smartphone UI | CSS breakpoints, portrait-first (§10) |

## 13. Testing

- `test-farm-rules.js` at the repo root of `games/farm/`, run with `node
  test-farm-rules.js` exactly like `last-little-farm`'s existing test file:
  covers growth-stage math, water/feed timing edge cases, yield/quality
  degradation on neglect (never negative/deletion), recipe input
  consumption, and mission trigger matching — all pure, DOM-free logic.
- Manual QA pass in a real mobile browser (touch target sizes, portrait +
  landscape) before calling a phase done, since layout/touch feel can't be
  unit tested.

## 14. Phased build order

1. **Skeleton** — `index.html`/`style.css` shell, canvas boots, empty grid
   renders, save/load round-trips an empty state, reset button works.
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
   portrait/landscape/desktop layout pass, `test-farm-rules.js` filled out,
   add the game card to root `index.html`.

## 15. Future extensibility (explicitly not MVP)

Because content is data-driven, later additions are additive, not rewrites:
more crops/animals (goat, pig, apple orchard as a longer-cycle "tree"
type), longer production chains (wool → yarn → clothing), a second farm
plot/biome, harder seasonal challenges, and (optionally, later) swapping
the emoji/shape placeholder art for a commissioned isometric sprite sheet
behind the same `render.js` drawing calls.
