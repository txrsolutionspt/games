#!/bin/bash

# Tower Defense Game - Version Update Script
# Updates the version, git hash, release date, and build time fields in
# version.js in place. Everything else in the file -- most importantly the
# changelog -- is left untouched, so past entries never get clobbered.
# Usage: ./update-version.sh [version-number]
# Example: ./update-version.sh 2.2.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/version.js"

if [ ! -f "$VERSION_FILE" ]; then
    echo "Error: $VERSION_FILE not found"
    exit 1
fi

# Get current git info
GIT_HASH_SHORT=$(git rev-parse --short HEAD)
GIT_HASH_FULL=$(git rev-parse HEAD)
RELEASE_DATE=$(date +%Y-%m-%d)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Get version from argument or ask user
if [ -z "$1" ]; then
    echo "Current version: $(grep -o "version: '[^']*'" "$VERSION_FILE" | head -1 | cut -d"'" -f2)"
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

# Update only the metadata fields, in place. Each pattern is anchored to the
# start of the line (after leading whitespace) so it can only match its own
# "key: 'value'," declaration inside the VERSION_INFO object -- never text
# inside the changelog template literal.
sed -i \
    -e "s/^\(\s*version: \)'[^']*',/\1'$NEW_VERSION',/" \
    -e "s/^\(\s*gitHash: \)'[^']*',/\1'$GIT_HASH_SHORT',/" \
    -e "s/^\(\s*gitHashFull: \)'[^']*',/\1'$GIT_HASH_FULL',/" \
    -e "s/^\(\s*releaseDate: \)'[^']*',/\1'$RELEASE_DATE',/" \
    -e "s/^\(\s*buildTime: \).*/\1'$BUILD_TIME',/" \
    "$VERSION_FILE"

echo "✅ Version updated to $NEW_VERSION"
echo "   Git hash: $GIT_HASH_SHORT ($GIT_HASH_FULL)"
echo "   Date: $RELEASE_DATE"
echo ""
echo "The changelog was left untouched. Remember to:"
echo "  1. Add a changelog entry for v$NEW_VERSION at the top of the changelog in version.js"
echo "  2. Commit the changes: git add version.js && git commit -m 'Release v$NEW_VERSION'"
echo "  3. Push to remote: git push"
