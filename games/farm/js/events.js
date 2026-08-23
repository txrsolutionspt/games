// Tiny pub/sub event bus. Simulation/economy emit events (plant, harvest,
// feedAnimal, collectAnimal, process, sell, dayChanged, seasonChanged, ...);
// missions.js and hud.js subscribe, so gameplay logic never needs to know
// who (if anyone) is listening.

const Events = (function () {
  const handlers = {};

  function on(evt, fn) {
    (handlers[evt] = handlers[evt] || []).push(fn);
  }

  function off(evt, fn) {
    if (!handlers[evt]) return;
    handlers[evt] = handlers[evt].filter(function (h) { return h !== fn; });
  }

  function emit(evt, payload) {
    (handlers[evt] || []).slice().forEach(function (fn) { fn(payload); });
  }

  return { on: on, off: off, emit: emit };
})();
