/*
 * race.js — lap/checkpoint/timing logic (no BABYLON dependency, testable in
 * Node). Checkpoint gates must be passed in order; the last gate of each lap
 * is the start/finish line. Skipping a gate (course cut) means the lap cannot
 * complete until the player goes back — the clock keeps running.
 *
 * Emits events via the `events` array returned from update():
 *   {type:'gate', gate, globalIndex, clock, delta}   delta vs bestSplits or null
 *   {type:'sector', sector, time, lap, clock}        a track sector (third of a
 *                                                    lap) was completed
 *   {type:'lap', lap, time, clock}                   a lap was completed
 *   {type:'finish', total, lapTimes, clock}          race complete
 *   {type:'wrongway', active}                        wrong-way state changed
 *   {type:'missedGate'}                              crossed finish region while
 *                                                    checkpoints are missing
 */
(function (global) {
  'use strict';

  const CAPTURE = 9;        // m along s within which the next gate registers
  const MISS_DETECT = 80;   // m past a gate within which a miss is reported
  const REGRESS_ON = 14;    // m of net backward progress -> wrong-way warning
  const REGRESS_OFF = 4;
  const SECTORS = 3;        // timing sectors per lap

  class RaceManager {
    /*
     * opts: {
     *   length: track length (m),
     *   gateS: [s...] ordered gate positions; LAST entry is start/finish,
     *   laps: total laps,
     *   validWidth: max |d| for a gate hit to count,
     *   bestSplits: array of cumulative times per global gate index (or null),
     * }
     */
    constructor(opts) {
      this.L = opts.length;
      this.gateS = opts.gateS.slice();
      this.lapsTotal = opts.laps || 3;
      this.validWidth = opts.validWidth || 8;
      this.bestSplits = opts.bestSplits || null;
      this.closed = opts.closed !== false; // false = point-to-point sprint

      this.lap = 1;
      this.nextGate = 0;
      this.splits = [];        // cumulative clock time at each gate hit
      this.lapTimes = [];
      this.lapStartClock = 0;
      // a lap divides into SECTORS sectors of gateCount/SECTORS gates each
      this.sectorSize = Math.max(1, Math.floor(this.gateS.length / SECTORS));
      this.sectorStartClock = 0;
      this.sectorTimes = [];   // all sector times in order, across laps
      this.finished = false;
      this.wrongWay = false;
      this._regress = 0;
      this._lastS = null;
      this._missedCooldown = 0;
      this._lastAhead = null;     // progress relative to the next gate
      this._missWarnedGate = -1;  // last globalGateIndex we warned about
      this._lastGateClock = 0;    // for per-checkpoint split times
    }

    get gateCount() { return this.gateS.length; }
    get finishGateIndex() { return this.gateS.length - 1; }
    get globalGateIndex() { return (this.lap - 1) * this.gateCount + this.nextGate; }

    // Gate position/direction of the checkpoint the player must reach next.
    nextGateS() { return this.gateS[this.nextGate]; }

    // Where a manual reset should respawn: the last gate hit (or null if none).
    lastGateHitS() {
      const idx = this.nextGate - 1;
      if (this.lap === 1 && idx < 0) return null;
      return this.gateS[(idx + this.gateCount) % this.gateCount];
    }

    wrap(d) {
      if (!this.closed) return d; // open tracks: distances are plain
      if (d > this.L / 2) d -= this.L;
      if (d < -this.L / 2) d += this.L;
      return d;
    }

    // Called after a manual respawn so stale s deltas don't trip wrong-way.
    notifyTeleport() {
      this._lastS = null;
      this._regress = 0;
      this._lastAhead = null;
      if (this.wrongWay) this.wrongWay = false;
    }

    /*
     * st: {s, d, speed, dt, clock}. Returns array of events (possibly empty).
     */
    update(st) {
      const events = [];
      if (this.finished) return events;

      // --- wrong-way detection (net backward progress) ---
      if (this._lastS != null) {
        const ds = this.wrap(st.s - this._lastS);
        // a physically impossible per-frame jump (> 25 m) is projection
        // jitter (or an unnotified teleport), never real driving — never
        // feed it into the regress accumulator
        if (Math.abs(ds) <= 25) {
          if (ds < 0) this._regress += -ds;
          else this._regress = Math.max(0, this._regress - ds * 2);
        }
        const was = this.wrongWay;
        if (this._regress > REGRESS_ON && st.speed > 2) this.wrongWay = true;
        if (this._regress < REGRESS_OFF) this.wrongWay = false;
        if (was !== this.wrongWay) events.push({ type: 'wrongway', active: this.wrongWay });
      }
      this._lastS = st.s;
      if (this._missedCooldown > 0) this._missedCooldown -= st.dt;

      // --- next-gate capture ---
      const gs = this.gateS[this.nextGate];
      const ahead = this.wrap(st.s - gs); // + = past the gate, - = before it
      const isFinishGate = this.nextGate === this.finishGateIndex;
      // checkpoint gates capture on either side (forgiving), but the start/
      // finish line only counts once actually CROSSED — a lap (and the race)
      // must never complete while the car is still short of the line
      const near = isFinishGate
        ? (ahead >= 0 && ahead < CAPTURE)
        : Math.abs(ahead) < CAPTURE;
      const valid = Math.abs(st.d) < this.validWidth;

      // immediate miss detection: the player just went PAST the next gate
      // without it registering (too far off the road while crossing it).
      // Warn right away so they can turn back, instead of only at the line.
      if (!(near && valid) && st.speed > 0.5) {
        if (this._lastAhead != null &&
          this._lastAhead <= CAPTURE && ahead > CAPTURE && ahead < MISS_DETECT &&
          ahead - this._lastAhead <= 25 && // plausible frame step, not jitter
          this._missWarnedGate !== this.globalGateIndex) {
          this._missWarnedGate = this.globalGateIndex;
          events.push({ type: 'missedGate', gate: this.nextGate });
        }
        // re-arm the warning once they've come back behind the gate
        if (ahead < -CAPTURE && this._missWarnedGate === this.globalGateIndex) {
          this._missWarnedGate = -1;
        }
      }
      this._lastAhead = ahead;

      if (near && valid && st.speed > 0.5 && !this.wrongWay) {
        const globalIndex = this.globalGateIndex;
        this.splits.push(st.clock);
        let delta = null;
        if (this.bestSplits && this.bestSplits[globalIndex] != null) {
          delta = st.clock - this.bestSplits[globalIndex];
        }
        const isFinish = isFinishGate;
        const sinceLast = st.clock - this._lastGateClock;
        this._lastGateClock = st.clock;
        events.push({
          type: 'gate', gate: this.nextGate, globalIndex,
          clock: st.clock, delta, isFinish, sinceLast,
        });
        // sector boundary: every sectorSize-th gate closes a sector
        if ((this.nextGate + 1) % this.sectorSize === 0 &&
          (this.nextGate + 1) / this.sectorSize <= SECTORS) {
          const sector = (this.nextGate + 1) / this.sectorSize - 1;
          const sectorTime = st.clock - this.sectorStartClock;
          this.sectorTimes.push(sectorTime);
          this.sectorStartClock = st.clock;
          events.push({
            type: 'sector', sector, time: sectorTime, lap: this.lap, clock: st.clock,
          });
        }
        this.nextGate = (this.nextGate + 1) % this.gateCount;
        this._lastAhead = null; // tracking restarts against the new gate
        if (isFinish) {
          const lapTime = st.clock - this.lapStartClock;
          this.lapTimes.push(lapTime);
          events.push({ type: 'lap', lap: this.lap, time: lapTime, clock: st.clock });
          this.lapStartClock = st.clock;
          this.sectorStartClock = st.clock; // no-op when gates divide evenly
          this._missedCooldown = 10; // belt & braces: never warn while exiting the line zone
          if (this.lap >= this.lapsTotal) {
            this.finished = true;
            events.push({
              type: 'finish', total: st.clock,
              lapTimes: this.lapTimes.slice(), clock: st.clock,
            });
          } else {
            this.lap++;
          }
        }
      } else if (!near && valid && st.speed > 0.5) {
        // APPROACHING the finish line while it is NOT the next gate =
        // the player skipped checkpoints (course cut).
        const fin = this.gateS[this.finishGateIndex];
        const finAhead = this.wrap(st.s - fin);
        // finAhead < 0 restricts this to the approach side: right after a
        // legitimate lap completion the car is still inside the line region
        // but PAST it (finAhead > 0) with nextGate already advanced to the
        // new lap's first gate — that must never warn.
        // splits.length check: the standing start sits just before the line,
        // so crossing it before gate 0 is expected — not a course cut.
        if (finAhead > -CAPTURE && finAhead < 0 &&
          this.nextGate !== this.finishGateIndex &&
          this.splits.length > 0 && this._missedCooldown <= 0) {
          this._missedCooldown = 10;
          events.push({ type: 'missedGate' });
        }
      }
      return events;
    }
  }

  /*
   * Medal for a total race time. targets: per-lap seconds {gold, silver,
   * bronze} (from the track registry), scaled by lap count so medals work
   * for any ?laps= setting. Returns 'gold' | 'silver' | 'bronze' | null.
   */
  function medalFor(total, targets, laps) {
    if (total == null || !targets || !laps) return null;
    if (total <= targets.gold * laps) return 'gold';
    if (total <= targets.silver * laps) return 'silver';
    if (total <= targets.bronze * laps) return 'bronze';
    return null;
  }

  const api = { RaceManager, medalFor, CAPTURE, SECTORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCRace = api;
})(typeof window !== 'undefined' ? window : globalThis);
