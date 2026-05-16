export class GameLoop {
  constructor({ update, render, tickHz = 60 } = {}) {
    this.dt = 1 / tickHz;
    this.acc = 0;
    this.last = 0;
    this.update = update || (() => {});
    this.render = render || (() => {});
    this.running = false;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.acc = 0;
    requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
  }

  setHandlers({ update, render }) {
    if (update) this.update = update;
    if (render) this.render = render;
  }

  _frame(t) {
    if (!this.running) return;
    const tSec = t / 1000;
    if (this.last === 0) this.last = tSec;
    const frameDt = Math.min(0.1, tSec - this.last);
    this.last = tSec;
    this.acc += frameDt;
    let safety = 8;
    while (this.acc >= this.dt && safety-- > 0) {
      this.update(this.dt);
      this.acc -= this.dt;
    }
    const alpha = this.acc / this.dt;
    this.render(alpha);
    requestAnimationFrame(this._frame);
  }
}
