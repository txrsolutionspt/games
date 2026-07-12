# Technical Specification: Race Car Game

## Overview
This technical specification outlines the core requirements for developing a cross-platform, browser-based race car game optimized for mobile-first deployment while maintaining full desktop compatibility.

---

## 1. Technical Architecture & Engine Selection
To ensure high performance across diverse hardware (from low-end smartphones to powerful desktops), prioritize modern web standards.

- **Primary Framework:** Use **PlayCanvas** or **Babylon.js**. Both offer professional-grade 3D performance, built-in physics engines, and excellent support for cross-platform input handling and asset optimization.
- **Rendering Pipeline:** Utilize **WebGL 2.0** for broad compatibility, with graceful degradation or progressive enhancement for **WebGPU** to leverage hardware acceleration on modern browsers.
- **Asset Management:**
  - **Initial Load:** Keep under **20MB** for rapid startup.
  - **Technique:** Use lazy loading/streaming for high-resolution textures and complex 3D models to keep the initial "Time to Gameplay" under 10 seconds.
  - **Format:** Use .glb or .gltf for 3D assets and WebP/KTX2 for compressed textures.

---

## 2. Cross-Platform Input Strategy
A unified input layer is critical for a seamless transition between touch and peripheral devices.

| Device Type | Primary Input Method | Implementation Logic |
| :--- | :--- | :--- |
| **Mobile/Tablet** | Touchscreen | On-screen D-pad/Joystick (left) + Action buttons (right) |
| **Desktop** | Keyboard/Mouse | WASD or Arrow keys; mouse for menu navigation |
| **Both** | Logic Layer | Map all inputs to a generic "VehicleControl" object (Steer, Throttle, Brake) |

- **Design Note:** Use semi-transparent, adaptive UI buttons on mobile. Implement "invisible interaction zones" (e.g., tap right half for throttle) to maximize screen visibility.

---

## 3. Performance & Optimization Metrics
Browser games are limited by browser memory and thermal throttling.

- **Frame Rate:** Target a stable **60 FPS**. Implement a "Quality Settings" toggle (Low/Medium/High) that adjusts shadow quality, texture resolution, and draw distances automatically based on device detection.
- **Draw Call Reduction:** Use texture atlases and object pooling for common elements (e.g., track segments, trees, particle effects).
- **Physics:** Use a lightweight physics engine (e.g., Cannon.js or the built-in engine of your chosen framework) to minimize CPU load on mobile devices.
- **Memory:** Regularly clear unused textures and cache during scene transitions to prevent browser memory overflows on iOS.

---

## 4. User Experience (UX) Considerations
- **Orientation:** Force **Landscape mode** for gameplay. Display a subtle "Rotate your device" overlay if the user is in portrait mode.
- **Loading:** Use a visual progress bar or an interactive loading screen to minimize user drop-off.
- **Audio:** Implement an audio manager that detects user interaction (browsers block audio until the first interaction) to play music and SFX.
- **PWA Readiness:** Configure the project as a **Progressive Web App (PWA)**. This allows users to "install" the game to their home screen, enabling offline access and a native-like experience.

---

## 5. Development Roadmap Summary
1. **Prototyping:** Build a single-track, single-car "race" loop using a placeholder model to test physics.
2. **Input Mapping:** Create a control abstraction layer that translates keyboard/touch to vehicle movement.
3. **Asset Pipeline:** Implement texture compression and model decimation to hit the <20MB limit.
4. **UI/UX:** Design a responsive HUD that scales based on screen resolution (Canvas resize events).
5. **Profiling:** Use Chrome DevTools (Memory/Performance tabs) to identify and fix bottlenecks on low-end Android devices.

---

## Note on Repository Conventions
This document captures the initial technical direction as provided. It diverges from this repository's established stack (vanilla JavaScript + HTML5 Canvas 2D, no external frameworks, no build step — see `REPO_STRUCTURE.md` in the repo root). Before implementation begins, a decision is needed on whether to:
- Adopt PlayCanvas/Babylon.js + WebGL for this game specifically (introducing the repo's first 3D/framework-based game), or
- Rework the spec around a 2.5D/top-down Canvas 2D approach consistent with the other games in `/games`.

Game mechanics (track design, win/loss conditions, scoring, opponent AI, visual style) are not yet defined and should be added once the technical direction above is confirmed.
