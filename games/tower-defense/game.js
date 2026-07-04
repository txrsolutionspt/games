'use strict';

// ── Canvas (fixed logical 400×320) ─────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
canvas.width  = 400;
canvas.height = 320;
const W = 400, H = 320, COLS = 10, ROWS = 8, CELL = 40;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const goldEl  = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl  = document.getElementById('wave');
const waveBtn = document.getElementById('wave-btn');
const infoEl  = document.getElementById('info-text');
const sellBtn = document.getElementById('sell-btn');

// ── Audio ──────────────────────────────────────────────────────────────────────
let audioCtx = null, masterGain = null;

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 0: DATA EXTRACTION - GameData Object
// ════════════════════════════════════════════════════════════════════════════════

const MAPS = {
  'classic': {
    id: 'classic',
    name: 'Classic Winds',
    pathTiles: [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],
      [5,1],[5,2],
      [4,2],[3,2],[2,2],[1,2],
      [1,3],[1,4],[1,5],
      [2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],
      [8,6],[8,7],[9,7],
    ],
    background: { type: 'gradient', colors: ['#162210', '#0a1208'] }
  },
  'spiral': {
    id: 'spiral',
    name: 'Spiral Challenge',
    pathTiles: [
      [5,0],[6,0],[7,0],[8,0],[9,0],
      [9,1],[9,2],[9,3],
      [8,3],[7,3],[6,3],[5,3],[4,3],
      [4,2],[4,1],[4,0],
      [3,0],[2,0],[1,0],[0,0],
      [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
      [1,7],[2,7],[3,7],[4,7],[5,7],
      [5,6],[5,5],[5,4],
      [6,4],[7,4],[8,4],[9,4],[9,5],[9,6],[9,7],
    ],
    background: { type: 'gradient', colors: ['#1a2840', '#0a1520'] }
  },
  'serpent': {
    id: 'serpent',
    name: 'Serpent Path',
    pathTiles: [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],
      [9,1],[9,2],[9,3],
      [8,3],[7,3],[6,3],[5,3],[4,3],[3,3],[2,3],[1,3],[0,3],
      [0,4],[0,5],[0,6],[0,7],
      [1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],
    ],
    background: { type: 'gradient', colors: ['#2a1840', '#1a0a30'] }
  }
};

function createMapWaypoints(mapId) {
  const pathTiles = MAPS[mapId].pathTiles;
  return [
    { x: -20, y: CELL / 2 },
    ...pathTiles.map(([c,r]) => ({ x: c*CELL + CELL/2, y: r*CELL + CELL/2 })),
    { x: W + 20, y: 7*CELL + CELL/2 },
  ];
}

function createMapPathSet(mapId) {
  return new Set(MAPS[mapId].pathTiles.map(([c,r]) => `${c},${r}`));
}

const TOWER_DEFS = {
  archer: { name:'Archer', cost:50,  range:90,  dmg:10,  cd:900,  splash:0,  slow:0,    color:'#6bbf3e', pColor:'#c8ff70', pSpd:0.35, pR:4, desc:'Fast · single target' },
  cannon: { name:'Cannon', cost:100, range:80,  dmg:55,  cd:2400, splash:50, slow:0,    color:'#c87c35', pColor:'#ffe070', pSpd:0.20, pR:7, desc:'Slow · area splash' },
  frost:  { name:'Frost',  cost:80,  range:90,  dmg:5,   cd:1200, splash:0,  slow:2200, color:'#35a8d0', pColor:'#aaddff', pSpd:0.28, pR:5, desc:'Slows enemies' },
  laser:  { name:'Laser',  cost:175, range:130, dmg:25,  cd:280,  splash:0,  slow:0,    color:'#d035a8', pColor:'#ff88ee', pSpd:0.55, pR:3, desc:'High DPS · long range' },
};

const ENEMY_DEFS = {
  basic:   { hp:40,  spd:0.08,  reward:10,  color:'#ee4444', r:8  },
  fast:    { hp:22,  spd:0.18,  reward:12,  color:'#ffaa22', r:7  },
  tank:    { hp:180, spd:0.045, reward:35,  color:'#9944cc', r:12 },
  boss:    { hp:900, spd:0.038, reward:120, color:'#ff2200', r:18 },
};

const DIFFICULTY_DEFS = {
  easy:   { name: 'Easy',   healthMult: 0.7,  goldMult: 1.3, waveSpawnMult: 0.8,  startGold: 200, startLives: 25 },
  normal: { name: 'Normal', healthMult: 1.0,  goldMult: 1.0, waveSpawnMult: 1.0,  startGold: 150, startLives: 20 },
  hard:   { name: 'Hard',   healthMult: 1.4,  goldMult: 0.85, waveSpawnMult: 1.2, startGold: 100, startLives: 15 },
};

function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.12;
    masterGain.connect(audioCtx.destination);
}

function tone(freq, type, dur, vol = 0.4, delay = 0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const t = audioCtx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur);
}

function sfxPlace()  { tone(440,'sine',0.08,0.3); tone(660,'sine',0.07,0.2,0.06); }
function sfxArcher() { tone(480,'sawtooth',0.05,0.12); }
function sfxCannon() { tone(100,'square',0.18,0.4); tone(60,'sine',0.25,0.3,0.05); }
function sfxFrost()  { tone(900,'sine',0.09,0.18); }
function sfxLaser()  { tone(1100,'sine',0.03,0.25); }
function sfxDie()    { tone(180,'sawtooth',0.1,0.25); }
function sfxLose()   { [200,160,120,90].forEach((f,i)=>tone(f,'sawtooth',0.2,0.4,i*0.12)); }
function sfxWave()   { [440,550,660].forEach((f,i)=>tone(f,'sine',0.14,0.3,i*0.1)); }

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 0: GAME STORAGE - LocalStorage Persistence
// ════════════════════════════════════════════════════════════════════════════════

const GameStorage = {
  GAME_SAVE_KEY: 'td_game_save',
  SETTINGS_KEY: 'td_settings',

  saveGame(gameState) {
    try {
      localStorage.setItem(this.GAME_SAVE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.warn('Failed to save game:', e);
    }
  },

  loadGame() {
    try {
      const data = localStorage.getItem(this.GAME_SAVE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Failed to load game:', e);
      return null;
    }
  },

  deleteGame() {
    try {
      localStorage.removeItem(this.GAME_SAVE_KEY);
    } catch (e) {
      console.warn('Failed to delete game:', e);
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  },

  loadSettings() {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Failed to load settings:', e);
      return {};
    }
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 0: GAME STATE - Encapsulated Mutable State
// ════════════════════════════════════════════════════════════════════════════════

function createGameState(mapId = 'classic', difficulty = 'normal') {
  const diffDef = DIFFICULTY_DEFS[difficulty];
  const enemyManager = new EnemyManager();
  const towerManager = new TowerManager();
  const projectileManager = new ProjectileManager();
  const particleManager = new ParticleManager();
  return {
    mapId,
    difficulty,
    gold: diffDef.startGold,
    lives: diffDef.startLives,
    waveNum: 0,
    waveActive: false,
    gameOver: false,
    enemyMgr: enemyManager,
    enemies: enemyManager.enemies,
    enemyMap: enemyManager.enemyMap,
    spatialGrid: enemyManager.spatialGrid,
    towerMgr: towerManager,
    towers: towerManager.towers,
    projectileMgr: projectileManager,
    projectiles: projectileManager.projectiles,
    particleMgr: particleManager,
    particles: particleManager.particles,
    selectedType: null,
    selectedTower: null,
    spawnQueue: [],
    waveStartTime: 0,
    lastTimestamp: 0,
    hoverCell: null,
    entityIds: { eid: 0, pid: 0, tid: 0 },
    stats: {
      totalKilled: 0,
      totalGoldEarned: 0,
      gameStartTime: Date.now()
    }
  };
}

// Game state instance
let gameState = createGameState();
let PATH_SET = createMapPathSet(gameState.mapId);
let WAYPOINTS = createMapWaypoints(gameState.mapId);

// ── Spatial grid helpers ───────────────────────────────────────────────────────
const GRID_SIZE = CELL; // 40×40 pixel cells
const GRID_COLS = Math.ceil(W / GRID_SIZE);
const GRID_ROWS = Math.ceil(H / GRID_SIZE);

function getGridCell(x, y) {
  const col = Math.floor(x / GRID_SIZE);
  const row = Math.floor(y / GRID_SIZE);
  return `${col},${row}`;
}

function getNearbyGridCells(x, y, range) {
  const cells = new Set();
  const cellsToCheck = Math.ceil(range / GRID_SIZE) + 1;
  const centerCol = Math.floor(x / GRID_SIZE);
  const centerRow = Math.floor(y / GRID_SIZE);
  for (let dc = -cellsToCheck; dc <= cellsToCheck; dc++) {
    for (let dr = -cellsToCheck; dr <= cellsToCheck; dr++) {
      const col = centerCol + dc;
      const row = centerRow + dr;
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        cells.add(`${col},${row}`);
      }
    }
  }
  return cells;
}

function updateSpatialGrid() {
  gameState.spatialGrid.clear();
  gameState.enemies.forEach(e => {
    const cell = getGridCell(e.x, e.y);
    if (!gameState.spatialGrid.has(cell)) {
      gameState.spatialGrid.set(cell, []);
    }
    gameState.spatialGrid.get(cell).push(e);
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// MANAGER CLASSES - Encapsulated subsystems
// ════════════════════════════════════════════════════════════════════════════════

class EnemyManager {
  constructor() {
    this.enemies = [];
    this.enemyMap = new Map();
    this.spatialGrid = new Map();
    this.nextId = 0;
  }

  spawn(type, entityIds, difficulty, waveNum) {
    const def = ENEMY_DEFS[type];
    const diffMult = DIFFICULTY_DEFS[difficulty].healthMult;
    const hpMult = (1 + (waveNum - 1) * 0.13) * diffMult;
    const enemy = {
      id: ++entityIds.eid,
      type,
      hp: Math.round(def.hp * hpMult),
      maxHp: Math.round(def.hp * hpMult),
      spd: def.spd,
      reward: Math.round(def.reward * DIFFICULTY_DEFS[difficulty].goldMult),
      color: def.color,
      r: def.r,
      x: WAYPOINTS[0].x,
      y: WAYPOINTS[0].y,
      wpIdx: 1,
      slowUntil: 0,
      dead: false,
      escaped: false,
    };
    this.enemies.push(enemy);
    this.enemyMap.set(enemy.id, enemy);
    return enemy;
  }

  getById(id) {
    return this.enemyMap.get(id);
  }

  getByIdIfAlive(id) {
    const enemy = this.enemyMap.get(id);
    return enemy && !enemy.dead && !enemy.escaped ? enemy : null;
  }

  getNearbyInRange(x, y, range) {
    const enemies = [];
    const nearbyCells = getNearbyGridCells(x, y, range);
    nearbyCells.forEach(cellId => {
      const cellEnemies = this.spatialGrid.get(cellId);
      if (cellEnemies) {
        cellEnemies.forEach(e => enemies.push(e));
      }
    });
    return enemies;
  }

  updateSpatialGrid() {
    this.spatialGrid.clear();
    this.enemies.forEach(e => {
      const cell = getGridCell(e.x, e.y);
      if (!this.spatialGrid.has(cell)) {
        this.spatialGrid.set(cell, []);
      }
      this.spatialGrid.get(cell).push(e);
    });
  }

  removeDeadAndEscaped() {
    this.enemies
      .filter(e => e.dead || e.escaped)
      .forEach(e => this.enemyMap.delete(e.id));
    this.enemies = this.enemies.filter(e => !e.dead && !e.escaped);
  }

  getAll() {
    return this.enemies;
  }

  count() {
    return this.enemies.length;
  }

  clear() {
    this.enemies = [];
    this.enemyMap.clear();
    this.spatialGrid.clear();
  }
}

class TowerManager {
  constructor() {
    this.towers = [];
  }

  add(type, col, row, entityIds) {
    const tower = {
      id: ++entityIds.tid,
      type,
      col,
      row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      lastFired: 0
    };
    this.towers.push(tower);
    return tower;
  }

  getAll() {
    return this.towers;
  }

  remove(towerId) {
    this.towers = this.towers.filter(t => t.id !== towerId);
  }

  updateLastFired(towerId, timestamp) {
    const tower = this.towers.find(t => t.id === towerId);
    if (tower) {
      tower.lastFired = timestamp;
    }
  }

  count() {
    return this.towers.length;
  }

  clear() {
    this.towers = [];
  }
}

class ProjectileManager {
  constructor() {
    this.projectiles = [];
  }

  fire(x, y, tx, ty, targetId, type, entityIds) {
    const def = TOWER_DEFS[type];
    const projectile = {
      id: ++entityIds.pid,
      type,
      x,
      y,
      tx,
      ty,
      targetId: def.splash > 0 ? null : targetId,
      spd: def.pSpd,
      dmg: def.dmg,
      splash: def.splash,
      slow: def.slow,
      color: def.pColor,
      r: def.pR,
      done: false
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  getAll() {
    return this.projectiles;
  }

  getActive() {
    return this.projectiles.filter(p => !p.done);
  }

  markDone(projectileId) {
    const p = this.projectiles.find(pr => pr.id === projectileId);
    if (p) p.done = true;
  }

  removeFinished() {
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  count() {
    return this.projectiles.length;
  }

  clear() {
    this.projectiles = [];
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
  }

  burst(x, y, color, count, baseR) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const r = baseR * (0.5 + Math.random() * 0.5);
      const vx = Math.cos(angle) * r;
      const vy = Math.sin(angle) * r;
      particles.push({
        x,
        y,
        vx,
        vy,
        color,
        life: 0.6 + Math.random() * 0.3,
        r: baseR * 0.3
      });
    }
    this.particles.push(...particles);
    return particles;
  }

  getAll() {
    return this.particles;
  }

  removeExpired() {
    this.particles = this.particles.filter(p => p.life > 0);
  }

  count() {
    return this.particles.length;
  }

  clear() {
    this.particles = [];
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 1: UI AND SETTINGS
// ════════════════════════════════════════════════════════════════════════════════

// ── Debug mode for troubleshooting ─────────────────────────────────────────────
const DEBUG = typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE;
function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[TD] ${message}`, data || '');
    }
}

// ── DOM refs for modals ────────────────────────────────────────────────────────
const difficultyModal = document.getElementById('difficulty-modal');
const settingsModal = document.getElementById('settings-modal');
const resumeModal = document.getElementById('resume-modal');
const settingsBtn = document.getElementById('settings-btn');

// ── Auto-save on wave completion ─────────────────────────────────────────────
function autoSaveGame() {
    GameStorage.saveGame(gameState);
}

// ── Show/hide modals ────────────────────────────────────────────────────────
function showModal(modal) {
    modal.classList.remove('hidden');
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

// ── Initialize game with difficulty/map selection ───────────────────────────
function initializeGame() {
    const savedGame = GameStorage.loadGame();

    if (savedGame) {
        showModal(resumeModal);
        const diffName = DIFFICULTY_DEFS[savedGame.difficulty].name;
        const mapName = MAPS[savedGame.mapId].name;
        document.getElementById('resume-info').textContent =
            `Wave ${savedGame.waveNum} · ${diffName} · ${mapName}`;

        document.getElementById('resume-continue-btn').onclick = () => {
            hideModal(resumeModal);
            gameState = savedGame;
            PATH_SET = createMapPathSet(gameState.mapId);
            WAYPOINTS = createMapWaypoints(gameState.mapId);
            // Rebuild managers and spatial structures (not persisted)
            const enemyManager = new EnemyManager();
            gameState.enemies.forEach(e => {
                enemyManager.enemies.push(e);
                enemyManager.enemyMap.set(e.id, e);
            });
            gameState.enemyMgr = enemyManager;
            gameState.enemies = enemyManager.enemies;
            gameState.enemyMap = enemyManager.enemyMap;
            gameState.spatialGrid = enemyManager.spatialGrid;
            gameState.enemyMgr.updateSpatialGrid();

            const towerManager = new TowerManager();
            gameState.towers.forEach(t => {
                towerManager.towers.push(t);
            });
            gameState.towerMgr = towerManager;
            gameState.towers = towerManager.towers;

            const projectileManager = new ProjectileManager();
            gameState.projectiles.forEach(p => {
                projectileManager.projectiles.push(p);
            });
            gameState.projectileMgr = projectileManager;
            gameState.projectiles = projectileManager.projectiles;

            const particleManager = new ParticleManager();
            gameState.particles.forEach(p => {
                particleManager.particles.push(p);
            });
            gameState.particleMgr = particleManager;
            gameState.particles = particleManager.particles;
            updateHUD(); updateWaveBtn(); setInfo('Game resumed!');
            sellBtn.classList.add('hidden');
        };

        document.getElementById('resume-new-btn').onclick = () => {
            hideModal(resumeModal);
            showDifficultyModal();
        };
    } else {
        showDifficultyModal();
    }
}

function showDifficultyModal() {
    showModal(difficultyModal);

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    document.getElementById('difficulty-start-btn').onclick = () => {
        const selectedBtn = document.querySelector('.difficulty-btn.active');
        const difficulty = selectedBtn.dataset.difficulty;
        hideModal(difficultyModal);
        startNewGame(difficulty, 'classic');
    };
}

function startNewGame(difficulty = 'normal', mapId = 'classic') {
    gameState = createGameState(mapId, difficulty);
    PATH_SET = createMapPathSet(gameState.mapId);
    WAYPOINTS = createMapWaypoints(gameState.mapId);
    GameStorage.deleteGame();
    updateHUD(); updateWaveBtn(); setInfo('Select a tower type, then tap the map to place');
    sellBtn.classList.add('hidden');
}

// ── Settings menu ──────────────────────────────────────────────────────────
function showSettingsModal() {
    showModal(settingsModal);

    // Update active buttons to match current game state
    document.querySelectorAll('.setting-btn').forEach(btn => {
        btn.classList.remove('active');
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        if (setting === 'difficulty' && value === gameState.difficulty) {
            btn.classList.add('active');
        }
        if (setting === 'map' && value === gameState.mapId) {
            btn.classList.add('active');
        }
    });

    // Handle setting changes
    document.querySelectorAll('.setting-btn').forEach(btn => {
        btn.onclick = () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;

            document.querySelectorAll(`.setting-btn[data-setting="${setting}"]`).forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');

            if (setting === 'difficulty') {
                gameState.difficulty = value;
                GameStorage.saveGame(gameState);
            }
            if (setting === 'map') {
                gameState.mapId = value;
                PATH_SET = createMapPathSet(gameState.mapId);
                WAYPOINTS = createMapWaypoints(gameState.mapId);
                GameStorage.saveGame(gameState);
            }
        };
    });

    document.getElementById('settings-resume-btn').onclick = () => {
        hideModal(settingsModal);
        autoSaveGame();
    };

    document.getElementById('settings-new-btn').onclick = () => {
        hideModal(settingsModal);
        startNewGame();
        showDifficultyModal();
    };
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
function newGame() {
    GameStorage.deleteGame();
    showDifficultyModal();
}

function updateHUD() {
    goldEl.textContent  = gameState.gold;
    livesEl.textContent = gameState.lives;
    waveEl.textContent  = gameState.waveNum;
}

function updateWaveBtn() {
    if (gameState.gameOver) {
        waveBtn.textContent = '▶ PLAY AGAIN';
        waveBtn.disabled    = false;
        return;
    }
    if (gameState.waveActive) {
        waveBtn.textContent = `WAVE ${gameState.waveNum} IN PROGRESS…`;
        waveBtn.disabled    = true;
    } else {
        waveBtn.textContent = `▶ START WAVE ${gameState.waveNum + 1}`;
        waveBtn.disabled    = false;
    }
}

function setInfo(msg) { infoEl.textContent = msg; }

// ── Wave spawning ──────────────────────────────────────────────────────────────
function startWave() {
    if (gameState.waveActive || gameState.gameOver) return;
    initAudio();
    gameState.waveNum++;
    gameState.waveActive    = true;
    gameState.waveStartTime = performance.now();
    gameState.spawnQueue    = buildQueue(gameState.waveNum);
    sfxWave();
    updateHUD(); updateWaveBtn();
    setInfo(`Wave ${gameState.waveNum} incoming!`);
}

function buildQueue(n) {
    const q = [];
    const diffMult = DIFFICULTY_DEFS[gameState.difficulty].waveSpawnMult;
    const add = (type, count, interval, offset = 0) => {
        const scaledCount = Math.round(count * diffMult);
        for (let i = 0; i < scaledCount; i++) q.push({ type, t: offset + i * interval });
    };
    add('basic', Math.min(5 + n * 2, 22), 1100);
    if (n >= 3) add('fast',  Math.min(Math.floor(n * 0.7), 10), 800,  500);
    if (n >= 5) add('tank',  Math.min(Math.floor(n * 0.4), 6),  2000, 1000);
    if (n >= 10) add('fast', Math.floor(n * 0.3), 550, 300);
    if (n % 5 === 0) add('boss', 1, 0, 2200);
    return q.sort((a, b) => a.t - b.t);
}

function spawnEnemy(type) {
    gameState.enemyMgr.spawn(type, gameState.entityIds, gameState.difficulty, gameState.waveNum);
}

// ── Update: enemies ────────────────────────────────────────────────────────────
function updateEnemies(ts, dt) {
    if (gameState.waveActive && gameState.spawnQueue.length) {
        const elapsed = ts - gameState.waveStartTime;
        // Cap spawns per frame to avoid dumping entire wave if tab freezes
        let spawnedThisFrame = 0;
        while (gameState.spawnQueue.length && gameState.spawnQueue[0].t <= elapsed && spawnedThisFrame < 5) {
            spawnEnemy(gameState.spawnQueue.shift().type);
            spawnedThisFrame++;
        }
    }

    gameState.enemies.forEach(e => {
        if (e.dead || e.escaped) return;
        if (e.wpIdx >= WAYPOINTS.length) { e.escaped = true; return; }

        const spd  = e.spd * (ts < e.slowUntil ? 0.45 : 1);
        const wp   = WAYPOINTS[e.wpIdx];
        const dx   = wp.x - e.x, dy = wp.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = spd * dt;

        if (dist <= move) { e.x = wp.x; e.y = wp.y; e.wpIdx++; }
        else              { e.x += (dx/dist)*move; e.y += (dy/dist)*move; }
    });

    // Handle escaped
    gameState.enemies.filter(e => e.escaped).forEach(() => {
        gameState.lives = Math.max(0, gameState.lives - 1);
        updateHUD();
        if (gameState.lives <= 0) triggerGameOver();
    });

    // Handle dead (collect gold, particles)
    gameState.enemies.filter(e => e.dead).forEach(e => {
        gameState.gold += e.reward;
        gameState.stats.totalGoldEarned += e.reward;
        gameState.stats.totalKilled++;
        updateHUD();
        burst(e.x, e.y, e.color, 8, 3);
        sfxDie();
    });

    // Remove dead and escaped enemies and update grid
    gameState.enemyMgr.removeDeadAndEscaped();
    gameState.enemyMgr.updateSpatialGrid();

    if (gameState.waveActive && !gameState.spawnQueue.length && !gameState.enemies.length) {
        gameState.waveActive = false;
        gameState.gold += 20;
        gameState.stats.totalGoldEarned += 20;
        updateHUD(); updateWaveBtn();
        setInfo(`Wave ${gameState.waveNum} cleared! +20♦ bonus`);
        autoSaveGame();
    }
}

// ── Update: towers ─────────────────────────────────────────────────────────────
function updateTowers(ts) {
    gameState.towers.forEach(tower => {
        const def = TOWER_DEFS[tower.type];
        if (ts - tower.lastFired < def.cd) return;

        // Pick enemy furthest along path within range (using spatial grid)
        let target = null, bestWp = -1;
        const nearbyEnemies = gameState.enemyMgr.getNearbyInRange(tower.x, tower.y, def.range);
        nearbyEnemies.forEach(e => {
            const dx = e.x - tower.x, dy = e.y - tower.y;
            if (Math.sqrt(dx*dx + dy*dy) <= def.range && e.wpIdx > bestWp) {
                target = e; bestWp = e.wpIdx;
            }
        });
        if (!target) return;

        tower.lastFired = ts;
        if (tower.type === 'archer') sfxArcher();
        else if (tower.type === 'cannon') sfxCannon();
        else if (tower.type === 'frost')  sfxFrost();
        else sfxLaser();

        gameState.projectiles.push({
            id: ++gameState.entityIds.pid, type: tower.type,
            x: tower.x, y: tower.y,
            tx: target.x, ty: target.y,
            targetId: def.splash > 0 ? null : target.id,
            spd: def.pSpd, dmg: def.dmg,
            splash: def.splash, slow: def.slow,
            color: def.pColor, r: def.pR, done: false,
        });
    });
}

// ── Update: projectiles ────────────────────────────────────────────────────────
function updateProjectiles(ts, dt) {
    gameState.projectiles.forEach(p => {
        if (p.done) return;

        // Homing: track target (only if alive)
        if (p.targetId) {
            const e = gameState.enemyMgr.getByIdIfAlive(p.targetId);
            if (e) { p.tx = e.x; p.ty = e.y; }
        }

        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = p.spd * dt;

        if (dist <= move + 1) {
            p.x = p.tx; p.y = p.ty;
            p.done = true;
            if (p.splash > 0) {
                // Cannon splash (only hit alive enemies)
                burst(p.x, p.y, '#ffaa40', 14, 5);
                gameState.enemyMgr.getAll().forEach(e => {
                    if (!e.dead && !e.escaped) {
                        const ddx=e.x-p.x, ddy=e.y-p.y;
                        if (Math.sqrt(ddx*ddx+ddy*ddy) <= p.splash) hit(e, p.dmg, ts, p.slow);
                    }
                });
            } else {
                const e = p.targetId ? gameState.enemyMgr.getByIdIfAlive(p.targetId) : null;
                if (e) hit(e, p.dmg, ts, p.slow);
            }
        } else {
            p.x += (dx/dist)*move;
            p.y += (dy/dist)*move;
        }
    });
    gameState.projectiles = gameState.projectiles.filter(p => !p.done);
}

function hit(e, dmg, ts, slow) {
    e.hp -= dmg;
    if (slow) e.slowUntil = Math.max(e.slowUntil, ts + slow);
    if (e.hp <= 0) e.dead = true;
}

// ── Particles ──────────────────────────────────────────────────────────────────
function burst(x, y, color, count, baseR) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3.5;
        gameState.particles.push({
            x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1.2,
            life: 400 + Math.random()*300, maxLife: 700,
            color, r: baseR * (0.5 + Math.random()*0.8),
        });
    }
}

function updateParticles(dt) {
    for (let i = gameState.particles.length-1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt;
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
}

// ── Game over ──────────────────────────────────────────────────────────────────
function triggerGameOver() {
    gameState.gameOver = true; gameState.waveActive = false;
    sfxLose();
    updateWaveBtn();
    setInfo(`Game over — survived ${gameState.waveNum} wave${gameState.waveNum !== 1 ? 's' : ''}`);
    // Keep loop running to draw game over screen, but game logic has stopped
}

// ── Drawing ────────────────────────────────────────────────────────────────────
function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    drawMap();
    drawTowers(ts);
    drawRangePreview();
    drawEnemies(ts);
    drawProjectiles();
    drawParticles();
    if (gameState.gameOver) drawGameOver();
}

function drawMap() {
    const mapData = MAPS[gameState.mapId];
    const pathTiles = mapData.pathTiles;
    const bgData = mapData.background;

    // Render map background
    if (bgData.type === 'gradient') {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, bgData.colors[0]);
        grad.addColorStop(1, bgData.colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // Terrain background
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.fillStyle = PATH_SET.has(`${c},${r}`) ? '#3a3210' : 'rgba(0,0,0,0.15)';
            ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
        }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(40,60,30,0.7)';
    ctx.lineWidth   = 0.5;
    for (let c = 1; c < COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c*CELL, 0); ctx.lineTo(c*CELL, H); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r*CELL); ctx.lineTo(W, r*CELL); ctx.stroke();
    }

    // Path road
    pathTiles.forEach(([c, r]) => {
        ctx.fillStyle = '#3e3418';
        ctx.fillRect(c*CELL + 5, r*CELL + 5, CELL-10, CELL-10);
    });

    // Path connectors (fill gaps between adjacent tiles)
    for (let i = 0; i < pathTiles.length - 1; i++) {
        const [c1,r1] = pathTiles[i], [c2,r2] = pathTiles[i+1];
        const dc = c2 - c1, dr = r2 - r1;
        if (dc !== 0) {
            // horizontal connector
            const lx = Math.min(c1,c2)*CELL + (dc > 0 ? CELL-5 : 0);
            ctx.fillStyle = '#3e3418';
            ctx.fillRect(lx, r1*CELL+5, 10, CELL-10);
        } else {
            // vertical connector
            const ly = Math.min(r1,r2)*CELL + (dr > 0 ? CELL-5 : 0);
            ctx.fillStyle = '#3e3418';
            ctx.fillRect(c1*CELL+5, ly, CELL-10, 10);
        }
    }

    // Path directional arrows
    ctx.fillStyle = 'rgba(255,230,120,0.18)';
    for (let i = 0; i < pathTiles.length - 1; i++) {
        const [c,r] = pathTiles[i], [nc,nr] = pathTiles[i+1];
        const cx = c*CELL+CELL/2, cy = r*CELL+CELL/2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(nr-r, nc-c));
        ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    // Entry / exit markers
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(0, CELL*0+2, 4, CELL-4);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(W-4, CELL*7+2, 4, CELL-4);
}

function drawTowers(ts) {
    gameState.towers.forEach(t => {
        const def = TOWER_DEFS[t.type];
        const sel = gameState.selectedTower === t;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(t.x, t.y+4, CELL*0.35, CELL*0.18, 0, 0, Math.PI*2); ctx.fill();

        // Body
        ctx.fillStyle   = def.color;
        ctx.strokeStyle = sel ? '#ffd700' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = sel ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(t.x, t.y, CELL*0.37, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // Icon
        drawIcon(t.type, t.x, t.y, CELL*0.2);

        // Shoot flash
        const frac = (ts - t.lastFired) / TOWER_DEFS[t.type].cd;
        if (frac < 0.18) {
            ctx.globalAlpha = 0.5 * (1 - frac/0.18);
            ctx.fillStyle   = '#ffffff';
            ctx.beginPath(); ctx.arc(t.x, t.y, CELL*0.44, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    });
}

function drawIcon(type, cx, cy, r) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.fillStyle   = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 1.5;
    if (type === 'archer') {
        ctx.beginPath();
        ctx.moveTo(cx-r, cy); ctx.lineTo(cx+r, cy);
        ctx.moveTo(cx+r*0.4, cy-r*0.5); ctx.lineTo(cx+r, cy); ctx.lineTo(cx+r*0.4, cy+r*0.5);
        ctx.stroke();
    } else if (type === 'cannon') {
        ctx.beginPath(); ctx.arc(cx, cy, r*0.65, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
    } else if (type === 'frost') {
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); ctx.stroke();
        }
    } else {
        // laser: bolt
        ctx.beginPath();
        ctx.moveTo(cx+r*0.3, cy-r); ctx.lineTo(cx-r*0.1, cy-r*0.1);
        ctx.lineTo(cx+r*0.3, cy-r*0.1); ctx.lineTo(cx-r*0.3, cy+r);
        ctx.stroke();
    }
}

function drawRangePreview() {
    if (!gameState.selectedType || !gameState.hoverCell) return;
    const { c, r } = gameState.hoverCell;
    const def = TOWER_DEFS[gameState.selectedType];
    const cx = c*CELL + CELL/2, cy = r*CELL + CELL/2;
    const canPlace = !PATH_SET.has(`${c},${r}`) && !gameState.towers.find(t => t.col===c && t.row===r);
    const clr = canPlace ? def.color : '#ff4444';

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = clr;
    ctx.beginPath(); ctx.arc(cx, cy, def.range, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = clr; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, def.range, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = canPlace ? 'rgba(80,255,80,0.14)' : 'rgba(255,80,80,0.14)';
    ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
}

function drawEnemies(ts) {
    gameState.enemies.forEach(e => {
        const slowed = ts < e.slowUntil;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(e.x, e.y+e.r, e.r*0.8, 3, 0, 0, Math.PI*2); ctx.fill();

        // Body
        ctx.fillStyle   = slowed ? '#88ccff' : e.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

        // Eye facing travel direction
        const wp = WAYPOINTS[Math.min(e.wpIdx, WAYPOINTS.length-1)];
        const dx = wp.x - e.x, dy = wp.y - e.y, len = Math.sqrt(dx*dx+dy*dy) || 1;
        const ex = e.x + dx/len*e.r*0.35, ey = e.y + dy/len*e.r*0.35;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex, ey, e.r*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + dx/len*e.r*0.09, ey + dy/len*e.r*0.09, e.r*0.14, 0, Math.PI*2); ctx.fill();

        // HP bar
        const bw = e.r*2.4, bh = 4, bx = e.x - bw/2, by = e.y - e.r - 8;
        ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = pct > 0.6 ? '#44ee44' : pct > 0.3 ? '#eeee44' : '#ee4444';
        ctx.fillRect(bx, by, bw*pct, bh);

        // Frost ring
        if (slowed) {
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r+4, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    });
}

function drawProjectiles() {
    gameState.projectiles.forEach(p => {
        ctx.shadowColor = p.color; ctx.shadowBlur = 7;
        ctx.fillStyle   = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.shadowBlur = 0;
}

function drawParticles() {
    gameState.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle   = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5555';
    ctx.font = `bold 34px 'Courier New', monospace`;
    ctx.fillText('GAME OVER', W/2, H/2 - 28);
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `17px 'Courier New', monospace`;
    ctx.fillText(`Survived ${gameState.waveNum} wave${gameState.waveNum !== 1 ? 's' : ''}`, W/2, H/2 + 8);
    ctx.fillStyle = '#888899';
    ctx.font = `13px 'Courier New', monospace`;
    ctx.fillText('Tap ▶ PLAY AGAIN below to restart', W/2, H/2 + 36);
}

// ── Input ──────────────────────────────────────────────────────────────────────
function canvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.changedTouches ? e.changedTouches[0] : e;
    return {
        x: (src.clientX - rect.left) * (W / rect.width),
        y: (src.clientY - rect.top)  * (H / rect.height),
    };
}

function onTap(px, py) {
    debugLog('onTap called', { px, py, gameOverActive: gameState.gameOver });

    initAudio();
    if (gameState.gameOver) return;

    const c = Math.floor(px / CELL), r = Math.floor(py / CELL);
    debugLog('Grid cell', { c, r, COLS, ROWS });

    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) {
        debugLog('Click outside grid');
        return;
    }

    // Tapped a placed tower?
    const hit = gameState.towers.find(t => t.col === c && t.row === r);
    if (hit) {
        debugLog('Hit tower', { type: hit.type });
        if (gameState.selectedTower === hit) {
            gameState.selectedTower = null;
            sellBtn.classList.add('hidden');
            setInfo('');
        } else {
            gameState.selectedTower = hit;
            gameState.selectedType  = null;
            deselectBtns();
            const def = TOWER_DEFS[hit.type];
            const sv  = Math.floor(def.cost * 0.6);
            setInfo(`${def.name} · ${def.desc}`);
            sellBtn.textContent = `Sell ${sv}♦`;
            sellBtn.classList.remove('hidden');
            sellBtn.onclick = () => {
                gameState.gold += sv; updateHUD();
                gameState.towers = gameState.towers.filter(t => t !== gameState.selectedTower);
                gameState.selectedTower = null;
                sellBtn.classList.add('hidden');
                setInfo('Tower sold');
            };
        }
        return;
    }

    // Place a tower
    debugLog('Attempting to place tower', {
        selectedType: gameState.selectedType,
        isPath: PATH_SET.has(`${c},${r}`),
        gold: gameState.gold,
        towerCount: gameState.towers.length
    });

    if (!gameState.selectedType) {
        debugLog('No tower type selected');
        setInfo('Pick a tower type from the panel below');
        return;
    }

    if (PATH_SET.has(`${c},${r}`)) {
        debugLog('Attempting to place on path');
        setInfo("Can't build on the path!");
        return;
    }

    if (gameState.towers.find(t => t.col===c && t.row===r)) {
        debugLog('Cell already occupied');
        setInfo('Cell already occupied!');
        return;
    }

    const def = TOWER_DEFS[gameState.selectedType];
    if (gameState.gold < def.cost) {
        debugLog('Insufficient gold', { need: def.cost, have: gameState.gold });
        setInfo(`Need ${def.cost}♦ (you have ${gameState.gold}♦)`);
        return;
    }

    debugLog('Tower placed successfully', { type: gameState.selectedType });
    gameState.gold -= def.cost;
    updateHUD();
    gameState.towerMgr.add(gameState.selectedType, c, r, gameState.entityIds);
    gameState.selectedTower = null;
    sellBtn.classList.add('hidden');
    sfxPlace();
    setInfo(`${def.name} placed`);
}

canvas.addEventListener('click',      e => { const { x,y } = canvasXY(e); onTap(x, y); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); const { x,y } = canvasXY(e); onTap(x, y); }, { passive: false });
canvas.addEventListener('mousemove',  e => {
    if (!gameState.selectedType) { gameState.hoverCell = null; return; }
    const { x,y } = canvasXY(e);
    const c = Math.floor(x/CELL), r = Math.floor(y/CELL);
    gameState.hoverCell = (c>=0 && c<COLS && r>=0 && r<ROWS) ? { c, r } : null;
});
canvas.addEventListener('mouseleave', () => { gameState.hoverCell = null; });

// Tower buttons
document.querySelectorAll('.tbtn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        debugLog('Tower button clicked', { type: btn.dataset.type });
        if (gameState.gameOver) return;
        const type = btn.dataset.type;
        if (gameState.selectedType === type) {
            gameState.selectedType = null;
            deselectBtns();
            setInfo('');
            debugLog('Tower deselected', { type });
            return;
        }
        gameState.selectedType  = type;
        gameState.selectedTower = null;
        deselectBtns();
        btn.classList.add('active');
        sellBtn.classList.add('hidden');
        const def = TOWER_DEFS[type];
        setInfo(`${def.name} · ${def.cost}♦ · ${def.desc}`);
        debugLog('Tower selected', { type, cost: def.cost });
    });
});

function deselectBtns() {
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
}

waveBtn.addEventListener('click', () => {
    initAudio();
    if (gameState.gameOver) { newGame(); return; }
    startWave();
});

// Settings button
settingsBtn.addEventListener('click', () => {
    initAudio();
    if (gameState.waveActive || gameState.gameOver) return;
    showSettingsModal();
});

// ── Loop ───────────────────────────────────────────────────────────────────────
let loopRunning = false;
function loop(ts) {
    const dt = Math.min(ts - gameState.lastTimestamp, 50);
    gameState.lastTimestamp = ts;
    if (!gameState.gameOver) {
        updateEnemies(ts, dt);
        updateTowers(ts);
        updateProjectiles(ts, dt);
    }
    updateParticles(dt);
    draw(ts);
    if (loopRunning) requestAnimationFrame(loop);
}

function startLoop() {
    if (!loopRunning) {
        loopRunning = true;
        gameState.lastTimestamp = performance.now();
        requestAnimationFrame(loop);
    }
}

function stopLoop() {
    loopRunning = false;
}

// Test helper - expose gameState for testing
function getGameState() {
    return gameState;
}

// ── Version Display ────────────────────────────────────────────────────────────
function displayVersion() {
    const versionEl = document.getElementById('version-display');
    if (!versionEl) return;

    if (typeof VERSION_INFO === 'undefined') {
        versionEl.innerHTML = 'Version: Unknown';
        return;
    }

    versionEl.innerHTML = `
        <div>${VERSION_INFO.getVersionString()}</div>
        <div>${VERSION_INFO.gitHash}</div>
    `;

    // Tooltip with full info on hover
    versionEl.title = VERSION_INFO.getDetailedInfo();
}

// Only initialize if not in test mode
if (typeof TEST_MODE === 'undefined' || !TEST_MODE) {
    initializeGame();
    startLoop();
    displayVersion();
}
