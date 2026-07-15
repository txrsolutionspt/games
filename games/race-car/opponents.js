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
  // they hold distinct lines. The first `count` drivers race (so a 3-car
  // field is VIPER/BLAZE/MOSS, the same pack as v1.3).
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
    {
      name: 'NOVA', color: [0.62, 0.3, 0.85],
      skill: { cornerG: 7.3, vMax: 43, brakeDecel: 6.0, lineOffset: -0.8 },
    },
    {
      name: 'FROST', color: [0.35, 0.75, 0.8],
      skill: { cornerG: 6.5, vMax: 38, brakeDecel: 5.5, lineOffset: 0.8 },
    },
  ];

  // Difficulty scales every driver's skill profile together.
  const DIFFICULTIES = {
    easy: { label: 'EASY', cornerG: 0.8, vMax: 0.85, brakeDecel: 0.92 },
    medium: { label: 'MEDIUM', cornerG: 1, vMax: 1, brakeDecel: 1 },
    hard: { label: 'HARD', cornerG: 1.13, vMax: 1.12, brakeDecel: 1.08 },
  };

  function scaledSkill(skill, difficulty) {
    const d = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    return {
      cornerG: skill.cornerG * d.cornerG,
      vMax: Math.min(50, skill.vMax * d.vMax), // physics tops out ~51 m/s
      brakeDecel: skill.brakeDecel * d.brakeDecel,
      lineOffset: skill.lineOffset,
    };
  }

  const COLLIDE_DIST = 2.7;   // m between car centers before contact resolves
  const RESTITUTION = 0.25;
  const STUCK_SPEED = 1.2;    // m/s
  const STUCK_TIME = 4;       // s of no movement before auto-recovery

  /*
   * Grid slot pose. Loops: slot 0 (player) closest to the line, AI
   * staggered behind, alternating sides. Open tracks (drag strips):
   * two-wide rows launching from the strip head.
   */
  function gridPose(track, slot) {
    const n = track.samples.length;
    let idx, side;
    if (track.closed === false) {
      const row = Math.floor(slot / 2);
      idx = Math.min(n - 1, Math.round((5 + row * 8) / track.step));
      side = slot % 2 === 0 ? 2.1 : -2.1;
    } else {
      idx = RCTrack.wrapIndex(-Math.round((6 + slot * 6) / track.step), n);
      side = slot === 0 ? 0 : (slot % 2 === 1 ? -1.9 : 1.9);
    }
    const sm = track.samples[idx];
    return {
      x: sm.x + sm.nx * side,
      z: sm.z + sm.nz * side,
      theta: Math.atan2(sm.tz, sm.tx),
    };
  }

  /*
   * opts: { count: field size (default 3, capped at roster size),
   *         difficulty: 'easy' | 'medium' | 'hard' (default 'medium'),
   *         defs: roster override (tests) }
   */
  function createOpponents(track, laps, opts) {
    const o = opts || {};
    const difficulty = DIFFICULTIES[o.difficulty] ? o.difficulty : 'medium';
    const roster = (o.defs || ROSTER).slice(0,
      Math.max(1, Math.min(o.count || 3, (o.defs || ROSTER).length)));
    const entries = roster.map((def, i) => {
      const car = new RCCar.Car();
      const pose = gridPose(track, i + 1);
      car.reset(pose.x, pose.z, pose.theta);
      return {
        def,
        name: def.name,
        color: def.color,
        car,
        driver: RCAutopilot.createAutopilot(track, scaledSkill(def.skill, difficulty)),
        rm: new RCRace.RaceManager({
          length: track.length,
          gateS: track.gates.map((g) => g.s),
          laps,
          validWidth: track.halfWidth + 7,
          closed: track.closed,
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
          validWidth: track.halfWidth + 7,
          closed: track.closed,
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

  const api = {
    createOpponents, ROSTER, DIFFICULTIES, scaledSkill, COLLIDE_DIST, gridPose,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCOpponents = api;
})(typeof window !== 'undefined' ? window : globalThis);
