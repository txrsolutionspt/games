'use strict';

const AMBIENCE_MODES = [
  { id: 'off',    label: 'Off',    icon: '🔇' },
  { id: 'birds',  label: 'Birds',  icon: '🐦' },
  { id: 'rain',   label: 'Rain',   icon: '🌧️' },
  { id: 'breeze', label: 'Breeze', icon: '🍃' },
];

class AmbienceSystem {
  constructor() {
    this._ac = null;
    this._nodes = [];
    this._birdTimer = null;
    this.mode = 0; // index into AMBIENCE_MODES
  }

  _ctx() {
    if (!this._ac) this._ac = new (window.AudioContext || window.webkitAudioContext)();
    if (this._ac.state === 'suspended') this._ac.resume();
    return this._ac;
  }

  setMode(mode) {
    this._stop();
    this.mode = ((mode % AMBIENCE_MODES.length) + AMBIENCE_MODES.length) % AMBIENCE_MODES.length;
    if (this.mode === 0) return;
    const ac = this._ctx();
    if (this.mode === 1) this._startBirds(ac);
    if (this.mode === 2) this._startRain(ac);
    if (this.mode === 3) this._startBreeze(ac);
  }

  next() { this.setMode(this.mode + 1); }

  _stop() {
    if (this._birdTimer) { clearTimeout(this._birdTimer); this._birdTimer = null; }
    this._nodes.forEach(n => {
      try { n.stop(); } catch (_) {}
      try { n.disconnect(); } catch (_) {}
    });
    this._nodes = [];
  }

  // Birds — random pitched chirps with random intervals
  _startBirds(ac) {
    const schedule = () => {
      if (this.mode !== 1) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.connect(env); env.connect(ac.destination);
      const base = 900 + Math.random() * 1400;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.4), now + 0.1);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.07, now + 0.02);
      env.gain.linearRampToValueAtTime(0, now + 0.14);
      osc.start(now); osc.stop(now + 0.18);
      this._birdTimer = setTimeout(schedule, 600 + Math.random() * 2800);
    };
    schedule();
  }

  // Rain — looping white noise through a low-pass filter
  _startRain(ac) {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;

    const lpf = ac.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 1100;

    const gain = ac.createGain(); gain.gain.value = 0.16;

    src.connect(lpf); lpf.connect(gain); gain.connect(ac.destination);
    src.start();
    this._nodes.push(src, lpf, gain);
  }

  // Breeze — sine + slow LFO amplitude swell
  _startBreeze(ac) {
    const osc = ac.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 75;

    const lpf = ac.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 280;

    const gain = ac.createGain(); gain.gain.value = 0.055;

    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);

    osc.connect(lpf); lpf.connect(gain); gain.connect(ac.destination);
    osc.start(); lfo.start();
    this._nodes.push(osc, lpf, gain, lfo, lfoGain);
  }
}
