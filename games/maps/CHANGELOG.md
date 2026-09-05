# Changelog

User-facing changes to the map editor, newest first. See `TODO.md` for
what's deliberately deferred, and `CLAUDE.md` for the rule that keeps this
file updated.

## 2026-09-05

- **File attachments.** Any point, line, or area can now have files
  attached to it — photos, PDFs, documents, anything. Images show a
  thumbnail preview; other file types show a name and size. Attached files
  aren't included in Export/Import yet — they stay on the device that
  added them.

## 2026-09-04

- **Fix:** on mobile, the search bar could overlap the map's zoom/locate/
  fit-all buttons in the top-right corner. It now leaves proper clearance.

## 2026-08-29

- **My Maps.** You're no longer limited to one shared map — create,
  rename, switch between, and delete multiple independent maps, each with
  its own places, routes, and areas.
- **Installable app.** The map editor can be added to your phone's home
  screen like a native app, and the last-loaded view keeps working
  offline.
- **Fix:** on touchscreens, tapping a vertex to delete it while editing a
  shape's outline could delete two points instead of one.
- Made the mobile search bar smaller and more compact, closer to a
  familiar map-app search field.

## 2026-08-28

- **Measurement tool.** Draw a line or area on the map to see its distance
  or size without saving it as a real object.
- **Unified search.** The search bar now finds both your own saved places
  and real-world locations (via OpenStreetMap) in one list.
- Selecting an object now stands out clearly on the map (a soft glow
  around points/lines, a tinted fill for areas) instead of a subtle
  outline.
- Every category (house, farm, water, trail, forest, etc.) now has its own
  icon, shown both in the category picker and as the map marker.
- The map is now the main event: a full-bleed layout with on-map controls
  for locating yourself and fitting the view to everything on the map.

## 2026-08-27

- Selecting an object from the sidebar list now flies the map to it.
- The map now opens flat/top-down by default instead of tilted in 3D.
- The map remembers where you last left it (defaulting to Portugal on
  first use).
- Added an About screen showing the current build version.

## 2026-08-26

- Added a 2D/3D view toggle and a separate Layers panel for toggling what
  shows on the map.
- Editing a line or area's shape now supports adding and removing
  individual points, and works properly with touch dragging.
- The feature popup now shows coordinates, length, or area for the
  selected object.
- Reworked the layout to be mobile-first: bottom navigation, a slide-up
  sidebar, and a prominent Add button.
- **Fix:** the Street and Dark map styles stopped working when the tile
  provider started requiring an API key; switched providers.

## 2026-08-25

- Initial release: a local-first map editor for your own places, routes,
  and areas, built on a 3D terrain map. Draw points, lines, and areas;
  give them a name, category, and description; everything saves to your
  browser automatically.
