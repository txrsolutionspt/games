// Bootstrap, main loop, and wiring — PLAN.md §3/§15. This is the only file
// that owns the live `state` and ephemeral `ui` objects; every other module
// receives them as parameters rather than reaching for globals of its own.

(function () {
  // ---- Landscape lock + full screen -----------------------------------------
  // This game is laid out for landscape only (side-rail HUD/tool belt).
  // Desktop/mouse windows are never locked or auto-fullscreened — there's
  // nothing to "rotate" there, and forcing fullscreen on a desktop click
  // would be a surprising, unwanted interruption. See FarmRules.
  // shouldLockLandscape and games/last-little-farm's identical pattern.

  function isTouchDevice() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function refreshRotateText() {
    document.getElementById('rotate-title').textContent = I18N.t('ui.rotate.title', 'Rotate your device');
    document.getElementById('rotate-body').innerHTML = I18N.t('ui.rotate.body',
      'Little Farm School plays in landscape mode.<br>Turn your phone sideways to continue.');
  }

  function checkOrientation() {
    const locked = FarmRules.shouldLockLandscape(window.innerWidth, window.innerHeight, isTouchDevice());
    document.getElementById('rotate-overlay').classList.toggle('hidden', !locked);
  }

  function requestFullscreen() {
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) return;
      const p = req.call(el);
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* fullscreen is a best-effort enhancement, never required */ }
  }

  function exitFullscreen() {
    try {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) return;
      const p = exit.call(document);
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* ignore */ }
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function lockOrientationIfPossible() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (e) { /* not all browsers support/allow this; the rotate
      overlay is what actually enforces landscape play */ }
  }

  function boot() {
    const canvas = document.getElementById('farm-canvas');
    const state = Persistence.load() || createInitialState();
    // `view` (pinch/scroll zoom + drag pan on the field, see input.js) is
    // ephemeral UI state like `tool`, not saved game state — it resets to
    // the natural-size, home-cluster-centered camera on reload (the field
    // is bigger than one screen — see render.js), same as any map app.
    const ui = { tool: null, hoverIndex: -1, view: { zoom: 1, panX: 0, panY: 0 } };

    I18N.setLocale(state.settings.locale || I18N.detectLocale());

    Simulation.catchUpOffline(state);

    Missions.init(state);
    Tutorial.init(state);

    // First-time educational popups (PLAN.md §13): a fact is shown once,
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
      // Switching/creating a farm reloads the page so game.js re-boots
      // cleanly against the newly-active slot, rather than trying to
      // hot-swap state/timers/listeners mid-session. Any pending autosave
      // for the *current* farm is flushed first so leaving it never loses
      // its last few seconds of progress.
      const farmActions = {
        switchTo: function (id) {
          Persistence.saveNow(state);
          Persistence.setActiveSlotId(id);
          window.location.reload();
        },
        create: function (name) {
          Persistence.saveNow(state);
          const newId = Persistence.createSlot(name);
          Persistence.setActiveSlotId(newId);
          window.location.reload();
        },
        rename: function (id, name) {
          Persistence.renameSlot(id, name);
          Modals.showFarmSlots(farmActions);
        },
        delete: function (id) {
          const wasActive = Persistence.getActiveSlotId() === id;
          const ok = Persistence.deleteSlot(id);
          if (!ok) {
            Hud.toast(I18N.t('ui.farms.cantDeleteLast', 'You need at least one farm!'));
            Modals.showFarmSlots(farmActions);
            return;
          }
          if (wasActive) { window.location.reload(); return; }
          Modals.showFarmSlots(farmActions);
        }
      };

      Modals.showSettings(state, {
        setLocale: function (code) {
          state.settings.locale = code;
          I18N.setLocale(code);
          Hud.refresh(state, ui);
          refreshRotateText();
          Persistence.scheduleSave(state);
        },
        reset: function () {
          Persistence.reset();
          window.location.reload();
        },
        farms: farmActions
      });
    });

    // Autosave is debounced and now also flushes on hide (see below), but a
    // visible Save button gives players an explicit, immediate "yes, this
    // is saved" they can act on themselves rather than trusting a
    // background mechanism they can't see happen.
    document.getElementById('btn-save').addEventListener('click', function () {
      Persistence.saveNow(state);
      Hud.toast(I18N.t('ui.toast.saved', 'Saved!'));
    });

    document.getElementById('btn-fullscreen').addEventListener('click', function () {
      if (isFullscreen()) {
        exitFullscreen();
      } else {
        requestFullscreen();
        lockOrientationIfPossible();
      }
    });

    refreshRotateText();
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', function () { setTimeout(checkOrientation, 120); });

    // Best-effort: try to enter fullscreen (and lock landscape) on the
    // player's very first tap, since browsers require a user gesture and
    // won't allow either on page load. Silently no-ops where unsupported
    // (e.g. iPhone Safari has no Fullscreen API for non-video elements) —
    // the rotate overlay above is what actually enforces landscape play,
    // this is only a nice-to-have on top of it.
    if (isTouchDevice()) {
      document.addEventListener('pointerdown', function () {
        requestFullscreen();
        lockOrientationIfPossible();
      }, { once: true, capture: true });
    }

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
    // No immediate save-on-open: a fresh boot's state is either a brand new
    // farm (nothing worth persisting yet) or identical to what's already in
    // localStorage, so writing it right away is a redundant disk write and
    // needlessly bumps the farm's "last played" order in My Farms even if
    // the player just glanced at it and left. Scheduling the first autosave
    // ~10s out instead means it only actually happens if they're still here
    // by then; scheduleSave's shared timer means any real action in the
    // meantime reschedules straight down to the normal short debounce (see
    // persistence.js), and flushSave below still covers anyone who leaves
    // before either fires.
    Persistence.scheduleSave(state, CONFIG.initialAutosaveDelayMs);

    // The autosave in persistence.js debounces ~1s after each mutation so
    // gameplay never blocks on writes — but that means the very last action
    // before the player closes the tab, switches apps, or hits reload can
    // still be sitting in that debounce window and never gets written.
    // 'visibilitychange' (fires when a mobile browser is backgrounded, which
    // 'beforeunload' often misses) and 'pagehide' (fires on desktop tab
    // close/navigation) both flush a synchronous save immediately so the
    // debounce window is never the last word on what actually got saved.
    function flushSave() { Persistence.saveNow(state); }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSave();
    });
    window.addEventListener('pagehide', flushSave);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
