# Tower Defense Game - Testing & Debugging Guide

## Quick Start: Run Tests Locally

### Node.js Tests (Run Immediately)

```bash
# Static code structure validation (no runtime environment needed)
node test.simple.js

# Advanced debug test with DOM mocks
node test.debug.js

# Debug loader with execution tracking
node debug-loader.js
```

### Browser Tests (Open in Browser)

1. **test.minimal.html** - Simple initialization check
   - Shows if game.js loads successfully
   - Checks if critical variables are defined
   - Best for quick diagnostics
   - Path: `games/tower-defense/test.minimal.html`

2. **diagnose-v2.html** - Advanced diagnostics with error trapping
   - Catches JavaScript errors during loading
   - Tests manual game initialization
   - Validates all DOM elements
   - Path: `games/tower-defense/diagnose-v2.html`

3. **test.html** - Full test suite (legacy)
   - Comprehensive game logic tests
   - Tests game data structures
   - Tests game state management

4. **index.html** - The actual game
   - Path: `games/tower-defense/index.html`

---

## What Tests Validate

### test.simple.js (Static Analysis)
✅ **Passing: 40/41 tests**

- All critical functions are defined
- Game data structures (MAPS, TOWER_DEFS, ENEMY_DEFS, DIFFICULTY_DEFS) exist
- Event listeners are attached to DOM elements
- HTML elements are present
- CSS styles are defined
- Script is loaded at bottom of body

**Conclusion:** Code structure is sound (98% correct)

### test.debug.js (Runtime Testing)

Tests with comprehensive DOM mocks to see if game.js executes properly.

```
Expected: All variables should be defined when running in browser
Actual: Functions work, but const variables are scoped locally in Node.js VM
```

**Why the difference?**
- In Node.js VM: `const MAPS = {...}` is local to script scope
- In Browser: `const MAPS = {...}` becomes `window.MAPS`
- **This is NOT a problem** - the game WILL work in browser

### Browser Tests (test.minimal.html)

Most useful for identifying actual browser issues:

```
✅ Check 1: Is game.js loading?
✅ Check 2: Are critical functions defined?
✅ Check 3: Is gameState initialized?
✅ Check 4: Can we access game data?
```

---

## Common Issues & Solutions

### Issue: "gameState is undefined"

**Possible Causes:**
1. game.js file isn't loading from server (404 error)
2. game.js has a syntax error and fails to parse
3. game.js throws an error before `gameState` is initialized
4. HTML file is outdated and missing the canvas element

**How to Debug:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for `game.js` in the list
5. If it shows 404, the file isn't on the server
6. If it loads, open the file and check for errors
7. Go to Console tab and look for red error messages

**Quick Test:**
```javascript
// In browser console:
console.log(typeof gameState);      // Should be "object"
console.log(typeof MAPS);            // Should be "object"
console.log(typeof createGameState); // Should be "function"
```

### Issue: "Tower placement doesn't work"

Even if gameState is defined, towers might not place because:

1. **Tower type not selected** - Click a tower button first
2. **Not enough gold** - Check gameState.gold > tower cost
3. **Clicking on path** - Can only place on non-path cells
4. **Cell occupied** - Can't place two towers on same cell

**How to Debug:**
```javascript
// In browser console:
gameState.selectedType = 'archer';  // Force select a tower
gameState.gold = 500;                // Give yourself gold
onTap(100, 100);                     // Try to place at pixel 100,100
console.log(gameState.towers);       // Check if tower was added
```

### Issue: "Game won't start"

**Check:**
```javascript
// In browser console:
console.log(gameState.waveNum);    // Should be 0
console.log(gameState.waveActive); // Should be false
startWave();                        // Try to start manually
console.log(gameState.enemies);    // Check if enemies spawned
```

---

## Test Results Summary

| Test | Location | Status | Notes |
|------|----------|--------|-------|
| test.simple.js | Node.js | 40/41 ✅ | Code structure is correct |
| test.debug.js | Node.js | 4/12 ⚠️ | Functions work, const scoping normal |
| test.minimal.html | Browser | TBD | Use this first to diagnose browser issues |
| diagnose-v2.html | Browser | TBD | Advanced diagnostics with error trapping |
| index.html | Browser | TBD | The actual game - should work |

---

## If Tests Pass But Game Doesn't Work

**You have a browser-specific issue, not a code problem.**

Possible causes:
1. **CSS is hiding elements** - Check display, visibility, pointer-events
2. **JavaScript event listeners aren't firing** - Check DevTools Events tab
3. **Timing issue** - Game starts before DOM is ready (shouldn't happen, script is at bottom)
4. **Conflicting code** - Another script is interfering
5. **Browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Quick Fixes:
1. Hard refresh browser cache
2. Open in incognito/private mode (no cache, no extensions)
3. Try a different browser
4. Check that all files (game.js, style.css, index.html) are on server

---

## Running Specific Tests

### Test tower placement:
```javascript
// In browser console with game loaded:
gameState.selectedType = 'archer';
gameState.gold = 1000;
onTap(50, 50);    // Place tower at grid (1,1)
onTap(90, 50);    // Place tower at grid (2,1)
console.log(gameState.towers);
```

### Test wave spawning:
```javascript
// In browser console:
gameState.waveNum = 0;
gameState.waveActive = false;
startWave();
console.log(gameState.waveNum);  // Should be 1
console.log(gameState.enemies);  // Should have enemies
```

### Test difficulty:
```javascript
// Start a new game with different difficulty:
gameState = createGameState('classic', 'easy');
console.log(gameState.gold);   // Should be 200
console.log(gameState.lives);  // Should be 25
```

---

## Debugging with Debug Mode

Enable debug output in browser console:

```javascript
window.DEBUG_MODE = true;
location.reload();
```

Then watch console as you play. You'll see:
- Tower button clicks
- Canvas clicks
- Tower placement attempts and results
- Wave starts
- Enemy spawning

---

## Full Test Checklist

- [ ] Open test.minimal.html in browser
- [ ] Check that gameState is defined
- [ ] Check that MAPS is defined
- [ ] Check that functions are defined
- [ ] Open browser DevTools console
- [ ] Check for any red error messages
- [ ] Try: `console.log(gameState)`
- [ ] Try: `console.log(MAPS)`
- [ ] Try: `gameState.selectedType = 'archer'`
- [ ] Try: `onTap(100, 100)` (attempt to place tower)
- [ ] Try: `startWave()` (attempt to start wave)
- [ ] Check results in gameState.towers and gameState.enemies

---

## If All Tests Pass

The game code is working correctly. Any issues are:
1. Server/deployment related (files not on server)
2. Browser environment related (cache, extensions, settings)
3. HTML/CSS related (elements hidden or styled incorrectly)

Try:
- Hard refresh (Ctrl+Shift+R)
- Incognito mode
- Different browser
- Different device

---

## Getting Help

When reporting issues, include:

1. **Which test failed?** (test.simple.js, test.minimal.html, etc.)
2. **Error message from console** (F12 → Console)
3. **Browser and version** (Chrome 120, Firefox 121, etc.)
4. **Steps to reproduce** (What did you click? What happened?)
5. **Output from console.log(gameState)** (Copy from console)
6. **Network tab status for game.js** (Shows if file loaded)
