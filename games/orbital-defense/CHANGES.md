# Orbital Defense — Change Log

## Session 1 — Initial Build

### Architecture
Single-file vanilla JS canvas game. Fixed 800×800 canvas.

- `game.js` — all game logic, physics, audio, rendering, input

### Core Systems
| System | Details |
|--------|---------|
| Physics | Gravitational interceptors (Kepler-ish), Newtonian attraction per frame |
| Threats | Asteroids (sm/md/lg), comets (fast+tail), drones (homing+shield), boss (every wave 5) |
| Power-ups | 6 types: orbit boost, shield, time slow, multi-shot, bomb, repair |
| Combo system | Kill streak multiplier up to ×10; resets on planet hit or timeout |
| Wave scaling | `waveConfig(w)`: asteroid count, comet/drone counts, spawn interval, speed multiplier |
| Audio | Web Audio API: launch, explosion (noise), combo arpeggio, power-up, damage |
| Persistence | `localStorage.od_hs` (high score) |

---

## Session 2 — 2026-06-28

### Added: Best wave tracking
`bestWave` persisted in `localStorage.od_bw`. Updated in `triggerGameOver()` when `wave > bestWave`.

Displayed:
- **Start screen**: below high score, in green
- **Game over screen**: inline with wave count — shows "(new best!)" or "(best: N)"

### Added: ESC pause toggle
`paused` boolean; toggled by `Escape` keydown when state is `PLAYING` or already paused.

- Game loop: `update()` skipped when `paused`
- Render: pause overlay drawn after all other content (outside shake transform) — dark semi-transparent fill with "PAUSED" and "ESC to resume" text
- `paused` reset to `false` in `initGame()`

### Design decision: pause doesn't affect GAME_OVER
ESC only works during active play. Once the planet is destroyed the game-over sequence plays out; ESC is ignored until restart.

### File responsibilities
| File | Role |
|------|------|
| `game.js` | Everything |
| `index.html` | Canvas mount point |
| `style.css` | Layout, canvas scaling |
