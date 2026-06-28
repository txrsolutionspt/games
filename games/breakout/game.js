const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS       = 10;
const BRICK_ROWS = 6;
const BRICK_PAD  = 3;
const PADDLE_H   = 10;
const BALL_R     = 6;
const BASE_SPEED = 5;
const MAX_VX     = 4;
const FONT       = "'Courier New', monospace";

const STATE = { START: 0, READY: 1, PLAYING: 2, LEVEL_CLEAR: 3, GAMEOVER: 4 };

const BRICK_COLORS = [
    ['#ef5350', '#ff8a65'],
    ['#ef5350', '#ff8a65'],
    ['#66bb6a', null],
    ['#66bb6a', null],
    ['#42a5f5', null],
    ['#42a5f5', null],
];

// ── Audio ─────────────────────────────────────────────────────────────────────

let audioCtx = null, masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(audioCtx.destination);
}

function sfxBounce() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(340, audioCtx.currentTime + 0.04);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.04);
}

function sfxBrick() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(280, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.07);
    g.gain.setValueAtTime(0.16, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.07);
}

function sfxLifeLost() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.45);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.45);
}

function sfxLevelClear() {
    if (!audioCtx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        const t = audioCtx.currentTime + i * 0.12;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + 0.18);
    });
}

// ── State ─────────────────────────────────────────────────────────────────────

let W, H;
let state, paddle, ball, bricks, score, highScore, lives, level, flashTimer, lastTs;
let particles, ballTrail, shakeX, shakeY;

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    syncSize();
    highScore = parseInt(localStorage.getItem('breakoutHighScore') || '0', 10);
    particles = []; ballTrail = []; shakeX = 0; shakeY = 0;
    state     = STATE.START;
    requestAnimationFrame(loop);
}

function syncSize() {
    const size = canvas.clientWidth;
    if (canvas.width !== size || canvas.height !== Math.round(size * 4 / 3)) {
        canvas.width  = size;
        canvas.height = Math.round(size * 4 / 3);
    }
    W = canvas.width;
    H = canvas.height;
}

// ── Game setup ────────────────────────────────────────────────────────────────

function newGame() {
    score  = 0;
    lives  = 3;
    level  = 1;
    particles = []; ballTrail = [];
    startLevel();
}

function startLevel() {
    buildBricks();
    resetPaddle();
    resetBall();
    particles = []; ballTrail = [];
    state = STATE.READY;
}

function resetPaddle() {
    const pw = Math.max(60, 120 - (level - 1) * 10);
    paddle = { w: pw, h: PADDLE_H };
    paddle.x = (W - pw) / 2;
    paddle.y = H - PADDLE_H - 20;
}

function resetBall() {
    const speed = BASE_SPEED + (level - 1) * 0.6;
    ball = { x: W / 2, y: paddle.y - BALL_R - 1, vx: 0, vy: -speed, r: BALL_R, speed };
    ballTrail = [];
}

function brickExists(row, col, lv) {
    if (lv <= 1) return true;
    if (lv === 2) return !((row === 0 || row === BRICK_ROWS - 1) && (col < 2 || col >= COLS - 2));
    if (lv === 3) return (row + col) % 2 === 0;
    return (col + row * 2) % 4 !== 0;
}

function buildBricks() {
    const topOffset = H * 0.12;
    const brickH    = H * 0.04;
    const brickW    = (W - BRICK_PAD * (COLS + 1)) / COLS;

    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!brickExists(r, c, level)) continue;
            const hp = (r < 2 || level >= 3) ? 2 : 1;
            bricks.push({
                x: BRICK_PAD + c * (brickW + BRICK_PAD),
                y: topOffset + r * (brickH + BRICK_PAD),
                w: brickW, h: brickH,
                hp, maxHp: hp, alive: true, row: r,
            });
        }
    }
}

// ── Particles ─────────────────────────────────────────────────────────────────

function spawnParticles(x, y, col, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 3.5;
        particles.push({
            x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            r: 2 + Math.random() * 2.5, col,
            life: 25 + Math.random() * 20, maxLife: 45,
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.93; p.vy *= 0.93;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop(ts) {
    syncSize();
    const dt = lastTs ? Math.min((ts - lastTs) / (1000 / 60), 3) : 1;
    lastTs = ts;

    shakeX *= 0.82; shakeY *= 0.82;

    if (state === STATE.PLAYING) update(dt);
    if (state === STATE.LEVEL_CLEAR) {
        flashTimer -= dt;
        if (flashTimer <= 0) { level++; startLevel(); }
    }
    updateParticles(dt);

    draw();
    requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────────

function physicsUpdate(dt) {
    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > 12) ballTrail.shift();

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0)  { ball.x = ball.r;     ball.vx *= -1; sfxBounce(); }
    if (ball.x + ball.r > W)  { ball.x = W - ball.r; ball.vx *= -1; sfxBounce(); }
    if (ball.y - ball.r < 0)  { ball.y = ball.r;     ball.vy *= -1; sfxBounce(); }

    if (ball.y - ball.r > H) {
        lives--;
        sfxLifeLost();
        shakeX = 8; shakeY = 8;
        if (lives <= 0) { state = STATE.GAMEOVER; saveHigh(); return; }
        resetBall();
        state = STATE.READY;
        return;
    }

    if (
        ball.vy > 0 &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.w &&
        ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + ball.speed * dt
    ) {
        ball.y  = paddle.y - ball.r;
        ball.vy = -Math.abs(ball.vy);
        const offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        ball.vx = offset * MAX_VX;
        normalise();
        sfxBounce();
    }

    for (const b of bricks) {
        if (!b.alive) continue;
        if (!overlaps(ball, b)) continue;

        b.hp--;
        if (b.hp <= 0) {
            b.alive = false;
            score += b.maxHp === 2 ? 20 : 10;
            saveHigh();
            const [fc] = BRICK_COLORS[b.row];
            spawnParticles(b.x + b.w / 2, b.y + b.h / 2, fc, 10);
        } else {
            spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 4);
        }
        sfxBrick();

        const overlapL = ball.x + ball.r - b.x;
        const overlapR = b.x + b.w - (ball.x - ball.r);
        const overlapT = ball.y + ball.r - b.y;
        const overlapB = b.y + b.h - (ball.y - ball.r);
        if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) ball.vx *= -1;
        else ball.vy *= -1;

        break;
    }

    if (bricks.every(b => !b.alive)) {
        score += 100 * level;
        saveHigh();
        flashTimer = 120;
        sfxLevelClear();
        shakeX = 6; shakeY = 6;
        state = STATE.LEVEL_CLEAR;
    }
}

function overlaps(ball, b) {
    const nearX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
    const dx = ball.x - nearX, dy = ball.y - nearY;
    return dx * dx + dy * dy < ball.r * ball.r;
}

function normalise() {
    const spd = ball.speed, cur = Math.hypot(ball.vx, ball.vy);
    ball.vx = ball.vx / cur * spd;
    ball.vy = ball.vy / cur * spd;
}

function saveHigh() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('breakoutHighScore', highScore);
    }
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function draw() {
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, W, H);

    if (state === STATE.START) {
        drawOverlay('BREAKOUT', 'Press Space or tap to start', true);
        return;
    }

    ctx.save();
    ctx.translate(Math.round(shakeX), Math.round(shakeY));
    drawBricks();
    drawBallTrail();
    drawBall();
    drawPaddle();
    drawParticles();
    ctx.restore();

    drawHUD();

    if (state === STATE.READY) {
        ctx.fillStyle = 'rgba(160,160,192,0.7)';
        ctx.font = `${W * 0.045}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('Press Space or tap to launch', W / 2, H * 0.54);
    }

    if (state === STATE.LEVEL_CLEAR) {
        drawOverlay(`LEVEL ${level} CLEAR!`, `+${100 * level} bonus pts`, false);
    }

    if (state === STATE.GAMEOVER) {
        drawOverlay('GAME OVER', `Score: ${score}  Best: ${highScore}`, true);
    }
}

function drawBallTrail() {
    for (let i = 0; i < ballTrail.length; i++) {
        const t = ballTrail[i];
        const f = i / ballTrail.length;
        ctx.globalAlpha = f * 0.35;
        ctx.fillStyle = '#fff9c4';
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.r * f * 0.85, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawBricks() {
    for (const b of bricks) {
        if (!b.alive) continue;
        const [fc, dc] = BRICK_COLORS[b.row];
        ctx.fillStyle = (b.maxHp === 2 && b.hp === 1 && dc) ? dc : fc;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();
    }
}

function drawPaddle() {
    ctx.fillStyle = '#29b6f6';
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 4);
    ctx.fill();
}

function drawBall() {
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
}

function drawHUD() {
    ctx.font = `bold ${W * 0.038}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a0a0c0';
    ctx.fillText(`${score}`, W * 0.03, H * 0.045);

    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${level}`, W / 2, H * 0.045);

    const dotR = W * 0.016, dotY = H * 0.037, dotSpacing = dotR * 2.8;
    const dotsStartX = W - W * 0.03 - (lives - 1) * dotSpacing;
    for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#29b6f6';
        ctx.beginPath();
        ctx.arc(dotsStartX + i * dotSpacing, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H * 0.06); ctx.lineTo(W, H * 0.06); ctx.stroke();
}

function drawOverlay(title, subtitle, showButton) {
    ctx.fillStyle = 'rgba(18,18,42,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#29b6f6';
    ctx.font = `bold ${W * 0.13}px ${FONT}`;
    ctx.fillText(title, W / 2, H * 0.38);

    ctx.fillStyle = '#a0a0c0';
    ctx.font = `${W * 0.052}px ${FONT}`;
    ctx.fillText(subtitle, W / 2, H * 0.5);

    if (showButton) {
        const bw = W * 0.44, bh = W * 0.12, bx = (W - bw) / 2, by = H * 0.6;
        ctx.fillStyle = '#29b6f6';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${W * 0.055}px ${FONT}`;
        ctx.fillText(state === STATE.GAMEOVER ? 'RESTART' : 'START', W / 2, by + bh * 0.68);
    }
}

// ── Input ─────────────────────────────────────────────────────────────────────

function movePaddleTo(clientX) {
    if (!paddle) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
    if (state === STATE.READY) ball.x = paddle.x + paddle.w / 2;
}

function launch() {
    initAudio();
    if (state === STATE.READY)    { state = STATE.PLAYING; return; }
    if (state === STATE.START)    { newGame(); return; }
    if (state === STATE.GAMEOVER) { newGame(); return; }
}

const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); launch(); }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function applyKeys(dt) {
    if (!paddle) return;
    const speed = W * 0.012 * dt;
    if (keys['ArrowLeft']  || keys['KeyA']) paddle.x = Math.max(0, paddle.x - speed);
    if (keys['ArrowRight'] || keys['KeyD']) paddle.x = Math.min(W - paddle.w, paddle.x + speed);
    if (state === STATE.READY) ball.x = paddle.x + paddle.w / 2;
}

function update(dt) {
    applyKeys(dt);
    physicsUpdate(dt);
}

canvas.addEventListener('mousemove', e => {
    if (state === STATE.PLAYING || state === STATE.READY) movePaddleTo(e.clientX);
});
canvas.addEventListener('click', () => launch());

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    movePaddleTo(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    launch();
    movePaddleTo(e.touches[0].clientX);
}, { passive: false });

window.addEventListener('resize', syncSize);

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
