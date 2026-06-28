import { ANIMALS, getChoices, pickRandom, shuffle } from './animals.js';
import {
  fillRoundRect, strokeRoundRect, roundRect, setShadow, clearShadow,
  text, drawStar, lerp, easeOut, easeOutBounce, hexToRgb, rgbStr,
} from './ui.js';

// ─── Shared background ────────────────────────────────────────────────────────

const BG_STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * 1280,
  y: Math.random() * 400,
  r: Math.random() * 1.8 + 0.4,
  phase: Math.random() * Math.PI * 2,
  speed: Math.random() * 1.5 + 0.8,
}));

function drawBackground(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0,    '#0b0a2e');
  grad.addColorStop(0.55, '#1a1455');
  grad.addColorStop(1,    '#2e1d6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  BG_STARS.forEach(s => {
    const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Rolling hills
  ctx.fillStyle = '#1a4d1a';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  ctx.bezierCurveTo(320, 640, 640, 660, 960, 640);
  ctx.bezierCurveTo(1100, 630, 1200, 645, 1280, 650);
  ctx.lineTo(1280, 720);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#236b23';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  ctx.bezierCurveTo(200, 680, 500, 670, 800, 680);
  ctx.bezierCurveTo(1000, 685, 1150, 675, 1280, 680);
  ctx.lineTo(1280, 720);
  ctx.closePath();
  ctx.fill();
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8','#FFB347','#A388EE'];

class Particle {
  constructor(x, y) {
    this.x  = x;   this.y  = y;
    this.vx = (Math.random() - 0.5) * 900;
    this.vy = -Math.random() * 650 - 150;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.w  = Math.random() * 14 + 6;
    this.h  = this.w * 0.45;
    this.rot  = Math.random() * Math.PI * 2;
    this.rotS = (Math.random() - 0.5) * 12;
    this.life  = 1.0;
    this.decay = 0.55 + Math.random() * 0.35;
  }
  update(dt) {
    this.vy += 1400 * dt;
    this.vx *= Math.pow(0.94, dt * 60);
    this.x  += this.vx * dt;  this.y  += this.vy * dt;
    this.rot += this.rotS * dt;
    this.life -= this.decay * dt;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

function spawnConfetti(x, y, count = 60) {
  return Array.from({ length: count }, () => new Particle(x, y));
}

// ─── Floating decorative animals (used in menus) ──────────────────────────────

class FloatingAnimal {
  constructor() { this._reset(true); }
  _reset(init = false) {
    this.x  = Math.random() * 1280;
    this.y  = init ? Math.random() * 720 : 760 + Math.random() * 80;
    this.vy = -(55 + Math.random() * 55);
    this.vx = (Math.random() - 0.5) * 28;
    this.size = 38 + Math.random() * 36;
    this.alpha = 0;
    this.targetAlpha = 0.3 + Math.random() * 0.22;
    this.emoji = ANIMALS[Math.floor(Math.random() * ANIMALS.length)].emoji;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.7 + Math.random() * 0.8;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.x += this.vx * dt + Math.sin(this.wobble) * 14 * dt;
    this.wobble += this.wobbleSpeed * dt;
    this.alpha = Math.min(this.alpha + dt * 0.4, this.targetAlpha);
    if (this.y < -110) this._reset();
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = `${this.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

// ─── Button ───────────────────────────────────────────────────────────────────

class Button {
  constructor(x, y, w, h, label, opts = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label     = label;
    this.color     = opts.color     ?? '#5B2FE0';
    this.hover     = opts.hover     ?? '#7548F5';
    this.radius    = opts.radius    ?? 24;
    this.font      = opts.font      ?? 'bold 28px "Segoe UI", sans-serif';
    this.textColor = opts.textColor ?? '#ffffff';
    this.emoji     = opts.emoji     ?? null;
    this.hovered   = false;
    this.scale     = 1;
    this.disabled  = false;
  }
  contains(px, py) {
    return !this.disabled &&
           px >= this.x && px <= this.x + this.w &&
           py >= this.y && py <= this.y + this.h;
  }
  draw(ctx) {
    ctx.save();
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.w / 2, -this.h / 2);

    ctx.globalAlpha = this.disabled ? 0.45 : 1;
    setShadow(ctx, 14, 'rgba(0,0,0,0.35)', 0, 5);
    fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.hovered ? this.hover : this.color);
    clearShadow(ctx);
    if (this.hovered) strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(255,255,255,0.4)', 3);

    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.textColor;
    const lx = this.emoji ? this.w / 2 + 16 : this.w / 2;
    ctx.fillText(this.label, lx, this.h / 2);
    if (this.emoji) {
      ctx.font = '28px serif';
      ctx.fillText(this.emoji, 40, this.h / 2);
    }

    ctx.restore();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export class LoadingScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.progress = 0;
  }
  enter() {
    this.t = 0;
    this.progress = 0;
    this.game.assets.load(p => { this.progress = p; });
  }
  exit() {}
  update(dt) {
    this.t += dt;
    if (this.progress >= 1 && this.t > 1.2) {
      this.game.audio.init();
      this.game.setScene(this.game.playerName ? 'menu' : 'nameEntry');
    }
  }
  draw(ctx) {
    drawBackground(ctx, this.t);

    const titleColors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8'];
    const title = 'ANIMAL ALPHABET';
    ctx.font = 'bold 72px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(title).width;
    let rx = 640 - tw / 2;
    for (const ch of title) {
      const cw = ctx.measureText(ch).width;
      const bounce = Math.sin(this.t * 3 + rx * 0.05) * 8;
      setShadow(ctx, 8, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = titleColors[Math.floor(rx / 30) % titleColors.length];
      ctx.fillText(ch, rx, 280 + bounce);
      clearShadow(ctx);
      rx += cw;
    }

    const bounce2 = Math.sin(this.t * 2.5 + 1) * 6;
    setShadow(ctx, 8, 'rgba(0,0,0,0.4)');
    ctx.font = 'bold 52px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD93D';
    ctx.fillText('ADVENTURE', 640, 355 + bounce2);
    clearShadow(ctx);

    const bx = 440, by = 430, bw = 400, bh = 22;
    fillRoundRect(ctx, bx, by, bw, bh, 11, 'rgba(255,255,255,0.15)');
    fillRoundRect(ctx, bx, by, Math.max(0, bw * this.progress), bh, 11, '#FFD93D');
    strokeRoundRect(ctx, bx, by, bw, bh, 11, 'rgba(255,255,255,0.3)', 2);
    text(ctx, 'Loading…', 640, 470, { font: '22px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.7)' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAME ENTRY SCENE  (shown on first launch, and when changing name)
// ═══════════════════════════════════════════════════════════════════════════════

export class NameEntryScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._floaters = Array.from({ length: 8 }, () => new FloatingAnimal());
    this._el = document.getElementById('name-input');
    this._currentName = '';
    this._errorMsg  = '';
    this._errorTimer = 0;
    this._continueBtn = new Button(490, 498, 300, 65, "Let's Play!", {
      color: '#27AE60', hover: '#2ECC71', emoji: '▶', font: 'bold 26px "Segoe UI",sans-serif',
    });
    // handlers stored as instance properties so they can be removed cleanly
    this._inputHandler = null;
    this._keyHandler   = null;
    this._resizeHandler = () => this._positionInput();
    // where to go after a successful name submit
    this.returnTo = 'menu';
  }

  enter() {
    this.t = 0;
    this._currentName = this.game.playerName ?? '';
    this._errorMsg    = '';
    this._errorTimer  = 0;

    this._el.value = this._currentName;
    this._positionInput();
    this._el.style.display = 'block';
    // small delay so the browser doesn't swallow the focus on scene transition
    setTimeout(() => this._el.focus(), 80);

    this._el.addEventListener('input', this._inputHandler = () => {
      this._currentName = this._el.value;
    });
    this._el.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'Enter') this._submit();
    });
    window.addEventListener('resize', this._resizeHandler);

    this.game.input.on('click', p => this._onClick(p));
    this.game.input.on('move',  p => this._onMove(p));
  }

  exit() {
    this._el.style.display = 'none';
    this._el.removeEventListener('input',   this._inputHandler);
    this._el.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    this._inputHandler = null;
    this._keyHandler   = null;
  }

  _positionInput() {
    // Map logical canvas coords (440, 378, 400×62) → fixed viewport coords
    const cr = this.game.canvas.getBoundingClientRect();
    const sx = cr.width  / this.game.W;
    const sy = cr.height / this.game.H;
    const lx = 440, ly = 378, lw = 400, lh = 62;
    this._el.style.left      = `${cr.left + lx * sx}px`;
    this._el.style.top       = `${cr.top  + ly * sy}px`;
    this._el.style.width     = `${lw * sx}px`;
    this._el.style.height    = `${lh * sy}px`;
    this._el.style.fontSize  = `${Math.round(26 * sy)}px`;
  }

  _onClick(p) {
    this.game.audio.resume();
    if (this._continueBtn.contains(p.x, p.y)) {
      this.game.audio.playClick();
      this._submit();
    }
  }

  _onMove(p) {
    this._continueBtn.hovered = this._continueBtn.contains(p.x, p.y);
    this._continueBtn.scale   = this._continueBtn.hovered ? 1.06 : 1;
  }

  _submit() {
    const name = this._currentName.trim();
    if (!name) {
      this._errorMsg   = 'Please type your name first!';
      this._errorTimer = 2.5;
      return;
    }
    this.game.playerName = name;
    this.game.save();
    this.game.setScene(this.returnTo);
  }

  update(dt) {
    this.t += dt;
    this._floaters.forEach(f => f.update(dt));
    if (this._errorTimer > 0) this._errorTimer -= dt;
  }

  draw(ctx) {
    drawBackground(ctx, this.t);
    this._floaters.forEach(f => f.draw(ctx));

    // Title
    text(ctx, '🌟 Animal Alphabet Adventure 🌟', 640, 118,
      { font: 'bold 42px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    // Panel
    setShadow(ctx, 24, 'rgba(0,0,0,0.45)', 0, 8);
    fillRoundRect(ctx, 290, 168, 700, 400, 32, 'rgba(12,8,45,0.90)');
    clearShadow(ctx);
    strokeRoundRect(ctx, 290, 168, 700, 400, 32, '#9B59B6', 3);

    // Decorative animals flanking the title inside the panel
    ctx.font = '58px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦁', 360, 292);
    ctx.fillText('🐰', 920, 292);

    text(ctx, "What's your name?", 640, 240,
      { font: 'bold 38px "Segoe UI", sans-serif', color: '#ffffff', shadow: 'rgba(0,0,0,0.5)' });
    text(ctx, 'Type in the box, then press Let\'s Play!', 640, 295,
      { font: '22px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.65)' });

    // Input backdrop (HTML input is positioned on top of this)
    fillRoundRect(ctx, 440, 368, 400, 62, 16, 'rgba(255,255,255,0.07)');
    strokeRoundRect(ctx, 440, 368, 400, 62, 16, 'rgba(155,89,182,0.75)', 2);

    // Error message
    if (this._errorTimer > 0) {
      ctx.globalAlpha = Math.min(this._errorTimer * 2, 1);
      text(ctx, this._errorMsg, 640, 452,
        { font: 'bold 20px "Segoe UI", sans-serif', color: '#FF6B6B' });
      ctx.globalAlpha = 1;
    }

    this._continueBtn.draw(ctx);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENU SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._floaters = Array.from({ length: 12 }, () => new FloatingAnimal());
    this._btns = [];
    this._muteBtn = null;
    this._build();
  }

  _build() {
    this._btns = [
      new Button(490, 365, 300, 70, 'PLAY!',    { color: '#27AE60', hover: '#2ECC71', emoji: '▶', font: 'bold 30px "Segoe UI",sans-serif' }),
      new Button(490, 452, 300, 62, 'Stickers', { color: '#8E44AD', hover: '#9B59B6', emoji: '⭐', font: 'bold 26px "Segoe UI",sans-serif' }),
      new Button(490, 530, 300, 62, 'Settings', { color: '#2C3E50', hover: '#34495E', emoji: '⚙',  font: 'bold 26px "Segoe UI",sans-serif' }),
    ];
    this._muteBtn = new Button(1170, 20, 90, 50, '🔊', {
      color: '#333366', hover: '#4444aa', radius: 16, font: '26px serif',
    });
  }

  enter() {
    this.t = 0;
    this._muteBtn.label = this.game.audio.muted ? '🔇' : '🔊';
    this.game.input.on('click', p => this._onClick(p));
    this.game.input.on('move',  p => this._onMove(p));
  }

  exit() {}

  _onClick(p) {
    this.game.audio.resume();
    this.game.audio.playClick();
    if (this._btns[0].contains(p.x, p.y)) { this.game.setScene('game');     return; }
    if (this._btns[1].contains(p.x, p.y)) { this.game.setScene('sticker');  return; }
    if (this._btns[2].contains(p.x, p.y)) { this.game.setScene('settings'); return; }
    if (this._muteBtn.contains(p.x, p.y)) {
      const m = this.game.audio.toggleMute();
      this._muteBtn.label = m ? '🔇' : '🔊';
    }
  }

  _onMove(p) {
    [...this._btns, this._muteBtn].forEach(b => {
      b.hovered = b.contains(p.x, p.y);
      b.scale   = b.hovered ? 1.06 : 1;
    });
  }

  update(dt) {
    this.t += dt;
    this._floaters.forEach(f => f.update(dt));
  }

  draw(ctx) {
    drawBackground(ctx, this.t);
    this._floaters.forEach(f => f.draw(ctx));

    // Title panel
    setShadow(ctx, 30, 'rgba(0,0,0,0.45)', 0, 8);
    fillRoundRect(ctx, 200, 115, 880, 220, 32, 'rgba(20,10,60,0.78)');
    clearShadow(ctx);

    // Rainbow animated title
    const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8','#FFB347'];
    const chars  = '🌟 Animal Alphabet Adventure 🌟'.split('');
    ctx.font = 'bold 72px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let fullW = 0;
    for (const c of chars) fullW += ctx.measureText(c).width;
    let cx = 640 - fullW / 2;
    chars.forEach((c, i) => {
      const cw = ctx.measureText(c).width;
      setShadow(ctx, 10, 'rgba(0,0,0,0.5)', 0, 3);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fillText(c, cx, 210 + Math.sin(this.t * 2.5 + i * 0.45) * 9);
      clearShadow(ctx);
      cx += cw;
    });

    text(ctx, 'Learn letters with friendly animals!', 640, 298,
      { font: '26px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.82)', shadow: 'rgba(0,0,0,0.5)' });

    // Player greeting
    const name = this.game.playerName;
    if (name) {
      text(ctx, `👤 Hi, ${truncate(name, 14)}!`, 640, 337,
        { font: 'bold 22px "Segoe UI", sans-serif', color: '#FFD93D', shadow: 'rgba(0,0,0,0.5)' });
    }

    // Stars summary below title panel
    const stars = this.game.stars;
    fillRoundRect(ctx, 452, 614, 376, 44, 14, 'rgba(0,0,0,0.45)');
    for (let i = 0; i < Math.min(stars % 10 || (stars > 0 ? 10 : 0), 10); i++) {
      drawStar(ctx, 465 + i * 30, 636, 10, '#FFD700');
    }
    text(ctx, `${stars} star${stars !== 1 ? 's' : ''} total`, 780, 636,
      { font: 'bold 19px "Segoe UI", sans-serif', color: '#FFD700', align: 'left' });

    this._btns.forEach(b => b.draw(ctx));

    this._muteBtn.label = this.game.audio.muted ? '🔇' : '🔊';
    this._muteBtn.draw(ctx);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export class SettingsScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._floaters = Array.from({ length: 6 }, () => new FloatingAnimal());
    this._backBtn  = new Button(40, 20, 140, 52, '← Back',   { color: '#444488', hover: '#6666bb', radius: 18 });
    this._muteBtn  = null; // rebuilt in enter() so label is always current
    this._nameBtn  = new Button(490, 360, 300, 62, '✏️  Change Name',   { color: '#2980B9', hover: '#3498DB', radius: 20 });
    this._clearBtn = new Button(490, 442, 300, 62, '🗑️  Clear Progress', { color: '#922B21', hover: '#C0392B', radius: 20 });
    this._confirmYes = new Button(490, 528, 142, 50, 'Yes, reset',  { color: '#922B21', hover: '#C0392B', radius: 14, font: 'bold 20px "Segoe UI",sans-serif' });
    this._confirmNo  = new Button(648, 528, 142, 50, 'Cancel',      { color: '#27AE60', hover: '#2ECC71', radius: 14, font: 'bold 20px "Segoe UI",sans-serif' });
    this._confirmMode = false;
    this._clearedTimer = 0;  // > 0 while showing "Progress cleared!" message
  }

  enter() {
    this.t = 0;
    this._confirmMode  = false;
    this._clearedTimer = 0;
    this._muteBtn = new Button(490, 278, 300, 62,
      this.game.audio.muted ? '🔇  Sound: OFF' : '🔊  Sound: ON',
      { color: '#6C3483', hover: '#8E44AD', radius: 20 },
    );
    this.game.input.on('click', p => this._onClick(p));
    this.game.input.on('move',  p => this._onMove(p));
  }

  exit() {}

  _onClick(p) {
    this.game.audio.resume();
    this.game.audio.playClick();

    if (this._backBtn.contains(p.x, p.y)) { this.game.setScene('menu'); return; }

    if (this._confirmMode) {
      if (this._confirmYes.contains(p.x, p.y)) {
        this.game.clearProgress();
        this._confirmMode  = false;
        this._clearedTimer = 3;
      } else if (this._confirmNo.contains(p.x, p.y)) {
        this._confirmMode = false;
      }
      return;
    }

    if (this._muteBtn.contains(p.x, p.y)) {
      const m = this.game.audio.toggleMute();
      this._muteBtn.label = m ? '🔇  Sound: OFF' : '🔊  Sound: ON';
      return;
    }
    if (this._nameBtn.contains(p.x, p.y)) {
      this.game._scenes.nameEntry.returnTo = 'settings';
      this.game.setScene('nameEntry');
      return;
    }
    if (this._clearBtn.contains(p.x, p.y)) {
      this._confirmMode = true;
      return;
    }
  }

  _onMove(p) {
    const btns = [this._backBtn, this._muteBtn, this._nameBtn, this._clearBtn];
    if (this._confirmMode) btns.push(this._confirmYes, this._confirmNo);
    btns.forEach(b => {
      if (!b) return;
      b.hovered = b.contains(p.x, p.y);
      b.scale   = b.hovered ? 1.05 : 1;
    });
  }

  update(dt) {
    this.t += dt;
    this._floaters.forEach(f => f.update(dt));
    if (this._clearedTimer > 0) this._clearedTimer -= dt;
  }

  draw(ctx) {
    drawBackground(ctx, this.t);
    this._floaters.forEach(f => f.draw(ctx));

    setShadow(ctx, 22, 'rgba(0,0,0,0.45)', 0, 7);
    fillRoundRect(ctx, 290, 90, 700, 530, 32, 'rgba(12,8,45,0.90)');
    clearShadow(ctx);
    strokeRoundRect(ctx, 290, 90, 700, 530, 32, '#9B59B6', 3);

    text(ctx, '⚙️  Settings', 640, 148,
      { font: 'bold 46px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    // Player info row
    const name = this.game.playerName || '—';
    fillRoundRect(ctx, 440, 192, 400, 42, 12, 'rgba(255,255,255,0.07)');
    text(ctx, `👤  ${truncate(name, 18)}`, 640, 213,
      { font: 'bold 20px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.75)' });

    // Stats row
    const stars   = this.game.stars;
    const correct = this.game.correctCount;
    fillRoundRect(ctx, 340, 240, 600, 28, 10, 'rgba(255,255,255,0.05)');
    text(ctx, `⭐ ${stars} stars   ·   ✅ ${correct} correct answers`, 640, 254,
      { font: '18px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.5)' });

    this._muteBtn?.draw(ctx);
    this._nameBtn.draw(ctx);
    this._clearBtn.draw(ctx);

    // Confirm overlay
    if (this._confirmMode) {
      fillRoundRect(ctx, 310, 510, 660, 110, 18, 'rgba(0,0,0,0.80)');
      strokeRoundRect(ctx, 310, 510, 660, 110, 18, '#C0392B', 2);
      text(ctx, 'This resets ALL your stars and stickers. Are you sure?', 640, 530,
        { font: 'bold 18px "Segoe UI", sans-serif', color: '#FF6B6B' });
      this._confirmYes.draw(ctx);
      this._confirmNo.draw(ctx);
    }

    // Cleared success message
    if (this._clearedTimer > 0) {
      const alpha = Math.min(this._clearedTimer, 1);
      ctx.globalAlpha = alpha;
      text(ctx, '✓  Progress cleared!', 640, 598,
        { font: 'bold 22px "Segoe UI", sans-serif', color: '#6BCB77' });
      ctx.globalAlpha = 1;
    }

    this._backBtn.draw(ctx);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STICKER SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export class StickerScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._backBtn = new Button(40, 20, 140, 52, '← Back', { color: '#555599', hover: '#7777cc', radius: 18 });
  }
  enter() {
    this.t = 0;
    this.game.input.on('click', p => { if (this._backBtn.contains(p.x, p.y)) { this.game.audio.playClick(); this.game.setScene('menu'); } });
    this.game.input.on('move',  p => { this._backBtn.hovered = this._backBtn.contains(p.x, p.y); this._backBtn.scale = this._backBtn.hovered ? 1.05 : 1; });
  }
  exit() {}
  update(dt) { this.t += dt; }
  draw(ctx) {
    drawBackground(ctx, this.t);
    setShadow(ctx, 20, 'rgba(0,0,0,0.4)', 0, 6);
    fillRoundRect(ctx, 80, 10, 1120, 700, 28, 'rgba(12,8,45,0.85)');
    clearShadow(ctx);

    text(ctx, '🌟  My Sticker Collection  🌟', 640, 62,
      { font: 'bold 42px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    const unlocked = this.game.unlockedStickers;
    text(ctx, `${unlocked.length} / ${ANIMALS.length} stickers collected`, 640, 108,
      { font: '22px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.65)' });

    const cols = 5, cw = 185, ch = 168;
    const startX = 640 - (cols * cw) / 2 + cw / 2;
    const startY = 170;

    ANIMALS.forEach((animal, idx) => {
      const col   = idx % cols;
      const row   = Math.floor(idx / cols);
      const ax    = startX + col * cw;
      const ay    = startY + row * ch;
      const owned = unlocked.includes(animal.letter);
      const bounce = owned ? Math.sin(this.t * 2 + idx * 0.7) * 4 : 0;

      ctx.save();
      ctx.translate(ax, ay + bounce);

      if (owned) {
        setShadow(ctx, 14, `${animal.color}88`, 0, 4);
        fillRoundRect(ctx, -60, -68, 120, 130, 18, animal.bg);
        clearShadow(ctx);
        strokeRoundRect(ctx, -60, -68, 120, 130, 18, animal.color, 3);
        ctx.font = '56px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(animal.emoji, 0, -18);
        text(ctx, animal.name, 0, 38, { font: 'bold 14px "Segoe UI",sans-serif', color: animal.color });
        text(ctx, animal.letter, 0, 56, { font: 'bold 18px "Segoe UI",sans-serif', color: 'rgba(0,0,0,0.45)' });
      } else {
        fillRoundRect(ctx, -60, -68, 120, 130, 18, 'rgba(255,255,255,0.05)');
        strokeRoundRect(ctx, -60, -68, 120, 130, 18, 'rgba(255,255,255,0.12)', 2);
        ctx.globalAlpha = 0.10;
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(animal.emoji, 0, -18);
        ctx.globalAlpha = 1;
        text(ctx, '?', 0, -18, { font: 'bold 46px "Segoe UI",sans-serif', color: 'rgba(255,255,255,0.18)' });
        text(ctx, animal.letter, 0, 48, { font: 'bold 20px "Segoe UI",sans-serif', color: 'rgba(255,255,255,0.18)' });
      }
      ctx.restore();
    });

    this._backBtn.draw(ctx);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME SCENE — internal classes
// ═══════════════════════════════════════════════════════════════════════════════

const ENCOURAGEMENT = ['Amazing!','Wonderful!','You got it!','Fantastic!','Brilliant!','Super!','Great job!'];
const TRY_AGAIN     = ["Let's try again!", 'Keep trying!', 'You can do it!'];

class AnimalCard {
  constructor(animal, cx, cy, w, h) {
    this.animal = animal;
    this.cx = cx; this.cy = cy; this.w = w; this.h = h;
    this.scale     = 0;
    this.offsetY   = 60;
    this.alpha     = 0;
    this.state     = 'entering';
    this.animT     = 0;
    this.hovered   = false;
    this.shakeX    = 0;
    this.glowAlpha = 0;
  }
  get x() { return this.cx - this.w / 2; }
  get y() { return this.cy - this.h / 2; }
  contains(px, py) {
    if (this.state === 'disabled' || this.state === 'entering') return false;
    const hw = this.w / 2 * this.scale, hh = this.h / 2 * this.scale;
    return Math.abs(px - this.cx) < hw && Math.abs(py - (this.cy + this.offsetY)) < hh;
  }
  update(dt) {
    this.animT += dt;
    if (this.state === 'entering') {
      const p = Math.min(this.animT / 0.45, 1);
      this.scale   = easeOutBounce(p);
      this.offsetY = (1 - p) * 60;
      this.alpha   = Math.min(this.animT / 0.25, 1);
      if (p >= 1) { this.state = 'idle'; this.animT = 0; }
    }
    if (this.state === 'idle' || this.state === 'disabled') {
      const target = (this.hovered && this.state === 'idle') ? 1.08 : 1.0;
      this.scale     = lerp(this.scale, target, Math.min(dt * 12, 1));
      this.glowAlpha = lerp(this.glowAlpha, this.hovered ? 1 : 0, dt * 10);
    }
    if (this.state === 'correct') {
      const kf = [0, 0.1, 0.25, 0.4, 0.55];
      const ks = [1.0, 1.3, 1.1, 1.25, 1.0];
      const ko = [0, -40, -20, -35, 0];
      const p  = Math.min(this.animT / 0.6, 1);
      for (let i = 0; i < kf.length - 1; i++) {
        if (p >= kf[i] && p <= kf[i + 1]) {
          const lt = (p - kf[i]) / (kf[i + 1] - kf[i]);
          this.scale   = lerp(ks[i], ks[i + 1], easeOut(lt));
          this.offsetY = lerp(ko[i], ko[i + 1], easeOut(lt));
          break;
        }
      }
      this.glowAlpha = 1;
      if (p >= 1) { this.state = 'disabled'; this.scale = 1; this.offsetY = 0; this.animT = 0; }
    }
    if (this.state === 'wrong') {
      const seq = [0, -22, 18, -14, 10, -6, 0];
      const dur = 0.45;
      const p   = Math.min(this.animT / dur, 1);
      const seg = 1 / (seq.length - 1);
      const idx = Math.floor(p / seg);
      const lt  = (p - idx * seg) / seg;
      this.shakeX = lerp(seq[Math.min(idx, seq.length - 2)], seq[Math.min(idx + 1, seq.length - 1)], lt);
      if (p >= 1) { this.state = 'disabled'; this.shakeX = 0; this.animT = 0; }
    }
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    const { cx, cy, w, h, scale, offsetY, alpha, shakeX } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + shakeX, cy + offsetY);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    if (this.glowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha * this.glowAlpha * 0.35;
      setShadow(ctx, 28, this.state === 'correct' ? '#FFD700' : '#ffffff', 0, 0);
      fillRoundRect(ctx, -8, -8, w + 16, h + 16, 28, 'transparent');
      clearShadow(ctx);
      ctx.restore();
    }

    setShadow(ctx, 18, 'rgba(0,0,0,0.4)', 0, 6);
    fillRoundRect(ctx, 0, 0, w, h, 22, this.animal.bg);
    clearShadow(ctx);

    const border = this.state === 'correct' ? '#FFD700' : this.hovered ? this.animal.color : `${this.animal.color}88`;
    strokeRoundRect(ctx, 0, 0, w, h, 22, border, this.state === 'correct' ? 5 : 3);

    if (this.state === 'correct') {
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      grd.addColorStop(0, 'rgba(255,215,0,0.3)');
      grd.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = grd;
      roundRect(ctx, 0, 0, w, h, 22);
      ctx.fill();
    }

    const fontSize = Math.min(w, h) * 0.47;
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = (this.state === 'disabled' && this.state !== 'correct') ? alpha * 0.55 : alpha;
    ctx.fillText(this.animal.emoji, w / 2, h * 0.42);
    ctx.globalAlpha = alpha;

    const nfs = Math.max(17, Math.min(w * 0.125, 27));
    ctx.font = `bold ${nfs}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setShadow(ctx, 3, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = this.animal.color;
    ctx.fillText(this.animal.name, w / 2, h * 0.80);
    clearShadow(ctx);

    ctx.font = `bold ${nfs * 1.1}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffffff';
    setShadow(ctx, 4, 'rgba(0,0,0,0.4)', 0, 2);
    ctx.fillText(this.animal.letter, w / 2, h * 0.92);
    clearShadow(ctx);

    ctx.restore();
  }
}

class FlyingStar {
  constructor(fromX, fromY, toX, toY) {
    this.x = fromX; this.y = fromY;
    this.tx = toX;  this.ty = toY;
    this.t = 0; this.done = false;
  }
  update(dt) {
    this.t = Math.min(this.t + dt * 2.2, 1);
    this.x = lerp(this.x, this.tx, dt * 5.5);
    this.y = lerp(this.y, this.ty, dt * 5.5);
    if (this.t >= 1) this.done = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = 1 - this.t * 0.3;
    const s = 1 + Math.sin(this.t * Math.PI) * 0.6;
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    drawStar(ctx, 0, 0, 18, '#FFD700');
    ctx.restore();
  }
}

class RoundPopup {
  constructor(title, sub, emoji, onContinue) {
    this.title = title; this.sub = sub; this.emoji = emoji;
    this.onContinue = onContinue;
    this.alpha = 0; this.scale = 0.5; this.t = 0;
    this.confetti = spawnConfetti(640, 360, 80);
    this._btn = new Button(490, 540, 300, 60, 'Continue!',
      { color: '#27AE60', hover: '#2ECC71', emoji: '▶', font: 'bold 24px "Segoe UI",sans-serif' });
  }
  contains(px, py)    { return this._btn.contains(px, py); }
  hoverBtn(px, py)    { this._btn.hovered = this._btn.contains(px, py); this._btn.scale = this._btn.hovered ? 1.06 : 1; }
  update(dt) {
    this.t += dt;
    this.alpha = Math.min(this.alpha + dt * 4, 1);
    this.scale = lerp(this.scale, 1, dt * 12);
    this.confetti.forEach(p => p.update(dt));
    this.confetti = this.confetti.filter(p => p.life > 0);
  }
  draw(ctx) {
    ctx.fillStyle = `rgba(0,0,0,${0.55 * this.alpha})`;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.translate(640, 360);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-640, -360);
    setShadow(ctx, 40, 'rgba(0,0,0,0.5)', 0, 10);
    fillRoundRect(ctx, 290, 130, 700, 460, 36, '#1a0d4a');
    clearShadow(ctx);
    strokeRoundRect(ctx, 290, 130, 700, 460, 36, '#9B59B6', 4);
    this.confetti.forEach(p => p.draw(ctx));
    ctx.font = '100px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 640, 255 + Math.sin(this.t * 3) * 8);
    setShadow(ctx, 10, 'rgba(0,0,0,0.5)');
    ctx.font = 'bold 50px "Segoe UI", sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(this.title, 640, 365);
    clearShadow(ctx);
    ctx.font = '27px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(this.sub, 640, 420);
    ctx.restore();
    this._btn.draw(ctx);
  }
}

// ─── GameScene ────────────────────────────────────────────────────────────────

export class GameScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._cards         = [];
    this._flyingStars   = [];
    this._confetti      = [];
    this._popup         = null;
    this._phase         = 'idle';
    this._cooldownTimer = 0;
    this._roundAnimal   = null;
    this._letterScale   = 0;
    this._letterBounce  = 0;
    this._promptAlpha   = 0;
    this._recentAnimals = [];
    this._muteBtn = null;
    this._backBtn = null;
    this._repeatBtn = null;
  }

  enter() {
    this.t = 0;
    this._muteBtn   = new Button(1170, 20, 90, 50, this.game.audio.muted ? '🔇' : '🔊',
      { color: '#333366', hover: '#4444aa', radius: 16, font: '26px serif' });
    this._backBtn   = new Button(20, 20, 130, 50, '← Menu',
      { color: '#444488', hover: '#6666bb', radius: 16, font: 'bold 19px "Segoe UI",sans-serif' });
    this._repeatBtn = new Button(560, 20, 160, 50, '🔈 Repeat',
      { color: '#2d5986', hover: '#3a70ab', radius: 16, font: 'bold 19px "Segoe UI",sans-serif' });

    this.game.input.on('click', p => this._onClick(p));
    this.game.input.on('move',  p => this._onMove(p));
    this._startRound();
  }

  exit() {}

  _startRound() {
    this._phase        = 'playing';
    this._letterScale  = 0;
    this._letterBounce = 0;
    this._promptAlpha  = 0;
    this._confetti     = [];

    const animal = pickRandom(this._recentAnimals);
    this._roundAnimal = animal;
    this._recentAnimals.push(animal.letter);
    if (this._recentAnimals.length > 8) this._recentAnimals.shift();

    const count   = this.game.choiceCount;
    const choices = getChoices(animal, count);
    this._cards   = this._buildCards(choices, count);

    setTimeout(() => {
      this.game.audio.resume();
      this.game.audio.speak(`Find the animal that starts with ${animal.letter}!`);
    }, 300);
  }

  _buildCards(choices, count) {
    const areaTop = 330, areaBot = 680;
    const cy = (areaTop + areaBot) / 2;
    let cardW, cardH, cols;
    if (count <= 2) { cardW = 260; cardH = 298; cols = 2; }
    else if (count === 3) { cardW = 240; cardH = 278; cols = 3; }
    else { cardW = 220; cardH = 258; cols = 4; }
    const gap = (this.game.W - cols * cardW) / (cols + 1);
    return choices.map((animal, i) => {
      const cx  = gap + cardW / 2 + i * (cardW + gap);
      const card = new AnimalCard(animal, cx, cy, cardW, cardH);
      card.animT = -i * 0.09;
      return card;
    });
  }

  _onClick(p) {
    this.game.audio.resume();

    if (this._popup) {
      this._popup.hoverBtn(p.x, p.y);
      if (this._popup.contains(p.x, p.y)) {
        this.game.audio.playClick();
        this._popup = null;
        this._startRound();
      }
      return;
    }

    if (this._muteBtn.contains(p.x, p.y)) {
      const m = this.game.audio.toggleMute();
      this._muteBtn.label = m ? '🔇' : '🔊';
      this.game.audio.playClick();
      return;
    }
    if (this._backBtn.contains(p.x, p.y)) {
      this.game.audio.playClick();
      this.game.setScene('menu');
      return;
    }
    if (this._repeatBtn.contains(p.x, p.y)) {
      this.game.audio.playClick();
      this.game.audio.speak(`Find the animal that starts with ${this._roundAnimal.letter}!`);
      return;
    }

    if (this._phase !== 'playing') return;
    for (const card of this._cards) {
      if (card.contains(p.x, p.y)) { this._handleChoice(card); return; }
    }
  }

  _onMove(p) {
    if (this._popup) { this._popup.hoverBtn(p.x, p.y); return; }
    [this._muteBtn, this._backBtn, this._repeatBtn].forEach(b => {
      if (!b) return;
      b.hovered = b.contains(p.x, p.y);
      b.scale   = b.hovered ? 1.05 : 1;
    });
    this._cards.forEach(c => { c.hovered = c.state === 'idle' && c.contains(p.x, p.y); });
  }

  _handleChoice(card) {
    this._phase = 'cooldown';
    const correct = card.animal.letter === this._roundAnimal.letter;

    if (correct) {
      card.state = 'correct'; card.animT = 0;
      this._cards.forEach(c => { if (c !== card) c.state = 'disabled'; });

      this.game.audio.playCorrect();
      const enc = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
      setTimeout(() => this.game.audio.speak(`${enc} ${card.animal.name}!`), 200);

      this._confetti = spawnConfetti(card.cx, card.cy, 50);
      this._flyingStars.push(new FlyingStar(card.cx, card.cy - 40, 600, 38));

      const milestone = this.game.addStar(card.animal);
      if (milestone) {
        setTimeout(() => {
          this.game.audio.playCelebration();
          this._popup = new RoundPopup(
            '🎉 10 Stars!',
            `You unlocked the ${card.animal.name} sticker!`,
            card.animal.emoji,
            () => this._startRound(),
          );
        }, 1200);
      } else {
        this._cooldownTimer = 1.6;
      }
    } else {
      card.state = 'wrong'; card.animT = 0;
      this.game.audio.playWrong();
      const msg = TRY_AGAIN[Math.floor(Math.random() * TRY_AGAIN.length)];
      setTimeout(() => this.game.audio.speak(msg), 100);
      setTimeout(() => { card.state = 'idle'; this._phase = 'playing'; }, 600);
    }
  }

  update(dt) {
    this.t += dt;
    this._cards.forEach(c => c.update(dt));
    this._flyingStars.forEach(s => s.update(dt));
    this._flyingStars = this._flyingStars.filter(s => !s.done);
    this._confetti.forEach(p => p.update(dt));
    this._confetti = this._confetti.filter(p => p.life > 0);
    this._popup?.update(dt);

    this._letterScale  = easeOutBounce(Math.min(this._letterScale + dt * 4, 1));
    this._letterBounce = Math.sin(this.t * 2.2) * 5;
    this._promptAlpha  = Math.min(this._promptAlpha + dt * 2.5, 1);

    if (this._phase === 'cooldown' && !this._popup) {
      this._cooldownTimer -= dt;
      if (this._cooldownTimer <= 0) this._startRound();
    }
  }

  draw(ctx) {
    drawBackground(ctx, this.t);
    this._drawTopBar(ctx);
    this._drawLetterBubble(ctx);
    this._drawPrompt(ctx);
    this._cards.forEach(c => c.draw(ctx));
    this._confetti.forEach(p => p.draw(ctx));
    this._flyingStars.forEach(s => s.draw(ctx));
    this._popup?.draw(ctx);
  }

  _drawTopBar(ctx) {
    fillRoundRect(ctx, 0, 0, 1280, 75, 0, 'rgba(0,0,0,0.38)');

    // Player name badge
    const name = truncate(this.game.playerName || 'Player', 12);
    fillRoundRect(ctx, 162, 14, 188, 42, 13, 'rgba(255,255,255,0.10)');
    text(ctx, `👤 ${name}`, 256, 35,
      { font: 'bold 18px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.88)' });

    // Star dots row
    const starsInCycle = this.game.stars % 10 || (this.game.stars > 0 ? 10 : 0);
    for (let i = 0; i < Math.min(starsInCycle, 10); i++) {
      const pulse = 1 + Math.sin(this.t * 3 + i * 0.5) * 0.08;
      ctx.save();
      ctx.translate(370 + i * 27, 38);
      ctx.scale(pulse, pulse);
      drawStar(ctx, 0, 0, 11, '#FFD700');
      ctx.restore();
    }

    text(ctx, `⭐ ${this.game.stars}`, 690, 38,
      { font: 'bold 24px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    // Difficulty badge
    const diff  = this.game.difficulty;
    const dcol  = diff === 'beginner' ? '#27AE60' : diff === 'intermediate' ? '#F39C12' : '#E74C3C';
    fillRoundRect(ctx, 730, 15, 138, 40, 12, `${dcol}40`);
    strokeRoundRect(ctx, 730, 15, 138, 40, 12, dcol, 2);
    text(ctx, diff.toUpperCase(), 799, 35,
      { font: 'bold 15px "Segoe UI", sans-serif', color: dcol });

    this._backBtn?.draw(ctx);
    this._repeatBtn?.draw(ctx);
    this._muteBtn?.draw(ctx);
  }

  _drawLetterBubble(ctx) {
    if (!this._roundAnimal) return;
    const letter = this._roundAnimal.letter;
    ctx.save();
    ctx.translate(640, 200 + this._letterBounce);
    ctx.scale(this._letterScale, this._letterScale);

    const glow = ctx.createRadialGradient(0, 0, 40, 0, 0, 95);
    glow.addColorStop(0, 'rgba(255,215,0,0.3)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 95, 0, Math.PI * 2); ctx.fill();

    setShadow(ctx, 20, 'rgba(0,0,0,0.35)', 0, 6);
    const bg = ctx.createRadialGradient(-20, -20, 10, 0, 0, 72);
    bg.addColorStop(0, '#ffe066'); bg.addColorStop(1, '#e6a800');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.fill();
    clearShadow(ctx);

    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();

    ctx.font = 'bold 90px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    setShadow(ctx, 6, 'rgba(0,0,0,0.3)', 0, 2);
    ctx.fillStyle = '#6b3800';
    ctx.fillText(letter, 0, 5);
    clearShadow(ctx);
    ctx.restore();
  }

  _drawPrompt(ctx) {
    if (!this._roundAnimal) return;
    ctx.save();
    ctx.globalAlpha = this._promptAlpha;
    const letter = this._roundAnimal.letter;

    setShadow(ctx, 16, 'rgba(0,0,0,0.5)', 0, 4);
    fillRoundRect(ctx, 220, 270, 840, 52, 18, 'rgba(0,0,30,0.55)');
    clearShadow(ctx);

    const prefix = 'Find the animal that starts with  "';
    const suffix = '"';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const pw = ctx.measureText(prefix).width;
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    const lw = ctx.measureText(letter).width;
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    const sw = ctx.measureText(suffix).width;
    const totalW = pw + lw + sw;
    let rx = 640 - totalW / 2;

    ctx.fillStyle = '#ffffff'; ctx.fillText(prefix, rx, 296); rx += pw;
    ctx.fillStyle = '#FFD93D'; ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillText(letter, rx, 296); rx += lw;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.fillText(suffix, rx, 296);

    ctx.restore();
  }
}
