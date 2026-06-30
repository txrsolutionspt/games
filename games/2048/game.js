const canvas   = document.getElementById('gameCanvas');
const ctx      = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const bestEl   = document.getElementById('best');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('overlay-title');
const ovScore  = document.getElementById('overlay-score');
const ovBtn    = document.getElementById('overlay-btn');

// ── Canvas scaling ─────────────────────────────────────────────────────────────

let W = 400, H = 400;

function syncSize() {
    const sz = canvas.clientWidth;
    if (canvas.width !== sz || canvas.height !== sz) {
        canvas.width  = sz;
        canvas.height = sz;
    }
    W = H = canvas.width;
}

window.addEventListener('resize', () => { syncSize(); draw(); });
syncSize();

// ── Audio ──────────────────────────────────────────────────────────────────────

let audioCtx = null, masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(audioCtx.destination);
}

function playTone(freq, type, dur, vol = 0.5) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + dur);
}

function sfxSlide()  { playTone(180, 'sine',   0.07, 0.3); }
function sfxMerge(v) {
    const freq = 220 + Math.log2(v) * 40;
    playTone(freq, 'sine', 0.1, 0.4);
    setTimeout(() => playTone(freq * 1.5, 'sine', 0.08, 0.25), 60);
}
function sfxSpawn()  { playTone(320, 'sine', 0.06, 0.2); }
function sfxWin()    { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,'sine',0.2,0.4), i*100)); }
function sfxLose()   { [300,240,180,120].forEach((f,i) => setTimeout(() => playTone(f,'sawtooth',0.15,0.3), i*90)); }

// ── Constants ──────────────────────────────────────────────────────────────────

const GRID    = 4;
const GAP     = 0.03;   // fraction of board size
const PADDING = 0.04;   // fraction of board size

// Tile colours: value → [background, textColor]
const TILE_COLORS = {
    0:    ['#2e2e4e', null],
    2:    ['#eee4da', '#6e5f50'],
    4:    ['#ede0c8', '#6e5f50'],
    8:    ['#f2b179', '#fff'],
    16:   ['#f59563', '#fff'],
    32:   ['#f67c5f', '#fff'],
    64:   ['#f65e3b', '#fff'],
    128:  ['#edcf72', '#fff'],
    256:  ['#edcc61', '#fff'],
    512:  ['#edc850', '#fff'],
    1024: ['#edc53f', '#fff'],
    2048: ['#edc22e', '#fff'],
};

function tileColor(v) {
    return TILE_COLORS[v] || ['#3c3cdc', '#fff'];
}

// ── State ──────────────────────────────────────────────────────────────────────

let grid, score, best, won, over;

// Animation state: array of {value, fromR,fromC,toR,toC, merged, progress}
let anims = [];
let animating = false;
let spawnAnims = []; // {r,c,progress}

function newGame() {
    grid  = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    score = 0;
    won   = false;
    over  = false;
    anims = []; animating = false; spawnAnims = [];
    overlay.classList.add('hidden');
    addTile(); addTile();
    updateHUD();
    draw();
}

function updateHUD() {
    scoreEl.textContent = score;
    bestEl.textContent  = best || 0;
}

// ── Tile spawning ──────────────────────────────────────────────────────────────

function emptyCells() {
    const cells = [];
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (grid[r][c] === 0) cells.push([r, c]);
    return cells;
}

function addTile() {
    const cells = emptyCells();
    if (!cells.length) return;
    const [r, c] = cells[Math.floor(Math.random() * cells.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    spawnAnims.push({ r, c, progress: 0 });
    sfxSpawn();
}

// ── Move logic ─────────────────────────────────────────────────────────────────

// Returns { newGrid, moved, mergeLog, scoreGained }
function slideRow(row) {
    const vals    = row.filter(v => v !== 0);
    const merged  = [];
    const mergeLog = [];
    let i = 0;
    while (i < vals.length) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
            const v = vals[i] * 2;
            merged.push(v);
            mergeLog.push(v);
            i += 2;
        } else {
            merged.push(vals[i]);
            i++;
        }
    }
    while (merged.length < GRID) merged.push(0);
    return { merged, mergeLog };
}

function applyMove(dir) {
    // dir: 0=up 1=right 2=down 3=left
    const newGrid  = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    let moved      = false;
    let scoreGained = 0;
    const mergeValues = [];

    // Build move animations: track each tile's journey
    // We work in a transformed coordinate where we always slide "left"
    // then un-transform.

    function getLine(g, i, d) {
        // extract line i along direction d
        const line = [];
        for (let j = 0; j < GRID; j++) {
            if (d === 3) line.push({ v: g[i][j],         r: i, c: j });
            if (d === 1) line.push({ v: g[i][GRID-1-j],  r: i, c: GRID-1-j });
            if (d === 0) line.push({ v: g[j][i],         r: j, c: i });
            if (d === 2) line.push({ v: g[GRID-1-j][i],  r: GRID-1-j, c: i });
        }
        return line;
    }

    function setCell(ng, j, i, d, val) {
        if (d === 3) ng[i][j]         = val;
        if (d === 1) ng[i][GRID-1-j]  = val;
        if (d === 0) ng[j][i]         = val;
        if (d === 2) ng[GRID-1-j][i]  = val;
    }

    const moveAnims = [];

    for (let i = 0; i < GRID; i++) {
        const line = getLine(grid, i, dir);
        const srcVals = line.map(t => t.v);
        const { merged, mergeLog } = slideRow(srcVals);

        // Figure out where each source tile ends up
        const srcNonZero = line.filter(t => t.v !== 0);
        let srcIdx = 0, destIdx = 0;
        while (srcIdx < srcNonZero.length) {
            if (srcIdx + 1 < srcNonZero.length &&
                srcNonZero[srcIdx].v === srcNonZero[srcIdx + 1].v) {
                // two merge into destIdx
                moveAnims.push({ value: srcNonZero[srcIdx].v * 2,
                    fromR: srcNonZero[srcIdx].r, fromC: srcNonZero[srcIdx].c,
                    toR: 0, toC: 0, destJ: destIdx, lineI: i, dir, merged: true });
                moveAnims.push({ value: srcNonZero[srcIdx+1].v,
                    fromR: srcNonZero[srcIdx+1].r, fromC: srcNonZero[srcIdx+1].c,
                    toR: 0, toC: 0, destJ: destIdx, lineI: i, dir, merged: false, ghost: true });
                mergeValues.push(srcNonZero[srcIdx].v * 2);
                scoreGained += srcNonZero[srcIdx].v * 2;
                srcIdx += 2;
            } else {
                moveAnims.push({ value: srcNonZero[srcIdx].v,
                    fromR: srcNonZero[srcIdx].r, fromC: srcNonZero[srcIdx].c,
                    toR: 0, toC: 0, destJ: destIdx, lineI: i, dir, merged: false });
                srcIdx++;
            }
            destIdx++;
        }

        for (let j = 0; j < GRID; j++) {
            setCell(newGrid, j, i, dir, merged[j]);
        }

        for (let j = 0; j < GRID; j++) {
            if (grid[i] !== undefined) {
                if (dir === 3 && grid[i][j] !== newGrid[i][j]) moved = true;
                if (dir === 1 && grid[i][j] !== newGrid[i][j]) moved = true;
                if (dir === 0 && grid[j] !== undefined && grid[j][i] !== newGrid[j][i]) moved = true;
                if (dir === 2 && grid[GRID-1-j] !== undefined && grid[GRID-1-j][i] !== newGrid[GRID-1-j][i]) moved = true;
            }
        }
    }

    // Resolve toR/toC for each animation entry
    function resolvePos(j, lineI, d) {
        if (d === 3) return { r: lineI,        c: j };
        if (d === 1) return { r: lineI,        c: GRID-1-j };
        if (d === 0) return { r: j,            c: lineI };
        if (d === 2) return { r: GRID-1-j,    c: lineI };
    }
    moveAnims.forEach(a => {
        const pos = resolvePos(a.destJ, a.lineI, a.dir);
        a.toR = pos.r; a.toC = pos.c;
    });

    // Detect actual move by comparing grids
    moved = false;
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (grid[r][c] !== newGrid[r][c]) { moved = true; break; }

    return { newGrid, moved, moveAnims, scoreGained, mergeValues };
}

// ── Animation ──────────────────────────────────────────────────────────────────

const ANIM_DUR = 120; // ms

function runMove(dir) {
    if (animating) return;
    const { newGrid, moved, moveAnims, scoreGained, mergeValues } = applyMove(dir);
    if (!moved) return;

    initAudio();
    sfxSlide();
    mergeValues.forEach(v => sfxMerge(v));

    animating = true;
    anims     = moveAnims;
    const startTime = performance.now();

    function step(ts) {
        const t = Math.min((ts - startTime) / ANIM_DUR, 1);
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out quad
        anims.forEach(a => a.progress = ease);
        draw();
        if (t < 1) { requestAnimationFrame(step); return; }

        // Commit
        grid  = newGrid;
        score += scoreGained;
        if (score > (best || 0)) { best = score; localStorage.setItem('2048best', best); }
        updateHUD();
        anims = []; animating = false;

        // Check win
        const maxTile = Math.max(...grid.flat());
        if (!won && maxTile >= 2048) {
            won = true;
            sfxWin();
            setTimeout(() => showOverlay('🎉 You Win!', score), 300);
            addTile(); draw(); return;
        }

        addTile();
        draw();

        // Check lose
        if (!emptyCells().length && !canMove()) {
            over = true;
            sfxLose();
            setTimeout(() => showOverlay('Game Over', score), 400);
        }
    }

    requestAnimationFrame(step);
}

function canMove() {
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++) {
            if (c + 1 < GRID && grid[r][c] === grid[r][c+1]) return true;
            if (r + 1 < GRID && grid[r][c] === grid[r+1][c]) return true;
        }
    return false;
}

function showOverlay(title, sc) {
    ovTitle.textContent = title;
    ovScore.textContent = 'Score: ' + sc;
    overlay.classList.remove('hidden');
}

// ── Draw ───────────────────────────────────────────────────────────────────────

function draw() {
    syncSize();
    const pad = Math.round(W * PADDING);
    const gap = Math.round(W * GAP);
    const inner  = W - pad * 2;
    const cell   = (inner - gap * (GRID + 1)) / GRID;

    ctx.clearRect(0, 0, W, H);

    // Board background
    ctx.fillStyle = '#16213e';
    roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    // Cell backgrounds
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const x = pad + gap + c * (cell + gap);
            const y = pad + gap + r * (cell + gap);
            ctx.fillStyle = '#2a2a4a';
            roundRect(ctx, x, y, cell, cell, 6);
            ctx.fill();
        }
    }

    // Build render list: non-animated tiles first, then animated
    const rendered = Array.from({ length: GRID }, () => Array(GRID).fill(false));

    // Draw animated tiles
    if (anims.length) {
        anims.forEach(a => {
            if (a.ghost) return; // ghost tiles fade out at source
            const { fromR, fromC, toR, toC, value, progress, merged } = a;
            const fx = pad + gap + fromC * (cell + gap);
            const fy = pad + gap + fromR * (cell + gap);
            const tx = pad + gap + toC   * (cell + gap);
            const ty = pad + gap + toR   * (cell + gap);
            const x  = fx + (tx - fx) * progress;
            const y  = fy + (ty - fy) * progress;
            const scale = merged && progress === 1 ? 1 + 0.12 * Math.sin(Math.PI * progress) : 1;
            drawTile(x + cell/2, y + cell/2, cell, value, scale);
            if (progress === 1) rendered[toR][toC] = true;
        });

        // ghost: original positions not yet committed (just draw old value fading)
        anims.forEach(a => {
            if (!a.ghost) return;
            if (a.progress < 1) {
                const fx = pad + gap + a.fromC * (cell + gap);
                const fy = pad + gap + a.fromR * (cell + gap);
                ctx.globalAlpha = 1 - a.progress;
                drawTile(fx + cell/2, fy + cell/2, cell, a.value, 1);
                ctx.globalAlpha = 1;
            }
        });
    }

    // Draw static tiles (not being animated)
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            if (rendered[r][c]) continue;
            if (anims.some(a => !a.ghost && a.fromR === r && a.fromC === c)) continue;
            if (anims.some(a =>  a.ghost  && a.fromR === r && a.fromC === c)) continue;
            if (grid[r][c] === 0) continue;
            const x = pad + gap + c * (cell + gap);
            const y = pad + gap + r * (cell + gap);

            // Spawn animation
            const sp = spawnAnims.find(s => s.r === r && s.c === c);
            const sc = sp ? sp.progress : 1;
            drawTile(x + cell/2, y + cell/2, cell, grid[r][c], sc);
        }
    }

    // Tick spawn animations
    spawnAnims = spawnAnims.filter(s => {
        s.progress = Math.min(s.progress + 0.12, 1);
        return s.progress < 1;
    });
    if (spawnAnims.length) requestAnimationFrame(() => draw());
}

function drawTile(cx, cy, size, value, scale = 1) {
    const s = size * scale;
    const x = cx - s / 2;
    const y = cy - s / 2;
    const [bg, fg] = tileColor(value);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = 8;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = bg;
    roundRect(ctx, x, y, size, size, 6);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    if (value > 0 && fg) {
        const fontSize = value >= 1024 ? size * 0.28 : value >= 128 ? size * 0.32 : size * 0.38;
        ctx.fillStyle  = fg;
        ctx.font       = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.textAlign  = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), cx, cy + 1);
    }

    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ── Input ──────────────────────────────────────────────────────────────────────

window.addEventListener('keydown', e => {
    const map = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
                  w: 0, d: 1, s: 2, a: 3 };
    if (e.key in map) { e.preventDefault(); initAudio(); runMove(map[e.key]); }
});

// Swipe detection
let touchX = 0, touchY = 0;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    initAudio();
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) runMove(dx > 0 ? 1 : 3);
    else                              runMove(dy > 0 ? 2 : 0);
}, { passive: false });

// ── Bootstrap ──────────────────────────────────────────────────────────────────

best = parseInt(localStorage.getItem('2048best') || '0', 10);
ovBtn.addEventListener('click', () => { initAudio(); newGame(); });
newGame();
