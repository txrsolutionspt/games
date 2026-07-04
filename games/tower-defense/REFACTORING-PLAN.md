# Tower Defense - Architecture Refactoring Plan

## Current State (Monolithic)
- Single `gameState` object with 100+ properties
- Update logic scattered across 10+ functions
- Difficult to test individual systems
- Hard to add new features without affecting others

## Target State (Manager-Based)
```
gameState {
  // High-level game state
  mapId, difficulty, gold, lives, waveNum, waveActive, gameOver,
  selectedType, selectedTower, spawnQueue, stats,
  
  // Managers (encapsulated subsystems)
  enemies: EnemyManager,
  towers: TowerManager,
  projectiles: ProjectileManager,
  particles: ParticleManager
}
```

## Refactoring Steps

### Phase 1: Preserve Current Functionality ✅ (Current)
- Keep all existing game logic working
- No visible changes to players
- Create manager infrastructure alongside existing code
- Test at each stage

### Phase 2: Migrate Enemy System
1. Create `EnemyManager` class
   - Manages enemies array, enemyMap, spatialGrid
   - Methods: spawn(), update(), remove(), getById(), getNearby()
2. Update `spawnEnemy()` to use manager
3. Update `updateEnemies()` to use manager
4. Update projectile targeting to use manager
5. Test: Large waves still work, targeting correct
6. Commit: Enemy manager migration

### Phase 3: Migrate Tower System
1. Create `TowerManager` class
   - Manages towers array
   - Methods: add(), update(), getTowersInRange()
2. Update tower placement to use manager
3. Update `updateTowers()` to use manager
4. Test: Tower placement works, targeting correct
5. Commit: Tower manager migration

### Phase 4: Migrate Projectile System
1. Create `ProjectileManager` class
   - Manages projectiles array
   - Methods: fire(), update(), remove()
2. Update `updateProjectiles()` to use manager
3. Update tower firing to use manager
4. Test: Projectiles fire and hit correctly
5. Commit: Projectile manager migration

### Phase 5: Migrate Particle System
1. Create `ParticleManager` class
   - Manages particles array
   - Methods: burst(), update()
2. Update particle effects to use manager
3. Test: Explosions and effects display correctly
4. Commit: Particle manager migration

### Phase 6: Final Cleanup
1. Remove deprecated direct access to properties
2. Update tests to use new API
3. Verify all game features work
4. Commit: Refactoring complete

## Testing Strategy

### After Each Migration:
1. Open game in browser
2. Play 2-3 waves to verify:
   - Towers place correctly
   - Enemies spawn and move
   - Projectiles fire and hit
   - Explosions display
   - Gold/lives update
3. Run integration tests: `test.integration.html`
4. Check browser console for errors

### Regression Tests:
- Large wave (100+ enemies) still performs well
- Many towers (30+) still target correctly
- Performance metrics from Phase 2 still hold

## Benefits of This Refactoring

1. **Encapsulation** - Each system manages its own data
2. **Testability** - Can test managers in isolation
3. **Maintainability** - Clear separation of concerns
4. **Extensibility** - Easier to add new features
5. **Performance** - Managers can optimize their own systems
6. **Collaboration** - Multiple developers can work on different managers

## Rollback Plan

If anything breaks:
1. Each phase is in a separate commit
2. Can revert to previous phase
3. Integration tests catch regressions
4. Browser testing validates gameplay

## Code Examples

### Before (Monolithic)
```javascript
gameState = {
  enemies: [],
  enemyMap: new Map(),
  spatialGrid: new Map(),
  towers: [],
  projectiles: [],
  particles: [],
  // ... 100+ more properties
};

function spawnEnemy(type) {
  const enemy = { /* ... */ };
  gameState.enemies.push(enemy);
  gameState.enemyMap.set(enemy.id, enemy);
}
```

### After (Manager-Based)
```javascript
class EnemyManager {
  enemies = [];
  enemyMap = new Map();
  spatialGrid = new Map();

  spawn(type) {
    const enemy = { /* ... */ };
    this.enemies.push(enemy);
    this.enemyMap.set(enemy.id, enemy);
    return enemy;
  }
}

gameState = {
  enemies: new EnemyManager(),
  towers: new TowerManager(),
  // ...
};

gameState.enemies.spawn('basic');
```

## Timeline
- Phase 1: Analysis (current)
- Phase 2: Enemy Manager (~1 hour)
- Phase 3: Tower Manager (~45 min)
- Phase 4: Projectile Manager (~45 min)
- Phase 5: Particle Manager (~30 min)
- Phase 6: Cleanup (~30 min)

**Total estimated time:** ~3 hours
**Risk level:** Low (incremental with tests)
