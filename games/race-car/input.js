/*
 * input.js — unified input layer. Keyboard, touch and gamepad all map onto
 * one VehicleControl object: { steer (-1..1, +1 = right), throttle (0..1),
 * brake (0..1) }, plus named one-shot actions.
 *
 * Keyboard/touch pedals are binary, so in 'smooth' pedal mode they ramp
 * progressively (call update(dt) once per frame) — full throttle arrives in
 * ~0.35 s instead of instantly, which takes most of the snap out of corner
 * exits. Gamepad sticks/triggers are analog and bypass the ramp.
 */
(function (global) {
  'use strict';

  const RAMP = {
    throttleUp: 2.8,  // per second (0 -> 1 in ~0.36 s)
    throttleDown: 8,
    brakeUp: 4,
    brakeDown: 10,
  };
  const PAD_DEADZONE = 0.12;
  const TILT_DEADZONE = 4;   // degrees of tilt ignored around level
  const TILT_MAX_ANGLE = 28; // degrees past the deadzone for full lock

  function createInput() {
    const control = { steer: 0, throttle: 0, brake: 0, tiltAngle: 0 };
    const handlers = {}; // action -> [fn]
    const keys = { left: false, right: false, up: false, down: false };
    let steerTouch = 0;
    let steerTilt = 0;
    let padGas = false, padBrake = false; // touch pedal buttons
    let usingTouch = false;
    let pedalMode = 'smooth'; // 'smooth' | 'instant'
    let padConnected = false;
    let prevPadButtons = [];
    let controlMode = 'touch-slider'; // 'touch-slider' | 'tilt'
    let tiltSupported = false;
    let tiltPermissionGranted = false;
    let scrollPedalValue = 0; // -1 = full brake, 0 = stopped, 1 = full gas
    let scrollPedalTimeout = null;

    function on(action, fn) {
      (handlers[action] = handlers[action] || []).push(fn);
    }
    function fire(action) {
      (handlers[action] || []).forEach((fn) => fn());
      (handlers.any || []).forEach((fn) => fn(action));
    }

    // ---------------- gamepad ----------------
    function pollGamepad() {
      const pads = (typeof navigator !== 'undefined' && navigator.getGamepads)
        ? navigator.getGamepads() : null;
      let pad = null;
      if (pads) {
        for (const p of pads) { if (p && p.connected) { pad = p; break; } }
      }
      if (!pad) return null;
      if (!padConnected) {
        padConnected = true;
        fire('padconnected');
      }

      // curved stick response outside the deadzone
      const raw = pad.axes && pad.axes.length ? pad.axes[0] : 0;
      let steer = 0;
      if (Math.abs(raw) > PAD_DEADZONE) {
        const t = (Math.abs(raw) - PAD_DEADZONE) / (1 - PAD_DEADZONE);
        steer = Math.sign(raw) * Math.pow(t, 1.4);
      }
      const btn = (i) => (pad.buttons && pad.buttons[i]) || null;
      const val = (i) => { const b = btn(i); return b ? (b.value || (b.pressed ? 1 : 0)) : 0; };
      const throttle = val(7); // right trigger
      const brake = val(6);    // left trigger

      // edge-detected buttons: A = confirm, B = reset, Start = pause
      const MAP = { 0: 'confirm', 1: 'reset', 9: 'pause' };
      for (const idx of Object.keys(MAP)) {
        const pressed = !!(btn(+idx) && btn(+idx).pressed);
        if (pressed && !prevPadButtons[idx]) {
          fire(MAP[idx]);
          fire('interact');
        }
        prevPadButtons[idx] = pressed;
      }
      return { steer, throttle, brake };
    }

    // ---------------- per-frame update (ramping + gamepad merge) ----------------
    function update(dt) {
      const pad = pollGamepad();

      // steering: priority is gamepad > tilt > keyboard/touch-slider
      const kSteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      let steering = kSteer || steerTouch;

      if (pad && pad.steer !== 0) {
        control.steer = pad.steer;
      } else if (controlMode === 'tilt' && steerTilt !== 0) {
        control.steer = steerTilt;
      } else if (usingTouch && steerTouch !== 0) {
        control.steer = steerTouch;
      } else {
        control.steer = steering;
      }

      // pedals: ramp the binary sources, merge with analog triggers
      // scroll pedal: positive = gas, negative = brake
      let tTarget = (keys.up || padGas) ? 1 : 0;
      let bTarget = (keys.down || padBrake) ? 1 : 0;
      if (scrollPedalValue > 0) {
        tTarget = Math.max(tTarget, scrollPedalValue);
      } else if (scrollPedalValue < 0) {
        bTarget = Math.max(bTarget, -scrollPedalValue);
      }
      if (pedalMode === 'instant' || !(dt > 0)) {
        control._rampT = tTarget;
        control._rampB = bTarget;
      } else {
        const rt = control._rampT || 0, rb = control._rampB || 0;
        const tRate = tTarget > rt ? RAMP.throttleUp : RAMP.throttleDown;
        const bRate = bTarget > rb ? RAMP.brakeUp : RAMP.brakeDown;
        control._rampT = rt + Math.max(-tRate * dt, Math.min(tRate * dt, tTarget - rt));
        control._rampB = rb + Math.max(-bRate * dt, Math.min(bRate * dt, bTarget - rb));
      }
      control.throttle = Math.max(control._rampT || 0, pad ? pad.throttle : 0);
      control.brake = Math.max(control._rampB || 0, pad ? pad.brake : 0);
    }

    // legacy immediate refresh (kept for touch handlers; ramping happens in update)
    function refresh() { /* values are recomputed every frame in update(dt) */ }

    // ---------- device orientation (tilt control) ----------
    let tiltListenerAttached = false;

    function screenAngle() {
      if (typeof screen !== 'undefined' && screen.orientation &&
          typeof screen.orientation.angle === 'number') {
        return screen.orientation.angle;
      }
      return (typeof window !== 'undefined' && window.orientation) || 0;
    }

    function onDeviceOrientation(e) {
      if (!tiltPermissionGranted || controlMode !== 'tilt') {
        steerTilt = 0;
        control.tiltAngle = 0;
        return;
      }
      // The game runs in landscape, so the "steering wheel" tilt is a
      // rotation around the device's x axis (beta), not gamma — gamma is
      // the left/right axis only while the phone is in portrait. Pick the
      // axis (and sign) from the current screen rotation so it also works
      // if the phone is flipped to the other landscape or left in portrait.
      const angle = screenAngle();
      let raw;
      if (angle === 90) raw = e.beta || 0;               // landscape, rotated left
      else if (angle === 270 || angle === -90) raw = -(e.beta || 0); // landscape, rotated right
      else if (angle === 180) raw = -(e.gamma || 0);     // portrait upside-down
      else raw = e.gamma || 0;                           // portrait

      control.tiltAngle = raw;

      // deadzone, then map the remaining angle onto -1..1
      let a = raw;
      if (Math.abs(a) < TILT_DEADZONE) a = 0;
      else a = a > 0 ? a - TILT_DEADZONE : a + TILT_DEADZONE;
      steerTilt = Math.max(-1, Math.min(1, a / TILT_MAX_ANGLE));
    }

    function initTiltControl() {
      tiltSupported = typeof DeviceOrientationEvent !== 'undefined';
      // iOS 13+ needs a user-gesture permission request first
      // (requestTiltPermission); everywhere else listen right away
      if (tiltSupported && !DeviceOrientationEvent.requestPermission) {
        enableTiltControl();
      }
      return Promise.resolve(tiltSupported);
    }

    function enableTiltControl() {
      if (!tiltSupported) return;
      tiltPermissionGranted = true;
      if (tiltListenerAttached) return;
      tiltListenerAttached = true;
      window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    }

    function requestTiltPermission() {
      if (!tiltSupported) return Promise.resolve(false);

      if (DeviceOrientationEvent.requestPermission) {
        return DeviceOrientationEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              enableTiltControl();
              return true;
            }
            return false;
          })
          .catch(() => false); // user denied or error
      }
      // non-iOS: no permission gate
      enableTiltControl();
      return Promise.resolve(true);
    }

    function setControlMode(mode) {
      if (mode === 'tilt') {
        if (tiltSupported && !tiltPermissionGranted) {
          // Will need permission; don't auto-switch yet
          return false;
        }
        controlMode = 'tilt';
        fire('controlModeChanged');
        return true;
      } else {
        controlMode = 'touch-slider';
        fire('controlModeChanged');
        return true;
      }
    }

    // ---------------- keyboard ----------------
    const KEYMAP = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
    };
    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) { keys[k] = true; e.preventDefault(); return; }
      if (e.repeat) return;
      if (e.code === 'KeyR') fire('reset');
      else if (e.code === 'Space' || e.code === 'Enter') { fire('confirm'); e.preventDefault(); }
      else if (e.code === 'KeyP' || e.code === 'Escape') fire('pause');
      else if (e.code === 'KeyM') fire('mute');
      else if (e.code === 'KeyF') fire('fullscreen');
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) keys[k] = false;
    });

    // ---------------- touch ----------------
    const hasTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if (hasTouch) {
      document.body.classList.add('touch');
      usingTouch = true;
    }

    function bindPedal(el, setter) {
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        setter(true);
        el.classList.add('active');
        fire('anyPointer');
      };
      const up = (e) => {
        e.preventDefault();
        setter(false);
        el.classList.remove('active');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    }

    function bindSteer(zone, knob, trackEl) {
      if (!zone) return;
      let activeId = null;
      function setFromX(clientX) {
        const rect = trackEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const range = rect.width * 0.42;
        steerTouch = Math.max(-1, Math.min(1, (clientX - cx) / range));
        if (knob) {
          knob.style.left = (50 + steerTouch * 42) + '%';
        }
      }
      zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activeId = e.pointerId;
        zone.setPointerCapture(e.pointerId);
        setFromX(e.clientX);
        fire('anyPointer');
      });
      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId === activeId) setFromX(e.clientX);
      });
      const end = (e) => {
        if (e.pointerId !== activeId) return;
        activeId = null;
        steerTouch = 0;
        if (knob) knob.style.left = '50%';
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
    }

    function bindScrollPedal() {
      const scrollPedal = document.getElementById('scroll-pedal');
      if (!scrollPedal) return;
      const indicator = document.getElementById('scroll-indicator');

      scrollPedal.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1; // scroll down = brake, up = gas
        scrollPedalValue = Math.max(-1, Math.min(1, scrollPedalValue + delta));

        if (indicator) {
          const trackHeight = scrollPedal.offsetHeight;
          const indicatorTop = 50 + (scrollPedalValue * 25); // -1 = 25%, 0 = 50%, 1 = 75%
          indicator.style.top = indicatorTop + '%';
        }

        // Clear existing timeout
        if (scrollPedalTimeout) clearTimeout(scrollPedalTimeout);

        // Auto-return to middle after 200ms of inactivity
        scrollPedalTimeout = setTimeout(() => {
          scrollPedalValue = 0;
          if (indicator) indicator.style.top = '50%';
          scrollPedalTimeout = null;
        }, 200);
      }, { passive: false });
    }

    function bindTouchUI() {
      bindPedal(document.getElementById('pedal-gas'), (v) => { padGas = v; });
      bindPedal(document.getElementById('pedal-brake'), (v) => { padBrake = v; });
      bindSteer(
        document.getElementById('steer-zone'),
        document.getElementById('steer-knob'),
        document.getElementById('steer-track')
      );
      bindScrollPedal();
      const reset = document.getElementById('btn-reset');
      if (reset) reset.addEventListener('click', () => fire('reset'));
    }

    // generic unlock signal for audio (first interaction of any kind)
    ['pointerdown', 'keydown', 'touchend'].forEach((evt) => {
      window.addEventListener(evt, () => fire('interact'), { once: false });
    });

    function setPedalMode(mode) {
      pedalMode = mode === 'instant' ? 'instant' : 'smooth';
    }

    return {
      control, on, bindTouchUI, hasTouch, refresh, update, setPedalMode,
      initTiltControl, requestTiltPermission, setControlMode,
      get pedalMode() { return pedalMode; },
      get gamepadConnected() { return padConnected; },
      get tiltSupported() { return tiltSupported; },
      get tiltPermissionGranted() { return tiltPermissionGranted; },
      get controlMode() { return controlMode; },
    };
  }

  const api = { createInput, RAMP, PAD_DEADZONE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCInput = api;
})(typeof window !== 'undefined' ? window : globalThis);
