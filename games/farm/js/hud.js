// DOM HUD — PLAN.md §11: top bar (coins, day/season/weather, settings),
// mission tracker chip, tool belt, and toast feedback. Pure DOM
// manipulation; game state is only ever read here, never mutated.

const Hud = (function () {
  let toastTimer = null;

  function el(id) { return document.getElementById(id); }

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

  function refreshTop(state) {
    el('coins-val').textContent = state.coins;
    const day = Simulation.currentDay(state);
    const season = Simulation.currentSeason(state);
    const weather = Simulation.currentWeather(state);
    el('day-val').textContent = I18N.t('ui.hud.day', 'Day') + ' ' + (day + 1);
    el('season-icon').textContent = SEASON_ICON[season] + ' ' + WEATHER_ICON[weather];
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
