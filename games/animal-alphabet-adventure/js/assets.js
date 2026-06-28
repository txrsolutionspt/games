export class AssetManager {
  constructor() {
    this.progress = 0;
    this._steps = 0;
    this._done = 0;
  }

  async load(onProgress) {
    // All rendering uses Canvas + emoji; no binary assets to fetch.
    // Simulate a brief warmup so the loading screen is visible.
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 120));
      this.progress = i / steps;
      onProgress?.(this.progress);
    }
  }
}
