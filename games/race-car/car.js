/*
 * car.js — semi-simulation vehicle physics (no BABYLON dependency, testable
 * in Node). Single rigid body + bicycle tire model:
 *
 *   - slip-angle-based lateral tire forces (Pacejka-lite curve) per axle
 *   - longitudinal load transfer affecting per-axle grip
 *   - friction-circle coupling (braking/throttle consumes lateral grip)
 *   - speed-sensitive steering, rear-wheel drive, automatic "gearbox"
 *     (power-limited engine force curve, no shifting)
 *   - visual roll/pitch derived from lateral/longitudinal acceleration
 *
 * Conventions (see track.js): theta is the heading angle in the x-z plane,
 * fwd = (cos theta, sin theta), left = (-sin theta, cos theta).
 * Positive yawRate = turning left. steerInput +1 = steer RIGHT.
 */
(function (global) {
  'use strict';

  const G = 9.81;

  const DEFAULTS = {
    mass: 1180,          // kg
    inertia: 1650,       // yaw inertia, kg m^2
    a: 1.15,             // CG -> front axle, m
    b: 1.45,             // CG -> rear axle, m
    cgHeight: 0.52,      // m, for longitudinal load transfer
    wheelRadius: 0.33,

    engineForce: 8400,   // N, low-speed traction cap
    enginePower: 118000, // W, limits force at speed (top speed ~ 51 m/s)
    reverseForce: 4200,
    maxReverseSpeed: 9,  // m/s

    brakeForce: 11800,   // N total
    brakeBias: 0.62,     // fraction to the front axle

    dragCoef: 0.75,      // N per (m/s)^2
    rollA: 150,          // N constant rolling resistance
    rollB: 3.0,          // N per m/s

    // Pacejka-lite per-axle tire curve: Fy = -D*Fz * sin(C * atan(B * slip)).
    // Front peaks earlier/sharper than the rear so the limit behavior is
    // understeer with a progressive (catchable) rear; power-oversteer still
    // comes from the friction circle when the driven rear axle is loaded up.
    tireFront: { B: 8.0, C: 1.5, D: 0.98 },
    tireRear: { B: 10.0, C: 1.15, D: 1.18 },

    steerMax: 0.55,      // rad at standstill
    steerSpeedRef: 20,   // m/s; steerMax/(1+v/ref) = available angle at speed
    steerRateIn: 3.0,    // normalized units/s toward target
    steerRateOut: 5.0,   // normalized units/s back to center

    yawDamping: 350,     // N m s, keeps limit handling catchable
    frictionCircle: 0.75, // how hard longitudinal force eats lateral grip

    tractionControl: false, // cap drive force to preserve rear lateral grip
    stabilityAssist: false, // extra corrective yaw damping at high rear slip

    maxRoll: 0.062,      // rad of visual body roll at 1 g lateral
    maxPitch: 0.042,     // rad of visual pitch at 1 g longitudinal
  };

  /*
   * Driving-feel tuning applied via Car.setTuning(). The 'normal' handling
   * and 'standard' steering presets reproduce DEFAULTS exactly, and both
   * assists default OFF, so a bare `new Car()` behaves identically to
   * previous versions (AI opponents and physics tests are unaffected).
   */
  const HANDLING_PRESETS = {
    grip: { frontD: 1.04, rearD: 1.34, circle: 0.5, yawDamping: 520 },
    normal: { frontD: 0.98, rearD: 1.18, circle: 0.75, yawDamping: 350 },
    drift: { frontD: 1.0, rearD: 1.04, circle: 0.95, yawDamping: 180 },
  };
  const STEERING_PRESETS = {
    relaxed: { rateIn: 2.2, rateOut: 4.0 },
    standard: { rateIn: 3.0, rateOut: 5.0 },
    sharp: { rateIn: 4.4, rateOut: 6.5 },
  };
  const DEFAULT_TUNING = {
    handling: 'normal',
    steering: 'standard',
    traction: false,
    stability: false,
  };

  const TC_LIMIT = 0.85;        // drive force cap as a fraction of rear grip
  const STAB_EXTRA_DAMP = 950;  // N m s of added damping at full engagement

  const SUBSTEP = 1 / 240;

  class Car {
    constructor(params) {
      this.p = Object.assign({}, DEFAULTS, params || {});
      this.tuning = Object.assign({}, DEFAULT_TUNING);
      this.reset(0, 0, 0);
    }

    /*
     * Apply driving-feel settings: {handling: 'grip'|'normal'|'drift',
     * steering: 'relaxed'|'standard'|'sharp', traction: bool,
     * stability: bool}. Missing fields keep their current value.
     */
    setTuning(tuning) {
      this.tuning = Object.assign({}, this.tuning, tuning || {});
      const h = HANDLING_PRESETS[this.tuning.handling] || HANDLING_PRESETS.normal;
      const s = STEERING_PRESETS[this.tuning.steering] || STEERING_PRESETS.standard;
      this.p.tireFront = Object.assign({}, this.p.tireFront, { D: h.frontD });
      this.p.tireRear = Object.assign({}, this.p.tireRear, { D: h.rearD });
      this.p.frictionCircle = h.circle;
      this.p.yawDamping = h.yawDamping;
      this.p.steerRateIn = s.rateIn;
      this.p.steerRateOut = s.rateOut;
      this.p.tractionControl = !!this.tuning.traction;
      this.p.stabilityAssist = !!this.tuning.stability;
    }

    reset(x, z, theta) {
      this.x = x; this.z = z; this.theta = theta;
      this.vx = 0; this.vz = 0;        // world velocity
      this.yawRate = 0;
      this.steerNorm = 0;              // smoothed steering input, +1 = right
      this.vLong = 0; this.vLat = 0;   // local velocity (fwd / left)
      this.axSmooth = 0;               // smoothed longitudinal accel (load transfer)
      this.roll = 0; this.pitch = 0;   // visual only
      this.wheelSpin = 0;              // accumulated wheel rotation, rad
      this.steerAngle = 0;             // actual front wheel angle (left positive)
      this.slipFront = 0; this.slipRear = 0;
      this.slipping = false;
      this.reversing = false;
    }

    get speed() { return Math.hypot(this.vx, this.vz); }

    /*
     * Advance physics. input: {steer, throttle, brake} (steer in [-1,1],
     * +1 = right; throttle/brake in [0,1]). surface: {grip, extraDrag}
     * (grip 1 on asphalt, ~0.55 on grass).
     */
    step(dt, input, surface) {
      const grip = (surface && surface.grip) != null ? surface.grip : 1;
      const extraDrag = (surface && surface.extraDrag) || 0;
      let remaining = Math.min(dt, 0.1);
      while (remaining > 1e-6) {
        const h = Math.min(SUBSTEP, remaining);
        this._substep(h, input, grip, extraDrag);
        remaining -= h;
      }
      // visual roll/pitch chase their acceleration-based targets
      const ayG = this._ayLocal / G, axG = this._axLocal / G;
      const rollTarget = -Math.max(-1.3, Math.min(1.3, ayG)) * this.p.maxRoll;
      const pitchTarget = -Math.max(-1.3, Math.min(1.3, axG)) * this.p.maxPitch;
      const k = 1 - Math.exp(-dt * 7);
      this.roll += (rollTarget - this.roll) * k;
      this.pitch += (pitchTarget - this.pitch) * k;
    }

    _substep(h, input, grip, extraDrag) {
      const p = this.p;

      // --- steering: rate-limited toward target, speed-sensitive range ---
      const target = Math.max(-1, Math.min(1, input.steer || 0));
      const rate = (Math.abs(target) > Math.abs(this.steerNorm) &&
        Math.sign(target || 1) === Math.sign(this.steerNorm || target || 1))
        ? p.steerRateIn : p.steerRateOut;
      const dMax = rate * h;
      this.steerNorm += Math.max(-dMax, Math.min(dMax, target - this.steerNorm));

      // local frame
      const ct = Math.cos(this.theta), st = Math.sin(this.theta);
      const fx = ct, fz = st;           // fwd
      const lx = -st, lz = ct;          // left
      let vF = this.vx * fx + this.vz * fz;
      let vL = this.vx * lx + this.vz * lz;
      const speed = Math.hypot(vF, vL);

      // steer input +1 (right) -> negative wheel angle (left-positive frame)
      const steerRange = p.steerMax / (1 + Math.max(0, vF) / p.steerSpeedRef);
      const delta = -this.steerNorm * steerRange;
      this.steerAngle = delta;

      // --- longitudinal forces ---
      const throttle = Math.max(0, Math.min(1, input.throttle || 0));
      const brake = Math.max(0, Math.min(1, input.brake || 0));

      let driveForce = 0;
      this.reversing = false;
      if (brake > 0 && vF < 0.4) {
        // reverse gear
        this.reversing = true;
        if (vF > -p.maxReverseSpeed) driveForce = -p.reverseForce * brake;
      } else if (throttle > 0) {
        driveForce = throttle * Math.min(p.engineForce, p.enginePower / Math.max(vF, 3));
      }
      let brakeTotal = this.reversing ? 0 : brake * p.brakeForce;

      // rolling resistance + aero drag (+ grass drag), opposing motion
      let resist = 0;
      if (Math.abs(vF) > 0.05) {
        resist = Math.sign(vF) * (p.rollA + p.rollB * Math.abs(vF) + extraDrag) +
          p.dragCoef * vF * Math.abs(vF);
      }

      // --- axle loads with longitudinal weight transfer ---
      const L = p.a + p.b;
      const transfer = p.mass * this.axSmooth * p.cgHeight / L;
      const FzF = Math.max(200, p.mass * G * p.b / L - transfer);
      const FzR = Math.max(200, p.mass * G * p.a / L + transfer);

      // traction control: cap drive force so the rear tire keeps a healthy
      // lateral reserve on the friction circle (tames corner-exit oversteer)
      if (p.tractionControl && driveForce > 0) {
        driveForce = Math.min(driveForce, TC_LIMIT * grip * p.tireRear.D * FzR);
      }

      // per-axle longitudinal force (RWD; brakes split by bias)
      const brakeF = brakeTotal * p.brakeBias;
      const brakeR = brakeTotal * (1 - p.brakeBias);
      const sgnV = vF >= 0 ? 1 : -1;
      let FxF = -Math.sign(vF) * Math.min(brakeF, grip * p.tireFront.D * FzF);
      let FxR = driveForce - Math.sign(vF) * Math.min(brakeR, grip * p.tireRear.D * FzR);
      if (Math.abs(vF) < 0.05 && !this.reversing) { FxF = 0; if (throttle <= 0) FxR = 0; }

      // --- lateral tire forces (bicycle model) ---
      // yawRate > 0 = turning left; front axle's leftward velocity gains a*r
      const vRef = Math.max(Math.abs(vF), 1.5);
      const slipF = Math.atan2(vL + p.a * this.yawRate, vRef) - delta * sgnV;
      const slipR = Math.atan2(vL - p.b * this.yawRate, vRef);
      this.slipFront = slipF; this.slipRear = slipR;

      // friction circle: longitudinal usage reduces available lateral grip
      const capF = grip * p.tireFront.D * FzF;
      const capR = grip * p.tireRear.D * FzR;
      const latCapF = Math.sqrt(Math.max(0.01, capF * capF - FxF * FxF * p.frictionCircle));
      const latCapR = Math.sqrt(Math.max(0.01, capR * capR - FxR * FxR * p.frictionCircle));
      let FyF = -latCapF * Math.sin(p.tireFront.C * Math.atan(p.tireFront.B * slipF));
      let FyR = -latCapR * Math.sin(p.tireRear.C * Math.atan(p.tireRear.B * slipR));

      // low-speed blend: fade dynamic model into kinematic steering
      const blend = Math.max(0, Math.min(1, (Math.abs(vF) - 0.5) / 3.5));

      // --- integrate ---
      const cosD = Math.cos(delta), sinD = Math.sin(delta);
      const Flong = FxR + FxF * cosD - FyF * sinD - resist;
      const Flat = FyR + FyF * cosD + FxF * sinD;
      const axL = Flong / p.mass;
      const ayL = Flat / p.mass;
      this._axLocal = axL; this._ayLocal = ayL;
      this.axSmooth += (axL - this.axSmooth) * Math.min(1, h * 12);

      this.vx += (axL * fx + ayL * lx * blend) * h;
      this.vz += (axL * fz + ayL * lz * blend) * h;

      // at low speed kill lateral velocity directly (tires don't slide)
      if (blend < 1) {
        const kill = (1 - blend) * Math.min(1, h * 30);
        const vLn = this.vx * lx + this.vz * lz;
        this.vx -= vLn * kill * lx;
        this.vz -= vLn * kill * lz;
      }

      // yaw: dynamic torque blended with kinematic steering response
      // stability assist: extra corrective damping that ramps in as the
      // rear starts to slide, catching the tail before it snaps around
      let damping = p.yawDamping;
      if (p.stabilityAssist) {
        const engage = Math.min(1, Math.max(0, (Math.abs(slipR) - 0.07) / 0.1));
        damping += STAB_EXTRA_DAMP * engage;
      }
      const Mz = (p.a * FyF * cosD - p.b * FyR) * sgnV - damping * this.yawRate;
      const rDyn = this.yawRate + (Mz / p.inertia) * h;
      const rKin = vF * Math.tan(delta) / L;
      this.yawRate = blend * rDyn + (1 - blend) * rKin;
      this.theta += this.yawRate * h;

      // stop creep: parked car stays parked
      const sp = Math.hypot(this.vx, this.vz);
      if (sp < 0.15 && throttle <= 0 && !this.reversing) {
        this.vx = 0; this.vz = 0; this.yawRate *= 0.5;
      }

      // don't brake past zero into unintended reverse
      vF = this.vx * fx + this.vz * fz;
      if (!this.reversing && brake > 0 && sgnV > 0 && vF < 0) {
        this.vx -= vF * fx; this.vz -= vF * fz;
      }

      this.x += this.vx * h;
      this.z += this.vz * h;

      this.vLong = this.vx * fx + this.vz * fz;
      this.vLat = this.vx * lx + this.vz * lz;
      this.wheelSpin += (this.vLong / p.wheelRadius) * h;

      const slipMag = Math.max(Math.abs(slipF), Math.abs(slipR));
      this.slipMag = slipMag;
      this.slipping = speed > 5 && blend > 0.6 &&
        (slipMag > 0.13 || (brake > 0.65 && Math.abs(axL) > 6.5));
    }

    /*
     * Barrier collision in track-relative coordinates: clamp lateral offset
     * at the wall line and remove the outward velocity component (with a
     * small bounce + speed scrub). q is a track query result, wall the
     * wall descriptor ({side, offset}).
     */
    hitWall(q, wall) {
      const over = wall.side > 0 ? q.d - wall.offset : -wall.offset - q.d;
      if (over <= 0) return false;
      // left normal at the query point
      const nx = -q.tz, nz = q.tx;
      const push = (over + 0.05) * wall.side;
      this.x -= nx * push;
      this.z -= nz * push;
      const vN = this.vx * nx + this.vz * nz; // leftward velocity
      if ((wall.side > 0 && vN > 0) || (wall.side < 0 && vN < 0)) {
        const restitution = 0.25;
        this.vx -= (1 + restitution) * vN * nx;
        this.vz -= (1 + restitution) * vN * nz;
        this.vx *= 0.92; this.vz *= 0.92; // scrub speed on impact
        this.yawRate *= 0.6;
      }
      return true;
    }
  }

  const api = { Car, DEFAULTS, HANDLING_PRESETS, STEERING_PRESETS, DEFAULT_TUNING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCCar = api;
})(typeof window !== 'undefined' ? window : globalThis);
