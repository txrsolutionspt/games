/*
 * audio.js — procedural Web Audio manager: engine loop, tire screech,
 * countdown beeps and jingles. No audio files. The AudioContext is created
 * lazily on the first user interaction (browser autoplay policy).
 */
(function (global) {
  'use strict';

  function createAudio() {
    let ctx = null;
    let master = null;
    let muted = false;

    // engine voice
    let engOsc1 = null, engOsc2 = null, engGain = null, engFilter = null;
    // screech voice
    let scrSrc = null, scrGain = null;

    function ensure() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.85;
        master.connect(ctx.destination);

        // --- engine: two detuned oscillators through a lowpass ---
        engOsc1 = ctx.createOscillator();
        engOsc1.type = 'sawtooth';
        engOsc2 = ctx.createOscillator();
        engOsc2.type = 'square';
        engFilter = ctx.createBiquadFilter();
        engFilter.type = 'lowpass';
        engFilter.frequency.value = 700;
        engGain = ctx.createGain();
        engGain.gain.value = 0;
        engOsc1.connect(engFilter);
        engOsc2.connect(engFilter);
        engFilter.connect(engGain);
        engGain.connect(master);
        engOsc1.start();
        engOsc2.start();

        // --- screech: looped noise through a bandpass ---
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        scrSrc = ctx.createBufferSource();
        scrSrc.buffer = buf;
        scrSrc.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1150;
        bp.Q.value = 2.2;
        scrGain = ctx.createGain();
        scrGain.gain.value = 0;
        scrSrc.connect(bp);
        bp.connect(scrGain);
        scrGain.connect(master);
        scrSrc.start();
        return true;
      } catch (e) {
        ctx = null;
        return false;
      }
    }

    function unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    /*
     * Per-frame engine/screech update.
     * rpm: 0..1 normalized, throttle: 0..1, slip: 0..~0.5, running: bool.
     */
    function update(rpm, throttle, slip, running) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (!running) {
        engGain.gain.setTargetAtTime(0, t, 0.1);
        scrGain.gain.setTargetAtTime(0, t, 0.05);
        return;
      }
      const f = 55 + rpm * 240;
      engOsc1.frequency.setTargetAtTime(f, t, 0.03);
      engOsc2.frequency.setTargetAtTime(f * 0.5 + 2, t, 0.03);
      engFilter.frequency.setTargetAtTime(500 + rpm * 1900 + throttle * 500, t, 0.05);
      engGain.gain.setTargetAtTime(0.045 + rpm * 0.05 + throttle * 0.035, t, 0.06);

      const scr = Math.max(0, Math.min(1, (slip - 0.12) * 4));
      scrGain.gain.setTargetAtTime(scr * 0.14, t, 0.04);
    }

    function tone(freq, dur, type, vol, when) {
      if (!ctx) return;
      const t = (when || ctx.currentTime);
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    return {
      unlock,
      update,
      countdownBeep() { unlock(); tone(880, 0.16, 'square', 0.18); },
      goBeep() { unlock(); tone(1320, 0.4, 'square', 0.22); },
      lapChime() {
        if (!ctx) return;
        tone(988, 0.12, 'sine', 0.22);
        tone(1319, 0.22, 'sine', 0.22, ctx.currentTime + 0.11);
      },
      finishJingle() {
        if (!ctx) return;
        const t = ctx.currentTime;
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, t + i * 0.13));
      },
      bestJingle() {
        if (!ctx) return;
        const t = ctx.currentTime;
        [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.26, 'triangle', 0.24, t + i * 0.11));
      },
      warnBuzz() { if (ctx) tone(196, 0.25, 'sawtooth', 0.12); },
      setMuted(m) {
        muted = m;
        if (master) master.gain.value = muted ? 0 : 0.85;
      },
      get muted() { return muted; },
    };
  }

  const api = { createAudio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCAudio = api;
})(typeof window !== 'undefined' ? window : globalThis);
