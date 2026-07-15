/*
 * replaycam.js — cinematic camera director for the replay viewer (pure
 * module, testable in Node). Places trackside camera stations at the
 * track's corners and cuts between three shot types as the replayed car
 * goes around:
 *
 *   - 'trackside': static corner camera panning to follow the car
 *   - 'chase':     behind-the-car TV cam
 *   - 'drone':     high offset aerial
 *
 * The director is deterministic: shot choice depends only on the car's
 * track position and the replay time.
 */
(function (global) {
  'use strict';

  const STATION_OFFSET = 11;   // m outside the road edge
  const STATION_HEIGHT = 6;
  const STATION_WINDOW_AHEAD = 85;  // station engages when car is this close
  const STATION_WINDOW_BEHIND = 25; // ...and stays until this far past
  const ROAM_SHOT_LEN = 7;     // s between chase/drone alternation

  // Pick corner apexes: local maxima of |kappa| with a minimum separation.
  function pickStations(track) {
    const S = track.samples;
    const n = S.length;
    const minSep = Math.round(90 / track.step);
    const candidates = [];
    for (let i = 0; i < n; i++) {
      const k = Math.abs(S[i].kappa);
      if (k < 1 / 90) continue;
      let isMax = true;
      for (let w = -3; w <= 3; w++) {
        if (Math.abs(S[RCTrack.wrapIndex(i + w, n)].kappa) > k) { isMax = false; break; }
      }
      if (isMax) candidates.push({ i, k });
    }
    candidates.sort((a, b) => b.k - a.k);
    const chosen = [];
    for (const c of candidates) {
      if (chosen.every((o) => {
        const d = Math.abs(c.i - o.i);
        return Math.min(d, n - d) >= minSep;
      })) {
        chosen.push(c);
      }
      if (chosen.length >= 9) break;
    }
    const stations = chosen.map((c) => {
      const sm = S[c.i];
      const side = -Math.sign(sm.kappa) || 1; // outside of the turn
      const off = track.halfWidth + STATION_OFFSET;
      return {
        s: sm.s,
        x: sm.x + sm.nx * side * off,
        y: STATION_HEIGHT,
        z: sm.z + sm.nz * side * off,
      };
    });
    // start/finish gantry cam looking down the straight
    const st0 = S[0];
    stations.push({
      s: st0.s,
      x: st0.x + st0.nx * (track.halfWidth + 8),
      y: 7.5,
      z: st0.z + st0.nz * (track.halfWidth + 8),
    });
    stations.sort((a, b) => a.s - b.s);
    return stations;
  }

  function createDirector(track) {
    const stations = pickStations(track);
    const closed = track.closed !== false;
    const dist = (a, b) => closed ? RCTrack.wrapDelta(a, b, track.length) : a - b;
    let shotId = null;

    /*
     * pose: {x, z, theta} of the replayed car; s: its track position;
     * t: replay time. Returns {id, type, cut, pos:{x,y,z},
     * target:{x,y,z}, smooth} — `cut` true when the shot changed
     * (snap the camera), `smooth` the follow strength for moving shots.
     */
    function update(t, pose, s) {
      // engaged station: car approaching or just past one
      let station = null, stationIdx = -1;
      for (let i = 0; i < stations.length; i++) {
        const d = dist(stations[i].s, s);
        if (d > -STATION_WINDOW_BEHIND && d < STATION_WINDOW_AHEAD) {
          if (!station || Math.abs(d) < Math.abs(dist(station.s, s))) {
            station = stations[i];
            stationIdx = i;
          }
        }
      }

      let id, type, pos, target, smooth;
      const fwdX = Math.cos(pose.theta), fwdZ = Math.sin(pose.theta);
      target = { x: pose.x + fwdX * 2, y: 1.1, z: pose.z + fwdZ * 2 };

      if (station) {
        id = 'station-' + stationIdx;
        type = 'trackside';
        pos = { x: station.x, y: station.y, z: station.z };
        smooth = 0; // static camera, panning handled by target
      } else if (Math.floor(t / ROAM_SHOT_LEN) % 2 === 0) {
        id = 'chase-' + Math.floor(t / ROAM_SHOT_LEN);
        type = 'chase';
        pos = { x: pose.x - fwdX * 9.5, y: 3.4, z: pose.z - fwdZ * 9.5 };
        smooth = 5;
      } else {
        id = 'drone-' + Math.floor(t / ROAM_SHOT_LEN);
        type = 'drone';
        // hang off the car's left, high up
        const lx = -fwdZ, lz = fwdX;
        pos = { x: pose.x + lx * 20 - fwdX * 6, y: 26, z: pose.z + lz * 20 - fwdZ * 6 };
        smooth = 2.2;
      }

      const cut = id !== shotId;
      shotId = id;
      return { id, type, cut, pos, target, smooth };
    }

    return { update, stations };
  }

  const api = { createDirector, pickStations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCReplayCam = api;
})(typeof window !== 'undefined' ? window : globalThis);
