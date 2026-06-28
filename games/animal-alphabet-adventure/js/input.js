export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this._handlers = [];
    this.mouse = { x: 0, y: 0 };
    this._bind();
  }

  _scale() {
    const r = this.canvas.getBoundingClientRect();
    return { x: this.canvas.width / r.width, y: this.canvas.height / r.height };
  }

  _toCanvas(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const s = this._scale();
    return { x: (cx - r.left) * s.x, y: (cy - r.top) * s.y };
  }

  _bind() {
    this.canvas.addEventListener('click', (e) => {
      const p = this._toCanvas(e.clientX, e.clientY);
      this._emit('click', p);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const p = this._toCanvas(t.clientX, t.clientY);
      this._emit('click', p);
    }, { passive: false });

    this.canvas.addEventListener('mousemove', (e) => {
      const p = this._toCanvas(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this._emit('move', p);
    });
  }

  on(event, fn) {
    this._handlers.push({ event, fn });
    return fn;
  }

  off(fn) {
    this._handlers = this._handlers.filter(h => h.fn !== fn);
  }

  clear() {
    this._handlers = [];
  }

  _emit(event, data) {
    this._handlers.filter(h => h.event === event).forEach(h => h.fn(data));
  }
}
