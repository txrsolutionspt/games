/**
 * Apex Racer — Version Information
 *
 * Loaded by the page (script tag), the service worker (importScripts, which
 * derives its cache name from the version) and Node tests (require).
 * Update with ./update-version.sh X.Y.Z, then add a changelog entry.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '1.13.2',

  // Git commit hash (short form)
  gitHash: '479e2e4',

  // Full git commit hash
  gitHashFull: '479e2e4dc3a2609cda013a7b3c54e3a369671311',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-20',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-20T19:50:34Z',

  // Changelog for this version
  changelog: `
    v1.13.2 - Draggable Vertical Gas/Brake Slider
    - New optional control mode for gas and brake on touch devices: a
      vertical slider on the right side of the screen (like the steering
      slider but for throttle/brake)
    - Drag up for gas (0 to 1), drag down for brake (0 to -1), middle is
      neutral - the knob auto-returns to center when released
    - New PEDALS menu button to toggle between BUTTONS (traditional pedals)
      and SLIDER (draggable vertical slider) modes - choice is remembered
    - Slider is 32px wide with a prominent 48px knob for easy targeting on
      touch screens; all existing control methods (keyboard, gamepad, buttons)
      work simultaneously with the slider
    - Useful for touch devices where dragging gives more natural throttle
      feel than tapping buttons

    v1.13.1 - Scroll Wheel Gas & Brake Control (reverted)
    v1.13.0 - Proper Finish-Line Crossing & Full Race Results
    - The finish line now only counts when the car actually CROSSES it:
      previously a lap (and the race) could complete up to 9 m BEFORE
      the line thanks to the forgiving checkpoint window - the results
      screen appeared with the car still short of the flag
    - After you take the flag the race no longer freezes instantly:
      the car eases off and rolls on past the line while the AI field
      keeps racing for up to 5 more seconds, then the results appear
      (press Space/Enter/A to skip the roll; ends early once every
      rival has finished)
    - Race-mode results now fill in EVERY driver's time: rivals still
      out on track keep racing behind the results screen and their
      "running" rows update to real times as they cross the line
    - New regression tests: the finish must not register while short
      of the line, and must register right after crossing

    v1.12.0 - Tilt Steering
    - New CONTROLS button on the menu (phones/tablets): switch between
      SLIDER (the on-screen steering slider) and TILT (steer by tilting
      the phone like a steering wheel)
    - Tilt mode shows an on-screen steering wheel that rotates with
      your phone and the car's steering
    - Works in both landscape directions; small 4-degree deadzone so
      the car drives straight when the phone is roughly level, full
      lock at about 30 degrees of tilt
    - iPhone/iPad: the first switch to TILT asks for motion-sensor
      permission (required by iOS)
    - Gas/brake pedals stay the same in both modes; the choice is
      remembered between sessions

    v1.11.0 - Fullscreen
    - The game now goes fullscreen when a race starts (no more browser
      URL bar during play); FULLSCREEN: ON/OFF on the menu, F toggles
      any time, Esc leaves fullscreen as usual
    - Locks to landscape orientation on mobile where the browser
      allows it
    - Note for iPhone/iPad: Safari doesn't allow web-page fullscreen -
      use "Add to Home Screen" to install the game, which launches
      fullscreen via the PWA manifest

    v1.10.1 - Fix: False "Checkpoint Missed" at Every Lap Crossing
    - Fixed the warning that appeared at the finish line even though
      every checkpoint had registered (all green CP chips): right after
      a legitimate lap completion the car is still inside the line
      region while the "next gate" has already advanced to the new
      lap's first checkpoint, which the old logic misread as a cut
    - The line-region warning now only fires while APPROACHING the
      line with checkpoints actually missing, and is suppressed for a
      few seconds after every real lap completion
    - Laps were counting correctly all along - the warning was wrong,
      not the lap validation
    - New regression test: a perfect 3-lap run must produce ZERO
      missed-checkpoint warnings (it produced 2 before this fix)

    v1.10.0 - Checkpoint Split Times
    - Every checkpoint you pass now confirms itself in the HUD: a green
      "CP 5/12 [check] 8.42" chip showing which gate registered and the
      time since the previous one, plus a soft confirmation tick sound
    - Makes gate registration visible at a glance - if the chip doesn't
      appear at a gate, that gate did not register
    - (Includes the v1.9.2 wrong-leg tracking fix below - check the
      version number on the menu says v1.10.0 to be sure you have it)

    v1.9.2 - Checkpoint Fix: Track-Position Tracking
    - Fixed the remaining cause of failed checkpoints: where two parts
      of a track pass close together (the Apex GP hairpin, Coastal
      Ring's final kink), the game could briefly track your position
      against the WRONG piece of road - silently blocking checkpoint
      registration and sometimes flashing false wrong-way warnings
    - Position tracking now weighs continuity and your heading, so the
      other leg of a hairpin (pointing the opposite way) can no longer
      steal the projection
    - Wrong-way detection ignores physically impossible position jumps
    - New regression test sweeps every track at every gate-valid width
      and proves track position can never jump or falsely trip wrong-way

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
