# Snake — Change Log

## Session 1 — Initial Build

### Architecture
Single-file vanilla JS canvas game. No build step.

- `game.js` — all game logic, rendering, input
- `index.html` — canvas + score display + d-pad buttons
- `style.css` — layout, d-pad styling

### Core Systems
| System | Details |
|--------|---------|
| Game loop | `setTimeout(tick, speed)` for logic; redraw called from tick |
| Grid | 20×20 cells, cell size derived from canvas pixel width |
| Snake | Array of `{x, y}` cells; `unshift` head, `pop` tail on no-eat |
| Speed | `BASE_SPEED=150ms`, decreases 10ms every 5 foods, floor at 60ms |
| Persistence | `localStorage.snakeHighScore` |
| Input | Keyboard WASD/arrows, D-pad button clicks |

---

## Session 2 — 2026-06-28

### Architecture change: split game-logic loop from render loop
- `tick()` runs on `setTimeout(speed)` — game state changes only here
- `drawLoop()` runs on `requestAnimationFrame` — draws at 60fps
- Reason: float texts and golden food pulse need smooth animation independent of tick rate

### Added: Web Audio sound effects
Initialized on first user interaction (`startGame` calls `initAudio`).

| Sound | Trigger | Character |
|-------|---------|-----------|
| `sfxEat` | Normal food eaten | Short rising sine |
| `sfxEatGolden` | Golden food eaten | 3-note ascending chord |
| `sfxDie` | Collision / wall | Sawtooth descend |

### Added: Golden food (★)
- Spawns after every 8 normal foods eaten, if no golden food is already active
- Worth **30 points** (vs 10 for normal food)
- Glows and pulses gold with a ★ glyph drawn on top
- Expires after **12 seconds** if not collected (`goldenFoodExpiry` timestamp)
- Excluded from normal food spawn pool and vice versa

### Added: Snake head eyes
Two white dots with dark pupils drawn on the head segment each frame. Eyes are offset perpendicular to the direction of movement and slightly forward, so they always face the direction the snake is heading.

### Added: Float texts (+10 / +30)
`floatTexts` array holds `{x, y, text, col, life}` entries in pixel coordinates. Updated and animated by the rAF draw loop (smooth 60fps rise), not by the tick. Each float lasts 1.0s and drifts upward at `cs × 2.2` pixels/second.

### Added: Swipe gesture support
`touchstart` records start position. `touchend` computes delta — if movement exceeds 8px, maps to the closest cardinal direction and calls `setDirection`. Tap (< 8px) triggers start/restart on overlay screens.

### File responsibilities
| File | Role |
|------|------|
| `game.js` | Everything |
| `index.html` | Canvas, score display, d-pad buttons |
| `style.css` | Layout, d-pad styling |
