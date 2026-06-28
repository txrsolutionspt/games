'use strict';

// ── Canvas ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const GW = 800, GH = 800;
canvas.width  = GW;
canvas.height = GH;

// ── Constants ────────────────────────────────────────────────────────────────
const GM             = 12_500_000;  // gravitational param (px³/s²)
const PLANET_X       = GW / 2;
const PLANET_Y       = GH / 2;
const PLANET_R       = 45;
const INTER_R        = 6;
const INTER_MAX_BASE = 6;
const SPAWN_DIST     = 490;

// ── Audio ────────────────────────────────────────────────────────────────────
let audioCtx = null, masterGain = null, ambientRunning = false;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(audioCtx.destination);
    startAmbient();
}

function startAmbient() {
    if (ambientRunning || !audioCtx) return;
    ambientRunning = true;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const lfo  = audioCtx.createOscillator();
    const lg   = audioCtx.createGain();
    lfo.frequency.value = 0.08;
    lg.gain.value = 4;
    lfo.connect(lg); lg.connect(osc.frequency);
    osc.type = 'sine'; osc.frequency.value = 55;
    gain.gain.value = 0.04;
    osc.connect(gain); gain.connect(masterGain);
    lfo.start(); osc.start();
}

function sfxLaunch() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.14);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.14);
}

function sfxExplosion(size) {
    if (!audioCtx) return;
    const len = audioCtx.sampleRate * 0.35;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 1.8);
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buf;
    gain.gain.value = Math.min(0.7, size * 0.28);
    src.connect(gain); gain.connect(masterGain);
    src.start();
}

function sfxCombo(level) {
    if (!audioCtx) return;
    const freqs = [261.6, 329.6, 392, 523.3, 659.3, 783.9];
    const f = freqs[Math.min(level - 1, freqs.length - 1)];
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.35, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.45);
}

function sfxPowerup() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(350, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.3);
}

function sfxDamage() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(90, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.35);
    g.gain.setValueAtTime(0.45, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.35);
}

// ── State ────────────────────────────────────────────────────────────────────
let state, score, highScore, wave, combo, comboTimer, maxCombo;
let shakeX, shakeY, timeScale, timeSlowTimer, shieldActive, shieldTimer;
let maxInter, multiShotTimer, planetRot, gameOverTimer;
let waveActive, betweenWaves, betweenWaveTimer;
let spawnQueue, spawnTimer, spawnInterval;
let planet, interceptors, threats, particles, powerups, comboTexts, stars, warns;
let mouse;

highScore = parseInt(localStorage.getItem('od_hs') || '0');
let bestWave = parseInt(localStorage.getItem('od_bw') || '0');
let paused = false;

function initGame() {
    state = 'PLAYING';
    paused = false;
    score = 0; wave = 0; combo = 0; comboTimer = 0; maxCombo = 0;
    shakeX = 0; shakeY = 0;
    timeScale = 1; timeSlowTimer = 0;
    shieldActive = false; shieldTimer = 0;
    maxInter = INTER_MAX_BASE; multiShotTimer = 0;
    planetRot = 0; gameOverTimer = 0;
    waveActive = false; betweenWaves = true; betweenWaveTimer = 2;
    spawnQueue = []; spawnTimer = 0; spawnInterval = 60;

    planet = { health: 100, maxHealth: 100, cracks: [], shieldPulse: 0 };
    interceptors = []; threats = []; particles = [];
    powerups = []; comboTexts = []; warns = [];

    buildStars();
}

function buildStars() {
    stars = [];
    for (let i = 0; i < 220; i++) {
        stars.push({
            x: Math.random() * GW,
            y: Math.random() * GH,
            r: Math.random() * 1.6 + 0.3,
            base: Math.random() * 0.7 + 0.2,
            t: Math.random() * Math.PI * 2,
            ts: Math.random() * 0.04 + 0.008,
        });
    }
}

// ── Utilities ────────────────────────────────────────────────────────────────
const rnd  = () => Math.random();
const rndA = () => rnd() * Math.PI * 2;
const pick = arr => arr[Math.floor(rnd() * arr.length)];
function shuffle(a) {
    for (let i = a.length-1; i > 0; i--) {
        const j = Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
}
function hex2rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
}
function lighten(hex, amt) {
    const [r,g,b] = hex2rgb(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function comboMult() {
    if (combo < 2)  return 1;
    if (combo < 5)  return 2;
    if (combo < 10) return 3;
    if (combo < 20) return 5;
    return 10;
}

// ── Asteroids geometry ────────────────────────────────────────────────────────
function makeAsteroidVerts(r, n) {
    const v = [];
    for (let i = 0; i < n; i++) {
        const a = (i/n)*Math.PI*2;
        const d = r * (0.68 + rnd()*0.52);
        v.push({ x: Math.cos(a)*d, y: Math.sin(a)*d });
    }
    return v;
}

// ── Wave system ───────────────────────────────────────────────────────────────
function waveConfig(w) {
    const boss = (w % 5 === 0);
    return {
        asteroids:     Math.min(3 + w*2, 30),
        comets:        w >= 4  ? Math.floor((w-3)*1.5) : 0,
        drones:        w >= 10 ? Math.floor((w-9)*1.2) : 0,
        boss:          boss ? 1 : 0,
        interval:      Math.max(18, 65 - w*2),
        speedMult:     1 + w*0.08,
    };
}

function startWave() {
    wave++;
    const cfg = waveConfig(wave);
    spawnQueue = [];
    spawnInterval = cfg.interval;
    spawnTimer = spawnInterval / 60;  // delay before first spawn

    for (let i = 0; i < cfg.asteroids; i++) spawnQueue.push({ type:'asteroid', sz: pick(['sm','md','lg']) });
    for (let i = 0; i < cfg.comets;    i++) spawnQueue.push({ type:'comet' });
    for (let i = 0; i < cfg.drones;    i++) spawnQueue.push({ type:'drone' });
    if (cfg.boss)                            spawnQueue.push({ type:'boss' });
    shuffle(spawnQueue);

    waveActive = true; betweenWaves = false;
}

function doSpawn(spec) {
    const angle  = rndA();
    const sx = PLANET_X + Math.cos(angle)*SPAWN_DIST;
    const sy = PLANET_Y + Math.sin(angle)*SPAWN_DIST;
    const ta = Math.atan2(PLANET_Y-sy, PLANET_X-sx) + (rnd()-0.5)*0.35;
    const { speedMult } = waveConfig(wave);

    let t = null;
    if (spec.type === 'asteroid') {
        const rMap = {sm:18,md:28,lg:44};
        const hpMap = {sm:1,md:2,lg:4};
        const r  = rMap[spec.sz];
        const spd = (42 + rnd()*36) * speedMult;
        t = {
            type:'asteroid', sz:spec.sz,
            x:sx, y:sy, vx:Math.cos(ta)*spd, vy:Math.sin(ta)*spd,
            r, hp:hpMap[spec.sz], maxHp:hpMap[spec.sz],
            rot:rndA(), rotSpd:(rnd()-0.5)*1.8,
            verts: makeAsteroidVerts(r, 8+Math.floor(rnd()*4)),
            col: pick(['#8B7355','#A0896B','#7B6B50','#9E8E6A']),
        };
    } else if (spec.type === 'comet') {
        const spd = (108 + rnd()*54) * speedMult;
        t = {
            type:'comet',
            x:sx, y:sy, vx:Math.cos(ta)*spd, vy:Math.sin(ta)*spd,
            r:13, hp:1, maxHp:1,
            rot:ta, rotSpd:0, tail:[],
        };
    } else if (spec.type === 'drone') {
        const spd = (54 + rnd()*30) * speedMult;
        t = {
            type:'drone',
            x:sx, y:sy, vx:Math.cos(ta)*spd, vy:Math.sin(ta)*spd,
            r:16, hp:3, maxHp:3,
            rot:ta, rotSpd:1.5,
            shield: rnd() < 0.3, shieldTimer:1.8,
        };
    } else if (spec.type === 'boss') {
        const spd = 25 * speedMult;
        t = {
            type:'boss', isBoss:true,
            x:sx, y:sy, vx:Math.cos(ta)*spd, vy:Math.sin(ta)*spd,
            r:66, hp:15+wave*2, maxHp:15+wave*2,
            rot:rndA(), rotSpd:0.25,
            verts: makeAsteroidVerts(66, 13),
            col:'#CC4422',
        };
    }
    if (t) { threats.push(t); warns.push({ angle, life:1.8, max:1.8 }); }
}

// ── Interceptor launch ────────────────────────────────────────────────────────
function launchAt(cx, cy) {
    const dx = cx - PLANET_X, dy = cy - PLANET_Y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < PLANET_R) return;
    const ang = Math.atan2(dy, dx);
    const rp  = PLANET_R + INTER_R + 2;
    const ra  = Math.max(rp + 50, Math.min(dist, 360));
    const sm  = (rp + ra) / 2;
    const vp  = Math.sqrt(GM * (2/rp - 1/sm));

    const cols = ['#00FFFF','#44AAFF','#AAFFCC','#FFCC44','#FF88CC'];
    const col  = cols[interceptors.length % cols.length];

    const mkInter = (a) => {
        const lx = PLANET_X + Math.cos(a) * rp;
        const ly = PLANET_Y + Math.sin(a) * rp;
        const ta = a - Math.PI/2;
        interceptors.push({
            x:lx, y:ly, vx:Math.cos(ta)*vp, vy:Math.sin(ta)*vp,
            r:INTER_R, col, trail:[], dead:false,
            age:0, maxAge: 700 + Math.floor(rnd()*400),
            glow:0,
        });
        for (let i = 0; i < 8; i++) {
            const pa = a + (rnd()-0.5)*Math.PI;
            spawnParticle(lx, ly, Math.cos(pa)*180, Math.sin(pa)*180, 0.4, 2.5, col);
        }
    };

    if (multiShotTimer > 0) {
        [-0.38, 0, 0.38].forEach(off => {
            if (interceptors.filter(i=>!i.dead).length < maxInter) mkInter(ang + off);
        });
    } else {
        if (interceptors.filter(i=>!i.dead).length < maxInter) mkInter(ang);
    }
    sfxLaunch();
}

// ── Particle helpers ──────────────────────────────────────────────────────────
function spawnParticle(x, y, vx, vy, life, r, col, glow=false) {
    particles.push({ x, y, vx, vy, life, maxLife:life, r, col, glow });
}

function burst(x, y, col, n, spd, sz=2.5, life=0.7) {
    for (let i = 0; i < n; i++) {
        const a = rndA();
        const s = spd * (0.4 + rnd()*0.8);
        spawnParticle(x, y, Math.cos(a)*s, Math.sin(a)*s, life*(0.6+rnd()*0.8), sz*(0.5+rnd()), col);
    }
    spawnParticle(x, y, 0, 0, 0.22, sz*10, '#FFFFFF', true);
}

// ── Powerup logic ─────────────────────────────────────────────────────────────
const PUPS = [
    { type:'orbitBoost', name:'ORBIT BOOST',  col:'#00FFAA', icon:'⊕' },
    { type:'shield',     name:'SHIELD',        col:'#4488FF', icon:'◈' },
    { type:'timeSlow',   name:'TIME SLOW',     col:'#FF88FF', icon:'⧖' },
    { type:'multiShot',  name:'MULTI-SHOT',    col:'#FFFF44', icon:'≡' },
    { type:'bomb',       name:'BOMB',          col:'#FF5500', icon:'✦' },
    { type:'repair',     name:'REPAIR +20',    col:'#44FF44', icon:'+' },
];

function dropPowerup(x, y) {
    const def = pick(PUPS);
    const a   = rndA();
    powerups.push({ ...def, x, y, vx:Math.cos(a)*55, vy:Math.sin(a)*55, r:14, life:8, angle:0 });
}

function collectPup(p) {
    sfxPowerup();
    burst(p.x, p.y, p.col, 16, 120);
    addPopup(p.x, p.y, p.name, p.col);
    switch (p.type) {
        case 'orbitBoost': maxInter = Math.min(12, maxInter+2); break;
        case 'shield':     shieldActive=true; shieldTimer=300; break;
        case 'timeSlow':   timeScale=0.3; timeSlowTimer=300; break;
        case 'multiShot':  multiShotTimer=600; break;
        case 'bomb':
            for (const t of threats) burst(t.x, t.y, '#FFFF00', 20, 200);
            score += threats.length * 30;
            threats = [];
            shake(16); sfxExplosion(3); break;
        case 'repair':
            planet.health = Math.min(planet.maxHealth, planet.health+20); break;
    }
}

function addPopup(x, y, text, col) {
    comboTexts.push({ x, y, text, col, life:1.8, maxLife:1.8, sc:1.6 });
}

// ── Score helpers ─────────────────────────────────────────────────────────────
function threatScore(t) {
    if (t.type==='asteroid') return {sm:10,md:25,lg:55}[t.sz]||25;
    if (t.type==='comet')    return 80;
    if (t.type==='drone')    return 110;
    if (t.type==='boss')     return 600 + wave*50;
    return 10;
}

function dropChance(t) {
    if (t.type==='asteroid') return {sm:0.07, md:0.12, lg:0.28}[t.sz]||0.1;
    if (t.type==='comet')    return 0.22;
    if (t.type==='drone')    return 0.38;
    if (t.type==='boss')     return 1.0;
    return 0.1;
}

// ── Screen shake ──────────────────────────────────────────────────────────────
function shake(intensity) {
    shakeX = (rnd()-0.5) * intensity * 2;
    shakeY = (rnd()-0.5) * intensity * 2;
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
    const edt = dt * timeScale;

    planetRot += 0.003 * edt;
    shakeX *= 0.82; shakeY *= 0.82;

    // timers
    if (timeSlowTimer > 0) { timeSlowTimer -= dt; if (timeSlowTimer <= 0) { timeSlowTimer=0; timeScale=1; } }
    if (shieldTimer   > 0) { shieldTimer   -= dt; if (shieldTimer   <= 0) { shieldTimer=0; shieldActive=false; } }
    if (multiShotTimer> 0)   multiShotTimer -= dt;
    if (comboTimer    > 0) { comboTimer    -= dt; if (comboTimer    <= 0) { combo=0; } }

    // Wave logic
    if (betweenWaves) {
        betweenWaveTimer -= dt;
        if (betweenWaveTimer <= 0) startWave();
    } else if (waveActive) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && spawnQueue.length > 0) {
            doSpawn(spawnQueue.shift());
            spawnTimer = spawnInterval / 60;
        }
        if (spawnQueue.length === 0 && threats.length === 0) {
            waveActive = false; betweenWaves = true; betweenWaveTimer = 3;
            const bonus = wave * 100;
            score += bonus;
            addPopup(GW/2, GH/2-50, `WAVE ${wave} CLEAR!  +${bonus}`, '#AAFFAA');
        }
    }

    updateInterceptors(edt);
    updateThreats(edt);
    updateParticles(dt);
    updatePowerups(edt);
    updateComboTexts(dt);
    updateWarns(dt);
    checkCollisions();

    if (state === 'GAME_OVER') gameOverTimer += dt;
}

function updateInterceptors(edt) {
    for (let i = interceptors.length-1; i >= 0; i--) {
        const p = interceptors[i];
        if (p.dead) continue;

        const dx = PLANET_X - p.x, dy = PLANET_Y - p.y;
        const d2 = Math.max(dx*dx + dy*dy, 100);
        const d  = Math.sqrt(d2);
        const gf = GM / d2;
        p.vx += (dx/d)*gf*edt;
        p.vy += (dy/d)*gf*edt;
        p.vx *= 0.9996; p.vy *= 0.9996;
        p.x  += p.vx*edt;
        p.y  += p.vy*edt;

        p.trail.push({ x:p.x, y:p.y });
        if (p.trail.length > 28) p.trail.shift();
        p.glow = Math.max(0, p.glow - 0.06);
        p.age++;

        if (d < PLANET_R + p.r - 4) { p.dead=true; burst(p.x,p.y,p.col,6,80,1.5,0.3); continue; }
        if (p.age > p.maxAge || p.x<-60||p.x>GW+60||p.y<-60||p.y>GH+60) p.dead=true;
    }
    interceptors = interceptors.filter(p=>!p.dead);
}

function updateThreats(edt) {
    for (let i = threats.length-1; i >= 0; i--) {
        const t = threats[i];
        t.x += t.vx*edt; t.y += t.vy*edt; t.rot += t.rotSpd*edt;

        if (t.type==='comet') {
            t.tail.push({x:t.x,y:t.y});
            if (t.tail.length > 18) t.tail.shift();
        }
        if (t.type==='drone') {
            const dx=PLANET_X-t.x, dy=PLANET_Y-t.y;
            const d=Math.sqrt(dx*dx+dy*dy);
            t.vx += (dx/d)*55*edt; t.vy += (dy/d)*55*edt;
            const spd=Math.sqrt(t.vx*t.vx+t.vy*t.vy);
            const maxSpd = 115*waveConfig(wave).speedMult;
            if (spd>maxSpd) { t.vx*=maxSpd/spd; t.vy*=maxSpd/spd; }
            if (t.shield && (t.shieldTimer-=edt)<=0) t.shield=false;
        }

        // planet impact
        const pdx=t.x-PLANET_X, pdy=t.y-PLANET_Y;
        const pd=Math.sqrt(pdx*pdx+pdy*pdy);
        if (pd < PLANET_R + t.r*0.65) {
            const dmg = t.type==='boss' ? 30 : t.type==='comet' ? 15 : Math.max(6, t.r*0.4);
            if (shieldActive) {
                shieldTimer -= 80;
                if (shieldTimer<=0) { shieldActive=false; shieldTimer=0; }
                t.vx*=-1.4; t.vy*=-1.4;
                burst(t.x,t.y,'#88AAFF',14,150,2,0.6);
                sfxExplosion(1.2);
            } else {
                planet.health = Math.max(0, planet.health - dmg);
                planet.cracks.push({ angle:Math.atan2(pdy,pdx), len:dmg*1.6+8 });
                shake(dmg*0.5); sfxDamage();
                burst(t.x,t.y,'#FF4400',22,200,3,0.8);
                threats.splice(i,1);
                combo = 0;
                if (planet.health<=0) triggerGameOver();
            }
            continue;
        }

        // off screen cull
        if (Math.abs(pdx)>620||Math.abs(pdy)>620) threats.splice(i,1);
    }
}

function updateParticles(dt) {
    for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.vx *= 0.96; p.vy *= 0.96;
        p.life -= dt;
        if (p.life<=0) particles.splice(i,1);
    }
    if (particles.length > 600) particles.splice(0, particles.length-600);
}

function updatePowerups(edt) {
    for (let i = powerups.length-1; i >= 0; i--) {
        const p = powerups[i];
        p.x += p.vx*edt; p.y += p.vy*edt;
        p.vx *= 0.97; p.vy *= 0.97;
        p.angle += 1.5*edt;
        p.life -= edt;
        const dx=PLANET_X-p.x, dy=PLANET_Y-p.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        p.vx += (dx/d)*3.5*edt; p.vy += (dy/d)*3.5*edt;
        if (d < PLANET_R+28) { collectPup(p); powerups.splice(i,1); continue; }
        if (p.life<=0) powerups.splice(i,1);
    }
}

function updateComboTexts(dt) {
    for (let i = comboTexts.length-1; i >= 0; i--) {
        const t = comboTexts[i];
        t.life -= dt; t.y -= 22*dt; t.sc = Math.max(1, t.sc - 0.3*dt);
        if (t.life<=0) comboTexts.splice(i,1);
    }
}

function updateWarns(dt) {
    for (let i = warns.length-1; i >= 0; i--) {
        warns[i].life -= dt;
        if (warns[i].life<=0) warns.splice(i,1);
    }
}

// ── Collision detection ────────────────────────────────────────────────────────
function checkCollisions() {
    for (let ii = interceptors.length-1; ii >= 0; ii--) {
        const inter = interceptors[ii];
        if (inter.dead) continue;
        for (let ti = threats.length-1; ti >= 0; ti--) {
            const t = threats[ti];
            if (t.type==='drone' && t.shield) continue;
            const dx=inter.x-t.x, dy=inter.y-t.y;
            if (dx*dx+dy*dy < (inter.r+t.r)*(inter.r+t.r)) {
                t.hp--;
                inter.glow = 1;
                if (t.hp <= 0) {
                    const pts = threatScore(t) * comboMult();
                    score += pts;
                    combo++; comboTimer = 3;
                    if (combo > maxCombo) maxCombo = combo;
                    if (combo >= 2) {
                        addPopup(t.x, t.y-22, `${combo}x COMBO ×${comboMult()}`, '#FFFF44');
                        sfxCombo(Math.min(combo, 6));
                    }
                    const tcol = t.type==='comet' ? '#88DDFF' : t.type==='drone' ? '#44FF88' : t.isBoss ? '#FF6622' : '#FF9955';
                    const tsize = t.isBoss ? 4 : t.r/14;
                    burst(t.x, t.y, tcol, Math.ceil(18*tsize), 150*tsize, tsize*2+1);
                    sfxExplosion(t.r/22);
                    if (t.isBoss) { shake(20); spawnBossDebris(t.x, t.y); }
                    else if (t.type==='asteroid' && t.sz==='lg') spawnDebris(t.x, t.y);
                    if (rnd() < dropChance(t)) dropPowerup(t.x, t.y);
                    threats.splice(ti,1);
                    inter.dead = true;
                } else {
                    burst(inter.x, inter.y, '#FF8844', 6, 100, 1.5, 0.3);
                    inter.dead = true;
                }
                break;
            }
        }
    }
}

function spawnDebris(x, y) {
    for (let i = 0; i < 2; i++) {
        const a = rndA(), spd = 55 + rnd()*45;
        threats.push({
            type:'asteroid', sz:'md',
            x:x+Math.cos(a)*10, y:y+Math.sin(a)*10,
            vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
            r:16, hp:1, maxHp:1,
            rot:rndA(), rotSpd:(rnd()-0.5)*2.4,
            verts:makeAsteroidVerts(16,7), col:'#8B7355',
        });
    }
}

function spawnBossDebris(x, y) {
    for (let i = 0; i < 5; i++) {
        const a = (i/5)*Math.PI*2 + rnd()*0.4;
        const spd = 60 + rnd()*60;
        threats.push({
            type:'asteroid', sz:'lg',
            x:x+Math.cos(a)*22, y:y+Math.sin(a)*22,
            vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
            r:26, hp:2, maxHp:2,
            rot:rndA(), rotSpd:(rnd()-0.5)*1.8,
            verts:makeAsteroidVerts(26,8), col:'#CC4422',
        });
    }
}

// ── Game flow ─────────────────────────────────────────────────────────────────
function triggerGameOver() {
    state = 'GAME_OVER';
    if (score > highScore) { highScore = score; localStorage.setItem('od_hs', highScore); }
    if (wave > bestWave) { bestWave = wave; localStorage.setItem('od_bw', bestWave); }
    burst(PLANET_X, PLANET_Y, '#FF4400', 100, 300, 6, 2.5);
    shake(28); sfxExplosion(5);
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function drawBackground() {
    const g = ctx.createRadialGradient(GW/2,GH/2,0,GW/2,GH/2,GW*0.72);
    g.addColorStop(0,'#0A0A2E'); g.addColorStop(1,'#000010');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,GW,GH);
}

function drawStars() {
    for (const s of stars) {
        s.t += s.ts;
        const b = s.base * (0.65 + 0.35*Math.sin(s.t));
        ctx.globalAlpha = b;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPlanet() {
    const { health, maxHealth } = planet;
    const hr = health / maxHealth;

    ctx.save();
    ctx.translate(PLANET_X, PLANET_Y);
    ctx.rotate(planetRot);

    // body
    const rR = Math.round(25 + (1-hr)*110);
    const rG = Math.round(70 + hr*55);
    const rB = Math.round(195 - (1-hr)*90);
    const g  = ctx.createRadialGradient(-13,-13,4,0,0,PLANET_R);
    g.addColorStop(0,`rgb(${rR+65},${rG+50},${rB})`);
    g.addColorStop(1,`rgb(${rR},${rG},${rB})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,PLANET_R,0,Math.PI*2); ctx.fill();

    // continent-like blobs
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#22FF88';
    [[-12,8,14],[10,-10,9],[4,16,11],[-6,-18,7]].forEach(([cx,cy,cr])=>{
        ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
    });

    // polar cap
    ctx.fillStyle = '#DDEEFF';
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.ellipse(0,-PLANET_R*0.72,11,5,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // atmosphere ring
    ctx.strokeStyle = `rgba(${rR+30},${rG+90},${rB+30},0.25)`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0,0,PLANET_R+5,0,Math.PI*2); ctx.stroke();

    ctx.restore();

    // cracks
    ctx.save();
    for (const c of planet.cracks) {
        const cx = PLANET_X + Math.cos(c.angle)*PLANET_R*0.45;
        const cy = PLANET_Y + Math.sin(c.angle)*PLANET_R*0.45;
        ctx.strokeStyle = `rgba(255,90,0,${0.55*(1-hr*0.3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        // squiggly crack
        for (let step=1; step<=3; step++) {
            const cf = step/3;
            const ox = (rnd()-0.5)*4;
            const oy = (rnd()-0.5)*4;
            ctx.lineTo(cx+Math.cos(c.angle)*c.len*cf+ox, cy+Math.sin(c.angle)*c.len*cf+oy);
        }
        ctx.stroke();
    }
    ctx.restore();

    // shield
    if (shieldActive) {
        planet.shieldPulse = (planet.shieldPulse||0) + 0.05;
        const a = 0.28 + 0.2*Math.sin(planet.shieldPulse);
        ctx.save();
        ctx.strokeStyle = `rgba(120,170,255,${a})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(PLANET_X,PLANET_Y,PLANET_R+14,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle = `rgba(180,220,255,${a*0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(PLANET_X,PLANET_Y,PLANET_R+22,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

function drawInterceptors() {
    for (const p of interceptors) {
        if (p.dead) continue;
        const fadeFrac = Math.min(1, (p.maxAge-p.age)/90);
        const [cr,cg,cb] = hex2rgb(p.col);

        // trail
        if (p.trail.length > 1) {
            for (let i = 1; i < p.trail.length; i++) {
                const a = (i/p.trail.length)*0.55*fadeFrac;
                const w = (i/p.trail.length)*3.5;
                ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
                ctx.lineWidth = w;
                ctx.beginPath();
                ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
                ctx.lineTo(p.trail[i].x, p.trail[i].y);
                ctx.stroke();
            }
        }

        ctx.save();
        ctx.globalAlpha = fadeFrac;
        if (p.glow > 0) {
            ctx.globalAlpha = fadeFrac * p.glow * 0.55;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r*3.5,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha = fadeFrac;
        }
        // outer glow
        const gg = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.2);
        gg.addColorStop(0,`rgba(${cr},${cg},${cb},0.9)`);
        gg.addColorStop(1,'transparent');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.2,0,Math.PI*2); ctx.fill();
        // core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*0.45,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

function drawThreats() {
    for (const t of threats) {
        ctx.save();
        ctx.translate(t.x,t.y);

        if (t.type==='comet') {
            ctx.restore();
            // tail
            if (t.tail.length > 1) {
                for (let i=1;i<t.tail.length;i++) {
                    const a = (i/t.tail.length)*0.65;
                    const w = (i/t.tail.length)*7;
                    ctx.strokeStyle = `rgba(140,210,255,${a})`;
                    ctx.lineWidth = w;
                    ctx.beginPath();
                    ctx.moveTo(t.tail[i-1].x,t.tail[i-1].y);
                    ctx.lineTo(t.tail[i].x,t.tail[i].y);
                    ctx.stroke();
                }
            }
            // head
            ctx.save();
            ctx.translate(t.x,t.y);
            const cg = ctx.createRadialGradient(0,0,0,0,0,t.r*2);
            cg.addColorStop(0,'#FFFFFF'); cg.addColorStop(0.45,'#AADDFF'); cg.addColorStop(1,'transparent');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.arc(0,0,t.r*2,0,Math.PI*2); ctx.fill();
            ctx.restore();
            continue;
        }

        if (t.type==='asteroid' || t.type==='boss') {
            ctx.rotate(t.rot);
            const ag = ctx.createRadialGradient(0,0,0,0,0,t.r);
            ag.addColorStop(0,lighten(t.col,45)); ag.addColorStop(1,t.col);
            ctx.fillStyle = ag;
            ctx.strokeStyle = lighten(t.col,20);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.verts[0].x, t.verts[0].y);
            for (let k=1;k<t.verts.length;k++) ctx.lineTo(t.verts[k].x, t.verts[k].y);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            if (t.isBoss) {
                ctx.globalAlpha = 0.28;
                ctx.fillStyle = '#FF6600';
                ctx.beginPath(); ctx.arc(0,0,t.r*1.35,0,Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                // boss HP bar
                ctx.restore();
                ctx.save();
                ctx.translate(t.x,t.y);
                const bw=88, bh=7, by=-t.r-18;
                ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2,by,bw,bh);
                ctx.fillStyle='#FF4400';
                ctx.fillRect(-bw/2,by,bw*(t.hp/t.maxHp),bh);
                ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
                ctx.strokeRect(-bw/2,by,bw,bh);
            }
        } else if (t.type==='drone') {
            ctx.rotate(t.rot);
            ctx.fillStyle = '#44FF88';
            ctx.strokeStyle = '#AAFFCC';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let k=0;k<6;k++) {
                const a=k/6*Math.PI*2;
                const px=Math.cos(a)*t.r, py=Math.sin(a)*t.r;
                k===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // inner eye
            ctx.strokeStyle='rgba(0,255,100,0.6)'; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(0,0,t.r*0.48,0,Math.PI*2); ctx.stroke();
            const pulse = 0.5+0.5*Math.sin(Date.now()*0.008);
            ctx.fillStyle=`rgba(0,255,100,${pulse*0.6})`;
            ctx.beginPath(); ctx.arc(0,0,t.r*0.18,0,Math.PI*2); ctx.fill();
            // drone shield
            if (t.shield) {
                ctx.strokeStyle='rgba(100,200,255,0.75)'; ctx.lineWidth=3;
                ctx.beginPath(); ctx.arc(0,0,t.r*1.45,0,Math.PI*2); ctx.stroke();
            }
        }
        ctx.restore();
    }
}

function drawParticles() {
    for (const p of particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = p.glow ? a*0.55 : a;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r*(p.glow ? a : 1), 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPowerups() {
    const now = Date.now();
    for (const p of powerups) {
        const fadeFrac = Math.min(1, p.life / 2);
        const pulse    = 0.7 + 0.3*Math.sin(now*0.005);
        ctx.save();
        ctx.globalAlpha = fadeFrac * pulse;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const [cr,cg,cb] = hex2rgb(p.col);
        // outer glow
        const gg = ctx.createRadialGradient(0,0,0,0,0,p.r*2.2);
        gg.addColorStop(0,`rgba(${cr},${cg},${cb},0.35)`);
        gg.addColorStop(1,'transparent');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(0,0,p.r*2.2,0,Math.PI*2); ctx.fill();
        // ring
        ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.stroke();
        // icon
        ctx.fillStyle = p.col;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, 0, 0);
        ctx.restore();
    }
}

function drawAimPreview() {
    if (!mouse.down || state!=='PLAYING') return;
    const dx=mouse.x-PLANET_X, dy=mouse.y-PLANET_Y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if (d < PLANET_R+5) return;
    const ang = Math.atan2(dy,dx);
    const rp  = PLANET_R + INTER_R + 2;
    const ra  = Math.max(rp+50, Math.min(d,360));
    const sm  = (rp+ra)/2;
    const c2  = (ra-rp)/2;
    const b   = Math.sqrt(Math.max(0, sm*sm - c2*c2));

    // aim line
    ctx.save();
    ctx.setLineDash([4,7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(PLANET_X,PLANET_Y); ctx.lineTo(mouse.x,mouse.y);
    ctx.stroke();

    // orbit ellipse
    const ecx = PLANET_X - Math.cos(ang)*c2;
    const ecy = PLANET_Y - Math.sin(ang)*c2;
    ctx.strokeStyle='rgba(0,200,255,0.28)'; ctx.lineWidth=1.5;
    ctx.setLineDash([3,7]);
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, sm, b, ang, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawWarnings() {
    const now = Date.now();
    for (const w of warns) {
        const a = (w.life/w.max)*0.9;
        const pulse = 0.5+0.5*Math.sin(now*0.012);
        // Arrow at screen edge
        const edgeDist = Math.min(GW, GH)*0.47;
        let ex = PLANET_X+Math.cos(w.angle)*edgeDist;
        let ey = PLANET_Y+Math.sin(w.angle)*edgeDist;
        ex = Math.max(16, Math.min(GW-16, ex));
        ey = Math.max(16, Math.min(GH-16, ey));
        ctx.save();
        ctx.translate(ex,ey); ctx.rotate(w.angle+Math.PI);
        ctx.globalAlpha = a*(0.5+0.5*pulse);
        ctx.fillStyle='#FF5500';
        ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(9,7); ctx.lineTo(-9,7); ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

function drawComboTexts() {
    for (const t of comboTexts) {
        const a = t.life/t.maxLife;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(t.x,t.y); ctx.scale(t.sc,t.sc);
        ctx.fillStyle = t.col;
        ctx.font = 'bold 19px monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowBlur=12; ctx.shadowColor=t.col;
        ctx.fillText(t.text,0,0);
        ctx.restore();
    }
}

function drawHUD() {
    // HP bar
    const bx=20,by=GH-30,bw=200,bh=14;
    const hr = planet.health/planet.maxHealth;
    const hcol = hr>0.6 ? '#44FF55' : hr>0.3 ? '#FFAA22' : '#FF2200';
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(bx-2,by-2,bw+4,bh+4);
    ctx.fillStyle=hcol; ctx.fillRect(bx,by,bw*hr,bh);
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#CCCCCC'; ctx.font='11px monospace'; ctx.textAlign='left';
    ctx.fillText(`HP  ${Math.ceil(planet.health)}`, bx+2, by-6);

    // Score
    ctx.fillStyle='#FFFFFF'; ctx.font='bold 23px monospace'; ctx.textAlign='right';
    ctx.fillText(score.toLocaleString(), GW-18, 34);
    ctx.fillStyle='rgba(180,180,180,0.7)'; ctx.font='12px monospace';
    ctx.fillText(`BEST ${highScore.toLocaleString()}`, GW-18, 52);

    // Wave
    ctx.fillStyle='#AAAAFF'; ctx.font='bold 15px monospace'; ctx.textAlign='center';
    ctx.fillText(`WAVE  ${wave}`, GW/2, 28);

    // Interceptor count
    const active = interceptors.filter(i=>!i.dead).length;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(16,28,148,18);
    ctx.fillStyle='#00CCFF'; ctx.font='11px monospace'; ctx.textAlign='left';
    ctx.fillText(`Interceptors  ${active} / ${maxInter}`, 20, 41);

    // Active buffs
    let oy=60;
    const buffLine=(text,col)=>{ ctx.fillStyle=col; ctx.font='11px monospace'; ctx.textAlign='left'; ctx.fillText(text,16,oy+=17); };
    if (shieldActive)      buffLine(`◈ SHIELD  ${Math.ceil(shieldTimer)}s`, '#4488FF');
    if (timeSlowTimer>0)   buffLine(`⧖ TIME SLOW  ${Math.ceil(timeSlowTimer)}s`, '#FF88FF');
    if (multiShotTimer>0)  buffLine(`≡ MULTI-SHOT  ${Math.ceil(multiShotTimer)}s`, '#FFFF44');

    // Combo strip
    if (combo>=2 && comboTimer>0) {
        const ca = Math.min(1, comboTimer*1.5);
        ctx.save(); ctx.globalAlpha=ca;
        ctx.fillStyle='#FFFF44';
        ctx.font=`bold ${18+Math.min(combo,12)}px monospace`;
        ctx.textAlign='center'; ctx.shadowBlur=14; ctx.shadowColor='#FF8800';
        ctx.fillText(`${combo} COMBO  ×${comboMult()}`, GW/2, GH/2-62);
        ctx.restore();
    }

    // Between waves countdown
    if (betweenWaves && betweenWaveTimer > 0.8) {
        const alpha = Math.min(1,(betweenWaveTimer-0.8)*2);
        ctx.save(); ctx.globalAlpha=alpha;
        ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(GW/2-155,GH/2-32,310,62);
        ctx.fillStyle='#FFFFFF'; ctx.font='bold 24px monospace'; ctx.textAlign='center';
        ctx.fillText(`WAVE ${wave+1} INCOMING`, GW/2, GH/2-2);
        ctx.fillStyle='#AAAAAA'; ctx.font='13px monospace';
        ctx.fillText(`starting in ${Math.ceil(betweenWaveTimer)}s`, GW/2, GH/2+22);
        ctx.restore();
    }

    // Time-slow vignette
    if (timeSlowTimer>0) {
        ctx.save();
        ctx.strokeStyle='rgba(255,100,255,0.38)'; ctx.lineWidth=8;
        ctx.strokeRect(4,4,GW-8,GH-8);
        ctx.restore();
    }
}

function drawStartScreen() {
    ctx.fillStyle='rgba(0,0,24,0.82)'; ctx.fillRect(0,0,GW,GH);

    // title
    ctx.save();
    ctx.textAlign='center';
    ctx.shadowBlur=24; ctx.shadowColor='#0088FF';
    ctx.fillStyle='#00CCFF'; ctx.font='bold 54px monospace';
    ctx.fillText('ORBITAL DEFENSE', GW/2, GH/2-95);
    ctx.shadowBlur=0;

    ctx.fillStyle='#88BBFF'; ctx.font='16px monospace';
    ctx.fillText('One planet.  Endless orbit.  Total defense.', GW/2, GH/2-55);

    ctx.fillStyle='rgba(200,200,200,0.75)'; ctx.font='13px monospace';
    ctx.fillText('Click / tap to aim & launch interceptors', GW/2, GH/2+2);
    ctx.fillText('Drag from planet — closer = tighter orbit', GW/2, GH/2+22);
    ctx.fillText('Collect power-ups  ·  build combos  ·  survive!', GW/2, GH/2+44);

    const p = 0.65 + 0.35*Math.sin(Date.now()*0.0028);
    ctx.fillStyle=`rgba(0,200,255,${p})`; ctx.font='bold 26px monospace';
    ctx.fillText('[ CLICK TO START ]', GW/2, GH/2+105);

    if (highScore>0) {
        ctx.fillStyle='#FFAA00'; ctx.font='15px monospace';
        ctx.fillText(`Best Score:  ${highScore.toLocaleString()}`, GW/2, GH/2+145);
    }
    if (bestWave>0) {
        ctx.fillStyle='#AAFFAA'; ctx.font='13px monospace';
        ctx.fillText(`Best Wave:  ${bestWave}`, GW/2, GH/2+168);
    }
    ctx.restore();
}

function drawGameOver() {
    const fadeFrac = Math.min(1, gameOverTimer/1.8);
    ctx.fillStyle=`rgba(0,0,0,${fadeFrac*0.72})`; ctx.fillRect(0,0,GW,GH);

    if (gameOverTimer > 1.0) {
        const a = Math.min(1,(gameOverTimer-1.0)*1.5);
        ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center';
        ctx.shadowBlur=22; ctx.shadowColor='#FF0000';
        ctx.fillStyle='#FF4400'; ctx.font='bold 54px monospace';
        ctx.fillText('PLANET LOST', GW/2, GH/2-85);
        ctx.shadowBlur=0;

        ctx.fillStyle='#FFFFFF'; ctx.font='22px monospace';
        ctx.fillText(`Score:  ${score.toLocaleString()}`, GW/2, GH/2-30);
        ctx.fillText(`Wave:  ${wave}  ${wave >= bestWave && wave > 0 ? '(new best!)' : bestWave > 0 ? `(best: ${bestWave})` : ''}`, GW/2, GH/2+4);
        ctx.fillText(`Best Combo:  ${maxCombo}×`, GW/2, GH/2+38);

        if (score>=highScore && score>0) {
            ctx.fillStyle='#FFDD00'; ctx.font='bold 18px monospace';
            ctx.fillText('✦  NEW HIGH SCORE  ✦', GW/2, GH/2-60);
        } else {
            ctx.fillStyle='#FFAA00'; ctx.font='15px monospace';
            ctx.fillText(`Best:  ${highScore.toLocaleString()}`, GW/2, GH/2-60);
        }

        const p2 = 0.65+0.35*Math.sin(Date.now()*0.003);
        ctx.fillStyle=`rgba(255,255,255,${p2*a})`; ctx.font='bold 23px monospace';
        ctx.fillText('[ CLICK TO RESTART ]', GW/2, GH/2+98);
        ctx.restore();
    }
}

// ── Main render call ──────────────────────────────────────────────────────────
function render() {
    ctx.clearRect(0,0,GW,GH);
    drawBackground();

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawStars();

    if (state==='PLAYING' || state==='GAME_OVER') {
        drawWarnings();
        drawAimPreview();
        drawPowerups();
        drawThreats();
        drawInterceptors();
        if (state!=='GAME_OVER' || planet.health>0) drawPlanet();
        drawParticles();
        drawComboTexts();
        if (state==='PLAYING') drawHUD();
    }

    ctx.restore();

    if (state==='START')     drawStartScreen();
    if (state==='GAME_OVER') drawGameOver();

    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0,0,GW,GH);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 40px monospace';
        ctx.fillText('PAUSED', GW/2, GH/2);
        ctx.fillStyle = '#AAAAAA'; ctx.font = '16px monospace';
        ctx.fillText('ESC to resume', GW/2, GH/2+38);
    }
}

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && (state === 'PLAYING' || paused)) paused = !paused;
});

mouse = { x:GW/2, y:GH/2, down:false };

function canvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    const sx = GW/r.width, sy = GH/r.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x:(cx-r.left)*sx, y:(cy-r.top)*sy };
}

function onDown(x, y) {
    if (state==='START') {
        initAudio();
        initGame();
        return;
    }
    if (state==='GAME_OVER') {
        if (gameOverTimer>1.2) { initAudio(); initGame(); }
        return;
    }
    mouse.down=true; mouse.x=x; mouse.y=y;
}

function onUp(x, y) {
    if (state!=='PLAYING') { mouse.down=false; return; }
    mouse.down=false;
    // check powerup tap-collect
    for (let i=powerups.length-1;i>=0;i--) {
        const p=powerups[i];
        const dx=x-p.x,dy=y-p.y;
        if (dx*dx+dy*dy < (p.r+14)*(p.r+14)) { collectPup(p); powerups.splice(i,1); return; }
    }
    launchAt(x, y);
}

function onMove(x, y) { mouse.x=x; mouse.y=y; }

canvas.addEventListener('mousedown',  e=>{ e.preventDefault(); const c=canvasCoords(e); onDown(c.x,c.y); });
canvas.addEventListener('mouseup',    e=>{ e.preventDefault(); const c=canvasCoords(e); onUp(c.x,c.y); });
canvas.addEventListener('mousemove',  e=>{ const c=canvasCoords(e); onMove(c.x,c.y); });
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); const c=canvasCoords(e); onDown(c.x,c.y); }, {passive:false});
canvas.addEventListener('touchend',   e=>{
    e.preventDefault();
    const t=e.changedTouches[0];
    const r=canvas.getBoundingClientRect();
    onUp((t.clientX-r.left)*(GW/r.width),(t.clientY-r.top)*(GH/r.height));
}, {passive:false});
canvas.addEventListener('touchmove',  e=>{ e.preventDefault(); const c=canvasCoords(e); onMove(c.x,c.y); }, {passive:false});

// ── Game loop ─────────────────────────────────────────────────────────────────
state = 'START';
buildStars();

let lastTS = 0;
function loop(ts) {
    const dt = Math.min((ts-lastTS)/1000, 0.05);
    lastTS = ts;
    if ((state==='PLAYING' || state==='GAME_OVER') && !paused) update(dt);
    render();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
