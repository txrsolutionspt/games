# Vendored MapLibre GL JS

`maplibre-gl.js` and `maplibre-gl.css` here are the unmodified v5.8.0 UMD
build from the `maplibre-gl` npm package (BSD-3-Clause, see `LICENSE.txt`).

They're vendored instead of loaded from a CDN (previously `unpkg.com`) for
two reasons found while debugging a blank map page:

1. `unpkg.com/maplibre-gl@latest` floats to whatever the newest release is.
   As of v6.0.0, MapLibre GL JS dropped the classic global `dist/maplibre-gl.js`
   UMD bundle in favor of ES-module-only output (`maplibre-gl.mjs`), so a
   `<script src="…/dist/maplibre-gl.js">` tag pinned to `@latest` silently
   stopped defining `window.maplibregl` once v6 shipped.
2. Even pinned to a version with the right file, a third-party CDN is one
   more thing that can be slow, blocked by a content/DNS filter, or down —
   for something this central to the page, self-hosting removes that
   dependency entirely.

v5.8.0 is the newest release that still ships the UMD bundle and supports
everything this page uses (globe projection, `TerrainControl`).

To update: `npm pack maplibre-gl@<version>`, extract `dist/maplibre-gl.js`,
`dist/maplibre-gl.css`, and `dist/LICENSE.txt` from the tarball, and replace
the files in this directory.
