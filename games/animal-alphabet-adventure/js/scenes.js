import { ANIMALS, getChoices, pickRandom, shuffle } from './animals.js';
import {
  fillRoundRect, strokeRoundRect, roundRect, setShadow, clearShadow,
  text, drawStar, lerp, easeOut, easeOutBounce, hexToRgb, rgbStr,
} from './ui.js';

// ─── Shared background helpers ───────────────────────────────────────────────

const BG_STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * 1280,
  y: Math.random() * 400,
  r: Math.random() * 1.8 + 0.4,
  phase: Math.random() * Math.PI * 2,
  speed: Math.random() * 1.5 + 0.8,
}));

function drawBackground(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0b0a2e');
  grad.addColorStop(0.55, '#1a1455');
  grad.addColorStop(1, '#2e1d6e');
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
    this.x  = x;
    this.y  = y;
    this.vx = (Math.random() - 0.5) * 900;
    this.vy = -Math.random() * 650 - 150;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.w  = Math.random() * 14 + 6;
    this.h  = this.w * 0.45;
    this.rot = Math.random() * Math.PI * 2;
    this.rotS = (Math.random() - 0.5) * 12;
    this.life = 1.0;
    this.decay = 0.55 + Math.random() * 0.35;
  }

  update(dt) {
    this.vy += 1400 * dt;
    this.vx *= Math.pow(0.94, dt * 60);
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
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

// ─── Floating animals (menu decoration) ──────────────────────────────────────

class FloatingAnimal {
  constructor() { this._reset(true); }

  _reset(init = false) {
    this.x  = Math.random() * 1280;
    this.y  = init ? Math.random() * 720 : 750 + Math.random() * 100;
    this.vy = -(60 + Math.random() * 60);
    this.vx = (Math.random() - 0.5) * 30;
    this.size = 40 + Math.random() * 40;
    this.alpha = 0;
    this.targetAlpha = 0.35 + Math.random() * 0.25;
    this.emoji = ANIMALS[Math.floor(Math.random() * ANIMALS.length)].emoji;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.8 + Math.random() * 0.8;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.x += this.vx * dt + Math.sin(this.wobble) * 15 * dt;
    this.wobble += this.wobbleSpeed * dt;
    this.alpha = Math.min(this.alpha + dt * 0.4, this.targetAlpha);
    if (this.y < -100) this._reset();
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

// ─── Button helper ────────────────────────────────────────────────────────────

class Button {
  constructor(x, y, w, h, label, opts = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label;
    this.color  = opts.color  ?? '#5B2FE0';
    this.hover  = opts.hover  ?? '#7548F5';
    this.radius = opts.radius ?? 24;
    this.font   = opts.font   ?? 'bold 30px "Segoe UI", sans-serif';
    this.textColor = opts.textColor ?? '#ffffff';
    this.emoji  = opts.emoji  ?? null;
    this.hovered = false;
    this.scale = 1;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w &&
           py >= this.y && py <= this.y + this.h;
  }

  draw(ctx) {
    ctx.save();
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.w / 2, -this.h / 2);

    setShadow(ctx, 14, 'rgba(0,0,0,0.35)', 0, 5);
    fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.hovered ? this.hover : this.color);
    clearShadow(ctx);

    if (this.hovered) {
      strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(255,255,255,0.4)', 3);
    }

    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.textColor;
    const lx = this.emoji ? this.w / 2 + 18 : this.w / 2;
    ctx.fillText(this.label, lx, this.h / 2);
    if (this.emoji) {
      ctx.font = `${parseInt(this.font) + 2}px serif`;
      ctx.fillText(this.emoji, 42, this.h / 2);
    }

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export class LoadingScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.progress = 0;
    this._letters = 'ANIMAL ALPHABET ADVENTURE'.split('');
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
      this.game.setScene('menu');
    }
  }

  draw(ctx) {
    drawBackground(ctx, this.t);

    // Animated title letters
    const title = 'ANIMAL ALPHABET';
    const sub   = 'ADVENTURE';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleColors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8'];
    ctx.font = 'bold 72px "Segoe UI", sans-serif';
    const tw = ctx.measureText(title).width;
    let rx = 640 - tw / 2;
    for (const ch of title) {
      const w = ctx.measureText(ch).width;
      const bounce = Math.sin(this.t * 3 + rx * 0.05) * 8;
      const ci = Math.floor(rx / 30) % titleColors.length;
      setShadow(ctx, 8, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = titleColors[ci];
      ctx.fillText(ch, rx + w / 2, 280 + bounce);
      clearShadow(ctx);
      rx += w;
    }

    ctx.font = 'bold 52px "Segoe UI", sans-serif';
    const bounce2 = Math.sin(this.t * 2.5 + 1) * 6;
    setShadow(ctx, 8, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = '#FFD93D';
    ctx.fillText(sub, 640, 355 + bounce2);
    clearShadow(ctx);

    // Loading bar background
    const bx = 440, by = 430, bw = 400, bh = 22;
    fillRoundRect(ctx, bx, by, bw, bh, 11, 'rgba(255,255,255,0.15)');
    fillRoundRect(ctx, bx, by, bw * this.progress, bh, 11, '#FFD93D');
    strokeRoundRect(ctx, bx, by, bw, bh, 11, 'rgba(255,255,255,0.3)', 2);

    text(ctx, 'Loading…', 640, 470, { font: '22px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.7)' });
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
      new Button(490, 380, 300, 72, 'PLAY!',     { color: '#27AE60', hover: '#2ECC71', emoji: '▶' }),
      new Button(490, 475, 300, 72, 'Stickers',  { color: '#8E44AD', hover: '#9B59B6', emoji: '⭐' }),
    ];
    this._muteBtn = new Button(1170, 20, 90, 50, '', {
      color: '#333366', hover: '#4444aa', radius: 16,
    });
  }

  enter() {
    this.t = 0;
    const input = this.game.input;
    input.on('click', p => this._onClick(p));
    input.on('move',  p => this._onMove(p));
  }

  exit() {}

  _onClick(p) {
    this.game.audio.resume();
    this.game.audio.playClick();
    if (this._btns[0].contains(p.x, p.y)) { this.game.setScene('game'); return; }
    if (this._btns[1].contains(p.x, p.y)) { this.game.setScene('sticker'); return; }
    if (this._muteBtn.contains(p.x, p.y)) {
      const muted = this.game.audio.toggleMute();
      this._muteBtn.label = muted ? '🔇' : '🔊';
    }
  }

  _onMove(p) {
    [...this._btns, this._muteBtn].forEach(b => {
      b.hovered = b.contains(p.x, p.y);
      b.scale = b.hovered ? 1.06 : 1;
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
    setShadow(ctx, 30, 'rgba(0,0,0,0.4)', 0, 8);
    fillRoundRect(ctx, 200, 130, 880, 210, 32, 'rgba(20,10,60,0.75)');
    clearShadow(ctx);

    // Rainbow animated title
    const titleColors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8','#FFB347'];
    ctx.font = 'bold 76px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = '🌟 Animal Alphabet Adventure 🌟'.split('');
    let fullW = 0;
    for (const c of chars) fullW += ctx.measureText(c).width;
    let cx = 640 - fullW / 2;
    chars.forEach((c, i) => {
      const cw = ctx.measureText(c).width;
      const bounce = Math.sin(this.t * 2.5 + i * 0.45) * 9;
      const ci = i % titleColors.length;
      setShadow(ctx, 10, 'rgba(0,0,0,0.5)', 0, 3);
      ctx.fillStyle = titleColors[ci];
      ctx.fillText(c, cx + cw / 2, 220 + bounce);
      clearShadow(ctx);
      cx += cw;
    });

    text(ctx, 'Learn letters with friendly animals!', 640, 305,
      { font: '28px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.85)', shadow: 'rgba(0,0,0,0.5)' });

    // Stars display
    const stars = this.game.stars;
    fillRoundRect(ctx, 490, 330, 300, 40, 12, 'rgba(0,0,0,0.4)');
    drawStar(ctx, 515, 350, 13, '#FFD700');
    text(ctx, `${stars} star${stars !== 1 ? 's' : ''} collected!`, 660, 350,
      { font: 'bold 22px "Segoe UI", sans-serif', color: '#FFD700' });

    this._btns.forEach(b => b.draw(ctx));

    // Mute button
    this._muteBtn.label = this.game.audio.muted ? '🔇' : '🔊';
    this._muteBtn.font  = '26px serif';
    this._muteBtn.draw(ctx);
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
    this._hoveredIdx = -1;
  }

  enter() {
    this.t = 0;
    const input = this.game.input;
    input.on('click', p => this._onClick(p));
    input.on('move',  p => this._onMove(p));
  }

  exit() {}

  _onClick(p) {
    this.game.audio.playClick();
    if (this._backBtn.contains(p.x, p.y)) { this.game.setScene('menu'); }
  }

  _onMove(p) {
    this._backBtn.hovered = this._backBtn.contains(p.x, p.y);
    this._backBtn.scale = this._backBtn.hovered ? 1.05 : 1;
  }

  update(dt) { this.t += dt; }

  draw(ctx) {
    drawBackground(ctx, this.t);

    setShadow(ctx, 20, 'rgba(0,0,0,0.4)', 0, 6);
    fillRoundRect(ctx, 80, 10, 1120, 700, 28, 'rgba(15,10,50,0.82)');
    clearShadow(ctx);

    text(ctx, '🌟 My Sticker Collection 🌟', 640, 65,
      { font: 'bold 44px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    const unlocked = this.game.unlockedStickers;
    const total    = ANIMALS.length;

    text(ctx, `${unlocked.length} / ${total} stickers collected`, 640, 115,
      { font: '24px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.7)' });

    const cols = 5, rows = 3;
    const cw = 180, ch = 170;
    const startX = 640 - (cols * cw) / 2 + cw / 2;
    const startY = 175;

    ANIMALS.forEach((animal, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const ax  = startX + col * cw;
      const ay  = startY + row * ch;
      const owned = unlocked.includes(animal.letter);

      const bounce = owned ? Math.sin(this.t * 2 + idx * 0.7) * 4 : 0;

      ctx.save();
      ctx.translate(ax, ay + bounce);

      if (owned) {
        setShadow(ctx, 16, `${animal.color}88`, 0, 4);
        fillRoundRect(ctx, -60, -68, 120, 130, 18, animal.bg);
        clearShadow(ctx);
        strokeRoundRect(ctx, -60, -68, 120, 130, 18, animal.color, 3);
      } else {
        fillRoundRect(ctx, -60, -68, 120, 130, 18, 'rgba(255,255,255,0.06)');
        strokeRoundRect(ctx, -60, -68, 120, 130, 18, 'rgba(255,255,255,0.15)', 2);
      }

      if (owned) {
        ctx.font = '58px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        ctx.fillText(animal.emoji, 0, -18);
        text(ctx, animal.name, 0, 40,
          { font: 'bold 16px "Segoe UI", sans-serif', color: animal.color });
        text(ctx, animal.letter, 0, 58,
          { font: 'bold 20px "Segoe UI", sans-serif', color: 'rgba(0,0,0,0.5)' });
      } else {
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.12;
        ctx.fillText(animal.emoji, 0, -18);
        ctx.globalAlpha = 1;
        text(ctx, '?', 0, -18,
          { font: 'bold 48px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.2)' });
        text(ctx, animal.letter, 0, 48,
          { font: 'bold 22px "Segoe UI", sans-serif', color: 'rgba(255,255,255,0.2)' });
      }

      ctx.restore();
    });

    this._backBtn.draw(ctx);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME SCENE
// ═══════════════════════════════════════════════════════════════════════════════

const ENCOURAGEMENT = ['Amazing!','Wonderful!','You got it!','Fantastic!','Brilliant!','Super!','Great job!'];
const TRY_AGAIN     = ["Let's try again!", 'Keep trying!', 'You can do it!'];

class AnimalCard {
  constructor(animal, cx, cy, w, h) {
    this.animal = animal;
    this.cx = cx;
    this.cy = cy;
    this.w  = w;
    this.h  = h;
    this.scale    = 0;
    this.offsetY  = 60;
    this.alpha    = 0;
    this.state    = 'entering'; // entering|idle|hover|correct|wrong|disabled
    this.animT    = 0;
    this.hovered  = false;
    this.shakeX   = 0;
    this.glowAlpha = 0;
  }

  get x() { return this.cx - this.w / 2; }
  get y() { return this.cy - this.h / 2; }

  contains(px, py) {
    const s = this.state;
    if (s === 'disabled' || s === 'entering') return false;
    const hw = this.w / 2 * this.scale;
    const hh = this.h / 2 * this.scale;
    return Math.abs(px - this.cx) < hw && Math.abs(py - (this.cy + this.offsetY)) < hh;
  }

  update(dt) {
    this.animT += dt;

    if (this.state === 'entering') {
      const progress = Math.min(this.animT / 0.45, 1);
      const e = easeOutBounce(progress);
      this.scale   = e;
      this.offsetY = (1 - progress) * 60;
      this.alpha   = Math.min(this.animT / 0.25, 1);
      if (progress >= 1) { this.state = 'idle'; this.animT = 0; }
    }

    if (this.state === 'idle' || this.state === 'disabled') {
      const target = (this.hovered && this.state === 'idle') ? 1.08 : 1.0;
      this.scale   = lerp(this.scale, target, Math.min(dt * 12, 1));
      this.glowAlpha = lerp(this.glowAlpha, this.hovered ? 1 : 0, dt * 10);
    }

    if (this.state === 'correct') {
      const keyframes = [0, 0.1, 0.25, 0.4, 0.55];
      const scales    = [1.0, 1.3, 1.1, 1.25, 1.0];
      const offsets   = [0, -40, -20, -35, 0];
      const progress  = Math.min(this.animT / 0.6, 1);
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i] && progress <= keyframes[i + 1]) {
          const localT = (progress - keyframes[i]) / (keyframes[i + 1] - keyframes[i]);
          this.scale   = lerp(scales[i],  scales[i + 1],  easeOut(localT));
          this.offsetY = lerp(offsets[i], offsets[i + 1], easeOut(localT));
          break;
        }
      }
      this.glowAlpha = 1;
      if (progress >= 1) { this.state = 'disabled'; this.scale = 1; this.offsetY = 0; this.animT = 0; }
    }

    if (this.state === 'wrong') {
      const shakeSeq = [0, -22, 18, -14, 10, -6, 0];
      const dur = 0.45;
      const progress = Math.min(this.animT / dur, 1);
      const segLen = 1 / (shakeSeq.length - 1);
      const idx = Math.floor(progress / segLen);
      const localT = (progress - idx * segLen) / segLen;
      const a = shakeSeq[Math.min(idx, shakeSeq.length - 2)];
      const b = shakeSeq[Math.min(idx + 1, shakeSeq.length - 1)];
      this.shakeX = lerp(a, b, localT);
      if (progress >= 1) { this.state = 'disabled'; this.shakeX = 0; this.animT = 0; }
    }
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    const { cx, cy, w, h, scale, offsetY, alpha, shakeX } = this;
    const drawCX = cx + shakeX;
    const drawCY = cy + offsetY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(drawCX, drawCY);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // Glow for hover/correct
    if (this.glowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha * this.glowAlpha * 0.35;
      setShadow(ctx, 28, this.state === 'correct' ? '#FFD700' : '#ffffff', 0, 0);
      fillRoundRect(ctx, -8, -8, w + 16, h + 16, 28, 'transparent');
      clearShadow(ctx);
      ctx.restore();
    }

    // Card shadow
    setShadow(ctx, 18, 'rgba(0,0,0,0.4)', 0, 6);

    // Card body
    const { r, g, b } = hexToRgb(this.animal.bg);
    fillRoundRect(ctx, 0, 0, w, h, 22, this.animal.bg);
    clearShadow(ctx);

    // Card border
    const borderColor = (this.state === 'correct') ? '#FFD700'
                      : (this.hovered)             ? this.animal.color
                      : `${this.animal.color}88`;
    strokeRoundRect(ctx, 0, 0, w, h, 22, borderColor, this.state === 'correct' ? 5 : 3);

    // Correct glow overlay
    if (this.state === 'correct') {
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      grd.addColorStop(0, 'rgba(255,215,0,0.3)');
      grd.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = grd;
      roundRect(ctx, 0, 0, w, h, 22);
      ctx.fill();
    }

    // Emoji
    const fontSize = Math.min(w, h) * 0.48;
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = this.state === 'disabled' && this.state !== 'correct' ? alpha * 0.55 : alpha;
    ctx.fillText(this.animal.emoji, w / 2, h * 0.42);

    ctx.globalAlpha = alpha;

    // Name
    const nameFontSize = Math.max(18, Math.min(w * 0.13, 28));
    ctx.font = `bold ${nameFontSize}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setShadow(ctx, 3, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = this.animal.color;
    ctx.fillText(this.animal.name, w / 2, h * 0.80);
    clearShadow(ctx);

    // First letter badge
    ctx.font = `bold ${nameFontSize * 1.1}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffffff';
    setShadow(ctx, 4, 'rgba(0,0,0,0.4)', 0, 2);
    ctx.fillText(this.animal.letter, w / 2, h * 0.92);
    clearShadow(ctx);

    ctx.restore();
  }
}

// ─── Flying star animation ────────────────────────────────────────────────────

class FlyingStar {
  constructor(fromX, fromY, toX, toY) {
    this.x = fromX; this.y = fromY;
    this.tx = toX;  this.ty = toY;
    this.t = 0;
    this.done = false;
    this.size = 18;
  }

  update(dt) {
    this.t = Math.min(this.t + dt * 2.0, 1);
    const e = easeOut(this.t);
    this.x = lerp(this.x, this.tx, dt * 5);
    this.y = lerp(this.y, this.ty, dt * 5);
    if (this.t >= 1) this.done = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = 1 - this.t * 0.3;
    const scale = 1 + Math.sin(this.t * Math.PI) * 0.5;
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    drawStar(ctx, 0, 0, this.size, '#FFD700');
    ctx.restore();
  }
}

// ─── Popup overlay (celebration / 10-star milestone) ─────────────────────────

class Popup {
  constructor(title, sub, emoji, callback) {
    this.title = title;
    this.sub   = sub;
    this.emoji = emoji;
    this.cb    = callback;
    this.alpha = 0;
    this.scale = 0.5;
    this.t     = 0;
    this.confirmed = false;
    this.confetti  = spawnConfetti(640, 360, 80);
    this._btn = new Button(490, 540, 300, 60, 'Continue!',
      { color: '#27AE60', hover: '#2ECC71', emoji: '▶' });
  }

  contains(px, py) { return this._btn.contains(px, py); }
  hoverBtn(px, py)  { this._btn.hovered = this._btn.contains(px, py); this._btn.scale = this._btn.hovered ? 1.06 : 1; }

  update(dt) {
    this.t += dt;
    this.alpha = Math.min(this.alpha + dt * 4, 1);
    this.scale = lerp(this.scale, 1, dt * 12);
    this.confetti.forEach(p => p.update(dt));
    this.confetti = this.confetti.filter(p => p.life > 0);
  }

  draw(ctx) {
    // Dim overlay
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
    const bounce = Math.sin(this.t * 3) * 8;
    ctx.fillText(this.emoji, 640, 250 + bounce);

    setShadow(ctx, 10, 'rgba(0,0,0,0.5)');
    ctx.font = 'bold 52px "Segoe UI", sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(this.title, 640, 360);
    clearShadow(ctx);

    ctx.font = '28px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(this.sub, 640, 418);

    ctx.restore();

    this._btn.draw(ctx);
  }
}

// ─── Main GameScene ───────────────────────────────────────────────────────────

export class GameScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this._cards  = [];
    this._flyingStars = [];
    this._confetti    = [];
    this._popup       = null;
    this._phase       = 'idle'; // idle|playing|cooldown
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
    this._backBtn   = new Button(20,   20, 130, 50, '← Menu',
      { color: '#444488', hover: '#6666bb', radius: 16 });
    this._repeatBtn = new Button(560,  20, 160, 50, '🔈 Repeat',
      { color: '#2d5986', hover: '#3a70ab', radius: 16, font: 'bold 20px "Segoe UI",sans-serif' });

    const input = this.game.input;
    input.on('click', p => this._onClick(p));
    input.on('move',  p => this._onMove(p));

    this._startRound();
  }

  exit() {}

  _startRound() {
    this._phase = 'playing';
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

    this._cards = this._buildCards(choices, count);

    setTimeout(() => {
      this.game.audio.resume();
      this.game.audio.speak(`Find the animal that starts with ${animal.letter}!`);
    }, 300);
  }

  _buildCards(choices, count) {
    const W = this.game.W;
    const areaTop = 330, areaBot = 680;
    const areaH = areaBot - areaTop;

    let cardW, cardH, cols;
    if (count <= 2) {
      cardW = 260; cardH = 300; cols = 2;
    } else if (count === 3) {
      cardW = 240; cardH = 280; cols = 3;
    } else {
      cardW = 220; cardH = 260; cols = 4;
    }

    const gap = (W - cols * cardW) / (cols + 1);
    const cy  = areaTop + areaH / 2;

    return choices.map((animal, i) => {
      const col = i % cols;
      const cx  = gap + cardW / 2 + col * (cardW + gap);
      const card = new AnimalCard(animal, cx, cy, cardW, cardH);
      card.animT = -i * 0.09; // stagger entrance
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
      if (card.contains(p.x, p.y)) {
        this._handleChoice(card);
        return;
      }
    }
  }

  _onMove(p) {
    if (this._popup) {
      this._popup.hoverBtn(p.x, p.y);
      return;
    }
    [this._muteBtn, this._backBtn, this._repeatBtn].forEach(b => {
      if (b) { b.hovered = b.contains(p.x, p.y); b.scale = b.hovered ? 1.05 : 1; }
    });
    this._cards.forEach(c => {
      c.hovered = c.state === 'idle' && c.contains(p.x, p.y);
    });
  }

  _handleChoice(card) {
    this._phase = 'cooldown';
    const correct = card.animal.letter === this._roundAnimal.letter;

    if (correct) {
      card.state = 'correct';
      card.animT  = 0;
      this._cards.forEach(c => { if (c !== card) { c.state = 'disabled'; } });

      this.game.audio.playCorrect();
      const enc = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
      setTimeout(() => this.game.audio.speak(`${enc} ${card.animal.name}!`), 200);

      this._confetti = spawnConfetti(card.cx, card.cy, 50);
      this._flyingStars.push(new FlyingStar(card.cx, card.cy, 640, 42));

      const milestone = this.game.addStar(card.animal);

      if (milestone) {
        const sticker = ANIMALS.find(a => a.letter === card.animal.letter) ?? card.animal;
        setTimeout(() => {
          this.game.audio.playCelebration();
          this._popup = new Popup(
            '🎉 10 Stars!',
            `You unlocked the ${sticker.name} sticker!`,
            sticker.emoji,
            () => this._startRound(),
          );
        }, 1200);
      } else {
        this._cooldownTimer = 1.6;
      }
    } else {
      card.state = 'wrong';
      card.animT  = 0;
      this.game.audio.playWrong();
      const msg = TRY_AGAIN[Math.floor(Math.random() * TRY_AGAIN.length)];
      setTimeout(() => this.game.audio.speak(msg), 100);
      setTimeout(() => {
        card.state = 'idle';
        this._phase = 'playing';
      }, 600);
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

    // Letter entrance animation
    if (this._letterScale < 1) {
      this._letterScale = Math.min(this._letterScale + dt * 4, 1);
      this._letterScale = easeOutBounce(Math.min(this._letterScale, 1));
    }
    this._letterBounce = Math.sin(this.t * 2.2) * 5;
    this._promptAlpha  = Math.min(this._promptAlpha + dt * 2.5, 1);

    // Cooldown between rounds
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
    fillRoundRect(ctx, 0, 0, 1280, 75, 0, 'rgba(0,0,0,0.35)');

    // Stars counter
    const stars = this.game.stars;
    for (let i = 0; i < Math.min(stars % 10 || (stars > 0 ? 10 : 0), 10); i++) {
      const pulse = 1 + Math.sin(this.t * 3 + i * 0.5) * 0.08;
      ctx.save();
      ctx.translate(180 + i * 34, 38);
      ctx.scale(pulse, pulse);
      drawStar(ctx, 0, 0, 14, '#FFD700');
      ctx.restore();
    }

    text(ctx, `⭐ ${stars}`, 560, 38,
      { font: 'bold 26px "Segoe UI", sans-serif', color: '#FFD700', shadow: 'rgba(0,0,0,0.5)' });

    // Difficulty badge
    const diff = this.game.difficulty;
    const diffColor = diff === 'beginner' ? '#27AE60' : diff === 'intermediate' ? '#F39C12' : '#E74C3C';
    fillRoundRect(ctx, 620, 14, 140, 42, 12, `${diffColor}44`);
    strokeRoundRect(ctx, 620, 14, 140, 42, 12, diffColor, 2);
    text(ctx, diff.toUpperCase(), 690, 35,
      { font: 'bold 16px "Segoe UI", sans-serif', color: diffColor });

    this._backBtn?.draw(ctx);
    this._repeatBtn?.draw(ctx);
    this._muteBtn?.draw(ctx);
  }

  _drawLetterBubble(ctx) {
    if (!this._roundAnimal) return;
    const letter = this._roundAnimal.letter;
    const cx = 640, cy = 200;

    ctx.save();
    ctx.translate(cx, cy + this._letterBounce);
    ctx.scale(this._letterScale, this._letterScale);

    // Outer glow
    const glow = ctx.createRadialGradient(0, 0, 40, 0, 0, 95);
    glow.addColorStop(0, 'rgba(255,215,0,0.3)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.fill();

    // Bubble
    setShadow(ctx, 20, 'rgba(0,0,0,0.35)', 0, 6);
    const bubbleGrad = ctx.createRadialGradient(-20, -20, 10, 0, 0, 72);
    bubbleGrad.addColorStop(0, '#ffe066');
    bubbleGrad.addColorStop(1, '#e6a800');
    ctx.fillStyle = bubbleGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.fill();
    clearShadow(ctx);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.stroke();

    // Letter
    ctx.font = 'bold 90px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
    const full   = `Find the animal that starts with  "${letter}"`;

    setShadow(ctx, 16, 'rgba(0,0,0,0.5)', 0, 4);
    fillRoundRect(ctx, 220, 270, 840, 52, 18, 'rgba(0,0,30,0.55)');
    clearShadow(ctx);

    // Highlight the letter in orange
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const prefix = `Find the animal that starts with  "`;
    const suffix = `"`;
    const pw = ctx.measureText(prefix).width;
    const lw = ctx.measureText(letter).width;
    const totalW = pw + lw + ctx.measureText(suffix).width;
    let rx = 640 - totalW / 2;
    ctx.fillText(prefix, rx + pw / 2, 296);
    rx += pw;
    ctx.fillStyle = '#FFD93D';
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.fillText(letter, rx + lw / 2, 296);
    rx += lw;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.fillText(suffix, rx + ctx.measureText(suffix).width / 2, 296);

    ctx.restore();
  }
}
