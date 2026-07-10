/**
 * Tower Defense Game - Version Information
 *
 * This file is automatically updated when commits are made.
 * It displays the version and git hash on the game screen.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '2.7.0',

  // Git commit hash (short form)
  gitHash: 'b9aa176',

  // Full git commit hash
  gitHashFull: 'b9aa176982c5c4ddca3a6fb96f0ab36ec7eeaea1',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-10',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-10T11:39:09Z',

  // Changelog for this version
  changelog: `
    v2.7.0 - Boss Variations
    - Boss waves (every 5th) now pick from 4 boss types instead of
      always the same one: Boss, Tank Boss (high hp, slow), Speedster
      Boss (fast, low hp), Splitter Boss (splits into 4 on death).
      Wave 5 always stays the classic Boss for a predictable first
      encounter
    - Every 10th wave is a "boss stage" with two different boss types
      at once
    - Boss waves get a gold announcement banner, and boss enemies get
      a dashed gold ring so they're visually distinct from regular
      enemies

    v2.6.0 - Wave Modifiers
    - Random per-wave buffs/debuffs: Bonus Gold (+50% gold), Double
      Speed (2x enemy speed), Tiny Swarm (half-size, faster), Giant
      Enemies (double size, double health)
    - Waves 1-2 and boss waves are always modifier-free; otherwise a
      40% chance per wave
    - Active modifier shown via a persistent HUD banner for the wave's
      duration

    v2.5.0 - Winter and Jungle Maps
    - Added two more maps: Winter Curve (icy-blue, smooth staircase
      path) and Jungle Maze (teal-green, tighter organic path)
    - Completes the roadmap's D1 map set: 6 maps total (Classic,
      Spiral, Serpent, Lava, Winter, Jungle)

    v2.4.0 - Lava Flow Map
    - Added a fourth map: Lava Flow, with a hot color palette and a
      tighter, more winding path than the existing three maps
    - Selectable from Settings alongside Classic, Spiral, and Serpent

    v2.3.1 - Fix: Save/Resume Broke Towers
    - Fixed a bug where resuming a saved game left towers unable to fire
      (and rendered as a solid white blob instead of their icon), because
      performance.now()-based timing fields were saved as absolute values
      from the previous session's clock and read as "in the future" after
      reload
    - Resume now re-baselines all saved timing fields to the new session's
      clock

    v2.3.0 - Tower Replace
    - Select a placed tower and tap a different tower-type button to swap
      it in place at level 1 (refunds the old tower, charges the new
      tower's cost, net cost = newCost - refund)
    - Downgrading to a cheaper tower nets a gold gain
    - Tower info panel now refreshes with up-to-date costs after an
      upgrade instead of going stale

    v2.2.0 - Feature Catch-up Release
    - Enemy variants: Armored (damage reduction, slow-immune), Splitter
      (splits into weaker enemies on death), Flying (ignores path, flies
      straight to the exit)
    - Tower upgrade system: 3 levels per tower with damage/range/fire-rate
      bonuses
    - Achievement system with milestone tracking and overlay notifications
    - Day/Dark color scheme setting for outdoor visibility
    - Note: this release catches up several features that shipped without
      a version bump (v2.1.0 -> v2.2.0 covers all of the above)

    v2.1.0 - Architecture Refactoring
    - Refactored monolithic gameState into 4 manager classes
    - Created EnemyManager, TowerManager, ProjectileManager, ParticleManager
    - Improved code organization and maintainability
    - 100% backward compatibility maintained
    - All game features preserved

    v2.0.0 - Phase 2 Performance Optimizations (Merged)
    - Enemy ID map (O(1) lookups) - 10-15% CPU reduction
    - Spatial grid for tower targeting - 30-50% CPU reduction
    - Comprehensive integration tests (17 tests)
    - Combined 40-65% CPU reduction on large waves
    - Full backward compatibility maintained

    v1.0.0 - Initial Release
    - Tower placement and tower types (Archer, Cannon, Frost, Laser)
    - Enemy types (Basic, Fast, Tank, Boss)
    - Wave system with difficulty levels
    - Save/load game functionality
    - Sound effects and particle effects
  `,

  // Get version string for display
  getVersionString() {
    return `v${this.version}`;
  },

  // Get full info string
  getFullInfo() {
    return `Tower Defense ${this.getVersionString()} (${this.gitHash})`;
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
