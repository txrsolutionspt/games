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
    ['#ef5350', '#ff8a65'],  // row 0 — red / damaged orange (2 HP)
    ['#ef5350', '#ff8a65'],  // row 1 — red / damaged orange (2 HP)
    ['#66bb6a', null],       // row 2 — green (1 HP)
    ['#66bb6a', null],       // row 3 — green (1 HP)
    ['#42a5f5', null],       // row 4 — blue  (1 HP)
    ['#42a5f5', null],       // row 5 — blue  (1 HP)
];

// ── State ─────────────────────────────────────────────────────────────────────

let W, H;
let state, paddle, ball, bricks, score, highScore, lives, level, flashTimer, lastTs;

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    syncSize();
    highScore = parseInt(localStorage.getItem('breakoutHighScore') || '0', 10);
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
    startLevel();
}

function startLevel() {
    buildBricks();
    resetPaddle();
    resetBall();
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
    ball = {
        x:  W / 2,
        y:  paddle.y - BALL_R - 1,
        vx: 0,
        vy: -speed,
        r:  BALL_R,
        speed,
    };
}

function buildBricks() {
    const topOffset = H * 0.12;
    const brickH    = H * 0.04;
    const brickW    = (W - BRICK_PAD * (COLS + 1)) / COLS;

    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const hp = (r < 2 || level >= 3) ? 2 : 1;
            bricks.push({
                x:     BRICK_PAD + c * (brickW + BRICK_PAD),
                y:     topOffset + r * (brickH + BRICK_PAD),
                w:     brickW,
                h:     brickH,
                hp,
                maxHp: hp,
                alive: true,
            });
        }
    }
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop(ts) {
    syncSize();
    const dt = lastTs ? Math.min((ts - lastTs) / (1000 / 60), 3) : 1;
    lastTs = ts;

    if (state === STATE.PLAYING) update(dt);
    if (state === STATE.LEVEL_CLEAR) {
        flashTimer -= dt;
        if (flashTimer <= 0) { level++; startLevel(); }
    }

    draw();
    requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────────

function update(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Side walls
    if (ball.x - ball.r < 0)  { ball.x = ball.r;      ball.vx *= -1; }
    if (ball.x + ball.r > W)  { ball.x = W - ball.r;  ball.vx *= -1; }

    // Top wall
    if (ball.y - ball.r < 0)  { ball.y = ball.r;      ball.vy *= -1; }

    // Ball lost
    if (ball.y - ball.r > H) {
        lives--;
        if (lives <= 0) { state = STATE.GAMEOVER; saveHigh(); return; }
        resetBall();
        state = STATE.READY;
        return;
    }

    // Paddle collision
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
    }

    // Brick collisions — stop at first hit per frame
    for (const b of bricks) {
        if (!b.alive) continue;
        if (!overlaps(ball, b)) continue;

        b.hp--;
        if (b.hp <= 0) {
            b.alive = false;
            score += b.maxHp === 2 ? 20 : 10;
            saveHigh();
        }

        // Determine reflection axis
        const overlapL = ball.x + ball.r - b.x;
        const overlapR = b.x + b.w - (ball.x - ball.r);
        const overlapT = ball.y + ball.r - b.y;
        const overlapB = b.y + b.h - (ball.y - ball.r);

        const minH = Math.min(overlapL, overlapR);
        const minV = Math.min(overlapT, overlapB);

        if (minH < minV) ball.vx *= -1;
        else             ball.vy *= -1;

        break;
    }

    // Level clear
    if (bricks.every(b => !b.alive)) {
        score += 100 * level;
        saveHigh();
        flashTimer = 120;
        state = STATE.LEVEL_CLEAR;
    }
}

function overlaps(ball, b) {
    const nearX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
    const dx = ball.x - nearX;
    const dy = ball.y - nearY;
    return dx * dx + dy * dy < ball.r * ball.r;
}

function normalise() {
    const spd = ball.speed;
    const cur = Math.hypot(ball.vx, ball.vy);
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

    drawBricks();
    drawPaddle();
    drawBall();
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

function drawBricks() {
    for (const b of bricks) {
        if (!b.alive) continue;
        const [fullColor, damagedColor] = BRICK_COLORS[bricks.indexOf(b) < COLS * 2
            ? bricks.indexOf(b) < COLS ? 0 : 1
            : Math.floor(bricks.indexOf(b) / COLS)];

        // Determine row index properly
        const row = Math.floor(bricks.indexOf(b) / COLS);
        const [fc, dc] = BRICK_COLORS[row];
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

    // Lives as dots
    const dotR = W * 0.016;
    const dotY = H * 0.037;
    const dotSpacing = dotR * 2.8;
    const dotsStartX = W - W * 0.03 - (lives - 1) * dotSpacing;
    for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#29b6f6';
        ctx.beginPath();
        ctx.arc(dotsStartX + i * dotSpacing, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
    }

    // Separator line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.06);
    ctx.lineTo(W, H * 0.06);
    ctx.stroke();
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
        const bw = W * 0.44;
        const bh = W * 0.12;
        const bx = (W - bw) / 2;
        const by = H * 0.6;
        ctx.fillStyle = '#29b6f6';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${W * 0.055}px ${FONT}`;
        ctx.fillText(state === STATE.GAMEOVER ? 'RESTART' : 'START', W / 2, by + bh * 0.68);
    }
}

// ── Input ─────────────────────────────────────────────────────────────────────

function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
    if (state === STATE.READY) ball.x = paddle.x + paddle.w / 2;
}

function launch() {
    if (state === STATE.READY)   { state = STATE.PLAYING; return; }
    if (state === STATE.START)   { newGame(); return; }
    if (state === STATE.GAMEOVER){ newGame(); return; }
}

// Keyboard
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); launch(); }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Paddle keyboard movement (applied each frame via polling)
function applyKeys(dt) {
    if (!paddle) return;
    const speed = W * 0.012 * dt;
    if (keys['ArrowLeft']  || keys['KeyA']) paddle.x = Math.max(0, paddle.x - speed);
    if (keys['ArrowRight'] || keys['KeyD']) paddle.x = Math.min(W - paddle.w, paddle.x + speed);
    if (state === STATE.READY) ball.x = paddle.x + paddle.w / 2;
}

// Wrap update to include keyboard polling
const _update = update;
function update(dt) {
    applyKeys(dt);
    _update(dt);
}

// Mouse
canvas.addEventListener('mousemove', e => {
    if (state === STATE.PLAYING || state === STATE.READY) movePaddleTo(e.clientX);
});
canvas.addEventListener('click', () => launch());

// Touch
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    movePaddleTo(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    movePaddleTo(e.touches[0].clientX);
    launch();
}, { passive: false });

// Resize
window.addEventListener('resize', syncSize);

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
