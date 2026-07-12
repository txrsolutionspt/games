/*
 * input.js — unified input layer. Keyboard and touch both map onto one
 * VehicleControl object: { steer (-1..1, +1 = right), throttle (0..1),
 * brake (0..1) }, plus named one-shot actions.
 */
(function (global) {
  'use strict';

  function createInput() {
    const control = { steer: 0, throttle: 0, brake: 0 };
    const handlers = {}; // action -> [fn]
    const keys = { left: false, right: false, up: false, down: false };
    let steerTouch = 0;
    let usingTouch = false;

    function on(action, fn) {
      (handlers[action] = handlers[action] || []).push(fn);
    }
    function fire(action) {
      (handlers[action] || []).forEach((fn) => fn());
      (handlers.any || []).forEach((fn) => fn(action));
    }

    function refresh() {
      const kSteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      control.steer = usingTouch && steerTouch !== 0 ? steerTouch : kSteer || steerTouch;
      control.throttle = keys.up || control._padGas ? 1 : 0;
      control.brake = keys.down || control._padBrake ? 1 : 0;
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
      if (k) { keys[k] = true; refresh(); e.preventDefault(); return; }
      if (e.repeat) return;
      if (e.code === 'KeyR') fire('reset');
      else if (e.code === 'Space' || e.code === 'Enter') { fire('confirm'); e.preventDefault(); }
      else if (e.code === 'KeyP' || e.code === 'Escape') fire('pause');
      else if (e.code === 'KeyM') fire('mute');
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) { keys[k] = false; refresh(); }
    });

    // ---------------- touch ----------------
    const hasTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if (hasTouch) {
      document.body.classList.add('touch');
      usingTouch = true;
    }

    function bindPedal(el, prop) {
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        control[prop] = true;
        el.classList.add('active');
        refresh();
        fire('anyPointer');
      };
      const up = (e) => {
        e.preventDefault();
        control[prop] = false;
        el.classList.remove('active');
        refresh();
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
        refresh();
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
        refresh();
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
    }

    function bindTouchUI() {
      bindPedal(document.getElementById('pedal-gas'), '_padGas');
      bindPedal(document.getElementById('pedal-brake'), '_padBrake');
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

    return { control, on, bindTouchUI, hasTouch, refresh };
  }

  const api = { createInput };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCInput = api;
})(typeof window !== 'undefined' ? window : globalThis);
