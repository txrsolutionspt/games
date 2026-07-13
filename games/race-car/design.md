# Technical Specification: Race Car Game

## Overview
This technical specification outlines the core requirements for developing a cross-platform, browser-based race car game optimized for mobile-first deployment while maintaining full desktop compatibility.

---

## 1. Technical Architecture & Engine Selection
To ensure high performance across diverse hardware (from low-end smartphones to powerful desktops), prioritize modern web standards.

- **Primary Framework:** Use **PlayCanvas** or **Babylon.js**. Both offer professional-grade 3D performance, built-in physics engines, and excellent support for cross-platform input handling and asset optimization.
- **Rendering Pipeline:** Utilize **WebGL 2.0** for broad compatibility, with graceful degradation or progressive enhancement for **WebGPU** to leverage hardware acceleration on modern browsers.
- **Asset Management:**
  - **Initial Load:** Keep under **20MB** for rapid startup.
  - **Technique:** Use lazy loading/streaming for high-resolution textures and complex 3D models to keep the initial "Time to Gameplay" under 10 seconds.
  - **Format:** Use .glb or .gltf for 3D assets and WebP/KTX2 for compressed textures.

### No-Build-Step Constraint
This repo has no build pipeline — files are pushed as-is and GitHub Pages serves them directly. That rules out npm/webpack/vite/bundler-based workflows for this game. Concretely:

- **Babylon.js:** Include the pre-built UMD bundle via a `<script>` tag, either from a CDN (`https://cdn.babylonjs.com/babylon.js`, plus `babylonjs.loaders.min.js` for `.glb`/`.gltf` support) or a vendored copy committed under `games/race-car/lib/`. No npm package, no `import` statements requiring a bundler.
- **PlayCanvas:** Same approach — the engine's UMD build (`playcanvas.min.js`) works from a CDN or vendored `lib/` copy via `<script>` tag. Do **not** use the PlayCanvas Editor/cloud project workflow, since its typical export/publish flow assumes a build or hosting step outside this repo; if the Editor is used at all, only its "Download" static export (plain HTML/JS/assets, no build required) should be committed.
- **Whichever engine is chosen**, all game code is written as plain `<script>`-included JS (like the other games' `game.js`), referencing the global the library exposes (`BABYLON` or `pc`) — no ES module bundling, no transpilation step.
- **Choice of engine can be finalized during prototyping** (Roadmap step 1) — both satisfy the no-build-step constraint equally, so either is acceptable per this spec.

---

## 2. Cross-Platform Input Strategy
A unified input layer is critical for a seamless transition between touch and peripheral devices.

| Device Type | Primary Input Method | Implementation Logic |
| :--- | :--- | :--- |
| **Mobile/Tablet** | Touchscreen | On-screen D-pad/Joystick (left) + Action buttons (right) |
| **Desktop** | Keyboard/Mouse | WASD or Arrow keys; mouse for menu navigation |
| **Both** | Logic Layer | Map all inputs to a generic "VehicleControl" object (Steer, Throttle, Brake) |

- **Design Note:** Use semi-transparent, adaptive UI buttons on mobile. Implement "invisible interaction zones" (e.g., tap right half for throttle) to maximize screen visibility.

---

## 3. Performance & Optimization Metrics
Browser games are limited by browser memory and thermal throttling.

- **Frame Rate:** Target a stable **60 FPS**. Implement a "Quality Settings" toggle (Low/Medium/High) that adjusts shadow quality, texture resolution, and draw distances automatically based on device detection.
- **Draw Call Reduction:** Use texture atlases and object pooling for common elements (e.g., track segments, trees, particle effects).
- **Physics:** Use a lightweight physics engine (e.g., Cannon.js or the built-in engine of your chosen framework) to minimize CPU load on mobile devices.
- **Memory:** Regularly clear unused textures and cache during scene transitions to prevent browser memory overflows on iOS.

---

## 4. User Experience (UX) Considerations
- **Orientation:** Force **Landscape mode** for gameplay. Display a subtle "Rotate your device" overlay if the user is in portrait mode.
- **Loading:** Use a visual progress bar or an interactive loading screen to minimize user drop-off.
- **Audio:** Implement an audio manager that detects user interaction (browsers block audio until the first interaction) to play music and SFX.
- **PWA Readiness:** Configure the project as a **Progressive Web App (PWA)**. This allows users to "install" the game to their home screen, enabling offline access and a native-like experience.

---

## 5. Development Roadmap Summary
1. **Prototyping:** Build a single-track, single-car "race" loop using a placeholder model to test physics.
2. **Input Mapping:** Create a control abstraction layer that translates keyboard/touch to vehicle movement.
3. **Asset Pipeline:** Implement texture compression and model decimation to hit the <20MB limit.
4. **UI/UX:** Design a responsive HUD that scales based on screen resolution (Canvas resize events).
5. **Profiling:** Use Chrome DevTools (Memory/Performance tabs) to identify and fix bottlenecks on low-end Android devices.

---

## 6. Game Format
v1 is a **solo time trial** — no AI opponents, no other cars on track. The player races alone against the clock on a single track, trying to beat their own best time. This keeps physics tuning, AI, and multi-agent collision entirely out of scope for the first version.

- **Track:** One track, raced as a **3-lap race** (single closed loop, not point-to-point).
- **Objective:** Complete 3 laps as fast as possible; the run's total time is the result.
- **No opponents, no combat, no items** — the challenge is purely driving skill against the clock.

---

## 7. Vehicle Physics & Handling
Handling is **semi-simulation**, not full arcade: the car should feel like it has weight, suspension, and tires that can slip, without going as deep as a full sim (no manual gears, no tire temperature/wear, no aero).

- **Physics body:** Rigid chassis with 4 wheels, using the engine's built-in vehicle/raycast-wheel physics (e.g. Babylon.js + Cannon.js `RaycastVehicle`, or the equivalent in PlayCanvas's physics integration). Raycasts from each wheel hub detect the ground for suspension.
- **Suspension:** Each wheel has spring + damper values producing visible body roll under cornering and pitch under acceleration/braking (nose dips under braking, squats under acceleration).
- **Drivetrain:** Single continuous power curve (no manual gear shifting) — throttle input maps to engine force via an RPM-like curve that tapers near top speed. Automatic only for v1.
- **Steering:** Speed-sensitive steering angle (sharper at low speed, reduced at high speed to avoid snap-oversteer).
- **Tire grip / slip:** Each tire has a slip-angle-based grip curve; exceeding the grip threshold at speed produces a drift (rear or all-wheel slide) rather than an instant stop — this is where "semi-sim" shows up most.
- **Braking:** Single brake input slows all wheels; braking hard enough beyond a threshold can lock/slip the rear tires into a slide, consistent with the grip model above.
- **Off-track behavior:** Leaving the drivable track surface (onto grass/gravel shoulder) applies a grip and top-speed penalty rather than an instant wall-stop, so mistakes cost time without feeling unfair. Hard track-edge barriers (walls/tire stacks) exist at points where going off-track would otherwise let the player cut the course.
- **Reset:** If the car flips or gets stuck (e.g. against a wall), a manual "Reset to last checkpoint" input (key/button) respawns it on-track facing the correct direction, preserving elapsed time (it's a time cost, not a free do-over).

---

## 8. Track Structure & Lap Validation
- **Checkpoints:** An ordered sequence of invisible trigger volumes spans the track (in addition to the start/finish line). The player must pass through them in order for a lap to count.
- **Anti-shortcut:** Missing a checkpoint (e.g. cutting through scenery or driving backward through part of the course) invalidates the current lap — the lap timer keeps running, but the lap isn't registered as complete until all checkpoints have been hit in order since the last valid lap/start.
- **Wrong-way detection:** If the car crosses a checkpoint out of order or faces significantly against track direction for a sustained period, show a brief "WRONG WAY" HUD warning.
- **Start/Finish line:** Doubles as the checkpoint that both starts lap 1 and closes out lap 3 (race finish).

---

## 9. Win/Loss & Scoring
There's no opponent to beat and no fail state — the "score" is time.

| Event | Result |
|-------|--------|
| Cross finish line on lap 3 (all checkpoints validated) | Race complete — total time recorded |
| Complete any lap | Lap split time shown briefly in HUD |
| Miss a checkpoint / wrong way | Lap invalidated until checkpoints are hit correctly; warning shown |
| Car flips/stuck | Player-triggered reset to last checkpoint (time keeps running) |

- **Timing:** Total race time (sum of 3 laps) is the primary result, plus per-lap splits.
- **Best time:** Personal best total time (and best individual lap) persisted in `localStorage`, keyed by track ID.
- **Delta display:** During the race, show a live +/- delta of current lap time vs. the best-known split for that lap (green = ahead, red = behind) — a standard time-trial HUD convention.
- **New record:** On finishing, if the total time beats the stored best, show a "NEW BEST TIME" callout.

---

## 10. Controls (Refinement of Section 2)
Builds on the generic `VehicleControl { steer, throttle, brake }` abstraction from Section 2.

### Desktop
| Input | Action |
|-------|--------|
| W / Arrow Up | Throttle |
| S / Arrow Down | Brake / Reverse (when stopped or moving backward) |
| A/D or Arrow Left/Right | Steer left/right |
| R | Reset to last checkpoint |
| Space | Start race (from countdown-ready screen) |

### Mobile
| Input | Action |
|-------|--------|
| Right-side invisible zone (tap/hold) | Throttle |
| Left-side invisible zone (tap/hold) | Brake / Reverse |
| On-screen steering wheel or tilt (device orientation), left-hand side | Steer left/right |
| Small reset button (HUD corner) | Reset to last checkpoint |

- Steering implementation choice (on-screen wheel/joystick vs. device tilt) can be decided during input-mapping (Roadmap step 2); both must map to the same `steer` value in `VehicleControl`.

---

## 11. Screens & UI Flow
```
[Start Screen]
    |
    v (tap/Space)
[Countdown: 3 - 2 - 1 - GO]
    |
    v
[Racing — HUD: lap x/3, current lap time, total time, delta vs best, speed]
    |
    ├─ Lap complete (x3) → [Finish Screen]
    └─ Crash/off-track → recoverable in place (grip penalty) or manual reset (R / button)

[Finish Screen]
    |
    v (tap/Space)
[Start Screen] (or immediate restart)
```

- **Start Screen:** Game title, best time (if any) for the track, "Tap/Press Space to Race" prompt, orientation/rotate-device overlay if in portrait (per Section 4).
- **HUD (racing):** Current lap / total laps (e.g. "LAP 2/3"), current lap time, total elapsed time, best-time delta, speedometer. Rendered as DOM overlay or engine 2D/GUI layer on top of the 3D canvas — not part of the 3D scene itself.
- **Finish Screen:** Total time, best lap, best time comparison, "NEW BEST TIME" callout if applicable, restart prompt.

---

## 12. Visual Style
- **Art direction:** Low-poly, stylized (not photorealistic) — keeps the asset budget under 20MB, is cheaper to render on low-end mobile GPUs, and is realistic to produce/source as a single track + car model.
- **Lighting:** One directional "sun" light + ambient/hemisphere fill. Avoid dynamic real-time shadows on Low quality tier (Section 3); bake shadows into track textures where possible, enable a simple dynamic shadow only on the High quality tier.
- **Skybox:** Simple gradient or low-res panoramic skybox — not a major asset budget item.
- **Camera:** Chase camera positioned behind and slightly above the car, with damped/smoothed follow (no rigid parenting) so it lags naturally through direction changes.
- **Palette:** Bright, high-contrast track surface vs. off-track shoulder (helps players read the racing line at a glance, especially on small mobile screens).

---

## 13. Audio
- **Engine sound:** Pitch/playback-rate of a single looping engine sample scales with speed or simulated RPM — avoids needing multiple engine sample layers.
- **Tire screech:** Triggered when a wheel's slip angle exceeds the grip threshold (Section 7); stops when grip is regained.
- **Countdown beeps:** Short tone per countdown number, distinct final tone on "GO."
- **Lap/finish chime:** Short sound on valid lap completion; distinct celebratory sound + "NEW BEST TIME" stinger on a record run.
- **Background music:** Optional looping track; low priority same as other games in this repo.
- Respect the audio-unlock-on-first-interaction requirement from Section 4.

---

## 14. Assets Required
- **1 car model** (`.glb`), low-poly, single material/texture atlas where possible.
- **1 track model** (`.glb`) including: drivable road mesh, off-track shoulder mesh, barrier/wall geometry at cut-prevention points, separate (invisible, non-rendered) collision mesh if simplified collision is cheaper than the visual mesh.
- **Checkpoint trigger volumes** — simple invisible box/plane colliders, not modeled assets, placed along the track in the engine/scene file.
- **Skybox texture(s)** — single equirectangular image or a small cubemap set, compressed (WebP/KTX2 per Section 1).
- **UI assets** — icons for reset button, steering wheel graphic if used (SVG/PNG, small file size).
- **Audio** — 1 engine loop, 1 tire-screech loop, countdown beeps, lap/finish chimes, optional music loop (all compressed, e.g. Ogg/MP3).

---

## 15. Out of Scope (v1)
- AI opponents or any other cars on track (multiplayer, ghosts, bots).
- Multiple tracks or a track-select screen.
- Manual transmission / gear shifting.
- Damage model, tire wear, fuel/pit stops.
- Online leaderboards (localStorage best-time only for v1).
- Ghost replay of the player's own best run (natural v2 addition given the time-trial format).
- Weather/time-of-day variation.

---

## v1.3 Implementation Notes
v1.3.0 added **Race mode**: three AI opponents (distinct skill profiles,
racing lines and liveries) built on the test autopilot, with a standing grid,
live P1–P4 position tracking, arcade car-to-car collisions and a
finishing-order results screen. Time-trial records (PBs, ghosts, medals,
deltas) remain exclusive to Time Trial mode so traffic never pollutes them.
This supersedes the v1 "no AI opponents" scope line.

---

## v1.2 Implementation Notes
v1.2.0 deepened the time-trial loop: **sector timing** (3 sectors per lap,
purple/green HUD flashes, persisted per-track sector bests), **medals**
(gold/silver/bronze per-lap target times in the track registry, scaled by
lap count, shown on menu and finish screens), and **post-race driving
stats** (top speed, off-track time, drift time, resets, lap consistency).

---

## v1.1 Implementation Notes
v1.1.0 shipped the two items this spec called out as natural follow-ups:
**ghost replay** of the player's best run (recorded per track, replayed as a
translucent car, toggleable) and **multiple tracks** (a second faster circuit,
"Coastal Ring", with a menu track selector and per-track best times/splits/
ghosts — v1.0.0 bests migrate to the original track automatically). It also
added a HUD **minimap**. Still out of scope: tilt steering, WebGPU, online
leaderboards, weather/time-of-day.

---

## v1 Implementation Notes
The shipped v1 (see `STATUS.md`) finalizes the choices this spec left open:
**Babylon.js** (vendored in `lib/`, per the No-Build-Step Constraint), a
custom testable semi-sim physics module rather than a bundled physics engine,
**procedural geometry/textures/audio instead of `.glb`/KTX2 assets** (initial
payload ≈ 8 MB, within budget), an on-screen **steering slider** for mobile
(tilt deferred), and WebGL rendering with the WebGPU enhancement deferred.

---

## Note on Repository Conventions
Most other games in this repo use vanilla JavaScript + HTML5 Canvas 2D (see `REPO_STRUCTURE.md`), but games are not required to share a stack — this one intentionally uses a 3D engine (PlayCanvas or Babylon.js) instead, per the decision above. The one hard constraint carried over from the rest of the repo is **no build step**: the game must work by pushing static files and having GitHub Pages serve them directly, with no compile/bundle stage (see the No-Build-Step Constraint above).
