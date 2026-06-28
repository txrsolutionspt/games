'use strict';

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, type) {
    const count = type === 'hearts' ? 5 : type === 'sparkle' ? 6 : type === 'leaves' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
      const speed = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        decay: 0.018 + Math.random() * 0.012,
        type,
        scale: 0.5 + Math.random() * 0.8,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  spawnSingle(x, y, type, vx = 0, vy = -1.2) {
    this.particles.push({
      x, y, vx, vy,
      life: 1,
      decay: 0.015,
      type,
      scale: 1,
      rot: 0,
      rotV: (Math.random() - 0.5) * 0.05,
    });
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04; // gravity
      p.life -= p.decay;
      p.rot += p.rotV;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${Math.round(14 * p.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let glyph;
      switch (p.type) {
        case 'hearts':   glyph = '❤️'; break;
        case 'sparkle':  glyph = '✨'; break;
        case 'leaves':   glyph = ['🍃','🌿','🍀'][Math.floor(p.rot * 3) % 3]; break;
        case 'yarn':     glyph = '🧶'; break;
        case 'gift':     glyph = '🎁'; break;
        case 'star':     glyph = '⭐'; break;
        default:         glyph = '✨';
      }
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    }
  }

  clear() { this.particles = []; }
}
