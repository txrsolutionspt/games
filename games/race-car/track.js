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

  // Centerline control points (Catmull-Rom, closed loop, counterclockwise-ish).
  // First point sits on the start/finish straight so s=0 lands there.
  const CONTROL_POINTS = [
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
  ];

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

  // Dense closed polyline through the control points.
  function densePolyline(points, subdivisions) {
    const n = points.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      for (let k = 0; k < subdivisions; k++) {
        out.push(catmullRom(p0, p1, p2, p3, k / subdivisions));
      }
    }
    return out;
  }

  // Resample a closed polyline to uniform arc-length spacing.
  function resampleUniform(poly, spacing) {
    const n = poly.length;
    const segLen = new Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      segLen[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
      total += segLen[i];
    }
    const count = Math.max(8, Math.round(total / spacing));
    const step = total / count;
    const out = [];
    let seg = 0, into = 0;
    for (let k = 0; k < count; k++) {
      const target = k * step;
      while (into + segLen[seg] < target) { into += segLen[seg]; seg = (seg + 1) % n; }
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

  function build() {
    const dense = densePolyline(CONTROL_POINTS, 16);
    const { points, length, step } = resampleUniform(dense, SAMPLE_SPACING);
    const n = points.length;

    const samples = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = points[wrapIndex(i - 1, n)];
      const next = points[wrapIndex(i + 1, n)];
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
      const a = samples[wrapIndex(i - 1, n)];
      const b = samples[wrapIndex(i + 1, n)];
      rawK[i] = angleDelta(Math.atan2(a.tz, a.tx), Math.atan2(b.tz, b.tx)) / (2 * step);
    }
    const win = Math.max(1, Math.round(5 / step));
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -win; k <= win; k++) sum += rawK[wrapIndex(i + k, n)];
      samples[i].kappa = sum / (2 * win + 1);
    }

    // Barriers on the outside of tight corners (radius < 55 m), kerbs on the
    // inside of moderate corners. side: +1 = left of travel, -1 = right.
    const padWall = Math.round(14 / step);
    const wallRegions = findRegions(samples, (sm) => Math.abs(sm.kappa) > 1 / 55, padWall);
    const walls = wallRegions.map((r) => {
      let kSum = 0;
      for (let i = r.i0; i <= r.i1; i++) kSum += samples[wrapIndex(i, n)].kappa;
      return { i0: r.i0, i1: r.i1, side: kSum > 0 ? -1 : 1, offset: WALL_OFFSET };
    });

    const padKerb = Math.round(4 / step);
    const kerbRegions = findRegions(samples, (sm) => Math.abs(sm.kappa) > 1 / 75, padKerb);
    const kerbs = kerbRegions.map((r) => {
      let kSum = 0;
      for (let i = r.i0; i <= r.i1; i++) kSum += samples[wrapIndex(i, n)].kappa;
      return { i0: r.i0, i1: r.i1, side: kSum > 0 ? 1 : -1 };
    });

    // Checkpoint gates, evenly spaced; the last gate is the start/finish line.
    const gates = [];
    for (let g = 1; g <= GATE_COUNT; g++) {
      const s = (length * g / GATE_COUNT) % length;
      const idx = wrapIndex(Math.round(s / step), n);
      const sm = samples[idx];
      gates.push({ s: sm.s, x: sm.x, z: sm.z, tx: sm.tx, tz: sm.tz, nx: sm.nx, nz: sm.nz });
    }

    // Start pose: a few meters before the start/finish line.
    const startIdx = wrapIndex(-Math.round(6 / step), n);
    const st = samples[startIdx];
    const startPose = { x: st.x, z: st.z, theta: Math.atan2(st.tz, st.tx), s: st.s };

    return {
      samples, length, step,
      halfWidth: HALF_WIDTH, shoulder: SHOULDER, wallOffset: WALL_OFFSET,
      walls, kerbs, gates, gateCount: GATE_COUNT, startPose,
    };
  }

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

  /*
   * Nearest-centerline query. hintIdx (from the previous frame) makes this
   * O(1); pass null for a full scan. Returns:
   *   { idx, s, d, tx, tz, kappa }
   * where d is the lateral offset along the left normal (d>0 = left of line).
   */
  function query(track, x, z, hintIdx) {
    const samples = track.samples;
    const n = samples.length;
    let bestIdx = 0, bestD2 = Infinity;
    if (hintIdx == null) {
      for (let i = 0; i < n; i++) {
        const dx = x - samples[i].x, dz = z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
      }
    } else {
      const R = 40;
      for (let k = -R; k <= R; k++) {
        const i = wrapIndex(hintIdx + k, n);
        const dx = x - samples[i].x, dz = z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
      }
      // hint too stale (teleport/reset) -> full scan
      if (bestD2 > 60 * 60) return query(track, x, z, null);
    }
    // refine by projecting onto the two segments adjacent to bestIdx
    let best = null;
    for (const i0 of [wrapIndex(bestIdx - 1, n), bestIdx]) {
      const a = samples[i0], b = samples[wrapIndex(i0 + 1, n)];
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
    const s = (a.s + best.t * track.step) % track.length;
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

  const api = { build, query, wallAt, wrapDelta, wrapIndex, indexInRegion, CONTROL_POINTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCTrack = api;
})(typeof window !== 'undefined' ? window : globalThis);
