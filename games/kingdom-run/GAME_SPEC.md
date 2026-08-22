# Kingdom Run — Game Specification

A complete technical and design specification for **Kingdom Run**, a Mario-style 2D side-scrolling platformer game.

---

## Table of Contents

1. [Game Concept](#game-concept)
2. [Player Mechanics](#player-mechanics)
3. [Player States](#player-states)
4. [World & Level Design](#world--level-design)
5. [Camera System](#camera-system)
6. [Enemies](#enemies)
7. [Collectibles](#collectibles)
8. [Blocks & Interactive Objects](#blocks--interactive-objects)
9. [Level Structure](#level-structure)
10. [Checkpoints & Respawning](#checkpoints--respawning)
11. [Death & Game Over](#death--game-over)
12. [Level Completion](#level-completion)
13. [Scoring System](#scoring-system)
14. [Game States](#game-states)
15. [Physics Configuration](#physics-configuration)
16. [Collision System](#collision-system)
17. [Audio Design](#audio-design)
18. [HUD & UI](#hud--ui)
19. [Level Data Format](#level-data-format)
20. [Data Persistence & Local Storage](#data-persistence--local-storage)
21. [Mobile Controls Integration](#mobile-controls-integration)
22. [Minimum Viable Product (MVP)](#minimum-viable-product-mvp)

---

## Game Concept

A 2D side-scrolling platform game where the player controls a character who runs, jumps, defeats enemies, collects items, and reaches the end of each level.

### Design Philosophy

- **Responsive controls:** Jump immediately on input; acceleration/deceleration feel natural.
- **Fair difficulty:** No hidden mechanics or cheap deaths.
- **Retro feel:** Colorful pixel art, chiptune audio, classic platformer gameplay.
- **Data-driven:** Levels and physics are configured via data files, not hard-coded.

### Target Platform

- Browser-based (HTML5 Canvas/WebGL)
- Desktop & Mobile (responsive)
- Landscape orientation preferred
- 60 FPS gameplay

### Architecture: No Backend

This game is **entirely client-side** — there is no server, no API, no database, and no user accounts.

- All gameplay logic runs in the browser.
- Level definitions ship as static JSON files bundled with the game (see [Level Data Format](#level-data-format)).
- Settings, high scores, and level-completion progress are saved locally in the browser via `localStorage` — see [Data Persistence & Local Storage](#data-persistence--local-storage) for the schema, versioning, and compatibility rules.
- There is no online leaderboard, no cross-device sync, and no cloud save. Progress is tied to one browser on one device; clearing site data or switching browsers loses it.
- Nothing here requires network access after the initial page load — the game should be fully playable offline once loaded.

### Core Loop

```
Explore → Jump → Avoid/Defeat Enemies → Collect Items → Reach Checkpoint → Finish Level
```

---

## Player Mechanics

### Movement

**Horizontal Movement**

- Player can move **left** and **right** smoothly.
- Movement uses **acceleration/deceleration** — not instant velocity changes.
- Player velocity should gradually increase when holding a direction, and gradually decrease when releasing.
- Allow **direction changes mid-air** (player can steer while jumping).

**Vertical Movement (Gravity)**

- Gravity pulls the player downward at a constant rate.
- Player velocity increases until reaching **max fall speed** (terminal velocity).
- Fall speed should feel natural but not too slow (prefer ~14 px/frame).

### Jump Mechanics

**Jump Initiation**

- Jump should respond **immediately** to input (tap and go).
- Only allow jump when player is on the ground or within **coyote time** window.
- Implement **jump buffering** to allow input shortly before landing.

**Jump Height**

- Jump height is **deterministic** — holding the button longer results in higher jumps.
- Releasing the jump button early can **reduce jump height** for more control.

**Mid-Air Control**

- Allow the player to **change direction** while airborne.
- Apply reduced **air control** (slower acceleration) compared to ground movement to maintain challenge.

### Input Handling

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move Left | `←` or `A` | Left button |
| Move Right | `→` or `D` | Right button |
| Jump | `Space`, `W`, or `↑` | Jump button |
| Pause | `Escape` or `P` | Pause button (HUD) |

---

## Player States

The player has a finite state machine with the following states:

### State Diagram

```
         ┌─────────┐
         │  IDLE   │
         └────┬────┘
              │ (input: left/right)
         ┌────▼────────┐
         │   RUNNING   │
         └────┬────────┘
              │ (input: jump)
         ┌────▼────────┐
         │   JUMPING   │
         └────┬────────┘
              │ (rising → falling)
         ┌────▼────────┐
         │   FALLING   │
         └────┬────────┘
              │ (landing on ground)
         ┌────▼────────┐
         │   LANDING   │
         └────┬────────┘
              │ (animation done)
         ┌────▼────────┐
         └─ IDLE/RUNNING

    ANY STATE + (collision with enemy) → HURT
    ANY STATE + (touch hazard/fall off) → DYING
    HURT → INVINCIBLE (temporary, flashing)
    DYING → (respawn at checkpoint)
```

### State Details

| State | Duration | Trigger Next | Notes |
|-------|----------|--------------|-------|
| **IDLE** | Until input | Move input → RUNNING | Standing still |
| **RUNNING** | Until jump/stop | Jump input → JUMPING; no input → IDLE | Horizontal movement |
| **JUMPING** | ~0.5–1.0s | Velocity becomes negative → FALLING | Rising in air |
| **FALLING** | Until landing | Collision below → LANDING | Descending in air |
| **LANDING** | ~0.1–0.2s | Animation done → IDLE/RUNNING | Landing animation |
| **HURT** | ~0.3s | Done → INVINCIBLE | Hit by enemy, invulnerable to damage |
| **INVINCIBLE** | ~2.0s (flashing) | Timer expired → IDLE | Temporary protection, can still move |
| **DYING** | ~0.5s | Animation done → respawn | Death sequence before respawn |

### Animation Triggers

- **IDLE:** Stand still, idle animation (breathing, shifting weight).
- **RUNNING:** Leg animation synchronized to movement speed.
- **JUMPING:** Rising animation (stretched/lean forward).
- **FALLING:** Falling animation (relaxed pose).
- **LANDING:** Brief landing animation (squash/bounce).
- **HURT:** Flash briefly, knockback animation.
- **DYING:** Death animation (spin, explode, fade).
- **INVINCIBLE:** Flashing on/off every 100ms.

---

## World & Level Design

### Tile-Based Environment

The level is composed of a grid of **32×32 px tiles** (configurable per level).

### Tile Types

| Tile | Collision | Behavior | Notes |
|------|-----------|----------|-------|
| **Ground** | SOLID | Static platform | Basic floor |
| **Platform** | SOLID | Static platform | Raised platform |
| **Brick/Block** | SOLID | Static, indestructible | Wall |
| **Breakable Block** | SOLID | Destructible by power-up | Crumbles when hit |
| **Question Block** | SOLID | Breakable, contains item | Bounces on hit from below |
| **Moving Platform** | SOLID | Moves along predefined path | Carries player with it |
| **One-Way Platform** | ONE_WAY | Solid from top, pass-through below | Jump up through from below |
| **Hazard Spike** | HAZARD | Damages player on touch | Instant death or hit |
| **Decorative** | NON_COLLIDING | Visual only | Scenery, no physics |

### Collision Types

```javascript
const CollisionType = {
    SOLID:          0,   // Blocks all movement
    ONE_WAY:        1,   // Blocks from top, pass-through from below
    HAZARD:         2,   // Damages player, no physical collision
    NON_COLLIDING:  3    // Visual only, no collision
};
```

### World Boundaries

- **Level width:** Variable (e.g., 3200 px for a short level, 8000+ for long levels).
- **Level height:** Fixed camera viewport height (typically 300–600 px logical height).
- **Out of bounds:** Falling below the level = death.

---

## Camera System

### Camera Behavior

The camera follows the player horizontally, keeping them centered or slightly ahead.

### Requirements

- **Horizontal following:** Camera tracks player X position, leading ahead to show upcoming obstacles.
- **Smooth movement:** Camera velocity smoothly interpolates to avoid jittery panning.
- **No backward panning:** Camera should not move left unless player moves far right then comes back.
- **Vertical stability:** Keep vertical camera relatively static (small adjustments for tall obstacles).
- **Level boundaries:** Camera must not scroll beyond level edges.

### Camera Configuration

```javascript
const Camera = {
    lookAhead: 100,         // Pixels ahead of player to center
    smoothingFactor: 0.1,   // Interpolation speed (0.0–1.0)
    minX: 0,                // Minimum horizontal position
    maxX: levelWidth - viewportWidth,
    minY: 0,
    maxY: levelHeight - viewportHeight
};
```

### Performance Optimization

- **Culling:** Disable rendering/physics for tiles/entities outside the active camera region.
- **Unloading:** Unload chunks of level data as camera moves away.

---

## Enemies

### Basic Walker

**Behavior**

- Patrols left and right along a defined route.
- Reverses direction when hitting a wall or level boundary.
- Moves at constant speed.

**Properties**

```javascript
const BasicWalker = {
    x: 400,
    y: 200,
    x1: 300,    // Left boundary
    x2: 500,    // Right boundary
    speed: 1.5, // Pixels per frame
    width: 32,
    height: 32
};
```

**Defeat**

- Jump on top → Enemy defeated, player bounces upward.
- Side collision → Player loses 1 hit (or dies if no power-up).

### Flying Enemy

**Behavior**

- Moves in a predefined pattern (sine wave, figure-8, vertical loop).
- Does not respect terrain (flies over obstacles).
- Patrol area is defined by waypoints or a parametric path.

**Properties**

```javascript
const FlyingEnemy = {
    x: 400,
    y: 150,
    speed: 2.0,
    pattern: 'sine',     // 'sine', 'loop', 'wave'
    amplitude: 50,       // Vertical oscillation
    frequency: 0.05,     // Oscillation speed
    width: 32,
    height: 32
};
```

**Defeat**

- Cannot be jumped on (no top collision).
- Side collision → Player loses 1 hit.
- With projectile power-up → Hit and defeated.

### Patrol Enemy

**Behavior**

- Moves between two waypoints.
- Can reverse at waypoints or patrol a circuit.
- May change direction based on player proximity (optional AI).

**Properties**

```javascript
const PatrolEnemy = {
    x: 300,
    y: 200,
    waypoints: [{x: 300, y: 200}, {x: 500, y: 200}, {x: 500, y: 100}],
    speed: 1.0,
    currentWaypoint: 0
};
```

### Enemy Collision Resolution

| Event | Result | Notes |
|-------|--------|-------|
| Player lands on enemy (top) | Enemy defeated | Player bounces upward ~8 units |
| Player hits enemy (side/bottom) | Player hurt | Knockback + temporary invincibility |
| Multiple enemies | Handle independently | No chain reactions |

---

## Collectibles

### Coins

**Behavior**

- Scattered throughout the level.
- Collect by walking over or jumping through them.
- Non-blocking (player passes through).

**On Collect**

```
Trigger: touchCoin()
  → Increment coin counter
  → Play collection sound
  → Play sparkle animation
  → Remove coin from world
  → Add score +100
```

### Power-Ups

#### Growth Power-Up (Large Mushroom)

**Effect**

- Player size increases to 2× (64×64 instead of 32×32).
- Gains ability to **break breakable blocks** by jumping into them from below.
- Additional visual change (e.g., red color, different sprite).

**Behavior on Damage**

- Taking damage while large → Revert to small size (don't die).
- Second hit → Death.

#### Invincibility Power-Up (Star)

**Effect**

- Player becomes **temporarily invincible** (~8 seconds).
- Can damage enemies on touch.
- Visual indicator (flashing/glowing sprite, star orbits).

#### Speed Boost (Speed Shoes)

**Effect**

- Increases run speed by 50% (~5 seconds).
- Visual effect (speed lines, trail).

#### Projectile Power-Up (Fire Flower)

**Effect**

- Player can throw projectiles by pressing a secondary button.
- Limited ammo or unlimited time-based generation.
- Projectiles bounce off walls and defeat flying enemies.

### Power-Up Behavior

- Spawn from **question blocks** or found in the level.
- Pop out of block with upward velocity.
- Bounce off walls until collected.
- If power-up reaches level edge → Despawn.

---

## Blocks & Interactive Objects

### Question Block

**Initial State**

- Looks like a ? symbol.
- Solid collision (player can stand on top).

**Interaction**

```
Player jumps into block from below:
  → Bounce animation
  → Spawn item (coin, power-up, etc.)
  → Item moves upward out of block
  → Block becomes empty (flat tile)
  → No further interaction
```

**Content Rules**

- Most question blocks contain coins.
- Some contain power-ups (1 per ~5 blocks).
- Some contain nothing (empty after hit).
- Some contain extra lives (rare).

### Breakable Block

**Initial State**

- Looks like a brick.
- Solid collision.

**Interaction**

```
Player with power-up hits block:
  → Crumble animation
  → Block disappears
  → No item spawned (usually)

Player without power-up hits block:
  → No effect (solid)
```

### Moving Platform

**Behavior**

- Follows a predefined path (loops or back-and-forth).
- Player stands on top, moves with platform.
- Carries player safely (no sliding off).

**Implementation**

```javascript
const MovingPlatform = {
    x: 400,
    y: 200,
    waypoints: [{x: 300, y: 200}, {x: 600, y: 200}],
    speed: 2.0,
    currentWaypoint: 0,
    width: 128,
    height: 16
};
```

### One-Way Platform

**Behavior**

- **Solid from above** (player can stand and walk on it).
- **Pass-through from below** (player can jump through from beneath).

**Implementation Tip**

- Check if player is falling (velocity > 0) before applying collision from below.

---

## Level Structure

### Recommended Level Flow

A well-designed level should have a learning arc:

```
1. START ZONE (tutorial area)
   ├─ Safe, open space
   ├─ Introduce basic movement
   └─ No enemies yet

2. BASIC MOVEMENT SECTION
   ├─ Simple jumps
   ├─ Small gaps
   ├─ First coins to collect
   └─ Gentle slopes

3. FIRST ENEMIES
   ├─ Single basic walker
   ├─ Player learns to jump on enemies
   ├─ Safe retreat area nearby
   └─ Reward with coins/power-up

4. PLATFORMING CHALLENGE
   ├─ Multiple jumps in sequence
   ├─ Increase spacing/difficulty
   ├─ Test player control
   ├─ Optional harder path for secrets
   └─ Checkpoint here

5. COLLECTIBLES & EXPLORATION
   ├─ Question blocks with power-ups
   ├─ Off-path coins (reward exploration)
   ├─ Secret areas
   └─ Player can backtrack

6. DIFFICULTY RAMP
   ├─ Multiple enemies
   ├─ Hazards (spikes)
   ├─ Tight jumps
   ├─ Moving platforms
   └─ Challenge player skill

7. PENULTIMATE CHALLENGE
   ├─ Combine all mechanics
   ├─ High-stakes section
   ├─ No checkpoint nearby (tension)
   └─ Great sense of accomplishment

8. GOAL / FINISH
   ├─ Visual milestone (castle, flag, door)
   ├─ Safe area to catch breath
   └─ Level complete trigger
```

### Level Metadata

```javascript
const Level = {
    id: 1,
    name: "Green Forest",
    width: 3200,
    height: 600,
    tileSize: 32,
    backgroundColor: "#87CEEB",
    spawnPoint: {x: 64, y: 500},
    checkpoints: [
        {x: 800, y: 500, label: "Checkpoint 1"},
        {x: 1600, y: 400, label: "Checkpoint 2"}
    ],
    goal: {x: 3100, y: 100},
    tilemap: [...],        // 2D array of tile IDs
    entities: {
        enemies: [...],
        coins: [...],
        powerUps: [...]
    }
};
```

---

## Checkpoints & Respawning

### Checkpoint Placement

- Place checkpoints roughly every **30–45 seconds** of gameplay.
- Avoid placing checkpoints in dangerous areas.
- Always follow a checkpoint with a safe landing zone.
- Give visual feedback (glowing ring, flag animation).

### Checkpoint Behavior

```
Player enters checkpoint zone:
  → Save current checkpoint position
  → Save health/power-up state
  → Play checkpoint sound
  → Visual effect (sparkle, glow)

Player dies:
  → Disable controls
  → Death animation
  → Wait ~1 second
  → Respawn at last checkpoint
  → Reset player state
  → Resume gameplay
```

### State on Respawn

- **Position:** Last checkpoint location.
- **Health:** Reset to full (or restore to checkpoint state if damage was taken).
- **Power-ups:** Restore to checkpoint state.
- **Coins/Score:** Retain (don't reset on respawn).
- **Level objects:** Restore to checkpoint state (destroyed enemies respawn, etc.).

---

## Death & Game Over

### Death Triggers

The player dies when:

1. **Falling off bottom** of the level (Y > level height + buffer).
2. **Touching a lethal hazard** (spike, lava, etc.) without power-up.
3. **Enemy collision** without invincibility (side/bottom hit reduces health to 0).
4. **Health reaches 0** (can have multiple hits with power-up).

### Death Sequence

```
Collision with hazard / fall off level:
  → Disable player controls
  → Play death sound
  → Death animation (spin, fade, explode)
  → Wait ~0.5–1.0 seconds
  → Check if lives remain:
       ├─ YES → Respawn at checkpoint
       └─ NO → Game Over screen
```

### Game Over

```
Player has no lives remaining:
  → Stop gameplay
  → Display "GAME OVER" screen
  → Show final score
  → Offer options:
       ├─ Retry level
       ├─ Select different level
       └─ Return to menu
  → Allow restart with fresh lives
```

---

## Level Completion

### Reaching the Goal

```
Player touches goal object:
  → Stop gameplay
  → Play victory sound/music
  → Play goal animation (flag raises, door opens, etc.)
  → Wait ~1 second
  → Show level complete screen with:
       ├─ Final score
       ├─ Time taken
       ├─ Coins collected
       ├─ Enemies defeated
       ├─ Secrets found
       └─ Performance rating (bronze/silver/gold)
  → Unlock next level
  → Return to level select
```

### Level Complete Bonuses

- **Time bonus:** Finish level quickly → extra points.
- **Coin bonus:** Collect all coins → extra points.
- **No damage bonus:** Complete without taking hits → extra points.
- **Performance rating:** Based on combined score.

---

## Scoring System

### Points Breakdown

| Action | Points |
|--------|--------|
| Collect coin | +100 |
| Defeat enemy (stomp) | +200 |
| Collect power-up | +500 |
| Reach checkpoint | +500 |
| Break block | +50 |
| Level completion | +5000 |
| Bonus: All coins collected | +2000 |
| Bonus: No damage | +3000 |
| Bonus: Time (remaining seconds × 10) | +up to 1000 |

### Score Display

- **HUD:** Current score, coin counter, lives.
- **Level complete screen:** Breakdown of points earned.
- **High score:** Persisted locally (see [Data Persistence & Local Storage](#data-persistence--local-storage)); displayed on the title/menu screen.

---

## Game States

### State Transitions

```
┌─────────────────────────────────┐
│           BOOT                  │
│  (Initialize game, load assets) │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│         TITLE SCREEN            │
│  (Show menu, wait for start)    │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│       LEVEL SELECT              │
│  (Choose or auto-start level)   │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│         PLAYING                 │
│  (Main gameplay loop)           │
└──────────────┬──────────────────┘
       │       │       │
       │       │       └─► LEVEL COMPLETE ──┐
       │       │                             │
       │       └─► PAUSE ──┐                 │
       │            │      │                 │
       │            └──────┘                 │
       │            (resume)                 │
       │                                     │
       └─► GAME OVER (no lives) ──┐          │
                                  │          │
        ┌─────────────────────────┴─────────┴───────┐
        │                                             │
┌───────▼──────────────────────────┐      ┌─────────▼────────────────┐
│      LEVEL COMPLETE SCREEN       │      │   GAME OVER SCREEN       │
│  (Show stats, next level button) │      │  (Show final score, menu)│
└───────┬──────────────────────────┘      └─────────┬────────────────┘
        │                                           │
        └───────────────┬───────────────────────────┘
                        │
             ┌──────────▼──────────┐
             │   LEVEL SELECT      │
             │  (Choose next level)│
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │   BACK TO TITLE     │
             └─────────────────────┘
```

### Pause State

```
Player presses PAUSE:
  → Freeze gameplay loop
  → Show pause overlay (darkened background + menu)
  → Options:
       ├─ Resume
       ├─ Restart level
       └─ Return to menu
```

---

## Physics Configuration

### Data-Driven Constants

All physics parameters should be stored in a configuration object, not hard-coded:

```javascript
const PhysicsConfig = {
    // Gravity & fall speed
    gravity: 0.38,              // Pixels/frame²
    maxFallSpeed: 14,           // Pixels/frame (terminal velocity)
    
    // Horizontal movement
    runAcceleration: 0.8,       // Pixels/frame²
    runDeceleration: 0.6,       // Pixels/frame²
    maxRunSpeed: 3.4,           // Pixels/frame
    airAcceleration: 0.4,       // Reduced in air
    airDeceleration: 0.3,
    
    // Jumping
    jumpVelocity: -9.5,         // Pixels/frame (upward)
    jumpVariation: 0.65,        // Factor for early release (0.0–1.0)
    
    // Timing
    coyoteTime: 120,            // Milliseconds (can jump ~120ms after leaving ground)
    jumpBufferTime: 120,        // Milliseconds (can queue jump before landing)
    
    // Knockback (from enemy hit)
    knockbackX: 5,              // Horizontal velocity on hit
    knockbackY: -8,             // Vertical velocity on hit
    
    // Invincibility
    invincibilityDuration: 2000, // Milliseconds (2 seconds)
    invincibilityFlashRate: 100  // Milliseconds (flash on/off every 100ms)
};
```

### Physics Tuning Tips

- **Gravity ~0.3–0.4:** Natural-feeling fall speed.
- **Jump velocity ~-9 to -10:** Feels responsive; lands in ~1–1.5 seconds.
- **Coyote time ~100–150ms:** Forgiving platformer feel (can jump shortly after stepping off ledge).
- **Jump buffer ~100–150ms:** Allows preemptive jump input before landing.

---

## Collision System

### Collision Detection Approach

Use **Axis-Aligned Bounding Box (AABB)** collision detection:

```javascript
function isCollidingAABB(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}
```

### Collision Resolution

After detecting a collision, determine the **collision direction** and resolve:

```javascript
function resolveCollision(player, tile) {
    const overlapLeft = (player.x + player.width) - tile.x;
    const overlapRight = (tile.x + tile.width) - player.x;
    const overlapTop = (player.y + player.height) - tile.y;
    const overlapBottom = (tile.y + tile.height) - player.y;
    
    // Find minimum overlap to determine direction
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    
    if (minOverlap === overlapTop) {
        // Collision from above (player falling onto tile)
        return 'TOP';
    } else if (minOverlap === overlapBottom) {
        // Collision from below (player jumping into tile)
        return 'BOTTOM';
    } else if (minOverlap === overlapLeft) {
        // Collision from left (player approaching from left)
        return 'LEFT';
    } else {
        // Collision from right
        return 'RIGHT';
    }
}
```

### Collision Pairs

| Collision Pair | Behavior | Notes |
|---|---|---|
| **Player ↔ Ground tile** | SOLID | Player lands, stops falling |
| **Player ↔ Platform tile** | SOLID (top) | Can walk on top, fall through bottom (if falling) |
| **Player ↔ One-way platform** | SOLID (top), pass-through (below) | Only block if falling from above |
| **Player ↔ Enemy** | TOP = defeat enemy; SIDE/BOTTOM = hurt player | Depends on collision direction |
| **Player ↔ Collectible** | Collect (non-blocking) | No physical collision |
| **Player ↔ Hazard** | Instant damage (no physical collision) | Spike, lava, etc. |
| **Enemy ↔ Wall** | Reverse direction | Patrol behavior |
| **Projectile ↔ Enemy** | Defeat enemy, remove projectile | If power-up active |

---

## Audio Design

### Music Tracks

| Context | Track | Mood |
|---------|-------|------|
| **Title Screen** | Upbeat, hopeful | Welcoming, nostalgic |
| **Level Gameplay** | Looping, energetic | Driving, adventurous |
| **Boss/Final Area** | Intense, dramatic | Urgent, climactic |
| **Victory/Level Complete** | Triumphant fanfare | Celebratory |
| **Game Over** | Sad, descending | Deflating, sad |
| **Pause Screen** | Soft, ambient | Calm, pause-like |

### Sound Effects

| Event | Sound | Duration |
|-------|-------|----------|
| **Jump** | Ascending pitch sweep | ~120ms |
| **Land** | Soft thump | ~60ms |
| **Coin collect** | Chime (two notes) | ~100ms |
| **Enemy defeat** | Descending buzz | ~150ms |
| **Power-up** | Ascending jingle | ~200ms |
| **Block hit** | Hollow pop | ~80ms |
| **Block break** | Crumble sound | ~150ms |
| **Checkpoint** | Bright ding | ~100ms |
| **Player hurt** | Short buzz | ~150ms |
| **Player death** | Descending wail | ~300ms |
| **Level complete** | Fanfare (4+ notes) | ~400ms |

### Audio Implementation

- Use **Web Audio API** to generate tones procedurally (no audio files required).
- Or use **compressed audio files** (MP3/OGG, <100KB each).
- Respect **browser audio unlock** (require user interaction before playing audio).
- Provide **volume/mute controls** in settings.

---

## HUD & UI

### In-Game HUD

Displayed during gameplay (top of screen, fixed position):

```
┌────────────────────────────────────────────────┐
│ SCORE: 12500   LEVEL: 1   COINS: 08/15   ❤❤❤ │
└────────────────────────────────────────────────┘
```

### HUD Elements

| Element | Display | Updates |
|---------|---------|---------|
| **Score** | Current total points | Every score event |
| **Level Number** | Current level (e.g., "1", "2-3") | On level load |
| **Coins** | Collected / Total in level | Every coin collected |
| **Lives** | ❤ ❤ ❤ (hearts or number) | On respawn/collect extra life |
| **Power-up indicator** (optional) | Current active power-up icon | On power-up collect/expire |

### UI Screens

#### Title Screen

```
┌────────────────────────────────┐
│                                │
│      PLATFORMER GAME           │
│      (title art here)          │
│                                │
│     [START GAME]               │
│     [LEVEL SELECT]             │
│     [SETTINGS]                 │
│     [ABOUT]                    │
│                                │
└────────────────────────────────┘
```

#### Level Select Screen

```
┌────────────────────────────────┐
│  LEVEL SELECT                  │
│                                │
│  [1: Green Forest] (COMPLETED) │
│  [2: Lava Canyon] (LOCKED)     │
│  [3: Sky Temple] (LOCKED)      │
│                                │
│  [BACK]                        │
└────────────────────────────────┘
```

#### Pause Screen

```
┌────────────────────────────────┐
│        PAUSED                  │
│                                │
│  [RESUME]                      │
│  [RESTART LEVEL]               │
│  [LEVEL SELECT]                │
│  [QUIT TO MENU]                │
│                                │
└────────────────────────────────┘
```

#### Level Complete Screen

```
┌────────────────────────────────┐
│     LEVEL COMPLETE!            │
│                                │
│  Score: 45000                  │
│  Time: 2:34                    │
│  Coins: 15/15 ⭐               │
│  Enemies: 8/8 ⭐               │
│  Rating: ⭐⭐⭐ (GOLD)           │
│                                │
│  [NEXT LEVEL]                  │
│  [RETRY]                       │
│  [LEVEL SELECT]                │
│                                │
└────────────────────────────────┘
```

#### Game Over Screen

```
┌────────────────────────────────┐
│        GAME OVER               │
│                                │
│     Final Score: 28500         │
│     High Score: 156000         │
│                                │
│  [RETRY LEVEL]                 │
│  [LEVEL SELECT]                │
│  [QUIT TO MENU]                │
│                                │
└────────────────────────────────┘
```

---

## Level Data Format

### JSON Level Format

Levels should be stored as JSON for easy creation and iteration:

```json
{
  "level": {
    "id": 1,
    "name": "Green Forest",
    "description": "An introduction to platforming.",
    "width": 3200,
    "height": 600,
    "tileSize": 32,
    "backgroundColor": "#87CEEB",
    "spawnPoint": { "x": 64, "y": 500 },
    
    "checkpoints": [
      { "x": 800, "y": 500, "id": "checkpoint_1" },
      { "x": 1600, "y": 400, "id": "checkpoint_2" }
    ],
    
    "goal": {
      "x": 3100,
      "y": 100,
      "width": 64,
      "height": 64,
      "type": "flag"
    },
    
    "tilemap": [
      [ 0, 0, 0, 0, 0, 0, 0, 0 ],
      [ 0, 0, 0, 0, 0, 0, 0, 0 ],
      [ 0, 0, 1, 1, 0, 0, 0, 0 ],
      [ 2, 2, 2, 2, 2, 2, 2, 2 ]
    ],
    
    "entities": {
      "enemies": [
        {
          "type": "walker",
          "x": 400,
          "y": 200,
          "x1": 300,
          "x2": 600,
          "speed": 1.5
        }
      ],
      
      "coins": [
        { "x": 200, "y": 150 },
        { "x": 300, "y": 120 }
      ],
      
      "powerUps": [
        {
          "type": "mushroom",
          "x": 800,
          "y": 400
        }
      ],
      
      "platforms": [
        {
          "type": "moving",
          "x": 1200,
          "y": 350,
          "waypoints": [
            { "x": 1200, "y": 350 },
            { "x": 1600, "y": 350 }
          ],
          "speed": 2.0
        }
      ]
    }
  }
}
```

### Tile ID Reference

```
0 = Air (no collision)
1 = Platform (solid)
2 = Ground (solid)
3 = Brick (solid, breakable)
4 = Question block
5 = Spike hazard
6 = Moving platform (identified by entities)
7 = One-way platform
```

---

## Data Persistence & Local Storage

### No Backend — Browser Storage Only

Kingdom Run has no server component. The only persistence mechanism is the browser's `localStorage` API. This is separate from the static level JSON files described above:

| | Static level data | Player save data |
|---|---|---|
| **Source** | Shipped with the game (`levels/*.json`) | Written at runtime by the browser |
| **Storage** | Files on disk / server, loaded via `fetch` | `localStorage` |
| **Mutable?** | Read-only, never written to by the game | Read and written every session |
| **Scope** | Same for every player | Local to one browser on one device |

### What Is Saved Locally

- **Settings** — audio volume/mute, mobile control opacity/size/position (see `MOBILE_CONTROLS_SPEC.md`).
- **High score** — best score across all sessions.
- **Level progress** — per level: unlocked/locked, completed/not, best score, best time.

### What Is NOT Saved Across Sessions

- **Mid-level checkpoint state.** Checkpoints (see [Checkpoints & Respawning](#checkpoints--respawning)) only govern respawn-after-death *within* a single play session. Closing the tab or reloading the page restarts the current level from its `spawnPoint`, not from the last checkpoint reached. Persisting mid-level state is explicitly out of scope — it adds meaningful complexity (autosave timing, save corruption mid-level, resuming enemy/item state) for a benefit that matters only if a player is interrupted mid-level.
- **Any data behind a login/account.** There is no login — see [Architecture: No Backend](#architecture-no-backend).

### Storage Key & Schema

```javascript
const STORAGE_KEY = 'kingdomRun.saveData';
const SAVE_DATA_VERSION = 1; // bump on any schema shape change

const defaultSaveData = {
    version: SAVE_DATA_VERSION,
    settings: {
        audioVolume: 0.8,
        audioMuted: false,
        controlOpacity: 0.85,
        controlSize: 'normal'   // 'small' | 'normal' | 'large'
    },
    highScore: 0,
    levels: {
        // keyed by level id, one entry per level shipped with the game
        "1": { unlocked: true, completed: false, bestScore: 0, bestTimeMs: null }
    }
};
```

### Versioning & Compatibility

The root object always carries a `version` integer. This is what lets a later release of the game detect and handle save data written by an older (or, after a rollback, newer) version instead of guessing.

**On load:**

1. Read the raw string from `localStorage.getItem(STORAGE_KEY)`.
2. `JSON.parse` it. If parsing throws (corrupted data) — treat it as absent and fall back to `defaultSaveData`.
3. Compare `data.version` to the current `SAVE_DATA_VERSION`:
   - **Equal** → use as-is (after the defensive merge in step 4).
   - **Lower** → run the migration chain in order (e.g. `migrateV1toV2(data)`, then `migrateV2toV3(data)`, ...) until it reaches `SAVE_DATA_VERSION`, then re-save the upgraded data.
   - **Higher** (save was written by a newer build, e.g. after the player rolled back an update) → do not attempt to interpret fields this build doesn't know about. Fall back to `defaultSaveData` rather than risk misreading the shape, and never let this crash the game.
4. Defensively merge the result over `defaultSaveData` (shallow per top-level key) so a missing field — from a partial write, a hand-edited value, or a migration that didn't set every key — gets backfilled with its default instead of leaving `undefined` in the game state.

**Writing:** every save always writes the *current* `SAVE_DATA_VERSION`, never the version that was read.

**When to bump `SAVE_DATA_VERSION`:** only on an actual shape change (new field, renamed/removed field, restructured object) — not on every code change. Each migration should be additive and non-destructive: prefer defaulting a new field over discarding existing player progress like `highScore`.

### Storage Failure Handling

`localStorage` access can throw — quota exceeded, private/incognito restrictions in some browsers, or storage disabled entirely. Persistence is a convenience, not a requirement for play:

- Wrap every `localStorage` read and write in `try/catch`.
- If a write fails, keep playing normally; the current session's state stays correct in memory even though it won't survive a reload.
- If `localStorage` is unavailable from the start (throws on first access), fall back to an in-memory-only save object for that session so the game remains fully playable, just without persistence.

### Explicitly Out of Scope

- No server-side storage, accounts, or authentication.
- No online/global leaderboard — the "Leaderboard" item in [Post-MVP Enhancements](#post-mvp-enhancements) means a **local high-score list** sourced from this same `localStorage` data, not a networked feature.
- No cross-device sync or cloud save.

---

## Mobile Controls Integration

### Mobile-Specific Requirements

**See:** `MOBILE_CONTROLS_SPEC.md` for complete guidelines.

### Platformer Controls on Mobile

**Button Layout**

```
┌──────────────────────────────────────┐
│  SCORE  LEVEL  COINS  LIVES          │
│                                      │
│         GAME WORLD                   │
│                                      │
│                                      │
│  ◀  ▶                           ▲    │
│ ┌──┐┌──┐                    ┌────┐  │
│ │  ││  │                    │  ↑ │  │
│ └──┘└──┘                    │    │  │
│                             └────┘  │
└──────────────────────────────────────┘
```

**Controls**

- **Left button:** Move left (hold continuously)
- **Right button:** Move right (hold continuously)
- **Jump button:** Jump (tap for normal jump, hold for higher jump)

### Input Abstraction

```javascript
const Input = {
    keys: { left: false, right: false, jump: false },
    jumpPressed: false  // For edge detection
};

// Both keyboard and touch update this same object
// Game loop only reads Input, not input device type
```

### Media Query for Mobile

```css
@media (pointer: coarse) {
    #touchControls { display: flex; }  /* Show on mobile */
}

@media (pointer: fine) {
    #touchControls { display: none; }  /* Hide on desktop */
}
```

---

## Minimum Viable Product (MVP)

### MVP Scope

The first playable version should be **minimal but complete**.

#### Core Features (Required)

- [x] One playable character
- [x] Left/right movement (with acceleration)
- [x] Jumping (with coyote time & jump buffering)
- [x] Gravity & falling
- [x] Tile-based collision (player ↔ platforms)
- [x] One enemy type (basic walker)
- [x] Coin collectibles
- [x] Question blocks (spawn coins)
- [x] One level (3–5 minutes playtime)
- [x] Camera following player
- [x] Death & respawn at checkpoint
- [x] Goal/level exit
- [x] Score system
- [x] Lives system (start with 3, lose 1 on death)
- [x] Basic HUD (score, coins, lives)
- [x] Title screen
- [x] Pause menu
- [x] Game Over screen
- [x] Mobile controls (left, right, jump buttons)
- [x] Local save data (settings + high score + level unlock progress) persisted via `localStorage` with the versioned schema in [Data Persistence & Local Storage](#data-persistence--local-storage)

#### MVP Acceptance Criteria

✅ A player can:
- Start the game from the title screen
- Move left/right, jump over obstacles
- Collect coins and see score increase
- Defeat an enemy by jumping on it
- Reach a checkpoint and respawn there after death
- Complete the entire level by reaching the goal
- See a level complete screen with final score
- Restart the level or return to menu after completing it
- Close the tab, reopen the game later, and find their high score and unlocked levels still there

❌ Player should NOT have to:
- Restart the browser
- Use developer console
- Understand game mechanics from code (UI should be clear)

### Post-MVP Enhancements

Once MVP is complete, add (in priority order):

1. **Additional enemy types** (flying, patrol)
2. **Power-ups** (mushroom growth, invincibility)
3. **Breakable blocks** (destroy with power-up)
4. **Moving platforms**
5. **Additional levels** (progressive difficulty)
6. **Secret areas** (hidden paths, reward for exploration)
7. **Boss encounters**
8. **Audio** (music, sound effects)
9. **Polish** (animations, visual effects, better art)
10. **Leaderboard** — a *local* high-score list/history (still no backend; sourced entirely from the `localStorage` save data described in [Data Persistence & Local Storage](#data-persistence--local-storage))

---

## Technical Implementation Notes

### Recommended Stack

- **Canvas:** HTML5 Canvas 2D API (or WebGL for advanced effects)
- **Physics:** Custom implementation (or Rapier.js if needed)
- **Audio:** Web Audio API
- **Input:** Keyboard events + Touch events (unify via Input object)
- **Storage:** `localStorage` only — no backend. See [Data Persistence & Local Storage](#data-persistence--local-storage) for the versioned schema.

### File Structure

```
games/kingdom-run/
├── index.html           # Main entry point
├── style.css            # Styling
├── js/
│   ├── game.js          # Main loop, state machine
│   ├── player.js        # Player logic
│   ├── enemy.js         # Enemy logic
│   ├── physics.js       # Physics engine
│   ├── collision.js     # Collision detection
│   ├── input.js         # Input handling
│   ├── audio.js         # Sound effects
│   ├── levels.js        # Level loading (static JSON, read-only)
│   └── storage.js       # localStorage save/load, versioning & migration
├── levels/
│   ├── level-1.json
│   ├── level-2.json
│   └── ...
└── assets/
    ├── sprites/         # (Optional) sprite sheets
    └── sounds/          # (Optional) audio files
```

### Performance Targets

- **Frame rate:** Consistent 60 FPS on target devices
- **Input latency:** <50ms (touch to visual response)
- **Memory:** <50MB (including assets)
- **Level load time:** <1 second

---

## References

- **Physics Tuning:** *Game Feel* by Steve Swink — a standard reference on tuning acceleration, jump arcs, and input responsiveness for platformers.
- **Platformer Mechanics & Level Design:** GDC talks on platformer game feel and level design (search GDC Vault/YouTube for talks on Mario-style movement tuning and level pacing).
- **Mobile Input:** See `MOBILE_CONTROLS_SPEC.md` (repo root).

---

## Summary

This specification provides a complete blueprint for a Mario-style 2D platformer. It balances classic platformer feel with modern design practices:

- **Data-driven:** Physics, levels, and configuration are separate from code.
- **Responsive:** Keyboard, touch, and gamepad support via input abstraction.
- **Fair:** No hidden mechanics; difficulty ramps gradually.
- **Polishable:** MVP foundation allows incremental enhancements post-launch.

Follow this spec to create a platformer that feels great to play and is maintainable for future expansion.
