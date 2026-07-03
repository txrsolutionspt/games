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

// ── Path definition ────────────────────────────────────────────────────────────
//
//  Col: 0  1  2  3  4  5  6  7  8  9
//  Row 0:  ●  ●  ●  ●  ●  ●  .  .  .  .   → entry from left
//  Row 1:  .  .  .  .  .  ●  .  .  .  .
//  Row 2:  .  ●  ●  ●  ●  ●  .  .  .  .   ← turns left
//  Row 3:  .  ●  .  .  .  .  .  .  .  .
//  Row 4:  .  ●  .  .  .  .  .  .  .  .
//  Row 5:  .  ●  ●  ●  ●  ●  ●  ●  ●  .   → turns right
//  Row 6:  .  .  .  .  .  .  .  .  ●  .
//  Row 7:  .  .  .  .  .  .  .  .  ●  ●   → exit right

const PATH_TILES = [
    [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],
    [5,1],[5,2],
    [4,2],[3,2],[2,2],[1,2],
    [1,3],[1,4],[1,5],
    [2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],
    [8,6],[8,7],[9,7],
];
const PATH_SET = new Set(PATH_TILES.map(([c,r]) => `${c},${r}`));

// Pixel waypoints: off-left spawn → each tile centre → off-right exit
const WAYPOINTS = [
    { x: -20,        y: CELL / 2 },
    ...PATH_TILES.map(([c,r]) => ({ x: c*CELL + CELL/2, y: r*CELL + CELL/2 })),
    { x: W + 20,     y: 7*CELL + CELL/2 },
];

// ── Tower definitions ──────────────────────────────────────────────────────────
const TDEFS = {
    archer: { name:'Archer', cost:50,  range:90,  dmg:10,  cd:900,  splash:0,  slow:0,    color:'#6bbf3e', pColor:'#c8ff70', pSpd:0.35, pR:4, desc:'Fast · single target' },
    cannon: { name:'Cannon', cost:100, range:80,  dmg:55,  cd:2400, splash:50, slow:0,    color:'#c87c35', pColor:'#ffe070', pSpd:0.20, pR:7, desc:'Slow · area splash' },
    frost:  { name:'Frost',  cost:80,  range:90,  dmg:5,   cd:1200, splash:0,  slow:2200, color:'#35a8d0', pColor:'#aaddff', pSpd:0.28, pR:5, desc:'Slows enemies' },
    laser:  { name:'Laser',  cost:175, range:130, dmg:25,  cd:280,  splash:0,  slow:0,    color:'#d035a8', pColor:'#ff88ee', pSpd:0.55, pR:3, desc:'High DPS · long range' },
};

// ── Enemy definitions ──────────────────────────────────────────────────────────
const EDEFS = {
    basic:   { hp:40,  spd:0.08,  reward:10,  color:'#ee4444', r:8  },
    fast:    { hp:22,  spd:0.18,  reward:12,  color:'#ffaa22', r:7  },
    tank:    { hp:180, spd:0.045, reward:35,  color:'#9944cc', r:12 },
    boss:    { hp:900, spd:0.038, reward:120, color:'#ff2200', r:18 },
};

// ── State ──────────────────────────────────────────────────────────────────────
let gold, lives, waveNum, waveActive, gameOver;
let towers = [], enemies = [], projectiles = [], particles = [];
let selectedType  = null;   // tower type chosen from panel
let selectedTower = null;   // placed tower tapped (for sell)
let spawnQueue    = [];     // { type, t } sorted by t (ms from wave start)
let waveStartTime = 0;
let eid = 0, pid = 0, tid = 0;
let lastTS = 0, hoverCell = null;

// ── Bootstrap ──────────────────────────────────────────────────────────────────
function newGame() {
    gold = 150; lives = 20; waveNum = 0; waveActive = false; gameOver = false;
    towers = []; enemies = []; projectiles = []; particles = [];
    selectedType = null; selectedTower = null; spawnQueue = [];
    eid = pid = tid = 0;
    updateHUD(); updateWaveBtn(); setInfo('Select a tower type, then tap the map to place');
    sellBtn.classList.add('hidden');
}

function updateHUD() {
    goldEl.textContent  = gold;
    livesEl.textContent = lives;
    waveEl.textContent  = waveNum;
}

function updateWaveBtn() {
    if (gameOver) {
        waveBtn.textContent = '▶ PLAY AGAIN';
        waveBtn.disabled    = false;
        return;
    }
    if (waveActive) {
        waveBtn.textContent = `WAVE ${waveNum} IN PROGRESS…`;
        waveBtn.disabled    = true;
    } else {
        waveBtn.textContent = `▶ START WAVE ${waveNum + 1}`;
        waveBtn.disabled    = false;
    }
}

function setInfo(msg) { infoEl.textContent = msg; }

// ── Wave spawning ──────────────────────────────────────────────────────────────
function startWave() {
    if (waveActive || gameOver) return;
    initAudio();
    waveNum++;
    waveActive    = true;
    waveStartTime = performance.now();
    spawnQueue    = buildQueue(waveNum);
    sfxWave();
    updateHUD(); updateWaveBtn();
    setInfo(`Wave ${waveNum} incoming!`);
}

function buildQueue(n) {
    const q = [];
    const add = (type, count, interval, offset = 0) => {
        for (let i = 0; i < count; i++) q.push({ type, t: offset + i * interval });
    };
    add('basic', Math.min(5 + n * 2, 22), 1100);
    if (n >= 3) add('fast',  Math.min(Math.floor(n * 0.7), 10), 800,  500);
    if (n >= 5) add('tank',  Math.min(Math.floor(n * 0.4), 6),  2000, 1000);
    if (n >= 10) add('fast', Math.floor(n * 0.3), 550, 300);
    if (n % 5 === 0) add('boss', 1, 0, 2200);
    return q.sort((a, b) => a.t - b.t);
}

function spawnEnemy(type) {
    const def    = EDEFS[type];
    const hpMult = 1 + (waveNum - 1) * 0.13;
    enemies.push({
        id: ++eid, type,
        hp: Math.round(def.hp * hpMult), maxHp: Math.round(def.hp * hpMult),
        spd: def.spd, reward: def.reward,
        color: def.color, r: def.r,
        x: WAYPOINTS[0].x, y: WAYPOINTS[0].y,
        wpIdx: 1, slowUntil: 0,
        dead: false, escaped: false,
    });
}

// ── Update: enemies ────────────────────────────────────────────────────────────
function updateEnemies(ts, dt) {
    if (waveActive && spawnQueue.length) {
        const elapsed = ts - waveStartTime;
        while (spawnQueue.length && spawnQueue[0].t <= elapsed)
            spawnEnemy(spawnQueue.shift().type);
    }

    enemies.forEach(e => {
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
    enemies.filter(e => e.escaped).forEach(() => {
        lives = Math.max(0, lives - 1);
        updateHUD();
        if (lives <= 0) triggerGameOver();
    });

    // Handle dead (collect gold, particles)
    enemies.filter(e => e.dead).forEach(e => {
        gold += e.reward;
        updateHUD();
        burst(e.x, e.y, e.color, 8, 3);
        sfxDie();
    });

    enemies = enemies.filter(e => !e.dead && !e.escaped);

    if (waveActive && !spawnQueue.length && !enemies.length) {
        waveActive = false;
        gold += 20; // end-wave bonus
        updateHUD(); updateWaveBtn();
        setInfo(`Wave ${waveNum} cleared! +20♦ bonus`);
    }
}

// ── Update: towers ─────────────────────────────────────────────────────────────
function updateTowers(ts) {
    towers.forEach(tower => {
        const def = TDEFS[tower.type];
        if (ts - tower.lastFired < def.cd) return;

        // Pick enemy furthest along path within range
        let target = null, bestWp = -1;
        enemies.forEach(e => {
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

        projectiles.push({
            id: ++pid, type: tower.type,
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
    projectiles.forEach(p => {
        if (p.done) return;

        // Homing: track target
        if (p.targetId) {
            const e = enemies.find(e => e.id === p.targetId);
            if (e) { p.tx = e.x; p.ty = e.y; }
        }

        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = p.spd * dt;

        if (dist <= move + 1) {
            p.x = p.tx; p.y = p.ty;
            p.done = true;
            if (p.splash > 0) {
                // Cannon splash
                burst(p.x, p.y, '#ffaa40', 14, 5);
                enemies.forEach(e => {
                    const ddx=e.x-p.x, ddy=e.y-p.y;
                    if (Math.sqrt(ddx*ddx+ddy*ddy) <= p.splash) hit(e, p.dmg, ts, p.slow);
                });
            } else {
                const e = p.targetId ? enemies.find(e => e.id === p.targetId) : null;
                if (e) hit(e, p.dmg, ts, p.slow);
            }
        } else {
            p.x += (dx/dist)*move;
            p.y += (dy/dist)*move;
        }
    });
    projectiles = projectiles.filter(p => !p.done);
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
        particles.push({
            x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1.2,
            life: 400 + Math.random()*300, maxLife: 700,
            color, r: baseR * (0.5 + Math.random()*0.8),
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ── Game over ──────────────────────────────────────────────────────────────────
function triggerGameOver() {
    gameOver = true; waveActive = false;
    sfxLose();
    updateWaveBtn();
    setInfo(`Game over — survived ${waveNum} wave${waveNum !== 1 ? 's' : ''}`);
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
    if (gameOver) drawGameOver();
}

function drawMap() {
    // Terrain background
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.fillStyle = PATH_SET.has(`${c},${r}`) ? '#2e2510' : '#162210';
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
    PATH_TILES.forEach(([c, r]) => {
        ctx.fillStyle = '#3e3418';
        ctx.fillRect(c*CELL + 5, r*CELL + 5, CELL-10, CELL-10);
    });

    // Path connectors (fill gaps between adjacent tiles)
    for (let i = 0; i < PATH_TILES.length - 1; i++) {
        const [c1,r1] = PATH_TILES[i], [c2,r2] = PATH_TILES[i+1];
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
    for (let i = 0; i < PATH_TILES.length - 1; i++) {
        const [c,r] = PATH_TILES[i], [nc,nr] = PATH_TILES[i+1];
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
    towers.forEach(t => {
        const def = TDEFS[t.type];
        const sel = selectedTower === t;

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
        const frac = (ts - t.lastFired) / TDEFS[t.type].cd;
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
    if (!selectedType || !hoverCell) return;
    const { c, r } = hoverCell;
    const def = TDEFS[selectedType];
    const cx = c*CELL + CELL/2, cy = r*CELL + CELL/2;
    const canPlace = !PATH_SET.has(`${c},${r}`) && !towers.find(t => t.col===c && t.row===r);
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
    enemies.forEach(e => {
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
    projectiles.forEach(p => {
        ctx.shadowColor = p.color; ctx.shadowBlur = 7;
        ctx.fillStyle   = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.shadowBlur = 0;
}

function drawParticles() {
    particles.forEach(p => {
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
    ctx.fillText(`Survived ${waveNum} wave${waveNum !== 1 ? 's' : ''}`, W/2, H/2 + 8);
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
    initAudio();
    if (gameOver) return;

    const c = Math.floor(px / CELL), r = Math.floor(py / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;

    // Tapped a placed tower?
    const hit = towers.find(t => t.col === c && t.row === r);
    if (hit) {
        if (selectedTower === hit) {
            // Deselect
            selectedTower = null;
            sellBtn.classList.add('hidden');
            setInfo('');
        } else {
            selectedTower = hit;
            selectedType  = null;
            deselectBtns();
            const def = TDEFS[hit.type];
            const sv  = Math.floor(def.cost * 0.6);
            setInfo(`${def.name} · ${def.desc}`);
            sellBtn.textContent = `Sell ${sv}♦`;
            sellBtn.classList.remove('hidden');
            sellBtn.onclick = () => {
                gold += sv; updateHUD();
                towers = towers.filter(t => t !== selectedTower);
                selectedTower = null;
                sellBtn.classList.add('hidden');
                setInfo('Tower sold');
            };
        }
        return;
    }

    // Place a tower
    if (!selectedType) { setInfo('Pick a tower type from the panel below'); return; }
    if (PATH_SET.has(`${c},${r}`)) { setInfo("Can't build on the path!"); return; }
    if (towers.find(t => t.col===c && t.row===r)) { setInfo('Cell already occupied!'); return; }

    const def = TDEFS[selectedType];
    if (gold < def.cost) { setInfo(`Need ${def.cost}♦ (you have ${gold}♦)`); return; }

    gold -= def.cost; updateHUD();
    towers.push({
        id: ++tid, type: selectedType, col: c, row: r,
        x: c*CELL + CELL/2, y: r*CELL + CELL/2,
        lastFired: 0,
    });
    selectedTower = null;
    sellBtn.classList.add('hidden');
    sfxPlace();
    setInfo(`${def.name} placed`);
}

canvas.addEventListener('click',      e => { const { x,y } = canvasXY(e); onTap(x, y); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); const { x,y } = canvasXY(e); onTap(x, y); }, { passive: false });
canvas.addEventListener('mousemove',  e => {
    if (!selectedType) { hoverCell = null; return; }
    const { x,y } = canvasXY(e);
    const c = Math.floor(x/CELL), r = Math.floor(y/CELL);
    hoverCell = (c>=0 && c<COLS && r>=0 && r<ROWS) ? { c, r } : null;
});
canvas.addEventListener('mouseleave', () => { hoverCell = null; });

// Tower buttons
document.querySelectorAll('.tbtn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        if (gameOver) return;
        const type = btn.dataset.type;
        if (selectedType === type) {
            selectedType = null; deselectBtns(); setInfo(''); return;
        }
        selectedType  = type;
        selectedTower = null;
        deselectBtns(); btn.classList.add('active');
        sellBtn.classList.add('hidden');
        const def = TDEFS[type];
        setInfo(`${def.name} · ${def.cost}♦ · ${def.desc}`);
    });
});

function deselectBtns() {
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
}

waveBtn.addEventListener('click', () => {
    initAudio();
    if (gameOver) { newGame(); return; }
    startWave();
});

// ── Loop ───────────────────────────────────────────────────────────────────────
function loop(ts) {
    const dt = Math.min(ts - lastTS, 50);
    lastTS = ts;
    if (!gameOver) {
        updateEnemies(ts, dt);
        updateTowers(ts);
        updateProjectiles(ts, dt);
    }
    updateParticles(dt);
    draw(ts);
    requestAnimationFrame(loop);
}

newGame();
requestAnimationFrame(loop);
