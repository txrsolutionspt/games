// DOM HUD — PLAN.md §12: left rail (coins, market/fullscreen/settings),
// a day/season/weather bar and mission tracker chip stacked across the
// top of the stage, tool belt, and toast feedback. Pure DOM manipulation;
// game state is only ever read here, never mutated.

const Hud = (function () {
  let toastTimer = null;
  let lastCoins = null;

  function el(id) { return document.getElementById(id); }

  const HUD_BUTTON_LABELS = {
    'btn-market': { key: 'ui.hud.market', fallback: 'Shop' },
    'btn-save': { key: 'ui.hud.save', fallback: 'Save' },
    'btn-fullscreen': { key: 'ui.hud.fullscreen', fallback: 'Full screen' },
    'btn-settings': { key: 'ui.hud.settings', fallback: 'Settings' }
  };

  // A young reader can't infer what a bare emoji button does, so every
  // icon in the left rail carries a short visible word underneath it too
  // (same icon+label shape the tool belt already uses) — refreshed here
  // so it re-localizes on a language switch, same as everything else in
  // this function.
  function refreshHudButtons() {
    Object.keys(HUD_BUTTON_LABELS).forEach(function (id) {
      const label = I18N.t(HUD_BUTTON_LABELS[id].key, HUD_BUTTON_LABELS[id].fallback);
      const btn = el(id);
      btn.querySelector('.hud-label').textContent = label;
      btn.setAttribute('aria-label', label);
    });
  }

  // A little bounce + color flash whenever the coin count actually
  // changes, so earning (or spending) coins reads as an event instead of
  // a number silently updating — the same "give feedback" instinct the
  // rest of the HUD already follows for toasts. Restarting the CSS
  // animation on repeat triggers needs the class removed and its layout
  // re-read (a forced reflow) before re-adding it, since re-adding a class
  // that's already present is a no-op and would skip the animation.
  function pulseCoins() {
    ['hud-coins', 'coins-val-top'].forEach(function (id) {
      const chip = el(id);
      chip.classList.remove('coin-pop');
      void chip.offsetWidth;
      chip.classList.add('coin-pop');
    });
  }

  const TOOL_LABELS = {
    plant: { icon: '🌱', key: 'ui.tool.plant', fallback: 'Plant' },
    water: { icon: '💧', key: 'ui.tool.water', fallback: 'Water' },
    harvest: { icon: '✋', key: 'ui.tool.harvest', fallback: 'Harvest' },
    animals: { icon: '🐔', key: 'ui.tool.animals', fallback: 'Animals' },
    build: { icon: '🏗️', key: 'ui.tool.build', fallback: 'Build' }
  };

  function buildToolBelt(onToolTap) {
    const belt = el('tool-belt');
    belt.innerHTML = '';
    Object.keys(TOOL_LABELS).forEach(function (tool) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.tool = tool;
      btn.innerHTML = '<span class="tool-icon">' + TOOL_LABELS[tool].icon + '</span><span class="tool-label"></span>';
      btn.addEventListener('click', function () { onToolTap(tool); });
      belt.appendChild(btn);
    });
  }

  function refreshToolBelt(state, ui) {
    const belt = el('tool-belt');
    Array.prototype.forEach.call(belt.children, function (btn) {
      const tool = btn.dataset.tool;
      const visible = Tutorial.toolVisible(state, tool);
      btn.style.display = visible ? '' : 'none';
      btn.classList.toggle('active', !!(ui.tool && toolMatchesButton(ui.tool, tool)));
      btn.querySelector('.tool-label').textContent = I18N.t(TOOL_LABELS[tool].key, TOOL_LABELS[tool].fallback);
    });
  }

  function toolMatchesButton(uiTool, button) {
    if (button === 'plant') return uiTool.type === 'plant-crop';
    if (button === 'water') return uiTool.type === 'water';
    if (button === 'harvest') return uiTool.type === 'harvest';
    if (button === 'animals') return uiTool.type === 'place-animal';
    if (button === 'build') return uiTool.type === 'place-building';
    return false;
  }

  const SEASON_LABEL = {
    spring: { key: 'ui.season.spring', fallback: 'Spring' },
    summer: { key: 'ui.season.summer', fallback: 'Summer' },
    fall: { key: 'ui.season.fall', fallback: 'Fall' },
    winter: { key: 'ui.season.winter', fallback: 'Winter' }
  };
  const WEATHER_LABEL = {
    sunny: { key: 'ui.weather.sunny', fallback: 'Sunny' },
    rainy: { key: 'ui.weather.rainy', fallback: 'Rainy' },
    cloudy: { key: 'ui.weather.cloudy', fallback: 'Cloudy' }
  };

  function refreshTop(state) {
    if (lastCoins !== null && state.coins !== lastCoins) {
      pulseCoins();
      SoundFx.play(state.coins > lastCoins ? 'coin' : 'spend');
    }
    lastCoins = state.coins;

    el('coins-val').textContent = state.coins;
    // Coins are shown twice: the left rail chip, and again here in the top
    // bar — in fullscreen on some devices the left rail chip can end up
    // hard to read (small, edge-of-screen), so the top bar copy is the
    // reliably-visible one.
    el('coins-val-top-num').textContent = state.coins;
    const day = Simulation.currentDay(state);
    const season = Simulation.currentSeason(state);
    const weather = Simulation.currentWeather(state);
    el('day-val').textContent = I18N.t('ui.hud.day', 'Day') + ' ' + (day + 1);
    el('season-val').textContent = SEASON_ICON[season] + ' ' + I18N.t(SEASON_LABEL[season].key, SEASON_LABEL[season].fallback);
    el('weather-val').textContent = WEATHER_ICON[weather] + ' ' + I18N.t(WEATHER_LABEL[weather].key, WEATHER_LABEL[weather].fallback);
  }

  function refreshMissionChip(state) {
    const chip = el('mission-chip');
    if (!Tutorial.isDone(state)) {
      chip.textContent = '📋 ' + Tutorial.currentMessage(state);
      chip.classList.remove('hidden');
      return;
    }
    const active = Missions.activeMissions(state);
    if (active.length === 0) {
      chip.classList.add('hidden');
      return;
    }
    const m = active[0];
    const progress = Missions.progressFor(state, m.id);
    const title = I18N.t('mission.' + m.id + '.title', m.title);
    const desc = I18N.t('mission.' + m.id + '.description', m.description);
    chip.textContent = '📋 ' + title + ' — ' + desc + (m.count > 1 ? ' (' + progress + '/' + m.count + ')' : '');
    chip.classList.remove('hidden');
  }

  function refresh(state, ui) {
    refreshTop(state);
    refreshMissionChip(state);
    refreshToolBelt(state, ui);
    refreshHudButtons();
  }

  function toast(message) {
    const t = el('toast-root');
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = message;
    t.appendChild(div);
    if (toastTimer) {} // multiple toasts may stack briefly; each manages its own removal
    setTimeout(function () {
      div.classList.add('toast-out');
      setTimeout(function () { div.remove(); }, 300);
    }, 1800);
  }

  return { buildToolBelt: buildToolBelt, refresh: refresh, toast: toast };
})();
