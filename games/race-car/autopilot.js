/*
 * autopilot.js — simple pursuit driver used by the automated tests
 * (?auto=1 also enables it in the browser as a demo/debug mode).
 * Pure module: no BABYLON dependency, testable in Node.
 */
(function (global) {
  'use strict';

  /*
   * opts (all optional — defaults reproduce the conservative test driver):
   *   cornerG: lateral m/s^2 budget for corner speed (higher = braver)
   *   vMax: straight-line speed cap, m/s
   *   brakeDecel: assumed braking decel for brake-point distance, m/s^2
   *   lineOffset: lateral offset (m, +left) from the centerline — gives
   *     each AI opponent its own line so they don't stack
   */
  function createAutopilot(track, opts) {
    const o = Object.assign(
      { cornerG: 6.5, vMax: 38, brakeDecel: 5.5, lineOffset: 0 },
      opts || {});
    const n = track.samples.length;
    const step = track.step;

    function sampleAt(s) {
      let idx = Math.round((((s % track.length) + track.length) % track.length) / step);
      return track.samples[((idx % n) + n) % n];
    }

    // Max curvature over the next `dist` meters starting at s.
    function maxKappaAhead(s, dist) {
      let k = 0;
      const count = Math.max(1, Math.round(dist / step));
      const start = Math.round((((s % track.length) + track.length) % track.length) / step);
      for (let i = 0; i <= count; i++) {
        const sm = track.samples[(start + i) % n];
        k = Math.max(k, Math.abs(sm.kappa));
      }
      return k;
    }

    /*
     * car: {x, z, theta, speed}; q: track query at the car's position.
     * Returns {steer, throttle, brake} (steer +1 = right).
     */
    function drive(car, q) {
      const v = car.speed;
      const offTrack = Math.abs(q.d) > track.halfWidth;

      // --- steering: pursue a point on (an offset of) the centerline ahead ---
      const lookahead = offTrack ? 14 : 10 + v * 0.55;
      const target = sampleAt(q.s + lookahead);
      const tx = target.x + target.nx * o.lineOffset;
      const tz = target.z + target.nz * o.lineOffset;
      const dx = tx - car.x, dz = tz - car.z;
      const desired = Math.atan2(dz, dx);
      let err = desired - car.theta;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      // err > 0 means the target is to the LEFT; steer input +1 = right
      const steer = Math.max(-1, Math.min(1, -err * 1.4));
      const misaligned = Math.abs(err) > 0.9;

      // --- speed: brake for the tightest corner we can't yet make ---
      const brakeDist = (v * v) / (2 * o.brakeDecel) + 15;
      const kAhead = Math.max(maxKappaAhead(q.s, brakeDist), 1e-4);
      const vCorner = Math.sqrt(o.cornerG / kAhead);
      let vTarget = Math.max(8, Math.min(o.vMax, vCorner));

      // recovery: off the road or facing the wrong way -> crawl back gently
      // (heavy throttle on grass just saturates the driven rear tires)
      if (offTrack || misaligned) vTarget = Math.min(vTarget, 7);

      let throttle = 0, brake = 0;
      if (v > vTarget + 1) {
        brake = Math.max(0.3, Math.min(1, (v - vTarget) / 4));
      } else if (v < vTarget - 0.5) {
        throttle = Math.min(1, (vTarget - v) / 4 + 0.15);
        if (offTrack || misaligned) throttle = Math.min(throttle, 0.25);
        else if (Math.abs(steer) > 0.6) throttle = Math.min(throttle, 0.5);
      }
      return { steer, throttle, brake };
    }

    return { drive };
  }

  const api = { createAutopilot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCAutopilot = api;
})(typeof window !== 'undefined' ? window : globalThis);
