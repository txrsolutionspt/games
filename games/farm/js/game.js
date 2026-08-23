// Bootstrap, main loop, and wiring — PLAN.md §3/§15. This is the only file
// that owns the live `state` and ephemeral `ui` objects; every other module
// receives them as parameters rather than reaching for globals of its own.

(function () {
  function boot() {
    const canvas = document.getElementById('farm-canvas');
    const state = Persistence.load() || createInitialState();
    const ui = { tool: null, hoverIndex: -1 };

    I18N.setLocale(state.settings.locale || I18N.detectLocale());

    Simulation.catchUpOffline(state);

    Missions.init(state);
    Tutorial.init(state);

    // First-time educational popups (PLAN.md §12): a fact is shown once,
    // the first time it becomes relevant, never on every repeat action.
    // Anyone curious afterward can re-open it via the "i" info tooltip on
    // the tile itself (input.js showCropInfo) or the recipe/animal cards.
    Events.on('harvest', function (payload) {
      const key = 'crop.' + payload.crop;
      if (state.seenFacts[key]) return;
      state.seenFacts[key] = true;
      const def = CROPS_BY_ID[payload.crop];
      Modals.showFact(I18N.t('crop.' + def.id + '.name', def.name), def.icon, I18N.t('crop.' + def.id + '.fact', def.educational));
    });
    Events.on('process', function (payload) {
      const key = 'recipe.' + payload.recipe;
      if (state.seenFacts[key]) return;
      state.seenFacts[key] = true;
      const def = RECIPES_BY_ID[payload.recipe];
      Modals.showFact(I18N.t('recipe.' + def.id + '.name', def.name), '✨', I18N.t('recipe.' + def.id + '.fact', def.educational));
    });
    Events.on('missionCompleted', function (payload) {
      Modals.showMissionComplete(payload.mission);
      Hud.refresh(state, ui);
    });
    Events.on('tick', function () {
      Hud.refresh(state, ui);
    });

    Input.setupToolBelt(state, ui, canvas);
    Input.setupCanvas(state, ui, canvas);

    document.getElementById('btn-market').addEventListener('click', function () {
      Modals.showMarket(state, function (itemId) {
        Input.sellItem(state, itemId);
        Hud.refresh(state, ui);
      });
    });

    document.getElementById('btn-settings').addEventListener('click', function () {
      Modals.showSettings(state, {
        setLocale: function (code) {
          state.settings.locale = code;
          I18N.setLocale(code);
          Hud.refresh(state, ui);
          Persistence.scheduleSave(state);
        },
        reset: function () {
          Persistence.reset();
          window.location.reload();
        }
      });
    });

    Render.resize(canvas);
    // Re-sync geometry on any actual box change, not just window resize:
    // the mission chip and tool belt change height as the tutorial reveals
    // more buttons and longer/shorter messages, which shifts the canvas's
    // own box without a window-level resize event ever firing.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { Render.resize(canvas); }).observe(canvas);
    } else {
      window.addEventListener('resize', function () { Render.resize(canvas); });
    }

    Simulation.start(state);

    function frame() {
      Render.draw(canvas, state, ui);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    Hud.refresh(state, ui);
    Persistence.saveNow(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
