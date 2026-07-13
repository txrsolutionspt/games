/*
 * opponents.js — AI opponents for Race mode (pure module, testable in Node).
 * Each opponent is a full physics car (RCCar.Car) driven by a skill-tuned
 * autopilot, with its own RaceManager tracking gate progression. Also
 * provides arcade car-to-car collisions (equal-mass circles) and live
 * position ranking.
 */
(function (global) {
  'use strict';

  // Roster: skill descends. lineOffset spreads the AI across the road so
  // they hold distinct lines.
  const ROSTER = [
    {
      name: 'VIPER', color: [0.16, 0.45, 0.85],
      skill: { cornerG: 7.6, vMax: 45, brakeDecel: 6.2, lineOffset: -1.5 },
    },
    {
      name: 'BLAZE', color: [0.95, 0.62, 0.1],
      skill: { cornerG: 7.0, vMax: 41, brakeDecel: 5.8, lineOffset: 1.5 },
    },
    {
      name: 'MOSS', color: [0.2, 0.62, 0.32],
      skill: { cornerG: 6.1, vMax: 36, brakeDecel: 5.2, lineOffset: 0 },
    },
  ];

  const COLLIDE_DIST = 2.7;   // m between car centers before contact resolves
  const RESTITUTION = 0.25;
  const STUCK_SPEED = 1.2;    // m/s
  const STUCK_TIME = 4;       // s of no movement before auto-recovery

  /*
   * Grid slot pose: slot 0 is the player (closest to the line); AI take
   * slots 1..N staggered behind, alternating sides.
   */
  function gridPose(track, slot) {
    const backS = 6 + slot * 6;
    const idx = RCTrack.wrapIndex(
      -Math.round(backS / track.step), track.samples.length);
    const sm = track.samples[idx];
    const side = slot === 0 ? 0 : (slot % 2 === 1 ? -1.9 : 1.9);
    return {
      x: sm.x + sm.nx * side,
      z: sm.z + sm.nz * side,
      theta: Math.atan2(sm.tz, sm.tx),
    };
  }

  function createOpponents(track, laps, defs) {
    const roster = defs || ROSTER;
    const entries = roster.map((def, i) => {
      const car = new RCCar.Car();
      const pose = gridPose(track, i + 1);
      car.reset(pose.x, pose.z, pose.theta);
      return {
        def,
        name: def.name,
        color: def.color,
        car,
        driver: RCAutopilot.createAutopilot(track, def.skill),
        rm: new RCRace.RaceManager({
          length: track.length,
          gateS: track.gates.map((g) => g.s),
          laps,
          validWidth: track.halfWidth + 3.5,
        }),
        hint: null,
        stuckTimer: 0,
        finishTime: null,
        lastQ: null,
      };
    });

    function resetToGrid() {
      entries.forEach((e, i) => {
        const pose = gridPose(track, i + 1);
        e.car.reset(pose.x, pose.z, pose.theta);
        e.hint = null;
        e.stuckTimer = 0;
        e.finishTime = null;
        e.lastQ = null;
        e.rm = new RCRace.RaceManager({
          length: track.length,
          gateS: track.gates.map((g) => g.s),
          laps,
          validWidth: track.halfWidth + 3.5,
        });
      });
    }

    // Advance all AI cars one frame. clock: shared race clock.
    function update(dt, clock) {
      for (const e of entries) {
        let q = RCTrack.query(track, e.car.x, e.car.z, e.hint);
        e.hint = q.idx;
        let input = e.driver.drive(e.car, q);
        if (e.rm.finished) {
          // cool-down: keep rolling gently instead of parking on the line
          input = { steer: input.steer, throttle: e.car.speed < 12 ? 0.25 : 0, brake: 0 };
        }
        const onTrack = Math.abs(q.d) <= track.halfWidth + 0.3;
        e.car.step(dt, input,
          onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });

        q = RCTrack.query(track, e.car.x, e.car.z, e.hint);
        e.hint = q.idx;
        e.lastQ = q;
        const wall = RCTrack.wallAt(track, q.idx);
        if (wall) e.car.hitWall(q, wall);

        for (const ev of e.rm.update({
          s: q.s, d: q.d, speed: e.car.speed, dt, clock,
        })) {
          if (ev.type === 'finish') e.finishTime = ev.total;
        }

        // auto-recovery: an AI wedged against a wall respawns at its
        // last gate rather than blocking the race forever
        if (!e.rm.finished && e.car.speed < STUCK_SPEED && input.throttle > 0.2) {
          e.stuckTimer += dt;
          if (e.stuckTimer > STUCK_TIME) {
            const s = e.rm.lastGateHitS();
            const idx = RCTrack.wrapIndex(
              Math.round(((s == null ? track.startPose.s : s)) / track.step),
              track.samples.length);
            const sm = track.samples[idx];
            e.car.reset(sm.x, sm.z, Math.atan2(sm.tz, sm.tx));
            e.hint = null;
            e.rm.notifyTeleport();
            e.stuckTimer = 0;
          }
        } else {
          e.stuckTimer = 0;
        }
      }
    }

    /*
     * Arcade car-to-car contact: equal-mass circle collision with positional
     * separation and a damped velocity exchange. cars: array of Car
     * instances (include the player's car).
     */
    function resolveCollisions(cars) {
      let contacts = 0;
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j];
          const dx = b.x - a.x, dz = b.z - a.z;
          const dist = Math.hypot(dx, dz);
          if (dist >= COLLIDE_DIST || dist < 1e-6) continue;
          contacts++;
          const nx = dx / dist, nz = dz / dist;
          const push = (COLLIDE_DIST - dist) / 2 + 0.02;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
          const relV = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (relV < 0) { // approaching
            const imp = -(1 + RESTITUTION) * relV / 2;
            a.vx -= imp * nx; a.vz -= imp * nz;
            b.vx += imp * nx; b.vz += imp * nz;
          }
        }
      }
      return contacts;
    }

    /*
     * Live standings. playerState: {rm, q, finishTime}. Returns an ordered
     * array of {name, you, finished, time, gatesPassed}; index 0 = leader.
     * Rank: finished cars by time, then running cars by gates passed with
     * distance-to-next-gate as the tiebreak.
     */
    function standings(playerState) {
      const rows = [];
      const add = (name, you, rm, q, finishTime) => {
        const gatesPassed = (rm.lap - 1) * rm.gateCount + rm.nextGate;
        let distToNext = 0;
        if (q) {
          let dAhead = rm.gateS[rm.nextGate] - q.s;
          while (dAhead < 0) dAhead += rm.L;
          distToNext = dAhead;
        }
        rows.push({ name, you, finished: rm.finished, time: finishTime, gatesPassed, distToNext });
      };
      add('YOU', true, playerState.rm, playerState.q, playerState.finishTime);
      for (const e of entries) add(e.name, false, e.rm, e.lastQ, e.finishTime);
      rows.sort((a, b) => {
        if (a.finished && b.finished) return a.time - b.time;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.gatesPassed !== b.gatesPassed) return b.gatesPassed - a.gatesPassed;
        return a.distToNext - b.distToNext;
      });
      return rows;
    }

    return { entries, update, resolveCollisions, standings, resetToGrid, gridPose };
  }

  const api = { createOpponents, ROSTER, COLLIDE_DIST, gridPose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCOpponents = api;
})(typeof window !== 'undefined' ? window : globalThis);
