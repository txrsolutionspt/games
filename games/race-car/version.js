/**
 * Apex Racer — Version Information
 *
 * Loaded by the page (script tag), the service worker (importScripts, which
 * derives its cache name from the version) and Node tests (require).
 * Update with ./update-version.sh X.Y.Z, then add a changelog entry.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '1.0.0',

  // Git commit hash (short form)
  gitHash: 'c1af611',

  // Full git commit hash
  gitHashFull: 'c1af611ced66da7f6b7ce5844ffcdcbf09cc82b8',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-12',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-12T17:32:02Z',

  // Changelog for this version
  changelog: `
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
