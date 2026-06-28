'use strict';

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const GW = 480, GH = 720;
canvas.width  = GW;
canvas.height = GH;

// ── Audio ─────────────────────────────────────────────────────────────────────
let audioCtx = null, masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(audioCtx.destination);
}

function sfxShoot() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1100, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.055);
    g.gain.setValueAtTime(0.07, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.055);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.055);
}

function sfxExplosion(size) {
    if (!audioCtx) return;
    const len = Math.floor(audioCtx.sampleRate * (0.18 + size * 0.12));
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 1.6+size*0.4);
    const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
    src.buffer = buf;
    g.gain.value = Math.min(0.55, 0.18 * size);
    src.connect(g); g.connect(masterGain); src.start();
}

function sfxPowerup() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.22);
    g.gain.setValueAtTime(0.22, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.22);
}

function sfxDamage() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.28);
    g.gain.setValueAtTime(0.38, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.28);
}

function sfxBomb() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.45, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.5);
    sfxExplosion(4);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAYER_SPEED    = 240;
const PLAYER_R        = 16;
const HITBOX_R        = 5;   // sweet-spot hitbox (classic shmup style)
const BULLET_SPD      = 540;
const ENEMY_BULLET_SPD = 185;
const BASE_FIRE_RATE  = 0.13;
const MAX_PLAYER_BULLETS = 32;

// ── State ─────────────────────────────────────────────────────────────────────
let state, score, highScore, wave, combo, comboTimer, maxCombo;
let shakeX, shakeY, gameOverTimer;
let player, playerBullets, enemyBullets, enemies, particles, powerups, floatTexts;
let stars, nebulaPoints;
let waveActive, betweenWaves, betweenWaveTimer;
let spawnQueue, spawnTimer;
let spreadTimer, beamTimer, invTimer, speedTimer, bombCooldown;
let fireTimer = 0, hitStopTimer = 0;
let keys = {};
let mouseX = GW / 2, mouseY = GH - 80, mouseAim = false;

highScore = parseInt(localStorage.getItem('sa_hs') || '0');

// ── Starfield ─────────────────────────────────────────────────────────────────
function buildStarfield() {
    stars = [];
    for (let i = 0; i < 90; i++)  stars.push({ x: rnd()*GW, y: rnd()*GH, r: 0.4, spd: 16, a: 0.28 });
    for (let i = 0; i < 55; i++)  stars.push({ x: rnd()*GW, y: rnd()*GH, r: 0.85, spd: 38, a: 0.5 });
    for (let i = 0; i < 22; i++)  stars.push({ x: rnd()*GW, y: rnd()*GH, r: 1.6, spd: 70, a: 0.85 });

    // subtle nebula clouds (static coloured blobs drawn once)
    nebulaPoints = [];
    const cols = ['#1A0830','#0A1A35','#1A100A','#081A18'];
    for (let i = 0; i < 6; i++) {
        nebulaPoints.push({ x: rnd()*GW, y: rnd()*GH, r: 80+rnd()*110, col: cols[i%cols.length] });
    }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
const rnd  = () => Math.random();
const rndA = () => rnd() * Math.PI * 2;
function shuffle(a) {
    for (let i = a.length-1; i > 0; i--) {
        const j = Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
}
function hex2rgb(hex) {
    const n = parseInt(hex.replace('#',''), 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
}
function shake(mag) {
    shakeX = (rnd()-0.5)*mag*2;
    shakeY = (rnd()-0.5)*mag*2;
}
function burst(x, y, col, n, spd, sz=2, life=0.65) {
    for (let i = 0; i < n; i++) {
        const a = rndA(), s = spd*(0.35+rnd()*0.85);
        particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, col, r: sz*(0.5+rnd()), life, maxLife: life });
    }
    particles.push({ x, y, vx:0, vy:0, col:'#FFFFFF', r: sz*7, life:0.14, maxLife:0.14, glow:true });
}
function addFloat(x, y, text, col) {
    floatTexts.push({ x, y, text, col, life:1.8, maxLife:1.8 });
}
function comboMult() {
    if (combo < 3)  return 1;
    if (combo < 8)  return 2;
    if (combo < 15) return 3;
    if (combo < 25) return 5;
    return 10;
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
    state = 'PLAYING';
    score = 0; wave = 0; combo = 0; comboTimer = 0; maxCombo = 0;
    shakeX = 0; shakeY = 0; gameOverTimer = 0;
    waveActive = false; betweenWaves = true; betweenWaveTimer = 1.5;
    spawnQueue = []; spawnTimer = 0;
    spreadTimer = 0; beamTimer = 0; invTimer = 0; speedTimer = 0;
    bombCooldown = 0; fireTimer = 0; hitStopTimer = 0;
    mouseAim = false;

    player = { x: GW/2, y: GH-90, hp:3, maxHp:3, invFrames:0, trail:[] };

    playerBullets = []; enemyBullets = []; enemies = [];
    particles = []; powerups = []; floatTexts = [];
    buildStarfield();
}

// ── Wave config ───────────────────────────────────────────────────────────────
function waveConfig(w) {
    const boss = w > 0 && w % 5 === 0;
    return {
        grunts:   boss ? 0 : Math.min(4 + w*3, 36),
        divers:   boss ? 0 : (w >= 3 ? Math.floor((w-2)*1.3) : 0),
        tanks:    boss ? 0 : (w >= 6 ? Math.floor((w-5)*0.85) : 0),
        boss:     boss,
        speed:    1 + w*0.065,
        fireRate: Math.max(0.55, 3.8 - w*0.16),
    };
}

// ── Wave spawning ─────────────────────────────────────────────────────────────
function startWave() {
    wave++;
    const cfg = waveConfig(wave);
    spawnQueue = [];

    const rowSize = Math.min(8, 3 + Math.floor(wave/2));
    let gLeft = cfg.grunts;
    while (gLeft > 0) {
        const n = Math.min(rowSize, gLeft);
        spawnQueue.push({ type:'gruntRow', count:n, speed:cfg.speed, fireRate:cfg.fireRate });
        gLeft -= n;
    }
    for (let i = 0; i < cfg.divers; i++) spawnQueue.push({ type:'diver', speed:cfg.speed, fireRate:cfg.fireRate });
    for (let i = 0; i < cfg.tanks;  i++) spawnQueue.push({ type:'tank',  speed:cfg.speed, fireRate:cfg.fireRate });

    let bossSpec = null;
    if (cfg.boss) bossSpec = { type:'boss', speed:cfg.speed };

    shuffle(spawnQueue);
    if (bossSpec) spawnQueue.push(bossSpec);

    spawnTimer = 0.6;
    waveActive = true; betweenWaves = false;
}

function doSpawn(spec) {
    if (spec.type === 'gruntRow') {
        const spacing = GW / (spec.count + 1);
        for (let i = 0; i < spec.count; i++) {
            enemies.push({
                type:'grunt',
                x: spacing*(i+1), y: -30 - i*6,
                vx: (rnd()-0.5)*18, vy: 60*spec.speed,
                hp:1, maxHp:1, r:13,
                fireTimer: 1.5 + rnd()*spec.fireRate,
                fireRate: spec.fireRate,
                phase:'descend',
                formY: 70 + Math.floor(rnd()*3)*52,
                formBaseX: spacing*(i+1),
                sineT: rnd()*Math.PI*2,
                sineSpd: 0.9 + rnd()*0.4,
                sineAmp: 30 + rnd()*35,
                speed: spec.speed,
                diveTimer: 3.5 + rnd()*5,
                col:'#44AAFF',
            });
        }
    } else if (spec.type === 'diver') {
        enemies.push({
            type:'diver',
            x: rnd()*(GW-80)+40, y:-40,
            vx:0, vy: 130*spec.speed,
            hp:2, maxHp:2, r:11,
            fireTimer: 0.6+rnd(),
            fireRate: spec.fireRate*0.65,
            phase:'swoop',
            speed: spec.speed, col:'#FF6644',
        });
    } else if (spec.type === 'tank') {
        enemies.push({
            type:'tank',
            x: rnd()*(GW-100)+50, y:-60,
            vx: (rnd()-0.5)*45, vy: 30*spec.speed,
            hp:8, maxHp:8, r:24,
            fireTimer: 1.8,
            fireRate: spec.fireRate*1.4,
            speed: spec.speed, col:'#FF4488',
            settled: false,
        });
    } else if (spec.type === 'boss') {
        enemies.push({
            type:'boss',
            x: GW/2, y:-120,
            vx: 55, vy: 38*spec.speed,
            hp: 40 + wave*6, maxHp: 40 + wave*6,
            r:52,
            fireTimer: 1.0,
            fireRate: 1.0,
            speed: spec.speed,
            phase:'enter', targetY:120,
            wiggleT:0, shotPhase:0,
            col:'#CC22FF',
        });
    }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
    // hit-stop: decrement in real time, then slow game dt
    if (hitStopTimer > 0) { hitStopTimer = Math.max(0, hitStopTimer - dt); dt *= 0.1; }

    shakeX *= 0.78; shakeY *= 0.78;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

    updateStars(dt);

    if (state === 'PLAYING') {
        updateWaveLogic(dt);
        updatePlayer(dt);
        tryFire(dt);
        updateEnemies(dt);
        updateBullets(dt);
        updatePowerups(dt);
        checkCollisions();
    }

    updateParticles(dt);
    updateFloatTexts(dt);
    if (state === 'GAME_OVER') gameOverTimer += dt;
}

function updateStars(dt) {
    for (const s of stars) {
        s.y += s.spd * dt;
        if (s.y > GH + 2) { s.y = -2; s.x = rnd()*GW; }
    }
}

function updateWaveLogic(dt) {
    if (betweenWaves) {
        betweenWaveTimer -= dt;
        if (betweenWaveTimer <= 0) startWave();
        return;
    }
    if (spawnQueue.length > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            doSpawn(spawnQueue.shift());
            const next = spawnQueue[0];
            spawnTimer = next?.type === 'boss' ? 1.8 : 0.55 + rnd()*0.45;
        }
    }
    if (spawnQueue.length === 0 && enemies.length === 0) {
        waveActive = false; betweenWaves = true; betweenWaveTimer = 3.2;
        const bonus = wave * 150;
        score += bonus;
        addFloat(GW/2, GH/2-60, `WAVE ${wave} CLEAR!  +${bonus}`, '#AAFFAA');
    }
}

function updatePlayer(dt) {
    if (!player) return;
    const spd = speedTimer > 0 ? PLAYER_SPEED*1.65 : PLAYER_SPEED;

    if (mouseAim) {
        const dx = mouseX - player.x, dy = mouseY - player.y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
            player.x += (dx/d) * Math.min(d*9, spd) * dt;
            player.y += (dy/d) * Math.min(d*9, spd) * dt;
        }
    } else {
        let dx = 0, dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight']|| keys['KeyD']) dx += 1;
        if (keys['ArrowUp']   || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        player.x += dx*spd*dt;
        player.y += dy*spd*dt;
    }

    player.x = Math.max(PLAYER_R, Math.min(GW-PLAYER_R, player.x));
    player.y = Math.max(PLAYER_R, Math.min(GH-PLAYER_R, player.y));

    player.trail.push({ x:player.x, y:player.y });
    if (player.trail.length > 14) player.trail.shift();

    if (player.invFrames > 0) player.invFrames -= dt;
    if (bombCooldown > 0) bombCooldown -= dt;
    if (spreadTimer  > 0) spreadTimer  -= dt;
    if (beamTimer    > 0) beamTimer    -= dt;
    if (invTimer     > 0) invTimer     -= dt;
    if (speedTimer   > 0) speedTimer   -= dt;
}

function tryFire(dt) {
    if (!player) return;
    fireTimer -= dt;
    if (fireTimer > 0) return;
    fireTimer = BASE_FIRE_RATE;

    if (beamTimer > 0) {
        playerBullets.push({ x:player.x, y:player.y-PLAYER_R, vx:0, vy:-BULLET_SPD*1.55, r:5, beam:true, life:0.5 });
    } else if (spreadTimer > 0) {
        for (const off of [-0.28, 0, 0.28]) {
            playerBullets.push({
                x:player.x, y:player.y-PLAYER_R,
                vx: Math.sin(off)*BULLET_SPD, vy: -Math.cos(off)*BULLET_SPD,
                r:3, life:1.1,
            });
        }
    } else {
        playerBullets.push({ x:player.x, y:player.y-PLAYER_R, vx:0, vy:-BULLET_SPD, r:3, life:1.1 });
    }
    if (playerBullets.length > MAX_PLAYER_BULLETS) playerBullets.splice(0, playerBullets.length - MAX_PLAYER_BULLETS);
    sfxShoot();
}

function fireSmartBomb() {
    if (!player || bombCooldown > 0) return;
    bombCooldown = 9;

    for (const e of enemies) {
        burst(e.x, e.y, '#FFEE44', 14, 180, 2.5, 0.7);
        e.hp -= Math.ceil(e.hp * 0.65);
    }
    enemies = enemies.filter(e => e.hp > 0);
    enemyBullets = [];

    burst(player.x, player.y, '#FFFFFF', 36, 320, 4, 0.9);
    shake(16);
    sfxBomb();
    addFloat(GW/2, GH/2, 'SMART BOMB!', '#FF8800');
}

// ── Enemy logic ───────────────────────────────────────────────────────────────
function updateEnemies(dt) {
    for (let i = enemies.length-1; i >= 0; i--) {
        const e = enemies[i];

        if      (e.type === 'grunt') updateGrunt(e, dt);
        else if (e.type === 'diver') updateDiver(e, dt);
        else if (e.type === 'tank')  updateTank(e, dt);
        else if (e.type === 'boss')  updateBoss(e, dt);

        // enemy fire
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
            e.fireTimer = e.fireRate * (0.75 + rnd()*0.5);
            spawnEnemyBullet(e);
        }

        // cull offscreen
        if (e.y > GH+100 || e.x < -150 || e.x > GW+150) enemies.splice(i, 1);
    }
}

function updateGrunt(e, dt) {
    if (e.phase === 'descend') {
        e.y += e.vy*dt; e.x += e.vx*dt;
        if (e.y >= e.formY) { e.y = e.formY; e.phase = 'formation'; e.vx = e.driftVx; }
    } else if (e.phase === 'formation') {
        e.sineT += e.sineSpd * dt;
        e.x = Math.max(18, Math.min(GW-18, e.formBaseX + Math.sin(e.sineT) * e.sineAmp));
        e.diveTimer -= dt;
        if (e.diveTimer <= 0) {
            e.phase = 'dive';
            const ang = Math.atan2(player.y-e.y, player.x-e.x) + (rnd()-0.5)*0.55;
            e.vx = Math.cos(ang)*165*e.speed;
            e.vy = Math.max(60, Math.sin(ang)*165*e.speed);
        }
    } else {
        e.x += e.vx*dt; e.y += e.vy*dt;
    }
}

function updateDiver(e, dt) {
    e.y += e.vy*dt;
    if (player && e.y > 50) {
        const tx = player.x - e.x;
        e.vx += tx*2.2*dt;
        const maxV = 220*e.speed;
        if (Math.abs(e.vx) > maxV) e.vx = Math.sign(e.vx)*maxV;
    }
    e.x += e.vx*dt;
    if (e.y > GH+60) { e.y = -40; e.x = rnd()*(GW-80)+40; e.vx = 0; }
}

function updateTank(e, dt) {
    if (!e.settled) {
        e.y += e.vy*dt; e.x += e.vx*dt;
        if (e.x < 50)       { e.x = 50;    e.vx =  Math.abs(e.vx); }
        if (e.x > GW-50)    { e.x = GW-50; e.vx = -Math.abs(e.vx); }
        if (e.y >= 170) { e.y = 170; e.vy = 0; e.settled = true; }
    } else {
        e.x += e.vx*dt;
        if (e.x < 50)    e.vx =  Math.abs(e.vx);
        if (e.x > GW-50) e.vx = -Math.abs(e.vx);
    }
}

function updateBoss(e, dt) {
    if (e.phase === 'enter') {
        e.y += e.vy*dt;
        if (e.y >= e.targetY) { e.y = e.targetY; e.phase = 'fight'; e.vy = 0; }
    } else {
        e.wiggleT += dt;
        e.x += Math.cos(e.wiggleT*0.75)*90*dt;
        e.x  = Math.max(e.r+10, Math.min(GW-e.r-10, e.x));
        // slow drift down and back
        e.y += Math.sin(e.wiggleT*0.4)*18*dt;
        e.y  = Math.max(80, Math.min(220, e.y));
    }
}

function spawnEnemyBullet(e) {
    if (!player) return;
    const aimed = Math.atan2(player.y-e.y, player.x-e.x);

    if (e.type === 'boss') {
        e.shotPhase = (e.shotPhase + 1) % 3;
        if (e.shotPhase === 0) {
            // 5-way spread toward player
            for (let k = -2; k <= 2; k++) {
                enemyBullets.push({
                    x:e.x, y:e.y+e.r*0.5,
                    vx: Math.cos(aimed + k*0.22)*ENEMY_BULLET_SPD*1.25,
                    vy: Math.sin(aimed + k*0.22)*ENEMY_BULLET_SPD*1.25,
                    r:5, col:'#FF44FF', life:3.2,
                });
            }
        } else if (e.shotPhase === 1) {
            // radial burst
            for (let k = 0; k < 10; k++) {
                const a = (k/10)*Math.PI*2;
                enemyBullets.push({ x:e.x, y:e.y, vx:Math.cos(a)*ENEMY_BULLET_SPD, vy:Math.sin(a)*ENEMY_BULLET_SPD, r:4, col:'#CC44FF', life:2.8 });
            }
        } else {
            // twin aimed
            for (const ox of [-e.r*0.6, e.r*0.6]) {
                enemyBullets.push({ x:e.x+ox, y:e.y+20, vx:Math.cos(aimed)*ENEMY_BULLET_SPD*1.1, vy:Math.sin(aimed)*ENEMY_BULLET_SPD*1.1, r:4.5, col:'#FF00CC', life:3 });
            }
        }
    } else if (e.type === 'tank') {
        for (const off of [-0.18, 0, 0.18]) {
            enemyBullets.push({ x:e.x, y:e.y+e.r, vx:Math.cos(aimed+off)*ENEMY_BULLET_SPD*0.85, vy:Math.sin(aimed+off)*ENEMY_BULLET_SPD*0.85, r:4, col:'#FF4488', life:2.8 });
        }
    } else {
        enemyBullets.push({ x:e.x, y:e.y+e.r*0.7, vx:Math.cos(aimed)*ENEMY_BULLET_SPD, vy:Math.sin(aimed)*ENEMY_BULLET_SPD, r:3.5, col: e.type==='diver' ? '#FF8844' : '#FF6644', life:2.5 });
    }
}

// ── Bullets ───────────────────────────────────────────────────────────────────
function updateBullets(dt) {
    for (let i = playerBullets.length-1; i >= 0; i--) {
        const b = playerBullets[i];
        b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
        if (b.y < -25 || b.x < -20 || b.x > GW+20 || b.life <= 0) playerBullets.splice(i, 1);
    }
    for (let i = enemyBullets.length-1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
        if (b.y > GH+25 || b.y < -25 || b.x < -25 || b.x > GW+25 || b.life <= 0) enemyBullets.splice(i, 1);
    }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
const PUP_DEFS = [
    { type:'spread', name:'SPREAD SHOT', col:'#FFDD44', icon:'≡' },
    { type:'beam',   name:'LASER BEAM',  col:'#44FFDD', icon:'|' },
    { type:'shield', name:'SHIELD +1',   col:'#4488FF', icon:'◈' },
    { type:'inv',    name:'INVINCIBLE',  col:'#FFFFFF', icon:'✦' },
    { type:'speed',  name:'SPEED BOOST', col:'#AAFFAA', icon:'▶' },
    { type:'bomb',   name:'SMART BOMB',  col:'#FF8800', icon:'✦' },
];

function tryDropPowerup(x, y) {
    if (rnd() > 0.32) return;
    const def = PUP_DEFS[Math.floor(rnd()*PUP_DEFS.length)];
    powerups.push({ ...def, x, y, vx:(rnd()-0.5)*40, vy:55, r:13, life:8.5, angle:0 });
}

function updatePowerups(dt) {
    for (let i = powerups.length-1; i >= 0; i--) {
        const p = powerups[i];
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.vx *= 0.98; p.angle += 1.8*dt; p.life -= dt;

        if (player) {
            const dx = player.x-p.x, dy = player.y-p.y;
            if (dx*dx+dy*dy < (p.r+PLAYER_R)*(p.r+PLAYER_R)) {
                collectPowerup(p); powerups.splice(i, 1); continue;
            }
        }
        if (p.y > GH+25 || p.life <= 0) powerups.splice(i, 1);
    }
}

function collectPowerup(p) {
    sfxPowerup();
    burst(p.x, p.y, p.col, 14, 110, 2.2, 0.65);
    addFloat(p.x, p.y-24, p.name, p.col);
    switch (p.type) {
        case 'spread': spreadTimer = 8; break;
        case 'beam':   beamTimer = 6; break;
        case 'shield':
            player.hp = Math.min(player.maxHp+1, player.hp+1);
            player.maxHp = Math.max(player.maxHp, player.hp);
            break;
        case 'inv':   invTimer = 5; player.invFrames = 5; break;
        case 'speed': speedTimer = 6; break;
        case 'bomb':  fireSmartBomb(); break;
    }
}

// ── Collision ─────────────────────────────────────────────────────────────────
function checkCollisions() {
    // player bullets → enemies; beam pierces through
    for (let bi = playerBullets.length-1; bi >= 0; bi--) {
        const b = playerBullets[bi];
        let hit = false;
        for (let ei = enemies.length-1; ei >= 0; ei--) {
            const e = enemies[ei];
            const dx = b.x-e.x, dy = b.y-e.y;
            if (dx*dx+dy*dy < (b.r+e.r)*(b.r+e.r)) {
                e.hp--;
                burst(b.x, b.y, '#FFFFFF', 3, 70, 1.2, 0.18);
                if (e.hp <= 0) onEnemyKilled(e, ei);
                if (b.beam) continue; // beam keeps going
                hit = true; break;
            }
        }
        if (hit) playerBullets.splice(bi, 1);
    }

    // enemy bullets → player sweet-spot hitbox
    if (player && player.invFrames <= 0 && invTimer <= 0) {
        for (let i = enemyBullets.length-1; i >= 0; i--) {
            const b = enemyBullets[i];
            const dx = b.x-player.x, dy = b.y-player.y;
            if (dx*dx+dy*dy < (b.r+HITBOX_R)*(b.r+HITBOX_R)) {
                enemyBullets.splice(i, 1);
                hitPlayer(); break;
            }
        }
        // enemy body contact (slightly larger than sweet-spot but still forgiving)
        for (const e of enemies) {
            const dx = e.x-player.x, dy = e.y-player.y;
            if (dx*dx+dy*dy < (e.r*0.55+HITBOX_R)*(e.r*0.55+HITBOX_R)) {
                hitPlayer(); break;
            }
        }
    }
}

function onEnemyKilled(e, idx) {
    enemies.splice(idx, 1);
    combo++; comboTimer = 3.5;
    if (combo > maxCombo) maxCombo = combo;
    const mult = comboMult();
    const base = e.type==='grunt' ? 100 : e.type==='diver' ? 260 : e.type==='tank' ? 550 : 3000+wave*250;
    score += base * mult;

    const tcol = e.type==='boss' ? '#FF44FF' : e.type==='tank' ? '#FF4488' : e.col;
    burst(e.x, e.y, tcol, Math.ceil(16*(e.r/14)), 140*(e.r/14), (e.r/14)*2+1.5);
    sfxExplosion(e.r/18);

    if (e.type === 'boss') {
        hitStopTimer = 0.12;
        shake(22);
        // debris bursts with delay
        for (let k = 0; k < 6; k++) {
            setTimeout(() => {
                if (particles) burst(e.x+(rnd()-0.5)*70, e.y+(rnd()-0.5)*50, '#FF44FF', 18, 220, 3.5, 1.1);
            }, k*140);
        }
    }
    if (combo >= 2) addFloat(e.x, e.y-22, `${combo}× COMBO  ×${mult}`, '#FFFF44');
    tryDropPowerup(e.x, e.y);
}

function hitPlayer() {
    if (!player) return;
    player.hp--;
    player.invFrames = 2.5; combo = 0;
    hitStopTimer = 0.07;
    shake(11); sfxDamage();
    burst(player.x, player.y, '#FF4400', 20, 160, 3, 0.85);
    if (player.hp <= 0) triggerGameOver();
}

function triggerGameOver() {
    state = 'GAME_OVER';
    if (score > highScore) { highScore = score; localStorage.setItem('sa_hs', highScore); }
    burst(player.x, player.y, '#FF6600', 80, 280, 5.5, 2.2);
    shake(26); sfxExplosion(5);
    player = null;
}

// ── Particles / floats ────────────────────────────────────────────────────────
function updateParticles(dt) {
    for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.vx *= 0.955; p.vy *= 0.955;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 900) particles.splice(0, particles.length-900);
}

function updateFloatTexts(dt) {
    for (let i = floatTexts.length-1; i >= 0; i--) {
        floatTexts[i].life -= dt;
        floatTexts[i].y -= 26*dt;
        if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, GH);
    g.addColorStop(0, '#000018');
    g.addColorStop(1, '#000008');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GW, GH);

    // nebula blobs
    for (const n of nebulaPoints) {
        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        ng.addColorStop(0, n.col);
        ng.addColorStop(1, 'transparent');
        ctx.fillStyle = ng;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fill();
    }
}

function drawStars() {
    for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPlayer() {
    if (!player) return;
    const { x, y, invFrames } = player;
    if (invFrames > 0 && Math.floor(Date.now()/75) % 2 === 0) return;

    // engine trail
    for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i];
        const f = i / player.trail.length;
        ctx.globalAlpha = f * 0.45;
        ctx.fillStyle = '#00AAFF';
        ctx.beginPath(); ctx.arc(t.x, t.y, 4.5*f, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);

    // main hull
    ctx.fillStyle = '#88CCFF';
    ctx.strokeStyle = '#DDEEFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_R);
    ctx.lineTo(-11, -2);
    ctx.lineTo(-18, 9);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-6, 15);
    ctx.lineTo(0, 11);
    ctx.lineTo(6, 15);
    ctx.lineTo(8, 5);
    ctx.lineTo(18, 9);
    ctx.lineTo(11, -2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // cockpit canopy
    ctx.fillStyle = '#BBDDFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -4, 4.5, 7.5, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();

    // engine glow
    const pulse = 0.55 + 0.45*Math.sin(Date.now()*0.016);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#00CCFF';
    ctx.shadowBlur = 8; ctx.shadowColor = '#00AAFF';
    ctx.beginPath(); ctx.ellipse(-6, 16, 3.5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 6, 16, 3.5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // sweet-spot hitbox dot (always visible as a tiny reference)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();

    // invincibility aura
    if (invTimer > 0) {
        const ap = 0.45 + 0.45*Math.sin(Date.now()*0.022);
        ctx.strokeStyle = `rgba(255,255,255,${ap})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, PLAYER_R+8, 0, Math.PI*2); ctx.stroke();
    }

    ctx.restore();
}

function drawEnemies() {
    for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.type === 'grunt') {
            ctx.fillStyle = e.col;
            ctx.strokeStyle = '#CCEEFF';
            ctx.lineWidth = 1.5;
            // inverted fighter (nose down)
            ctx.beginPath();
            ctx.moveTo(0, 13);
            ctx.lineTo(-11, 0);
            ctx.lineTo(-14, -9);
            ctx.lineTo(-7, -4);
            ctx.lineTo(0, -11);
            ctx.lineTo(7, -4);
            ctx.lineTo(14, -9);
            ctx.lineTo(11, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#CCFFFF';
            ctx.beginPath(); ctx.ellipse(0, 1, 3, 5, 0, 0, Math.PI*2); ctx.fill();

        } else if (e.type === 'diver') {
            ctx.fillStyle = e.col;
            ctx.strokeStyle = '#FFCCAA';
            ctx.lineWidth = 1.5;
            // dart shape
            ctx.beginPath();
            ctx.moveTo(0, 15);
            ctx.lineTo(-9, -2);
            ctx.lineTo(-5, 8);
            ctx.lineTo(0, -13);
            ctx.lineTo(5, 8);
            ctx.lineTo(9, -2);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

        } else if (e.type === 'tank') {
            ctx.fillStyle = e.col;
            ctx.strokeStyle = '#FF88CC';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k/6)*Math.PI*2 - Math.PI/2;
                k === 0 ? ctx.moveTo(Math.cos(a)*e.r, Math.sin(a)*e.r) : ctx.lineTo(Math.cos(a)*e.r, Math.sin(a)*e.r);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // inner ring
            ctx.strokeStyle = 'rgba(255,200,200,0.4)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0, 0, e.r*0.55, 0, Math.PI*2); ctx.stroke();
            // hp bar
            const bw = e.r*2, bh = 5;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2, -e.r-13, bw, bh);
            ctx.fillStyle = e.hp > e.maxHp*0.5 ? '#44FF55' : '#FF3300';
            ctx.fillRect(-bw/2, -e.r-13, bw*(e.hp/e.maxHp), bh);

        } else if (e.type === 'boss') {
            // saucer hull
            ctx.fillStyle = e.col;
            ctx.strokeStyle = '#EE88FF';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r*0.52, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();

            // dome
            const dg = ctx.createRadialGradient(0, -e.r*0.1, 0, 0, -e.r*0.1, e.r*0.38);
            dg.addColorStop(0, '#FFCCFF'); dg.addColorStop(1, '#882299');
            ctx.fillStyle = dg;
            ctx.beginPath(); ctx.ellipse(0, -e.r*0.08, e.r*0.38, e.r*0.3, 0, 0, Math.PI*2); ctx.fill();

            // rotating gun pods
            const ang = Date.now()*0.0012;
            ctx.fillStyle = '#AA33DD';
            for (let k = 0; k < 4; k++) {
                const a = ang + (k/4)*Math.PI*2;
                const px = Math.cos(a)*e.r*0.72, py = Math.sin(a)*e.r*0.35;
                ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI*2); ctx.fill();
            }

            // hp bar
            const bw = e.r*2.4, bh = 9, by = -e.r-20;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(-bw/2, by, bw, bh);
            const hf = e.hp/e.maxHp;
            ctx.fillStyle = hf > 0.5 ? '#FF44FF' : '#FF0044';
            ctx.fillRect(-bw/2, by, bw*hf, bh);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(-bw/2, by, bw, bh);
            // wave label
            ctx.fillStyle = '#FF88FF'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(`BOSS  W${wave}`, 0, by-3);
        }

        ctx.restore();
    }
}

function drawBullets() {
    // player bullets
    ctx.shadowBlur = 9; ctx.shadowColor = '#00BBFF';
    for (const b of playerBullets) {
        if (b.beam) {
            ctx.fillStyle = '#00FFCC';
            ctx.globalAlpha = 0.88;
            ctx.fillRect(b.x-b.r, b.y-20, b.r*2, 20);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#00DDFF';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r*0.5, 0, Math.PI*2); ctx.fill();
        }
    }
    // enemy bullets
    ctx.shadowBlur = 7;
    for (const b of enemyBullets) {
        ctx.shadowColor = b.col;
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r*0.4, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function drawParticles() {
    for (const p of particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = p.glow ? a*0.5 : a;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r*(p.glow ? a : 1), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPowerups() {
    for (const p of powerups) {
        const pulse = 0.72 + 0.28*Math.sin(Date.now()*0.006);
        const [r,g,b] = hex2rgb(p.col);
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life/1.5) * pulse;
        ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r*2.2);
        gg.addColorStop(0, `rgba(${r},${g},${b},0.38)`);
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(0, 0, p.r*2.2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = p.col; ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, 0, 0);
        ctx.restore();
    }
}

function drawFloatTexts() {
    for (const t of floatTexts) {
        const a = t.life / t.maxLife;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = t.col;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10; ctx.shadowColor = t.col;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
    }
}

function drawHUD() {
    if (!player) return;

    // Hearts (HP)
    ctx.font = '20px serif'; ctx.textBaseline = 'top';
    for (let i = 0; i < player.maxHp; i++) {
        ctx.fillStyle = i < player.hp ? '#FF3355' : '#331122';
        ctx.fillText('♥', 14 + i*26, 14);
    }

    // Score
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 21px monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(score.toLocaleString(), GW-14, 14);
    ctx.fillStyle = 'rgba(155,155,155,0.7)'; ctx.font = '11px monospace';
    ctx.fillText(`BEST  ${highScore.toLocaleString()}`, GW-14, 40);

    // Wave
    ctx.fillStyle = '#AAAAFF'; ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`WAVE  ${wave}`, GW/2, 14);

    // Combo
    if (combo >= 2 && comboTimer > 0) {
        const ca = Math.min(1, comboTimer*2);
        ctx.save(); ctx.globalAlpha = ca;
        ctx.fillStyle = '#FFFF44';
        ctx.font = `bold ${15+Math.min(combo, 11)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 14; ctx.shadowColor = '#FF8800';
        ctx.fillText(`${combo}× COMBO  ×${comboMult()}`, GW/2, GH/2 - 45);
        ctx.restore();
    }

    // Active buffs (bottom left)
    ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'baseline';
    let py = GH - 14;
    const buff = (label, col) => { ctx.fillStyle = col; ctx.fillText(label, 14, py); py -= 16; };
    if (bombCooldown > 0)  buff(`✦ BOMB  ${Math.ceil(bombCooldown)}s`, 'rgba(120,80,30,0.9)');
    else                   buff('✦ BOMB READY [SHIFT]', '#FF8800');
    if (spreadTimer > 0)   buff(`≡ SPREAD  ${Math.ceil(spreadTimer)}s`, '#FFDD44');
    if (beamTimer > 0)     buff(`| BEAM  ${Math.ceil(beamTimer)}s`,     '#44FFDD');
    if (invTimer > 0)      buff(`✦ INVINCIBLE  ${Math.ceil(invTimer)}s`,'#FFFFFF');
    if (speedTimer > 0)    buff(`▶ SPEED  ${Math.ceil(speedTimer)}s`,   '#AAFFAA');

    // Between-wave overlay
    if (betweenWaves && betweenWaveTimer > 0.6) {
        const a = Math.min(1, (betweenWaveTimer-0.6)*2);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(GW/2-155, GH/2-32, 310, 60);
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`WAVE ${wave+1} INCOMING`, GW/2, GH/2-6);
        ctx.fillStyle = '#AAAAAA'; ctx.font = '12px monospace';
        ctx.fillText(`launching in  ${Math.ceil(betweenWaveTimer)}s`, GW/2, GH/2+16);
        ctx.restore();
    }

    // Invincibility vignette
    if (invTimer > 0) {
        const ap = 0.3+0.2*Math.sin(Date.now()*0.018);
        ctx.save(); ctx.strokeStyle=`rgba(255,255,255,${ap})`; ctx.lineWidth=6;
        ctx.strokeRect(3,3,GW-6,GH-6); ctx.restore();
    }
    // Speed vignette
    if (speedTimer > 0) {
        const ap = 0.15+0.1*Math.sin(Date.now()*0.02);
        ctx.save(); ctx.strokeStyle=`rgba(170,255,170,${ap})`; ctx.lineWidth=5;
        ctx.strokeRect(3,3,GW-6,GH-6); ctx.restore();
    }
    // Low-HP danger flash
    if (player && player.hp === 1) {
        const ap = 0.18 + 0.18*Math.sin(Date.now()*0.007);
        ctx.save(); ctx.strokeStyle=`rgba(255,0,0,${ap})`; ctx.lineWidth=10;
        ctx.strokeRect(0,0,GW,GH); ctx.restore();
    }
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0,0,20,0.88)'; ctx.fillRect(0, 0, GW, GH);
    ctx.save(); ctx.textAlign = 'center';

    ctx.shadowBlur = 32; ctx.shadowColor = '#8800FF';
    ctx.fillStyle = '#BB55FF'; ctx.font = 'bold 52px monospace';
    ctx.fillText('STELLAR', GW/2, GH/2-118);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 52px monospace';
    ctx.fillText('ASSAULT', GW/2, GH/2-64);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#778899'; ctx.font = '12px monospace';
    ctx.fillText('One ship. Infinite stars. Total war in the cosmos.', GW/2, GH/2-24);

    ctx.fillStyle = 'rgba(170,170,170,0.78)'; ctx.font = '12px monospace';
    const lines = [
        'WASD / Arrow Keys  →  Move',
        'Shift              →  Smart Bomb',
        'Auto-fire  ·  Mouse & Touch supported',
    ];
    lines.forEach((l, i) => ctx.fillText(l, GW/2, GH/2+16+i*18));

    const p = 0.6 + 0.4*Math.sin(Date.now()*0.003);
    ctx.fillStyle = `rgba(180,80,255,${p})`; ctx.font = 'bold 21px monospace';
    ctx.fillText('[ CLICK TO START ]', GW/2, GH/2+106);

    if (highScore > 0) {
        ctx.fillStyle = '#FFAA00'; ctx.font = '13px monospace';
        ctx.fillText(`Best Score:  ${highScore.toLocaleString()}`, GW/2, GH/2+140);
    }
    ctx.restore();
}

function drawGameOver() {
    const f = Math.min(1, gameOverTimer/1.4);
    ctx.fillStyle = `rgba(0,0,0,${f*0.78})`; ctx.fillRect(0,0,GW,GH);

    if (gameOverTimer > 1.0) {
        const a = Math.min(1, (gameOverTimer-1.0)*1.8);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
        ctx.shadowBlur = 22; ctx.shadowColor = '#FF0000';
        ctx.fillStyle = '#FF3300'; ctx.font = 'bold 46px monospace';
        ctx.fillText('SHIP LOST', GW/2, GH/2-90);
        ctx.shadowBlur = 0;

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#FFDD00'; ctx.font = 'bold 16px monospace';
            ctx.fillText('✦  NEW HIGH SCORE  ✦', GW/2, GH/2-54);
        } else {
            ctx.fillStyle = '#FFAA00'; ctx.font = '13px monospace';
            ctx.fillText(`Best:  ${highScore.toLocaleString()}`, GW/2, GH/2-54);
        }

        ctx.fillStyle = '#FFFFFF'; ctx.font = '19px monospace';
        ctx.fillText(`Score:  ${score.toLocaleString()}`, GW/2, GH/2-16);
        ctx.fillText(`Wave:   ${wave}`, GW/2, GH/2+16);
        ctx.fillText(`Best Combo:  ${maxCombo}×`, GW/2, GH/2+48);

        const p2 = 0.6+0.4*Math.sin(Date.now()*0.003);
        ctx.fillStyle = `rgba(255,255,255,${p2*a})`; ctx.font = 'bold 20px monospace';
        ctx.fillText('[ CLICK TO RESTART ]', GW/2, GH/2+98);
        ctx.restore();
    }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    ctx.clearRect(0, 0, GW, GH);
    drawBackground();

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawStars();

    if (state === 'PLAYING' || state === 'GAME_OVER') {
        drawPowerups();
        drawBullets();
        drawEnemies();
        drawPlayer();
        drawParticles();
        drawFloatTexts();
        if (state === 'PLAYING') drawHUD();
    }

    ctx.restore();

    if (state === 'START')     drawStartScreen();
    if (state === 'GAME_OVER') drawGameOver();
}

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    mouseAim = false;
    if (e.code === 'Space') e.preventDefault();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && state === 'PLAYING') {
        fireSmartBomb();
    }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function canvasXY(e) {
    const r = canvas.getBoundingClientRect();
    const sx = GW/r.width, sy = GH/r.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x:(cx-r.left)*sx, y:(cy-r.top)*sy };
}

canvas.addEventListener('mousemove', e => {
    const c = canvasXY(e); mouseX = c.x; mouseY = c.y; mouseAim = true;
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const c = canvasXY(e); mouseX = c.x; mouseY = c.y; mouseAim = true;
}, { passive:false });

canvas.addEventListener('mousedown', e => {
    e.preventDefault(); initAudio();
    if (state === 'START') { initGame(); return; }
    if (state === 'GAME_OVER' && gameOverTimer > 1.2) { initGame(); return; }
});
canvas.addEventListener('touchstart', e => {
    e.preventDefault(); initAudio();
    const c = canvasXY(e); mouseX = c.x; mouseY = c.y; mouseAim = true;
    if (state === 'START') { initGame(); return; }
    if (state === 'GAME_OVER' && gameOverTimer > 1.2) { initGame(); return; }
}, { passive:false });

// ── Game loop ─────────────────────────────────────────────────────────────────
state = 'START';
buildStarfield();
particles = []; floatTexts = [];

let lastTS = 0;
function loop(ts) {
    const dt = Math.min((ts - lastTS) / 1000, 0.05);
    lastTS = ts;
    if (state !== 'START') update(dt);
    render();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
