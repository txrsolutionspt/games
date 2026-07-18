# Apex Racer (Race Car Game) — Status Report

**Date:** 2026-07-18
**Version:** 1.12.0 (see `version.js`)
**Status:** ✅ Playable — v1 per `design.md`, plus v1.1 (ghost replay,
second track + track selection, minimap), v1.2 (sector timing, medals,
post-race stats), v1.3 (Race mode with AI opponents), v1.4 (AI
difficulty + field size), v1.5 (cinematic replay viewer), v1.6
(driving settings: assists + handling/steering presets), v1.7
(gamepad support, smooth pedal response, counter-steer assist), v1.8
(Speedbowl oval + The Dragway sprint, point-to-point support) and
v1.9 (visible checkpoint gates with next-gate highlighting; v1.9.1
made capture forgiving and miss warnings immediate; v1.9.2 fixed
wrong-leg position tracking near self-approaching track sections) and
v1.10 (per-checkpoint split-time confirmation in the HUD; v1.10.1
fixed the false "checkpoint missed" warning at every lap crossing)
and v1.11 (fullscreen on race start + F toggle + landscape lock) and
v1.12 (tilt controls: device orientation steering with visual steering wheel)

---

## What It Is

A 3D solo time-trial racing game (Babylon.js + WebGL): one procedurally built
circuit, 3 laps, checkpoint-validated lap timing, semi-simulation car handling,
localStorage best times, desktop keyboard + mobile touch controls, PWA
installable.

## Implementation Decisions (vs `design.md`)

| Spec item | Decision |
|-----------|----------|
| Engine (PlayCanvas vs Babylon.js) | **Babylon.js 9.16.1**, vendored UMD build in `lib/` (no CDN dependency, no build step — see `lib/VERSION.md`) |
| Rendering | WebGL (Babylon default engine). WebGPU progressive enhancement deferred to a future version — it needs extra WASM tooling that conflicts with the no-build-step goal |
| Vehicle physics | Custom semi-sim bicycle model in `car.js` (slip-angle Pacejka-lite tires, load transfer, friction circle, speed-sensitive steering, RWD) instead of wiring the unmaintained Cannon.js — deterministic and unit-testable in Node |
| `.glb`/`.gltf` + KTX2 assets | **Zero external assets** — car/track/scenery are procedural low-poly meshes, textures are generated `DynamicTexture`s, audio is synthesized Web Audio. Initial payload ≈ 7.9 MB (almost entirely the engine), well under the 20 MB budget |
| Mobile steering (slider vs tilt) | **Toggle-able:** On-screen steering slider (bottom-left, default) OR device tilt via DeviceOrientationEvent (visual steering wheel, center). iOS 13+ requires user permission. Menu has CONTROLS button to switch modes. Tilt uses 45° max angle with 8° deadzone. |
| Quality tiers | LOW/MED/HIGH toggle: render resolution scaling, tree density, dynamic shadows (HIGH only). Defaults MED on touch devices, HIGH on desktop |

## File Map

| File | Role |
|------|------|
| `track.js` | Pure geometry + track registry (`apex`, `coastal`, `speedbowl`, `dragway`): Catmull-Rom centerlines (closed loops AND open point-to-point), arc-length resampling, curvature, procedural or overridden barrier placement, checkpoint gates, nearest-point queries |
| `ghost.js` | Pure ghost record/playback: fixed-interval pose sampling, quantized serialization, interpolated replay |
| `replaycam.js` | Pure cinematic camera director: corner-apex trackside stations, chase/drone shots, deterministic cutting |
| `car.js` | Pure physics: semi-sim vehicle model, driving-feel tuning (handling/steering presets, traction control, stability assist), track-relative barrier collision |
| `race.js` | Pure race logic: ordered checkpoint validation, lap/total/sector timing, splits & deltas, medal helper, wrong-way and course-cut detection |
| `autopilot.js` | Pursuit driver with tunable skill (corner g, top speed, braking, line offset); used by AI opponents, tests and `?auto=1` |
| `opponents.js` | Race-mode AI pack: 5-driver skill roster, difficulty scaling, grid placement, per-AI physics/race managers, arcade car-to-car collisions, live standings |
| `input.js` | Unified VehicleControl layer: keyboard + multi-touch UI + gamepad (analog stick/triggers), progressive pedal ramping |
| `audio.js` | Procedural Web Audio: engine pitch, tire screech, beeps, jingles |
| `hud.js` | DOM overlay: timers, deltas, toasts, screens |
| `scene.js` | Babylon scene: road ribbon, kerbs/barriers (thin instances), trees, gantry, car meshes, camera, quality tiers |
| `game.js` | State machine (MENU/COUNTDOWN/RACING/PAUSED/FINISHED) + loop |
| `test-game.js` | Node unit/simulation test suite — run `node test-game.js` |
| `test-e2e.js` | Playwright e2e suite (headless Chromium) — `node test-e2e.js [--full]` |
| `version.js` | Version info (page + service worker + tests); bump via `./update-version.sh X.Y.Z` |
| `lib/babylon.min.js` | Vendored engine (pinned, see `lib/VERSION.md`) |
| `manifest.json`, `sw.js`, `icon-*.png` | PWA (landscape, offline-capable) |

## Verification

- **Node suite (`node test-game.js`): 59/59 pass** — track geometry
  invariants (closed loop, no self-intersection, query accuracy), physics
  behavior (top speed, braking, steering signs, stable limit handling, drift,
  grass grip, reverse, wall collision), race logic (gate order, lap validation,
  course-cut + wrong-way detection, split deltas), and an end-to-end simulated
  3-lap race driven by the autopilot (finishes, 0 wall hits, never off track).
- **Playwright e2e in headless Chromium: 24/24 pass** — boot with zero console
  errors, menu → countdown → racing flow, keyboard driving, HUD timing/speed,
  first checkpoint registration, reset-to-checkpoint (clock keeps running),
  pause/resume (clock freezes), a full rendered autopilot lap through to the
  finish screen with persisted best time, mobile touch controls (pedal
  acceleration verified), and the portrait rotate overlay.

## CI

`.github/workflows/race-car-tests.yml` runs on every PR/push touching
`games/race-car/`:

1. **unit** — `node test-game.js` (no dependencies)
2. **e2e** — installs Playwright + Chromium, runs `node test-e2e.js`
   (quick mode; `--full` adds a complete rendered autopilot lap and can be
   run locally), uploads screenshots as workflow artifacts
3. **version-bump** (PRs only) — fails if release-facing files change
   without a `version.js` bump, mirroring the tower-defense convention

## Versioning

`version.js` is the single source of truth: the menu screen displays it, the
service worker derives its cache name from it (so each release invalidates
the previous offline cache), and the e2e suite asserts the displayed version
matches. To release: `./update-version.sh X.Y.Z`, add a changelog entry at
the top of the changelog in `version.js`, commit.

## Debug URL Parameters

- `?laps=N` — shorten/lengthen the race (1–9, default 3)
- `?auto=1` — autopilot demo drive
- `?track=<id>` — start on a specific track (`apex`, `coastal`, `speedbowl`, `dragway`)
- `?mode=race` — start in Race mode (vs AI opponents)
- `?difficulty=easy|medium|hard` — AI skill tier (Race mode)
- `?rivals=3|5` — AI field size (Race mode)

## Known Limitations / Future Work

- WebGPU path, online leaderboards — still future work.
  (Ghost replay and multiple tracks shipped in v1.1.0; AI opponents in
  v1.3.0; tilt steering in v1.12.0.)
- Car-to-car collision uses an equal-mass circle model — simple and
  stable, but contact along a car's length is approximate.
- Race clock and physics share one frame-time cap (100 ms), so timing stays
  fair on slow devices down to 10 FPS; below that, sim time dilates rather
  than making the car skip through walls/checkpoints.
- Tilt steering requires DeviceOrientationEvent support; older devices may
  not have accelerometer access (Android 2.x, some non-smartphone browsers).
