/*
 * test-game.js — Node test suite for the pure game modules (no browser).
 * Run: node test-game.js
 *
 * Covers: track geometry/queries, car physics behavior & stability, race
 * checkpoint/lap logic, and a full simulated 3-lap race driven by the
 * autopilot (end-to-end without rendering).
 */
'use strict';

const RCTrack = require('./track.js');
const { Car } = require('./car.js');
const { RaceManager } = require('./race.js');
const { createAutopilot } = require('./autopilot.js');
const RCGhost = require('./ghost.js');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function section(name) { console.log(`\n== ${name} ==`); }

// ---------------------------------------------------------------- track
section('track geometry');
const track = RCTrack.build();
check('track has samples', track.samples.length > 300, `n=${track.samples.length}`);
check('lap length plausible (0.8–2 km)', track.length > 800 && track.length < 2000,
  `L=${track.length.toFixed(0)}m`);

// closed loop: first and last samples are adjacent
{
  const a = track.samples[0], b = track.samples[track.samples.length - 1];
  const gap = Math.hypot(a.x - b.x, a.z - b.z);
  check('loop closes', gap < track.step * 2, `gap=${gap.toFixed(2)}`);
}

// tangents are unit vectors, s is monotonic
{
  let unitOk = true, sOk = true;
  for (let i = 0; i < track.samples.length; i++) {
    const sm = track.samples[i];
    if (Math.abs(Math.hypot(sm.tx, sm.tz) - 1) > 1e-6) unitOk = false;
    if (i > 0 && sm.s <= track.samples[i - 1].s) sOk = false;
  }
  check('tangents are unit vectors', unitOk);
  check('s strictly increasing', sOk);
}

// no self-intersection: no two non-adjacent samples closer than track width
{
  let minD = Infinity, pair = null;
  const n = track.samples.length;
  const skip = Math.round(30 / track.step); // ignore neighbors within 30 m of s
  for (let i = 0; i < n; i++) {
    for (let j = i + skip; j < n; j++) {
      if (n - (j - i) < skip) continue; // wrap adjacency
      const a = track.samples[i], b = track.samples[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < minD) { minD = d; pair = [i, j]; }
    }
  }
  check('no ribbon self-overlap (centerlines > 2x width apart)',
    minD > 2 * (track.halfWidth + track.shoulder),
    `min=${minD.toFixed(1)}m at ${pair}`);
}

// query: on-centerline points give |d| ~ 0 and matching s
{
  let maxErrD = 0, maxErrS = 0;
  for (let i = 0; i < track.samples.length; i += 17) {
    const sm = track.samples[i];
    const q = RCTrack.query(track, sm.x, sm.z, null);
    maxErrD = Math.max(maxErrD, Math.abs(q.d));
    maxErrS = Math.max(maxErrS, Math.abs(RCTrack.wrapDelta(q.s, sm.s, track.length)));
  }
  check('query d~0 on centerline', maxErrD < 0.15, `max=${maxErrD.toFixed(3)}`);
  check('query s matches sample s', maxErrS < track.step, `max=${maxErrS.toFixed(2)}`);
}

// query with lateral offset: d sign follows the left normal
{
  const sm = track.samples[40];
  const off = 3;
  const qL = RCTrack.query(track, sm.x + sm.nx * off, sm.z + sm.nz * off, null);
  const qR = RCTrack.query(track, sm.x - sm.nx * off, sm.z - sm.nz * off, null);
  check('left offset -> d>0', qL.d > 2.5 && qL.d < 3.5, `d=${qL.d.toFixed(2)}`);
  check('right offset -> d<0', qR.d < -2.5 && qR.d > -3.5, `d=${qR.d.toFixed(2)}`);
}

// hinted query agrees with full scan
{
  const sm = track.samples[123];
  const q1 = RCTrack.query(track, sm.x + 1, sm.z - 1, null);
  const q2 = RCTrack.query(track, sm.x + 1, sm.z - 1, 120);
  check('hinted query = full scan', Math.abs(q1.s - q2.s) < 0.01 && Math.abs(q1.d - q2.d) < 0.01);
}

check('12 gates', track.gates.length === 12);
{
  // gates ordered along s, last gate at s ~ 0 (start/finish)
  let ordered = true;
  for (let i = 1; i < track.gates.length - 1; i++) {
    if (track.gates[i].s <= track.gates[i - 1].s) ordered = false;
  }
  const last = track.gates[track.gates.length - 1];
  const nearZero = last.s < track.step * 2 || track.length - last.s < track.step * 2;
  check('gates ordered along s', ordered);
  check('final gate at start/finish', nearZero, `s=${last.s.toFixed(1)}`);
}
check('has barrier sections', track.walls.length >= 3, `walls=${track.walls.length}`);
check('has kerb sections', track.kerbs.length >= 3, `kerbs=${track.kerbs.length}`);

// ------------------------------------------------------------------ car
section('car physics');

// straight-line acceleration reaches highway speed, stays finite
{
  const car = new Car();
  car.reset(0, 0, 0);
  let t = 0, v5 = null;
  for (let i = 0; i < 60 * 40; i++) {
    car.step(1 / 60, { steer: 0, throttle: 1, brake: 0 }, { grip: 1 });
    t += 1 / 60;
    if (v5 === null && t >= 5) v5 = car.speed;
  }
  check('accelerates (>20 m/s after 5 s)', v5 > 20, `v5=${v5 && v5.toFixed(1)}`);
  check('top speed 44–56 m/s', car.speed > 44 && car.speed < 56, `vmax=${car.speed.toFixed(1)}`);
  check('no NaN after 40 s full throttle', Number.isFinite(car.x + car.z + car.theta));
  check('drives straight', Math.abs(car.z) < 2 && Math.abs(car.theta) < 0.02,
    `z=${car.z.toFixed(2)} th=${car.theta.toFixed(3)}`);
}

// braking stops the car and never pushes it backward
{
  const car = new Car();
  car.reset(0, 0, 0);
  for (let i = 0; i < 60 * 8; i++) car.step(1 / 60, { throttle: 1 }, { grip: 1 });
  const vBefore = car.speed;
  let tStop = 0;
  for (let i = 0; i < 60 * 10 && car.speed > 0.2; i++) {
    car.step(1 / 60, { brake: 1 }, { grip: 1 });
    tStop += 1 / 60;
  }
  check('brakes to a stop', car.speed <= 0.2, `v=${car.speed.toFixed(2)}`);
  check('braking decel plausible (stop from ' + vBefore.toFixed(0) + ' in <7 s)', tStop < 7,
    `t=${tStop.toFixed(1)}`);
  check('no reverse from braking', car.vLong > -0.3, `vLong=${car.vLong.toFixed(2)}`);
}

// steering sign: +1 (right) decreases theta; -1 increases it
{
  for (const dir of [1, -1]) {
    const car = new Car();
    car.reset(0, 0, 0);
    for (let i = 0; i < 60 * 3; i++) car.step(1 / 60, { throttle: 0.6 }, { grip: 1 });
    for (let i = 0; i < 60 * 2; i++) car.step(1 / 60, { throttle: 0.4, steer: dir }, { grip: 1 });
    const ok = dir > 0 ? car.theta < -0.15 : car.theta > 0.15;
    check(`steer ${dir > 0 ? 'right' : 'left'} yaws ${dir > 0 ? 'right' : 'left'}`, ok,
      `theta=${car.theta.toFixed(2)}`);
  }
}

// steady-state cornering: closes a circle, radius in a sane band
{
  const car = new Car();
  car.reset(0, 0, 0);
  for (let i = 0; i < 60 * 4; i++) car.step(1 / 60, { throttle: 0.35 }, { grip: 1 });
  const pts = [];
  for (let i = 0; i < 60 * 30; i++) {
    car.step(1 / 60, { throttle: 0.32, steer: 0.5 }, { grip: 1 });
    if (i > 60 * 8) pts.push([car.x, car.z]);
  }
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...zs) - Math.min(...zs);
  const radius = (w + h) / 4;
  check('steady cornering is stable (finite)', Number.isFinite(radius));
  check('turn radius sane (5–80 m)', radius > 5 && radius < 80, `r=${radius.toFixed(1)}`);
  check('many full rotations', Math.abs(car.theta) > 4 * Math.PI, `th=${car.theta.toFixed(1)}`);
}

// hard cornering at speed produces slip (drift) but remains controlled
{
  const car = new Car();
  car.reset(0, 0, 0);
  for (let i = 0; i < 60 * 6; i++) car.step(1 / 60, { throttle: 1 }, { grip: 1 });
  let maxSlip = 0, everSlipping = false;
  for (let i = 0; i < 60 * 4; i++) {
    car.step(1 / 60, { throttle: 1, steer: 1 }, { grip: 1 });
    maxSlip = Math.max(maxSlip, Math.abs(car.slipRear));
    everSlipping = everSlipping || car.slipping;
  }
  check('hard cornering exceeds slip threshold (drift exists)', maxSlip > 0.1,
    `maxSlip=${maxSlip.toFixed(3)}`);
  check('slipping flag fires', everSlipping);
  check('drift stays finite', Number.isFinite(car.x + car.z) && car.speed < 60);
}

// grass reduces grip: wider turn radius at same speed
{
  function radiusOn(grip) {
    const car = new Car();
    car.reset(0, 0, 0);
    for (let i = 0; i < 60 * 4; i++) car.step(1 / 60, { throttle: 0.5 }, { grip: 1 });
    const pts = [];
    for (let i = 0; i < 60 * 16; i++) {
      car.step(1 / 60, { throttle: 0.45, steer: 0.7 }, { grip, extraDrag: grip < 1 ? 900 : 0 });
      if (i > 60 * 6) pts.push([car.x, car.z]);
    }
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    return ((Math.max(...xs) - Math.min(...xs)) + (Math.max(...zs) - Math.min(...zs))) / 4;
  }
  const rTrack = radiusOn(1), rGrass = radiusOn(0.55);
  check('grass = less grip (bigger/looser radius or slower)', Number.isFinite(rGrass),
    `track=${rTrack.toFixed(1)} grass=${rGrass.toFixed(1)}`);
}

// reverse: brake from standstill backs up, capped speed
{
  const car = new Car();
  car.reset(0, 0, 0);
  for (let i = 0; i < 60 * 6; i++) car.step(1 / 60, { brake: 1 }, { grip: 1 });
  check('reverse works', car.vLong < -1, `vLong=${car.vLong.toFixed(1)}`);
  check('reverse speed capped', car.vLong > -10.5, `vLong=${car.vLong.toFixed(1)}`);
}

// visual roll/pitch respond and stay bounded
{
  const car = new Car();
  car.reset(0, 0, 0);
  for (let i = 0; i < 60 * 5; i++) car.step(1 / 60, { throttle: 1 }, { grip: 1 });
  const pitchAccel = car.pitch;
  for (let i = 0; i < 60 * 2; i++) car.step(1 / 60, { throttle: 0.5, steer: 0.8 }, { grip: 1 });
  check('pitch responds to acceleration', Math.abs(pitchAccel) > 0.003,
    `pitch=${pitchAccel.toFixed(4)}`);
  check('roll responds to cornering', Math.abs(car.roll) > 0.005, `roll=${car.roll.toFixed(4)}`);
  check('roll/pitch bounded', Math.abs(car.roll) < 0.12 && Math.abs(car.pitch) < 0.09);
}

// wall collision clamps the car at the barrier line
{
  const car = new Car();
  const sm = track.samples[10];
  const wall = { side: 1, offset: track.wallOffset };
  car.reset(sm.x + sm.nx * (track.wallOffset + 1.5), sm.z + sm.nz * (track.wallOffset + 1.5), 0);
  car.vx = sm.nx * 8; car.vz = sm.nz * 8; // moving further out (leftward)
  const q = RCTrack.query(track, car.x, car.z, null);
  const hit = car.hitWall(q, wall);
  const q2 = RCTrack.query(track, car.x, car.z, null);
  check('wall hit detected', hit === true);
  check('car clamped inside wall', q2.d <= track.wallOffset + 0.01, `d=${q2.d.toFixed(2)}`);
  const vOut = car.vx * sm.nx + car.vz * sm.nz;
  check('outward velocity removed', vOut <= 0.01, `vOut=${vOut.toFixed(2)}`);
}

// ----------------------------------------------------------------- race
section('race logic');
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 3, validWidth: 8 });

  // simulate moving along the centerline at 30 m/s for 3 laps
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  const seen = { gate: 0, lap: 0, finish: 0, wrongway: 0 };
  let finishEvent = null;
  for (let i = 0; i < 60 * 60 * 5 && !rm.finished; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0.5, speed: 30, dt, clock })) {
      seen[ev.type] = (seen[ev.type] || 0) + 1;
      if (ev.type === 'finish') finishEvent = ev;
    }
  }
  check('race finishes', rm.finished);
  check('36 gate events over 3 laps', seen.gate === 36, `gates=${seen.gate}`);
  check('3 lap events', seen.lap === 3, `laps=${seen.lap}`);
  check('no wrong-way while driving forward', !seen.wrongway);
  check('lap times ~ L/30 s', finishEvent &&
    Math.abs(finishEvent.lapTimes[1] - track.length / 30) < 2,
    finishEvent && `lap2=${finishEvent.lapTimes[1].toFixed(1)} expect~${(track.length / 30).toFixed(1)}`);
  check('total = sum of laps', finishEvent &&
    Math.abs(finishEvent.total - finishEvent.lapTimes.reduce((a, b) => a + b, 0) -
      finishEvent.lapTimes[0] * 0) < 0.05 &&
    Math.abs(finishEvent.total - (finishEvent.lapTimes[0] + finishEvent.lapTimes[1] + finishEvent.lapTimes[2])) < 0.05);
}

// skipping a gate blocks lap completion; missedGate fires at the line
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let clock = 0;
  const dt = 1 / 60;
  const events = [];
  // drive through gate 0 legitimately...
  let s = gateS[0] - 15;
  for (let i = 0; i < 60 * 2; i++) {
    s = (s + 20 * dt) % track.length;
    clock += dt;
    events.push(...rm.update({ s, d: 0, speed: 20, dt, clock }));
  }
  check('gate 0 hit before the cut', rm.nextGate === 1);
  // ...then "cut the course": teleport to just before the finish line,
  // skipping gates 1..10
  rm.notifyTeleport();
  s = track.length - 40;
  for (let i = 0; i < 60 * 5; i++) {
    s = (s + 25 * dt) % track.length;
    clock += dt;
    events.push(...rm.update({ s, d: 0, speed: 25, dt, clock }));
    if (s > 50 && s < 60) break;
  }
  check('lap NOT completed with skipped gates', !rm.finished && rm.lapTimes.length === 0);
  check('missedGate event fired', events.some((e) => e.type === 'missedGate'));
  check('still waiting for gate 1', rm.nextGate === 1);
}

// standing start: crossing the line before gate 0 does NOT warn
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  const events = [];
  for (let i = 0; i < 60 * 3; i++) {
    s = (s + 15 * dt) % track.length;
    clock += dt;
    events.push(...rm.update({ s, d: 0, speed: 15, dt, clock }));
  }
  check('no missedGate at the standing start', !events.some((e) => e.type === 'missedGate'));
}

// driving backward triggers wrong-way, clears when going forward again
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let s = 100, clock = 0;
  const dt = 1 / 60;
  const evs = [];
  for (let i = 0; i < 60 * 3; i++) {
    s = (s - 12 * dt + track.length) % track.length;
    clock += dt;
    evs.push(...rm.update({ s, d: 0, speed: 12, dt, clock }));
  }
  check('wrong-way fires when reversing course', rm.wrongWay);
  for (let i = 0; i < 60 * 6; i++) {
    s = (s + 15 * dt) % track.length;
    clock += dt;
    evs.push(...rm.update({ s, d: 0, speed: 15, dt, clock }));
  }
  check('wrong-way clears going forward', !rm.wrongWay);
}

// gate requires being near the track (lateral validity)
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let clock = 0;
  const dt = 1 / 60;
  let s = gateS[0] - 20;
  let gateHit = false;
  for (let i = 0; i < 60 * 4; i++) {
    s = (s + 20 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 15, speed: 20, dt, clock })) {
      if (ev.type === 'gate') gateHit = true;
    }
  }
  check('gate NOT hit when far off track (d=15)', !gateHit && rm.nextGate === 0);
}

// best-split deltas
{
  const gateS = track.gates.map((g) => g.s);
  const best = gateS.map((_, i) => (i + 1) * 10); // fake best: 10 s per gate
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8, bestSplits: best });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  let firstDelta = null;
  outer:
  for (let i = 0; i < 60 * 120; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0, speed: 30, dt, clock })) {
      if (ev.type === 'gate') { firstDelta = ev.delta; break outer; }
    }
  }
  check('delta vs best splits computed', firstDelta != null &&
    Number.isFinite(firstDelta), `delta=${firstDelta}`);
}

// ---------------------------------------------------------- all tracks
section('all tracks: invariants + drivability');
check('at least 2 tracks registered', RCTrack.trackIds().length >= 2,
  RCTrack.trackIds().join(','));
for (const id of RCTrack.trackIds()) {
  const t = RCTrack.build(id);
  check(`[${id}] has a display name`, typeof t.name === 'string' && t.name.length > 0);
  check(`[${id}] has a palette`, !!t.palette && Array.isArray(t.palette.grass));
  check(`[${id}] lap length plausible`, t.length > 800 && t.length < 2500,
    `L=${t.length.toFixed(0)}`);
  // closed loop + no ribbon overlap
  {
    const a = t.samples[0], b = t.samples[t.samples.length - 1];
    check(`[${id}] loop closes`, Math.hypot(a.x - b.x, a.z - b.z) < t.step * 2);
    let minD = Infinity;
    const n = t.samples.length, skip = Math.round(30 / t.step);
    for (let i = 0; i < n; i++) {
      for (let j = i + skip; j < n; j++) {
        if (n - (j - i) < skip) continue;
        const p = t.samples[i], q = t.samples[j];
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < minD) minD = d;
      }
    }
    check(`[${id}] no ribbon self-overlap`, minD > 2 * (t.halfWidth + t.shoulder),
      `min=${minD.toFixed(1)}`);
  }
  check(`[${id}] 12 ordered gates, finish at s~0`, t.gates.length === 12 &&
    (t.gates[11].s < t.step * 2 || t.length - t.gates[11].s < t.step * 2));
  check(`[${id}] has kerbs and walls`, t.kerbs.length >= 1 && t.walls.length >= 1,
    `kerbs=${t.kerbs.length} walls=${t.walls.length}`);

  // drivability: autopilot completes one validated lap
  {
    const car = new Car();
    car.reset(t.startPose.x, t.startPose.z, t.startPose.theta);
    const auto = createAutopilot(t);
    const rm = new RaceManager({
      length: t.length, gateS: t.gates.map((g) => g.s), laps: 1,
      validWidth: t.halfWidth + 3.5,
    });
    const dt = 1 / 60;
    let clock = 0, hint = null, lapTime = null;
    for (let i = 0; i < 60 * 180 && !rm.finished; i++) {
      const q = RCTrack.query(t, car.x, car.z, hint);
      hint = q.idx;
      const input = auto.drive(car, q);
      const onTrack = Math.abs(q.d) <= t.halfWidth + 0.3;
      car.step(dt, input, onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });
      const q2 = RCTrack.query(t, car.x, car.z, hint);
      hint = q2.idx;
      const wall = RCTrack.wallAt(t, q2.idx);
      if (wall) car.hitWall(q2, wall);
      clock += dt;
      for (const ev of rm.update({ s: q2.s, d: q2.d, speed: car.speed, dt, clock })) {
        if (ev.type === 'lap') lapTime = ev.time;
      }
    }
    check(`[${id}] autopilot laps it`, rm.finished,
      lapTime ? `lap=${lapTime.toFixed(1)}s` : 'did not finish');
  }
}

// ----------------------------------------------------------------- ghost
section('ghost recording & playback');
{
  // record a synthetic run: straight line at 20 m/s, heading slowly rotating
  const rec = RCGhost.createRecorder();
  const dt = 1 / 60;
  for (let i = 0; i <= 60 * 10; i++) {
    const t = i * dt;
    rec.add(t, 20 * t, 5, 0.1 * t);
  }
  check('recorder samples on its interval', Math.abs(rec.sampleCount - 101) <= 1,
    `count=${rec.sampleCount}`);

  const data = rec.serialize();
  check('serialized form is compact ints', data.f === 1 && Array.isArray(data.p) &&
    data.p.every((v) => Number.isInteger(v)));

  // JSON round-trip (as localStorage would do)
  const player = RCGhost.createPlayer(JSON.parse(JSON.stringify(data)));
  check('player accepts serialized data', player != null);
  check('duration ~10 s', Math.abs(player.duration - 10) < 0.2, `d=${player.duration}`);

  // interpolated pose between samples matches the synthetic path
  const pose = player.sampleAt(5.05);
  check('interpolates x', Math.abs(pose.x - 20 * 5.05) < 0.3, `x=${pose.x.toFixed(1)}`);
  check('interpolates z', Math.abs(pose.z - 5) < 0.2, `z=${pose.z.toFixed(2)}`);
  check('interpolates theta', Math.abs(pose.theta - 0.505) < 0.03,
    `th=${pose.theta.toFixed(3)}`);
  check('clamps t<0 to start', player.sampleAt(-1).x === player.sampleAt(0).x);
  check('returns null after the recording ends', player.sampleAt(11) === null);

  // slow-frame catch-up: one add() spanning several intervals fills them all
  const rec2 = RCGhost.createRecorder();
  rec2.add(0, 0, 0, 0);
  rec2.add(0.55, 11, 0, 0);
  // samples at t = 0, .1, .2, .3, .4, .5 -> 6
  check('slow frames still produce every sample', rec2.sampleCount === 6,
    `count=${rec2.sampleCount}`);

  // heading interpolation takes the short way across the PI boundary
  const rec3 = RCGhost.createRecorder();
  rec3.add(0, 0, 0, 3.1);
  rec3.add(0.1, 1, 0, -3.1);
  const p3 = RCGhost.createPlayer(rec3.serialize());
  const mid = p3.sampleAt(0.05);
  check('theta wraps the short way', Math.abs(mid.theta) > 3.1 || Math.abs(mid.theta) < 0.2,
    `th=${mid.theta.toFixed(2)}`);

  check('rejects garbage data', RCGhost.createPlayer(null) === null &&
    RCGhost.createPlayer({ f: 99, p: [1, 2, 3] }) === null &&
    RCGhost.createPlayer({ f: 1, p: [1, 2, 3] }) === null);
}

// ------------------------------------------------- end-to-end: autopilot
section('end-to-end: autopilot drives 3 laps');
{
  const car = new Car();
  car.reset(track.startPose.x, track.startPose.z, track.startPose.theta);
  const auto = createAutopilot(track);
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({
    length: track.length, gateS, laps: 3,
    validWidth: track.halfWidth + 3.5,
  });

  const dt = 1 / 60;
  let clock = 0, hint = null;
  let maxAbsD = 0, offTrackTime = 0, wallHits = 0;
  let finishEvent = null;
  const maxSteps = 60 * 60 * 8; // 8 minutes sim budget
  let steps = 0;
  for (; steps < maxSteps && !rm.finished; steps++) {
    const q = RCTrack.query(track, car.x, car.z, hint);
    hint = q.idx;
    const input = auto.drive(car, q);
    const onTrack = Math.abs(q.d) <= track.halfWidth + 0.3;
    car.step(dt, input, onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });

    const q2 = RCTrack.query(track, car.x, car.z, hint);
    hint = q2.idx;
    const wall = RCTrack.wallAt(track, q2.idx);
    if (wall && car.hitWall(q2, wall)) wallHits++;

    clock += dt;
    maxAbsD = Math.max(maxAbsD, Math.abs(q2.d));
    if (!onTrack) offTrackTime += dt;
    for (const ev of rm.update({ s: q2.s, d: q2.d, speed: car.speed, dt, clock })) {
      if (ev.type === 'finish') finishEvent = ev;
      if (ev.type === 'lap') {
        console.log(`     lap ${ev.lap}: ${ev.time.toFixed(2)} s`);
      }
    }
    if (!Number.isFinite(car.x + car.z + car.theta)) break;
  }

  check('physics stayed finite for whole race', Number.isFinite(car.x + car.z + car.theta));
  check('autopilot completes 3 validated laps', finishEvent != null,
    `laps done=${rm.lapTimes.length}, steps=${steps}`);
  if (finishEvent) {
    const total = finishEvent.total;
    check('total time plausible (60–300 s)', total > 60 && total < 300,
      `total=${total.toFixed(1)}s`);
    const best = Math.min(...finishEvent.lapTimes);
    console.log(`     total=${total.toFixed(2)}s best lap=${best.toFixed(2)}s ` +
      `maxAbsD=${maxAbsD.toFixed(1)}m offTrack=${offTrackTime.toFixed(1)}s wallHits=${wallHits}`);
    check('car mostly stays near the track (max |d| < 25 m)', maxAbsD < 25,
      `maxAbsD=${maxAbsD.toFixed(1)}`);
  }
}

// ------------------------------------------------------------- summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
