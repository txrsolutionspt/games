'use strict';

class Game {
  constructor() {
    this.canvas = document.getElementById('garden-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.yarn = 0;
    this.zenMode = false;
    this.soundEnabled = false;
    this.unlockedItems = new Set();
    this.particles = new ParticleSystem();
    this.ambience = new AmbienceSystem();
    this.catManager = new CatManager();
    this.garden = null;
    this.ui = null;
    this.lastTime = 0;
    this.time = 0;
    this.hintTimer = 0;
    this.hintInterval = 25;
    this.activePlayTime = 0;
    this.SEASON_PLAY_DURATION = 600;
    this.totalYarnEarned = 0;
    this.pettedCount = 0;
    this.birthdayPetsCount = 0;
    this.achievements = new Set();
    this.seasonChanges = 0;
    this.trophies = new Set();
    this.seasonYarn = 0;
    this.seasonStartVisits = 0;
    // Trophy passive bonuses (recomputed from this.trophies)
    this.giftBonus = 1.0;
    this.moodBonus = 0;
    this.offlineRewardBonus = 0;
    this.nicknames = {};
    this.visitLog = [];
    this.lastTreatTime = 0;
    this.ambienceMode = 0;
    this._hoveredCat = null;
    this._nameTagAlpha = 0;

    this._initUnlocks();
    this._resize();
    this.garden = new Garden(this.canvas);
    this.ui = new UI(this);
    this._bindInput();
    this._loadSave();
    this._loop(0);

    window.addEventListener('resize', () => this._resize());
    this._startOfflineReward();
  }

  _initUnlocks() {
    // Free items are always unlocked
    for (const cat of Object.values(ITEMS)) {
      cat.forEach(item => { if (item.cost === 0) this.unlockedItems.add(item.id); });
    }
  }

  _resize() {
    const main = document.getElementById('main-area');
    const w = main.clientWidth;
    const h = main.clientHeight;
    if (this.canvas) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (this.garden) this.garden.resize(w, h);
    if (this.catManager) this.catManager.resize(w, h);
  }

  _bindInput() {
    const canvas = this.canvas;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const src = (e.touches && e.touches.length) ? e.touches[0]
                : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
                : e;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top) * scaleY,
        _rect: rect, _scaleX: scaleX, _scaleY: scaleY,
      };
    };

    const _catTooltipText = (cat) => {
      const moodEmoji = cat.mood < 0.4 ? '😾' : cat.mood < 0.65 ? '😺' : cat.mood < 0.85 ? '😸' : '😻';
      const seasonBonus = cat.def.favSeason === this.garden.season ? ' ✨' : '';
      const bdTag = cat.isBirthday ? ' 🎂' : '';
      const stars = cat.def.rarity === 'rare' ? ' ⭐⭐⭐' : cat.def.rarity === 'uncommon' ? ' ⭐⭐' : ' ⭐';
      return `${this._catDisplayName(cat.def)} — ${cat.def.personality} ${moodEmoji}${seasonBonus}${bdTag}${stars}`;
    };

    const _petCat = (cat) => {
      const petted = cat.pet(this.particles);
      if (!petted) return;
      this.pettedCount++;
      navigator.vibrate?.([18]);
      canvas.className = 'petting';
      setTimeout(() => { if (!this.ui.selectedItem) canvas.className = ''; }, 1500);
      if (cat.isBirthday) this.birthdayPetsCount++;
      const yarn = cat.tryGift(this.particles, this.garden.season);
      if (yarn > 0) {
        const boosted = Math.ceil(yarn * this.giftBonus);
        this.yarn += boosted;
        this.totalYarnEarned += boosted;
        this.seasonYarn += boosted;
        this.ui.updateYarnDisplay();
        navigator.vibrate?.([25, 12, 25]);
        const msg = cat.isBirthday
          ? `🎂 ${this._catDisplayName(cat.def)}'s birthday gift: ${boosted}🧶!`
          : `${this._catDisplayName(cat.def)} left you ${boosted}🧶!`;
        this.ui.notify(msg);
        this.save();
      }
      this._checkAchievements();
    };

    let dragging = false;
    let dragItem = null;
    let ghostPos = null;
    let dragStart = null;
    const MIN_DRAG_PX = 18;

    // ── Mouse ────────────────────────────────────────────────────────
    const onDown = (e) => {
      e.preventDefault();
      const pos = getPos(e);

      if (this.ui.selectedItem) {
        dragging = true;
        dragItem = this.ui.selectedItem;
        ghostPos = { ...pos };
        dragStart = { ...pos };
        this._ghost = { active: true, item: dragItem, pos, valid: this.garden.canPlace(pos.x, pos.y, dragItem.id) };
        return;
      }

      const cat = this.catManager.getCatAt(pos.x, pos.y);
      if (cat) { _petCat(cat); return; }

      if (e.button === 2 || e.type === 'contextmenu') {
        e.preventDefault();
        const item = this.garden.getItemAt(pos.x, pos.y);
        if (item) {
          this._showItemMenu(pos, item);
        } else if (this.garden.placedItems.length) {
          this.garden.placedItems.pop();
          this.save();
          this.ui.notify('↩️ Last item removed');
        }
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      const pos = getPos(e);
      if (dragging && dragItem) {
        ghostPos = pos;
        this._ghost = { active: true, item: dragItem, pos, valid: this.garden.canPlace(pos.x, pos.y, dragItem.id) };
      }
      const el = document.getElementById('tooltip');
      if (!this.ui.selectedItem && !dragging) {
        const cat = this.catManager.getCatAt(pos.x, pos.y);
        if (cat) {
          this._hoveredCat = cat;
          el.style.display = 'block';
          const cssx = pos.x / pos._scaleX;
          const cssy = pos.y / pos._scaleY;
          const tw = el.offsetWidth || 160;
          el.style.left = Math.max(4, Math.min(cssx + 10, pos._rect.width - tw - 4)) + 'px';
          el.style.top  = Math.max(4, cssy - 30) + 'px';
          el.textContent = _catTooltipText(cat);
        } else {
          this._hoveredCat = null;
          el.style.display = 'none';
        }
      } else {
        this._hoveredCat = null;
        el.style.display = 'none';
      }
    };

    const onUp = (e) => {
      e.preventDefault();
      if (dragging && dragItem && ghostPos && dragStart) {
        const dx = ghostPos.x - dragStart.x;
        const dy = ghostPos.y - dragStart.y;
        if (Math.sqrt(dx*dx + dy*dy) >= MIN_DRAG_PX) {
          const valid = this.garden.canPlace(ghostPos.x, ghostPos.y, dragItem.id);
          if (valid) {
            const placed = this.garden.placeItem(ghostPos.x, ghostPos.y, dragItem.id);
            if (placed) {
              this.particles.spawn(ghostPos.x, ghostPos.y, 'sparkle');
              this.save();
              this._checkAchievements();
              this.ui.notify(`Placed ${dragItem.name}! Tap again to place more, or tap the item to deselect.`);
            }
          } else {
            this.ui.notify('Cannot place there');
          }
        }
      }
      dragging = false; dragItem = null; dragStart = null;
      this._ghost.active = !!this.ui.selectedItem;
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!touchActive) onDown(e); });

    this._ghost = { active: false, item: null, pos: null, valid: false };
    canvas.addEventListener('mousemove', (e) => {
      if (this.ui.selectedItem) {
        const pos = getPos(e);
        this._ghost = { active: true, item: this.ui.selectedItem, pos, valid: this.garden.canPlace(pos.x, pos.y, this.ui.selectedItem.id) };
      } else if (!dragging) {
        this._ghost.active = false;
      }
    });
    canvas.addEventListener('mouseleave', () => { this._ghost.active = false; this._hoveredCat = null; });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.ui.selectedItem = null;
        canvas.className = '';
        this.ui.renderShop();
        this.ui._showCancelBtn(false);
      }
    });

    // ── Touch ────────────────────────────────────────────────────────
    let lpTimer = null;    // 480 ms long-press → item context menu
    let infoTimer = null;  // 160 ms hold on cat → info label
    let lpStart = null;
    let lpFired = false;
    let infoShown = false;
    let touchCat = null;
    let touchActive = false;  // true while any finger is on the canvas

    const clearTouchTimers = () => { clearTimeout(lpTimer); clearTimeout(infoTimer); lpTimer = null; infoTimer = null; };

    const hideTouchLabel = () => {
      const el = document.getElementById('touch-label');
      if (el) { clearTimeout(el._hideTimer); el.style.display = 'none'; }
      infoShown = false;
    };

    const showTouchLabel = (cat, pos) => {
      const el = document.getElementById('touch-label');
      if (!el) return;
      el.textContent = _catTooltipText(cat);
      const rect = canvas.getBoundingClientRect();
      const cssx = pos.x / (canvas.width / rect.width);
      const cssy = pos.y / (canvas.height / rect.height);
      const tw = el.offsetWidth || 160;
      el.style.left = Math.max(4, Math.min(cssx - tw / 2, rect.width - tw - 4)) + 'px';
      el.style.top  = Math.max(4, cssy - 70) + 'px';
      el.style.display = 'block';
      infoShown = true;
      el._hideTimer = setTimeout(hideTouchLabel, 2000);
    };

    canvas.addEventListener('touchstart', e => {
      touchActive = true;
      e.preventDefault();
      clearTouchTimers();
      hideTouchLabel();
      lpFired = false; infoShown = false;
      lpStart = getPos(e);
      touchCat = this.catManager.getCatAt(lpStart.x, lpStart.y);

      // Item selected — start drag immediately with −64 px Y offset above finger
      if (this.ui.selectedItem) {
        dragging = true;
        dragItem = this.ui.selectedItem;
        const ty = lpStart.y - 64;
        ghostPos = { x: lpStart.x, y: ty };
        dragStart = { x: lpStart.x, y: ty };
        this._ghost = { active: true, item: dragItem, pos: ghostPos, valid: this.garden.canPlace(lpStart.x, ty, dragItem.id) };
        return;
      }

      // Cat under finger → 160 ms delay: lift=pet, hold=info label
      if (touchCat) {
        infoTimer = setTimeout(() => { infoShown = true; showTouchLabel(touchCat, lpStart); }, 160);
      }

      // Long-press → item context menu (480 ms)
      lpTimer = setTimeout(() => {
        lpFired = true;
        clearTimeout(infoTimer);
        hideTouchLabel();
        const item = this.garden.getItemAt(lpStart.x, lpStart.y);
        if (item) { this._showItemMenu(lpStart, item); navigator.vibrate?.([25]); }
      }, 480);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const pos = getPos(e);
      if (lpStart) {
        const dx = pos.x - lpStart.x, dy = pos.y - lpStart.y;
        if (Math.sqrt(dx*dx + dy*dy) > 8) { clearTouchTimers(); hideTouchLabel(); }
      }
      if (dragging && dragItem) {
        const ty = pos.y - 64;
        ghostPos = { x: pos.x, y: ty };
        this._ghost = { active: true, item: dragItem, pos: ghostPos, valid: this.garden.canPlace(pos.x, ty, dragItem.id) };
      } else if (this.ui.selectedItem) {
        const ty = pos.y - 64;
        this._ghost = { active: true, item: this.ui.selectedItem, pos: { x: pos.x, y: ty }, valid: this.garden.canPlace(pos.x, ty, this.ui.selectedItem.id) };
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      touchActive = false;
      e.preventDefault();
      clearTouchTimers();
      if (lpFired) { lpFired = false; return; }

      if (dragging && dragItem && ghostPos && dragStart) {
        const dx = ghostPos.x - dragStart.x, dy = ghostPos.y - dragStart.y;
        if (Math.sqrt(dx*dx + dy*dy) >= MIN_DRAG_PX) {
          const valid = this.garden.canPlace(ghostPos.x, ghostPos.y, dragItem.id);
          if (valid) {
            const placed = this.garden.placeItem(ghostPos.x, ghostPos.y, dragItem.id);
            if (placed) {
              this.particles.spawn(ghostPos.x, ghostPos.y, 'sparkle');
              this.save();
              this._checkAchievements();
              navigator.vibrate?.([12]);
              this.ui.notify(`Placed ${dragItem.name}! Tap again to place more, or tap the item to deselect.`);
            }
          } else {
            this.ui.notify('Cannot place there');
          }
        }
        dragging = false; dragItem = null; dragStart = null;
        this._ghost.active = !!this.ui.selectedItem;
        return;
      }
      dragging = false; dragItem = null; dragStart = null;

      if (infoShown) { hideTouchLabel(); return; }

      // Quick tap → pet cat
      const pos = getPos(e);
      const cat = this.catManager.getCatAt(pos.x, pos.y);
      if (cat) _petCat(cat);
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
      touchActive = false;
      clearTouchTimers();
      hideTouchLabel();
      lpFired = false; infoShown = false;
      dragging = false; dragItem = null; dragStart = null;
      this._ghost.active = !!this.ui.selectedItem;
    });
  }

  _loop(ts) {
    const dt = Math.min((ts - this.lastTime) / 1000, 0.1);
    this.lastTime = ts;
    this.time += dt;

    this.activePlayTime += dt;
    if (this.activePlayTime >= this.SEASON_PLAY_DURATION) {
      this.activePlayTime -= this.SEASON_PLAY_DURATION;
      this._advanceSeason();
    }

    this.garden.update(dt);
    this.ui.updateSeasonBar(this.activePlayTime / this.SEASON_PLAY_DURATION, this.garden.season);
    this.particles.update();
    this.catManager.update(
      dt,
      this.garden.placedItems,
      this.particles,
      (yarn, cat) => {
        const boosted = Math.ceil(yarn * this.giftBonus);
        this.yarn += boosted;
        this.totalYarnEarned += boosted;
        this.seasonYarn += boosted;
        this.ui.updateYarnDisplay();
        const msg = cat.isBirthday
          ? `🎂 ${this._catDisplayName(cat.def)}'s birthday gift: ${boosted}🧶!`
          : `${this._catDisplayName(cat.def)} left you ${boosted}🧶!`;
        this.ui.notify(msg);
        this.save();
        this._checkAchievements();
      },
      this.canvas.width,
      this.canvas.height,
      this.zenMode,
      this.garden.season,
      (cat) => {
        const s = SEASONS[this.garden.season];
        this.ui.notify(`🎂 It's ${this._catDisplayName(cat.def)}'s birthday! ${s.emoji} Tap them for a special gift!`, 4500);
      },
      this.moodBonus,
      this.garden.isGoldenHour,
      (cat) => this._logVisit(cat),
      (cat) => {
        if (this.garden.treat) {
          cat.targetX = this.garden.treat.x;
          cat.targetY = this.garden.treat.y;
          cat.treatGuaranteed = true;
          cat.visitDuration += 60;
          this.garden.treat = null;
          this.ui._updateTreatBtn();
          this.ui.notify(`🍪 ${this._catDisplayName(cat.def)} found the treat!`, 3000);
        }
      }
    );

    // Shimmer particles during golden hour
    if (this.garden.isGoldenHour) {
      const gp = this.garden._goldenProgress();
      if (Math.random() < gp * 0.12 * dt * 60) {
        const x = 20 + Math.random() * (this.canvas.width - 40);
        const y = this.canvas.height * 0.35 + Math.random() * this.canvas.height * 0.45;
        this.particles.spawnSingle(x, y, 'shimmer', (Math.random() - 0.5) * 0.4, -0.7);
      }
    }

    this.hintTimer += dt;
    if (this.hintTimer >= this.hintInterval) {
      this.hintTimer = 0;
      this._showHint();
    }

    this._render();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _advanceSeason() {
    // Evaluate trophy for the season that just ended
    const justEnded = this.garden.season;
    const trophy = TROPHIES[justEnded];
    if (trophy && !this.trophies.has(justEnded)) {
      const totalVisits = Object.values(this.catManager.visitCounts).reduce((a, b) => a + b, 0);
      const seasonVisits = totalVisits - this.seasonStartVisits;
      const yarnOk = trophy.condition.yarn === 0 || this.seasonYarn >= trophy.condition.yarn;
      const visitsOk = trophy.condition.visits === 0 || seasonVisits >= trophy.condition.visits;
      if (yarnOk && visitsOk) {
        this.trophies.add(justEnded);
        this._applyTrophyPassives();
        this.ui.notifyAchievement(`🏆 ${trophy.emoji} ${trophy.label}! ${trophy.desc}`);
      }
    }
    // Reset season stats for the incoming season
    this.seasonYarn = 0;
    this.seasonStartVisits = Object.values(this.catManager.visitCounts).reduce((a, b) => a + b, 0);

    this.garden.season = (this.garden.season + 1) % 4;
    this.seasonChanges++;
    navigator.vibrate?.([40]);
    const s = SEASONS[this.garden.season];
    this.particles.spawn(this.canvas.width / 2, this.canvas.height / 3, 'leaves');
    this.ui.notify(`${s.emoji} ${s.name} has arrived in your garden!`);
    this._checkAchievements();
    this.save();
  }

  _catDisplayName(def) {
    return this.nicknames[def.id] || def.name;
  }

  setNickname(catId, name) {
    const trimmed = name.trim().slice(0, 12);
    if (trimmed) this.nicknames[catId] = trimmed;
    else delete this.nicknames[catId];
    this.save();
  }

  _logVisit(cat) {
    this.visitLog.unshift({
      catId: cat.def.id,
      season: this.garden.season,
      timeOfDay: this.garden.timeOfDay,
      gifted: cat.leftGift,
      yarn: cat.giftYarnAmount || 0,
      petted: cat.petted,
      ts: Date.now(),
    });
    if (this.visitLog.length > 50) this.visitLog.length = 50;
    this.save();
  }

  _canUseTreat() {
    return !this.garden.treat && Date.now() - this.lastTreatTime >= 86400000;
  }

  placeTreat() {
    const cx = this.canvas.width  / 2 + (Math.random() - 0.5) * 100;
    const cy = this.canvas.height * 0.55 + (Math.random() - 0.5) * 50;
    this.garden.treat = { x: cx, y: cy };
    this.lastTreatTime = Date.now();
    this.save();
    this.ui._updateTreatBtn();
    this.ui.notify('🍪 Treat left out — the next visitor will love it!');
  }

  _applyTrophyPassives() {
    let spawnMult = 1, giftMult = 1, offlineBonus = 0, moodBonus = 0;
    for (const seasonIdx of this.trophies) {
      const t = TROPHIES[seasonIdx];
      if (!t) continue;
      if (t.spawnMult)    spawnMult    *= t.spawnMult;
      if (t.giftMult)     giftMult     *= t.giftMult;
      if (t.offlineBonus) offlineBonus += t.offlineBonus;
      if (t.moodBonus)    moodBonus    += t.moodBonus;
    }
    this.catManager.spawnInterval = 18 * spawnMult;
    this.giftBonus = giftMult;
    this.offlineRewardBonus = offlineBonus;
    this.moodBonus = moodBonus;
  }

  _checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
      if (!this.achievements.has(ach.id) && ach.check(this)) {
        this.achievements.add(ach.id);
        this.ui.notifyAchievement(`${ach.emoji} ${ach.label}!`);
      }
    }
  }

  _showItemMenu(pos, item) {
    this._hideItemMenu();
    const def = Object.values(ITEMS).flat().find(d => d.id === item.itemId);
    const menu = document.createElement('div');
    menu.id = 'item-menu';
    menu.style.left = `${Math.min(pos.x + 8, this.canvas.width - 150)}px`;
    menu.style.top  = `${Math.max(pos.y - 8, 8)}px`;

    if (item.tier === 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'item-menu-btn';
      upBtn.textContent = '⬆️ Upgrade 20🧶';
      upBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (this.yarn >= 20) {
          item.tier = 1;
          this.yarn -= 20;
          this.ui.updateYarnDisplay();
          this.save();
          this.ui.notify(`✨ ${def ? def.name : 'Item'} upgraded!`);
        } else {
          this.ui.notify('Need 20🧶 to upgrade');
        }
        this._hideItemMenu();
      });
      menu.appendChild(upBtn);
    } else {
      const badge = document.createElement('div');
      badge.className = 'item-menu-badge';
      badge.textContent = '✨ Upgraded';
      menu.appendChild(badge);
    }

    const rmBtn = document.createElement('button');
    rmBtn.className = 'item-menu-btn item-menu-btn--danger';
    rmBtn.textContent = '🗑️ Remove';
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = this.garden.placedItems.indexOf(item);
      if (idx >= 0) this.garden.placedItems.splice(idx, 1);
      this.save();
      this.ui.notify('Item removed');
      this._hideItemMenu();
    });
    menu.appendChild(rmBtn);

    document.getElementById('main-area').appendChild(menu);

    setTimeout(() => {
      const dismiss = ev => {
        if (!menu.contains(ev.target)) { this._hideItemMenu(); document.removeEventListener('pointerdown', dismiss); }
      };
      document.addEventListener('pointerdown', dismiss);
    }, 0);
  }

  _hideItemMenu() {
    const m = document.getElementById('item-menu');
    if (m) m.remove();
  }

  cycleAmbience() {
    this.ambience.next();
    this.ambienceMode = this.ambience.mode;
    this.garden.ambienceMode = this.ambienceMode;
    this.catManager.rainMode = (this.ambienceMode === 2);
    this.ui._updateAmbienceBtn();
    this.save();
    const labels = ['🔇 Ambience off', '🐦 Birds chirping', '🌧️ Rainy garden', '🍃 Gentle breeze'];
    this.ui.notify(labels[this.ambienceMode]);
  }

  _drawCatNameTag(cat) {
    const ctx = this.ctx;
    const label = `${cat.def.emoji || '🐾'} ${this._catDisplayName(cat.def)}`;
    ctx.save();
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(label).width;
    const padX = 7, tagH = 16;
    const tagW = tw + padX * 2;
    const tagX = cat.x - tagW / 2;
    const tagY = cat.y - 46 - tagH;
    ctx.globalAlpha = 0.58;
    ctx.fillStyle = 'rgba(30,20,12,0.85)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 6);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff8f0';
    ctx.fillText(label, cat.x, tagY + tagH - 3);
    ctx.restore();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    this.garden.drawBackground(this.time);
    this.garden.drawItems(this.time);
    this.garden.drawTreat(ctx, this.time);

    // Draw cats sorted by y
    const cats = [...this.catManager.cats].sort((a, b) => a.y - b.y);
    for (const cat of cats) cat.draw(ctx);

    // Name tag above hovered cat
    if (this._hoveredCat && this.catManager.cats.includes(this._hoveredCat)) {
      this._drawCatNameTag(this._hoveredCat);
    }

    this.particles.draw(ctx);

    // Ghost placement preview
    if (this._ghost && this._ghost.active && this._ghost.item && this._ghost.pos) {
      this.garden.drawPlacingGhost(ctx, this._ghost.pos.x, this._ghost.pos.y, this._ghost.item, this._ghost.valid);
    }

    // Season label (faint)
    const season = SEASONS[this.garden.season];
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#4a3728';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${season.emoji} ${season.name}`, W - 8, H - 8);
    ctx.restore();
  }

  _showHint() {
    const season = SEASONS[this.garden.season];
    const hints = [
      '💡 Try placing Catnip to attract more cats!',
      '💡 Tap a cat to pet them — they may leave a gift!',
      '💡 Check the Cat Journal to track visitors.',
      '💡 Add a Cat Tree to attract Princess!',
      '💡 Tall Grass makes Shadow feel safe.',
      '💡 Press Escape to cancel placement.',
      '💡 Right-click an item to remove it.',
      `💡 ${season.emoji} ${season.name}: cats love their favourite season — gifts x1.5!`,
      '💡 Hover over a cat to see their mood.',
      '💡 A ✨ in the tooltip means it\'s their favourite season!',
      '💡 ✨ During Golden Hour (sunset), rare cats love to visit!',
      '💡 Right-click a placed item to upgrade it for 20🧶 — cats linger longer!',
      '💡 Tap 🔇 to cycle garden ambience — birds, rain, or breeze!',
      '💡 🌧️ Rainy mode makes the mysterious Shadow cat appear more often!',
      '💡 Watch for falling petals in Spring, butterflies in Summer, leaves in Autumn, and snow in Winter!',
      '💡 The coloured bar below the header shows how close the next season change is — it pulses when near!',
    ];
    this.ui.showHint(hints[Math.floor(Math.random() * hints.length)]);
  }

  _startOfflineReward() {
    const key = 'catgarden_lastvisit';
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    const now = Date.now();
    const elapsed = (now - last) / 1000 / 60; // minutes
    if (last && elapsed > 2) {
      const cap = 50 + this.offlineRewardBonus;
      const reward = Math.min(cap, Math.floor(elapsed * 0.8));
      if (reward > 0) {
        this.yarn += reward;
        this.ui?.updateYarnDisplay();
        this.ui?.notify(`🌙 Welcome back! Cats left ${reward}🧶 while you were away.`);
      }
    }
    localStorage.setItem(key, now);
  }

  save() {
    try {
      const data = {
        yarn: this.yarn,
        unlocked: [...this.unlockedItems],
        items: this.garden.serialize(),
        catsSeen: this.catManager.seenCats,
        catVisits: this.catManager.visitCounts,
        catUnlocked: CAT_DEFS.filter(d => d.unlocked).map(d => d.id),
        season: this.garden.season,
        activePlayTime: this.activePlayTime,
        totalYarnEarned: this.totalYarnEarned,
        pettedCount: this.pettedCount,
        birthdayPetsCount: this.birthdayPetsCount,
        achievements: [...this.achievements],
        seasonChanges: this.seasonChanges,
        trophies: [...this.trophies],
        seasonYarn: this.seasonYarn,
        seasonStartVisits: this.seasonStartVisits,
        nicknames: this.nicknames,
        visitLog: this.visitLog,
        lastTreatTime: this.lastTreatTime,
        ambienceMode: this.ambienceMode,
      };
      localStorage.setItem('catgarden_save', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem('catgarden_save');
      if (!raw) {
        this._newGame();
        return;
      }
      const data = JSON.parse(raw);
      this.yarn = data.yarn || 0;
      if (data.unlocked) data.unlocked.forEach(id => this.unlockedItems.add(id));
      if (data.items) this.garden.loadItems(data.items.slice(0, 60));
      if (data.catsSeen) this.catManager.seenCats = data.catsSeen;
      if (data.catVisits) this.catManager.visitCounts = data.catVisits;
      if (data.catUnlocked) {
        data.catUnlocked.forEach(id => {
          const def = CAT_DEFS.find(d => d.id === id);
          if (def) def.unlocked = true;
        });
      }
      if (typeof data.season === 'number') this.garden.season = data.season;
      if (typeof data.activePlayTime === 'number') this.activePlayTime = data.activePlayTime;
      if (typeof data.totalYarnEarned === 'number') this.totalYarnEarned = data.totalYarnEarned;
      if (typeof data.pettedCount === 'number') this.pettedCount = data.pettedCount;
      if (typeof data.birthdayPetsCount === 'number') this.birthdayPetsCount = data.birthdayPetsCount;
      if (typeof data.seasonChanges === 'number') this.seasonChanges = data.seasonChanges;
      if (data.achievements) data.achievements.forEach(id => this.achievements.add(id));
      if (data.trophies) data.trophies.forEach(s => this.trophies.add(s));
      if (typeof data.seasonYarn === 'number') this.seasonYarn = data.seasonYarn;
      if (typeof data.seasonStartVisits === 'number') this.seasonStartVisits = data.seasonStartVisits;
      if (data.nicknames && typeof data.nicknames === 'object') this.nicknames = data.nicknames;
      if (Array.isArray(data.visitLog)) this.visitLog = data.visitLog.slice(0, 50);
      if (typeof data.lastTreatTime === 'number') this.lastTreatTime = data.lastTreatTime;
      if (typeof data.ambienceMode === 'number') {
        this.ambienceMode = data.ambienceMode;
        this.ambience.mode = data.ambienceMode;
        this.garden.ambienceMode = data.ambienceMode;
        this.catManager.rainMode = (data.ambienceMode === 2);
      }
      this._applyTrophyPassives();
      this.ui.updateYarnDisplay();
      this.ui._updateTreatBtn();
      this.ui._updateAmbienceBtn();
    } catch (e) {
      this._newGame();
    }
  }

  resetGame() {
    try { localStorage.removeItem('catgarden_save'); } catch(e) {}
    try { localStorage.removeItem('catgarden_lastvisit'); } catch(e) {}
    window.location.reload();
  }

  _newGame() {
    // Starter items
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.garden.placeItem(W * 0.3, H * 0.5, 'catnip');
    this.garden.placeItem(W * 0.6, H * 0.45, 'box');
    this.garden.placeItem(W * 0.45, H * 0.65, 'ball');
    this.yarn = 20;
    this.ui.updateYarnDisplay();
    this.ui.notify('🌸 Welcome to Cat Garden Haven! Tap the items panel to add more!');
    this.save();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
