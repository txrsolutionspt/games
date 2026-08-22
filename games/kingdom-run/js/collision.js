// ── Collision system (see GAME_SPEC.md § Collision System, § World & Level Design) ──
//
// Tile collision uses the standard axis-separated sweep (move X, resolve X;
// move Y, resolve Y) rather than the spec's illustrative min-overlap check —
// min-overlap direction detection is well known to misclassify fast-moving
// or corner-case collisions. This sweep still reports the same TOP/BOTTOM/
// LEFT/RIGHT information the spec asks for, just via a more robust method.

const CollisionType = {
    SOLID: 0,          // blocks all movement
    ONE_WAY: 1,         // blocks from top only (falling onto it)
    HAZARD: 2,          // damages on touch, no physical blocking
    NON_COLLIDING: 3    // visual/open air only
};

// Tile ID -> collision type (Tile ID Reference in GAME_SPEC.md § Level Data Format)
const TILE_COLLISION_BY_ID = {
    0: CollisionType.NON_COLLIDING, // Air
    1: CollisionType.SOLID,          // Platform (floating, solid)
    2: CollisionType.SOLID,          // Ground
    3: CollisionType.SOLID,          // Brick (breakable — not interactive in MVP)
    4: CollisionType.SOLID,          // Question block
    5: CollisionType.HAZARD,         // Spike
    6: CollisionType.SOLID,          // Moving platform (not used in MVP)
    7: CollisionType.ONE_WAY         // One-way platform
};

function isCollidingAABB(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function getTileId(level, col, row) {
    if (row < 0 || row >= level.tilemap.length) return 0; // open air above/below the grid
    const rowArr = level.tilemap[row];
    if (col < 0 || col >= rowArr.length) return 2; // treat off the level's left/right edge as solid ground
    return rowArr[col];
}

function getTileType(level, col, row) {
    const id = getTileId(level, col, row);
    return TILE_COLLISION_BY_ID[id] ?? CollisionType.NON_COLLIDING;
}

function tileRect(col, row, tileSize) {
    return { x: col * tileSize, y: row * tileSize, width: tileSize, height: tileSize };
}

function colRange(rect, tileSize, level) {
    const c0 = Math.max(0, Math.floor(rect.x / tileSize));
    const c1 = Math.min(level.tilemap[0].length - 1, Math.floor((rect.x + rect.width - 0.01) / tileSize));
    return [c0, c1];
}
function rowRange(rect, tileSize) {
    const r0 = Math.floor(rect.y / tileSize);
    const r1 = Math.floor((rect.y + rect.height - 0.01) / tileSize);
    return [r0, r1];
}

// Moves `entity` ({x,y,width,height,vx,vy}) by its velocity against the
// level's tile grid, resolving solid/one-way collisions on each axis
// separately. Returns which sides collided plus the specific tiles hit
// (so callers can react to e.g. a question block bumped from below).
function resolveTileCollisions(entity, level) {
    const tileSize = level.tileSize;
    const prevBottom = entity.y + entity.height;

    let grounded = false;
    let hitCeiling = false;
    let hitWall = false;
    const groundedTiles = [];
    const ceilingTiles = [];

    // --- Horizontal sweep ---
    entity.x += entity.vx;
    if (entity.vx !== 0) {
        const dir = entity.vx > 0 ? 1 : -1;
        const [r0, r1] = rowRange(entity, tileSize);
        for (let row = r0; row <= r1; row++) {
            const [c0, c1] = colRange(entity, tileSize, level);
            for (let col = c0; col <= c1; col++) {
                if (getTileType(level, col, row) !== CollisionType.SOLID) continue;
                const rect = tileRect(col, row, tileSize);
                if (!isCollidingAABB(entity, rect)) continue;
                entity.x = dir > 0 ? rect.x - entity.width : rect.x + rect.width;
                entity.vx = 0;
                hitWall = true;
            }
        }
    }

    // --- Vertical sweep ---
    entity.y += entity.vy;
    if (entity.vy !== 0) {
        const dir = entity.vy > 0 ? 1 : -1;
        const [c0, c1] = colRange(entity, tileSize, level);
        for (let col = c0; col <= c1; col++) {
            const [r0, r1] = rowRange(entity, tileSize);
            for (let row = r0; row <= r1; row++) {
                const type = getTileType(level, col, row);
                const rect = tileRect(col, row, tileSize);
                const isOneWayLanding = type === CollisionType.ONE_WAY && dir > 0 && prevBottom <= rect.y + 0.5;
                if (type !== CollisionType.SOLID && !isOneWayLanding) continue;
                if (!isCollidingAABB(entity, rect)) continue;

                if (dir > 0) {
                    entity.y = rect.y - entity.height;
                    entity.vy = 0;
                    grounded = true;
                    groundedTiles.push({ col, row });
                } else if (type === CollisionType.SOLID) {
                    // One-way platforms never block from below.
                    entity.y = rect.y + rect.height;
                    entity.vy = 0;
                    hitCeiling = true;
                    ceilingTiles.push({ col, row });
                }
            }
        }
    }

    return { grounded, hitCeiling, hitWall, groundedTiles, ceilingTiles };
}

// Scans the tiles a rect currently overlaps for hazard tiles (e.g. spikes).
function isTouchingHazard(rect, level) {
    const [c0, c1] = colRange(rect, level.tileSize, level);
    const [r0, r1] = rowRange(rect, level.tileSize);
    for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
            if (getTileType(level, col, row) === CollisionType.HAZARD) {
                const rect2 = tileRect(col, row, level.tileSize);
                if (isCollidingAABB(rect, rect2)) return true;
            }
        }
    }
    return false;
}

window.CollisionType = CollisionType;
window.isCollidingAABB = isCollidingAABB;
window.getTileId = getTileId;
window.getTileType = getTileType;
window.resolveTileCollisions = resolveTileCollisions;
window.isTouchingHazard = isTouchingHazard;
