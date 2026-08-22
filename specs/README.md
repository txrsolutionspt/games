# Game Development Specifications

Comprehensive technical and design specifications for games in this repository.

## Available Specifications

### 📋 Platformer Game Specification

**Folder:** [`platformer/`](./platformer/)

A complete specification for a Mario-style 2D side-scrolling platformer game.

- **File:** [`platformer/PLATFORMER_SPEC.md`](./platformer/PLATFORMER_SPEC.md) (3000+ lines)
- **Scope:** MVP + post-MVP roadmap
- **Target:** Browser-based, desktop & mobile
- **Reference:** Pixel Dash is a working example of this style

**Key Sections:**
- Player mechanics (movement, jumping, states)
- Enemy types (walker, flying, patrol)
- Collectibles (coins, power-ups)
- Level design (9-zone progression)
- Physics tuning (gravity, acceleration, jump feel)
- Collision system (AABB, 4-direction resolution)
- Scoring & progression
- Mobile controls integration
- MVP acceptance criteria

**Quick Start:** Read [`platformer/README.md`](./platformer/README.md) for overview

---

## Mobile Controls Integration

**File:** [`MOBILE_CONTROLS_SPEC.md`](../MOBILE_CONTROLS_SPEC.md)

Platform-independent mobile controls specification for all games.

- **Scope:** Touch input, button sizing, responsive design
- **Standards:** WCAG accessibility, Material Design, Apple HID guidelines
- **Button layouts:** Platformer, D-pad (grid), racing analog
- **Implementation:** Unified input abstraction pattern
- **Testing:** Device compatibility, latency measurement

---

## Using These Specifications

### For Game Developers

1. **Choose a game type** (platformer, puzzle, racing, etc.)
2. **Read the relevant specification** thoroughly
3. **Reference the mobile controls spec** for touch support
4. **Review example implementations** in `games/` folder
5. **Start with MVP**, add enhancements post-launch

### For Level Designers

- Review the **Level Structure** section in your game's spec
- Create levels using JSON format (see **Level Data Format**)
- Test on desktop and mobile before release
- Reference existing levels in the repo for guidance

### For Game Designers

- Read the **Game Concept** and **Core Loop** sections
- Understand player progression and difficulty ramp
- Review scoring systems and progression mechanics
- Plan content roadmap (MVP vs. post-MVP)

### For Programmers

- Use **Physics Configuration** as a guide for tunable constants
- Implement **Collision System** with provided algorithms
- Follow **File Structure** recommendations
- Reference **Mobile Controls Integration** for input abstraction
- Study example games in `games/` folder

---

## How to Create a New Game Specification

If you're adding a new game type (e.g., roguelike, turn-based strategy, racing), follow this structure:

1. **Create a new folder** under `specs/` (e.g., `specs/roguelike/`)
2. **Write a comprehensive spec** similar to PLATFORMER_SPEC.md:
   - Table of contents
   - Game concept & philosophy
   - Core mechanics
   - Player progression
   - Level/scenario design
   - Scoring & progression
   - Game states & UI
   - Physics/mechanics (if applicable)
   - Audio design
   - MVP scope & acceptance criteria
3. **Create a README.md** summarizing the spec
4. **Link to mobile controls spec** for touch input guidance
5. **Commit & document** in the repository

---

## Reference Games

### Platformer Games

- **Pixel Dash** (`games/pixel-dash/`) — 2D platformer, 3 levels, complete example
- **Animal Alphabet Adventure** (`games/animal-alphabet-adventure/`) — Educational platformer

### Puzzle Games

- **Snake** (`games/snake/`) — Grid-based, D-pad controls
- **Sudoku** (`games/sudoku/`) — Number puzzle, touch-friendly UI
- **2048** (`games/2048/`) — Tile sliding puzzle

### Action Games

- **Race Car** (`games/race-car/`) — 3D racing, steering + pedals
- **Breakout** (`games/breakout/`) — Paddle game
- **Orbital Defense** (`games/orbital-defense/`) — Tower defense
- **Stellar Assault** (`games/stellar-assault/`) — Space shooter
- **Tower Defense** (`games/tower-defense/`) — Strategy action
- **Pixel Dash** (`games/pixel-dash/`) — Platformer action
- **Cat Garden Haven** (`games/cat-garden-haven/`) — Relaxing clicker

---

## Mobile Controls Quick Reference

### Button Layouts

#### Platformer (3 buttons)
```
Left | Right    Jump
  ◀   ▶           ▲
 ┌──┐┌──┐     ┌────┐
 │  ││  │     │    │
 └──┘└──┘     │  ↑ │
              └────┘
```

#### Grid-Based / Puzzle (D-Pad)
```
      ↑
  ← D-Pad →
      ↓
┌──────────┐
│    ↑     │
│  ← + →   │
│    ↓     │
└──────────┘
```

#### Racing (Steering + Pedals)
```
Steering         Gas
┌──────────┐   Brake
│          │   ┌──┬──┐
│ Slider   │   │ G│ B│
│   ◀──▶   │   │  │  │
│          │   └──┴──┘
└──────────┘
```

### Button Specifications

- **Minimum size:** 56–72 px
- **Recommended:** 70–80 px on phones
- **Scaling:** Use viewport-relative sizing (`vw`, `clamp()`)
- **Feedback:** Visual state change on touch (<50ms latency)
- **Simultaneous:** Support multiple simultaneous inputs
- **Safe areas:** Avoid notches/dynamic islands (use `safe-area-inset-*`)

**See:** [`MOBILE_CONTROLS_SPEC.md`](../MOBILE_CONTROLS_SPEC.md) for complete guidelines

---

## Physics Tuning Reference

Common tunable constants (from Platformer spec):

```javascript
const PhysicsConfig = {
    gravity: 0.38,              // Pixels/frame²
    maxFallSpeed: 14,           // Pixels/frame
    maxRunSpeed: 3.4,           // Pixels/frame
    jumpVelocity: -9.5,         // Pixels/frame (upward)
    coyoteTime: 120,            // Milliseconds
    jumpBufferTime: 120,        // Milliseconds
};
```

Adjust these to match your desired feel (arcade vs. simulation).

---

## Scoring & Progression

### Scoring Pattern (Platformer)

| Action | Points |
|--------|--------|
| Coin | +100 |
| Enemy defeat | +200 |
| Power-up | +500 |
| Checkpoint | +500 |
| Level complete | +5000 |
| Time bonus | +up to 1000 |
| All coins bonus | +2000 |
| No damage bonus | +3000 |

### High Score Persistence

```javascript
localStorage.setItem('highScore', score);
const highScore = parseInt(localStorage.getItem('highScore')) || 0;
```

---

## Common Questions

### Q: Do I have to follow this spec exactly?

**A:** No! These are guidelines. Adapt them to your game's unique needs. Use what works, ignore what doesn't.

### Q: Can I mix game types?

**A:** Absolutely. A puzzle game can have action elements, or an action game can have strategy. Reference relevant sections from multiple specs.

### Q: How do I handle mobile controls for new game types?

**A:** Always follow the **Mobile Controls Spec**. Create buttons appropriate to your game's input needs (D-pad, joystick, slider, buttons, etc.). Test on real devices.

### Q: Should I implement the full spec or just MVP?

**A:** Start with **MVP only** (minimum viable product). This gets the game playable quickly. Then iterate with post-MVP enhancements based on playtesting feedback.

### Q: Where do I store level data?

**A:** Use JSON files in a `levels/` folder (see Platformer spec). Load them dynamically. This makes level creation and iteration much easier than hard-coding.

---

## Contributing

To add a new game specification:

1. Create a new folder under `specs/` (e.g., `specs/my-game-type/`)
2. Write `MY_GAME_SPEC.md` following the structure of PLATFORMER_SPEC.md
3. Create `README.md` summarizing the spec and providing quick reference
4. Link to mobile controls spec for touch input guidance
5. Commit and document in this file

---

## File Structure

```
specs/
├── README.md                          # This file
├── platformer/
│   ├── README.md                      # Platformer overview
│   └── PLATFORMER_SPEC.md             # Complete platformer spec
└── (future game specs here)

MOBILE_CONTROLS_SPEC.md                # Cross-platform mobile input spec
```

---

**Status:** ✅ Specifications complete and ready for game development.

**Last Updated:** August 2026

**Maintained by:** [Games Repository](../)
