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
    background: {
      type: 'gradient',
      colors: ['#162210', '#0a1208'],
      dayColors: ['#dff0d0', '#c3e6a8']
    }
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
    background: {
      type: 'gradient',
      colors: ['#1a2840', '#0a1520'],
      dayColors: ['#dbe9fb', '#bcd6f2']
    }
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
    background: {
      type: 'gradient',
      colors: ['#2a1840', '#1a0a30'],
      dayColors: ['#f0e0fa', '#dcc0f0']
    }
  },
  'lava': {
    id: 'lava',
    name: 'Lava Flow',
    pathTiles: [
      [2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],
      [9,1],[9,2],
      [8,2],[7,2],[6,2],[5,2],[4,2],[3,2],[2,2],[1,2],
      [1,3],[1,4],
      [2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],
      [8,5],[8,6],
      [7,6],[6,6],[5,6],[4,6],[3,6],
      [3,7],
      [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],
    ],
    background: {
      type: 'gradient',
      colors: ['#3d150a', '#180705'],
      dayColors: ['#ffe3c4', '#ffc48f']
    }
  }
};

// ── Color scheme (dark / day) canvas tint tokens ────────────────────────────
const CANVAS_THEMES = {
  dark: {
    offPath:   'rgba(0,0,0,0.15)',
    gridLine:  'rgba(40,60,30,0.7)',
    pathArrow: 'rgba(255,230,120,0.18)',
  },
  day: {
    offPath:   'rgba(255,255,255,0.45)',
    gridLine:  'rgba(20,20,20,0.15)',
    pathArrow: 'rgba(60,40,10,0.28)',
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

function getTowerStats(tower) {
  const baseDef = TOWER_DEFS[tower.type];
  const level = tower.level || 1;
  const levelBonus = level - 1;

  return {
    ...baseDef,
    dmg: Math.round(baseDef.dmg * (1 + levelBonus * 0.25)),
    range: Math.round(baseDef.range * (1 + levelBonus * 0.10)),
    cd: Math.round(baseDef.cd / (1 + levelBonus * 0.20)),
    level: level
  };
}

const ENEMY_DEFS = {
  basic:     { hp:40,  spd:0.08,  reward:10,  color:'#ee4444', r:8  },
  fast:      { hp:22,  spd:0.18,  reward:12,  color:'#ffaa22', r:7  },
  tank:      { hp:180, spd:0.045, reward:35,  color:'#9944cc', r:12 },
  boss:      { hp:900, spd:0.038, reward:120, color:'#ff2200', r:18 },
  armored:   { hp:110, spd:0.05,  reward:25,  color:'#8890a0', r:11, armored:true },
  splitter:  { hp:50,  spd:0.09,  reward:14,  color:'#33cc99', r:9,  splitsInto:'splitling', splitCount:2 },
  splitling: { hp:14,  spd:0.12,  reward:4,   color:'#77eebb', r:5  },
  flying:    { hp:30,  spd:0.11,  reward:18,  color:'#f0f0ff', r:7,  flying:true },
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
// PHASE 0: ACHIEVEMENT SYSTEM - Player Milestones & Progression
// ════════════════════════════════════════════════════════════════════════════════

const ACHIEVEMENTS = {
  'first_wave': {
    id: 'first_wave',
    name: 'First Wave',
    desc: 'Complete wave 1',
    icon: '🌊',
    condition: (stats) => stats.waveNum >= 1
  },
  'tower_master': {
    id: 'tower_master',
    name: 'Tower Master',
    desc: 'Place 50 towers',
    icon: '🏰',
    condition: (stats) => stats.towersPlaced >= 50
  },
  'endless': {
    id: 'endless',
    name: 'Endless',
    desc: 'Survive 20 waves',
    icon: '♾️',
    condition: (stats) => stats.waveNum >= 20
  },
  'speedrun': {
    id: 'speedrun',
    name: 'Speedrun',
    desc: 'Clear wave 5 in <5 min',
    icon: '⚡',
    condition: (stats) => stats.waveNum >= 5 && stats.gameTime <= 300000
  },
  'minimalist': {
    id: 'minimalist',
    name: 'Minimalist',
    desc: 'Clear wave 5 with <10 towers',
    icon: '✨',
    condition: (stats) => stats.waveNum >= 5 && stats.towersPlaced < 10
  }
};

class AchievementManager {
  constructor() {
    this.unlockedAchievements = this.loadAchievements();
  }

  isUnlocked(achievementId) {
    return this.unlockedAchievements.has(achievementId);
  }

  unlock(achievementId) {
    if (this.unlockedAchievements.has(achievementId)) return null;
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return null;
    this.unlockedAchievements.add(achievementId);
    this.saveAchievements();
    return achievement;
  }

  checkAndUnlock(achievementId, stats) {
    if (this.isUnlocked(achievementId)) return null;
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement || !achievement.condition(stats)) return null;
    return this.unlock(achievementId);
  }

  getProgress() {
    return {
      total: Object.keys(ACHIEVEMENTS).length,
      unlocked: this.unlockedAchievements.size,
      list: Object.values(ACHIEVEMENTS).map(a => ({
        ...a,
        locked: !this.isUnlocked(a.id)
      }))
    };
  }

  loadAchievements() {
    try {
      const data = localStorage.getItem('td_achievements');
      return new Set(data ? JSON.parse(data) : []);
    } catch (e) {
      console.warn('Failed to load achievements:', e);
      return new Set();
    }
  }

  saveAchievements() {
    try {
      localStorage.setItem('td_achievements', JSON.stringify(Array.from(this.unlockedAchievements)));
    } catch (e) {
      console.warn('Failed to save achievements:', e);
    }
  }

  reset() {
    this.unlockedAchievements.clear();
    this.saveAchievements();
  }
}

// ── Color scheme (dark / day) state ─────────────────────────────────────────
let colorScheme = GameStorage.loadSettings().colorScheme === 'day' ? 'day' : 'dark';

function applyColorScheme(scheme) {
  colorScheme = scheme === 'day' ? 'day' : 'dark';
  document.documentElement.setAttribute('data-theme', colorScheme);
  GameStorage.saveSettings({ ...GameStorage.loadSettings(), colorScheme });
}

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 0: GAME STATE - Encapsulated Mutable State
// ════════════════════════════════════════════════════════════════════════════════

function createGameState(mapId = 'classic', difficulty = 'normal') {
  const diffDef = DIFFICULTY_DEFS[difficulty];
  const enemyManager = new EnemyManager();
  const towerManager = new TowerManager();
  const projectileManager = new ProjectileManager();
  const particleManager = new ParticleManager();
  const gameStartTime = Date.now();
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
      gameStartTime: gameStartTime,
      towersPlaced: 0,
      waveNum: 0,
      gameTime: 0,
      lives: diffDef.startLives
    }
  };
}

// Game state instance - initialized after manager classes are defined
let gameState;
let PATH_SET;
let WAYPOINTS;

// Filters an array in place so its object identity never changes — required
// because gameState.<list> and gameState.<x>Mgr.<list> alias the same array;
// reassigning (arr = arr.filter(...)) breaks that alias for one side.
function filterInPlace(arr, predicate) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (predicate(arr[read])) arr[write++] = arr[read];
  }
  arr.length = write;
  return arr;
}

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

  spawn(type, entityIds, difficulty, waveNum, spawnPos = null) {
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
      x: spawnPos ? spawnPos.x : WAYPOINTS[0].x,
      y: spawnPos ? spawnPos.y : WAYPOINTS[0].y,
      wpIdx: spawnPos ? spawnPos.wpIdx : 1,
      slowUntil: 0,
      dead: false,
      escaped: false,
      armored: !!def.armored,
      flying: !!def.flying,
      splitsInto: def.splitsInto || null,
      splitCount: def.splitCount || 0,
      flightDist: 0,
    };
    if (enemy.flying) {
      const exit = WAYPOINTS[WAYPOINTS.length - 1];
      enemy.flightDist = Math.hypot(exit.x - enemy.x, exit.y - enemy.y) || 1;
    }
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
    filterInPlace(this.enemies, e => !e.dead && !e.escaped);
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
      lastFired: 0,
      level: 1
    };
    this.towers.push(tower);
    return tower;
  }

  getUpgradeCost(tower) {
    const baseCost = TOWER_DEFS[tower.type].cost;
    const multipliers = [0, 1.5, 2.0]; // level 2 costs 1.5x, level 3 costs 2x
    return Math.ceil(baseCost * multipliers[tower.level]);
  }

  canUpgrade(tower) {
    return tower.level < 3;
  }

  upgrade(tower) {
    if (!this.canUpgrade(tower)) {
      return false;
    }
    tower.level++;
    return true;
  }

  getAll() {
    return this.towers;
  }

  remove(towerId) {
    filterInPlace(this.towers, t => t.id !== towerId);
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
    filterInPlace(this.projectiles, p => !p.done);
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
    filterInPlace(this.particles, p => p.life > 0);
  }

  count() {
    return this.particles.length;
  }

  clear() {
    this.particles = [];
  }
}

// Initialize gameState after manager classes are defined
gameState = createGameState();
PATH_SET = createMapPathSet(gameState.mapId);
WAYPOINTS = createMapWaypoints(gameState.mapId);

// Initialize achievement system
const achievementMgr = new AchievementManager();

// Function to show achievement overlay
function showAchievementOverlay(achievement) {
  if (!achievement) return;
  const overlay = document.getElementById('achievement-overlay');
  document.getElementById('achievement-name').textContent = achievement.name;
  document.getElementById('achievement-desc').textContent = achievement.desc;
  overlay.classList.remove('hidden');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 3500);
}

// Function to update game stats and check achievements
function checkAchievements() {
  const stats = gameState.stats;
  stats.waveNum = gameState.waveNum;
  stats.gameTime = Date.now() - stats.gameStartTime;
  stats.lives = gameState.lives;

  // Check all achievements and unlock any new ones
  Object.values(ACHIEVEMENTS).forEach(achievement => {
    const newAchievement = achievementMgr.checkAndUnlock(achievement.id, stats);
    if (newAchievement) {
      showAchievementOverlay(newAchievement);
      debugLog('Achievement unlocked:', newAchievement.name);
    }
  });
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

// ── Validate that a saved game matches the current save format ─────────────
function isValidSave(savedGame) {
    return !!savedGame
        && !!DIFFICULTY_DEFS[savedGame.difficulty]
        && !!MAPS[savedGame.mapId]
        && Array.isArray(savedGame.towers)
        && Array.isArray(savedGame.enemies)
        && Array.isArray(savedGame.projectiles)
        && Array.isArray(savedGame.particles)
        && !!savedGame.entityIds
        && !!savedGame.stats;
}

// Restores a saved game as the live gameState, rebuilding the manager
// classes (not persisted) and re-baselining performance.now()-based timing
// fields (tower.lastFired, enemy.slowUntil, waveStartTime). performance.now()
// resets to ~0 on every page load, but those fields were saved as absolute
// values from the previous session's clock -- without re-baselining they'd
// read as "in the future", leaving towers unable to fire (and rendering as
// a solid white blob, since the shoot-flash alpha is computed from the same
// stale delta) until real elapsed time in the new session caught up.
function resumeGame(savedGame) {
    gameState = savedGame;
    PATH_SET = createMapPathSet(gameState.mapId);
    WAYPOINTS = createMapWaypoints(gameState.mapId);

    const now = performance.now();
    const timeShift = now - gameState.lastTimestamp;
    gameState.lastTimestamp = now;
    gameState.waveStartTime += timeShift;

    // Rebuild managers and spatial structures (not persisted)
    const enemyManager = new EnemyManager();
    gameState.enemies.forEach(e => {
        e.slowUntil += timeShift;
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
        t.lastFired += timeShift;
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
}

// ── Initialize game with difficulty/map selection ───────────────────────────
function initializeGame() {
    let savedGame = GameStorage.loadGame();

    if (savedGame && !isValidSave(savedGame)) {
        // Incompatible save from an older version of the game — discard it.
        GameStorage.deleteGame();
        savedGame = null;
    }

    if (savedGame) {
        showModal(resumeModal);
        const diffName = DIFFICULTY_DEFS[savedGame.difficulty].name;
        const mapName = MAPS[savedGame.mapId].name;
        document.getElementById('resume-info').textContent =
            `Wave ${savedGame.waveNum} · ${diffName} · ${mapName}`;

        document.getElementById('resume-continue-btn').onclick = () => {
            hideModal(resumeModal);
            resumeGame(savedGame);
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
        if (setting === 'colorScheme' && value === colorScheme) {
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
            if (setting === 'colorScheme') {
                applyColorScheme(value);
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
    if (n >= 3) add('fast',     Math.min(Math.floor(n * 0.7), 10), 800,  500);
    if (n >= 4) add('splitter', Math.min(Math.floor(n * 0.3), 5),  1600, 700);
    if (n >= 5) add('tank',     Math.min(Math.floor(n * 0.4), 6),  2000, 1000);
    if (n >= 6) add('armored',  Math.min(Math.floor(n * 0.25), 4), 1900, 1300);
    if (n >= 8) add('flying',   Math.min(Math.floor(n * 0.3), 6),  1400, 900);
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

    const wpLast = WAYPOINTS.length - 1;
    gameState.enemies.forEach(e => {
        if (e.dead || e.escaped) return;
        if (e.wpIdx >= WAYPOINTS.length) { e.escaped = true; return; }

        const spd  = e.spd * (ts < e.slowUntil ? 0.45 : 1);
        const move = spd * dt;
        const wp   = e.flying ? WAYPOINTS[wpLast] : WAYPOINTS[e.wpIdx];
        const dx   = wp.x - e.x, dy = wp.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= move) {
            e.x = wp.x; e.y = wp.y;
            e.wpIdx = e.flying ? WAYPOINTS.length : e.wpIdx + 1;
        } else {
            e.x += (dx/dist)*move; e.y += (dy/dist)*move;
            // Flying enemies ignore the path, so approximate wpIdx from straight-line
            // progress toward the exit — keeps tower targeting priority comparable to ground enemies.
            if (e.flying) {
                const progress = 1 - (dist / e.flightDist);
                e.wpIdx = Math.max(1, Math.min(wpLast - 1, 1 + Math.floor(progress * (wpLast - 1))));
            }
        }
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
        if (e.splitsInto && e.splitCount > 0) {
            for (let i = 0; i < e.splitCount; i++) {
                gameState.enemyMgr.spawn(e.splitsInto, gameState.entityIds, gameState.difficulty, gameState.waveNum, { x: e.x, y: e.y, wpIdx: e.wpIdx });
            }
        }
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
        checkAchievements();
        autoSaveGame();
    }
}

// ── Update: towers ─────────────────────────────────────────────────────────────
function updateTowers(ts) {
    gameState.towers.forEach(tower => {
        const def = getTowerStats(tower);
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
    filterInPlace(gameState.projectiles, p => !p.done);
}

function hit(e, dmg, ts, slow) {
    e.hp -= e.armored ? dmg * 0.5 : dmg;
    if (slow && !e.armored) e.slowUntil = Math.max(e.slowUntil, ts + slow);
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
    const theme = CANVAS_THEMES[colorScheme];
    const gradColors = (colorScheme === 'day' && bgData.dayColors) ? bgData.dayColors : bgData.colors;

    // Render map background
    if (bgData.type === 'gradient') {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, gradColors[0]);
        grad.addColorStop(1, gradColors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // Terrain background
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.fillStyle = PATH_SET.has(`${c},${r}`) ? '#3a3210' : theme.offPath;
            ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
        }
    }

    // Grid lines
    ctx.strokeStyle = theme.gridLine;
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
    ctx.fillStyle = theme.pathArrow;
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
        const def = getTowerStats(t);
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

        // Level indicator
        if (t.level > 1) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.level, t.x, t.y + CELL*0.28);
        }

        // Shoot flash
        const frac = (ts - t.lastFired) / def.cd;
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

        // Shadow (flying enemies cast a smaller, offset shadow to read as airborne)
        if (e.flying) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath(); ctx.ellipse(e.x, e.y+e.r+5, e.r*0.6, 2.5, 0, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(e.x, e.y+e.r, e.r*0.8, 3, 0, 0, Math.PI*2); ctx.fill();
        }

        // Body
        ctx.fillStyle   = slowed ? '#88ccff' : e.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

        // Armor plating
        if (e.armored) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r*0.6, 0, Math.PI*2); ctx.stroke();
        }

        // Splitter marker
        if (e.splitsInto) {
            ctx.setLineDash([3,2]);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r+3, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Altitude ring for flying enemies
        if (e.flying) {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r+6, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Eye facing travel direction
        const wp = e.flying ? WAYPOINTS[WAYPOINTS.length-1] : WAYPOINTS[Math.min(e.wpIdx, WAYPOINTS.length-1)];
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

// Highlight the tower-panel button matching a selected tower's type, so it's
// clear which type to tap (a different one) in order to replace it.
function markCurrentTowerType(type) {
    document.querySelectorAll('.tbtn').forEach(b => {
        b.classList.toggle('current', b.dataset.type === type);
    });
}

function selectTowerInfo(tower) {
    gameState.selectedTower = tower;
    gameState.selectedType  = null;
    deselectBtns();
    markCurrentTowerType(tower.type);

    const baseDef = TOWER_DEFS[tower.type];
    const sv  = Math.floor(baseDef.cost * 0.6);
    const upgradeCost = gameState.towerMgr.getUpgradeCost(tower);
    const canUpgrade = gameState.towerMgr.canUpgrade(tower);
    const goldEnough = gameState.gold >= upgradeCost;

    let info = `${baseDef.name} Lv${tower.level} · ${baseDef.desc} · tap another tower type to replace`;
    if (canUpgrade) {
        info += ` | Upgrade: ${upgradeCost}♦${goldEnough ? '' : ' (need more gold)'}`;
    } else {
        info += ` | Max level`;
    }
    setInfo(info);

    sellBtn.textContent = canUpgrade ? `Upgrade ${upgradeCost}♦` : `Sell ${sv}♦`;
    sellBtn.classList.remove('hidden');
    sellBtn.onclick = () => {
        if (canUpgrade && gameState.gold >= upgradeCost) {
            gameState.gold -= upgradeCost;
            gameState.towerMgr.upgrade(tower);
            updateHUD();
            selectTowerInfo(tower);
        } else {
            gameState.gold += sv;
            updateHUD();
            filterInPlace(gameState.towers, t => t !== tower);
            gameState.selectedTower = null;
            sellBtn.classList.add('hidden');
            markCurrentTowerType(null);
            setInfo('Tower sold');
        }
    };
}

// Swap a selected, already-placed tower for a different type in one step:
// refunds the old tower at the standard sell rate, then charges the new
// tower's full cost (net cost = newCost - refund) and places it at the
// same position and entry level.
function replaceTower(tower, newType) {
    const refund  = Math.floor(TOWER_DEFS[tower.type].cost * 0.6);
    const newCost = TOWER_DEFS[newType].cost;
    if (gameState.gold + refund < newCost) {
        setInfo(`Need ${newCost - (gameState.gold + refund)}♦ more to switch to ${TOWER_DEFS[newType].name}`);
        return;
    }
    gameState.gold += refund - newCost;
    const { col, row } = tower;
    filterInPlace(gameState.towers, t => t !== tower);
    const newTower = gameState.towerMgr.add(newType, col, row, gameState.entityIds);
    updateHUD();
    sfxPlace();
    selectTowerInfo(newTower);
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
            markCurrentTowerType(null);
        } else {
            selectTowerInfo(hit);
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
    gameState.stats.towersPlaced++;
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

        // A tower is selected on the map: treat this as a request to replace it.
        if (gameState.selectedTower) {
            if (type === gameState.selectedTower.type) {
                setInfo(`${TOWER_DEFS[type].name} is already here`);
                return;
            }
            replaceTower(gameState.selectedTower, type);
            return;
        }

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
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active', 'current'));
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

// Expose classes and functions for testing (Node.js environment)
if (typeof global !== 'undefined') {
    global.EnemyManager = EnemyManager;
    global.TowerManager = TowerManager;
    global.ProjectileManager = ProjectileManager;
    global.ParticleManager = ParticleManager;
    global.AchievementManager = AchievementManager;
    global.createGameState = createGameState;
    global.spawnEnemy = spawnEnemy;
    global.createMapWaypoints = createMapWaypoints;
    global.createMapPathSet = createMapPathSet;
    global.displayVersion = displayVersion;
    global.getTowerStats = getTowerStats;
    global.checkAchievements = checkAchievements;
    global.TOWER_DEFS = TOWER_DEFS;
    global.ENEMY_DEFS = ENEMY_DEFS;
    global.DIFFICULTY_DEFS = DIFFICULTY_DEFS;
    global.ACHIEVEMENTS = ACHIEVEMENTS;
    global.WAYPOINTS = WAYPOINTS;
    global.PATH_SET = PATH_SET;
    global.CELL = CELL;
    global.W = W;
    global.H = H;
    global.getGridCell = getGridCell;
    global.getNearbyGridCells = getNearbyGridCells;
    global.updateSpatialGrid = updateSpatialGrid;
    global.updateEnemies = updateEnemies;
    global.updateTowers = updateTowers;
    global.updateProjectiles = updateProjectiles;
    if (typeof VERSION_INFO !== 'undefined') {
        global.VERSION_INFO = VERSION_INFO;
    }
}

// Only initialize if not in test mode
if (typeof TEST_MODE === 'undefined' && typeof module === 'undefined') {
    applyColorScheme(colorScheme);
    initializeGame();
    startLoop();
    displayVersion();
}
