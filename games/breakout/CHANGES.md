# Breakout — Change Log

## Session 1 — Initial Build

### Architecture
Single-file vanilla JS canvas game. No build step.

- `game.js` — all game logic, physics, rendering, and input
- `index.html` — canvas element and script tag
- `style.css` — centering and mobile viewport

### Core Systems
| System | Details |
|--------|---------|
| Physics | AABB ball↔brick overlap, nearest-point circle test, reflection axis from smallest overlap |
| Paddle | Mouse/touch position tracking, keyboard polling via `applyKeys` each frame |
| Level progression | `buildBricks()` + `resetBall()` + `resetPaddle()` on each level |
| Persistence | `localStorage.breakoutHighScore` |
| Render loop | `requestAnimationFrame`, dt capped at 3× frame |

### Brick HP system
- Rows 0–1: 2 HP (red → orange on damage)
- Rows 2–5: 1 HP (green / blue)
- Level 3+: all bricks get 2 HP

---

## Session 2 — 2026-06-28

### Added: Web Audio sound effects
Four procedural sounds via Web Audio API, initialized on first user interaction:

| Sound | Trigger | Character |
|-------|---------|-----------|
| `sfxBounce` | Wall / paddle bounce | Short sine click |
| `sfxBrick` | Brick hit (any HP) | Square wave pop |
| `sfxLifeLost` | Ball falls below paddle | Sawtooth descend |
| `sfxLevelClear` | All bricks gone | 4-note ascending arpeggio |

**Why procedural**: no asset files needed; works offline; tiny footprint.

### Added: Ball trail
`ballTrail` array stores last 12 positions. Drawn as fading, shrinking circles before the ball. Gives a motion-blur feel and makes fast ball easier to track visually. Cleared on each `resetBall()`.

### Added: Screen shake
`shakeX` / `shakeY` offsets applied via `ctx.translate` inside a `save/restore` block. Only the game world shakes — HUD and overlays are drawn outside the transform. Shake decays by ×0.82 each frame.

| Trigger | Intensity |
|---------|-----------|
| Life lost | 8px |
| Level clear | 6px |

### Added: Particle burst on brick destroy
`spawnParticles(x, y, col, n)` spawns N radial particles from brick center, using the brick's row color. On full destroy: 10 particles; on HP damage: 4 white sparks. Particles have life in frame-units (max 45) and shrink as they fade.

### Added: Level-specific brick patterns
`brickExists(row, col, level)` gate controls which grid cells have bricks:

| Level | Pattern | Notes |
|-------|---------|-------|
| 1 | Full grid | Classic |
| 2 | Corners removed | 4 cells cut from each corner row |
| 3 | Checkerboard | Half the bricks, all 2 HP |
| 4+ | Diagonal stripe gaps | `(col + row*2) % 4 !== 0` |

Bricks now store their `row` index to look up BRICK_COLORS without relying on array position (needed because skipped cells break the old `Math.floor(i / COLS)` approach).

### File responsibilities
| File | Role |
|------|------|
| `game.js` | Everything (constants, audio, state, physics, particles, rendering, input) |
| `index.html` | Canvas mount point |
| `style.css` | Layout only |
