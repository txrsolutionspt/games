'use strict';

const GRID = 48;

class Garden {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.placedItems = [];
    this.season = 0;
    this.timeOfDay = 0;
    this.dayTimer = 0;
    this.dayDuration = 120;
    this.treeOffsets = this._genTrees();
    this.cloudX = [];
    for (let i = 0; i < 3; i++) this.cloudX.push(Math.random() * this.W);
    this.grassBlades = this._genGrass();
    this.pathPoints = this._genPath();
    this.fireflies = this._genFireflies();
  }

  _genTrees() {
    const trees = [];
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      trees.push({
        x: 20 + Math.random() * (this.W - 40),
        y: 30 + Math.random() * (this.H * 0.4),
        size: 0.6 + Math.random() * 0.5,
        type: Math.floor(Math.random() * 3),
      });
    }
    return trees;
  }

  _genGrass() {
    const blades = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      blades.push({
        x: 10 + Math.random() * (this.W - 20),
        y: 30 + Math.random() * (this.H - 60),
        h: 6 + Math.random() * 10,
        lean: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return blades;
  }

  _genPath() {
    const pts = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      pts.push({
        x: (i / (n - 1)) * this.W * 0.8 + this.W * 0.1,
        y: this.H * 0.55 + (Math.random() - 0.5) * 40,
      });
    }
    return pts;
  }

  _genFireflies() {
    const ff = [];
    for (let i = 0; i < 14; i++) {
      ff.push({
        x: 20 + Math.random() * (this.W - 40),
        y: this.H * 0.15 + Math.random() * (this.H * 0.65),
        phase: Math.random() * Math.PI * 2,
        dir: Math.random() * Math.PI * 2,
        speed: 8 + Math.random() * 12,
      });
    }
    return ff;
  }

  resize(w, h) {
    this.W = w; this.H = h;
    this.canvas.width = w; this.canvas.height = h;
    this.treeOffsets = this._genTrees();
    this.grassBlades = this._genGrass();
    this.pathPoints = this._genPath();
    this.fireflies = this._genFireflies();
    this.cloudX = this.cloudX.map(() => Math.random() * w);
  }

  update(dt) {
    this.dayTimer += dt;
    if (this.dayTimer >= this.dayDuration) {
      this.dayTimer -= this.dayDuration;
    }
    this.timeOfDay = this.dayTimer / this.dayDuration;

    this.cloudX = this.cloudX.map(cx => {
      cx += dt * 8;
      return cx > this.W + 100 ? -100 : cx;
    });

    this.fireflies.forEach(ff => {
      ff.x += Math.cos(ff.dir) * ff.speed * dt;
      ff.y += Math.sin(ff.dir) * ff.speed * dt * 0.35;
      ff.dir += (Math.random() - 0.5) * 0.15;
      if (ff.x < 0) ff.x = this.W;
      if (ff.x > this.W) ff.x = 0;
      const minY = this.H * 0.12, maxY = this.H * 0.78;
      if (ff.y < minY) { ff.y = minY; ff.dir = Math.PI - ff.dir; }
      if (ff.y > maxY) { ff.y = maxY; ff.dir = Math.PI - ff.dir; }
    });
  }

  _goldenProgress() {
    const t = this.timeOfDay;
    if (t < 0.45 || t > 0.55) return 0;
    return t <= 0.5 ? (t - 0.45) / 0.05 : (0.55 - t) / 0.05;
  }

  get isGoldenHour() {
    return this.timeOfDay >= 0.45 && this.timeOfDay <= 0.55;
  }

  drawBackground(time) {
    const ctx = this.ctx;
    const pal = SEASONS[this.season].palette;
    const t = this.timeOfDay;

    // Sky gradient
    const sky1 = this._skyColor(t, pal.sky);
    const sky2 = this._lerpColor(sky1, pal.ground, 0.3);
    const grad = ctx.createLinearGradient(0, 0, 0, this.H * 0.5);
    grad.addColorStop(0, sky1);
    grad.addColorStop(1, sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Ground
    const gGrad = ctx.createLinearGradient(0, this.H * 0.3, 0, this.H);
    gGrad.addColorStop(0, pal.ground);
    gGrad.addColorStop(1, this._darken(pal.ground, 0.15));
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, this.H * 0.3, this.W, this.H);

    // Stone path
    this._drawPath(ctx);

    // Clouds
    if (t < 0.85) {
      ctx.globalAlpha = 0.7 * (1 - Math.max(0, (t - 0.7) * 5));
      this.cloudX.forEach((cx, i) => {
        this._drawCloud(ctx, cx, 20 + i * 18, 0.5 + i * 0.2);
      });
      ctx.globalAlpha = 1;
    }

    // Background trees
    this.treeOffsets.forEach(t2 => {
      this._drawTree(ctx, t2.x, t2.y, t2.size * 28, t2.type, pal);
    });

    // Grass blades
    ctx.strokeStyle = this._darken(pal.ground, 0.25);
    ctx.lineWidth = 1.2;
    this.grassBlades.forEach(b => {
      const sway = Math.sin(time * 0.5 + b.phase) * 0.08;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x + (b.lean + sway) * b.h * 4, b.y - b.h * 0.6, b.x + (b.lean + sway) * b.h * 8, b.y - b.h);
      ctx.stroke();
    });

    // Fireflies at dusk / night
    if (t > 0.6 || t < 0.12) {
      this._drawFireflies(ctx, time, t);
    }

    // Sun / Moon
    if (t < 0.5) {
      const sunX = this.W * 0.1 + t * 2 * (this.W * 0.8);
      const sunY = this.H * 0.25 - Math.sin(t * Math.PI) * this.H * 0.2;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe066';
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      const moonT = (t - 0.5) * 2;
      const moonX = this.W * 0.1 + moonT * (this.W * 0.8);
      const moonY = this.H * 0.2 - Math.sin(moonT * Math.PI) * this.H * 0.15;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e8d0';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Stars
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 20; i++) {
        const sx = (i * 137.5 * 3.7) % this.W;
        const sy = (i * 73.1) % (this.H * 0.35);
        ctx.globalAlpha = 0.4 + Math.sin(time + i) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Golden Hour warm overlay
    const gp = this._goldenProgress();
    if (gp > 0) {
      const cx = this.W / 2, cy = this.H * 0.45;
      const radius = Math.max(this.W, this.H) * 0.95;
      const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      vignette.addColorStop(0,   `rgba(255,200,80,${gp * 0.13})`);
      vignette.addColorStop(0.55,`rgba(255,140,40,${gp * 0.09})`);
      vignette.addColorStop(1,   `rgba(180,70,10,${gp * 0.18})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, this.W, this.H);

      ctx.save();
      ctx.globalAlpha = gp * 0.7;
      ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#e07820';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('✨ Golden Hour', 10, this.H - 28);
      ctx.restore();
    }
  }

  _drawFireflies(ctx, time, t) {
    let alpha = 0;
    if (t >= 0.62 && t < 0.92) alpha = Math.min(1, (t - 0.62) * 5.5);
    else if (t >= 0.92) alpha = Math.max(0, (1 - t) * 12);
    else if (t < 0.12) alpha = Math.min(0.75, (0.12 - t) * 8);
    if (alpha <= 0) return;

    ctx.save();
    this.fireflies.forEach(ff => {
      const pulse = (Math.sin(time * 1.8 + ff.phase) + 1) / 2;
      const a = alpha * pulse;
      if (a < 0.05) return;
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = '#ffffaa';
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = '#ffffdd';
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawPath(ctx) {
    if (this.pathPoints.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let i = 1; i < this.pathPoints.length - 1; i++) {
      const mid = { x: (this.pathPoints[i].x + this.pathPoints[i+1].x)/2, y: (this.pathPoints[i].y + this.pathPoints[i+1].y)/2 };
      ctx.quadraticCurveTo(this.pathPoints[i].x, this.pathPoints[i].y, mid.x, mid.y);
    }
    ctx.lineTo(this.pathPoints[this.pathPoints.length-1].x, this.pathPoints[this.pathPoints.length-1].y);
    ctx.lineWidth = 28;
    ctx.strokeStyle = 'rgba(210,190,165,0.7)';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 24;
    ctx.strokeStyle = 'rgba(230,215,195,0.6)';
    ctx.stroke();
  }

  _drawCloud(ctx, x, y, s) {
    ctx.fillStyle = '#fff';
    const r = 14 * s;
    [0, r, -r, r*0.6, -r*0.6].forEach((ox, i) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + (i < 3 ? 0 : -r*0.4), r * (i === 0 ? 1.1 : 0.75), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawTree(ctx, x, y, r, type, pal) {
    ctx.globalAlpha = 0.55;
    if (type === 0) {
      // Rounded tree
      ctx.fillStyle = this._darken(pal.ground, 0.3);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 1) {
      // Pine
      ctx.fillStyle = this._darken(pal.ground, 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x - r * 0.6, y + r * 0.5);
      ctx.lineTo(x + r * 0.6, y + r * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Blob tree
      ctx.fillStyle = this._darken(pal.ground, 0.28);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.3, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Trunk
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 4, y + r * 0.4, 8, r * 0.5);
    ctx.globalAlpha = 1;
  }

  drawItems(time) {
    const ctx = this.ctx;
    const sorted = [...this.placedItems].sort((a, b) => a.y - b.y);
    for (const item of sorted) {
      this._drawItem(ctx, item, time);
    }
  }

  _drawItem(ctx, item, time) {
    const def = this._findDef(item.itemId);
    if (!def) return;
    const x = item.x;
    const y = item.y;
    const sway = Math.sin(time * 0.7 + item.x * 0.05) * (def.id.includes('grass') ? 4 : 1);

    ctx.save();
    ctx.translate(x + sway, y);
    ctx.font = `${28 + (def.w > 1 ? 12 : 0)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Drop shadow
    ctx.globalAlpha = 0.2;
    ctx.filter = 'blur(3px)';
    ctx.fillText(def.emoji, 2, 4);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    ctx.fillText(def.emoji, 0, 0);
    ctx.restore();
  }

  drawPlacingGhost(ctx, x, y, itemDef, valid) {
    ctx.save();
    ctx.globalAlpha = valid ? 0.7 : 0.4;
    if (!valid) {
      ctx.filter = 'grayscale(1) sepia(1) hue-rotate(-30deg)';
    }
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(itemDef.emoji, x, y);
    ctx.restore();
  }

  canPlace(x, y, itemId) {
    if (x < 20 || x > this.W - 20 || y < 40 || y > this.H - 20) return false;
    const MIN_DIST = 38;
    return !this.placedItems.some(item => {
      const dx = item.x - x, dy = item.y - y;
      const existDef = this._findDef(item.itemId);
      const minD = (existDef && existDef.w > 1) ? MIN_DIST + 14 : MIN_DIST;
      return (dx * dx + dy * dy) < minD * minD;
    });
  }

  placeItem(x, y, itemId) {
    if (!this.canPlace(x, y, itemId)) return false;
    this.placedItems.push({ x, y, itemId, id: Date.now() + Math.random() });
    return true;
  }

  removeItemAt(x, y) {
    const idx = this.placedItems.findIndex(item => {
      return Math.abs(item.x - x) < 30 && Math.abs(item.y - y) < 30;
    });
    if (idx >= 0) {
      this.placedItems.splice(idx, 1);
      return true;
    }
    return false;
  }

  _findDef(id) {
    for (const cat of Object.values(ITEMS)) {
      const found = cat.find(i => i.id === id);
      if (found) return found;
    }
    return null;
  }

  _skyColor(t, base) {
    if (t < 0.2) return this._lerpColor('#1a1a3a', base, t * 5);
    if (t < 0.5) return base;
    if (t < 0.7) return this._lerpColor(base, '#ff9966', (t - 0.5) * 5);
    return this._lerpColor('#ff9966', '#1a1a3a', (t - 0.7) * (10/3));
  }

  _lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const pa = this._parseColor(a);
    const pb = this._parseColor(b);
    return `rgb(${Math.round(pa[0]+(pb[0]-pa[0])*t)},${Math.round(pa[1]+(pb[1]-pa[1])*t)},${Math.round(pa[2]+(pb[2]-pa[2])*t)})`;
  }

  _parseColor(c) {
    if (c.startsWith('#')) {
      return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
    }
    const m = c.match(/\d+/g);
    return m ? [+m[0], +m[1], +m[2]] : [0,0,0];
  }

  _darken(c, amt) {
    const p = this._parseColor(c);
    return `rgb(${Math.max(0,Math.round(p[0]-amt*255))},${Math.max(0,Math.round(p[1]-amt*255))},${Math.max(0,Math.round(p[2]-amt*255))})`;
  }

  serialize() {
    return this.placedItems.map(i => ({ x: i.x, y: i.y, itemId: i.itemId }));
  }

  loadItems(data) {
    this.placedItems = data.map(i => ({ ...i, id: Date.now() + Math.random() }));
  }
}
