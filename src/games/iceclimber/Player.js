import { Btn } from '../../engine/Input.js';
import { CELL_W, CELL_H, PLAYFIELD_W, TYPE } from './IceGrid.js';
import { hammerHitbox } from './HammerHitbox.js';

export const PLAYER_W = 12;
export const PLAYER_H = 14;

export const GRAVITY = 480;
export const JUMP_VY = -180;
export const RUN_SPEED = 60;
export const AIR_SPEED_MUL = 0.7;
export const MAX_FALL_SPEED = 320;
export const JUMP_CUT_MUL = 2.2;

export const HAMMER_DURATION = 0.25;
export const HAMMER_HIT_T = 0.10;

const EPS = 1e-6;

export class Player {
  constructor({ x = 0, y = 0 } = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.state = 'idle';
    this.hammerTimer = 0;
    this.hammerDidHit = false;
    this.brokeCells = [];
    this.alive = true;
  }

  get feetY() { return this.y + PLAYER_H; }
  get leftX() { return this.x; }
  get rightX() { return this.x + PLAYER_W; }
  get cx() { return this.x + PLAYER_W / 2; }

  update(dt, input, grid) {
    this.brokeCells.length = 0;

    const isHammering = this.state === 'hammer';

    if (!isHammering) {
      let dir = 0;
      if (input.isDown(Btn.LEFT)) { dir -= 1; this.facing = -1; }
      if (input.isDown(Btn.RIGHT)) { dir += 1; this.facing = 1; }
      const speed = this.onGround ? RUN_SPEED : RUN_SPEED * AIR_SPEED_MUL;
      this.vx = dir * speed;
    } else {
      this.vx = 0;
    }

    if (!isHammering && this.onGround && input.wasPressed(Btn.A)) {
      this.vy = JUMP_VY;
      this.onGround = false;
    }

    if (!isHammering && this.onGround && input.wasPressed(Btn.B)) {
      this.state = 'hammer';
      this.hammerTimer = 0;
      this.hammerDidHit = false;
      this.vx = 0;
    }

    if (this.state === 'hammer') {
      this.hammerTimer += dt;
      if (!this.hammerDidHit && this.hammerTimer >= HAMMER_HIT_T) {
        this._doHammerHit(grid);
        this.hammerDidHit = true;
      }
      if (this.hammerTimer >= HAMMER_DURATION) {
        this.state = 'idle';
        this.hammerTimer = 0;
      }
    }

    let g = GRAVITY;
    if (this.vy < 0 && !input.isDown(Btn.A)) g = GRAVITY * JUMP_CUT_MUL;
    this.vy += g * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    this._moveX(this.vx * dt, grid);
    this._moveY(this.vy * dt, grid);

    if (this.state !== 'hammer') {
      if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.vx) > 0.01) this.state = 'run';
      else this.state = 'idle';
    }
  }

  _moveX(dx, grid) {
    if (dx === 0) return;
    let newX = this.x + dx;
    if (newX < 0) { this.x = 0; this.vx = 0; return; }
    if (newX + PLAYER_W > PLAYFIELD_W) {
      this.x = PLAYFIELD_W - PLAYER_W;
      this.vx = 0;
      return;
    }
    const left = newX;
    const right = newX + PLAYER_W;
    const topY = this.y;
    const botY = this.y + PLAYER_H;
    const colA = Math.floor(left / CELL_W);
    const colB = Math.floor((right - EPS) / CELL_W);
    const rowLo = Math.ceil(-(botY - EPS) / CELL_H);
    const rowHi = Math.ceil(-topY / CELL_H);
    for (let r = rowLo; r <= rowHi; r++) {
      for (let c = colA; c <= colB; c++) {
        if (grid.isSolidAt(c, r)) {
          if (dx > 0) this.x = grid.colLeftX(c) - PLAYER_W;
          else this.x = grid.colRightX(c);
          this.vx = 0;
          return;
        }
      }
    }
    this.x = newX;
  }

  _moveY(dy, grid) {
    if (dy === 0) return;
    const newY = this.y + dy;
    const colA = Math.floor(this.x / CELL_W);
    const colB = Math.floor((this.x + PLAYER_W - EPS) / CELL_W);

    if (dy > 0) {
      const oldFeet = this.y + PLAYER_H;
      const newFeet = newY + PLAYER_H;
      const startRow = Math.floor(-oldFeet / CELL_H);
      const endRow = Math.ceil(-newFeet / CELL_H);
      for (let r = startRow; r >= endRow; r--) {
        for (let c = colA; c <= colB; c++) {
          if (grid.isSolidAt(c, r)) {
            this.y = -r * CELL_H - PLAYER_H;
            this.vy = 0;
            this.onGround = true;
            return;
          }
        }
      }
      this.y = newY;
      this.onGround = false;
    } else {
      const startRow = Math.ceil(-this.y / CELL_H);
      const endRow = Math.ceil(-newY / CELL_H);
      for (let r = startRow; r <= endRow; r++) {
        let blocked = false;
        for (let c = colA; c <= colB; c++) {
          if (grid.isSolidAt(c, r)) { blocked = true; break; }
        }
        if (blocked) {
          this.y = -r * CELL_H + CELL_H;
          this.vy = 0;
          for (let c = colA; c <= colB; c++) {
            const cell = grid.cellAt(c, r);
            if (cell && cell.type === TYPE.ICE) {
              const broke = grid.hit(c, r, 1);
              if (broke) this.brokeCells.push({ col: c, row: r, by: 'head' });
            }
          }
          return;
        }
      }
      this.y = newY;
      this.onGround = false;
    }
  }

  _doHammerHit(grid) {
    const box = hammerHitbox(this);
    const colA = Math.floor(box.x / CELL_W);
    const colB = Math.floor((box.x + box.w - EPS) / CELL_W);
    const rowLo = Math.ceil(-(box.y + box.h - EPS) / CELL_H);
    const rowHi = Math.ceil(-box.y / CELL_H);
    for (let r = rowLo; r <= rowHi; r++) {
      for (let c = colA; c <= colB; c++) {
        const cell = grid.cellAt(c, r);
        if (cell && cell.type === TYPE.ICE) {
          const broke = grid.hit(c, r, 2);
          if (broke) this.brokeCells.push({ col: c, row: r, by: 'hammer' });
        }
      }
    }
  }
}
