const canvas  = document.getElementById('gameCanvas');
const ctx      = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const livesEl  = document.getElementById('lives');
const levelEl  = document.getElementById('level-display');

// ── Canvas scaling ─────────────────────────────────────────────────────────────
// Logical resolution: 400×300. syncSize maps CSS pixels → logical pixels.

let W = 400, H = 300;

function syncSize() {
    const cw = canvas.clientWidth;
    const ch = Math.round(cw * 3 / 4);
    if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width  = cw;
        canvas.height = ch;
    }
    W = canvas.width;
    H = canvas.height;
}

window.addEventListener('resize', syncSize);
syncSize();

// ── Audio ──────────────────────────────────────────────────────────────────────

let audioCtx = null, masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(audioCtx.destination);
}

function playTone(freq, type, dur, vol = 0.5, startFreq = null) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(startFreq || freq, audioCtx.currentTime);
    if (startFreq) o.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + dur);
}

function sfxJump()    { playTone(520, 'square', 0.12, 0.3, 280); }
function sfxCoin()    { playTone(880, 'sine',   0.1,  0.4); playTone(1100, 'sine', 0.1, 0.3); }
function sfxStomp()   { playTone(220, 'square', 0.15, 0.4, 440); }
function sfxDie()     { [300, 240, 180, 120].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.18, 0.3), i * 80)); }
function sfxClear()   { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.2, 0.35), i * 100)); }
function sfxLand()    { playTone(160, 'sine', 0.06, 0.2); }

// ── Input ──────────────────────────────────────────────────────────────────────

const keys = { left: false, right: false, jump: false };
let jumpPressed = false; // edge-detect for jump

window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !e.repeat) {
        keys.jump = true; jumpPressed = true;
    }
    if (e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === ' ') keys.jump = false;
});

// Touch buttons
function bindBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press = () => { initAudio(); keys[key] = true; if (key === 'jump') jumpPressed = true; btn.classList.add('pressed'); };
    const release = () => { keys[key] = false; btn.classList.remove('pressed'); };
    btn.addEventListener('touchstart', e => { e.preventDefault(); press(); }, { passive: false });
    btn.addEventListener('touchend',   e => { e.preventDefault(); release(); }, { passive: false });
    btn.addEventListener('touchcancel',e => { e.preventDefault(); release(); }, { passive: false });
    btn.addEventListener('mousedown',  () => press());
    btn.addEventListener('mouseup',    () => release());
    btn.addEventListener('mouseleave', () => release());
}

bindBtn('btn-left',  'left');
bindBtn('btn-right', 'right');
bindBtn('btn-jump',  'jump');

canvas.addEventListener('touchstart', () => initAudio(), { once: true });
canvas.addEventListener('click',      () => initAudio(), { once: true });

// ── Constants ──────────────────────────────────────────────────────────────────

const GRAVITY      = 0.38;
const MAX_FALL     = 14;
const PLAYER_SPD   = 3.4;
const JUMP_VEL     = -9.5;
const COYOTE_MS    = 120;   // ms of coyote time
const JUMP_BUFFER  = 120;   // ms jump input buffer

const STATE = { START: 0, PLAYING: 1, DYING: 2, LEVEL_CLEAR: 3, GAMEOVER: 4 };

// ── Level definitions ──────────────────────────────────────────────────────────
// Coordinates are in a 400×300 logical space, scaled to actual canvas each frame.
// Level width varies; platforms are { x, y, w, h }, coins are { x, y },
// enemies are { x, y, x1, x2, spd }, goal is { x, y }.

function makeLevels() {
    return [
        // ── Level 1 ── gentle intro ───────────────────────────────────────────
        {
            width: 2200,
            bgColor: '#0d1b2a',
            groundColor: '#2d5a27',
            platformColor: '#3d7a37',
            platforms: [
                // ground segments (with a gap to motivate jumping)
                { x: 0,    y: 260, w: 400, h: 40 },
                { x: 450,  y: 260, w: 350, h: 40 },
                { x: 850,  y: 260, w: 300, h: 40 },
                { x: 1200, y: 260, w: 400, h: 40 },
                { x: 1660, y: 260, w: 540, h: 40 },
                // floating platforms
                { x: 180,  y: 200, w: 90,  h: 14 },
                { x: 360,  y: 170, w: 80,  h: 14 },
                { x: 500,  y: 210, w: 110, h: 14 },
                { x: 660,  y: 180, w: 90,  h: 14 },
                { x: 800,  y: 220, w: 80,  h: 14 },
                { x: 950,  y: 190, w: 100, h: 14 },
                { x: 1090, y: 230, w: 80,  h: 14 },
                { x: 1300, y: 200, w: 120, h: 14 },
                { x: 1480, y: 170, w: 90,  h: 14 },
                { x: 1600, y: 220, w: 80,  h: 14 },
            ],
            coins: [
                { x: 200, y: 178 }, { x: 230, y: 178 }, { x: 380, y: 148 },
                { x: 540, y: 188 }, { x: 680, y: 158 }, { x: 820, y: 198 },
                { x: 960, y: 168 }, { x: 1110,y: 208 }, { x: 1320,y: 178 },
                { x: 1500,y: 148 }, { x: 1620,y: 198 },
                // ground coins
                { x: 470, y: 238 }, { x: 870, y: 238 }, { x: 1220,y: 238 },
            ],
            enemies: [
                { x: 510,  y: 196, x1: 500,  x2: 600,  spd: 1.0 },
                { x: 960,  y: 176, x1: 950,  x2: 1040, spd: 1.2 },
                { x: 1310, y: 186, x1: 1300, x2: 1400, spd: 1.0 },
            ],
            goal: { x: 2120, y: 218 },
        },

        // ── Level 2 ── moving platforms, more gaps ────────────────────────────
        {
            width: 2600,
            bgColor: '#0a1628',
            groundColor: '#1a3a5c',
            platformColor: '#2a5a8c',
            platforms: [
                { x: 0,    y: 260, w: 280, h: 40 },
                { x: 340,  y: 260, w: 200, h: 40 },
                { x: 620,  y: 260, w: 180, h: 40 },
                { x: 900,  y: 260, w: 220, h: 40 },
                { x: 1220, y: 260, w: 180, h: 40 },
                { x: 1550, y: 260, w: 200, h: 40 },
                { x: 1870, y: 260, w: 180, h: 40 },
                { x: 2180, y: 260, w: 420, h: 40 },
                // floaters
                { x: 140,  y: 210, w: 90,  h: 14 },
                { x: 350,  y: 180, w: 80,  h: 14 },
                { x: 490,  y: 210, w: 70,  h: 14 },
                { x: 640,  y: 175, w: 90,  h: 14 },
                { x: 780,  y: 200, w: 80,  h: 14 },
                { x: 920,  y: 165, w: 100, h: 14 },
                { x: 1060, y: 200, w: 80,  h: 14 },
                { x: 1200, y: 170, w: 90,  h: 14 },
                { x: 1340, y: 210, w: 80,  h: 14 },
                { x: 1480, y: 175, w: 90,  h: 14 },
                { x: 1620, y: 205, w: 80,  h: 14 },
                { x: 1760, y: 165, w: 100, h: 14 },
                { x: 1900, y: 195, w: 80,  h: 14 },
                { x: 2040, y: 160, w: 100, h: 14 },
                { x: 2160, y: 200, w: 80,  h: 14 },
            ],
            moving: [
                { x: 290, y: 220, w: 80, h: 14, x1: 290, x2: 380, spd: 1.2, dir: 1 },
                { x: 830, y: 195, w: 80, h: 14, x1: 820, x2: 940, spd: 1.5, dir: 1 },
                { x: 1460,y: 185, w: 80, h: 14, x1: 1440,x2: 1580,spd: 1.8, dir: 1 },
            ],
            coins: [
                { x: 160, y: 188 }, { x: 360, y: 158 }, { x: 500, y: 188 },
                { x: 660, y: 153 }, { x: 800, y: 178 }, { x: 940, y: 143 },
                { x: 1070,y: 178 }, { x: 1210,y: 148 }, { x: 1350,y: 188 },
                { x: 1490,y: 153 }, { x: 1630,y: 183 }, { x: 1770,y: 143 },
                { x: 1910,y: 173 }, { x: 2050,y: 138 }, { x: 2170,y: 178 },
                { x: 355, y: 238 }, { x: 640, y: 238 }, { x: 920, y: 238 },
            ],
            enemies: [
                { x: 370,  y: 166, x1: 350,  x2: 420,  spd: 1.2 },
                { x: 660,  y: 161, x1: 640,  x2: 730,  spd: 1.4 },
                { x: 930,  y: 151, x1: 920,  x2: 1020, spd: 1.6 },
                { x: 1780, y: 151, x1: 1760, x2: 1860, spd: 1.8 },
                { x: 2050, y: 146, x1: 2040, x2: 2140, spd: 1.5 },
            ],
            goal: { x: 2530, y: 218 },
        },

        // ── Level 3 ── narrow platforms, more enemies ─────────────────────────
        {
            width: 2800,
            bgColor: '#1a0a28',
            groundColor: '#4a1a6a',
            platformColor: '#6a2a9a',
            platforms: [
                { x: 0,    y: 260, w: 240, h: 40 },
                { x: 310,  y: 260, w: 160, h: 40 },
                { x: 560,  y: 260, w: 150, h: 40 },
                { x: 820,  y: 260, w: 160, h: 40 },
                { x: 1090, y: 260, w: 150, h: 40 },
                { x: 1360, y: 260, w: 160, h: 40 },
                { x: 1640, y: 260, w: 150, h: 40 },
                { x: 1920, y: 260, w: 160, h: 40 },
                { x: 2200, y: 260, w: 600, h: 40 },
                // platforms — narrower
                { x: 120,  y: 215, w: 70,  h: 14 },
                { x: 240,  y: 185, w: 65,  h: 14 },
                { x: 330,  y: 215, w: 70,  h: 14 },
                { x: 450,  y: 180, w: 65,  h: 14 },
                { x: 580,  y: 215, w: 70,  h: 14 },
                { x: 700,  y: 178, w: 65,  h: 14 },
                { x: 840,  y: 215, w: 70,  h: 14 },
                { x: 960,  y: 175, w: 65,  h: 14 },
                { x: 1100, y: 215, w: 70,  h: 14 },
                { x: 1220, y: 178, w: 65,  h: 14 },
                { x: 1370, y: 215, w: 70,  h: 14 },
                { x: 1490, y: 175, w: 65,  h: 14 },
                { x: 1650, y: 215, w: 70,  h: 14 },
                { x: 1770, y: 178, w: 65,  h: 14 },
                { x: 1930, y: 215, w: 70,  h: 14 },
                { x: 2050, y: 175, w: 65,  h: 14 },
                { x: 2170, y: 215, w: 70,  h: 14 },
            ],
            moving: [
                { x: 380, y: 205, w: 65, h: 14, x1: 310, x2: 460, spd: 1.8, dir: 1 },
                { x: 710, y: 195, w: 65, h: 14, x1: 660, x2: 800, spd: 2.0, dir: 1 },
                { x: 1240,y: 195, w: 65, h: 14, x1: 1220,x2: 1360,spd: 2.2, dir: -1 },
                { x: 1790,y: 195, w: 65, h: 14, x1: 1760,x2: 1920,spd: 2.0, dir: 1 },
            ],
            coins: [
                { x: 140, y: 193 }, { x: 260, y: 163 }, { x: 345, y: 193 },
                { x: 465, y: 158 }, { x: 595, y: 193 }, { x: 715, y: 156 },
                { x: 855, y: 193 }, { x: 975, y: 153 }, { x: 1115,y: 193 },
                { x: 1235,y: 156 }, { x: 1385,y: 193 }, { x: 1505,y: 153 },
                { x: 1665,y: 193 }, { x: 1785,y: 156 }, { x: 1945,y: 193 },
                { x: 2065,y: 153 }, { x: 2185,y: 193 },
            ],
            enemies: [
                { x: 350,  y: 201, x1: 330,  x2: 390,  spd: 1.4 },
                { x: 600,  y: 201, x1: 580,  x2: 650,  spd: 1.6 },
                { x: 855,  y: 201, x1: 840,  x2: 910,  spd: 1.8 },
                { x: 1110, y: 201, x1: 1100, x2: 1170, spd: 2.0 },
                { x: 1375, y: 201, x1: 1360, x2: 1430, spd: 1.8 },
                { x: 1660, y: 201, x1: 1650, x2: 1720, spd: 2.0 },
                { x: 1940, y: 201, x1: 1920, x2: 1990, spd: 2.2 },
            ],
            goal: { x: 2720, y: 218 },
        },

        // ── Level 4 ── lots of moving, faster everything ───────────────────────
        {
            width: 3000,
            bgColor: '#0f1a0a',
            groundColor: '#1a4a10',
            platformColor: '#2a7a20',
            platforms: [
                { x: 0,    y: 260, w: 200, h: 40 },
                { x: 2820, y: 260, w: 180, h: 40 },
                { x: 100,  y: 220, w: 80,  h: 14 },
                { x: 240,  y: 190, w: 75,  h: 14 },
                { x: 370,  y: 220, w: 80,  h: 14 },
                { x: 500,  y: 185, w: 75,  h: 14 },
                { x: 630,  y: 220, w: 80,  h: 14 },
                { x: 760,  y: 185, w: 75,  h: 14 },
                { x: 890,  y: 220, w: 80,  h: 14 },
                { x: 1020, y: 180, w: 75,  h: 14 },
                { x: 1150, y: 215, w: 80,  h: 14 },
                { x: 1280, y: 178, w: 75,  h: 14 },
                { x: 1410, y: 215, w: 80,  h: 14 },
                { x: 1540, y: 178, w: 75,  h: 14 },
                { x: 1670, y: 215, w: 80,  h: 14 },
                { x: 1800, y: 178, w: 75,  h: 14 },
                { x: 1930, y: 215, w: 80,  h: 14 },
                { x: 2060, y: 178, w: 75,  h: 14 },
                { x: 2190, y: 215, w: 80,  h: 14 },
                { x: 2320, y: 178, w: 75,  h: 14 },
                { x: 2450, y: 215, w: 80,  h: 14 },
                { x: 2580, y: 178, w: 75,  h: 14 },
                { x: 2700, y: 215, w: 80,  h: 14 },
            ],
            moving: [
                { x: 170, y: 210, w: 75, h: 14, x1: 140, x2: 240, spd: 2.0, dir: 1 },
                { x: 530, y: 205, w: 75, h: 14, x1: 490, x2: 630, spd: 2.4, dir: 1 },
                { x: 790, y: 200, w: 75, h: 14, x1: 760, x2: 890, spd: 2.8, dir: -1},
                { x: 1055,y: 200, w: 75, h: 14, x1: 1020,x2: 1150,spd: 2.4, dir: 1 },
                { x: 1315,y: 200, w: 75, h: 14, x1: 1280,x2: 1410,spd: 2.6, dir:-1 },
                { x: 1575,y: 195, w: 75, h: 14, x1: 1540,x2: 1670,spd: 2.8, dir: 1 },
                { x: 1835,y: 195, w: 75, h: 14, x1: 1800,x2: 1930,spd: 3.0, dir:-1 },
                { x: 2095,y: 195, w: 75, h: 14, x1: 2060,x2: 2190,spd: 2.8, dir: 1 },
                { x: 2355,y: 195, w: 75, h: 14, x1: 2320,x2: 2450,spd: 3.0, dir:-1 },
                { x: 2615,y: 195, w: 75, h: 14, x1: 2580,x2: 2700,spd: 3.2, dir: 1 },
            ],
            coins: [],  // generated below
            enemies: [
                { x: 250,  y: 176, x1: 240,  x2: 315,  spd: 2.2 },
                { x: 510,  y: 171, x1: 500,  x2: 575,  spd: 2.4 },
                { x: 770,  y: 171, x1: 760,  x2: 835,  spd: 2.6 },
                { x: 1030, y: 166, x1: 1020, x2: 1095, spd: 2.4 },
                { x: 1290, y: 164, x1: 1280, x2: 1355, spd: 2.6 },
                { x: 1550, y: 164, x1: 1540, x2: 1615, spd: 2.8 },
                { x: 1810, y: 164, x1: 1800, x2: 1875, spd: 2.6 },
                { x: 2070, y: 164, x1: 2060, x2: 2135, spd: 2.8 },
                { x: 2710, y: 201, x1: 2700, x2: 2780, spd: 2.2 },
            ],
            goal: { x: 2920, y: 218 },
        },

        // ── Level 5 ── boss rush: everything fast, tight jumps ─────────────────
        {
            width: 3200,
            bgColor: '#1a0808',
            groundColor: '#5a1010',
            platformColor: '#8a1818',
            platforms: [
                { x: 0,    y: 260, w: 180, h: 40 },
                { x: 3060, y: 260, w: 140, h: 40 },
                { x: 80,   y: 215, w: 70,  h: 14 },
                { x: 210,  y: 185, w: 65,  h: 14 },
                { x: 335,  y: 215, w: 70,  h: 14 },
                { x: 460,  y: 180, w: 65,  h: 14 },
                { x: 580,  y: 215, w: 70,  h: 14 },
                { x: 700,  y: 175, w: 65,  h: 14 },
                { x: 820,  y: 215, w: 70,  h: 14 },
                { x: 940,  y: 175, w: 65,  h: 14 },
                { x: 1060, y: 215, w: 70,  h: 14 },
                { x: 1180, y: 172, w: 65,  h: 14 },
                { x: 1300, y: 215, w: 70,  h: 14 },
                { x: 1420, y: 172, w: 65,  h: 14 },
                { x: 1540, y: 215, w: 70,  h: 14 },
                { x: 1660, y: 172, w: 65,  h: 14 },
                { x: 1780, y: 215, w: 70,  h: 14 },
                { x: 1900, y: 172, w: 65,  h: 14 },
                { x: 2020, y: 215, w: 70,  h: 14 },
                { x: 2140, y: 172, w: 65,  h: 14 },
                { x: 2260, y: 215, w: 70,  h: 14 },
                { x: 2380, y: 172, w: 65,  h: 14 },
                { x: 2500, y: 215, w: 70,  h: 14 },
                { x: 2620, y: 172, w: 65,  h: 14 },
                { x: 2740, y: 215, w: 70,  h: 14 },
                { x: 2860, y: 172, w: 65,  h: 14 },
                { x: 2980, y: 215, w: 70,  h: 14 },
            ],
            moving: [
                { x: 145,  y: 205, w: 65, h: 14, x1: 80,  x2: 210, spd: 2.5, dir: 1  },
                { x: 280,  y: 200, w: 65, h: 14, x1: 210, x2: 335, spd: 2.8, dir:-1  },
                { x: 415,  y: 198, w: 65, h: 14, x1: 335, x2: 460, spd: 3.0, dir: 1  },
                { x: 545,  y: 200, w: 65, h: 14, x1: 460, x2: 580, spd: 3.2, dir:-1  },
                { x: 660,  y: 195, w: 65, h: 14, x1: 580, x2: 700, spd: 3.0, dir: 1  },
                { x: 780,  y: 195, w: 65, h: 14, x1: 700, x2: 820, spd: 3.4, dir:-1  },
                { x: 900,  y: 195, w: 65, h: 14, x1: 820, x2: 940, spd: 3.2, dir: 1  },
                { x: 1020, y: 193, w: 65, h: 14, x1: 940, x2: 1060,spd: 3.6, dir:-1  },
                { x: 1140, y: 190, w: 65, h: 14, x1: 1060,x2: 1180,spd: 3.4, dir: 1  },
                { x: 1260, y: 190, w: 65, h: 14, x1: 1180,x2: 1300,spd: 3.6, dir:-1  },
                { x: 1380, y: 190, w: 65, h: 14, x1: 1300,x2: 1420,spd: 3.8, dir: 1  },
                { x: 1500, y: 190, w: 65, h: 14, x1: 1420,x2: 1540,spd: 3.6, dir:-1  },
                { x: 1620, y: 190, w: 65, h: 14, x1: 1540,x2: 1660,spd: 3.8, dir: 1  },
                { x: 1740, y: 190, w: 65, h: 14, x1: 1660,x2: 1780,spd: 4.0, dir:-1  },
                { x: 1860, y: 190, w: 65, h: 14, x1: 1780,x2: 1900,spd: 3.8, dir: 1  },
                { x: 1980, y: 190, w: 65, h: 14, x1: 1900,x2: 2020,spd: 4.0, dir:-1  },
                { x: 2100, y: 190, w: 65, h: 14, x1: 2020,x2: 2140,spd: 4.2, dir: 1  },
                { x: 2220, y: 190, w: 65, h: 14, x1: 2140,x2: 2260,spd: 4.0, dir:-1  },
                { x: 2340, y: 190, w: 65, h: 14, x1: 2260,x2: 2380,spd: 4.2, dir: 1  },
                { x: 2460, y: 190, w: 65, h: 14, x1: 2380,x2: 2500,spd: 4.4, dir:-1  },
                { x: 2580, y: 190, w: 65, h: 14, x1: 2500,x2: 2620,spd: 4.2, dir: 1  },
                { x: 2700, y: 190, w: 65, h: 14, x1: 2620,x2: 2740,spd: 4.4, dir:-1  },
                { x: 2820, y: 190, w: 65, h: 14, x1: 2740,x2: 2860,spd: 4.6, dir: 1  },
                { x: 2940, y: 190, w: 65, h: 14, x1: 2860,x2: 2980,spd: 4.4, dir:-1  },
            ],
            coins: [],
            enemies: [
                { x: 220,  y: 171, x1: 210, x2: 275, spd: 2.8 },
                { x: 470,  y: 166, x1: 460, x2: 525, spd: 3.0 },
                { x: 710,  y: 161, x1: 700, x2: 765, spd: 3.2 },
                { x: 950,  y: 161, x1: 940, x2: 1005,spd: 3.4 },
                { x: 1190, y: 158, x1: 1180,x2: 1245,spd: 3.6 },
                { x: 1430, y: 158, x1: 1420,x2: 1485,spd: 3.8 },
                { x: 1670, y: 158, x1: 1660,x2: 1725,spd: 3.6 },
                { x: 1910, y: 158, x1: 1900,x2: 1965,spd: 3.8 },
                { x: 2150, y: 158, x1: 2140,x2: 2205,spd: 4.0 },
                { x: 2390, y: 158, x1: 2380,x2: 2445,spd: 3.8 },
                { x: 2630, y: 158, x1: 2620,x2: 2685,spd: 4.0 },
                { x: 2870, y: 158, x1: 2860,x2: 2925,spd: 4.2 },
            ],
            goal: { x: 3120, y: 218 },
        },
    ];
}

// ── State variables ────────────────────────────────────────────────────────────

let state, score, highScore, lives, levelIdx;
let player, camera, platforms, moving, coins, enemies, goal;
let levelData, particles, deathTimer, clearTimer, startTimer;
let coyoteTimer, jumpBufferTimer, lastTS;
let stompBounce = false;

// ── Init ───────────────────────────────────────────────────────────────────────

function init() {
    syncSize();
    highScore = parseInt(localStorage.getItem('pixelDashHigh') || '0', 10);
    state     = STATE.START;
    startTimer = 0;
    requestAnimationFrame(loop);
}

function startGame() {
    score    = 0;
    lives    = 3;
    levelIdx = 0;
    loadLevel();
    state = STATE.PLAYING;
    updateHUD();
}

function loadLevel() {
    const levels = makeLevels();
    levelData = levels[levelIdx];

    // Generate coins for levels 4 & 5 programmatically
    if (levelData.coins.length === 0) {
        const allPlat = [...(levelData.platforms || []), ...(levelData.moving || [])];
        allPlat.forEach(p => {
            if (p.w > 50) levelData.coins.push({ x: p.x + p.w / 2 - 8, y: p.y - 22 });
        });
    }

    platforms = levelData.platforms.map(p => ({ ...p }));
    moving    = (levelData.moving || []).map(m => ({ ...m }));
    coins     = levelData.coins.map(c => ({ ...c, collected: false }));
    enemies   = levelData.enemies.map(e => ({
        ...e, vx: e.spd, dead: false,
        w: 18, h: 18,
        deadTimer: 0,
    }));
    goal = { ...levelData.goal, w: 24, h: 40 };

    spawnPlayer();
    camera = { x: 0 };
    particles = [];
    deathTimer = 0;
    clearTimer = 0;
    coyoteTimer = 0;
    jumpBufferTimer = 0;

    levelEl.textContent = 'LEVEL ' + (levelIdx + 1);
}

function spawnPlayer() {
    player = {
        x: 30, y: 230,
        vx: 0, vy: 0,
        w: 20, h: 28,
        onGround: false,
        facingRight: true,
        invincible: 0,       // frames of invincibility after respawn
        ridingMoving: null,
    };
}

function updateHUD() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
}

// ── Physics helpers ────────────────────────────────────────────────────────────

function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolvePlayerPlatform(p, px, prevBottom) {
    if (!rectOverlap(player, p)) return false;
    const fromAbove = prevBottom <= p.y + 2;
    if (fromAbove && player.vy >= 0) {
        player.y  = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        return true;
    }
    // side collision
    const overlapLeft  = (player.x + player.w) - p.x;
    const overlapRight = (p.x + p.w) - player.x;
    if (overlapLeft < overlapRight) player.x = p.x - player.w;
    else player.x = p.x + p.w;
    player.vx = 0;
    return false;
}

// ── Update ─────────────────────────────────────────────────────────────────────

function update(dt) {
    if (state === STATE.DYING) {
        deathTimer -= dt;
        updateParticles(dt);
        if (deathTimer <= 0) {
            lives--;
            updateHUD();
            if (lives <= 0) { state = STATE.GAMEOVER; return; }
            spawnPlayer();
            state = STATE.PLAYING;
        }
        return;
    }

    if (state === STATE.LEVEL_CLEAR) {
        clearTimer -= dt;
        updateParticles(dt);
        if (clearTimer <= 0) {
            levelIdx++;
            if (levelIdx >= makeLevels().length) {
                state = STATE.GAMEOVER; // victory
                return;
            }
            loadLevel();
            state = STATE.PLAYING;
        }
        return;
    }

    if (state !== STATE.PLAYING) return;

    // Moving platforms
    moving.forEach(m => {
        m.x += m.spd * m.dir;
        if (m.x + m.w >= m.x2) { m.x = m.x2 - m.w; m.dir = -1; }
        if (m.x <= m.x1)        { m.x = m.x1;        m.dir =  1; }
    });

    // Save previous position for collision resolution
    const prevBottom = player.y + player.h;
    const prevX      = player.x;

    // Horizontal movement
    player.vx = 0;
    if (keys.left)  { player.vx = -PLAYER_SPD; player.facingRight = false; }
    if (keys.right) { player.vx =  PLAYER_SPD; player.facingRight = true;  }

    // Coyote time
    if (player.onGround) coyoteTimer = COYOTE_MS;
    else coyoteTimer = Math.max(0, coyoteTimer - dt);

    // Jump buffer
    if (jumpPressed) { jumpBufferTimer = JUMP_BUFFER; jumpPressed = false; }
    else jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);

    // Jump
    if (jumpBufferTimer > 0 && (player.onGround || coyoteTimer > 0)) {
        player.vy       = JUMP_VEL;
        coyoteTimer     = 0;
        jumpBufferTimer = 0;
        player.onGround = false;
        sfxJump();
    }

    // Variable jump height: release early = lower arc
    if (!keys.jump && player.vy < -4) player.vy += 0.7;

    // Gravity
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);

    player.x += player.vx;
    player.y += player.vy;

    // Clamp to level bounds
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > levelData.width) player.x = levelData.width - player.w;

    // Platform collision
    const wasOnGround = player.onGround;
    player.onGround = false;
    player.ridingMoving = null;

    const allPlatforms = [...platforms, ...moving];
    for (const p of allPlatforms) {
        const landed = resolvePlayerPlatform(p, prevX, prevBottom);
        if (landed && p.spd !== undefined) player.ridingMoving = p; // moving platform
    }

    if (!wasOnGround && player.onGround) sfxLand();

    // Carry player on moving platform
    if (player.ridingMoving) {
        player.x += player.ridingMoving.spd * player.ridingMoving.dir;
    }

    // Camera
    const targetCamX = player.x + player.w / 2 - W / 2;
    camera.x = Math.max(0, Math.min(targetCamX, levelData.width - W));

    // Coins
    coins.forEach(c => {
        if (c.collected) return;
        if (rectOverlap(player, { x: c.x, y: c.y, w: 14, h: 14 })) {
            c.collected = true;
            score += 10;
            updateHUD();
            sfxCoin();
            spawnCoinParticles(c.x + 7, c.y + 7);
        }
    });

    // Enemies
    if (player.invincible > 0) player.invincible -= dt;

    enemies.forEach(e => {
        if (e.dead) {
            e.deadTimer -= dt;
            return;
        }
        e.x += e.vx;
        if (e.x <= e.x1) { e.x = e.x1; e.vx =  e.spd; }
        if (e.x + e.w >= e.x2) { e.x = e.x2 - e.w; e.vx = -e.spd; }

        if (!rectOverlap(player, e)) return;
        const stomping = (prevBottom - 4) <= e.y;
        if (stomping && player.vy >= 0) {
            // stomp
            e.dead = true;
            e.deadTimer = 400;
            player.vy = JUMP_VEL * 0.6;
            score += 25;
            updateHUD();
            sfxStomp();
            spawnEnemyParticles(e.x + e.w / 2, e.y + e.h / 2);
        } else if (player.invincible <= 0) {
            triggerDeath();
        }
    });

    // Fall off bottom
    if (player.y > H + 60) triggerDeath();

    // Goal
    if (rectOverlap(player, goal)) {
        state = STATE.LEVEL_CLEAR;
        clearTimer = 1600;
        sfxClear();
        spawnCelebration();
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('pixelDashHigh', highScore);
        }
    }

    updateParticles(dt);
}

function triggerDeath() {
    if (state !== STATE.PLAYING) return;
    state = STATE.DYING;
    deathTimer = 900;
    sfxDie();
    spawnDeathParticles(player.x + player.w / 2, player.y + player.h / 2);
    player.invincible = 99999;
}

// ── Particles ──────────────────────────────────────────────────────────────────

function spawnParticles(x, y, count, colors, speed, life) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = speed * (0.4 + Math.random() * 0.6);
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 1,
            life, maxLife: life,
            color: colors[Math.floor(Math.random() * colors.length)],
            r: 3 + Math.random() * 3,
        });
    }
}

function spawnCoinParticles(x, y)  { spawnParticles(x, y, 8,  ['#ffd700','#ffec6e','#fff8a0'], 3,  500); }
function spawnEnemyParticles(x, y) { spawnParticles(x, y, 10, ['#ff4040','#ff8040','#fff'],    4,  600); }
function spawnDeathParticles(x, y) { spawnParticles(x, y, 18, ['#ff6060','#ff9040','#ffff80'], 6, 1000); }
function spawnCelebration() {
    const colors = ['#ffd700','#ff60e0','#60ffcc','#60b0ff','#ff8060'];
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            for (let j = 0; j < 6; j++) {
                spawnParticles(
                    100 + Math.random() * (W - 200),
                    80  + Math.random() * 80,
                    6, colors, 4, 800
                );
            }
        }, i * 200);
    }
}

function updateParticles(dt) {
    const dtS = dt / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.12;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ── Draw ───────────────────────────────────────────────────────────────────────

function draw() {
    syncSize();
    ctx.clearRect(0, 0, W, H);

    if (state === STATE.START) {
        drawStart(); return;
    }
    if (state === STATE.GAMEOVER) {
        drawGameOver(); return;
    }

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, levelData.bgColor);
    sky.addColorStop(1, shiftColor(levelData.bgColor, 30));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camera.x, 0);

    drawPlatforms();
    drawCoins();
    drawGoal();
    drawEnemies();
    if (state !== STATE.DYING) drawPlayer();
    drawParticles();

    ctx.restore();

    if (state === STATE.LEVEL_CLEAR) drawLevelClear();
    if (state === STATE.DYING)       drawDying();
}

function drawPlatforms() {
    const allP = [...platforms, ...moving];
    allP.forEach(p => {
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(p.x + 3, p.y + 4, p.w, p.h);
        // body
        ctx.fillStyle = levelData.platformColor;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // highlight strip
        ctx.fillStyle = lightenColor(levelData.platformColor, 40);
        ctx.fillRect(p.x, p.y, p.w, 4);
        // moving platform indicator
        if (p.spd !== undefined) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    });
}

function drawPlayer() {
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    const w = player.w, h = player.h;

    // Blink when invincible
    if (player.invincible > 0 && Math.floor(Date.now() / 80) % 2) return;

    const flip = !player.facingRight;

    ctx.save();
    if (flip) { ctx.scale(-1, 1); ctx.translate(-x * 2 - w, 0); }

    // Body
    ctx.fillStyle = '#4db8ff';
    ctx.fillRect(x + 2, y + 10, w - 4, h - 10);

    // Head
    ctx.fillStyle = '#ffe0a0';
    ctx.fillRect(x + 3, y, w - 6, 12);

    // Eyes
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(x + w - 10, y + 3, 4, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w - 9, y + 3, 2, 2);

    // Legs (animated)
    const legOff = player.onGround ? Math.round(Math.sin(Date.now() / 80) * 2) : 0;
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(x + 3,      y + h - 8, 6, 8 + legOff);
    ctx.fillRect(x + w - 9,  y + h - 8, 6, 8 - legOff);

    ctx.restore();
}

function drawEnemies() {
    enemies.forEach(e => {
        if (e.dead) {
            // squished
            ctx.globalAlpha = Math.max(0, e.deadTimer / 400);
            ctx.fillStyle = '#cc2020';
            ctx.fillRect(e.x, e.y + e.h - 5, e.w, 5);
            ctx.globalAlpha = 1;
            return;
        }
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(e.x + 2, e.y + e.h, e.w, 3);
        // body
        ctx.fillStyle = '#e03030';
        ctx.fillRect(e.x, e.y + 4, e.w, e.h - 4);
        // head bump
        ctx.fillStyle = '#ff5050';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + 4, e.w / 2, Math.PI, 0);
        ctx.fill();
        // eyes
        const eyeDir = e.vx > 0 ? 1 : -1;
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x + e.w / 2 + eyeDir * 2 - 3, e.y + 2, 5, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x + e.w / 2 + eyeDir * 2 - 2 + eyeDir, e.y + 3, 2, 2);
    });
}

function drawCoins() {
    const t = Date.now() / 300;
    coins.forEach((c, i) => {
        if (c.collected) return;
        const bob = Math.sin(t + i * 0.8) * 2;
        // glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur  = 8;
        // coin body
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(c.x + 7, c.y + 7 + bob, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // shine
        ctx.fillStyle = '#fff8a0';
        ctx.beginPath();
        ctx.arc(c.x + 5, c.y + 4 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
}

function drawGoal() {
    const g = goal;
    const wave = Math.sin(Date.now() / 200) * 3;
    // pole
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(g.x + 10, g.y - 10, 4, g.h + 10);
    // flag
    ctx.fillStyle = '#00e060';
    ctx.beginPath();
    ctx.moveTo(g.x + 14, g.y - 10);
    ctx.lineTo(g.x + 38 + wave, g.y);
    ctx.lineTo(g.x + 14, g.y + 12);
    ctx.closePath();
    ctx.fill();
    // glow
    ctx.shadowColor = '#00ff80';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.shadowBlur  = 0;
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawStart() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Animated stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
        const x = (i * 137.508 + startTimer * 0.01) % W;
        const y = (i * 53.7)   % H;
        const b = (Math.sin(startTimer * 0.003 + i) + 1) / 2;
        ctx.globalAlpha = b * 0.6 + 0.1;
        ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#60b0ff';
    ctx.font = `bold ${Math.round(W * 0.1)}px 'Courier New', monospace`;
    ctx.fillText('PIXEL DASH', W / 2, H * 0.34);

    ctx.font = `${Math.round(W * 0.038)}px 'Courier New', monospace`;
    ctx.fillStyle = '#a0c0e0';
    ctx.fillText('collect coins  stomp enemies  reach the flag', W / 2, H * 0.52);

    if (Math.floor(startTimer / 500) % 2 === 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.round(W * 0.05)}px 'Courier New', monospace`;
        ctx.fillText('TAP or PRESS SPACE to start', W / 2, H * 0.70);
    }

    ctx.fillStyle = '#606080';
    ctx.font = `${Math.round(W * 0.033)}px 'Courier New', monospace`;
    ctx.fillText(`BEST: ${highScore}`, W / 2, H * 0.86);
}

function drawGameOver() {
    const won = levelIdx >= makeLevels().length;
    ctx.fillStyle = won ? '#0a1a0a' : '#1a0808';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#60ff90' : '#ff6060';
    ctx.font = `bold ${Math.round(W * 0.1)}px 'Courier New', monospace`;
    ctx.fillText(won ? 'YOU WIN!' : 'GAME OVER', W / 2, H * 0.35);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = `${Math.round(W * 0.048)}px 'Courier New', monospace`;
    ctx.fillText('SCORE: ' + score, W / 2, H * 0.52);
    ctx.fillText('BEST:  ' + Math.max(score, highScore), W / 2, H * 0.63);

    if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.round(W * 0.05)}px 'Courier New', monospace`;
        ctx.fillText('TAP or PRESS SPACE', W / 2, H * 0.80);
    }

    drawParticles();
}

function drawLevelClear() {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${Math.round(W * 0.09)}px 'Courier New', monospace`;
    ctx.fillText('LEVEL CLEAR!', W / 2, H * 0.42);
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `${Math.round(W * 0.042)}px 'Courier New', monospace`;
    ctx.fillText('SCORE: ' + score, W / 2, H * 0.58);
}

function drawDying() {
    ctx.fillStyle = `rgba(200,40,40,${0.3 * (1 - deathTimer / 900)})`;
    ctx.fillRect(0, 0, W, H);
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function parseHex(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lightenColor(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}

function shiftColor(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}

// ── Game loop ──────────────────────────────────────────────────────────────────

function handleAnyInput() {
    if (state === STATE.START) {
        initAudio();
        startGame();
        return;
    }
    if (state === STATE.GAMEOVER) {
        initAudio();
        startGame();
    }
}

window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') handleAnyInput();
});
canvas.addEventListener('click', handleAnyInput);
canvas.addEventListener('touchstart', handleAnyInput);

function loop(ts) {
    const dt = lastTS ? Math.min(ts - lastTS, 50) : 16;
    lastTS = ts;
    startTimer += dt;

    update(dt);
    draw();
    requestAnimationFrame(loop);
}

init();
