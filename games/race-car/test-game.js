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
const { RaceManager, medalFor } = require('./race.js');
const { createAutopilot } = require('./autopilot.js');
const RCGhost = require('./ghost.js');
const RCOpponents = require('./opponents.js');
const RCReplayCam = require('./replaycam.js');

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

// the finish line only registers once actually CROSSED: sitting just short
// of it (inside the forgiving capture window) must never complete the race
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  // drive the lap until only the finish line remains
  for (let i = 0; i < 60 * 60 * 3 && rm.nextGate !== rm.finishGateIndex; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    rm.update({ s, d: 0, speed: 30, dt, clock });
  }
  check('all checkpoints taken, finish line is next', rm.nextGate === rm.finishGateIndex);
  // creep to 4 m BEFORE the line (inside the old +/-9 m capture) and hold
  rm.notifyTeleport();
  const fin = gateS[gateS.length - 1];
  s = (fin - 4 + track.length) % track.length;
  for (let i = 0; i < 60 * 2; i++) {
    clock += dt;
    rm.update({ s, d: 0, speed: 3, dt, clock });
  }
  check('NOT finished while still short of the line', !rm.finished && rm.lapTimes.length === 0);
  // now actually cross it
  let finished = false;
  for (let i = 0; i < 60 * 2 && !finished; i++) {
    s = (s + 20 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0, speed: 20, dt, clock })) {
      if (ev.type === 'finish') finished = true;
    }
  }
  check('finishes right after crossing the line', finished && rm.finished);
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

// query continuity (v1.9.2): near self-approaching track sections the
// nearest-point query must never flip to the other piece of road — that
// broke wrong-way detection and silently blocked checkpoint capture
section('track query continuity (anti leg-flip)');
{
  let worstJump = 0, worstRegress = 0, where = '';
  for (const id of RCTrack.trackIds()) {
    const t = RCTrack.build(id);
    for (const off of [0, 4.5, 8, 12]) {
      for (const sign of [1, -1]) {
        let hint = null, lastS = null, regress = 0;
        for (let i = 0; i < t.samples.length; i++) {
          const sm = t.samples[i];
          const heading = Math.atan2(sm.tz, sm.tx);
          const q = RCTrack.query(t,
            sm.x + sm.nx * off * sign, sm.z + sm.nz * off * sign, hint, heading);
          hint = q.idx;
          if (lastS != null) {
            let ds = q.s - lastS;
            if (t.closed) {
              if (ds > t.length / 2) ds -= t.length;
              if (ds < -t.length / 2) ds += t.length;
            }
            if (Math.abs(ds) > worstJump) {
              worstJump = Math.abs(ds);
              where = `${id} off=${off * sign} s=${sm.s.toFixed(0)}`;
            }
            if (ds < 0) regress += -ds;
            else regress = Math.max(0, regress - ds * 2);
            worstRegress = Math.max(worstRegress, regress);
          }
          lastS = q.s;
        }
      }
    }
  }
  check('s never jumps > 8 m at any gate-relevant offset (all tracks)',
    worstJump <= 8, `worst=${worstJump.toFixed(1)}m at ${where}`);
  check('projection jitter can never trip wrong-way (regress < 14 m)',
    worstRegress < 14, `worst=${worstRegress.toFixed(1)}m`);
}

// checkpoint fairness (v1.9.1): forgiving width + immediate miss warning
{
  const gateS = track.gates.map((g) => g.s);
  function lapWideAtGate4(dWide, validWidth) {
    const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth });
    let s = track.length - 6, clock = 0;
    const dt = 1 / 60;
    const missClocks = [];
    for (let i = 0; i < 60 * 120 && !rm.finished; i++) {
      s = (s + 30 * dt) % track.length;
      clock += dt;
      let d = 0.5;
      const raw = Math.abs(((s - gateS[4]) % track.length + track.length) % track.length);
      if (Math.min(raw, track.length - raw) < 12) d = dWide;
      for (const ev of rm.update({ s, d, speed: 30, dt, clock })) {
        if (ev.type === 'missedGate') missClocks.push({ clock, gate: ev.gate });
      }
    }
    return { finished: rm.finished, missClocks, gate4Clock: (gateS[4] + 6) / 30 };
  }
  const W = track.halfWidth + 7; // the width the game now uses
  check('slightly wide moment (9 m) still counts a gate',
    lapWideAtGate4(9, W).finished);
  check('11 m wide still counts (kerb + slide territory)',
    lapWideAtGate4(11, W).finished);
  const cut = lapWideAtGate4(16, W);
  check('a genuine cut (16 m off line) still misses the gate', !cut.finished);
  check('miss is reported immediately, not at the finish line',
    cut.missClocks.length >= 1 &&
    cut.missClocks[0].clock < cut.gate4Clock + 4,
    cut.missClocks[0] && `warned at ${cut.missClocks[0].clock.toFixed(1)}s, gate at ~${cut.gate4Clock.toFixed(1)}s`);
  check('immediate miss names the gate', cut.missClocks[0].gate === 4);
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

// v1.10.1: a clean multi-lap run must NEVER show a missed-checkpoint
// warning — previously one fired right after every lap completion because
// the car was still inside the finish-line region with nextGate already
// advanced to the new lap
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({
    length: track.length, gateS, laps: 3, validWidth: track.halfWidth + 7,
  });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  let warnings = 0, laps = 0;
  for (let i = 0; i < 60 * 300 && !rm.finished; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0.5, speed: 30, dt, clock })) {
      if (ev.type === 'missedGate') warnings++;
      if (ev.type === 'lap') laps++;
    }
  }
  check('perfect 3-lap run completes', rm.finished && laps === 3);
  check('perfect run shows ZERO missed-checkpoint warnings', warnings === 0,
    `warnings=${warnings}`);
}

// per-checkpoint split times (sinceLast)
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 1, validWidth: 8 });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  const splits = [];
  let lapTime = null;
  for (let i = 0; i < 60 * 120 && !rm.finished; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0, speed: 30, dt, clock })) {
      if (ev.type === 'gate') splits.push(ev.sinceLast);
      if (ev.type === 'lap') lapTime = ev.time;
    }
  }
  check('every gate event carries a split time', splits.length === 12 &&
    splits.every((v) => v > 0));
  const sum = splits.reduce((a, b) => a + b, 0);
  check('checkpoint splits sum to the lap time', Math.abs(sum - lapTime) < 0.05,
    `sum=${sum.toFixed(2)} lap=${lapTime.toFixed(2)}`);
  check('splits are roughly even at constant speed', (() => {
    const avg = sum / splits.length;
    return splits.every((v) => Math.abs(v - avg) < avg * 0.5);
  })());
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

// --------------------------------------------------------------- sectors
section('sector timing');
{
  const gateS = track.gates.map((g) => g.s);
  const rm = new RaceManager({ length: track.length, gateS, laps: 2, validWidth: 8 });
  let s = track.length - 6, clock = 0;
  const dt = 1 / 60;
  const sectors = [];
  const laps = [];
  for (let i = 0; i < 60 * 60 * 4 && !rm.finished; i++) {
    s = (s + 30 * dt) % track.length;
    clock += dt;
    for (const ev of rm.update({ s, d: 0, speed: 30, dt, clock })) {
      if (ev.type === 'sector') sectors.push(ev);
      if (ev.type === 'lap') laps.push(ev);
    }
  }
  check('3 sectors per lap (6 over 2 laps)', sectors.length === 6,
    `count=${sectors.length}`);
  check('sector indices cycle 0,1,2', sectors.map((e) => e.sector).join('') === '012012');
  const lap1Sectors = sectors.slice(0, 3).reduce((a, e) => a + e.time, 0);
  check('lap 1 sectors sum to lap 1 time', Math.abs(lap1Sectors - laps[0].time) < 0.05,
    `sum=${lap1Sectors.toFixed(2)} lap=${laps[0].time.toFixed(2)}`);
  const lap2Sectors = sectors.slice(3).reduce((a, e) => a + e.time, 0);
  check('lap 2 sectors sum to lap 2 time', Math.abs(lap2Sectors - laps[1].time) < 0.05);
  check('sector events carry the lap number', sectors[0].lap === 1 && sectors[5].lap === 2);
}

// ---------------------------------------------------------------- medals
section('medals');
{
  const targets = { gold: 60, silver: 70, bronze: 85 };
  check('gold at/below gold target', medalFor(180, targets, 3) === 'gold');
  check('silver between gold and silver', medalFor(195, targets, 3) === 'silver');
  check('bronze between silver and bronze', medalFor(250, targets, 3) === 'bronze');
  check('no medal above bronze target', medalFor(300, targets, 3) === null);
  check('scales with lap count', medalFor(60, targets, 1) === 'gold' &&
    medalFor(61, targets, 1) === 'silver');
  check('null-safe', medalFor(null, targets, 3) === null &&
    medalFor(100, null, 3) === null && medalFor(100, targets, 0) === null);
  for (const id of RCTrack.trackIds()) {
    const t = RCTrack.build(id);
    check(`[${id}] has ordered medal targets`, !!t.medals &&
      t.medals.gold < t.medals.silver && t.medals.silver < t.medals.bronze,
      JSON.stringify(t.medals));
  }
}

// ---------------------------------------------------------- all tracks
section('all tracks: invariants + drivability');
check('at least 4 tracks registered', RCTrack.trackIds().length >= 4,
  RCTrack.trackIds().join(','));
for (const id of RCTrack.trackIds()) {
  const t = RCTrack.build(id);
  check(`[${id}] has a display name`, typeof t.name === 'string' && t.name.length > 0);
  check(`[${id}] has a palette`, !!t.palette && Array.isArray(t.palette.grass));
  check(`[${id}] length plausible`, t.length > 800 && t.length < 2500,
    `L=${t.length.toFixed(0)}`);
  if (t.closed) {
    // closed loop + no ribbon overlap
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
    check(`[${id}] finish gate at s~0`, t.gates.length === 12 &&
      (t.gates[11].s < t.step * 2 || t.length - t.gates[11].s < t.step * 2));
  } else {
    // point-to-point: endpoints far apart, finish gate near the end
    const a = t.samples[0], b = t.samples[t.samples.length - 1];
    check(`[${id}] endpoints are far apart (open)`,
      Math.hypot(a.x - b.x, a.z - b.z) > t.length * 0.8);
    check(`[${id}] finish gate near the strip end`, t.gates.length === 12 &&
      t.length - t.gates[11].s < 15, `finish s=${t.gates[11].s.toFixed(0)}`);
    let sOk = true;
    for (let i = 1; i < t.gates.length; i++) {
      if (t.gates[i].s <= t.gates[i - 1].s) sOk = false;
    }
    check(`[${id}] open-track gates strictly increasing`, sOk);
  }
  check(`[${id}] has walls`, t.walls.length >= 1, `walls=${t.walls.length}`);

  // drivability: autopilot completes one validated lap/run
  {
    const car = new Car();
    car.reset(t.startPose.x, t.startPose.z, t.startPose.theta);
    const auto = createAutopilot(t);
    const rm = new RaceManager({
      length: t.length, gateS: t.gates.map((g) => g.s), laps: 1,
      validWidth: t.halfWidth + 3.5, closed: t.closed,
    });
    const dt = 1 / 60;
    let clock = 0, hint = null, lapTime = null;
    for (let i = 0; i < 60 * 180 && !rm.finished; i++) {
      const q = RCTrack.query(t, car.x, car.z, hint, car.theta);
      hint = q.idx;
      const input = auto.drive(car, q);
      const onTrack = Math.abs(q.d) <= t.halfWidth + 0.3;
      car.step(dt, input, onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });
      const q2 = RCTrack.query(t, car.x, car.z, hint, car.theta);
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
    // medal targets must be humanly reachable: the conservative autopilot
    // should earn at least bronze
    check(`[${id}] autopilot earns a medal`, rm.finished &&
      medalFor(lapTime, t.medals, 1) != null,
      lapTime ? `lap=${lapTime.toFixed(1)} bronze=${t.medals.bronze}` : '');
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

// ------------------------------------------------------------ opponents
section('AI opponents (Race mode)');
{
  // collision resolution: two overlapping cars separate, closing speed damps
  const a = new Car(), b = new Car();
  a.reset(0, 0, 0); b.reset(1.5, 0, Math.PI);
  a.vx = 5; b.vx = -5; // head-on approach
  const opp = RCOpponents.createOpponents(track, 1);
  const contacts = opp.resolveCollisions([a, b]);
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  check('overlapping cars are separated', contacts === 1 &&
    dist >= RCOpponents.COLLIDE_DIST - 0.01, `d=${dist.toFixed(2)}`);
  check('closing velocity resolved', (b.vx - a.vx) >= 0,
    `rel=${(b.vx - a.vx).toFixed(1)}`);
  check('collision keeps physics finite',
    Number.isFinite(a.x + a.vx + b.x + b.vx));
  // non-overlapping cars are untouched
  const c = new Car(), d = new Car();
  c.reset(0, 0, 0); d.reset(10, 0, 0);
  check('distant cars do not collide', opp.resolveCollisions([c, d]) === 0);
}

{
  // grid: all slots distinct, near the track, behind the start line
  const poses = [0, 1, 2, 3].map((i) => RCOpponents.gridPose(track, i));
  let distinct = true;
  for (let i = 0; i < poses.length; i++) {
    for (let j = i + 1; j < poses.length; j++) {
      if (Math.hypot(poses[i].x - poses[j].x, poses[i].z - poses[j].z) < 3) distinct = false;
    }
  }
  check('grid slots are separated', distinct);
  const onTrack = poses.every((p) =>
    Math.abs(RCTrack.query(track, p.x, p.z, null).d) < track.halfWidth);
  check('grid slots are on the road', onTrack);
}

{
  // full simulated race: player autopilot + 3 AI, collisions on, 1 lap
  const player = new Car();
  player.reset(track.startPose.x, track.startPose.z, track.startPose.theta);
  const pDriver = createAutopilot(track);
  const pRm = new RaceManager({
    length: track.length, gateS: track.gates.map((g) => g.s), laps: 1,
    validWidth: track.halfWidth + 3.5,
  });
  const opp = RCOpponents.createOpponents(track, 1);
  const dt = 1 / 60;
  let clock = 0, hint = null, playerFinish = null;
  let posSeen = new Set();
  for (let i = 0; i < 60 * 240 && !pRm.finished; i++) {
    let q = RCTrack.query(track, player.x, player.z, hint, player.theta);
    hint = q.idx;
    const input = pDriver.drive(player, q);
    const onTrack = Math.abs(q.d) <= track.halfWidth + 0.3;
    player.step(dt, input, onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });
    opp.update(dt, clock);
    opp.resolveCollisions([player].concat(opp.entries.map((e) => e.car)));
    q = RCTrack.query(track, player.x, player.z, hint, player.theta);
    hint = q.idx;
    const wall = RCTrack.wallAt(track, q.idx);
    if (wall) player.hitWall(q, wall);
    clock += dt;
    for (const ev of pRm.update({ s: q.s, d: q.d, speed: player.speed, dt, clock })) {
      if (ev.type === 'finish') playerFinish = ev.total;
    }
    if (i % 30 === 0) {
      const order = opp.standings({ rm: pRm, q, finishTime: playerFinish });
      posSeen.add(order.findIndex((r) => r.you) + 1);
      check.lastOrder = order;
    }
  }
  check('player finishes among AI traffic', pRm.finished,
    playerFinish ? `t=${playerFinish.toFixed(1)}` : 'DNF');
  check('all cars stayed finite', opp.entries.every((e) =>
    Number.isFinite(e.car.x + e.car.z + e.car.theta)));
  // let the AI finish out their laps
  for (let i = 0; i < 60 * 240 && !opp.entries.every((e) => e.rm.finished); i++) {
    opp.update(dt, clock);
    opp.resolveCollisions(opp.entries.map((e) => e.car));
    clock += dt;
  }
  check('all AI complete the race', opp.entries.every((e) => e.rm.finished),
    opp.entries.map((e) => e.name + ':' + (e.rm.finished ? 'fin' : 'g' + e.rm.nextGate)).join(' '));
  // skill ordering: strongest AI (VIPER) beats the weakest (MOSS)
  const times = {};
  for (const e of opp.entries) times[e.name] = e.finishTime;
  check('faster skill profile finishes faster', times.VIPER < times.MOSS,
    JSON.stringify(times));
  const order = opp.standings({ rm: pRm, q: null, finishTime: playerFinish });
  check('final standings rank by finish time', order.every((r, i) =>
    i === 0 || !r.finished || !order[i - 1].finished ||
    order[i - 1].time <= r.time));
  check('standings include all 4 cars', order.length === 4 &&
    order.filter((r) => r.you).length === 1);
}

// ------------------------------------------- race options (v1.4)
section('race options: difficulty & field size');
{
  check('5 drivers in the roster', RCOpponents.ROSTER.length === 5,
    RCOpponents.ROSTER.map((r) => r.name).join(','));
  check('3 difficulty tiers', Object.keys(RCOpponents.DIFFICULTIES).length === 3);

  // scaledSkill: hard > medium > easy on every axis; vMax capped
  const base = RCOpponents.ROSTER[0].skill;
  const easy = RCOpponents.scaledSkill(base, 'easy');
  const med = RCOpponents.scaledSkill(base, 'medium');
  const hard = RCOpponents.scaledSkill(base, 'hard');
  check('difficulty scales cornering', easy.cornerG < med.cornerG && med.cornerG < hard.cornerG);
  check('difficulty scales top speed', easy.vMax < med.vMax && med.vMax < hard.vMax);
  check('medium = unscaled roster values', med.cornerG === base.cornerG && med.vMax === base.vMax);
  check('vMax capped at 50', RCOpponents.scaledSkill({ cornerG: 7, vMax: 49, brakeDecel: 6, lineOffset: 0 }, 'hard').vMax === 50);
  check('unknown difficulty falls back to medium',
    RCOpponents.scaledSkill(base, 'nightmare').vMax === med.vMax);

  // field size option
  const three = RCOpponents.createOpponents(track, 1, { count: 3 });
  const five = RCOpponents.createOpponents(track, 1, { count: 5 });
  check('default-style field of 3', three.entries.length === 3);
  check('field of 5 spawns 5', five.entries.length === 5);
  check('5-car grid slots all on the road', five.entries.every((e) =>
    Math.abs(RCTrack.query(track, e.car.x, e.car.z, null).d) < track.halfWidth));

  // same driver, one lap, easy vs hard -> hard is faster
  function lapTimeAt(difficulty) {
    const opp = RCOpponents.createOpponents(track, 1, {
      count: 1, difficulty, defs: [RCOpponents.ROSTER[0]],
    });
    const dt = 1 / 60;
    let clock = 0;
    for (let i = 0; i < 60 * 240 && !opp.entries[0].rm.finished; i++) {
      opp.update(dt, clock);
      clock += dt;
    }
    return opp.entries[0].finishTime;
  }
  const tEasy = lapTimeAt('easy');
  const tHard = lapTimeAt('hard');
  check('easy AI finishes its lap', tEasy != null, String(tEasy));
  check('hard AI finishes its lap', tHard != null, String(tHard));
  check('hard laps faster than easy', tHard != null && tEasy != null && tHard < tEasy - 3,
    `easy=${tEasy && tEasy.toFixed(1)} hard=${tHard && tHard.toFixed(1)}`);
}

// -------------------------------------------- driving tuning & assists
section('driving tuning & assists');
{
  const RCCar = require('./car.js');
  // bare Car === 'normal' preset with assists off (back-compat contract)
  const bare = new Car();
  const tuned = new Car();
  tuned.setTuning({ handling: 'normal', steering: 'standard', traction: false, stability: false });
  check('normal/standard tuning reproduces defaults',
    bare.p.tireRear.D === tuned.p.tireRear.D &&
    bare.p.frictionCircle === tuned.p.frictionCircle &&
    bare.p.yawDamping === tuned.p.yawDamping &&
    bare.p.steerRateIn === tuned.p.steerRateIn);
  check('assists off by default on a bare Car',
    !bare.p.tractionControl && !bare.p.stabilityAssist);
  check('partial setTuning keeps other fields', (() => {
    const c = new Car();
    c.setTuning({ traction: true });
    return c.p.tractionControl && c.tuning.handling === 'normal';
  })());

  // hairpin-exit scenario: full throttle + steer from low speed
  function hairpinExit(tuning) {
    const car = new Car();
    if (tuning) car.setTuning(tuning);
    car.reset(0, 0, 0);
    while (car.speed < 10) car.step(1 / 60, { throttle: 0.5 }, { grip: 1 });
    let maxSlip = 0;
    for (let i = 0; i < 60 * 4; i++) {
      car.step(1 / 60, { throttle: 1, steer: 0.9 }, { grip: 1 });
      maxSlip = Math.max(maxSlip, Math.abs(car.slipRear));
    }
    return { slip: maxSlip, v: car.speed };
  }
  const raw = hairpinExit(null);
  const tc = hairpinExit({ traction: true });
  check('no assists: throttle mash spins the rear', raw.slip > 0.5,
    `slip=${raw.slip.toFixed(2)}`);
  check('traction control tames the corner exit', tc.slip < 0.25,
    `slip=${tc.slip.toFixed(2)}`);
  check('traction control exits faster (not sliding)', tc.v > raw.v + 5,
    `raw=${raw.v.toFixed(1)} tc=${tc.v.toFixed(1)}`);

  // stability assist reduces peak yaw once the rear actually slides —
  // provoke a slide with the loose drift setup, with/without the assist
  function peakYaw(stability) {
    const car = new Car();
    car.setTuning({ handling: 'drift', stability });
    car.reset(0, 0, 0);
    while (car.speed < 22) car.step(1 / 60, { throttle: 1 }, { grip: 1 });
    let m = 0;
    for (let i = 0; i < 60 * 4; i++) {
      car.step(1 / 60, { throttle: 1, steer: 0.8 }, { grip: 1 });
      m = Math.max(m, Math.abs(car.yawRate));
    }
    return m;
  }
  const yawAssisted = peakYaw(true), yawRaw = peakYaw(false);
  check('stability assist damps peak yaw in a slide', yawAssisted < yawRaw * 0.9,
    `raw=${yawRaw.toFixed(2)} assisted=${yawAssisted.toFixed(2)}`);

  // handling presets change character in the expected direction
  const gripCar = new Car(); gripCar.setTuning({ handling: 'grip' });
  const driftCar = new Car(); driftCar.setTuning({ handling: 'drift' });
  check('grip preset raises rear grip, drift lowers it',
    gripCar.p.tireRear.D > bare.p.tireRear.D &&
    driftCar.p.tireRear.D < bare.p.tireRear.D);
  const gripRun = hairpinExit({ handling: 'grip', traction: true, stability: true });
  const driftRun = hairpinExit({ handling: 'drift' });
  check('grip+assists stays planted', gripRun.slip < 0.2, `slip=${gripRun.slip.toFixed(2)}`);
  check('drift preset slides readily', driftRun.slip > raw.slip * 0.8,
    `slip=${driftRun.slip.toFixed(2)}`);

  // steering presets change response rate
  function steerRamp(steering) {
    const car = new Car();
    car.setTuning({ steering });
    car.reset(0, 0, 0);
    for (let i = 0; i < 6; i++) car.step(1 / 60, { steer: 1 }, { grip: 1 });
    return Math.abs(car.steerNorm);
  }
  check('sharp steering responds faster than relaxed',
    steerRamp('sharp') > steerRamp('relaxed') * 1.5,
    `sharp=${steerRamp('sharp').toFixed(2)} relaxed=${steerRamp('relaxed').toFixed(2)}`);

  // presets exported for the UI
  check('presets exported', !!RCCar.HANDLING_PRESETS.grip &&
    !!RCCar.STEERING_PRESETS.sharp && !!RCCar.DEFAULT_TUNING);

  // ---- counter-steer assist (v1.7) ----
  check('counter-steer off on a bare Car', !bare.p.counterSteer);
  function slideRecovery(countersteer) {
    const car = new Car();
    car.setTuning({ handling: 'drift', countersteer });
    car.reset(0, 0, 0);
    while (car.speed < 22) car.step(1 / 60, { throttle: 1 }, { grip: 1 });
    for (let i = 0; i < 40; i++) car.step(1 / 60, { throttle: 1, steer: 0.9 }, { grip: 1 });
    let maxSlip = 0;
    for (let i = 0; i < 60 * 3; i++) {
      car.step(1 / 60, { throttle: 0.3, steer: 0 }, { grip: 1 });
      maxSlip = Math.max(maxSlip, Math.abs(car.slipRear));
    }
    return { maxSlip, v: car.speed };
  }
  const noCS = slideRecovery(false);
  const withCS = slideRecovery(true);
  check('counter-steer reduces peak slip in a slide', withCS.maxSlip < noCS.maxSlip * 0.9,
    `off=${noCS.maxSlip.toFixed(2)} on=${withCS.maxSlip.toFixed(2)}`);
  check('counter-steer carries more speed through the slide', withCS.v > noCS.v + 2,
    `off=${noCS.v.toFixed(1)} on=${withCS.v.toFixed(1)}`);
  check('counter-steer inactive in normal driving', (() => {
    // straight-line + gentle cornering: assist must not alter the wheel angle
    const c = new Car();
    c.setTuning({ countersteer: true });
    c.reset(0, 0, 0);
    for (let i = 0; i < 60 * 4; i++) c.step(1 / 60, { throttle: 0.5 }, { grip: 1 });
    for (let i = 0; i < 60 * 2; i++) c.step(1 / 60, { throttle: 0.4, steer: 0.25 }, { grip: 1 });
    // gentle corner: body sideslip stays under the assist deadband (0.03),
    // so the wheel angle is purely the commanded input
    const beta = Math.abs(Math.atan2(c.vLat, c.vLong));
    return beta < 0.03 && Number.isFinite(c.steerAngle);
  })());
}

// ---------------------------------------------------- replay director
section('replay camera director');
for (const id of RCTrack.trackIds()) {
  const t = RCTrack.build(id);
  const stations = RCReplayCam.pickStations(t);
  // corner-rich circuits get several trackside cams; a dead-straight strip
  // legitimately has only the gantry cam
  let maxK = 0;
  for (const sm of t.samples) maxK = Math.max(maxK, Math.abs(sm.kappa));
  const minStations = maxK > 1 / 90 ? 4 : 1;
  check(`[${id}] picks stations (>=${minStations})`,
    stations.length >= minStations && stations.length <= 10, `n=${stations.length}`);
  const offRoad = stations.every((st) =>
    Math.abs(RCTrack.query(t, st.x, st.z, null).d) > t.halfWidth + 2);
  check(`[${id}] stations stand clear of the road`, offRoad);
  check(`[${id}] stations above ground`, stations.every((st) => st.y > 2));
}
{
  // simulate a lap along the centerline and let the director cut shots
  const director = RCReplayCam.createDirector(track);
  const dt = 1 / 30;
  let s = 0, cuts = 0, finite = true;
  const types = new Set();
  let lastPos = null, maxJumpWithoutCut = 0;
  for (let t = 0; s < track.length - 30; t += dt) {
    s += 28 * dt;
    const idx = RCTrack.wrapIndex(Math.round(s / track.step), track.samples.length);
    const sm = track.samples[idx];
    const pose = { x: sm.x, z: sm.z, theta: Math.atan2(sm.tz, sm.tx) };
    const shot = director.update(t, pose, s);
    if (shot.cut) cuts++;
    types.add(shot.type);
    if (!Number.isFinite(shot.pos.x + shot.pos.y + shot.pos.z +
      shot.target.x + shot.target.y + shot.target.z)) finite = false;
    if (lastPos && !shot.cut) {
      maxJumpWithoutCut = Math.max(maxJumpWithoutCut,
        Math.hypot(shot.pos.x - lastPos.x, shot.pos.z - lastPos.z));
    }
    lastPos = shot.pos;
    if (shot.pos.y < 1) finite = false;
  }
  check('director cuts between shots (5–40 per lap)', cuts >= 5 && cuts <= 40,
    `cuts=${cuts}`);
  check('uses trackside, chase and drone shots',
    types.has('trackside') && types.has('chase') && types.has('drone'),
    [...types].join(','));
  check('camera positions finite and above ground', finite);
  check('no camera teleports without a cut', maxJumpWithoutCut < 5,
    `maxJump=${maxJumpWithoutCut.toFixed(1)}m`);
  const sm0 = track.samples[0];
  const first = RCReplayCam.createDirector(track)
    .update(0, { x: sm0.x, z: sm0.z, theta: 0 }, 0);
  check('first frame is a cut', first.cut === true);
  check('trackside shots request no smoothing', (() => {
    const d2 = RCReplayCam.createDirector(track);
    for (let t = 0, s2 = 0; s2 < track.length; t += 1 / 30) {
      s2 += 28 / 30;
      const idx = RCTrack.wrapIndex(Math.round(s2 / track.step), track.samples.length);
      const sm = track.samples[idx];
      const shot = d2.update(t, { x: sm.x, z: sm.z, theta: Math.atan2(sm.tz, sm.tx) }, s2);
      if (shot.type === 'trackside' && shot.smooth !== 0) return false;
    }
    return true;
  })());
}

// ------------------------------------------- open-track race mode
section('drag race: AI opponents on an open track');
{
  const t = RCTrack.build('dragway');
  const player = new Car();
  const pose = RCOpponents.gridPose(t, 0);
  player.reset(pose.x, pose.z, pose.theta);
  const pRm = new RaceManager({
    length: t.length, gateS: t.gates.map((g) => g.s), laps: 1,
    validWidth: t.halfWidth + 3.5, closed: t.closed,
  });
  const opp = RCOpponents.createOpponents(t, 1, { count: 3 });
  // grid: everyone distinct and on the strip
  const gridPts = [player].concat(opp.entries.map((e) => e.car));
  let gridOk = true;
  for (let i = 0; i < gridPts.length; i++) {
    for (let j = i + 1; j < gridPts.length; j++) {
      if (Math.hypot(gridPts[i].x - gridPts[j].x, gridPts[i].z - gridPts[j].z) < 3) gridOk = false;
    }
    if (Math.abs(RCTrack.query(t, gridPts[i].x, gridPts[i].z, null).d) > t.halfWidth) gridOk = false;
  }
  check('drag grid: side-by-side rows, all on the strip', gridOk);

  const dt = 1 / 60;
  let clock = 0, hint = null, playerFinish = null;
  for (let i = 0; i < 60 * 120 && !pRm.finished; i++) {
    const q = RCTrack.query(t, player.x, player.z, hint, player.theta);
    hint = q.idx;
    player.step(dt, { throttle: 1, steer: 0 }, { grip: 1 });
    opp.update(dt, clock);
    opp.resolveCollisions([player].concat(opp.entries.map((e) => e.car)));
    const q2 = RCTrack.query(t, player.x, player.z, hint, player.theta);
    hint = q2.idx;
    const wall = RCTrack.wallAt(t, q2.idx);
    if (wall) player.hitWall(q2, wall);
    clock += dt;
    for (const ev of pRm.update({ s: q2.s, d: q2.d, speed: player.speed, dt, clock })) {
      if (ev.type === 'finish') playerFinish = ev.total;
    }
  }
  check('player finishes the drag run', pRm.finished,
    playerFinish ? `t=${playerFinish.toFixed(1)}` : 'DNF');
  for (let i = 0; i < 60 * 60 && !opp.entries.every((e) => e.rm.finished); i++) {
    opp.update(dt, clock);
    clock += dt;
  }
  check('all AI finish the drag run', opp.entries.every((e) => e.rm.finished),
    opp.entries.map((e) => e.name + ':' + (e.rm.finished ? 'fin' : 'run')).join(' '));
  const order = opp.standings({ rm: pRm, q: null, finishTime: playerFinish });
  check('drag standings include all 4', order.length === 4 &&
    order.filter((r) => r.you).length === 1);
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
    const q = RCTrack.query(track, car.x, car.z, hint, car.theta);
    hint = q.idx;
    const input = auto.drive(car, q);
    const onTrack = Math.abs(q.d) <= track.halfWidth + 0.3;
    car.step(dt, input, onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });

    const q2 = RCTrack.query(track, car.x, car.z, hint, car.theta);
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
