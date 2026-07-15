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

  function createInput() {
    const control = { steer: 0, throttle: 0, brake: 0 };
    const handlers = {}; // action -> [fn]
    const keys = { left: false, right: false, up: false, down: false };
    let steerTouch = 0;
    let padGas = false, padBrake = false; // touch pedal buttons
    let usingTouch = false;
    let pedalMode = 'smooth'; // 'smooth' | 'instant'
    let padConnected = false;
    let prevPadButtons = [];

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

      // steering: gamepad stick wins when deflected, else keyboard/touch
      const kSteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const digitalSteer = usingTouch && steerTouch !== 0 ? steerTouch : kSteer || steerTouch;
      control.steer = pad && pad.steer !== 0 ? pad.steer : digitalSteer;

      // pedals: ramp the binary sources, merge with analog triggers
      const tTarget = (keys.up || padGas) ? 1 : 0;
      const bTarget = (keys.down || padBrake) ? 1 : 0;
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

    function bindTouchUI() {
      bindPedal(document.getElementById('pedal-gas'), (v) => { padGas = v; });
      bindPedal(document.getElementById('pedal-brake'), (v) => { padBrake = v; });
      bindSteer(
        document.getElementById('steer-zone'),
        document.getElementById('steer-knob'),
        document.getElementById('steer-track')
      );
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
      get pedalMode() { return pedalMode; },
      get gamepadConnected() { return padConnected; },
    };
  }

  const api = { createInput, RAMP, PAD_DEADZONE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCInput = api;
})(typeof window !== 'undefined' ? window : globalThis);
