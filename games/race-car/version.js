/**
 * Apex Racer — Version Information
 *
 * Loaded by the page (script tag), the service worker (importScripts, which
 * derives its cache name from the version) and Node tests (require).
 * Update with ./update-version.sh X.Y.Z, then add a changelog entry.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '1.9.1',

  // Git commit hash (short form)
  gitHash: '7b9d684',

  // Full git commit hash
  gitHashFull: '7b9d684960e4049e8b9e35e072afa182cab16c94',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-15',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-15T20:34:57Z',

  // Changelog for this version
  changelog: `
    v1.9.1 - Checkpoint Fairness
    - Fixed constantly failing laps: the checkpoint window was so strict
      that running ~9 m wide (half a car onto the grass) while passing a
      gate silently invalidated the whole lap
    - The lateral window is now forgiving (kerbs, shoulders and small
      slides count); only genuine corner cuts miss a gate
    - Missing a gate now warns IMMEDIATELY ("CHECKPOINT N MISSED - turn
      back!") instead of only when you reach the finish line, and the
      missed gate stays highlighted amber behind you
    - Slightly wider along-track capture for slow devices

    v1.9.0 - Visible Checkpoints
    - Checkpoint gates are now visible on every track: pylons at the
      road edges with a beam and chevron plate overhead at each of the
      12 checkpoints
    - The NEXT gate you must pass glows pulsing amber; the rest stay a
      dim translucent blue so the course reads without clutter
    - The minimap marks the next checkpoint with an amber ring
    - Highlighting follows your progression (and hides in menus and
      replays); missing a gate still shows the CHECKPOINT MISSED warning

    v1.8.0 - Two New Tracks: Speedbowl & The Dragway
    - SPEEDBOWL: a stadium oval at dusk - two long straights, two
      sweeping turns and a continuous speedway wall around the outside
    - THE DRAGWAY: a dead-straight kilometer sprint, walled on both
      sides; a single run instead of laps - launch and hold on
    - Point-to-point track support throughout the engine: open
      centerlines, start AND finish gantries, straight-line minimap,
      two-wide drag grids in Race mode, drag-aware AI and replays
    - Per-track medal targets calibrated against measured runs (a
      perfect Dragway pass is ~29.9 s; gold means a near-perfect launch)

    v1.7.0 - Handling & Controls: Gamepad, Smooth Pedals, Counter-Steer
    - Gamepad support: analog stick steering (with deadzone + response
      curve), trigger throttle/brake, A = confirm, B = reset,
      Start = pause; works alongside keyboard/touch
    - Smooth pedal response (default ON): keyboard and touch gas/brake
      ease in like real pedals instead of snapping to 100%, taking the
      remaining snap out of corner exits; INSTANT option for purists
    - Counter-steer assist (default ON): automatic opposite-lock
      proportional to body sideslip - slides get caught the way a
      skilled driver would, instead of spinning
    - Both new options join the DRIVING settings screen; AI opponents
      and benchmarks remain unaffected

    v1.6.0 - Driving Settings & Assists
    - New DRIVING settings screen on the menu to calibrate how the car
      feels; all options persist and apply instantly
    - Traction control (default ON): stops full keyboard throttle from
      spinning the rear tires out of slow corners - the main cause of
      the car feeling like it "drifts a lot"
    - Stability assist (default ON): catches the tail when a slide
      starts instead of letting it snap around
    - Handling presets: GRIP (planted), NORMAL (balanced) and DRIFT
      (loose tail, for sliding on purpose)
    - Steering response: RELAXED / STANDARD / SHARP
    - AI opponents and lap-time benchmarks are unaffected - assists
      tune only the player's car

    v1.5.0 - Cinematic Replay Viewer
    - Watch your best run back: a WATCH REPLAY button appears on the
      menu once a personal best is saved for the current track
    - Automatic TV-style camera direction: trackside corner cameras
      (placed at the circuit's apexes), chase cam and aerial drone
      shots, cutting between them as the car goes around
    - Replay controls: pause/resume (Space), 1x/2x speed, EXIT (Esc);
      the replay loops until you leave
    - Replays are the ghost recordings - no extra storage needed

    v1.4.0 - Race Options: AI Difficulty & Field Size
    - AI difficulty selector (EASY / MEDIUM / HARD): scales every rival's
      cornering, top speed and braking together; MEDIUM matches v1.3
    - Field size selector (RIVALS: 3 or 5): two new drivers join the
      roster - NOVA (purple) and FROST (cyan) - for six-car races
    - Both options live on the menu (shown only in RACE mode), persist
      across sessions, and accept ?difficulty= / ?rivals= URL params
    - Position HUD, standings and results scale to the chosen field

    v1.3.0 - Race Mode: AI Opponents
    - New RACE mode (menu MODE button): race wheel-to-wheel against three
      AI opponents - VIPER, BLAZE and MOSS - each with its own skill
      profile, racing line and car colour
    - Standing grid start, live position indicator (P1-P4) in the HUD,
      opponents shown on the minimap, finishing-order results screen
    - Arcade car-to-car contact: cars bump and trade momentum instead of
      passing through each other
    - AI auto-recovery if wedged; finished AI take a cool-down lap
    - Time-trial purity kept: PBs, ghosts, medals and checkpoint deltas
      are only recorded/shown in TIME TRIAL mode

    v1.2.0 - Sector Timing, Medals & Race Stats
    - Sector timing: each lap splits into 3 sectors; sector times flash
      in the HUD (purple = all-time best, green = best of this race) and
      all-time sector bests persist per track
    - Medals: gold/silver/bronze target times per track (scaled by lap
      count); earned medal shown on the finish screen with the next
      target to chase, and targets listed on the menu
    - Post-race driving stats: top speed, time off track, drift time,
      resets used, and lap consistency spread

    v1.1.0 - Ghost Replay, Second Track & Minimap
    - Ghost replay: your best run is recorded and plays back as a
      translucent ghost car on later attempts (GHOST: ON/OFF in the menu)
    - New track: COASTAL RING - a faster, flowing circuit with its own
      scenery palette, selectable from the menu (TRACK button)
    - Per-track best times, splits and ghosts; existing v1.0.0 personal
      bests are migrated to the Apex GP track automatically
    - Minimap during races: track outline, start line, your car and the
      ghost's live position

    v1.0.0 - Initial Release
    - Solo time trial: one procedural circuit, 3 laps, checkpoint-validated
      lap timing with course-cut and wrong-way detection
    - Semi-sim vehicle physics: slip-angle tires, load transfer, friction
      circle, speed-sensitive steering, RWD
    - Babylon.js low-poly 3D scene with kerbs, barriers, chase camera and
      LOW/MED/HIGH quality tiers
    - Desktop keyboard + mobile touch controls (steering slider, pedals)
    - Best times and split deltas persisted in localStorage
    - Procedural Web Audio (engine, tire screech, beeps, jingles)
    - Installable PWA with offline cache
  `,

  // Get version string for display
  getVersionString() {
    return `v${this.version}`;
  },

  // Get full info string
  getFullInfo() {
    return `Apex Racer ${this.getVersionString()} (${this.gitHash})`;
  },

  // Get detailed info
  getDetailedInfo() {
    return `v${this.version} | Commit: ${this.gitHashFull} | Date: ${this.releaseDate}`;
  }
};

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VERSION_INFO;
}
