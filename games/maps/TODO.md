# Map editor — what's next

Status snapshot of `games/maps`, for picking this back up later. The app
(object editor, map styles, layers, mobile layout, multiple maps, PWA
install, file attachments) is functional and deployed. This file tracks
what's deliberately left undone and why, plus known rough edges. See
`CHANGELOG.md` for what's already shipped, and `CLAUDE.md` for the rule
that keeps both of these current.

## Deferred features (need assets/APIs this pass didn't have)

- **Visual style thumbnails in the View menu.** Street/Satellite/Terrain/Dark
  are currently text+emoji rows. A real thumbnail per style (small static
  preview image) would match the "visual selector" design discussed, but
  needs actual preview images generated/sourced per style — text rows work
  fine functionally in the meantime.
- **Undo/redo.** Not started. Biggest remaining trust-builder for an editor
  where drawing/deleting shapes is otherwise final.
- **Presentation / share mode.** A clean read-only view of a map (no edit
  chrome) for showing it to someone else. Not started.
- **Attachments in Export/Import.** Files added via the "Files" section on
  an object (see Changelog 2026-09-05) are stored in IndexedDB and are
  deliberately NOT included when exporting/importing a map's data —
  embedding them as base64 would bloat the exported JSON. Revisit only if
  actually needed; until then, attachments don't survive export/import or
  moving to a different browser/device.
- **Base-map layer toggles** (Roads / Buildings / Land use, from the original
  Layers mockup). Not implemented on purpose, not just deferred: the base
  styles (`js/map/map-styles.js`) are single flattened raster images — there
  are no separate road/building/land-use layers to hide independently. This
  only becomes real if the base map switches to a **vector** style (e.g. a
  full MapLibre style like OpenFreeMap's) where roads/buildings/etc. are
  actual distinct layers. That would be a bigger change (see below).

## Known rough edges

- **"Dark" style isn't a real dark style.** It's OpenStreetMap's standard
  raster tiles dimmed via `raster-brightness-max` / `raster-saturation` /
  `raster-contrast` paint properties (`js/map/map-styles.js`). MapLibre has
  no color-invert paint property, so it reads as a muted daytime map, not a
  proper dark-mode redraw (dark background, light roads). A real fix needs a
  genuinely dark **vector** tile source — same underlying limitation as the
  base-map-layers item above.
- **Globe + Terrain can throw a benign console error** ("x=0, y=-1, z=0
  outside of bounds…") from MapLibre's own terrain/tile-neighbor lookup near
  a pole at low zoom. Confirmed non-fatal — the map keeps working — and is
  suppressed from the user-facing error banner once the app has finished
  initializing (see the `__mapEditorInitialized` gate in `search.html`).
  Rendering artifact from combining globe projection with terrain in this
  MapLibre version; not something we can fix from the app side.
- **OpenStreetMap tile usage.** `tile.openstreetmap.org` (used for the Street
  style, and as the base for Dark) is free but has a
  [usage policy](https://operations.osmfoundation.org/policies/tiles/) aimed
  at low/moderate traffic. Fine for a hobby/personal site; if this ever gets
  meaningful traffic, it should move to a paid tile provider or a self-hosted
  tile server instead of leaning on OSM's free tiles indefinitely.
- **No automated test suite in the repo.** Every feature and bug fix shipped
  so far (well over a dozen now) was regression-tested with throwaway
  Playwright scripts — both a hand-rolled MapLibre stub and the real
  vendored library — run from a scratch directory outside the repo; none of
  it is committed. This has caught real regressions repeatedly, so the
  practice works, but it's re-created from scratch every session. Worth
  landing a real committed `tests/` setup at this point — the stub
  (a minimal fake `maplibregl.Map`/`Popup` covering `addSource`/`addLayer`/
  `setStyle`/`setLayoutProperty`/event dispatch) is a reasonable starting
  point.

## Architecture notes for later

- **Data model is intentionally simple** (see `js/objects/object-model.js`):
  a GeoJSON Feature with `id`, `geometry`, `properties` (name/category/
  description/attachments), and `metadata` (createdAt/updatedAt). No
  elevation, no GPS accuracy, no address/reverse-geocoding. Fine for the
  current scope; would need explicit schema additions (and a migration path
  for existing `localStorage` data) if any of that becomes wanted.
- **Persistence is browser-local, no backend.** Object/settings data lives
  in `localStorage` (`js/persistence/`), namespaced per map via the "My
  Maps" registry (`maps-index.js`). File attachments live separately in
  IndexedDB (`persistence/attachments.js`), since localStorage is
  string-only and far too small for binary files. All of it is
  single-browser/single-device only — multi-device sync or sharing between
  users would need a real backend. The domain layer (`object-store.js`'s
  load/save/subscribe shape) was deliberately kept separate from the
  MapLibre rendering code specifically so that swap is contained to the
  `persistence/` module rather than touching the map/UI code.
- **MapLibre GL JS is vendored** at v5.8.0 in `vendor/maplibre-gl/` (see the
  README there) rather than loaded from a CDN, after `unpkg.com/@latest`
  broke silently when v6 dropped the classic UMD bundle. Re-vendoring to a
  newer version needs re-checking that a UMD build still exists for it (v6+
  is ES-module-only) or reworking `search.html`'s plain `<script>` tag into a
  module import if the UMD bundle option goes away entirely upstream.
- **Cache-busting**: every local CSS/JS reference carries a shared
  `?v=<date>.<n>` query string (see `search.html` and the `import` lines
  across `js/`). Bump this string on every deploy that touches JS/CSS —
  it's what stops browsers/CDN from serving a stale file mixed with fresh
  ones. The About screen (Menu → About) shows the current value; keep the
  two in sync.

## Suggested next pick-up order

1. Undo/redo (self-contained, biggest remaining trust-builder).
2. Visual style thumbnails (self-contained, no architecture changes).
3. Presentation/share mode.
4. Decide if/when to move the base map to a vector style — this is the one
   that unlocks both the real base-map layer toggles and a proper Dark
   style, so it's worth doing those two together rather than separately.
5. Land a committed test setup — worth doing soon given how much surface
   area the app now has.
