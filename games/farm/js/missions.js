// Mission progress tracking + "what you learned" — PLAN.md §13. Listens on
// the shared event bus so simulation/economy/input never need to know
// missions exist; on completion it awards coins and emits
// 'missionCompleted' for the UI to show a short popup with the mission's
// `learned` explainer.

const Missions = (function () {
  function ensure(state, id) {
    if (!state.missions[id]) state.missions[id] = { progress: 0, completed: false };
    return state.missions[id];
  }

  function matches(mission, payload) {
    return Object.keys(mission.match).every(function (key) {
      return payload[key] === mission.match[key];
    });
  }

  function handleEvent(state, trigger, payload) {
    MISSIONS.forEach(function (mission) {
      if (mission.trigger !== trigger) return;
      const progressState = ensure(state, mission.id);
      if (progressState.completed) return;
      if (!matches(mission, payload || {})) return;
      progressState.progress += 1;
      if (progressState.progress >= mission.count) {
        progressState.completed = true;
        Economy.addCoins(state, mission.reward.coins);
        Events.emit('missionCompleted', { mission: mission });
      }
    });
  }

  function init(state) {
    ['plant', 'harvest', 'feedAnimal', 'collectAnimal', 'process'].forEach(function (trigger) {
      Events.on(trigger, function (payload) { handleEvent(state, trigger, payload); });
    });
  }

  function activeMissions(state) {
    return MISSIONS.filter(function (m) { return !(state.missions[m.id] && state.missions[m.id].completed); });
  }

  function progressFor(state, missionId) {
    const ms = state.missions[missionId];
    return ms ? ms.progress : 0;
  }

  return { init: init, activeMissions: activeMissions, progressFor: progressFor };
})();
