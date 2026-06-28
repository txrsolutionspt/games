'use strict';

class UI {
  constructor(game) {
    this.game = game;
    this.activeTab = 'plants';
    this.selectedItem = null;
    this._notifTimer = null;
    this._notifQueue = [];
    this._processing = false;

    this._bindTabs();
    this._bindButtons();
    this._bindModal();
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

  openJournal() {
    const modal = document.getElementById('journal-modal');
    const content = document.getElementById('journal-content');
    content.innerHTML = '';

    CAT_DEFS.forEach(def => {
      const seen = this.game.catManager.seenCats[def.id];
      const visits = this.game.catManager.visitCounts[def.id] || 0;
      const locked = !def.unlocked;

      const el = document.createElement('div');
      el.className = 'journal-entry' + (!seen ? ' unseen' : '');

      const emojiDiv = document.createElement('div');
      emojiDiv.style.fontSize = '2rem';
      emojiDiv.textContent = seen ? (def.id === 'muffin' ? '🐱' : def.id === 'shadow' ? '🐈‍⬛' : def.id === 'zoom' ? '🧡' : def.id === 'princess' ? '🎀' : '🐾') : '❓';
      el.appendChild(emojiDiv);

      const nameEl = document.createElement('div');
      nameEl.className = 'journal-cat-name';
      nameEl.textContent = seen ? def.name : '???';
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

      content.appendChild(el);
    });

    modal.classList.remove('hidden');
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
