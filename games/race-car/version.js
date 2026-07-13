/**
 * Apex Racer — Version Information
 *
 * Loaded by the page (script tag), the service worker (importScripts, which
 * derives its cache name from the version) and Node tests (require).
 * Update with ./update-version.sh X.Y.Z, then add a changelog entry.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '1.4.0',

  // Git commit hash (short form)
  gitHash: '48b08bd',

  // Full git commit hash
  gitHashFull: '48b08bd71224709901d0c759a45eafa6e90972f7',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-13',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-13T22:29:49Z',

  // Changelog for this version
  changelog: `
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
