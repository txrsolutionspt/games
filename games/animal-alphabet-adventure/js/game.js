import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { AssetManager } from './assets.js';
import { LoadingScene, MenuScene, GameScene, StickerScene } from './scenes.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 1280;
    this.H = 720;

    this.audio = new AudioManager();
    this.input = new InputManager(canvas);
    this.assets = new AssetManager();

    // Persistent state
    this.stars = 0;
    this.correctCount = 0;
    this.unlockedStickers = [];   // array of animal letters
    this.lastStarMilestone = 0;

    this._scenes = {};
    this._current = null;
    this._lastTime = 0;
    this._raf = null;
  }

  async init() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._scenes.loading = new LoadingScene(this);
    this._scenes.menu    = new MenuScene(this);
    this._scenes.game    = new GameScene(this);
    this._scenes.sticker = new StickerScene(this);

    this.setScene('loading');
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const cw = this.canvas.parentElement.clientWidth;
    const ch = this.canvas.parentElement.clientHeight;
    const scale = Math.min(cw / this.W, ch / this.H);
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    this.canvas.style.width  = `${Math.floor(this.W * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.H * scale)}px`;
  }

  setScene(name) {
    this._current?.exit();
    this.input.clear();
    this._current = this._scenes[name];
    this._current.enter();
  }

  _loop(ts) {
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this._current.update(dt);
    this._current.draw(ctx);

    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  addStar(earnedByAnimal) {
    this.stars++;
    this.correctCount++;

    if (!this.unlockedStickers.includes(earnedByAnimal.letter)) {
      this.unlockedStickers.push(earnedByAnimal.letter);
    }

    const milestone = Math.floor(this.stars / 10);
    if (milestone > this.lastStarMilestone) {
      this.lastStarMilestone = milestone;
      return true; // signals a 10-star celebration
    }
    return false;
  }

  get difficulty() {
    if (this.correctCount < 5)  return 'beginner';
    if (this.correctCount < 10) return 'intermediate';
    return 'advanced';
  }

  get choiceCount() {
    if (this.correctCount < 5)  return 2;
    if (this.correctCount < 10) return 3;
    return 4;
  }
}
