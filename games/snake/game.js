const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');

const COLS = 20;
const ROWS = 20;
const BASE_SPEED = 150;
const MIN_SPEED = 60;
const SPEED_STEP = 10; // ms faster every 5 foods

const STATE = { START: 'start', PLAYING: 'playing', GAMEOVER: 'gameover' };

let state, snake, direction, nextDirection, food, score, highScore, speed, tickTimer;

function init() {
    highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
    highScoreEl.textContent = highScore;
    setState(STATE.START);
}

function setState(s) {
    state = s;
    if (s === STATE.START || s === STATE.GAMEOVER) {
        clearTimeout(tickTimer);
    }
    draw();
}

function startGame() {
    clearTimeout(tickTimer);
    snake = [
        { x: 10, y: 10 },
        { x: 9,  y: 10 },
        { x: 8,  y: 10 },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    speed = BASE_SPEED;
    scoreEl.textContent = 0;
    spawnFood();
    state = STATE.PLAYING;
    tick();
}

function tick() {
    update();
    draw();
    if (state === STATE.PLAYING) {
        tickTimer = setTimeout(tick, speed);
    }
}

function update() {
    direction = nextDirection;

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        return gameOver();
    }

    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = score;

        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }

        // Speed up every 5 foods
        if ((score / 10) % 5 === 0) {
            speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
        }

        spawnFood();
    } else {
        snake.pop();
    }
}

function spawnFood() {
    const empty = [];
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            if (!snake.some(s => s.x === x && s.y === y)) {
                empty.push({ x, y });
            }
        }
    }
    food = empty[Math.floor(Math.random() * empty.length)];
}

function gameOver() {
    setState(STATE.GAMEOVER);
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function cellSize() {
    return canvas.width / COLS;
}

function draw() {
    // Keep canvas resolution in sync with its display size
    const size = canvas.clientWidth;
    if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
    }

    const cs = cellSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state === STATE.START) {
        drawOverlay('SNAKE', 'Press Space or tap Start');
        drawStartButton();
        return;
    }

    drawGrid(cs);
    drawFood(cs);
    drawSnake(cs);

    if (state === STATE.GAMEOVER) {
        drawOverlay('GAME OVER', `Score: ${score}`);
        drawRestartButton();
    }
}

function drawGrid(cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cs, 0);
        ctx.lineTo(x * cs, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cs);
        ctx.lineTo(canvas.width, y * cs);
        ctx.stroke();
    }
}

function drawFood(cs) {
    const cx = food.x * cs + cs / 2;
    const cy = food.y * cs + cs / 2;
    const r  = cs / 2 - 2;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawSnake(cs) {
    snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#81c784' : '#4caf50';
        const pad = 1;
        ctx.beginPath();
        ctx.roundRect(
            seg.x * cs + pad,
            seg.y * cs + pad,
            cs - pad * 2,
            cs - pad * 2,
            3
        );
        ctx.fill();
    });
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

function drawStartButton() {
    drawCenteredButton('START', canvas.height * 0.65);
}

function drawRestartButton() {
    drawCenteredButton('RESTART', canvas.height * 0.65);
}

function drawCenteredButton(label, y) {
    const w = canvas.width * 0.42;
    const h = canvas.width * 0.11;
    const x = (canvas.width - w) / 2;
    const top = y;

    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${canvas.width * 0.055}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, top + h * 0.68);
}

// ── Input ─────────────────────────────────────────────────────────────────────

function setDirection(dx, dy) {
    // Prevent reversing
    if (dx === -direction.x && dy === -direction.y) return;
    nextDirection = { x: dx, y: dy };
}

document.addEventListener('keydown', e => {
    if (state === STATE.START || state === STATE.GAMEOVER) {
        if (e.code === 'Space' || e.code === 'Enter') {
            startGame();
            return;
        }
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
        const scaleX = canvas.width / rect.width;
        const clickY = (e.clientY - rect.top) * scaleX;
        const buttonTop = canvas.height * 0.65;
        const buttonH   = canvas.width  * 0.11;
        if (clickY >= buttonTop && clickY <= buttonTop + buttonH) {
            startGame();
        }
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

// ── Boot ──────────────────────────────────────────────────────────────────────

// Redraw on resize so canvas stays sharp
window.addEventListener('resize', () => { if (state !== STATE.PLAYING) draw(); });

init();
