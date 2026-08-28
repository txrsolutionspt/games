#!/bin/bash

# Little Farm School - Version Bump Script
#
# Auto-increments the PATCH number of APP_VERSION in js/version.js.
# No arguments, no prompts -- every run just bumps X.Y.Z -> X.Y.(Z+1), so
# it can be run as a routine step before every commit that touches
# release-facing files, the same way games/tower-defense's
# update-version.sh is (see games/farm/CLAUDE.md for the rule this backs).
#
# Usage: ./bump-version.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/js/version.js"

if [ ! -f "$VERSION_FILE" ]; then
    echo "Error: $VERSION_FILE not found"
    exit 1
fi

CURRENT=$(grep -o "APP_VERSION = '[^']*'" "$VERSION_FILE" | head -1 | cut -d"'" -f2)
if [ -z "$CURRENT" ]; then
    echo "Error: could not find APP_VERSION in $VERSION_FILE"
    exit 1
fi

MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

sed -i \
    -e "s/\(APP_VERSION = \)'[^']*';/\1'$NEW_VERSION';/" \
    "$VERSION_FILE"

echo "Version bumped: $CURRENT -> $NEW_VERSION"
