// Modal dialogs (shop drawers, animal/building info, settings, mission
// popups) and the non-modal info tooltip — PLAN.md §11/§12. Every modal is
// a simple centered DOM card with icon-first content and at most a couple
// of short sentences, per the brief's "minimal text" requirement.

const Modals = (function () {
  function root() { return document.getElementById('modal-root'); }

  // A mission-complete popup and a first-time educational fact can both
  // want to open in the same synchronous turn (e.g. the very first harvest
  // of a crop completes a mission AND is that crop's first-time fact).
  // Without a queue, the second call would silently overwrite the first
  // before the player ever saw it. Every public showXxx() below is wrapped
  // in enqueueOrRun so at most one modal renders at a time and the rest
  // wait their turn, popping open one after another as each is closed.
  let isOpen = false;
  let queue = [];

  function enqueueOrRun(thunk) {
    if (isOpen) { queue.push(thunk); return; }
    thunk();
  }

  function close() {
    const r = root();
    r.classList.add('hidden');
    r.innerHTML = '';
    isOpen = false;
    if (queue.length) {
      const next = queue.shift();
      next();
    }
  }

  function open(bodyHtml) {
    isOpen = true;
    const r = root();
    r.innerHTML = '<div class="modal-backdrop"><div class="modal-card">' + bodyHtml + '</div></div>';
    r.classList.remove('hidden');
    r.querySelector('.modal-backdrop').addEventListener('click', function (e) {
      if (e.target === this) close();
    });
    r.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });
  }

  // ---- Non-modal "i" info tooltip (PLAN.md §12: available anytime, not
  // just once) --------------------------------------------------------------

  let tooltipTimer = null;

  function showTooltip(x, y, lines) {
    const tip = document.getElementById('tooltip');
    tip.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.remove('hidden');
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(hideTooltip, 4000);
  }

  function hideTooltip() {
    document.getElementById('tooltip').classList.add('hidden');
  }

  // ---- Shop drawers ---------------------------------------------------------

  function showCropShop(state, onPick) {
    enqueueOrRun(function () {
      const season = Simulation.currentSeason(state);
      const cards = CROPS.map(function (c) {
        const inSeason = FarmRules.isCropInSeason(c, season);
        const name = I18N.t('crop.' + c.id + '.name', c.name);
        return '<button class="shop-card" data-id="' + c.id + '">' +
          '<div class="shop-icon">' + c.icon + '</div>' +
          '<div class="shop-name">' + name + '</div>' +
          '<div class="shop-cost">🪙 ' + c.seedCost + '</div>' +
          (inSeason ? '' : '<div class="shop-note">' + I18N.t('ui.shop.outOfSeason', 'Grows better another season') + '</div>') +
          '</button>';
      }).join('');
      open('<h2>' + I18N.t('ui.shop.crops.title', 'Choose a Seed') + '</h2><div class="shop-grid">' + cards + '</div>' +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
      root().querySelectorAll('.shop-card').forEach(function (btn) {
        btn.addEventListener('click', function () { close(); onPick(btn.dataset.id); });
      });
    });
  }

  function showAnimalShop(onPick) {
    enqueueOrRun(function () {
      const cards = ANIMALS.map(function (a) {
        const name = I18N.t('animal.' + a.id + '.name', a.name);
        return '<button class="shop-card" data-id="' + a.id + '">' +
          '<div class="shop-icon">' + a.icon + '</div>' +
          '<div class="shop-name">' + name + '</div>' +
          '<div class="shop-cost">🪙 ' + a.cost + '</div>' +
          '</button>';
      }).join('');
      open('<h2>' + I18N.t('ui.shop.animals.title', 'Choose an Animal') + '</h2><div class="shop-grid">' + cards + '</div>' +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
      root().querySelectorAll('.shop-card').forEach(function (btn) {
        btn.addEventListener('click', function () { close(); onPick(btn.dataset.id); });
      });
    });
  }

  function showBuildingShop(onPick) {
    enqueueOrRun(function () {
      const cards = BUILDINGS.map(function (b) {
        const name = I18N.t('building.' + b.id + '.name', b.name);
        return '<button class="shop-card" data-id="' + b.id + '">' +
          '<div class="shop-icon">' + b.icon + '</div>' +
          '<div class="shop-name">' + name + '</div>' +
          '<div class="shop-cost">🪙 ' + b.cost + '</div>' +
          '</button>';
      }).join('');
      open('<h2>' + I18N.t('ui.shop.build.title', 'Choose a Building') + '</h2><div class="shop-grid">' + cards + '</div>' +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
      root().querySelectorAll('.shop-card').forEach(function (btn) {
        btn.addEventListener('click', function () { close(); onPick(btn.dataset.id); });
      });
    });
  }

  // ---- Locked plot ---------------------------------------------------------

  function showUnlockPlot(state, plot, onUnlock) {
    enqueueOrRun(function () {
      const cost = Economy.plotUnlockCost(plot.index);
      const canAfford = state.coins >= cost;
      open('<h2>🔒 ' + I18N.t('ui.plot.locked.title', 'Locked Plot') + '</h2>' +
        '<p>' + I18N.t('ui.plot.locked.body', 'Unlock this land to grow more!') + '</p>' +
        '<p class="shop-cost">🪙 ' + cost + '</p>' +
        '<button class="btn-primary" id="unlock-btn"' + (canAfford ? '' : ' disabled') + '>' +
        I18N.t('ui.plot.locked.unlock', 'Unlock') + '</button> ' +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
      const btn = document.getElementById('unlock-btn');
      if (btn) btn.addEventListener('click', function () { close(); onUnlock(); });
    });
  }

  // ---- Animal info card -----------------------------------------------------

  function showAnimalInfo(state, plot, actions) {
    enqueueOrRun(function () {
      const def = ANIMALS_BY_ID[plot.occupant.id];
      const progress = FarmRules.animalProgress(plot.occupant, def, state.clock.tick);
      const name = I18N.t('animal.' + def.id + '.name', def.name);
      const fact = I18N.t('animal.' + def.id + '.fact', def.educational);
      const haveFeed = (state.inventory[def.needs.feedItemId] || 0) > 0;
      const pct = Math.round(progress.frac * 100);
      const moodLabel = progress.happiness >= 0.9
        ? I18N.t('ui.animal.happy', 'Happy!')
        : (progress.happiness >= 0.6 ? I18N.t('ui.animal.hungry', 'Could use food or water') : I18N.t('ui.animal.thirsty', 'Needs food and water'));

      open('<h2>' + def.icon + ' ' + name + '</h2>' +
        '<p class="fact">' + fact + '</p>' +
        '<p>' + moodLabel + '</p>' +
        (progress.ready
          ? '<p class="ready-label">✨ ' + I18N.t('ui.building.ready', 'Ready!') + '</p>'
          : '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>') +
        '<div class="modal-actions">' +
        '<button class="btn-primary" id="animal-feed"' + (haveFeed ? '' : ' disabled') + '>🍽️ ' + I18N.t('ui.animal.feed', 'Feed') + '</button>' +
        '<button class="btn-primary" id="animal-water">💧 ' + I18N.t('ui.animal.water', 'Water') + '</button>' +
        (progress.ready ? '<button class="btn-primary" id="animal-collect">✋ ' + I18N.t('ui.animal.collect', 'Collect') + '</button>' : '') +
        '</div>' +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');

      const feedBtn = document.getElementById('animal-feed');
      if (feedBtn) feedBtn.addEventListener('click', function () { close(); actions.feed(); });
      document.getElementById('animal-water').addEventListener('click', function () { close(); actions.water(); });
      const collectBtn = document.getElementById('animal-collect');
      if (collectBtn) collectBtn.addEventListener('click', function () { close(); actions.collect(); });
    });
  }

  // ---- Building recipe picker ------------------------------------------------

  function showBuildingRecipes(state, plot, onStart) {
    enqueueOrRun(function () {
      const def = BUILDINGS_BY_ID[plot.occupant.id];
      const recipes = recipesForBuilding(def.id);
      const cards = recipes.map(function (r) {
        const canStart = FarmRules.canStartRecipe(plot, r, state.inventory);
        const inputsHtml = r.inputs.map(function (inp) {
          const have = state.inventory[inp.item] || 0;
          return '<span class="' + (have >= inp.qty ? 'have-enough' : 'have-short') + '">' + inp.qty + '× ' + inp.item.replace('_', ' ') + ' (' + have + ')</span>';
        }).join(', ');
        const name = I18N.t('recipe.' + r.id + '.name', r.name);
        return '<div class="recipe-card">' +
          '<div class="shop-name">' + name + '</div>' +
          '<div class="recipe-inputs">' + I18N.t('ui.building.needs', 'Needs:') + ' ' + inputsHtml + '</div>' +
          '<button class="btn-primary" data-recipe="' + r.id + '"' + (canStart ? '' : ' disabled') + '>' + I18N.t('ui.building.start', 'Start') + '</button>' +
          '</div>';
      }).join('');
      open('<h2>' + def.icon + ' ' + I18N.t('building.' + def.id + '.name', def.name) + '</h2>' + cards +
        '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
      root().querySelectorAll('[data-recipe]').forEach(function (btn) {
        btn.addEventListener('click', function () { close(); onStart(btn.dataset.recipe); });
      });
    });
  }

  // ---- Mission complete ------------------------------------------------------

  function showMissionComplete(mission) {
    enqueueOrRun(function () {
      const title = I18N.t('mission.' + mission.id + '.title', mission.title);
      const learned = I18N.t('mission.' + mission.id + '.learned', mission.learned);
      open('<h2>🎉 ' + I18N.t('ui.mission.completed', 'Mission Complete!') + '</h2>' +
        '<p><strong>' + title + '</strong></p>' +
        '<p class="fact">💡 ' + learned + '</p>' +
        '<p class="shop-cost">🪙 +' + mission.reward.coins + '</p>' +
        '<button class="btn-primary" data-close>' + I18N.t('ui.mission.ok', 'Got it!') + '</button>');
    });
  }

  function showFact(title, icon, fact) {
    enqueueOrRun(function () {
      open('<h2>' + icon + ' ' + title + '</h2><p class="fact">💡 ' + fact + '</p>' +
        '<button class="btn-primary" data-close>' + I18N.t('ui.mission.ok', 'Got it!') + '</button>');
    });
  }

  // ---- Market -----------------------------------------------------------------

  // The sell-button handler refreshes this same modal in place (no
  // close/reopen flicker), so the actual render logic is a plain function
  // the recursive refresh can call directly — only the first, external
  // entry into this modal goes through enqueueOrRun.
  function renderMarket(state, onSell) {
    const rows = Object.keys(state.inventory).filter(function (k) { return state.inventory[k] > 0; }).map(function (item) {
      const qty = state.inventory[item];
      const price = Economy.sellPriceFor(item);
      return '<div class="market-row">' +
        '<span>' + item.replace('_', ' ') + ' × ' + qty + '</span>' +
        '<span>🪙 ' + price + ' ' + I18N.t('ui.market.each', 'each') + '</span>' +
        '<button class="btn-primary" data-item="' + item + '">' + I18N.t('ui.market.sell', 'Sell 1') + '</button>' +
        '</div>';
    }).join('') || '<p>' + I18N.t('ui.inventory.empty', 'Nothing yet — go harvest something!') + '</p>';
    open('<h2>🛒 ' + I18N.t('ui.market.title', 'Market') + '</h2>' + rows +
      '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
    root().querySelectorAll('[data-item]').forEach(function (btn) {
      btn.addEventListener('click', function () { onSell(btn.dataset.item); renderMarket(state, onSell); });
    });
  }

  function showMarket(state, onSell) {
    enqueueOrRun(function () { renderMarket(state, onSell); });
  }

  // ---- Settings ---------------------------------------------------------------

  // The language buttons refresh this same modal in place after switching
  // locale (see renderMarket above for why the recursive call bypasses
  // enqueueOrRun).
  function renderSettings(state, actions) {
    open('<h2>⚙️ ' + I18N.t('ui.settings.title', 'Settings') + '</h2>' +
      '<p>' + I18N.t('ui.settings.language', 'Language') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-secondary lang-btn" data-lang="en">English</button>' +
      '<button class="btn-secondary lang-btn" data-lang="pt">Português</button>' +
      '</div>' +
      '<button class="btn-secondary" id="privacy-btn">🛡️ ' + I18N.t('ui.settings.privacy', 'Privacy for Parents') + '</button>' +
      '<button class="btn-danger" id="reset-btn">🗑️ ' + I18N.t('ui.settings.reset', 'Reset Game Data') + '</button>' +
      '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
    root().querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { actions.setLocale(btn.dataset.lang); renderSettings(state, actions); });
    });
    document.getElementById('privacy-btn').addEventListener('click', function () { showPrivacy(); });
    document.getElementById('reset-btn').addEventListener('click', function () { showResetConfirm(actions); });
  }

  function showSettings(state, actions) {
    enqueueOrRun(function () { renderSettings(state, actions); });
  }

  // showPrivacy/showResetConfirm are only ever invoked as in-place
  // navigation from an already-open Settings modal (never as a fresh
  // top-level entry point), so — like renderMarket/renderSettings above —
  // they render directly rather than going through enqueueOrRun, which
  // would otherwise queue them behind the very modal they're replacing.
  function showPrivacy() {
    open('<h2>🛡️ ' + I18N.t('ui.settings.privacy', 'Privacy for Parents') + '</h2>' +
      '<p>' + I18N.t('ui.privacy.body', 'This game collects no personal information. Progress is saved only on your device. There are no accounts, no ads, no tracking, and no online features. You can reset all data anytime in Settings.') + '</p>' +
      '<details><summary>' + I18N.t('ui.privacy.fullToggle', 'Full notice') + '</summary>' +
      '<p class="fact">' + I18N.t('ui.privacy.fullBody',
        'We collect no personal information: no names, emails, photos or location. There are no accounts, logins or cloud saves, and no advertising, analytics or third-party tracking. Everything is stored only in this browser’s local storage on this device. You (or a parent/guardian) can erase it anytime with Reset Game Data in Settings, or by clearing this site’s data in the browser’s own settings.') + '</p>' +
      '</details>' +
      '<button class="btn-secondary" data-close>' + I18N.t('ui.shop.close', 'Close') + '</button>');
  }

  function showResetConfirm(actions) {
    open('<h2>🗑️ ' + I18N.t('ui.settings.reset', 'Reset Game Data') + '</h2>' +
      '<p>' + I18N.t('ui.settings.resetConfirm', 'This will erase all progress on this device. Are you sure?') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-danger" id="reset-yes">' + I18N.t('ui.settings.resetConfirmYes', 'Yes, Reset') + '</button>' +
      '<button class="btn-secondary" data-close>' + I18N.t('ui.settings.resetConfirmNo', 'Cancel') + '</button>' +
      '</div>');
    document.getElementById('reset-yes').addEventListener('click', function () { close(); actions.reset(); });
  }

  return {
    close: close,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    showCropShop: showCropShop,
    showAnimalShop: showAnimalShop,
    showBuildingShop: showBuildingShop,
    showUnlockPlot: showUnlockPlot,
    showAnimalInfo: showAnimalInfo,
    showBuildingRecipes: showBuildingRecipes,
    showMissionComplete: showMissionComplete,
    showFact: showFact,
    showMarket: showMarket,
    showSettings: showSettings
  };
})();
