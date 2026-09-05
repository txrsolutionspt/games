# games/maps tests

A committed regression suite, replacing the throwaway Playwright scripts
that were hand-written from scratch every session up to this point (see
`TODO.md`'s "no automated test suite" note for that history).

## Running

```sh
# from the repo root
npm install playwright@1.62.1
npx playwright install chromium   # first time only, or after changing the pinned version

node games/maps/tests/run-all.sh
```

Or run a single file directly, e.g. `node games/maps/tests/e2e-vertex-editing.js`.

## Layout

- **`unit-*.mjs`** — pure logic, no browser: geometry math
  (`geo/measure.js`), the object data model (`objects/object-model.js`),
  and the "My Maps" registry (`persistence/maps-index.js`, using a small
  in-memory `localStorage` shim). Fast; run these first when iterating.
- **`e2e-*.js`** — drives the real app in headless Chromium via Playwright
  against the real vendored MapLibre library (no mock/stub map). Each file
  covers one area:
  - `e2e-app-shell.js` — boot, About screen, default view + last-view
    persistence, the full-bleed layout and its on-map controls, the
    mobile search pill's clearance from those controls, the sidebar
    drawer, the Layers panel, fly-to-on-select.
  - `e2e-core-objects.js` — drawing a point/line/area through the real
    UI, the category icon-grid, the popup's coordinate/length/area
    readout, editing properties, deleting.
  - `e2e-vertex-editing.js` — inserting a vertex via a midpoint drag,
    mouse tap-to-delete, and (the important one) a **real touch** tap
    correctly deleting exactly one vertex — a regression test for a bug
    where touch devices replayed a tap as a synthetic mouse click and the
    app deleted two vertices for one tap.
  - `e2e-selection-and-search.js` — selecting an object, the ephemeral
    measure tool, unified search (your objects + mocked geocoding).
  - `e2e-multi-map.js` — "My Maps": create/rename/delete, and that
    objects never leak between maps when switching.
  - `e2e-attachments.js` — file attachments: image previews vs. the
    generic icon for other types, persistence, and that cancelling a
    brand-new object rolls back any files it was given.
  - `e2e-pwa.js` — manifest/icons, service worker registration, and that
    the app shell still renders when the network goes down.
- **`helpers.js`** — shared plumbing: a static file server (serves the
  whole repo root, matching how GitHub Pages serves it), a `check()`/
  `report()` pass-fail counter, Chromium launch options (software
  rendering flags for headless WebGL), and `freshContext()` for testing
  fresh-install behavior — see the comment on it before copying the
  `localStorage.clear()`-after-`goto()` pattern into a new test; that
  pattern races the app's own async seed-data fetch.

## Adding a test

New coverage for an existing area goes in that area's file. A genuinely
new area gets its own `e2e-<area>.js` file, added to both `run-all.sh`'s
list and the CI workflow's `matrix.file` list (or its own job, matching
the others), plus a line in the list above.

## Known gotchas (read before adding drawing-flow tests)

- **The drawing-hint banner** sits centered at the top of the map and
  widens once it shows a point count + Finish/Cancel buttons. A vertex
  placed near the horizontal center within roughly the first 150px of map
  height can land on the banner instead of the canvas. Keep line/polygon
  test vertices below `mapBox.y + 200` (or well off-center) to avoid it.
- **Finishing a line/polygon**: click each vertex individually (including
  the last one), then a *separate* `dblclick` at that same last point
  purely to finish. Combining "add the final vertex" and "finish" into
  one `dblclick` at a brand-new location is unreliable — the browser's
  own double-click timing can swallow the point.
- **Fresh-install seeding** is an async fetch (`data/default-objects.json`).
  Use `freshContext()` from `helpers.js` rather than
  `goto()` → `evaluate(() => localStorage.clear())` → `reload()`, and
  poll for the result (`page.waitForFunction(...)`) rather than a fixed
  `waitForTimeout`.
