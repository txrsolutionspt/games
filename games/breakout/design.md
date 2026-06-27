# Game Design Document: Breakout

## Overview
A classic Breakout (Arkanoid-style) game playable in the browser on desktop and mobile. The player controls a paddle to bounce a ball and destroy all bricks on screen. Missing the ball costs a life; clearing all bricks advances to the next level.

---

## Core Mechanics

### Paddle
- Horizontally centered at the bottom of the canvas.
- Moves left/right only, clamped to canvas edges.
- Width shrinks slightly each level (adds difficulty).
- Desktop: controlled by arrow keys / A–D / mouse movement.
- Mobile: controlled by touch drag on the canvas.

### Ball
- Starts resting on the paddle; launched on Space / tap.
- Moves at a fixed speed vector `{vx, vy}`; speed increases each level.
- Bounces off the top wall and both side walls.
- Bounces off the paddle — hit angle varies based on where on the paddle it lands (center = straight up, edges = sharp angle). This gives the player directional control.
- Falls past the bottom edge → lose a life.

### Bricks
- Grid of bricks at the top of the canvas (e.g. 10 columns × 6 rows).
- Each brick has a **hit point value** (1 or 2) based on its row:
  - Rows 1–2 (top): 2 HP — require two hits, change colour after first hit.
  - Rows 3–6: 1 HP — destroyed in one hit.
- Ball destroys a brick (or reduces its HP) on contact and reflects.
- When all bricks are cleared → advance to next level.

### Lives
- Player starts with 3 lives.
- Losing all lives → Game Over.
- No life pickups in v1.

---

## Levels & Progression

| Level | Ball Speed | Paddle Width | Brick HP pattern |
|-------|-----------|--------------|------------------|
| 1 | Base (4 px/tick) | Full (120px) | Standard (rows 1–2 = 2HP) |
| 2 | +15% | −10px | Same |
| 3 | +30% | −20px | All rows = 2HP |
| 4+ | +5% per level | −5px per level (min 60px) | All rows = 2HP |

Level number displayed in HUD. No maximum level — loops with increasing difficulty.

---

## Win / Loss Conditions

| Condition | Result |
|-----------|--------|
| All bricks cleared | Level complete → next level (ball resets to paddle) |
| Ball passes the bottom edge | Lose 1 life → ball resets to paddle |
| All lives lost | Game Over |

---

## Scoring

| Event | Points |
|-------|--------|
| Destroy 1 HP brick | +10 |
| Destroy 2 HP brick (final hit) | +20 |
| Level complete bonus | +100 × level number |

- High score persisted in `localStorage`.
- Score and high score visible in HUD during play.

---

## Controls

### Desktop
| Input | Action |
|-------|--------|
| Arrow Left / A | Move paddle left |
| Arrow Right / D | Move paddle right |
| Mouse move | Move paddle (tracks cursor X) |
| Space / Enter | Launch ball / Start / Restart |

### Mobile
- Touch drag anywhere on canvas moves the paddle.
- Tap canvas to launch ball / start / restart.

---

## Screens & UI Flow

```
[Start Screen]
    |
    v (Space / tap)
[Gameplay — ball on paddle]
    |
    v (Space / tap)
[Ball in play]
    |
    ├─ All bricks cleared → [Level Complete flash] → next level (ball resets)
    ├─ Ball lost, lives > 0 → ball resets to paddle
    └─ Lives = 0 → [Game Over Screen]
                        |
                        v (Space / tap)
                   [Gameplay — reset]
```

### Start Screen
- Title "BREAKOUT", instruction text, Start button.

### HUD (during gameplay)
- Top bar: Score (left), Level (center), Lives as dots or hearts (right).

### Level Complete Flash
- Brief (1s) overlay: "LEVEL {n} CLEAR! +{bonus} pts" before next level loads.

### Game Over Screen
- Overlay: "GAME OVER", final score, high score, Restart button.

---

## Visual Style
- Dark background (`#1a1a2e`) — consistent with Snake.
- Paddle: light blue/cyan (`#29b6f6`).
- Ball: white or soft yellow (`#fff9c4`), small circle.
- Bricks: colour-coded by row:

| Row | 1 HP colour | 2 HP colour (full) | 2 HP colour (damaged) |
|-----|-------------|--------------------|-----------------------|
| 1–2 | — | `#ef5350` (red) | `#ff8a65` (orange) |
| 3–4 | `#66bb6a` (green) | — | — |
| 5–6 | `#42a5f5` (blue) | — | — |

- Small gap between bricks (2px padding).
- Lives displayed as filled circles in the HUD.

---

## Audio (optional / low priority)
Generate all sounds via Web Audio API — no audio files:
- Paddle hit: short mid-pitch blip.
- Brick hit (1HP): higher-pitch click.
- Brick destroy (2HP): brief chord.
- Wall bounce: soft low tick.
- Life lost: descending tone.

---

## Technical Requirements

### File Structure
```
games/breakout/
├── index.html   # Canvas, HUD, loads game.js
├── style.css    # Layout, dark theme, responsive canvas
└── game.js      # All game logic (loop, physics, input, rendering)
```

### index.html
- Single `<canvas id="gameCanvas">`.
- No D-pad needed — touch drag on canvas handles mobile.
- HUD rendered on canvas (not DOM) to simplify layout.

### style.css
- Canvas centered, scales to fit viewport (max 480px wide, 1:1.4 aspect ratio — taller than square to give brick/ball room).
- Consistent dark theme with Snake.

### game.js
Key components:

| Component | Description |
|-----------|-------------|
| `STATE` | `START`, `READY` (ball on paddle), `PLAYING`, `LEVEL_CLEAR`, `GAMEOVER` |
| `paddle` | `{x, y, w, h}` — x updates on input, clamped to canvas |
| `ball` | `{x, y, vx, vy, r}` — pixel-based (not grid), r = radius |
| `bricks` | 2D array of `{x, y, w, h, hp, maxHp, alive}` |
| `score`, `highScore`, `lives`, `level` | Game state integers |
| `gameLoop()` | `requestAnimationFrame`-based loop |
| `update()` | Physics, collision, state transitions |
| `draw()` | Canvas render each frame |
| `buildBricks()` | Reconstruct brick grid for current level |
| `resetBall()` | Place ball on paddle, set `STATE.READY` |
| `handleInput()` | Keyboard, mouse, and touch listeners |

### Physics & Collision

**Ball–Wall:**
- Left/right: `if (ball.x - r < 0 || ball.x + r > W) vx *= -1`
- Top: `if (ball.y - r < 0) vy *= -1`
- Bottom: `if (ball.y + r > H)` → lose life

**Ball–Paddle (AABB + angle control):**
```
if (ball overlaps paddle AABB) {
    vy = -Math.abs(vy)  // always reflect upward
    // offset: -1 (left edge) to +1 (right edge)
    const offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)
    vx = offset * MAX_ANGLE_VX
    // normalise to keep constant speed
}
```

**Ball–Brick (AABB):**
- Test each alive brick; on overlap determine which face was hit (top/bottom vs left/right) and reflect the appropriate axis.
- Reduce brick HP; if HP reaches 0 mark brick dead, add score.
- Only process first brick collision per frame to avoid tunnelling artefacts.

### Game Loop
Use `requestAnimationFrame` for smooth physics (pixel-based, not tick-based like Snake):
```js
function loop(ts) {
    const dt = Math.min(ts - lastTs, 32) / 16  // normalise to ~60fps
    lastTs = ts
    update(dt)
    draw()
    requestAnimationFrame(loop)
}
```

---

## Assets Required
- None — all visuals via Canvas 2D API.

---

## Out of Scope (v1)
- Power-ups (multi-ball, wide paddle, laser).
- Indestructible bricks.
- Animated brick explosions.
- Sound effects (nice-to-have).
