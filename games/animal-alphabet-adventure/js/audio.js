export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
    } catch {
      console.warn('Web Audio API not available');
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, startOffset, duration, type = 'sine', vol = 0.28) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  playCorrect() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, i * 0.10, 0.22));
  }

  playWrong() {
    this._tone(260, 0,    0.12, 'sawtooth', 0.20);
    this._tone(220, 0.13, 0.18, 'sawtooth', 0.15);
  }

  playClick() {
    this._tone(720, 0, 0.07, 'sine', 0.14);
  }

  playCelebration() {
    const melody = [523, 659, 784, 1047, 1319, 1047, 1319, 1568];
    melody.forEach((f, i) => this._tone(f, i * 0.09, 0.20));
  }

  playStarEarned() {
    this._tone(880, 0,    0.08, 'sine', 0.18);
    this._tone(1100, 0.1, 0.12, 'sine', 0.18);
  }

  speak(text, onEnd) {
    if (!window.speechSynthesis) { onEnd?.(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.82;
    u.pitch = 1.25;
    u.volume = this.muted ? 0 : 1;
    if (onEnd) u.onend = onEnd;
    speechSynthesis.speak(u);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) speechSynthesis.cancel();
    return this.muted;
  }
}
