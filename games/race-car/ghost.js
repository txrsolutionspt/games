/*
 * ghost.js — best-run ghost recording & playback (pure module, testable in
 * Node). The recorder samples the car pose on a fixed race-clock interval;
 * the serialized form quantizes to ints to keep localStorage small
 * (x/z in decimeters, theta in centiradians). The player interpolates a
 * pose for any clock time, with shortest-arc heading interpolation.
 */
(function (global) {
  'use strict';

  const FORMAT = 1;
  const INTERVAL = 0.1; // seconds of race clock between samples

  function createRecorder(interval) {
    const dt = interval || INTERVAL;
    const frames = []; // flat [x, z, theta, ...] unquantized
    let nextT = 0;

    return {
      add(clock, x, z, theta) {
        // catch up if a slow frame skipped past several sample points
        while (clock >= nextT) {
          frames.push(x, z, theta);
          nextT += dt;
        }
      },
      get sampleCount() { return frames.length / 3; },
      serialize() {
        const q = new Array(frames.length);
        for (let i = 0; i < frames.length; i += 3) {
          q[i] = Math.round(frames[i] * 10);
          q[i + 1] = Math.round(frames[i + 1] * 10);
          q[i + 2] = Math.round(frames[i + 2] * 100);
        }
        return { f: FORMAT, i: dt, p: q };
      },
    };
  }

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
  }

  /*
   * data: output of recorder.serialize() (possibly parsed back from JSON).
   * Returns null for missing/incompatible data.
   */
  function createPlayer(data) {
    if (!data || data.f !== FORMAT || !Array.isArray(data.p) || data.p.length < 6) {
      return null;
    }
    const dt = data.i || INTERVAL;
    const p = data.p;
    const count = Math.floor(p.length / 3);
    const duration = (count - 1) * dt;

    function frame(i) {
      const k = Math.max(0, Math.min(count - 1, i)) * 3;
      return { x: p[k] / 10, z: p[k + 1] / 10, theta: p[k + 2] / 100 };
    }

    return {
      duration,
      /*
       * Pose at race-clock time t, or null once the recording has ended
       * (the ghost disappears after it finishes instead of parking).
       */
      sampleAt(t) {
        if (t < 0) t = 0;
        if (t > duration) return null;
        const i = Math.floor(t / dt);
        const frac = (t - i * dt) / dt;
        const a = frame(i), b = frame(i + 1);
        return {
          x: a.x + (b.x - a.x) * frac,
          z: a.z + (b.z - a.z) * frac,
          theta: lerpAngle(a.theta, b.theta, frac),
        };
      },
    };
  }

  const api = { createRecorder, createPlayer, INTERVAL, FORMAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCGhost = api;
})(typeof window !== 'undefined' ? window : globalThis);
