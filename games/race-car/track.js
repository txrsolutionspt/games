/*
 * track.js — pure track geometry (no BABYLON dependency, testable in Node).
 *
 * Coordinate conventions (shared by car.js / race.js / scene.js):
 *   - The track lives on the y=0 plane; positions are (x, z) in meters.
 *   - Heading theta is the angle of the forward vector in the x-z plane:
 *       fwd  = (cos(theta), sin(theta))
 *       left = (-sin(theta), cos(theta))      // +90deg from fwd
 *   - Lateral offset d from the centerline is measured along `left`
 *     (d > 0 means the point is left of the centerline w.r.t. travel).
 *   - Curvature kappa > 0 means the track turns left (theta increasing with s).
 */
(function (global) {
  'use strict';

  /*
   * Track registry. Each track: centerline control points (Catmull-Rom,
   * closed loop; the FIRST point sits on the start/finish straight so s=0
   * lands there) plus a scenery palette consumed by scene.js.
   */
  const TRACKS = {
    apex: {
      name: 'APEX GP',
      // technical: esses, chicane, carousel and a hairpin
      points: [
        [-40, -130],  // start/finish straight (heading +x)
        [80, -125],   // end of bottom straight
        [150, -90],   // turn 1 sweep
        [175, -20],   // east side, heading north
        [150, 40],    // esses kink
        [170, 100],   // northeast corner
        [110, 140],   // top, heading west
        [30, 120],    // chicane right
        [-30, 145],   // chicane left
        [-110, 130],  // top west
        [-150, 80],   // northwest carousel
        [-100, 30],   // hairpin entry
        [-40, 0],     // hairpin apex
        [-90, -30],   // hairpin exit
        [-160, -40],  // west side, heading south
        [-175, -85],  // southwest corner
        [-160, -120], // final corner onto the straight
      ],
      palette: {
        grass: [0.36, 0.55, 0.28],
        crown: [0.18, 0.42, 0.2],
        skyTop: '#4a90cf', skyMid: '#8fc3e8', skyHorizon: '#cfe6f5',
        fog: [0.66, 0.78, 0.9],
        clear: [0.62, 0.78, 0.92],
      },
      // per-lap medal target times, seconds (silver ~ the test autopilot's
      // clean-lap pace; gold demands proper racing lines)
      medals: { gold: 66, silver: 74, bronze: 88 },
    },
    coastal: {
      name: 'COASTAL RING',
      // fast and flowing: long straights, wide sweepers, one tight
      // chicane-dip and a slow final corner
      points: [
        [-40, -170],  // start/finish straight (heading +x)
        [90, -165],   // end of bottom straight
        [185, -120],  // turn 1, fast right-hand sweep begins
        [220, -10],   // east side
        [185, 95],    // northeast sweeper
        [95, 150],    // top right
        [20, 100],    // chicane dip (tight)
        [-70, 150],   // climb out
        [-175, 115],  // top left sweeper
        [-225, 5],    // west carousel
        [-185, -100], // southwest
        [-100, -125], // slow final corner
        [-115, -168], // exit kink onto the straight
      ],
      palette: {
        grass: [0.55, 0.52, 0.32],
        crown: [0.5, 0.42, 0.16],
        skyTop: '#3d7ec2', skyMid: '#9fc6e0', skyHorizon: '#f2ddb8',
        fog: [0.85, 0.8, 0.68],
        clear: [0.8, 0.78, 0.7],
      },
      medals: { gold: 60, silver: 68, bronze: 81 },
    },
    speedbowl: {
      name: 'SPEEDBOWL',
      // classic stadium oval: two long straights, two constant-radius turns,
      // concrete wall around the whole outside (speedway style)
      points: [
        [-100, -95],  // start/finish straight (heading +x)
        [100, -95],   // end of front straight
        [162, -60],   // turn 1
        [188, 0],
        [162, 60],    // turn 2
        [100, 95],    // back straight
        [-100, 95],
        [-162, 60],   // turn 3
        [-188, 0],
        [-162, -60],  // turn 4
      ],
      wallOverride: 'outer-full',
      palette: {
        grass: [0.42, 0.5, 0.3],
        crown: [0.25, 0.4, 0.22],
        skyTop: '#35548f', skyMid: '#7f8fc4', skyHorizon: '#f0c9a0',
        fog: [0.82, 0.74, 0.66],
        clear: [0.75, 0.7, 0.66],
      },
      medals: { gold: 33, silver: 39, bronze: 48 },
    },
    dragway: {
      name: 'THE DRAGWAY',
      // point-to-point: a dead-straight kilometer sprint, walled both sides.
      // One run, no laps — launch hard and hold on.
      closed: false,
      forcedLaps: 1,
      points: [
        [0, 0], [250, 0], [500, 0], [750, 0], [1000, 0],
      ],
      wallOverride: 'both-full',
      palette: {
        grass: [0.72, 0.64, 0.45],
        crown: [0.45, 0.4, 0.24],
        skyTop: '#4d7bb5', skyMid: '#a8c2d8', skyHorizon: '#efe3c4',
        fog: [0.9, 0.86, 0.74],
        clear: [0.86, 0.82, 0.72],
      },
      // a perfect full-throttle run is ~29.9 s, so gold = near-perfect launch
      medals: { gold: 30.5, silver: 32.5, bronze: 37 },
    },
  };
  const DEFAULT_TRACK = 'apex';

  const SAMPLE_SPACING = 2;     // meters between resampled centerline points
  const HALF_WIDTH = 4.75;      // drivable half-width (track is 9.5 m wide)
  const SHOULDER = 3.0;         // grass shoulder rendered beyond the road edge
  const WALL_OFFSET = HALF_WIDTH + 2.5;   // barrier distance from centerline
  const GATE_COUNT = 12;        // checkpoints per lap (last one = start/finish)

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
  }

  // Dense polyline through the control points (closed loop or open path;
  // open paths clamp the Catmull-Rom end tangents).
  function densePolyline(points, subdivisions, closed) {
    const n = points.length;
    const out = [];
    const segs = closed ? n : n - 1;
    const pt = (i) => closed
      ? points[((i % n) + n) % n]
      : points[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < segs; i++) {
      const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
      for (let k = 0; k < subdivisions; k++) {
        out.push(catmullRom(p0, p1, p2, p3, k / subdivisions));
      }
    }
    if (!closed) out.push(points[n - 1].slice());
    return out;
  }

  // Resample a polyline to uniform arc-length spacing.
  function resampleUniform(poly, spacing, closed) {
    const n = poly.length;
    const segs = closed ? n : n - 1;
    const segLen = new Array(segs);
    let total = 0;
    for (let i = 0; i < segs; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      segLen[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
      total += segLen[i];
    }
    const count = Math.max(8, Math.round(total / spacing));
    const step = total / count;
    const out = [];
    let seg = 0, into = 0;
    const samples = closed ? count : count + 1; // open paths keep the endpoint
    for (let k = 0; k < samples; k++) {
      const target = Math.min(k * step, total - 1e-6);
      while (seg < segs - 1 && into + segLen[seg] < target) { into += segLen[seg]; seg++; }
      const t = segLen[seg] > 1e-9 ? (target - into) / segLen[seg] : 0;
      const a = poly[seg], b = poly[(seg + 1) % n];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return { points: out, length: total, step };
  }

  function wrapIndex(i, n) { return ((i % n) + n) % n; }

  function angleDelta(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  // Find contiguous s-ranges where a per-sample predicate holds, extend each
  // by `pad` meters, and merge overlaps. Returns [{i0, i1}] index ranges
  // (i1 may exceed n to express wrap-around; use wrapIndex when reading).
  function findRegions(samples, predicate, padSamples) {
    const n = samples.length;
    const flags = samples.map(predicate);
    const regions = [];
    let start = -1;
    for (let i = 0; i < n; i++) {
      if (flags[i] && start === -1) start = i;
      if (!flags[i] && start !== -1) { regions.push({ i0: start, i1: i - 1 }); start = -1; }
    }
    if (start !== -1) {
      if (regions.length && flags[0] && regions[0].i0 === 0) {
        regions[0].i0 = start - n; // merge with wrap region
      } else {
        regions.push({ i0: start, i1: n - 1 });
      }
    }
    for (const r of regions) { r.i0 -= padSamples; r.i1 += padSamples; }
    // merge overlapping after padding
    regions.sort((a, b) => a.i0 - b.i0);
    const merged = [];
    for (const r of regions) {
      const last = merged[merged.length - 1];
      if (last && r.i0 <= last.i1 + 1) last.i1 = Math.max(last.i1, r.i1);
      else merged.push(r);
    }
    return merged;
  }

  function build(trackId) {
    const id = TRACKS[trackId] ? trackId : DEFAULT_TRACK;
    const def = TRACKS[id];
    const closed = def.closed !== false;
    // index lookup: wrap on loops, clamp on point-to-point tracks
    const at = closed
      ? (i, n) => wrapIndex(i, n)
      : (i, n) => Math.max(0, Math.min(n - 1, i));
    const dense = densePolyline(def.points, 16, closed);
    const { points, length, step } = resampleUniform(dense, SAMPLE_SPACING, closed);
    const n = points.length;

    const samples = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = points[at(i - 1, n)];
      const next = points[at(i + 1, n)];
      let tx = next[0] - prev[0], tz = next[1] - prev[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      samples[i] = {
        x: points[i][0], z: points[i][1],
        s: i * step,
        tx, tz,
        nx: -tz, nz: tx, // left normal
        kappa: 0,
      };
    }
    // curvature from tangent angle change (then smooth over ~10 m)
    const rawK = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = samples[at(i - 1, n)];
      const b = samples[at(i + 1, n)];
      rawK[i] = angleDelta(Math.atan2(a.tz, a.tx), Math.atan2(b.tz, b.tx)) / (2 * step);
    }
    const win = Math.max(1, Math.round(5 / step));
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -win; k <= win; k++) sum += rawK[at(i + k, n)];
      samples[i].kappa = sum / (2 * win + 1);
    }

    // Barriers on the outside of tight corners (radius < 55 m), kerbs on the
    // inside of moderate corners. side: +1 = left of travel, -1 = right.
    // Tracks can override barrier placement: 'outer-full' walls the entire
    // outside (speedway), 'both-full' walls both sides (drag strip).
    let walls;
    if (def.wallOverride === 'outer-full') {
      // outside = opposite the dominant turn direction
      let kTotal = 0;
      for (const sm of samples) kTotal += sm.kappa;
      const side = kTotal > 0 ? -1 : 1;
      walls = [{ i0: 0, i1: n - 1, side, offset: WALL_OFFSET }];
    } else if (def.wallOverride === 'both-full') {
      walls = [
        { i0: 0, i1: n - 1, side: 1, offset: WALL_OFFSET },
        { i0: 0, i1: n - 1, side: -1, offset: WALL_OFFSET },
      ];
    } else {
      const padWall = Math.round(14 / step);
      const wallRegions = findRegions(samples, (sm) => Math.abs(sm.kappa) > 1 / 55, padWall);
      walls = wallRegions.map((r) => {
        let kSum = 0;
        for (let i = r.i0; i <= r.i1; i++) kSum += samples[wrapIndex(i, n)].kappa;
        return { i0: r.i0, i1: r.i1, side: kSum > 0 ? -1 : 1, offset: WALL_OFFSET };
      });
    }

    const padKerb = Math.round(4 / step);
    const kerbRegions = findRegions(samples, (sm) => Math.abs(sm.kappa) > 1 / 75, padKerb);
    const kerbs = kerbRegions.map((r) => {
      let kSum = 0;
      for (let i = r.i0; i <= r.i1; i++) kSum += samples[wrapIndex(i, n)].kappa;
      return { i0: r.i0, i1: r.i1, side: kSum > 0 ? 1 : -1 };
    });

    // Checkpoint gates, evenly spaced; the last gate is the finish line.
    // Loops: finish at s=0 (start/finish). Open tracks: finish shortly
    // before the pavement ends so the capture window fits.
    const gates = [];
    const gateSpan = closed ? length : length - 10;
    for (let g = 1; g <= GATE_COUNT; g++) {
      const s = closed ? (length * g / GATE_COUNT) % length : gateSpan * g / GATE_COUNT;
      const idx = at(Math.round(s / step), n);
      const sm = samples[idx];
      gates.push({ s: sm.s, x: sm.x, z: sm.z, tx: sm.tx, tz: sm.tz, nx: sm.nx, nz: sm.nz });
    }

    // Start pose: just before the line on loops, at the strip head on
    // open tracks.
    const startIdx = closed
      ? wrapIndex(-Math.round(6 / step), n)
      : Math.round(5 / step);
    const st = samples[startIdx];
    const startPose = { x: st.x, z: st.z, theta: Math.atan2(st.tz, st.tx), s: st.s };

    return {
      id, name: def.name, palette: def.palette, medals: def.medals,
      closed, forcedLaps: def.forcedLaps || null,
      samples, length, step,
      halfWidth: HALF_WIDTH, shoulder: SHOULDER, wallOffset: WALL_OFFSET,
      walls, kerbs, gates, gateCount: GATE_COUNT, startPose,
    };
  }

  // Ordered list of selectable track ids.
  function trackIds() { return Object.keys(TRACKS); }

  // Signed shortest wrap-around difference a-b on a loop of length L.
  function wrapDelta(a, b, L) {
    let d = a - b;
    if (d > L / 2) d -= L;
    if (d < -L / 2) d += L;
    return d;
  }

  // Is sample index i inside region r (regions may use out-of-range indices
  // to express wrap-around)?
  function indexInRegion(i, r, n) {
    for (const base of [i, i - n, i + n]) {
      if (base >= r.i0 && base <= r.i1) return true;
    }
    return false;
  }

  // Weight (in m^2 of squared-distance equivalent) for tangent/heading
  // misalignment when a heading is supplied. Two legs of a hairpin have
  // opposite tangents, so the wrong leg pays up to 2*ALIGN_W — it can only
  // win when the car has genuinely moved onto it.
  const ALIGN_W = 225;

  /*
   * Nearest-centerline query. hintIdx (from the previous frame) makes this
   * O(1); pass null for a full scan. heading (radians, optional) breaks
   * ties between nearby pieces of road in favor of the one pointing the
   * way the car does. Returns:
   *   { idx, s, d, tx, tz, kappa }
   * where d is the lateral offset along the left normal (d>0 = left of line).
   */
  function query(track, x, z, hintIdx, heading) {
    const samples = track.samples;
    const n = samples.length;
    const closed = track.closed !== false;
    const at = closed
      ? (i) => wrapIndex(i, n)
      : (i) => Math.max(0, Math.min(n - 1, i));
    const hx = heading != null ? Math.cos(heading) : 0;
    const hz = heading != null ? Math.sin(heading) : 0;
    const alignCost = heading != null
      ? (sm) => (1 - (sm.tx * hx + sm.tz * hz)) * ALIGN_W
      : () => 0;
    let bestIdx = 0, bestD2 = Infinity;
    if (hintIdx == null) {
      let bestCost = Infinity;
      for (let i = 0; i < n; i++) {
        const dx = x - samples[i].x, dz = z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        const cost = d2 + alignCost(samples[i]);
        if (cost < bestCost) { bestCost = cost; bestD2 = d2; bestIdx = i; }
      }
    } else {
      /*
       * Continuity beats proximity: where two parts of the track pass close
       * together (hairpins, kinks near straights, anything near the lap
       * wrap), the globally nearest centerline point can belong to the
       * OTHER piece of road, making s jump by tens or hundreds of meters —
       * which broke wrong-way detection and checkpoint capture. A car
       * moves only a few samples per frame, so candidates far from the
       * hint pay a distance penalty: the other leg can win only when the
       * car has genuinely left this one (and the stale-hint rescan below
       * catches full teleports).
       */
      const R = 40;
      let bestCost = Infinity;
      for (let k = -R; k <= R; k++) {
        const i = at(hintIdx + k);
        const dx = x - samples[i].x, dz = z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        const excess = Math.max(0, Math.abs(k) - 4); // free within ~8 m of travel
        const penalty = excess * track.step * 1.5;
        const cost = d2 + penalty * penalty + alignCost(samples[i]);
        if (cost < bestCost) { bestCost = cost; bestIdx = i; bestD2 = d2; }
      }
      // hint genuinely stale (teleport without notification) -> full scan
      if (bestD2 > 60 * 60) return query(track, x, z, null, heading);
    }
    // refine by projecting onto the two segments adjacent to bestIdx
    let best = null;
    for (const i0 of [at(bestIdx - 1), Math.min(bestIdx, closed ? n - 1 : n - 2)]) {
      const a = samples[i0], b = samples[at(i0 + 1)];
      const abx = b.x - a.x, abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      let t = len2 > 1e-9 ? ((x - a.x) * abx + (z - a.z) * abz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + abx * t, pz = a.z + abz * t;
      const dx = x - px, dz = z - pz;
      const d2 = dx * dx + dz * dz;
      if (!best || d2 < best.d2) best = { i0, t, px, pz, d2 };
    }
    const a = samples[best.i0];
    const sRaw = a.s + best.t * track.step;
    const s = closed ? sRaw % track.length : Math.min(sRaw, track.length);
    const d = (x - best.px) * a.nx + (z - best.pz) * a.nz;
    return { idx: bestIdx, s, d, tx: a.tx, tz: a.tz, kappa: a.kappa };
  }

  // Barrier lookup: if sample idx falls in a wall region, return that wall.
  function wallAt(track, idx) {
    const n = track.samples.length;
    for (const w of track.walls) {
      if (indexInRegion(idx, w, n)) return w;
    }
    return null;
  }

  const api = {
    build, query, wallAt, wrapDelta, wrapIndex, indexInRegion,
    TRACKS, DEFAULT_TRACK, trackIds,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCTrack = api;
})(typeof window !== 'undefined' ? window : globalThis);
