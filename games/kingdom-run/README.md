# Kingdom Run

Complete technical and design specification for **Kingdom Run**, a Mario-style 2D side-scrolling platformer game.

## Quick Start

- **Main Spec:** [`GAME_SPEC.md`](./GAME_SPEC.md) — Full specification (1200+ lines)
- **Mobile Controls:** See [`MOBILE_CONTROLS_SPEC.md`](../../MOBILE_CONTROLS_SPEC.md) for touch input guidelines

## What's Included

### Core Sections

1. **Game Concept** — Design philosophy, target platform, core loop
2. **Player Mechanics** — Movement, jumping, input handling
3. **Player States** — State machine with 8 states (IDLE, RUNNING, JUMPING, etc.)
4. **World & Level Design** — Tile types, collision types, world boundaries
5. **Camera System** — Horizontal following, smooth movement, culling
6. **Enemies** — 3 types (Basic Walker, Flying, Patrol) with defeat mechanics
7. **Collectibles** — Coins, power-ups (growth, invincibility, speed, projectile)
8. **Blocks & Objects** — Question blocks, breakable blocks, moving platforms, one-way platforms
9. **Level Structure** — Recommended level flow (9-zone progression arc)
10. **Checkpoints & Respawning** — Checkpoint placement, respawn logic, state preservation
11. **Death & Game Over** — Death triggers, sequences, game over conditions
12. **Level Completion** — Goal mechanics, scoring bonuses, level progression
13. **Scoring System** — Point breakdown, score display, high score tracking
14. **Game States** — FSM with 10+ states (BOOT, TITLE, PLAYING, PAUSE, etc.)
15. **Physics Configuration** — Data-driven constants (gravity, acceleration, jump velocity)
16. **Collision System** — AABB detection, collision resolution (4 directions)
17. **Audio Design** — Music tracks, sound effects, Web Audio API implementation
18. **HUD & UI** — In-game HUD, UI screens (title, pause, level complete, game over)
19. **Level Data Format** — JSON schema for level definition
20. **Mobile Controls Integration** — Touch controls, button layout, input abstraction
21. **Minimum Viable Product** — MVP scope, acceptance criteria, post-MVP enhancements

## Key Design Decisions

### Physics
- **Acceleration-based movement** — Not instant velocity changes
- **Coyote time** — Can jump ~120ms after leaving ground (forgiving)
- **Jump buffering** — Queue jump before landing (~120ms)
- **Deterministic jumps** — Hold for higher jumps; release early for control

### Level Design
- **9-zone progression arc** — Gradual difficulty ramp
- **Checkpoint every 30–45 seconds** — Frequent save points
- **Fair difficulty** — No cheap deaths; all mechanics are telegraphed

### Input
- **Platform-independent abstraction** — Same code for keyboard, touch, gamepad
- **Mobile-first** — 70–80px buttons, simultaneous input support
- **Responsive** — <50ms latency from touch to response

### Scoring
- **Points for actions** — Coins (+100), enemies (+200), power-ups (+500)
- **Bonuses** — Time bonus, all-coins bonus, no-damage bonus
- **Persistent** — High score saved to localStorage

## MVP Scope

### Required for First Release ✅
- One playable character
- Left/right movement with acceleration
- Jump with coyote time & jump buffering
- Gravity & falling
- Tile-based collision
- One enemy type (basic walker)
- Coins & question blocks
- One complete level
- Camera following
- Death & respawn system
- Goal/level exit
- Score & lives tracking
- Basic HUD, pause menu, title/game-over screens
- Mobile controls (left, right, jump buttons)

### Post-MVP Enhancements 🚀
- Additional enemy types (flying, patrol)
- Power-ups (mushroom, invincibility, speed, fire)
- Breakable blocks
- Moving platforms, one-way platforms
- 3–5 additional levels
- Secret areas
- Boss encounters
- Audio (music & SFX)
- Polish (animations, visual effects, art)
- Leaderboard/high score tracking

## Implementation Checklist

### Design Phase
- [ ] Review this specification thoroughly
- [ ] Decide on sprite/art style
- [ ] Plan level layouts (draw on paper or Tiled)
- [ ] Choose technology stack (Canvas 2D, WebGL, etc.)

### Development Phase
- [ ] Set up basic HTML/CSS/JS structure
- [ ] Implement player movement & jumping
- [ ] Add gravity & collision detection
- [ ] Create enemy logic
- [ ] Implement level loading (from JSON)
- [ ] Add scoring & HUD
- [ ] Implement pause/game-over states
- [ ] Add mobile controls
- [ ] Create checkpoint/respawn system
- [ ] Add audio (procedural or samples)
- [ ] Polish & test

### Testing Phase
- [ ] Test on desktop (keyboard)
- [ ] Test on mobile (touch, various sizes)
- [ ] Test level progression
- [ ] Verify collision accuracy
- [ ] Check input latency
- [ ] Validate scoring & high score persistence
- [ ] Playtest with others

## Usage

### For Game Developers

1. Read the full spec to understand all mechanics.
2. Use the **Physics Configuration** section to tune feel.
3. Reference the **Level Data Format** section to create levels.
4. Follow **Mobile Controls Integration** for touch support.
5. Implement MVP features first, then iterate on enhancements.

### For Level Designers

- Review the **Level Structure** section for recommended 9-zone progression.
- Use the **JSON Level Format** to create levels in an editor (Tiled, custom tool, or text).
- Place checkpoints every 30–45 seconds of gameplay.
- Gradually increase difficulty as the level progresses.
- Test each level on desktop and mobile before release.

### For Programmers

- Reference the **File Structure** for recommended code organization.
- Use the **Physics Configuration** section as a guide for tunable constants.
- Implement **Collision System** with AABB detection and 4-direction resolution.
- Follow the **Game States** FSM for architecture.
- See **Mobile Controls Integration** for input abstraction pattern.

## Related Documents

- **Mobile Controls Spec:** [`MOBILE_CONTROLS_SPEC.md`](../../MOBILE_CONTROLS_SPEC.md) — Touch input, button sizing, responsive design
- **Games in This Repo:**
  - Pixel Dash — Platformer with 3 levels (good reference for implementation)
  - Snake — Grid-based game (different mechanics, but good UI/control patterns)
  - Race Car — 3D racing game (shows alternative platform implementation)

## Example Levels

The spec includes recommended level structure:

1. **Green Forest** (Intro) — Learn basic movement, no enemies
2. **Lava Canyon** (Easy) — First enemies, simple jumps
3. **Sky Temple** (Medium) — Multiple enemies, moving platforms
4. **Dark Castle** (Hard) — Complex challenges, all mechanics combined
5. **Boss Arena** (Final) — Boss encounter, toughest test

Each level should take 3–5 minutes to complete.

## Performance Targets

- **Frame rate:** 60 FPS on desktop, 30+ FPS on mobile (smooth)
- **Input latency:** <50ms (touch to visual response)
- **Memory:** <50MB (including assets)
- **Level load:** <1 second per level

## Audio Implementation

- **Music:** Use looping tracks (title, gameplay, boss, victory, game-over)
- **Sound effects:** Procedural generation via Web Audio API (no audio files needed for MVP)
- **Volume/mute:** Provide user control in settings

## Next Steps

1. **Clone/fork** this repository
2. **Review** `GAME_SPEC.md` in detail
3. **Create** basic project structure (HTML, CSS, JS)
4. **Implement** MVP features in order
5. **Test** on desktop and mobile
6. **Iterate** based on playtesting feedback
7. **Enhance** with post-MVP features

---

**Status:** ✅ Complete specification document ready for development.

**Last Updated:** August 2026

**Maintained by:** [Games Repository](../..)
