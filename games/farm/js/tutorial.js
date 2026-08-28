// First-run guided sequence — PLAN.md §13. Reuses the same event bus as
// missions.js; gates which tool-belt buttons are visible so a first-time
// player can't wander into a menu before understanding the core loop.

const Tutorial = (function () {
  const STEPS = ['plant', 'water', 'harvest', 'done'];
  const TOOL_ORDER = ['plant', 'water', 'harvest'];

  function isDone(state) {
    return state.tutorialStep >= STEPS.length - 1;
  }

  function toolVisible(state, tool) {
    if (isDone(state)) return true;
    const stepIdx = TOOL_ORDER.indexOf(STEPS[state.tutorialStep]);
    const toolIdx = TOOL_ORDER.indexOf(tool);
    if (toolIdx === -1) return false; // animals/build stay hidden until the core loop is done
    return toolIdx <= stepIdx;
  }

  function advance(state, eventName) {
    if (isDone(state)) return;
    if (STEPS[state.tutorialStep] === eventName) {
      state.tutorialStep += 1;
      Events.emit('tutorialAdvanced', { step: state.tutorialStep });
    }
  }

  function init(state) {
    TOOL_ORDER.forEach(function (evt) {
      Events.on(evt, function () { advance(state, evt); });
    });
  }

  function currentMessage(state) {
    const step = STEPS[Math.min(state.tutorialStep, STEPS.length - 1)];
    const fallback = {
      plant: 'Tap Plant, choose Wheat, then tap an empty plot!',
      water: 'Now tap Water, then tap your wheat plot!',
      harvest: 'Great! Wait for it to grow, then tap Harvest and tap it again!',
      done: "You're a farmer now! Explore and grow your farm."
    }[step];
    return I18N.t('ui.tutorial.' + step, fallback);
  }

  return { isDone: isDone, toolVisible: toolVisible, init: init, currentMessage: currentMessage };
})();
