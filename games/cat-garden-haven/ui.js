'use strict';

class UI {
  constructor(game) {
    this.game = game;
    this.activeTab = 'plants';
    this._journalTab = 'cats';
    this.selectedItem = null;
    this._notifTimer = null;
    this._notifQueue = [];
    this._processing = false;

    this._bindTabs();
    this._bindButtons();
    this._bindModal();
    this._bindGameMenu();
    this.renderShop();
  }

  _bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderShop();
      });
    });
  }

  _bindButtons() {
    document.getElementById('btn-treat').addEventListener('click', () => {
      if (this.game._canUseTreat()) {
        this.game.placeTreat();
      } else if (this.game.garden.treat) {
        this.notify('🍪 Treat is already out — waiting for a visitor!');
      } else {
        const remainMs = 86400000 - (Date.now() - this.game.lastTreatTime);
        const remainH = Math.ceil(remainMs / 3600000);
        this.notify(`🍪 Next treat available in ~${remainH}h`);
      }
    });
    setInterval(() => this._updateTreatBtn(), 60000);

    document.getElementById('btn-journal').addEventListener('click', () => this.openJournal());
    document.getElementById('btn-undo').addEventListener('click', () => {
      const items = this.game.garden.placedItems;
      if (items.length) {
        items.pop();
        this.game.save();
        this.notify('↩️ Last item removed');
      } else {
        this.notify('Nothing to remove');
      }
    });
    document.getElementById('btn-zen').addEventListener('click', () => {
      this.game.zenMode = !this.game.zenMode;
      document.getElementById('btn-zen').classList.toggle('active', this.game.zenMode);
      this.notify(this.game.zenMode ? '🌿 Zen Mode On — just observe' : '🌿 Zen Mode Off');
    });
  }

  _bindModal() {
    document.querySelector('#journal-modal .close-modal').addEventListener('click', () => {
      document.getElementById('journal-modal').classList.add('hidden');
    });
    document.getElementById('journal-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('journal-modal'))
        document.getElementById('journal-modal').classList.add('hidden');
    });
  }

  _bindGameMenu() {
    document.getElementById('btn-menu').addEventListener('click', () => this.openGameMenu());
    document.querySelector('#game-menu-modal .close-modal').addEventListener('click', () => {
      document.getElementById('game-menu-modal').classList.add('hidden');
    });
    document.getElementById('game-menu-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('game-menu-modal'))
        document.getElementById('game-menu-modal').classList.add('hidden');
    });
  }

  openGameMenu() {
    const content = document.getElementById('game-menu-content');
    content.innerHTML = '';

    // ── Stats ────────────────────────────────────────────────────
    const statsSection = this._menuSection('🧶 Your Garden');
    const g = this.game;
    const seenCount  = Object.keys(g.catManager.seenCats).length;
    const totalCats  = CAT_DEFS.length;
    const totalVisits = Object.values(g.catManager.visitCounts).reduce((a, b) => a + b, 0);
    const achCount   = g.achievements.size;
    const totalAch   = ACHIEVEMENTS.length;
    const trophyCount = g.trophies.size;
    const season     = SEASONS[g.garden.season];

    [
      ['🧶 Total yarn earned',  `${g.totalYarnEarned}🧶`],
      ['🧶 Yarn in hand',       `${g.yarn}🧶`],
      ['🐱 Cats discovered',    `${seenCount} / ${totalCats}`],
      ['👋 Times petted',       `${g.pettedCount}`],
      ['📬 Total cat visits',   `${totalVisits}`],
      ['🏆 Trophies earned',    `${trophyCount} / ${TROPHIES.length}`],
      ['⭐ Achievements',       `${achCount} / ${totalAch}`],
      ['🌸 Current season',     `${season.emoji} ${season.name}`],
      ['📖 Diary entries',      `${g.visitLog.length}`],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'menu-stat-row';
      const l = document.createElement('span');
      l.className = 'menu-stat-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'menu-stat-value';
      v.textContent = value;
      row.appendChild(l);
      row.appendChild(v);
      statsSection.appendChild(row);
    });
    content.appendChild(statsSection);

    // ── About ────────────────────────────────────────────────────
    const aboutSection = this._menuSection('ℹ️ About');
    const aboutText = document.createElement('p');
    aboutText.className = 'menu-about-text';
    aboutText.innerHTML =
      '<strong>Cat Garden Haven</strong> is a cosy idle garden where cats visit, leave gifts, and make themselves at home.<br><br>' +
      'Place items to attract different cats, unlock rare visitors, and collect yarn to grow your garden.<br><br>' +
      '<em>Cats save automatically. Progress is stored in your browser.</em>';
    aboutSection.appendChild(aboutText);
    content.appendChild(aboutSection);

    // ── Actions ──────────────────────────────────────────────────
    const actionsSection = this._menuSection('⚙️ Options');

    const zenRow = this._menuActionBtn(
      g.zenMode ? '🌿 Zen Mode: On' : '🌿 Zen Mode: Off',
      () => {
        g.zenMode = !g.zenMode;
        document.getElementById('btn-zen').classList.toggle('active', g.zenMode);
        document.getElementById('game-menu-modal').classList.add('hidden');
        this.notify(g.zenMode ? '🌿 Zen Mode On' : '🌿 Zen Mode Off');
      }
    );
    actionsSection.appendChild(zenRow);

    const clearLogBtn = this._menuActionBtn('🗑️ Clear Visitor Diary', () => {
      g.visitLog = [];
      g.save();
      document.getElementById('game-menu-modal').classList.add('hidden');
      this.notify('Visitor diary cleared');
    });
    actionsSection.appendChild(clearLogBtn);

    content.appendChild(actionsSection);

    // ── Danger zone ──────────────────────────────────────────────
    const dangerSection = this._menuSection('⚠️ Danger Zone');
    let confirmPending = false;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'menu-action-btn menu-action-btn--danger';
    resetBtn.textContent = '🔄 Reset Game';
    resetBtn.addEventListener('click', () => {
      if (!confirmPending) {
        confirmPending = true;
        resetBtn.textContent = '⚠️ Tap again to confirm reset';
        resetBtn.classList.add('menu-action-btn--confirm');
        setTimeout(() => {
          confirmPending = false;
          resetBtn.textContent = '🔄 Reset Game';
          resetBtn.classList.remove('menu-action-btn--confirm');
        }, 3000);
      } else {
        g.resetGame();
      }
    });
    dangerSection.appendChild(resetBtn);
    content.appendChild(dangerSection);

    document.getElementById('game-menu-modal').classList.remove('hidden');
  }

  _menuSection(title) {
    const section = document.createElement('div');
    section.className = 'menu-section';
    const h = document.createElement('h3');
    h.className = 'menu-section-title';
    h.textContent = title;
    section.appendChild(h);
    return section;
  }

  _menuActionBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'menu-action-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  renderShop() {
    const container = document.getElementById('shop-items');
    container.innerHTML = '';
    const items = ITEMS[this.activeTab] || [];

    items.forEach(item => {
      const locked = !this.game.unlockedItems.has(item.id);
      const el = document.createElement('div');
      el.className = 'shop-item' + (locked ? ' locked' : '') + (this.selectedItem?.id === item.id ? ' selected' : '');
      el.title = item.desc;

      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.font = '30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, 24, 26);

      el.appendChild(canvas);

      const name = document.createElement('div');
      name.className = 'shop-item-name';
      name.textContent = item.name;
      el.appendChild(name);

      const cost = document.createElement('div');
      cost.className = 'shop-item-cost';
      if (locked) {
        cost.textContent = `🔒 ${item.cost}🧶`;
        const lockTag = document.createElement('span');
        lockTag.className = 'shop-item-lock';
        el.appendChild(lockTag);
      } else {
        cost.textContent = item.cost === 0 ? 'Free' : `${item.cost} 🧶`;
      }
      el.appendChild(cost);

      el.addEventListener('click', () => {
        if (locked) {
          if (this.game.yarn >= item.cost) {
            this.game.yarn -= item.cost;
            this.game.unlockedItems.add(item.id);
            this.game.save();
            this.updateYarnDisplay();
            this.renderShop();
            this.notify(`✨ Unlocked ${item.name}!`);
          } else {
            this.notify(`Need ${item.cost}🧶 to unlock ${item.name}`);
          }
          return;
        }
        if (this.selectedItem?.id === item.id) {
          this.selectedItem = null;
          document.getElementById('garden-canvas').className = '';
        } else {
          this.selectedItem = item;
          document.getElementById('garden-canvas').className = 'placing';
        }
        this.renderShop();
      });

      container.appendChild(el);
    });
  }

  updateYarnDisplay() {
    document.getElementById('yarn-value').textContent = this.game.yarn;
  }

  _updateTreatBtn() {
    const btn = document.getElementById('btn-treat');
    if (!btn) return;
    const active    = !!this.game.garden.treat;
    const available = this.game._canUseTreat();
    btn.classList.toggle('treat-available', available);
    btn.classList.toggle('treat-active', active);
    if (active) {
      btn.title = 'Treat is out — waiting for a visitor!';
    } else if (available) {
      btn.title = 'Leave a daily treat — the next cat will always bring a gift!';
    } else {
      const remainH = Math.ceil((86400000 - (Date.now() - this.game.lastTreatTime)) / 3600000);
      btn.title = `Next treat in ~${remainH}h`;
    }
  }

  openJournal() {
    const modal = document.getElementById('journal-modal');
    const content = document.getElementById('journal-content');
    content.innerHTML = '';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'journal-tabs';
    [['cats', '🐾 Cats'], ['diary', '📖 Diary']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.className = 'journal-tab-btn' + (this._journalTab === id ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { this._journalTab = id; this.openJournal(); });
      tabBar.appendChild(btn);
    });
    content.appendChild(tabBar);

    if (this._journalTab === 'diary') {
      this._renderDiary(content);
    } else {
      this._renderCats(content);
    }

    modal.classList.remove('hidden');
  }

  _renderCats(content) {
    const grid = document.createElement('div');
    grid.className = 'journal-cat-grid';
    content.appendChild(grid);

    CAT_DEFS.forEach(def => {
      const seen = this.game.catManager.seenCats[def.id];
      const visits = this.game.catManager.visitCounts[def.id] || 0;

      const el = document.createElement('div');
      el.className = 'journal-entry' + (!seen ? ' unseen' : '');

      const emojiDiv = document.createElement('div');
      emojiDiv.style.fontSize = '2rem';
      emojiDiv.textContent = seen ? (def.id === 'muffin' ? '🐱' : def.id === 'shadow' ? '🐈‍⬛' : def.id === 'zoom' ? '🧡' : def.id === 'princess' ? '🎀' : '🐾') : '❓';
      el.appendChild(emojiDiv);

      const nameEl = document.createElement('div');
      nameEl.className = 'journal-cat-name';
      if (!seen) {
        nameEl.textContent = '???';
      } else {
        const nickname = this.game.nicknames[def.id];
        if (nickname) {
          nameEl.textContent = '🏷 ' + nickname;
          const origSpan = document.createElement('span');
          origSpan.className = 'journal-cat-original-name';
          origSpan.textContent = ` (${def.name})`;
          nameEl.appendChild(origSpan);
        } else {
          nameEl.textContent = def.name;
        }
        nameEl.title = 'Tap to set a nickname';
        nameEl.style.cursor = 'pointer';
        nameEl.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.maxLength = 12;
          input.value = this.game.nicknames[def.id] || '';
          input.placeholder = def.name;
          input.className = 'nickname-input';
          nameEl.replaceWith(input);
          input.focus();
          input.select();
          let done = false;
          const commit = () => {
            if (done) return;
            done = true;
            this.game.setNickname(def.id, input.value);
            this.openJournal();
          };
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') {
              done = true;
              input.removeEventListener('blur', commit);
              input.replaceWith(nameEl);
            }
          });
        });
      }
      el.appendChild(nameEl);

      const traitEl = document.createElement('div');
      traitEl.className = 'journal-cat-trait';
      traitEl.textContent = seen ? def.personality : '...';
      el.appendChild(traitEl);

      if (seen) {
        const visitEl = document.createElement('div');
        visitEl.className = 'journal-cat-visits';
        visitEl.textContent = `${visits} visit${visits !== 1 ? 's' : ''}`;
        el.appendChild(visitEl);

        if (def.favSeason !== undefined) {
          const favSeasonEl = document.createElement('div');
          favSeasonEl.className = 'journal-cat-season';
          const s = SEASONS[def.favSeason];
          favSeasonEl.textContent = `Loves ${s.emoji} ${s.name}`;
          el.appendChild(favSeasonEl);
        }

        if (def.birthday !== undefined) {
          const bdEl = document.createElement('div');
          bdEl.className = 'journal-cat-season';
          const bs = SEASONS[def.birthday];
          const isBdSeason = def.birthday === this.game.garden.season;
          bdEl.textContent = `Birthday ${bs.emoji} ${bs.name}${isBdSeason ? ' 🎂' : ''}`;
          el.appendChild(bdEl);
        }
      }

      if (!def.unlocked) {
        const unlockEl = document.createElement('div');
        unlockEl.style.fontSize = '0.68rem';
        unlockEl.style.color = '#e8a060';
        unlockEl.style.fontWeight = '700';
        unlockEl.textContent = `🔒 ${def.unlockCost}🧶`;
        el.appendChild(unlockEl);

        el.addEventListener('click', () => {
          if (this.game.yarn >= def.unlockCost) {
            this.game.yarn -= def.unlockCost;
            def.unlocked = true;
            this.game.save();
            this.updateYarnDisplay();
            this.openJournal();
            this.notify(`🎉 ${def.name} can now visit your garden!`);
          } else {
            this.notify(`Need ${def.unlockCost}🧶 to unlock ${def.name}`);
          }
        });
        el.style.cursor = 'pointer';
      }

      grid.appendChild(el);
    });

    // Trophy section
    const trophySection = document.createElement('div');
    trophySection.className = 'trophy-section';
    const trophyTitle = document.createElement('h3');
    trophyTitle.className = 'trophy-title';
    trophyTitle.textContent = '🏆 Season Trophies';
    trophySection.appendChild(trophyTitle);
    const trophyGrid = document.createElement('div');
    trophyGrid.className = 'trophy-grid';

    TROPHIES.forEach(t => {
      const earned = this.game.trophies.has(t.season);
      const slot = document.createElement('div');
      slot.className = 'trophy-slot' + (earned ? ' earned' : '');
      const icon = document.createElement('div');
      icon.className = 'trophy-icon';
      icon.textContent = earned ? t.emoji : '🔒';
      const label = document.createElement('div');
      label.className = 'trophy-label';
      label.textContent = earned ? t.label : SEASONS[t.season].name;
      const desc = document.createElement('div');
      desc.className = 'trophy-desc';
      if (earned) {
        desc.textContent = t.desc;
      } else {
        const parts = [];
        if (t.condition.yarn > 0) parts.push(`${t.condition.yarn}🧶 in a season`);
        if (t.condition.visits > 0) parts.push(`${t.condition.visits} visits in a season`);
        desc.textContent = parts.join(' & ');
      }
      slot.appendChild(icon);
      slot.appendChild(label);
      slot.appendChild(desc);
      trophyGrid.appendChild(slot);
    });

    trophySection.appendChild(trophyGrid);
    content.appendChild(trophySection);
  }

  _renderDiary(content) {
    const log = this.game.visitLog;
    if (!log.length) {
      const empty = document.createElement('p');
      empty.className = 'diary-empty';
      empty.textContent = 'No visits yet — cats will leave their mark here!';
      content.appendChild(empty);
      return;
    }

    const TIME_LABELS = [
      { max: 0.25, emoji: '🌅', label: 'Morning' },
      { max: 0.5,  emoji: '☀️', label: 'Afternoon' },
      { max: 0.75, emoji: '🌇', label: 'Dusk' },
      { max: 1,    emoji: '🌙', label: 'Night' },
    ];

    log.forEach(entry => {
      const def = CAT_DEFS.find(d => d.id === entry.catId);
      if (!def) return;
      const name = this.game.nicknames[entry.catId] || def.name;
      const season = SEASONS[entry.season];
      const tl = TIME_LABELS.find(l => entry.timeOfDay <= l.max) || TIME_LABELS[3];

      let action;
      if (entry.gifted && entry.petted) {
        action = `was petted and left ${entry.yarn}🧶`;
      } else if (entry.gifted) {
        action = `left you ${entry.yarn}🧶`;
      } else if (entry.petted) {
        action = `was petted but left no gift`;
      } else {
        action = `visited but left no gift`;
      }

      const el = document.createElement('div');
      el.className = 'diary-entry';

      const time = document.createElement('span');
      time.className = 'diary-time';
      time.textContent = `${tl.emoji} ${tl.label} ${season.emoji}`;
      el.appendChild(time);

      const text = document.createElement('span');
      text.className = 'diary-text';
      text.textContent = ` — ${name} ${action}.`;
      el.appendChild(text);

      content.appendChild(el);
    });
  }

  notify(msg, duration = 2500, isAchievement = false) {
    this._notifQueue.push({ msg, duration, isAchievement });
    if (!this._processing) this._processQueue();
  }

  notifyAchievement(msg) {
    this.notify('⭐ ' + msg, 4000, true);
  }

  _processQueue() {
    if (!this._notifQueue.length) { this._processing = false; return; }
    this._processing = true;
    const { msg, duration, isAchievement } = this._notifQueue.shift();
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.toggle('achievement', !!isAchievement);
    el.classList.remove('hidden');
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => {
      el.classList.add('hidden');
      setTimeout(() => this._processQueue(), 300);
    }, duration);
  }

  showHint(msg) {
    let hint = document.getElementById('hint-bar');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'hint-bar';
      document.getElementById('main-area').appendChild(hint);
    }
    hint.textContent = msg;
  }

  hideHint() {
    const hint = document.getElementById('hint-bar');
    if (hint) hint.textContent = '';
  }
}
