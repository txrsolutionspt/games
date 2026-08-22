// ── Enemies (see GAME_SPEC.md § Enemies) ──
//
// MVP ships the Basic Walker only — Flying and Patrol enemy types are listed
// as post-MVP enhancements in GAME_SPEC.md § Minimum Viable Product.

function createWalkerEnemy(def) {
    return {
        type: 'walker',
        x: def.x,
        y: def.y,
        x1: def.x1,
        x2: def.x2,
        speed: def.speed,
        width: 26,
        height: 26,
        dir: 1,
        alive: true
    };
}

function updateWalkerEnemy(enemy) {
    if (!enemy.alive) return;
    enemy.x += enemy.speed * enemy.dir;
    if (enemy.x <= enemy.x1) {
        enemy.x = enemy.x1;
        enemy.dir = 1;
    } else if (enemy.x + enemy.width >= enemy.x2) {
        enemy.x = enemy.x2 - enemy.width;
        enemy.dir = -1;
    }
}

window.createWalkerEnemy = createWalkerEnemy;
window.updateWalkerEnemy = updateWalkerEnemy;
