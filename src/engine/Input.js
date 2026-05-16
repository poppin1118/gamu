export const Btn = Object.freeze({
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  UP: 'UP',
  DOWN: 'DOWN',
  A: 'A',
  B: 'B',
  START: 'START',
  SELECT: 'SELECT',
});

const DEFAULT_KEYMAP = {
  ArrowLeft: Btn.LEFT,
  ArrowRight: Btn.RIGHT,
  ArrowUp: Btn.UP,
  ArrowDown: Btn.DOWN,
  KeyZ: Btn.A,
  KeyX: Btn.B,
  Enter: Btn.START,
  ShiftLeft: Btn.SELECT,
  ShiftRight: Btn.SELECT,
};

export class InputState {
  constructor() {
    this.held = Object.create(null);
    this.pressed = Object.create(null);
    this.released = Object.create(null);
  }

  isDown(btn) { return !!this.held[btn]; }
  wasPressed(btn) { return !!this.pressed[btn]; }
  wasReleased(btn) { return !!this.released[btn]; }

  beginTick() {
    this.pressed = Object.create(null);
    this.released = Object.create(null);
  }

  set(btn, v) {
    const was = !!this.held[btn];
    this.held[btn] = v;
    if (v && !was) this.pressed[btn] = true;
    if (!v && was) this.released[btn] = true;
  }
}

export class InputManager {
  constructor({ keymap = DEFAULT_KEYMAP } = {}) {
    this.state = new InputState();
    this.keymap = keymap;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach(target = window) {
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    this._target = target;
  }

  detach() {
    if (!this._target) return;
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    this._target.removeEventListener('blur', this._onBlur);
    this._target = null;
  }

  beginTick() { this.state.beginTick(); }

  _onKeyDown(e) {
    const btn = this.keymap[e.code];
    if (!btn) return;
    if (e.repeat) return;
    e.preventDefault();
    this.state.set(btn, true);
  }

  _onKeyUp(e) {
    const btn = this.keymap[e.code];
    if (!btn) return;
    e.preventDefault();
    this.state.set(btn, false);
  }

  _onBlur() {
    for (const btn of Object.values(Btn)) this.state.set(btn, false);
  }
}
