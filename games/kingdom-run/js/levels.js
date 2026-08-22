// ── Level loading (see GAME_SPEC.md § Level Data Format) ──
//
// Level JSON files are static assets shipped with the game (read-only) — see
// GAME_SPEC.md § Data Persistence & Local Storage for the distinction between
// this and the player's localStorage save data.

const COIN_SIZE = 16;

function questionBlockKey(col, row) {
    return `${col},${row}`;
}

async function loadLevel(id) {
    const response = await fetch(`levels/level-${id}.json`);
    if (!response.ok) throw new Error(`Failed to load level ${id}: HTTP ${response.status}`);
    const data = await response.json();
    const raw = data.level;

    const questionBlocks = new Map();
    for (const qb of raw.entities.questionBlocks || []) {
        questionBlocks.set(questionBlockKey(qb.col, qb.row), { ...qb, consumed: false });
    }

    const coins = (raw.entities.coins || []).map((c) => ({
        x: c.x - COIN_SIZE / 2,
        y: c.y - COIN_SIZE / 2,
        width: COIN_SIZE,
        height: COIN_SIZE,
        collected: false
    }));

    const enemies = (raw.entities.enemies || [])
        .filter((e) => e.type === 'walker')
        .map(createWalkerEnemy);

    const checkpoints = (raw.checkpoints || []).map((cp) => ({ ...cp, reached: false }));

    return {
        id: raw.id,
        name: raw.name,
        width: raw.width,
        height: raw.height,
        tileSize: raw.tileSize,
        backgroundColor: raw.backgroundColor,
        spawnPoint: raw.spawnPoint,
        goal: raw.goal,
        tilemap: raw.tilemap,
        checkpoints,
        enemies,
        coins,
        totalCoins: coins.length,
        questionBlocks
    };
}

// Called when the player bumps a question-block tile from below. Clears the
// tile to air (per spec: "Block becomes empty") and returns what it spawned.
function consumeQuestionBlock(level, col, row) {
    const key = questionBlockKey(col, row);
    const qb = level.questionBlocks.get(key);
    if (!qb || qb.consumed) return null;
    qb.consumed = true;
    level.tilemap[row][col] = 0; // Air — matches Tile ID Reference
    return qb.contains;
}

window.loadLevel = loadLevel;
window.consumeQuestionBlock = consumeQuestionBlock;
window.questionBlockKey = questionBlockKey;
