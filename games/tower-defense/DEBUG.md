# Tower Defense Game - Debugging Guide

## Running Tests

To run the test suite, open `test.html` in your browser:
- Path: `games/tower-defense/test.html`
- Tests verify all core functionality
- Results display in the console

**Test Coverage:**
- GameData structure (maps, towers, enemies, difficulties)
- GameState creation and difficulty effects
- Map waypoint and path generation
- Tower placement validation
- Enemy spawning with difficulty multipliers
- Wave queue generation
- DOM elements existence

## Enabling Debug Mode

To enable debug logging in the main game, open your browser's developer console and run:

```javascript
// Enable debug mode
window.DEBUG_MODE = true;
// Then reload the page
```

Or modify the game to start in debug mode by adding to index.html:
```html
<script>window.DEBUG_MODE = true;</script>
```

## Debug Output

When debug mode is enabled, the console will log:

**Tower Button Clicks:**
```
[TD] Tower button clicked {type: "archer"}
[TD] Tower selected {type: "archer", cost: 50}
```

**Canvas Clicks:**
```
[TD] onTap called {px: 150, py: 100, gameOverActive: false}
[TD] Grid cell {c: 3, r: 2, COLS: 10, ROWS: 8}
[TD] Attempting to place tower {selectedType: "archer", isPath: false, gold: 100, towerCount: 1}
[TD] Tower placed successfully {type: "archer"}
```

**Tower Placement Issues:**
```
[TD] No tower type selected
[TD] Attempting to place on path
[TD] Cell already occupied
[TD] Insufficient gold {need: 50, have: 30}
```

## Common Issues and Fixes

### Issue: "Tower button clicks don't register"

**Debug steps:**
1. Enable debug mode
2. Open Developer Tools (F12)
3. Click a tower button
4. Check console for `[TD] Tower button clicked` message

**If no message appears:**
- The tower button event listener isn't working
- Check that `gameState` is properly initialized
- Verify the `.tbtn` elements have `data-type` attributes

**If message appears but selection doesn't happen:**
- Check that `gameState.selectedType` is being set
- Verify `TOWER_DEFS[type]` exists for that type

### Issue: "Tower doesn't place on canvas"

**Debug steps:**
1. Enable debug mode
2. Select a tower (watch for `[TD] Tower selected` message)
3. Click on the canvas
4. Check for `[TD] Attempting to place tower` message

**Possible problems:**
- **"No tower type selected"**: Tower button wasn't actually selected
- **"Attempting to place on path"**: Clicked on the enemy path (valid tiles are non-path cells)
- **"Cell already occupied"**: Clicked on a cell that already has a tower
- **"Insufficient gold"**: Tower costs more than current gold

### Issue: "Canvas clicks don't register"

**Debug steps:**
1. Open Developer Tools
2. Check Network tab - make sure all files loaded
3. Add temporary listener:
```javascript
document.getElementById('gameCanvas').addEventListener('click', () => {
  console.log('Canvas clicked');
});
```

**If canvas clicks don't register:**
- Canvas may not have focus
- Canvas may be styled with `pointer-events: none`
- Modal overlay may be blocking clicks

## Checking Game State

To inspect current game state in browser console:

```javascript
// Check current game state
console.log(gameState);

// Check selected tower type
console.log('Selected:', gameState.selectedType);

// Check available gold
console.log('Gold:', gameState.gold);

// Check towers on map
console.log('Towers:', gameState.towers);

// Check path tiles
console.log('Path set size:', PATH_SET.size);

// Check waypoints
console.log('Waypoints:', WAYPOINTS.length);
```

## Verifying Map Data

To check if maps are loaded correctly:

```javascript
// Check all maps exist
console.log('Available maps:', Object.keys(MAPS));

// Check classic map
console.log('Classic path:', MAPS['classic'].pathTiles.length, 'tiles');

// Check map waypoints
const wp = createMapWaypoints('classic');
console.log('Classic waypoints:', wp.length);
```

## Testing Tower Placement Programmatically

In the browser console, you can test tower placement directly:

```javascript
// Start new game
startNewGame('normal', 'classic');

// Select archer tower
gameState.selectedType = 'archer';

// Try placing at grid position (2, 2)
const px = 2 * 40 + 20;  // grid cell to pixel
const py = 2 * 40 + 20;
onTap(px, py);

// Check if tower was placed
console.log('Towers:', gameState.towers);
```

## Testing Different Difficulties

```javascript
// Start easy game
startNewGame('easy', 'classic');
console.log('Easy: Gold =', gameState.gold, ', Lives =', gameState.lives);

// Start hard game
startNewGame('hard', 'classic');
console.log('Hard: Gold =', gameState.gold, ', Lives =', gameState.lives);
```

## Testing Save/Load

```javascript
// Save current game
GameStorage.saveGame(gameState);

// Check what was saved
console.log(JSON.parse(localStorage.getItem('td_game_save')));

// Load game
const loaded = GameStorage.loadGame();
console.log('Loaded:', loaded);

// Delete saved game
GameStorage.deleteGame();
```

## Performance Testing

To check performance during gameplay:

```javascript
// In console, run during a wave:
console.time('frame');
// (game runs)
console.timeEnd('frame');

// Or enable FPS counter:
let frameCount = 0;
let lastTime = performance.now();
const fpsInterval = 1000;

originalLoop = loop;
loop = function(ts) {
  frameCount++;
  if (ts - lastTime >= fpsInterval) {
    console.log('FPS:', frameCount);
    frameCount = 0;
    lastTime = ts;
  }
  originalLoop(ts);
};
```

## Browser Console Tips

**Show all game functions:**
```javascript
// List all game functions
Object.getOwnPropertyNames(window)
  .filter(name => typeof window[name] === 'function')
  .filter(name => name.includes('game') || name.includes('Game'))
  .sort()
```

**Monitor game state changes:**
```javascript
// Create a proxy to track state changes
const handler = {
  set(target, property, value) {
    console.log(`[STATE] ${property} = ${value}`);
    target[property] = value;
    return true;
  }
};
const proxy = new Proxy(gameState, handler);
```

**Export game state:**
```javascript
// Copy to clipboard
copy(JSON.stringify(gameState, null, 2));
```

## Reporting Issues

When reporting a bug, include:

1. **Debug output** from console when issue occurs
2. **Game state** at time of bug:
   ```javascript
   copy({
     gameState,
     selectedType: gameState.selectedType,
     towers: gameState.towers,
     pathSetSize: PATH_SET.size
   });
   ```
3. **Steps to reproduce** the issue
4. **Browser** and version
5. **Error messages** from console

## Quick Reference

| Feature | How to Test |
|---------|------------|
| Tower Selection | Click tower button → watch console for `[TD] Tower selected` |
| Tower Placement | Select tower → click canvas → check console for `[TD] Tower placed successfully` |
| Difficulty | Start game → select difficulty → check `gameState.gold` and `gameState.lives` |
| Save/Load | Complete wave → reload → resume modal appears |
| Maps | Settings → change map → path should change on canvas |
| Enemy Spawning | Start wave → check `gameState.enemies` in console |
| Path Validation | Try clicking path tiles → should see `[TD] Attempting to place on path` |
