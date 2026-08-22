# Mobile Controls Specification

A unified guide for implementing first-class mobile support in browser games, prioritizing touch input as a core requirement rather than an afterthought.

---

## Overview

Mobile controls should be designed from the beginning, not retrofitted. This specification provides architecture patterns, button layouts, and UX principles used successfully across the games in this repository (Pixel Dash, Snake, Race Car, etc.).

**Key principle:** Platform-independent input abstraction. The same game code works on desktop (keyboard), mobile (touch), and gamepad via a unified input layer.

---

## Core Requirements

### Orientation & Screen Layout

- **Landscape orientation preferred** for action games (platformers, racing, shooters).
- **Portrait orientation acceptable** for puzzle/grid games (Snake, Sudoku, 2048).
- **Force landscape** with a subtle "Rotate Device" overlay if the game requires it.
- Avoid requiring tiny/precise touch targets on small screens — test on phones ≤5.5 inches.

### Touch Button Specifications

**Minimum dimensions:**
- **56–72 px** per Apple/Google HID guidelines.
- **Larger on phones** (80–100px) — better for quick thumb taps while moving.
- **Adjustable** via a settings panel (opacity, position) so players can customize.

**Touch behavior:**
- Buttons act like **physical buttons**, not toggles.
- `touchstart` → player state changes immediately (e.g., `moveLeft = true`).
- `touchend` / `touchcancel` → player state resets (e.g., `moveLeft = false`).
- Support **simultaneous inputs** (hold left + tap jump, multiple touch points on D-pad, etc.).
- No delay; input latency should be imperceptible (<50ms from screen touch to game state change).

**Visual feedback:**
- Show pressed state (e.g., `background-color` shift, slight `scale()` down) instantly on touch.
- Use high-contrast colors so buttons are visible in different lighting.
- Avoid hover effects (touch devices don't hover).

### Responsive Scaling

- Scale buttons and text proportionally to viewport width (use `vw` units or `clamp()`).
- Preserve playability on very small screens (e.g., 320px width).
- Use `@media (max-height: …)` to adjust button size on landscape tablets vs. phones.
- Avoid placing critical controls in the notch/safe-area (iOS); use CSS `safe-area-inset-*` if needed.

### Browser & Input Prevention

- Set `touch-action: none` on the canvas and controls to prevent unwanted scrolling/zooming.
- Disable browser zoom via `<meta name="viewport" content="user-scalable=no">`.
- Call `e.preventDefault()` on `touchstart`/`touchend` to suppress 300ms tap delay (use passive listeners carefully).
- Respect `pointer: coarse` and `pointer: fine` media queries to show/hide controls conditionally.

### Pause & Resume

- **Automatically pause** when the browser tab loses focus (`visibilitychange` event).
- Provide a visible **pause button** in the HUD during gameplay, always accessible.
- Display a resume screen if the player returns to the tab while paused.

---

## Input Abstraction Pattern

The game engine should not depend on input device type. Use an abstraction layer:

```
Input Layer (Unified)
├── KeyboardInput   (desktop: arrows, WASD)
├── TouchInput      (mobile: on-screen buttons)
└── GamepadInput    (optional: controllers)
         ↓
    Player Actions
         ↓
├── LEFT / RIGHT / JUMP      (platformer)
├── UP / DOWN / LEFT / RIGHT  (grid-based puzzle)
└── STEER / THROTTLE / BRAKE  (racing)
         ↓
    Game Logic (unchanged across platforms)
```

### Example: Platformer (Pixel Dash style)

**Input state:**
```javascript
const keys = { left: false, right: false, jump: false };
let jumpPressed = false; // edge-detect for jump
```

**Keyboard handling:**
```javascript
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !e.repeat) {
        keys.jump = true;
        jumpPressed = true;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === ' ') keys.jump = false;
});
```

**Touch button binding:**
```javascript
function bindBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press = () => {
        keys[key] = true;
        if (key === 'jump') jumpPressed = true;
        btn.classList.add('pressed');
    };
    const release = () => {
        keys[key] = false;
        btn.classList.remove('pressed');
    };
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        press();
    }, { passive: false });
    btn.addEventListener('touchend', e => {
        e.preventDefault();
        release();
    }, { passive: false });
    btn.addEventListener('touchcancel', e => {
        e.preventDefault();
        release();
    }, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
}

bindBtn('btn-left', 'left');
bindBtn('btn-right', 'right');
bindBtn('btn-jump', 'jump');
```

**Game loop (agnostic to input source):**
```javascript
function update() {
    if (keys.left) player.moveLeft();
    if (keys.right) player.moveRight();
    if (jumpPressed) {
        player.jump();
        jumpPressed = false; // consume the press
    }
    // ... rest of game logic
}
```

---

## Recommended Layouts

### Layout 1: Platformer (Mario-style)
**Example:** Pixel Dash

```
┌─────────────────────────────────────┐
│   SCORE       LEVEL       LIVES    │
│                                     │
│            GAME WORLD                │
│                                     │
│                                     │
│   ◀  ▶                          ▲   │
│ ┌──┐┌──┐                    ┌─────┐ │
│ │  ││  │                    │     │ │
│ └──┘└──┘                    │  ↑  │ │
│                             └─────┘ │
└─────────────────────────────────────┘
```

**Controls:**
- **Left / Right buttons** – movement; can be held continuously.
- **Jump button** – responds immediately to tap; hold for higher jump.
- **Position:** Left buttons in bottom-left corner, jump in bottom-right.
- **Button size:** 70–80px wide × tall.

**Use case:** Platformers, side-scrolling action.

---

### Layout 2: Grid-Based (D-Pad)
**Example:** Snake

```
┌─────────────────────────────────────┐
│   SCORE          HIGH SCORE        │
│                                     │
│         ┌─────────────┐             │
│         │             │             │
│         │  GAME GRID  │             │
│         │             │             │
│         └─────────────┘             │
│                                     │
│           ↑   ↓   ←   →             │
│         ┌──────────────┐            │
│         │   D - P A D  │            │
│         └──────────────┘            │
└─────────────────────────────────────┘
```

**Controls:**
- **Four directional buttons** – Up, Down, Left, Right.
- **Position:** Centered at bottom (or bottom-left for left-handed variants).
- **Button size:** 60–72px each, arranged in a cross/plus pattern.
- **Tap behavior:** One tap = one move/direction change; holding is less common than in platformers.

**Use case:** Puzzle games (Snake, Tetris, maze games), turn-based or grid-based movement.

---

### Layout 3: Racing (Analog-like)
**Example:** Race Car

```
┌──────────────────────────────────────┐
│  LAP 2/3  TIMER: 1:42  BEST: 1:38    │
│                                      │
│                                      │
│         ┌────────────────────┐       │
│         │                    │       │
│         │    3D RACE VIEW    │       │
│         │  (Babylon.js/etc)  │       │
│         │                    │       │
│         └────────────────────┘       │
│                                      │
│  ◀  STEERING  ▶          GAS   BRAKE │
│ ┌──────────────┐        ┌──┐  ┌──┐  │
│ │              │        │  │  │  │  │
│ └──────────────┘        └──┘  └──┘  │
└──────────────────────────────────────┘
```

**Controls:**
- **Steering slider/wheel** (left side) – continuous steer angle.
- **Gas button** (right side, top) – hold for throttle.
- **Brake button** (right side, bottom) – hold for braking/reverse.
- **Position:** Steering on left, pedals on right; mirrors a car's layout.
- **Button size:** Gas/brake 60–70px; steering slider as wide as needed (proportional).

**Behavior:**
- Steering is **analog** (slider position = steer angle) or **digital D-pad** (taps for discrete left/right).
- Gas/brake are **held** (binary on/off with smooth ramping in-game).
- Optional device **tilt** (gyroscope) for steering on supported devices.

**Use case:** Racing games, vehicle controls.

---

### Layout 4: Invisible Zones (Racing Alternative)
Some racing games use **invisible tap zones** to maximize screen real estate:

```
┌────────────────────────────┐
│    [HUD & Game View]       │
│                            │
│   [LEFT] [CENTER] [RIGHT]  │
│   Brake    Menu    Gas     │
│                            │
│   Tap/hold right half      │
│   for throttle; left half  │
│   for brake.               │
└────────────────────────────┘
```

**Pros:**
- Maximizes screen visibility — no opaque buttons.
- Works well on wide screens.

**Cons:**
- Requires player familiarity; less discoverable for new players.
- Harder to provide visual feedback without buttons.

**Recommendation:** Start with visible buttons (Layout 3) for clarity; invisible zones are a polish feature.

---

## Implementation Checklist

### HTML Structure
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">`
- [ ] `<canvas id="gameCanvas" style="touch-action: none;"></canvas>`
- [ ] `<div id="controls">` with button elements (hidden on desktop via CSS media query)
- [ ] Use semantic button elements (`<button>`) or accessible `<div role="button">` with ARIA labels

### CSS
- [ ] Canvas scaled responsively (`width: 100%`, aspect ratio preserved)
- [ ] Buttons sized in `px` or `clamp()` to scale with viewport
- [ ] Buttons hidden on desktop: `@media (pointer: fine) { #controls { display: none; } }`
- [ ] Buttons shown on touch devices: `@media (pointer: coarse) { #controls { display: flex; } }`
- [ ] Pressed state styling (e.g., `background-color`, `transform: scale()`)
- [ ] No hover effects; `:active` and `.pressed` class for feedback
- [ ] High contrast colors; test in bright sunlight

### JavaScript
- [ ] Input abstraction: `keys`, `jumpPressed`, or equivalent state object
- [ ] Keyboard listeners: `keydown`/`keyup` with modifier keys (Shift, Alt, Ctrl) ignored
- [ ] Touch listeners: `touchstart`, `touchend`, `touchcancel` with `e.preventDefault()`
- [ ] Mouse listeners (for testing): `mousedown`, `mouseup`, `mouseleave`
- [ ] Media query listener for `(pointer: coarse)` to enable audio on first interaction if needed
- [ ] Game loop consumes input state and applies player actions
- [ ] No frame-to-frame input carry-over (state resets each frame if not held)

### Accessibility
- [ ] Button labels or ARIA-labels for screen readers
- [ ] Focus indicator (`:focus`) for keyboard navigation (useful for testing)
- [ ] Sufficient color contrast (WCAG AA minimum)
- [ ] No reliance on color alone to convey state (use shape + color, or text labels)

### Testing
- [ ] Test on actual phone/tablet (not just browser DevTools emulation)
- [ ] Test landscape and portrait orientations
- [ ] Test with one hand (e.g., can you tap jump while moving left?)
- [ ] Test rapid taps (e.g., mash jump repeatedly)
- [ ] Test simultaneous inputs (hold left + hold right; hold move + tap jump)
- [ ] Verify buttons don't obscure critical gameplay (coins, enemies, level exit)
- [ ] Check input latency with a stopwatch / slow-motion video

---

## Settings & Customization

Provide players with control over:

### Opacity
- Range: 40% to 100% (allow dimmer buttons in bright sunlight, brighter at night)
- Default: 85%

### Button Position
- Allow sliding buttons left/right or up/down within safe zones
- Preserve safe area for notches/dynamic islands
- Save preference to `localStorage`

### Button Size
- Preset sizes: Small (56px), Normal (70px), Large (90px)
- Or custom slider (min: 50px, max: 120px)
- Default: Normal

### Control Scheme
- Platformer: Left / Right / Jump (3 buttons)
- Alternative: D-Pad (4 directional)
- Racing: Steering + Gas/Brake
- Player can switch if the game supports multiple schemes

### Example Settings Panel
```
┌─ SETTINGS ─────────────┐
│                        │
│ Button Opacity    [═══●] │
│ Button Size       [Small] │
│ Control Scheme    [Type 1] │
│ Layout            [Right]  │
│                        │
│       [CLOSE]          │
└────────────────────────┘
```

---

## Performance & Optimization

### Reduce Input Latency
- Process touch events **synchronously** in the input listener (don't defer to next frame).
- Avoid heavy calculations in `touchstart`/`touchend` handlers.
- Use `{ passive: false }` listeners only where necessary (`preventDefault()` is needed).

### Memory & Assets
- Don't load separate button images; use CSS (border-radius, box-shadow, gradients) or emoji.
- Cache DOM button references if binding many controls.
- Unload unused controls if switching between game modes.

### Frame Pacing
- Cap frame rate at 60 FPS (or screen's native refresh rate) — no benefit to higher, battery drain increases.
- Use `requestAnimationFrame()` for smooth updates, not `setTimeout()`.

---

## Cross-Platform Testing

### Desktop (Testing touch via DevTools)
1. Open Chrome/Firefox DevTools.
2. Toggle **Device Toolbar** (Ctrl+Shift+M / Cmd+Shift+M).
3. Select a device (e.g., iPhone 12, iPad).
4. Test in Responsive mode to simulate touch.
5. **Caveat:** Real touch is faster/more reliable; always test on real devices.

### Mobile Testing Checklist
- [ ] iOS Safari (iPhone, iPad, different sizes)
- [ ] Android Chrome (Samsung, Google Pixel, OnePlus, etc.)
- [ ] Android Firefox
- [ ] Landscape and portrait orientations
- [ ] With/without notch or dynamic island
- [ ] Various screen sizes (4.5", 5.5", 6.5", 7"+)
- [ ] Slow networks (throttle in DevTools to 3G)
- [ ] Low-end devices (CPU throttle 4× in DevTools)

### Input Latency Measurement
- Record a slow-motion video of your thumb touching a button.
- Count frames until the player visually responds in-game.
- Aim for <5 frames at 60 FPS (≈83 ms), ideally <2 frames (≈33 ms).

---

## Common Pitfalls

### 🚫 Don't
- **Tiny buttons** (<50px). Thumbs are not styluses; 56–72px minimum.
- **Hover-only controls** on touch devices. Use `:active` or `.pressed` class.
- **Place controls over critical UI.** HUD and coins should be visible.
- **Require precise taps.** A 10px target is nearly impossible on touch.
- **Ignore simultaneous inputs.** If a player holds left + taps jump, respect both.
- **Use `pointer-events: none`** to "disable" buttons — use `disabled` attribute or aria-disabled instead.
- **Assume portrait orientation.** Force landscape if your game needs it.
- **Forget to test** on actual hardware. DevTools emulation is useful but not definitive.

### ✅ Do
- **Button size 70–80px** (or scale with viewport).
- **Immediate visual feedback** on touch (color change, scale).
- **Simultaneous inputs** (track multiple `touchstart` points).
- **Keyboard fallback** for testing and accessibility.
- **Settings panel** for opacity, size, position.
- **Pause on blur** (tab loses focus, browser minimized).
- **Test on real devices** (phones, tablets, different sizes).
- **Responsive scaling** (buttons resize on orientation change).

---

## References & Examples

### Games in This Repository

1. **Pixel Dash** (`games/pixel-dash/`)
   - Platform: Platformer (Mario-style)
   - Controls: Left, Right, Jump (3 buttons)
   - Button size: 70px (70×70), 60px on small screens
   - Media query: `@media (pointer: coarse)`

2. **Snake** (`games/snake/`)
   - Platform: Grid-based puzzle
   - Controls: D-Pad (4 directional buttons)
   - Button size: 60px minimum
   - Layout: Centered at bottom

3. **Race Car** (`games/race-car/`)
   - Platform: 3D racing (Babylon.js)
   - Controls: Steering slider, Gas, Brake
   - Optional: Device tilt (gyroscope)
   - Layout: Left steering, right pedals

### External References
- [Apple Human Interface Guidelines — Touch](https://developer.apple.com/design/human-interface-guidelines/inputs/touch)
- [Material Design — Touch Target Size](https://material.io/design/platform-guidance/android-bars.html#bottom-app-bar)
- [WCAG 2.1 Level AAA — Target Size (2.5.5)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [MDN Web Docs — Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Web.dev — Input Latency](https://web.dev/input-latency/)

---

## Summary

**Mobile is first-class.** Design controls from the start, not as an afterthought. Use an input abstraction to support keyboard, touch, and gamepad with the same game logic. Test on real devices. Provide settings for customization. Prioritize playability and accessibility.

For platformers: **Separate Left/Right buttons + Jump** works better than a virtual joystick.

For racing: **Analog steering + digital pedals** mimics real car controls.

For puzzles: **D-Pad or arrow buttons** are simple and familiar.

Most importantly: **Buttons should feel like physical buttons.** Fast, responsive, no lag. If your touch buttons feel sluggish, players will reach for a keyboard.
