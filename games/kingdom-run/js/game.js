// ── Kingdom Run — main loop & game-state machine (see GAME_SPEC.md § Game States) ──

const GameState = {
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE',
    GAME_OVER: 'GAME_OVER'
};

// Par time for the level-complete time bonus (GAME_SPEC.md § Scoring System:
// "Bonus: Time (remaining seconds x 10) +up to 1000"). Finishing at or under
// this budget earns the full bonus; every second over reduces it to zero.
const PAR_TIME_SECONDS = 180;
const CAMERA_LOOK_AHEAD = 60;
const CAMERA_SMOOTHING = 0.08;

let canvas, ctx;
let W = 400, H = 300;

let saveData = null;
let gameState = GameState.TITLE;
let currentLevel = null;
let player = null;
let camera = { x: 0, y: 0 };
let scale = 1; // world-px -> screen-px, recomputed each frame in updateCamera()

// MIN_SCALE is a sanity floor only (guards against a near-zero clientHeight
// mid-layout), not a UX target — the whole point of scaling is that the
// level's full height (ground included) is ALWAYS visible, so the low end
// must not clamp in any realistic viewport. A short landscape phone with a
// visible HUD + controls can leave under 150px for the canvas, well below
// what a fixed "don't zoom out past this" floor would have allowed.
// MAX_SCALE only stops an extremely tall/narrow window from zooming in to
// an unplayably small horizontal view.
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

let score = 0;
let coinsCollected = 0;
let tookDamage = false;
let lastCheckpoint = null;
let levelStartTime = 0;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// ── Canvas sizing ────────────────────────────────────────────────────────────
//
// The canvas fills #canvas-wrap edge to edge in BOTH dimensions — no fixed
// aspect ratio. A fixed 4:3 box either got starved down to a small letterboxed
// square (portrait) or left large black bars on either side (a real phone's
// landscape aspect ratio is much wider than 4:3). Instead the world is
// rendered at a computed `scale` (see updateCamera) so the level's full
// height always fits the available height exactly, and however much width
// that leaves simply shows more or less of the level side-to-side — wider
// screens see further ahead, not more black bar.
function syncSize() {
    const wrap = canvas.parentElement;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;

    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
    }
    W = canvas.width;
    H = canvas.height;
}

// ── Screens (DOM overlays) ──────────────────────────────────────────────────

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
}
function showScreen(id) {
    document.getElementById(id).classList.remove('hidden');
}

function refreshTitleScreen() {
    document.getElementById('title-highscore').textContent = saveData.highScore;
    document.getElementById('btn-mute-title').textContent = saveData.settings.audioMuted ? '🔇' : '🔊';

    const hasSave = !!saveData.inProgress;
    const continueBtn = document.getElementById('btn-continue');
    const startBtn = document.getElementById('btn-start');
    continueBtn.classList.toggle('hidden', !hasSave);
    continueBtn.classList.toggle('primary', hasSave);
    startBtn.classList.toggle('primary', !hasSave);
    startBtn.textContent = hasSave ? 'New Game' : 'Start Game';
}

function showTitleScreen() {
    gameState = GameState.TITLE;
    hideAllScreens();
    refreshTitleScreen();
    showScreen('screen-title');
    document.getElementById('hud').classList.add('hidden');
}

// ── Save data / settings ─────────────────────────────────────────────────────

function toggleMute() {
    saveData.settings.audioMuted = !saveData.settings.audioMuted;
    KingdomRunStorage.updateSettings(saveData, { audioMuted: saveData.settings.audioMuted });
    setAudioSettings(saveData.settings);
    refreshTitleScreen();
}

// ── Starting / restarting / saving a run ──────────────────────────────────────
//
// See GAME_SPEC.md § Data Persistence & Local Storage. Mid-level state is
// never autosaved — only an explicit "Save & Quit" writes it, into
// saveData.inProgress. It's cleared on restart, level-complete, and game
// over so the title screen never offers "Continue" into a run that no
// longer exists.

async function startLevel(id, progress = null) {
    hideAllScreens();
    currentLevel = await loadLevel(id);
    player = createPlayer(currentLevel.spawnPoint);
    camera = { x: 0, y: 0 };
    score = 0;
    coinsCollected = 0;
    tookDamage = false;
    lastCheckpoint = null;
    levelStartTime = performance.now();

    if (progress) applyProgress(progress);

    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('hud-level').textContent = currentLevel.id;
    gameState = GameState.PLAYING;
}

// Restores runtime state (score, collected items, checkpoints, position)
// from a previously saved in-progress snapshot onto the freshly loaded level.
function applyProgress(progress) {
    score = progress.score;
    coinsCollected = progress.coinsCollected;
    tookDamage = progress.tookDamage;
    lastCheckpoint = progress.lastCheckpoint;
    levelStartTime = performance.now() - progress.elapsedMs;

    for (const coin of currentLevel.coins) {
        if (progress.collectedCoinIds.includes(coin.id)) coin.collected = true;
    }
    for (const enemy of currentLevel.enemies) {
        if (progress.defeatedEnemyIds.includes(enemy.id)) enemy.alive = false;
    }
    for (const key of progress.consumedQuestionBlocks) {
        const qb = currentLevel.questionBlocks.get(key);
        if (qb && !qb.consumed) {
            qb.consumed = true;
            const [col, row] = key.split(',').map(Number);
            currentLevel.tilemap[row][col] = 0;
        }
    }
    for (const cp of currentLevel.checkpoints) {
        if (progress.checkpointsReached.includes(cp.id)) cp.reached = true;
    }

    // Reuses the respawn path (position + brief invincibility) rather than
    // dropping the player back in cold, in case they resume right next to
    // an enemy or hazard.
    playerRespawn(player, progress.player, performance.now());
    player.lives = progress.player.lives;
}

// Snapshots enough runtime state to fully reconstruct the current attempt.
function serializeProgress(now) {
    return {
        levelId: currentLevel.id,
        player: { x: player.x, y: player.y, lives: player.lives },
        score,
        coinsCollected,
        tookDamage,
        elapsedMs: now - levelStartTime,
        collectedCoinIds: currentLevel.coins.filter((c) => c.collected).map((c) => c.id),
        defeatedEnemyIds: currentLevel.enemies.filter((e) => !e.alive).map((e) => e.id),
        consumedQuestionBlocks: [...currentLevel.questionBlocks.entries()]
            .filter(([, qb]) => qb.consumed)
            .map(([key]) => key),
        checkpointsReached: currentLevel.checkpoints.filter((cp) => cp.reached).map((cp) => cp.id),
        lastCheckpoint
    };
}

function startNewGame() {
    saveData = KingdomRunStorage.clearInProgress(saveData);
    startLevel(1);
}

function continueGame() {
    if (!saveData.inProgress) return;
    startLevel(saveData.inProgress.levelId, saveData.inProgress);
}

function saveAndQuit() {
    if (gameState !== GameState.PAUSED || !currentLevel) return;
    const progress = serializeProgress(performance.now());
    saveData = KingdomRunStorage.saveInProgress(saveData, progress);
    showTitleScreen();
}

function restartLevel() {
    saveData = KingdomRunStorage.clearInProgress(saveData);
    startLevel(currentLevel ? currentLevel.id : 1);
}

// ── Pause ─────────────────────────────────────────────────────────────────────

function pauseGame() {
    if (gameState !== GameState.PLAYING) return;
    gameState = GameState.PAUSED;
    showScreen('screen-pause');
}
function resumeGame() {
    if (gameState !== GameState.PAUSED) return;
    gameState = GameState.PLAYING;
    hideAllScreens();
}

// ── Death / respawn / game over ──────────────────────────────────────────────

function onPlayerDeathComplete(now) {
    player.lives -= 1;
    Sfx.death();
    document.getElementById('hud-lives').textContent = player.lives;
    if (player.lives <= 0) {
        enterGameOver();
        return;
    }
    const respawnPos = lastCheckpoint || currentLevel.spawnPoint;
    playerRespawn(player, respawnPos, now);
}

function enterGameOver() {
    gameState = GameState.GAME_OVER;
    saveData = KingdomRunStorage.clearInProgress(saveData);
    saveData = KingdomRunStorage.reportHighScore(saveData, score);
    document.getElementById('gameover-score').textContent = score;
    document.getElementById('gameover-highscore').textContent = saveData.highScore;
    document.getElementById('hud').classList.add('hidden');
    showScreen('screen-gameover');
}

// ── Level completion & scoring ───────────────────────────────────────────────

function grantQuestionBlockContents(contains) {
    Sfx.blockHit();
    if (contains === 'coin') {
        score += 100;
    } else if (contains === 'life') {
        player.lives += 1;
        document.getElementById('hud-lives').textContent = player.lives;
        Sfx.extraLife();
    }
}

function completeLevel(now) {
    gameState = GameState.LEVEL_COMPLETE;
    saveData = KingdomRunStorage.clearInProgress(saveData);

    const elapsedMs = now - levelStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remainingSeconds = Math.max(0, PAR_TIME_SECONDS - elapsedSeconds);
    const timeBonus = Math.min(1000, remainingSeconds * 10);
    const allCoinsBonus = coinsCollected === currentLevel.totalCoins ? 2000 : 0;
    const noDamageBonus = tookDamage ? 0 : 3000;
    const levelCompletionBonus = 5000;

    score += levelCompletionBonus + timeBonus + allCoinsBonus + noDamageBonus;

    saveData = KingdomRunStorage.reportHighScore(saveData, score);
    saveData = KingdomRunStorage.reportLevelResult(saveData, currentLevel.id, {
        score,
        timeMs: elapsedMs,
        completed: true
    });

    Sfx.levelComplete();

    const mm = Math.floor(elapsedSeconds / 60);
    const ss = String(elapsedSeconds % 60).padStart(2, '0');
    document.getElementById('complete-score').textContent = score;
    document.getElementById('complete-time').textContent = `${mm}:${ss}`;
    document.getElementById('complete-coins').textContent = `${coinsCollected}/${currentLevel.totalCoins}`;
    document.getElementById('complete-nodamage').textContent = noDamageBonus > 0 ? 'Yes (+3000)' : 'No';
    document.getElementById('hud').classList.add('hidden');
    showScreen('screen-levelcomplete');
}

// ── Per-frame world update ───────────────────────────────────────────────────

function rectFor(entity) {
    return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
}

function updateCheckpoints(now) {
    for (const cp of currentLevel.checkpoints) {
        if (cp.reached) continue;
        const trigger = { x: cp.x, y: cp.y - TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE * 2 };
        if (isCollidingAABB(rectFor(player), trigger)) {
            cp.reached = true;
            lastCheckpoint = { x: cp.x, y: cp.y };
            score += 500;
            Sfx.checkpoint();
        }
    }
}

function updateCoins() {
    for (const coin of currentLevel.coins) {
        if (coin.collected) continue;
        if (isCollidingAABB(rectFor(player), coin)) {
            coin.collected = true;
            coinsCollected += 1;
            score += 100;
            Sfx.coin();
        }
    }
}

function updateEnemies(now) {
    for (const enemy of currentLevel.enemies) {
        if (!enemy.alive) continue;
        updateWalkerEnemy(enemy);
        if (!isCollidingAABB(rectFor(player), rectFor(enemy))) continue;

        const playerBottom = player.y + player.height;
        const isStomp = player.vy >= 0 && (playerBottom - enemy.y) <= enemy.height * 0.6;

        if (isStomp) {
            enemy.alive = false;
            playerStomp(player);
            score += 200;
            Sfx.stomp();
        } else {
            const dir = (player.x + player.width / 2) < (enemy.x + enemy.width / 2) ? -1 : 1;
            if (playerTakeHit(player, now, dir)) {
                tookDamage = true;
                Sfx.hurt();
            }
        }
    }
}

function updateHazardsAndBounds(now) {
    if (now >= player.invincibleUntil && isTouchingHazard(rectFor(player), currentLevel)) {
        if (playerDie(player, now)) tookDamage = true;
    }
    if (player.y > currentLevel.height + 200) {
        playerDie(player, now);
    }
}

function updateGoal(now) {
    if (isCollidingAABB(rectFor(player), currentLevel.goal)) {
        completeLevel(now);
    }
}

function updateWorld(now) {
    const result = updatePlayer(player, now, currentLevel);
    for (const event of result.events) {
        if (event.type === 'jump') Sfx.jump();
        else if (event.type === 'land') Sfx.land();
        else if (event.type === 'ceilingHit') {
            for (const tile of event.tiles) {
                const id = getTileId(currentLevel, tile.col, tile.row);
                if (id === 4) {
                    const contains = consumeQuestionBlock(currentLevel, tile.col, tile.row);
                    if (contains) grantQuestionBlockContents(contains);
                }
            }
        }
    }

    if (player.state === PlayerState.DYING && now - player.stateEnteredAt >= PhysicsConfig.dyingDurationMs) {
        onPlayerDeathComplete(now);
        return; // avoid acting on stale collisions this frame after a respawn/game-over
    }

    updateCheckpoints(now);
    updateCoins();
    updateEnemies(now);
    updateHazardsAndBounds(now);
    updateGoal(now);

    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-coins').textContent = `${coinsCollected}/${currentLevel.totalCoins}`;
    document.getElementById('hud-lives').textContent = player.lives;
}

// ── Rendering ────────────────────────────────────────────────────────────────

const TILE_COLORS = { 1: '#8b5a2b', 2: '#3d7a37', 3: '#a0522d', 6: '#8b5a2b' };

function updateCamera() {
    // Scale so the level's full height always fits the available screen
    // height exactly — the ground and the top of a jump are always in view
    // regardless of how tall or short the device's viewport is.
    scale = clamp(H / currentLevel.height, MIN_SCALE, MAX_SCALE);

    const visibleWorldW = W / scale;
    const visibleWorldH = H / scale;

    const targetX = player.x + player.width / 2 - visibleWorldW / 2 + CAMERA_LOOK_AHEAD * player.facing;
    camera.x += (targetX - camera.x) * CAMERA_SMOOTHING;
    camera.x = clamp(camera.x, 0, Math.max(0, currentLevel.width - visibleWorldW));

    const idealY = (currentLevel.height - visibleWorldH) / 2;
    camera.y = clamp(idealY, Math.min(0, currentLevel.height - visibleWorldH), Math.max(0, currentLevel.height - visibleWorldH));
}

function drawTile(id, sx, sy, size) {
    if (id === 0) return;
    if (id === 4) {
        ctx.fillStyle = '#f0c419';
        ctx.fillRect(sx, sy, size, size);
        ctx.strokeStyle = '#c99a0f';
        ctx.strokeRect(sx + 1, sy + 1, size - 2, size - 2);
        ctx.fillStyle = '#7a5c00';
        ctx.font = `bold ${size * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', sx + size / 2, sy + size / 2 + 1);
        return;
    }
    if (id === 5) {
        ctx.fillStyle = '#555';
        ctx.fillRect(sx, sy + size - 6, size, 6);
        ctx.fillStyle = '#d43b3b';
        for (let i = 0; i < 3; i++) {
            const bx = sx + i * (size / 3);
            ctx.beginPath();
            ctx.moveTo(bx, sy + size - 6);
            ctx.lineTo(bx + size / 6, sy + size * 0.15);
            ctx.lineTo(bx + size / 3, sy + size - 6);
            ctx.closePath();
            ctx.fill();
        }
        return;
    }
    if (id === 7) {
        ctx.fillStyle = '#9c7a4a';
        ctx.fillRect(sx, sy, size, size * 0.3);
        return;
    }
    ctx.fillStyle = TILE_COLORS[id] || '#666';
    ctx.fillRect(sx, sy, size, size);
    if (id === 2) {
        ctx.fillStyle = '#5fa050';
        ctx.fillRect(sx, sy, size, 6);
    }
}

function drawWorld(now) {
    ctx.fillStyle = currentLevel.backgroundColor;
    ctx.fillRect(0, 0, W, H);

    updateCamera(); // sets `scale` and `camera` for this frame
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera.x, -camera.y);

    const visibleWorldW = W / scale;
    const visibleWorldH = H / scale;
    const tileSize = currentLevel.tileSize;
    const c0 = Math.max(0, Math.floor(camera.x / tileSize));
    const c1 = Math.min(currentLevel.tilemap[0].length - 1, Math.floor((camera.x + visibleWorldW) / tileSize));
    const r0 = Math.max(0, Math.floor(camera.y / tileSize));
    const r1 = Math.min(currentLevel.tilemap.length - 1, Math.floor((camera.y + visibleWorldH) / tileSize));
    for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
            drawTile(currentLevel.tilemap[row][col], col * tileSize, row * tileSize, tileSize);
        }
    }

    // Checkpoints (flagpoles)
    for (const cp of currentLevel.checkpoints) {
        ctx.fillStyle = '#888';
        ctx.fillRect(cp.x + 12, cp.y - 32, 4, 64);
        ctx.fillStyle = cp.reached ? '#37d67a' : '#cccccc';
        ctx.beginPath();
        ctx.moveTo(cp.x + 16, cp.y - 32);
        ctx.lineTo(cp.x + 34, cp.y - 24);
        ctx.lineTo(cp.x + 16, cp.y - 16);
        ctx.closePath();
        ctx.fill();
    }

    // Goal flag
    const g = currentLevel.goal;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(g.x + g.width / 2 - 2, g.y, 4, g.height);
    ctx.fillStyle = '#e0483c';
    ctx.beginPath();
    ctx.moveTo(g.x + g.width / 2 + 2, g.y + 4);
    ctx.lineTo(g.x + g.width, g.y + 14);
    ctx.lineTo(g.x + g.width / 2 + 2, g.y + 24);
    ctx.closePath();
    ctx.fill();

    // Coins
    for (const coin of currentLevel.coins) {
        if (coin.collected) continue;
        ctx.fillStyle = '#ffd23d';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c99a0f';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Enemies
    for (const enemy of currentLevel.enemies) {
        if (!enemy.alive) continue;
        ctx.fillStyle = '#8b3a3a';
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, enemy.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        const eyeOffset = enemy.dir > 0 ? 4 : -4;
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2 + eyeOffset, enemy.y + enemy.height / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2 + eyeOffset, enemy.y + enemy.height / 2 - 3, 1.4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPlayer(now);

    ctx.restore();
}

function drawPlayer(now) {
    let alpha = 1;
    if (player.state === PlayerState.INVINCIBLE) {
        alpha = Math.floor(now / PhysicsConfig.invincibilityFlashMs) % 2 === 0 ? 1 : 0.35;
    } else if (player.state === PlayerState.DYING) {
        alpha = Math.max(0, 1 - (now - player.stateEnteredAt) / PhysicsConfig.dyingDurationMs);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    const bodyColor = player.state === PlayerState.HURT ? '#e05555' : '#2f7fd6';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = '#fff';
    const eyeX = player.facing > 0 ? player.x + player.width - 8 : player.x + 4;
    ctx.fillRect(eyeX, player.y + 6, 4, 4);
    ctx.restore();
}

// ── Main loop ─────────────────────────────────────────────────────────────────

function loop() {
    const now = performance.now();

    if (Input.consumePausePress()) {
        if (gameState === GameState.PLAYING) pauseGame();
        else if (gameState === GameState.PAUSED) resumeGame();
    }

    if (gameState === GameState.PLAYING) {
        updateWorld(now);
    }

    if (currentLevel) {
        drawWorld(now);
    }

    requestAnimationFrame(loop);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', syncSize);
    syncSize();

    saveData = KingdomRunStorage.load();
    setAudioSettings(saveData.settings);

    initTouchControls();

    document.getElementById('btn-start').addEventListener('click', startNewGame);
    document.getElementById('btn-continue').addEventListener('click', continueGame);
    document.getElementById('btn-mute-title').addEventListener('click', toggleMute);
    document.getElementById('btn-resume').addEventListener('click', resumeGame);
    document.getElementById('btn-restart-pause').addEventListener('click', restartLevel);
    document.getElementById('btn-save-quit').addEventListener('click', saveAndQuit);
    document.getElementById('btn-retry-gameover').addEventListener('click', restartLevel);
    document.getElementById('btn-quit-gameover').addEventListener('click', showTitleScreen);
    document.getElementById('btn-retry-complete').addEventListener('click', restartLevel);
    document.getElementById('btn-quit-complete').addEventListener('click', showTitleScreen);

    // Auto-pause when the rotate-to-landscape prompt covers the game, or the
    // tab/app loses focus (GAME_SPEC.md § Important mobile requirements) —
    // otherwise enemies and the level timer keep advancing somewhere the
    // player can't see or react to.
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    portraitQuery.addEventListener('change', (e) => {
        syncSize();
        if (e.matches && gameState === GameState.PLAYING) pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameState === GameState.PLAYING) pauseGame();
    });

    showTitleScreen();
    requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', init);
