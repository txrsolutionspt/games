/**
 * Tower Defense Game - Version Information
 *
 * This file is automatically updated when commits are made.
 * It displays the version and git hash on the game screen.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: '2.3.0',

  // Git commit hash (short form)
  gitHash: 'f279898',

  // Full git commit hash
  gitHashFull: 'f279898d059ce597a90723cf9200c557bc74ca5f',

  // Release date (YYYY-MM-DD)
  releaseDate: '2026-07-08',

  // Build timestamp (ISO 8601)
  buildTime: '2026-07-08T18:08:08Z',

  // Changelog for this version
  changelog: `
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
