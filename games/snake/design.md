# Game Design Document: Snake

## Overview
A classic Snake game playable in the browser on both desktop and mobile. The player controls a growing snake, collecting food to increase their score while avoiding collision with walls and their own body.

---

## Core Mechanics

### The Snake
- Starts as a 3-segment body in the center of the grid.
- Moves continuously in the current direction — one grid cell per tick.
- Each time food is eaten, a new segment is added to the tail.
- Cannot reverse direction (e.g. if moving right, pressing left is ignored).

### Food
- One food item is active on the grid at all times.
- Spawns at a random empty cell (never on the snake body).
- Eating food: increases snake length by 1, increments score, spawns new food.

### Grid
- Canvas divided into a fixed cell grid (recommended: 20x20 cells).
- All movement and collision is cell-based, not pixel-based.

### Game Speed / Progression
- Game starts at a base tick rate (e.g. 150ms per move).
- Speed increases slightly every 5 foods eaten (minimum tick floor: 60ms).
- Speed increase gives a sense of escalating difficulty without changing controls.

---

## Win / Loss Conditions

| Condition | Result |
|-----------|--------|
| Snake head hits a wall | Game Over |
| Snake head hits its own body | Game Over |
| No win state — the game is score-based and endless |

---

## Scoring
- +10 points per food eaten.
- High score is tracked in `localStorage` and displayed on the Game Over screen.
- Score and high score are visible on screen during play (HUD overlay above canvas).

---

## Controls

### Desktop
| Input | Action |
|-------|--------|
| Arrow Up / W | Move Up |
| Arrow Down / S | Move Down |
| Arrow Left / A | Move Left |
| Arrow Right / D | Move Right |
| Space / Enter | Start game / Restart after Game Over |

### Mobile
- On-screen D-pad rendered below the canvas (four directional buttons).
- Buttons sized for thumb-friendly tapping (minimum 60x60px).
- Swipe detection as an optional enhancement (lower priority).

---

## Screens & UI Flow

```
[Start Screen]
    |
    v (Space / tap Start)
[Gameplay]
    |
    v (collision)
[Game Over Screen]
    |
    v (Space / tap Restart)
[Gameplay] (reset)
```

### Start Screen
- Game title ("Snake"), brief instruction text, "Press Space to Start" (or tap button on mobile).

### HUD (during gameplay)
- Top bar above canvas: current score (left), high score (right).

### Game Over Screen
- Overlay on canvas: "Game Over", final score, high score, restart prompt.
- Does not navigate away — resets in place.

---

## Visual Style
- Dark background (`#1a1a2e` or similar).
- Snake body: solid green (`#4caf50`), head slightly brighter (`#81c784`).
- Food: red circle or square (`#e53935`).
- Grid lines: optional, very subtle (low opacity dark lines).
- Font: monospace (e.g. `Courier New` or system monospace) for a retro feel.

---

## Audio (optional / low priority)
- Eat sound: short blip on food collection.
- Death sound: low buzz on game over.
- Use the Web Audio API to generate tones procedurally — no audio files needed.

---

## Technical Requirements

### File Structure
```
games/snake/
├── index.html   # Canvas element, HUD, mobile controls, loads game.js
├── style.css    # Layout, dark theme, responsive canvas scaling, D-pad
└── game.js      # All game logic (loop, state, input, rendering)
```

### index.html
- Standard project boilerplate.
- Single `<canvas id="gameCanvas">` element.
- Mobile D-pad `<div>` below the canvas.
- Links `style.css` and `game.js`.

### style.css
- Canvas centered, scales to fit viewport width on mobile.
- D-pad hidden on desktop via media query (`@media (pointer: fine)`).
- Scoped to this game folder only — no global overrides.

### game.js
Key components to implement:

| Component | Description |
|-----------|-------------|
| `GameState` | Enum/object tracking `START`, `PLAYING`, `GAMEOVER` |
| `snake` | Array of `{x, y}` objects; index 0 is the head |
| `direction` | Current `{x, y}` direction vector |
| `food` | `{x, y}` position of current food |
| `score` / `highScore` | Integers; highScore persisted via `localStorage` |
| `gameLoop()` | `setInterval`-based loop calling `update()` then `draw()` |
| `update()` | Move snake, check collisions, check food, update score |
| `draw()` | Clear canvas, render grid (optional), food, snake, HUD |
| `spawnFood()` | Random empty cell — must exclude all snake body cells |
| `handleInput()` | Keyboard listener + D-pad button listeners |
| `resetGame()` | Restore initial state and restart loop |

### Collision Detection
- **Wall:** head `x < 0 || x >= COLS || y < 0 || y >= ROWS`
- **Self:** check if head `{x, y}` matches any segment in `snake.slice(1)`

### Game Loop Pattern
```js
// Preferred pattern — avoids drift vs setInterval
function tick() {
    update();
    draw();
    setTimeout(tick, speed);
}
```

---

## Assets Required
- None — all visuals rendered via Canvas 2D API.
- No images or audio files needed for the base version.

---

## Out of Scope (v1)
- Levels or maze walls.
- Multiplayer.
- Animated sprites.
- Swipe controls (nice-to-have, not required).
