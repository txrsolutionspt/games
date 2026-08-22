// ── Procedural sound effects (see GAME_SPEC.md § Audio Design) ──
//
// Tones are synthesized via the Web Audio API — no audio files. Background
// music is a post-MVP item (GAME_SPEC.md § Minimum Viable Product); this MVP
// ships sound effects only. Playback is gated on the browser's audio-unlock
// requirement (first user interaction), and respects the muted/volume
// settings from the local save data.

let audioCtx = null;
let masterGain = null;
let muted = false;
let volume = 0.8;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(audioCtx.destination);
}

function setAudioSettings(settings) {
    muted = !!settings.audioMuted;
    volume = settings.audioVolume ?? 0.8;
    if (masterGain) masterGain.gain.value = muted ? 0 : volume;
}

function playTone(freq, type, dur, vol = 0.5, startFreq = null) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(startFreq || freq, audioCtx.currentTime);
    if (startFreq) o.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(masterGain);
    o.start();
    o.stop(audioCtx.currentTime + dur);
}

const Sfx = {
    jump: () => playTone(520, 'square', 0.12, 0.3, 280),
    land: () => playTone(160, 'sine', 0.06, 0.2),
    coin: () => { playTone(880, 'sine', 0.1, 0.4); playTone(1100, 'sine', 0.1, 0.3); },
    stomp: () => playTone(220, 'square', 0.15, 0.4, 440),
    blockHit: () => playTone(300, 'square', 0.08, 0.3, 500),
    checkpoint: () => { playTone(660, 'sine', 0.1, 0.35); playTone(880, 'sine', 0.12, 0.3); },
    hurt: () => playTone(180, 'sawtooth', 0.15, 0.35, 320),
    death: () => [300, 240, 180, 120].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.18, 0.3), i * 80)),
    levelComplete: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.2, 0.35), i * 100)),
    extraLife: () => { playTone(784, 'sine', 0.1, 0.35); playTone(988, 'sine', 0.1, 0.3); playTone(1175, 'sine', 0.14, 0.3); }
};

window.addEventListener('kingdomrun:userinteracted', initAudio, { once: true });

window.setAudioSettings = setAudioSettings;
window.Sfx = Sfx;
