import { PLAYFIELD_W } from './IceGrid.js';

export const BIRD_W = 12;
export const BIRD_H = 8;

const BIRD_SPEED = 46;
const KILL_FALL_GRAVITY = 360;
const KILL_INITIAL_LIFT = -50;
const DEAD_DESPAWN_DELAY = 1.5;

/**
 * Nitpicker（鳥型敵人）：橫向飛行、不受 grid 碰撞，撞玩家會推一下，
 * 被 hammer 在身上的 cell 擊中即墜落、+500。
 */
export class Nitpicker {
  constructor({ x = 0, y = 0, facing = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.vx = facing * BIRD_SPEED;
    this.vy = 0;
    this.facing = facing;
    this.alive = true;
    this.dead_timer = 0;
  }

  get leftX() { return this.x; }
  get rightX() { return this.x + BIRD_W; }
  get cx() { return this.x + BIRD_W / 2; }
  get feetY() { return this.y + BIRD_H; }

  /**
   * 活著 → 直線飛行；死掉 → 墜落動畫並累積 despawn 計時器。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   */
  update(dt) {
    if (this.alive) {
      this.x += this.vx * dt;
      return;
    }
    this.vy += KILL_FALL_GRAVITY * dt;
    this.y += this.vy * dt;
    this.dead_timer += dt;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.vy = KILL_INITIAL_LIFT;
    this.vx = 0;
  }

  /**
   * 判斷是否該從場景移除：飛出畫面或墜落動畫結束。
   *
   * @returns {boolean}
   */
  shouldDespawn() {
    if (!this.alive && this.dead_timer >= DEAD_DESPAWN_DELAY) return true;
    if (this.rightX < -48 || this.leftX > PLAYFIELD_W + 48) return true;
    return false;
  }

  serialize() {
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy,
      facing: this.facing, alive: this.alive, dead_timer: this.dead_timer,
    };
  }

  applySnapshot(s) {
    if (!s) return;
    this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy;
    this.facing = s.facing; this.alive = s.alive; this.dead_timer = s.dead_timer;
  }
}

/**
 * 建立一隻從畫面邊緣飛入的 Nitpicker，並 rng 決定方向、altitude 內隨機。
 *
 * @param {object} rng - seeded RNG。
 * @param {number} camera_y - 目前攝影機 Y。
 * @returns {Nitpicker}
 */
export function spawnNitpickerAtCamera(rng, camera_y) {
  const facing = rng.next() < 0.5 ? -1 : 1;
  const spawn_x = facing > 0 ? -BIRD_W : PLAYFIELD_W;
  // 把鳥放在畫面上方 1/3 區域，避免一出生就壓在玩家身上。
  const altitude = camera_y + 24 + rng.next() * 72;
  return new Nitpicker({ x: spawn_x, y: altitude, facing });
}
