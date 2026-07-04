#!/bin/bash

# Tower Defense Game - Version Update Script
# Updates version.js with current git information
# Usage: ./update-version.sh [version-number]
# Example: ./update-version.sh 2.1.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/version.js"

# Get current git info
GIT_HASH_SHORT=$(git rev-parse --short HEAD)
GIT_HASH_FULL=$(git rev-parse HEAD)
RELEASE_DATE=$(date +%Y-%m-%d)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Get version from argument or ask user
if [ -z "$1" ]; then
    echo "Current version: $(grep -o "version: '[^']*'" "$VERSION_FILE" | cut -d"'" -f2)"
    read -p "Enter new version (e.g., 2.2.0): " NEW_VERSION
    if [ -z "$NEW_VERSION" ]; then
        echo "Error: Version required"
        exit 1
    fi
else
    NEW_VERSION="$1"
fi

# Validate version format (basic check for X.Y.Z)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in format X.Y.Z (e.g., 2.1.0)"
    exit 1
fi

# Create updated version.js
cat > "$VERSION_FILE" << 'VERSIONEOF'
/**
 * Tower Defense Game - Version Information
 *
 * This file is automatically updated when commits are made.
 * It displays the version and git hash on the game screen.
 */

const VERSION_INFO = {
  // Semantic version (MAJOR.MINOR.PATCH)
  version: 'PLACEHOLDER_VERSION',

  // Git commit hash (short form)
  gitHash: 'PLACEHOLDER_GIT_SHORT',

  // Full git commit hash
  gitHashFull: 'PLACEHOLDER_GIT_FULL',

  // Release date (YYYY-MM-DD)
  releaseDate: 'PLACEHOLDER_DATE',

  // Build timestamp (ISO 8601)
  buildTime: 'PLACEHOLDER_BUILD_TIME',

  // Changelog for this version
  changelog: `
    v2.1.0 - Architecture Refactoring
    - Refactored monolithic gameState into 4 manager classes
    - Created EnemyManager, TowerManager, ProjectileManager, ParticleManager
    - Improved code organization and maintainability
    - 100% backward compatibility maintained
    - All game features preserved

    v2.0.0 - Phase 2 Performance Optimizations
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
VERSIONEOF

# Replace placeholders
sed -i "s/PLACEHOLDER_VERSION/$NEW_VERSION/g" "$VERSION_FILE"
sed -i "s/PLACEHOLDER_GIT_SHORT/$GIT_HASH_SHORT/g" "$VERSION_FILE"
sed -i "s/PLACEHOLDER_GIT_FULL/$GIT_HASH_FULL/g" "$VERSION_FILE"
sed -i "s/PLACEHOLDER_DATE/$RELEASE_DATE/g" "$VERSION_FILE"
sed -i "s/PLACEHOLDER_BUILD_TIME/$BUILD_TIME/g" "$VERSION_FILE"

echo "✅ Version updated to $NEW_VERSION"
echo "   Git hash: $GIT_HASH_SHORT ($GIT_HASH_FULL)"
echo "   Date: $RELEASE_DATE"
echo ""
echo "Remember to:"
echo "  1. Update CHANGELOG in version.js if needed"
echo "  2. Commit the changes: git add version.js && git commit -m 'Release v$NEW_VERSION'"
echo "  3. Push to remote: git push"
