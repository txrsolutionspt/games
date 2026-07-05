# Tower Defense - Version System Documentation

## Overview

The Tower Defense game now includes a built-in version tracking system that displays the current version and git commit hash at the bottom-right of the screen. This makes it easy to identify which version is running in production and trace any issues back to specific commits.

## What's Displayed

**On Screen (Bottom-Right Corner):**
```
v2.1.0
d277c96
```

**On Hover (Tooltip):**
```
v2.1.0 | Commit: d277c96ab6d13696c34b2daf4b4245a973d4de88 | Date: 2026-07-04
```

## Files

### `version.js`
Contains version information in a `VERSION_INFO` object:
- `version` - Semantic version (e.g., "2.1.0")
- `gitHash` - Short git commit hash (e.g., "d277c96")
- `gitHashFull` - Full git commit hash
- `releaseDate` - Date of release (YYYY-MM-DD)
- `buildTime` - Exact build timestamp (ISO 8601)
- `changelog` - Version history and notes

### `update-version.sh`
Automated script to update version information:
- Retrieves current git hash and date
- Updates all fields in version.js
- Simple one-command workflow

## How It Works

1. **Version Display** - Game automatically displays version at bottom-right
2. **Git Integration** - Short hash helps identify exact commit deployed
3. **Hover Tooltip** - Full commit hash and timestamp for debugging
4. **Production Ready** - Zero build process, no dependencies needed

## Usage

### Updating Version After Changes

```bash
# Navigate to game directory
cd games/tower-defense

# Update to new version
./update-version.sh 2.2.0

# This will:
# 1. Get current git hash
# 2. Get current date
# 3. Update version.js with new information
# 4. Show confirmation message
```

### Manual Update (if script doesn't work)

Edit `version.js` and update these fields:
```javascript
const VERSION_INFO = {
  version: '2.2.0',
  gitHash: 'abc1234',
  gitHashFull: 'abc1234567890...',
  releaseDate: '2026-07-05',
  buildTime: new Date().toISOString(),
  // ... rest of file
};
```

### Git Workflow

```bash
# Make your changes
git add games/tower-defense/*.js

# Commit your changes
git commit -m "Your commit message"

# Update version (gets latest commit hash)
./update-version.sh 2.2.0

# Commit version update
git add version.js
git commit -m "Release v2.2.0"

# Push to production
git push origin main
```

## Version Format

Uses **Semantic Versioning** (MAJOR.MINOR.PATCH):
- `2.1.0` - Major, minor, patch version
- `2` - Major version (breaking changes)
- `1` - Minor version (new features)
- `0` - Patch version (bug fixes)

Examples:
- `1.0.0` - Initial release
- `1.1.0` - New feature added
- `1.1.1` - Bug fix
- `2.0.0` - Major rewrite or breaking changes

## Git Hash Tracking

The short git hash (e.g., `d277c96`) uniquely identifies a commit:
- First 7 characters of the full 40-character SHA-1 hash
- Practically unique (collision extremely rare)
- Easy to reference in issue trackers
- Quickly identify which code is running

### Finding Commit Info

```bash
# Show version and date
git log -1 --format="%h %ad" --date=short

# Show full hash
git log -1 --format="%H"

# Show commit details
git show d277c96
```

## Display Styling

The version display:
- **Position:** Fixed bottom-right corner (8px margin)
- **Font:** Monospace, very small (0.65rem)
- **Color:** Dim gray (#606080) - non-intrusive
- **Opacity:** 70% background with dark theme
- **Hover:** Brightens on hover for visibility
- **Z-index:** Above all game elements
- **Tooltip:** Shows full details on hover

## Changelog

Keep changelog in `version.js` organized by version:

```javascript
changelog: `
  v2.2.0 - New Features
  - Added feature X
  - Improved Y
  
  v2.1.0 - Architecture Refactoring
  - Refactored into managers
  
  v2.0.0 - Performance Optimizations
  - Enemy ID map optimization
  - Spatial grid optimization
`
```

## Production Deployment

1. **Before deploying:**
   ```bash
   ./update-version.sh X.Y.Z
   git commit -m "Release vX.Y.Z"
   git push
   ```

2. **After deploying:**
   - Load game in browser
   - Version visible at bottom-right
   - Hover to see full commit info
   - Share version number in release notes

3. **Debugging production issues:**
   - Note version displayed in game
   - Use git hash to checkout exact code: `git checkout d277c96`
   - Compare with previous versions using changelog

## Troubleshooting

### Version shows "Unknown"
- Check `version.js` is loaded before `game.js`
- Check browser console for errors
- Verify `version.js` is in same directory as `game.js`

### Git hash is wrong
- Run `./update-version.sh VERSION` again
- Check you're in the correct repository directory
- Verify git is installed: `git --version`

### Version not displaying
- Refresh page (Ctrl+F5 or Cmd+Shift+R)
- Check browser DevTools console for errors
- Verify element `#version-display` exists in HTML

## Benefits

✅ **Production Identification** - Know exactly which version is running  
✅ **Debugging** - Git hash traces issues to specific commits  
✅ **User Communication** - Share version numbers in release notes  
✅ **Zero Overhead** - No build process, no extra dependencies  
✅ **Automatic** - Script handles all updates  
✅ **Traceable** - Complete audit trail via git history  

## Example Version History

```
v2.1.0 (d277c96)     - Architecture refactoring, manager classes
v2.0.0 (1c735fa)     - Phase 2 optimizations, spatial grid
v1.0.0 (614e403)     - Initial release, core game
```

## Related Files

- `version.js` - Version information
- `update-version.sh` - Version update script
- `REFACTORING-PROGRESS.md` - Refactoring changelog
- `OPTIMIZATION-ROADMAP.md` - Feature roadmap
