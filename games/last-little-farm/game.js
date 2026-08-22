(() => {
'use strict';

// ============================================================
// Setup
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const SAVE_KEY = 'llf_save_v1';
const WORLD_WIDTH = 3000;
const GRAVITY = 2200;
const MOVE_SPEED = 240;
const JUMP_VELOCITY = 780;
const GROW_TIME = 16; // seconds from watered -> ready
const TREE_REGROW_TIME = 40;
const CHICKEN_EGG_TIME = 12;
const INTERACT_RANGE = 70;

let viewW = window.innerWidth;
let viewH = window.innerHeight;
let groundY = 0;
let dpr = 1;

function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = viewH - Math.max(80, Math.min(170, viewH * 0.24));
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));
resizeCanvas();

// ============================================================
// World content (positions are world-space x, feet on ground)
// ============================================================

const world = {
    houseX: 220,
    wellX: 470,
    coopX: 900,
    plots: [
        { x: 660, state: 'empty', growth: 0, watered: false },
        { x: 720, state: 'empty', growth: 0, watered: false },
        { x: 780, state: 'empty', growth: 0, watered: false },
    ],
    trees: [
        { x: 1500, hp: 3, stumpTimer: 0 },
        { x: 1620, hp: 3, stumpTimer: 0 },
        { x: 1760, hp: 3, stumpTimer: 0 },
    ],
    chicken: {
        x: 950, vx: 0, dir: 1, idleTimer: 1.5, targetX: 950,
        eggTimer: -1, hopTimer: 0, fedFlash: 0,
    },
};

const player = {
    x: 300, y: 0, vy: 0, w: 26, h: 46,
    onGround: true, facing: 1, moving: false, walkT: 0,
};

const resources = {
    wood: 0, water: 0, waterMax: 5, seeds: 3, crops: 0, eggs: 0, day: 1,
};

let camX = 0;
let muted = false;
let paused = false;
let started = false;
let lastTime = performance.now();
let elapsed = 0;
let toastTimer = 0;
let dayFlashTimer = 0;

// ============================================================
// Quest / onboarding steps
// ============================================================

const quests = [
    { id: 'move', text: 'Use ◀ ▶ to walk around the farm.', done: () => elapsed > 0.01 && questMoved },
    { id: 'till', text: 'Walk to the crop field and till a plot (✋).', done: () => world.plots.some(p => p.state !== 'empty') },
    { id: 'plant', text: 'Plant a seed on the tilled soil (✋).', done: () => world.plots.some(p => p.state === 'planted' || p.state === 'growing' || p.state === 'ready') },
    { id: 'water', text: 'Fill up at the well, then water your seed (✋).', done: () => world.plots.some(p => p.state === 'growing' || p.state === 'ready') },
    { id: 'grow', text: 'Wait for your crop to grow, then harvest it (✋).', done: () => resources.crops > 0 },
    { id: 'chicken', text: 'Bring a crop to the chicken to earn an egg (✋).', done: () => resources.eggs > 0 },
    { id: 'wood', text: 'Chop wood from the trees to gather materials (✋).', done: () => resources.wood > 0 },
    { id: 'sleep', text: 'Head into the house and rest to end the day (✋).', done: () => resources.day > 1 },
    { id: 'done', text: 'Your little farm is growing. Keep farming, exploring and restoring! 🌾', done: () => false },
];
let questIndex = 0;
let questMoved = false;

function currentQuest() { return quests[Math.min(questIndex, quests.length - 1)]; }

function updateQuests() {
    const q = quests[questIndex];
    if (q && q.id !== 'done' && q.done()) {
        questIndex++;
        showToast(currentQuest().text);
    }
}

function showToast(text) {
    const el = document.getElementById('quest-toast');
    el.textContent = text;
    el.classList.add('visible');
    toastTimer = 6;
}

// ============================================================
// Input abstraction (keyboard, mouse, touch -> same state)
// ============================================================

const keys = { left: false, right: false };
let jumpPressed = false;
let actionPressed = false;

window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'e', 'E', 'Escape'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') jumpPressed = true;
    if (e.key === 'e' || e.key === 'E') actionPressed = true;
    if (e.key === 'Escape') togglePause();
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

function bindHold(id, onDown, onUp) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const down = ev => { ev.preventDefault(); onDown(); btn.classList.add('pressed'); };
    const up = ev => { if (ev) ev.preventDefault(); onUp(); btn.classList.remove('pressed'); };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('touchcancel', up, { passive: false });
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
}

bindHold('btn-left', () => { keys.left = true; questMoved = true; }, () => keys.left = false);
bindHold('btn-right', () => { keys.right = true; questMoved = true; }, () => keys.right = false);
bindHold('btn-jump', () => { jumpPressed = true; }, () => {});
bindHold('btn-action', () => { actionPressed = true; }, () => {});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && started) setPaused(true);
});

// ============================================================
// Save / load
// ============================================================

function saveGame() {
    try {
        const data = {
            resources,
            plots: world.plots.map(p => ({ state: p.state, growth: p.growth, watered: p.watered })),
            trees: world.trees.map(t => ({ hp: t.hp, stumpTimer: t.stumpTimer })),
            playerX: player.x,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable, ignore */ }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        Object.assign(resources, data.resources);
        if (Array.isArray(data.plots)) {
            data.plots.forEach((p, i) => { if (world.plots[i]) Object.assign(world.plots[i], p); });
        }
        if (Array.isArray(data.trees)) {
            data.trees.forEach((t, i) => { if (world.trees[i]) Object.assign(world.trees[i], t); });
        }
        if (typeof data.playerX === 'number') player.x = data.playerX;
        questIndex = quests.findIndex(q => !q.done());
        if (questIndex === -1) questIndex = quests.length - 1;
    } catch (e) { /* corrupt save, ignore */ }
}

// ============================================================
// Interaction targets
// ============================================================

function nearestInteractable() {
    let best = null, bestDist = INTERACT_RANGE;

    const dist = x => Math.abs(player.x - x);

    if (dist(world.wellX) < bestDist) { best = { type: 'well' }; bestDist = dist(world.wellX); }
    if (dist(world.houseX) < bestDist) { best = { type: 'house' }; bestDist = dist(world.houseX); }
    if (dist(world.chicken.x) < bestDist) { best = { type: 'chicken' }; bestDist = dist(world.chicken.x); }

    world.plots.forEach((p, i) => {
        if (dist(p.x) < bestDist) { best = { type: 'plot', index: i }; bestDist = dist(p.x); }
    });
    world.trees.forEach((t, i) => {
        if (t.hp > 0 && dist(t.x) < bestDist) { best = { type: 'tree', index: i }; bestDist = dist(t.x); }
    });

    return best;
}

function promptFor(target) {
    if (!target) return null;
    switch (target.type) {
        case 'well': return resources.water >= resources.waterMax ? 'Bucket full' : 'Fill bucket';
        case 'house': return 'Rest & save';
        case 'chicken': return resources.crops > 0 ? 'Feed chicken' : 'Say hi';
        case 'tree': return 'Chop wood';
        case 'plot': {
            const p = world.plots[target.index];
            if (p.state === 'empty') return 'Till soil';
            if (p.state === 'tilled') return resources.seeds > 0 ? 'Plant seed' : 'Need seeds';
            if (p.state === 'planted') return resources.water > 0 ? 'Water crop' : 'Need water';
            if (p.state === 'growing') return 'Growing…';
            if (p.state === 'ready') return 'Harvest';
            return null;
        }
    }
    return null;
}

function doAction(target) {
    if (!target) return;
    switch (target.type) {
        case 'well':
            if (resources.water < resources.waterMax) {
                resources.water = resources.waterMax;
                saveGame();
            }
            break;
        case 'house':
            resources.day++;
            dayFlashTimer = 1.2;
            saveGame();
            break;
        case 'chicken': {
            const c = world.chicken;
            if (resources.crops > 0 && c.eggTimer < 0) {
                resources.crops--;
                c.eggTimer = CHICKEN_EGG_TIME;
                c.fedFlash = 0.6;
            } else {
                c.fedFlash = 0.3;
            }
            break;
        }
        case 'tree': {
            const t = world.trees[target.index];
            if (t.hp > 0) {
                t.hp--;
                if (t.hp <= 0) {
                    resources.wood += 2;
                    t.stumpTimer = TREE_REGROW_TIME;
                    saveGame();
                }
            }
            break;
        }
        case 'plot': {
            const p = world.plots[target.index];
            if (p.state === 'empty') {
                p.state = 'tilled';
            } else if (p.state === 'tilled' && resources.seeds > 0) {
                resources.seeds--;
                p.state = 'planted';
                p.watered = false;
            } else if (p.state === 'planted' && resources.water > 0) {
                resources.water--;
                p.watered = true;
                p.state = 'growing';
                p.growth = 0;
            } else if (p.state === 'ready') {
                resources.crops++;
                if (Math.random() < 0.6) resources.seeds++;
                p.state = 'empty';
                p.growth = 0;
                p.watered = false;
                saveGame();
            }
            break;
        }
    }
}

// ============================================================
// Update
// ============================================================

function update(dt) {
    elapsed += dt;
    if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) document.getElementById('quest-toast').classList.remove('visible');
    }
    if (dayFlashTimer > 0) dayFlashTimer -= dt;

    // --- player horizontal movement ---
    let vx = 0;
    if (keys.left) { vx -= MOVE_SPEED; player.facing = -1; questMoved = true; }
    if (keys.right) { vx += MOVE_SPEED; player.facing = 1; questMoved = true; }
    player.moving = vx !== 0;
    player.x += vx * dt;
    player.x = Math.max(20, Math.min(WORLD_WIDTH - 20, player.x));
    if (player.moving) player.walkT += dt * 9; else player.walkT = 0;

    // --- vertical / jump ---
    if (jumpPressed && player.onGround) {
        player.vy = -JUMP_VELOCITY;
        player.onGround = false;
    }
    jumpPressed = false;

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= 0) { player.y = 0; player.vy = 0; player.onGround = true; }

    // --- camera ---
    const maxCam = Math.max(0, WORLD_WIDTH - viewW);
    camX = Math.max(0, Math.min(maxCam, player.x - viewW / 2));

    // --- interactables ---
    const target = nearestInteractable();
    if (actionPressed) { doAction(target); actionPressed = false; }
    updatePrompt(target);

    // --- crop growth ---
    world.plots.forEach(p => {
        if (p.state === 'growing') {
            p.growth += dt / GROW_TIME;
            if (p.growth >= 1) { p.growth = 1; p.state = 'ready'; }
        }
    });

    // --- trees regrow ---
    world.trees.forEach(t => {
        if (t.hp <= 0) {
            t.stumpTimer -= dt;
            if (t.stumpTimer <= 0) t.hp = 3;
        }
    });

    // --- chicken AI ---
    updateChicken(dt);

    updateQuests();

    // periodic autosave fallback
    autosaveTimer -= dt;
    if (autosaveTimer <= 0) { saveGame(); autosaveTimer = 20; }

    updateHUD();
}

let autosaveTimer = 20;

function updateChicken(dt) {
    const c = world.chicken;
    if (c.fedFlash > 0) c.fedFlash -= dt;
    if (c.hopTimer > 0) c.hopTimer -= dt;

    if (c.eggTimer >= 0) {
        c.eggTimer -= dt;
        if (c.eggTimer <= 0) {
            c.eggTimer = -1;
            resources.eggs++;
            c.hopTimer = 0.5;
            saveGame();
        }
    }

    c.idleTimer -= dt;
    if (c.idleTimer <= 0) {
        c.targetX = world.coopX - 140 + Math.random() * 280;
        c.idleTimer = 2 + Math.random() * 3;
    }
    const d = c.targetX - c.x;
    if (Math.abs(d) > 4) {
        c.dir = d > 0 ? 1 : -1;
        c.x += c.dir * 40 * dt;
    }
}

function updatePrompt(target) {
    const bubble = document.getElementById('prompt-bubble');
    const actionBtn = document.getElementById('btn-action');
    const text = promptFor(target);
    if (text) {
        bubble.textContent = text;
        bubble.classList.add('visible');
        actionBtn.classList.add('available');
        const worldX = target.type === 'plot' ? world.plots[target.index].x
            : target.type === 'tree' ? world.trees[target.index].x
            : target.type === 'well' ? world.wellX
            : target.type === 'house' ? world.houseX
            : world.chicken.x;
        const screenX = worldX - camX;
        const screenY = groundY - 70;
        bubble.style.left = screenX + 'px';
        bubble.style.top = screenY + 'px';
    } else {
        bubble.classList.remove('visible');
        actionBtn.classList.remove('available');
    }
}

function updateHUD() {
    document.getElementById('res-wood').textContent = resources.wood;
    document.getElementById('res-water').textContent = resources.water + '/' + resources.waterMax;
    document.getElementById('res-seeds').textContent = resources.seeds;
    document.getElementById('res-crops').textContent = resources.crops;
    document.getElementById('res-eggs').textContent = resources.eggs;
    document.getElementById('res-day').textContent = resources.day;
}

// ============================================================
// Rendering
// ============================================================

function draw() {
    ctx.clearRect(0, 0, viewW, viewH);
    drawSky();
    drawParallaxHills();
    drawGround();
    drawWell();
    drawHouse();
    drawCoop();
    drawFencePosts();
    drawPlots();
    drawTrees();
    drawChicken();
    drawPlayer();
    if (dayFlashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, dayFlashTimer)})`;
        ctx.fillRect(0, 0, viewW, viewH);
    }
}

function w2s(x) { return x - camX; }

function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, '#6fc0e8');
    grad.addColorStop(1, '#bfe8f5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, groundY);

    // sun
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(viewW - 70, 70, 34, 0, Math.PI * 2);
    ctx.fill();

    // clouds — spread across the full sky height so tall (portrait) screens
    // don't end up with a big empty gap above the hills
    const t = elapsed * 6;
    const cloudCount = Math.max(5, Math.ceil(groundY / 130));
    for (let i = 0; i < cloudCount; i++) {
        const cx = ((i * 560 - t - camX * (0.1 + (i % 3) * 0.03)) % (WORLD_WIDTH + 400)) - 200;
        const cy = 50 + (i * 97) % Math.max(1, groundY - 140);
        drawCloud(cx, cy, 0.8 + (i % 3) * 0.25);
    }
}

function drawCloud(x, y, scale) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 22 * scale, y + 4 * scale, 22 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * scale, y + 4 * scale, 20 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawParallaxHills() {
    const baseY = groundY;
    drawMountainRow(baseY, 0.1, Math.min(150, groundY * 0.3));
    ctx.fillStyle = '#8fd06a';
    drawHillRow(baseY - 30, 0.35, 90, '#7fc25c');
    ctx.fillStyle = '#79ba55';
    drawHillRow(baseY - 10, 0.55, 60, '#6fae4c');
}

function drawMountainRow(baseY, parallax, amp) {
    const top = baseY - amp * 1.6;
    const grad = ctx.createLinearGradient(0, top, 0, baseY);
    grad.addColorStop(0, 'rgba(159, 184, 207, 0.35)');
    grad.addColorStop(1, 'rgba(148, 176, 201, 0.9)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const offset = -camX * parallax;
    const step = Math.max(55, viewW / 9);
    for (let x = -step; x <= viewW + step; x += step) {
        const phase = (x - offset) * 0.012;
        const peak = Math.sin(phase) * amp * 0.5 + Math.sin(phase * 2.3 + 1.7) * amp * 0.25;
        const y = baseY - amp * 0.55 - peak;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(viewW, baseY);
    ctx.closePath();
    ctx.fill();
}

function drawHillRow(baseY, parallax, amp, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    const offset = -camX * parallax;
    const step = 140;
    for (let x = -step; x <= viewW + step; x += step) {
        const worldPhase = (x - offset) * 0.01;
        const y = baseY - Math.sin(worldPhase) * amp * 0.5 - amp * 0.5;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
}

function drawGround() {
    ctx.fillStyle = '#5a9c3f';
    ctx.fillRect(0, groundY, viewW, viewH - groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, groundY, viewW, 6);
}

function drawWell() {
    const x = w2s(world.wellX);
    if (x < -60 || x > viewW + 60) return;
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x - 26, groundY - 26, 52, 26);
    ctx.fillStyle = '#6f6f6f';
    ctx.fillRect(x - 30, groundY - 30, 60, 8);
    // roof
    ctx.fillStyle = '#a55a3a';
    ctx.beginPath();
    ctx.moveTo(x - 34, groundY - 46);
    ctx.lineTo(x + 34, groundY - 46);
    ctx.lineTo(x, groundY - 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6f4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 22, groundY - 46);
    ctx.lineTo(x - 22, groundY - 30);
    ctx.moveTo(x + 22, groundY - 46);
    ctx.lineTo(x + 22, groundY - 30);
    ctx.stroke();
    // water level indicator
    const pct = resources.water / resources.waterMax;
    ctx.fillStyle = '#3a7fc9';
    ctx.fillRect(x - 20, groundY - 8 - 14 * pct, 40, 14 * pct);
}

function drawHouse() {
    const x = w2s(world.houseX);
    if (x < -120 || x > viewW + 120) return;
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(x - 60, groundY - 90, 120, 90);
    ctx.fillStyle = '#b5482f';
    ctx.beginPath();
    ctx.moveTo(x - 74, groundY - 90);
    ctx.lineTo(x + 74, groundY - 90);
    ctx.lineTo(x, groundY - 150);
    ctx.closePath();
    ctx.fill();
    // door
    const near = Math.abs(player.x - world.houseX) < INTERACT_RANGE;
    ctx.fillStyle = near ? '#ffd76a' : '#6f4a2a';
    ctx.fillRect(x - 16, groundY - 46, 32, 46);
    // window
    ctx.fillStyle = '#bfe8f5';
    ctx.fillRect(x + 24, groundY - 70, 22, 22);
    ctx.fillRect(x - 46, groundY - 70, 22, 22);
}

function drawCoop() {
    const x = w2s(world.coopX);
    if (x < -100 || x > viewW + 100) return;
    ctx.fillStyle = '#c9a06a';
    ctx.fillRect(x - 45, groundY - 55, 90, 55);
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.moveTo(x - 55, groundY - 55);
    ctx.lineTo(x + 55, groundY - 55);
    ctx.lineTo(x, groundY - 88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x - 12, groundY - 30, 24, 30);
}

function drawFencePosts() {
    ctx.fillStyle = '#8a6a42';
    [560, 860, 1040].forEach(px => {
        const x = w2s(px);
        if (x < -20 || x > viewW + 20) return;
        ctx.fillRect(x - 4, groundY - 34, 8, 34);
        ctx.fillRect(x - 4, groundY - 26, 60, 5);
    });
}

function drawPlots() {
    world.plots.forEach(p => {
        const x = w2s(p.x);
        if (x < -40 || x > viewW + 40) return;
        const size = 46;
        ctx.fillStyle = p.state === 'empty' ? '#7a5a3a' : '#5a3f24';
        ctx.fillRect(x - size / 2, groundY - 10, size, 10);
        if (p.state !== 'empty') {
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1;
            for (let i = -18; i <= 18; i += 9) {
                ctx.beginPath();
                ctx.moveTo(x + i, groundY - 10);
                ctx.lineTo(x + i, groundY - 2);
                ctx.stroke();
            }
        }
        if (p.state === 'planted') {
            ctx.strokeStyle = '#4f9a4a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, groundY - 10);
            ctx.lineTo(x, groundY - 18);
            ctx.stroke();
        } else if (p.state === 'growing') {
            const h = 10 + p.growth * 26;
            ctx.strokeStyle = '#3f8a3a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, groundY - 10);
            ctx.lineTo(x, groundY - 10 - h);
            ctx.stroke();
            ctx.fillStyle = '#4fae4a';
            ctx.beginPath();
            ctx.ellipse(x - 8, groundY - 10 - h * 0.6, 8, 5, 0.6, 0, Math.PI * 2);
            ctx.ellipse(x + 8, groundY - 10 - h * 0.6, 8, 5, -0.6, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.state === 'ready') {
            const bob = Math.sin(elapsed * 4 + p.x) * 2;
            ctx.strokeStyle = '#3f8a3a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, groundY - 10);
            ctx.lineTo(x, groundY - 34);
            ctx.stroke();
            ctx.fillStyle = '#e8a13a';
            ctx.beginPath();
            ctx.arc(x, groundY - 40 + bob, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,240,150,0.8)';
            ctx.beginPath();
            ctx.arc(x, groundY - 40 + bob, 17, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,240,150,0.8)';
            ctx.stroke();
        }
    });
}

function drawTrees() {
    world.trees.forEach(t => {
        const x = w2s(t.x);
        if (x < -60 || x > viewW + 60) return;
        if (t.hp <= 0) {
            ctx.fillStyle = '#6f4a2a';
            ctx.fillRect(x - 10, groundY - 16, 20, 16);
            return;
        }
        ctx.fillStyle = '#6f4a2a';
        ctx.fillRect(x - 7, groundY - 50, 14, 50);
        const shake = t.hp < 3 ? Math.sin(elapsed * 30) * 3 : 0;
        ctx.fillStyle = '#3f8a3a';
        ctx.beginPath();
        ctx.arc(x + shake, groundY - 74, 32, 0, Math.PI * 2);
        ctx.arc(x - 22 + shake, groundY - 60, 22, 0, Math.PI * 2);
        ctx.arc(x + 22 + shake, groundY - 60, 22, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawChicken() {
    const c = world.chicken;
    const x = w2s(c.x);
    if (x < -40 || x > viewW + 40) return;
    const hop = c.hopTimer > 0 ? Math.abs(Math.sin(elapsed * 20)) * 8 : 0;
    ctx.save();
    ctx.translate(x, groundY - 10 - hop);
    if (c.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = '#fdfdfd';
    ctx.beginPath();
    ctx.ellipse(0, -10, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, -16, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e04a2a';
    ctx.beginPath();
    ctx.moveTo(17, -16);
    ctx.lineTo(23, -14);
    ctx.lineTo(17, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9342a';
    ctx.beginPath();
    ctx.arc(9, -21, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(-4, -1, 3, 5);
    ctx.fillRect(4, -1, 3, 5);
    if (c.fedFlash > 0) {
        ctx.fillStyle = 'rgba(255,120,150,0.9)';
        ctx.font = '16px sans-serif';
        ctx.fillText('❤', -6, -34);
    }
    ctx.restore();
}

function drawPlayer() {
    const x = w2s(player.x);
    const feetY = groundY + player.y;
    const bob = player.moving && player.onGround ? Math.sin(player.walkT) * 3 : 0;
    ctx.save();
    ctx.translate(x, feetY);
    if (player.facing < 0) ctx.scale(-1, 1);

    // legs
    const legSwing = player.moving && player.onGround ? Math.sin(player.walkT) * 8 : 0;
    ctx.strokeStyle = '#3a5f8a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -20);
    ctx.lineTo(-5 + legSwing, -2);
    ctx.moveTo(5, -20);
    ctx.lineTo(5 - legSwing, -2);
    ctx.stroke();

    // body
    ctx.fillStyle = '#5a8a4a';
    ctx.fillRect(-11, -44 + bob * 0.2, 22, 26);

    // arms
    ctx.strokeStyle = '#e8b98a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, -38);
    ctx.lineTo(-16 - Math.abs(legSwing) * 0.3, -22);
    ctx.moveTo(10, -38);
    ctx.lineTo(16 + Math.abs(legSwing) * 0.3, -22);
    ctx.stroke();

    // head
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -54 + bob * 0.2, 11, 0, Math.PI * 2);
    ctx.fill();

    // hat
    ctx.fillStyle = '#c98a3a';
    ctx.beginPath();
    ctx.ellipse(0, -62 + bob * 0.2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, -63 + bob * 0.2);
    ctx.lineTo(7, -63 + bob * 0.2);
    ctx.lineTo(4, -72 + bob * 0.2);
    ctx.lineTo(-4, -72 + bob * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// ============================================================
// Main loop
// ============================================================

function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (started && !paused) {
        update(dt);
        draw();
    }
    requestAnimationFrame(frame);
}

// ============================================================
// Pause / start / mute wiring
// ============================================================

function setPaused(v) {
    paused = v;
    document.getElementById('pause-overlay').classList.toggle('hidden', !v);
    if (v) saveGame();
}
function togglePause() {
    if (!started) return;
    setPaused(!paused);
}

document.getElementById('btn-pause').addEventListener('click', () => togglePause());
document.getElementById('btn-resume').addEventListener('click', () => setPaused(false));
document.getElementById('btn-mute').addEventListener('click', e => {
    muted = !muted;
    e.target.textContent = 'Mute: ' + (muted ? 'On' : 'Off');
});
document.getElementById('btn-restart').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
});
document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('start-overlay').classList.add('hidden');
    started = true;
    lastTime = performance.now();
    showToast(currentQuest().text);
    const hint = document.getElementById('rotate-hint');
    hint.style.opacity = '1';
    setTimeout(() => { hint.style.opacity = '0'; }, 3500);
});

// ============================================================
// Init
// ============================================================

loadGame();
updateHUD();
draw();
requestAnimationFrame(frame);
})();
