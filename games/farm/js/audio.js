// Tiny synthesized sound effects — PLAN.md §12. Every cue is a short
// envelope-shaped tone built live with the Web Audio API rather than an
// audio file, so there is nothing to fetch, license, or ship as an asset —
// consistent with PRIVACY.md's "runs entirely in your browser" promise.
// Named `SoundFx`, not `Audio`, to avoid shadowing the browser's own
// window.Audio (the <audio> element constructor).

const SoundFx = (function () {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    } catch (e) { return null; }
    return ctx;
  }

  // Browsers block audio output until a user gesture occurs; call this
  // from the very first tap/click (see game.js), the same constraint
  // requestFullscreen already works around elsewhere in this file.
  function unlock() {
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume().catch(function () {});
  }

  function setMuted(value) { muted = !!value; }
  function isMuted() { return muted; }

  // One short tone: quick attack, exponential decay to silence. `type` is
  // an OscillatorNode waveform ('sine'/'triangle'/'square'); `gain` is
  // kept low (0.06-0.12) across every sound below so nothing here is
  // startling on speakers or headphones.
  function tone(c, freq, startTime, duration, type, gain) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // Named cues, deliberately gentle and never buzzer/alarm-like — this
  // game never plays a "wrong" sound for a blocked action (see input.js's
  // toasts for that feedback instead), only positive reinforcement for
  // things the player actually accomplished.
  const SOUNDS = {
    plant: function (c, t) { tone(c, 440, t, 0.12, 'sine', 0.12); },
    water: function (c, t) { tone(c, 660, t, 0.08, 'sine', 0.10); tone(c, 880, t + 0.06, 0.10, 'sine', 0.08); },
    harvest: function (c, t) {
      tone(c, 523.25, t, 0.10, 'triangle', 0.12);
      tone(c, 659.25, t + 0.08, 0.10, 'triangle', 0.12);
      tone(c, 783.99, t + 0.16, 0.15, 'triangle', 0.12);
    },
    collect: function (c, t) { tone(c, 784, t, 0.10, 'sine', 0.12); tone(c, 988, t + 0.07, 0.12, 'sine', 0.10); },
    coin: function (c, t) { tone(c, 988, t, 0.07, 'square', 0.06); tone(c, 1319, t + 0.05, 0.10, 'square', 0.06); },
    spend: function (c, t) { tone(c, 392, t, 0.10, 'sine', 0.08); },
    mission: function (c, t) {
      tone(c, 523.25, t, 0.10, 'triangle', 0.12);
      tone(c, 659.25, t + 0.09, 0.10, 'triangle', 0.12);
      tone(c, 783.99, t + 0.18, 0.10, 'triangle', 0.12);
      tone(c, 1046.50, t + 0.27, 0.20, 'triangle', 0.12);
    }
  };

  function play(name) {
    if (muted) return;
    const c = ensureContext();
    if (!c || c.state === 'suspended') return; // not unlocked by a gesture yet -- silently skip, never throw
    const fn = SOUNDS[name];
    if (fn) fn(c, c.currentTime);
  }

  return { unlock: unlock, play: play, setMuted: setMuted, isMuted: isMuted };
})();
