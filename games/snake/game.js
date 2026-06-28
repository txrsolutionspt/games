const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');

const COLS = 20;
const ROWS = 20;
const BASE_SPEED = 150;
const MIN_SPEED = 60;
const SPEED_STEP = 10;

const STATE = { START: 'start', PLAYING: 'playing', GAMEOVER: 'gameover' };

let state, snake, direction, nextDirection, food, goldenFood, goldenFoodExpiry;
let score, highScore, speed, tickTimer, floatTexts, goldenFoodCounter;

// ── Audio ─────────────────────────────────────────────────────────────────────

let audioCtx = null, masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(audioCtx.destination);
}

function sfxEat() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.06);
    g.gain.setValueAtTime(0.18, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.06);
}

function sfxEatGolden() {
    if (!audioCtx) return;
    [660, 880, 1100].forEach((freq, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        const t = audioCtx.currentTime + i * 0.08;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + 0.1);
    });
}

function sfxDie() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(280, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.28, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + 0.5);
}

// ── Float texts ───────────────────────────────────────────────────────────────

function addFloat(gridX, gridY, text, col) {
    const cs = cellSize();
    floatTexts.push({ x: gridX * cs + cs / 2, y: gridY * cs + cs / 2, text, col, life: 1.0, maxLife: 1.0 });
}

function drawFloatTexts(cs) {
    for (const f of floatTexts) {
        const a = f.life / f.maxLife;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = f.col;
        ctx.font = `bold ${Math.max(10, cs * 0.5)}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 6;
        ctx.shadowColor = f.col;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
    highScoreEl.textContent = highScore;
    floatTexts = [];
    state = STATE.START;
    requestAnimationFrame(drawLoop);
}

function startGame() {
    initAudio();
    clearTimeout(tickTimer);
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    speed = BASE_SPEED;
    goldenFood = null;
    goldenFoodCounter = 0;
    goldenFoodExpiry = 0;
    floatTexts = [];
    scoreEl.textContent = 0;
    spawnFood();
    state = STATE.PLAYING;
    tick();
}

// ── Game loop (split: tick for logic, rAF for drawing) ───────────────────────

function tick() {
    update();
    if (state === STATE.PLAYING) tickTimer = setTimeout(tick, speed);
}

let lastDrawTs = 0;
function drawLoop(ts) {
    const dt = Math.min((ts - lastDrawTs) / 1000, 0.1);
    lastDrawTs = ts;

    // smooth float text animation
    const cs = cellSize();
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const f = floatTexts[i];
        f.y -= cs * 2.2 * dt;
        f.life -= dt;
        if (f.life <= 0) floatTexts.splice(i, 1);
    }

    // expire golden food
    if (goldenFood && goldenFoodExpiry && Date.now() > goldenFoodExpiry) goldenFood = null;

    draw();
    requestAnimationFrame(drawLoop);
}

// ── Update ────────────────────────────────────────────────────────────────────

function update() {
    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) return gameOver();

    snake.unshift(head);

    let ate = false;

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = score;
        sfxEat();
        addFloat(head.x, head.y, '+10', '#e53935');
        ate = true;
        goldenFoodCounter++;
        if (goldenFoodCounter % 8 === 0 && !goldenFood) spawnGoldenFood();
        if ((score / 10) % 5 === 0) speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        spawnFood();
    } else if (goldenFood && head.x === goldenFood.x && head.y === goldenFood.y) {
        score += 30;
        scoreEl.textContent = score;
        sfxEatGolden();
        addFloat(head.x, head.y, '+30', '#ffd700');
        goldenFood = null;
        ate = true;
        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
    }

    if (!ate) snake.pop();
}

function spawnFood() {
    const empty = [];
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            if (!snake.some(s => s.x === x && s.y === y) &&
                !(goldenFood && goldenFood.x === x && goldenFood.y === y)) {
                empty.push({ x, y });
            }
        }
    }
    food = empty[Math.floor(Math.random() * empty.length)];
}

function spawnGoldenFood() {
    const empty = [];
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            if (!snake.some(s => s.x === x && s.y === y) && !(food && food.x === x && food.y === y)) {
                empty.push({ x, y });
            }
        }
    }
    if (empty.length > 0) {
        goldenFood = empty[Math.floor(Math.random() * empty.length)];
        goldenFoodExpiry = Date.now() + 12000;
    }
}

function gameOver() {
    sfxDie();
    clearTimeout(tickTimer);
    state = STATE.GAMEOVER;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function cellSize() {
    return canvas.width / COLS;
}

function draw() {
    const size = canvas.clientWidth;
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }

    const cs = cellSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state === STATE.START) {
        drawOverlay('SNAKE', 'Press Space or tap Start');
        drawCenteredButton('START', canvas.height * 0.65);
        return;
    }

    drawGrid(cs);
    drawFood(cs);
    drawGoldenFood(cs);
    drawSnake(cs);
    drawFloatTexts(cs);

    if (state === STATE.GAMEOVER) {
        drawOverlay('GAME OVER', `Score: ${score}`);
        drawCenteredButton('RESTART', canvas.height * 0.65);
    }
}

function drawGrid(cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(canvas.width, y * cs); ctx.stroke();
    }
}

function drawFood(cs) {
    const cx = food.x * cs + cs / 2, cy = food.y * cs + cs / 2, r = cs / 2 - 2;
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function drawGoldenFood(cs) {
    if (!goldenFood) return;
    const cx = goldenFood.x * cs + cs / 2, cy = goldenFood.y * cs + cs / 2;
    const r  = cs / 2 - 1;
    const pulse = 0.82 + 0.18 * Math.sin(Date.now() * 0.008);
    ctx.save();
    ctx.shadowBlur = 12 * pulse;
    ctx.shadowColor = '#ffd700';
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8dc';
    ctx.font = `${cs * 0.55}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy);
    ctx.restore();
}

function drawSnake(cs) {
    snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#81c784' : '#4caf50';
        const pad = 1;
        ctx.beginPath();
        ctx.roundRect(seg.x * cs + pad, seg.y * cs + pad, cs - pad * 2, cs - pad * 2, 3);
        ctx.fill();
    });

    // eyes on head
    if (snake.length === 0) return;
    const h = snake[0];
    const cx = h.x * cs + cs / 2, cy = h.y * cs + cs / 2;
    const eyeR = Math.max(2, cs * 0.1);
    const fwd = cs * 0.18, side = cs * 0.2;
    const perpX = direction.y, perpY = -direction.x;

    const ex1 = cx + direction.x * fwd + perpX * side;
    const ey1 = cy + direction.y * fwd + perpY * side;
    const ex2 = cx + direction.x * fwd - perpX * side;
    const ey2 = cy + direction.y * fwd - perpY * side;

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(ex1 + direction.x * eyeR * 0.35, ey1 + direction.y * eyeR * 0.35, eyeR * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2 + direction.x * eyeR * 0.35, ey2 + direction.y * eyeR * 0.35, eyeR * 0.58, 0, Math.PI * 2); ctx.fill();
}

function drawOverlay(title, subtitle) {
    ctx.fillStyle = 'rgba(18, 18, 42, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#81c784';
    ctx.font = `bold ${canvas.width * 0.12}px 'Courier New', monospace`;
    ctx.fillText(title, canvas.width / 2, canvas.height * 0.38);
    ctx.fillStyle = '#a0a0c0';
    ctx.font = `${canvas.width * 0.055}px 'Courier New', monospace`;
    ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.52);
}

function drawCenteredButton(label, y) {
    const w = canvas.width * 0.42, h = canvas.width * 0.11, x = (canvas.width - w) / 2;
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${canvas.width * 0.055}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, y + h * 0.68);
}

// ── Input ─────────────────────────────────────────────────────────────────────

function setDirection(dx, dy) {
    if (dx === -direction.x && dy === -direction.y) return;
    nextDirection = { x: dx, y: dy };
}

document.addEventListener('keydown', e => {
    if (state === STATE.START || state === STATE.GAMEOVER) {
        if (e.code === 'Space' || e.code === 'Enter') { startGame(); return; }
    }
    if (state !== STATE.PLAYING) return;
    switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); setDirection(0, -1); break;
        case 'ArrowDown':  case 's': case 'S': e.preventDefault(); setDirection(0,  1); break;
        case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); setDirection(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); setDirection(1,  0); break;
    }
});

canvas.addEventListener('click', e => {
    if (state === STATE.START || state === STATE.GAMEOVER) {
        const rect = canvas.getBoundingClientRect();
        const clickY = (e.clientY - rect.top) * (canvas.width / rect.width);
        const buttonTop = canvas.height * 0.65, buttonH = canvas.width * 0.11;
        if (clickY >= buttonTop && clickY <= buttonTop + buttonH) startGame();
    }
});

document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (state === STATE.START || state === STATE.GAMEOVER) { startGame(); return; }
        const map = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
        const [dx, dy] = map[btn.dataset.dir];
        setDirection(dx, dy);
    });
});

// Swipe gesture support
let swipeStartX = 0, swipeStartY = 0;
canvas.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
    if (state === STATE.START || state === STATE.GAMEOVER) { startGame(); return; }
    if (state !== STATE.PLAYING) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
}, { passive: true });

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => { if (state !== STATE.PLAYING) draw(); });

init();
