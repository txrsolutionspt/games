'use strict';

const CAT_STATES = { ENTERING: 'entering', WANDERING: 'wandering', SITTING: 'sitting', PLAYING: 'playing', SLEEPING: 'sleeping', LEAVING: 'leaving', PETTING: 'petting' };

class Cat {
  constructor(def, canvasW, canvasH, moodBonus = 0) {
    this.def = def;
    this.id = def.id + '_' + Date.now();
    this.x = -60;
    this.y = 80 + Math.random() * (canvasH - 200);
    this.targetX = 80 + Math.random() * (canvasW - 160);
    this.targetY = 80 + Math.random() * (canvasH - 200);
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.state = CAT_STATES.ENTERING;
    this.mood = Math.min(1, 0.5 + Math.random() * 0.3 + moodBonus);
    this.stateTimer = 0;
    this.stateDuration = 3 + Math.random() * 4;
    this.thoughtTimer = 0;
    this.thought = null;
    this.thoughtDuration = 0;
    this.facing = 1;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.tailAngle = 0;
    this.tailDir = 1;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinking = false;
    this.blinkFrame = 0;
    this.isBirthday = false;
    this.birthdayAnnounced = false;
    this.petted = false;
    this.leftGift = false;
    this.visitDuration = 30 + Math.random() * 60;
    this.visitTimer = 0;
    this.speed = def.speed * (12 + Math.random() * 4);
    this.sitTarget = null;
    this.earWiggle = 0;
    this.purrAnim = 0;
    this.scale = 0.9 + Math.random() * 0.2;
  }

  update(dt, placedItems, particles) {
    const prevState = this.state;
    this.visitTimer += dt;
    this.stateTimer += dt;
    this.bobOffset += dt * 2;
    this.tailAngle += dt * 2 * this.tailDir;
    if (Math.abs(this.tailAngle) > 0.5) this.tailDir *= -1;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && !this.blinking) {
      this.blinking = true;
      this.blinkFrame = 0;
      this.blinkTimer = 2 + Math.random() * 5;
    }
    if (this.blinking) {
      this.blinkFrame += dt * 12;
      if (this.blinkFrame >= 4) { this.blinking = false; this.blinkFrame = 0; }
    }
    if (this.thoughtTimer > 0) {
      this.thoughtTimer -= dt;
      if (this.thoughtTimer <= 0) { this.thought = null; }
    }
    if (this.earWiggle > 0) this.earWiggle -= dt * 3;

    switch (this.state) {
      case CAT_STATES.ENTERING: this._moveToTarget(dt); if (this._nearTarget(30)) this._pickNewState(placedItems); break;
      case CAT_STATES.WANDERING: this._moveToTarget(dt); if (this._nearTarget(20)) this._pickNewState(placedItems); break;
      case CAT_STATES.SITTING: if (this.stateTimer >= this.stateDuration) this._pickNewState(placedItems); break;
      case CAT_STATES.PLAYING: if (this.stateTimer >= this.stateDuration) this._pickNewState(placedItems); if (Math.random() < 0.03) particles.spawn(this.x, this.y - 20, 'sparkle'); break;
      case CAT_STATES.SLEEPING: if (this.stateTimer >= this.stateDuration) { this.stateTimer = 0; this.stateDuration = 5 + Math.random() * 10; if (Math.random() < 0.3) this._pickNewState(placedItems); } break;
      case CAT_STATES.LEAVING: this._moveToTarget(dt); break;
      case CAT_STATES.PETTING: if (this.stateTimer >= 2) { this.state = CAT_STATES.SITTING; this.stateTimer = 0; } break;
    }

    if (this.visitTimer >= this.visitDuration && this.state !== CAT_STATES.LEAVING && this.state !== CAT_STATES.PETTING) {
      this._startLeaving();
    }

    if (this.mood > 0.7 && Math.random() < 0.003 && !this.thought) {
      const thoughts = this.def.thoughts;
      this._showThought(thoughts[Math.floor(Math.random() * thoughts.length)]);
    }

    // Confetti burst when a birthday cat finishes entering the garden
    if (!this.birthdayAnnounced && this.isBirthday && prevState === CAT_STATES.ENTERING && this.state !== CAT_STATES.ENTERING) {
      this.birthdayAnnounced = true;
      particles.spawn(this.x, this.y - 20, 'confetti');
      this._showThought('🎂 It\'s my birthday!', 3.5);
    }
  }

  _moveToTarget(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;
    const step = Math.min(this.speed * dt, dist);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.facing = dx > 0 ? 1 : -1;
  }

  _nearTarget(threshold) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }

  _pickNewState(placedItems) {
    this.stateTimer = 0;
    const rand = Math.random();

    const favItem = this._findFavItem(placedItems);
    if (favItem && rand < 0.5) {
      this.targetX = favItem.x + Math.random() * 20 - 10;
      this.targetY = favItem.y + Math.random() * 20 - 10;
      this.state = CAT_STATES.WANDERING;
      this.sitTarget = favItem;
      return;
    }

    if (rand < 0.3) {
      this.state = CAT_STATES.SITTING;
      this.stateDuration = 3 + Math.random() * 6;
    } else if (rand < 0.5) {
      this.state = CAT_STATES.PLAYING;
      this.stateDuration = 2 + Math.random() * 4;
    } else if (rand < 0.65) {
      this.state = CAT_STATES.SLEEPING;
      this.stateDuration = 5 + Math.random() * 8;
    } else {
      this.state = CAT_STATES.WANDERING;
      const margin = 60;
      this.targetX = margin + Math.random() * (this.canvasW - margin * 2);
      this.targetY = margin + Math.random() * (this.canvasH - margin * 2);
    }
    this.mood = Math.min(1, this.mood + 0.05);
  }

  _findFavItem(placedItems) {
    const fav = this.def.favItems;
    const matches = placedItems.filter(i => fav.includes(i.itemId));
    if (!matches.length) return null;
    return matches[Math.floor(Math.random() * matches.length)];
  }

  _startLeaving() {
    this.state = CAT_STATES.LEAVING;
    this.targetX = this.facing > 0 ? this.canvasW + 80 : -80;
    this.targetY = this.y;
    this.stateTimer = 0;
  }

  isGone() {
    return this.state === CAT_STATES.LEAVING && this._nearTarget(50) && (this.x < -50 || this.x > this.canvasW + 50);
  }

  pet(particles) {
    if (this.state === CAT_STATES.LEAVING) return false;
    this.mood = Math.min(1, this.mood + 0.2);
    this.petted = true;
    this.state = CAT_STATES.PETTING;
    this.stateTimer = 0;
    this.earWiggle = 1;
    particles.spawn(this.x, this.y - 24, 'hearts');
    this._showThought(['😻 Purrrr~','💕 Love this!','😽 Yes please!','❤️ My human!'][Math.floor(Math.random()*4)]);
    return true;
  }

  tryGift(particles, season = 0) {
    if (this.leftGift) return 0;
    const chance = this.isBirthday
      ? Math.min(1, this.def.giftChance * 1.5 * this.mood)
      : this.def.giftChance * this.mood;
    if (Math.random() < chance) {
      this.leftGift = true;
      const gifts = this.def.gifts;
      let amount = gifts[Math.floor(Math.random() * gifts.length)];
      const isFavSeason = this.def.favSeason === season;
      if (isFavSeason) amount = Math.ceil(amount * 1.5);
      if (this.isBirthday) amount = Math.ceil(amount * 2);
      particles.spawn(this.x, this.y - 24, this.isBirthday ? 'confetti' : 'yarn');
      const thought = this.isBirthday
        ? '🎂 Birthday gift for you!'
        : (isFavSeason ? '🎁 Favourite season gift!' : '🎁 A gift for you!');
      this._showThought(thought);
      return amount;
    }
    return 0;
  }

  _showThought(text, duration = 2.5) {
    this.thought = text;
    this.thoughtTimer = duration;
    this.thoughtDuration = duration;
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y + Math.sin(this.bobOffset) * (this.state === CAT_STATES.SLEEPING ? 0 : 1.5));
    const s = this.scale;
    const flip = this.facing < 0 ? -1 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip * s, s);

    this._drawBody(ctx);

    ctx.restore();

    if (this.thought) {
      this._drawThought(ctx, x, y);
    }
  }

  _drawBody(ctx) {
    const c = this.def.color;
    const dark = this._darken(c, 0.2);
    const light = this._lighten(c, 0.25);
    const sleeping = this.state === CAT_STATES.SLEEPING;
    const playing = this.state === CAT_STATES.PLAYING;

    // Tail
    ctx.save();
    const tailBase = playing ? this.tailAngle * 2 : this.tailAngle;
    ctx.translate(sleeping ? -8 : -16, sleeping ? 4 : 0);
    ctx.rotate(tailBase);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(8, -20, 2, -35);
    ctx.lineWidth = 5;
    ctx.strokeStyle = dark;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    if (sleeping) {
      // Curled sleeping body
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Head tucked in
      ctx.beginPath();
      ctx.arc(14, -4, 11, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();

      // Sleeping eyes (ZZZ line)
      ctx.beginPath();
      ctx.moveTo(8, -6); ctx.lineTo(20, -6);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#9ab';
      ctx.textAlign = 'center';
      ctx.fillText('z z', 22, -14);
    } else {
      // Standing body
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Stripes or markings
      if (this.def.markings === 'tabby') {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 6, -4); ctx.lineTo(i * 7, 12);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (this.def.markings === 'calico') {
        ctx.fillStyle = '#e85a2a';
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(-6, 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(7, 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (this.def.markings === 'tuxedo') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 6, 7, 8, 0, 0, Math.PI * 2);
        ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
      } else if (this.def.markings === 'bicolor') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-4, 4, 10, 8, -0.3, 0, Math.PI * 2);
        ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
      }

      // Legs
      ctx.fillStyle = c;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      const legBob = Math.sin(this.bobOffset * 3) * (this.state === CAT_STATES.WANDERING ? 2 : 0);
      [[-10, 12, legBob], [10, 12, -legBob]].forEach(([lx, ly, lb]) => {
        ctx.beginPath();
        ctx.roundRect(lx - 4, ly + lb, 7, 9, 3);
        ctx.fill(); ctx.stroke();
      });

      // Head
      ctx.beginPath();
      ctx.arc(0, -10, 14, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ears
      const ew = this.earWiggle;
      ctx.fillStyle = c;
      ctx.strokeStyle = dark;
      [['-1', -10, -22], ['1', 8, -22]].forEach(([sign, ex, ey]) => {
        const rot = (sign === '-1' ? -0.3 : 0.3) + (sign === '-1' ? -ew * 0.2 : ew * 0.2);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-5, 8); ctx.lineTo(0, -7); ctx.lineTo(5, 8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Inner ear
        ctx.fillStyle = this._lighten(c, 0.3);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-2, 6); ctx.lineTo(0, -3); ctx.lineTo(2, 6);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c;
        ctx.restore();
      });

      // Eyes
      const eyeY = -12;
      const isBlinking = this.blinking && this.blinkFrame > 1 && this.blinkFrame < 3;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      [-5, 5].forEach(ex => {
        if (isBlinking) {
          ctx.beginPath();
          ctx.moveTo(ex - 4, eyeY);
          ctx.lineTo(ex + 4, eyeY);
          ctx.lineWidth = 2;
          ctx.strokeStyle = dark;
          ctx.stroke();
          ctx.lineWidth = 1;
        } else {
          ctx.beginPath();
          ctx.arc(ex, eyeY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = this.def.traits.includes('shy') ? '#6a4a8a' : this.def.traits.includes('royal') ? '#c0a020' : '#2a6a3a';
          ctx.fill();
          ctx.strokeStyle = dark;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          // Pupil
          ctx.beginPath();
          ctx.arc(ex + 0.5, eyeY + 0.5, this.state === CAT_STATES.PLAYING ? 2.5 : 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#111';
          ctx.fill();
          // Catchlight
          ctx.beginPath();
          ctx.arc(ex + 1, eyeY - 1, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      });

      // Nose
      ctx.beginPath();
      ctx.arc(0, -8, 2, 0, Math.PI * 2);
      ctx.fillStyle = this.def.traits.includes('elegant') ? '#f9a8b8' : '#e87a60';
      ctx.fill();

      // Whiskers
      ctx.strokeStyle = light;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.7;
      [[-12, -8, -4, -9], [-14, -7, -4, -7], [-12, -6, -4, -5],
       [12, -8, 4, -9],   [14, -7, 4, -7],   [12, -6, 4, -5]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Playing animation — paw raised
      if (playing) {
        ctx.fillStyle = c;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const pawX = 16 + Math.sin(this.bobOffset * 4) * 4;
        const pawY = -6 + Math.cos(this.bobOffset * 4) * 6;
        ctx.arc(pawX, pawY, 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }

      // Party hat on birthday visits
      if (this.isBirthday) this._drawPartyHat(ctx);
    }
  }

  _drawPartyHat(ctx) {
    ctx.save();
    ctx.translate(0, -24);
    // Cone
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(7, 0);
    ctx.closePath();
    ctx.fillStyle = '#ff4466';
    ctx.fill();
    ctx.strokeStyle = '#cc2244';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Yellow stripes
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(-4.5, -6); ctx.lineTo(4.5, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2.5, -12); ctx.lineTo(2.5, -12); ctx.stroke();
    ctx.globalAlpha = 1;
    // Pompom
    ctx.beginPath();
    ctx.arc(0, -20, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd00';
    ctx.fill();
    ctx.restore();
  }

  _drawThought(ctx, x, y) {
    ctx.save();
    ctx.font = '13px sans-serif';
    const tw = ctx.measureText(this.thought).width;
    const bx = x - tw / 2 - 8;
    const by = y - 52;
    const bw = tw + 16;
    const bh = 26;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#e8d5c4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    // Tail of bubble
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bh);
    ctx.lineTo(x, by + bh + 8);
    ctx.lineTo(x + 6, by + bh);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.fillStyle = '#4a3728';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.thought, x, by + bh / 2);
    ctx.restore();
  }

  _darken(hex, amt) {
    return this._adjustColor(hex, -amt);
  }
  _lighten(hex, amt) {
    return this._adjustColor(hex, amt);
  }
  _adjustColor(hex, amt) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const clamp = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
}

class CatManager {
  constructor() {
    this.cats = [];
    this.spawnTimer = 0;
    this.spawnInterval = 18;
    this.maxCats = 5;
    this.seenCats = {};
    this.visitCounts = {};
  }

  update(dt, placedItems, particles, onYarn, canvasW, canvasH, zenMode, season = 0, onBirthday = null, moodBonus = 0, goldenHour = false) {
    if (zenMode) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.cats.length < this.maxCats) {
      this.spawnTimer = 0;
      const newCat = this._trySpawnCat(placedItems, canvasW, canvasH, season, moodBonus, goldenHour);
      if (newCat && newCat.isBirthday && onBirthday) onBirthday(newCat);
    }

    for (let i = this.cats.length - 1; i >= 0; i--) {
      const cat = this.cats[i];
      cat.update(dt, placedItems, particles);

      if (cat.state === CAT_STATES.LEAVING && !cat.leftGift) {
        const yarn = cat.tryGift(particles, season);
        if (yarn > 0) onYarn(yarn, cat);
      }

      if (cat.isGone()) {
        this.cats.splice(i, 1);
      }
    }
  }

  _trySpawnCat(placedItems, canvasW, canvasH, season = 0, moodBonus = 0, goldenHour = false) {
    const unlockedDefs = CAT_DEFS.filter(d => d.unlocked);
    if (!unlockedDefs.length) return null;

    const weights = unlockedDefs.map(def => {
      let w = def.rarity === 'common' ? 3 : def.rarity === 'uncommon' ? 2 : 1;
      if (this._isAttracted(def, placedItems)) w *= 2;
      if (goldenHour && def.rarity === 'rare') w *= 2;
      return w;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let chosen = unlockedDefs[0];
    for (let i = 0; i < unlockedDefs.length; i++) {
      rand -= weights[i];
      if (rand <= 0) { chosen = unlockedDefs[i]; break; }
    }

    if (this.cats.find(c => c.def.id === chosen.id)) return null;

    const cat = new Cat(chosen, canvasW, canvasH, moodBonus);
    if (chosen.birthday === season && Math.random() < 0.4) cat.isBirthday = true;
    this.cats.push(cat);
    this.seenCats[chosen.id] = true;
    this.visitCounts[chosen.id] = (this.visitCounts[chosen.id] || 0) + 1;
    return cat;
  }

  _isAttracted(def, placedItems) {
    return placedItems.some(pi => {
      const itemDef = this._findItemDef(pi.itemId);
      if (!itemDef) return false;
      const attracts = itemDef.attract;
      if (attracts.includes('all')) return true;
      return def.traits.some(t => attracts.includes(t));
    });
  }

  _findItemDef(id) {
    for (const cat of Object.values(ITEMS)) {
      const found = cat.find(i => i.id === id);
      if (found) return found;
    }
    return null;
  }

  getCatAt(x, y) {
    return this.cats.find(cat => {
      const dx = x - cat.x;
      const dy = y - cat.y;
      return Math.sqrt(dx * dx + dy * dy) < 24 * cat.scale;
    });
  }

  resize(w, h) {
    this.cats.forEach(c => { c.canvasW = w; c.canvasH = h; });
  }
}
