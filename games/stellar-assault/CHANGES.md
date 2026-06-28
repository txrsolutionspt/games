# Stellar Assault — Change Log

## Session 1 — Initial Build

### Architecture
Single-file vanilla JS canvas game. Fixed 480×720 canvas.

- `game.js` — all game logic, rendering, audio, input

### Core Systems
| System | Details |
|--------|---------|
| Player | Ship with hitbox-only collision (5px sweet spot, classic shmup style) |
| Enemies | Grunts (formation dive), divers (homing swoop), tanks (slow+triple shot), boss (every wave 5) |
| Shooting | Auto-fire at `BASE_FIRE_RATE=0.13s`; spread shot and beam laser as power-ups |
| Power-ups | spread, beam, shield+1, invincible, speed, smart bomb |
| Combo | Kill streak multiplier up to ×10; resets on hit |
| Wave scaling | `waveConfig(w)`: grunt/diver/tank counts, speed, fire rate |
| Audio | Web Audio API: shoot, explosion (noise), power-up, damage, bomb |
| Persistence | `localStorage.sa_hs` (high score) |

---

## Session 2 — 2026-06-28

### Added: Best wave tracking
`bestWave` persisted in `localStorage.sa_bw`. Updated in `triggerGameOver()` when `wave > bestWave`.

Displayed:
- **Start screen**: below high score, in green
- **Game over screen**: inline with wave count — "(new best!)" or "(best: N)"

### Added: ESC pause toggle
`paused` boolean; toggled by `Escape` in the existing `keydown` listener. Added after Shift (smart bomb) handling.

- Game loop: `update()` skipped when `paused`
- Render: pause overlay drawn after all content — semi-transparent fill, "PAUSED" + "ESC to resume"
- `paused = false` reset in `initGame()`

### Design decision: same pause scope as Orbital Defense
ESC only toggles during `PLAYING` state or to unpause. Game over sequence is unaffected.

### File responsibilities
| File | Role |
|------|------|
| `game.js` | Everything |
| `index.html` | Canvas mount point |
| `style.css` | Layout, canvas scaling |
