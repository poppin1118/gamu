import { CELL_H, CELL_W, TYPE } from './IceGrid.js';
import { GOAL_ROW } from './LevelGen.js';

export const ICICLE_W = 4;
export const ICICLE_H = 8;

const SHAKE_DURATION = 0.45;
const FALL_GRAVITY = 480;
const FALL_MAX_SPEED = 280;
const TRIGGER_X_RANGE = CELL_W;
const TRIGGER_VERTICAL_BELOW = CELL_H * 10;
const FALL_INITIAL_VY = 30;
const FALL_OFF_LIMIT = 200;

export const ICICLE_STATE = Object.freeze({
  HANGING: 0,
  SHAKING: 1,
  FALLING: 2,
  DEAD: 3,
});

/**
 * 冰柱：掛在某個 solid cell 底下，玩家走到其下方時開始抖動，
 * 抖動結束後落下，撞到 solid 碎掉、撞到玩家 → 玩家 KO。可被 hammer 預先打碎。
 */
export class Icicle {
  constructor({ col = 0, row = 0 } = {}) {
    this.col = col;
    this.row = row;
    this.x = col * CELL_W + (CELL_W - ICICLE_W) / 2;
    this.base_y = -row * CELL_H + CELL_H;
    this.y = this.base_y;
    this.vy = 0;
    this.state = ICICLE_STATE.HANGING;
    this.timer = 0;
  }

  get leftX() { return this.x; }
  get rightX() { return this.x + ICICLE_W; }
  get topY() { return this.y; }
  get bottomY() { return this.y + ICICLE_H; }

  /**
   * 推進冰柱狀態機；落下時偵測下方 solid，撞到就 DEAD。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {IceGrid} grid - 冰磚網格。
   * @param {Player[]} trigger_players - 用來判定觸發抖動的玩家清單。
   * @returns {void}
   * @depends IceGrid.isSolidAt
   */
  update(dt, grid, trigger_players) {
    if (this.state === ICICLE_STATE.DEAD) return;

    if (this.state === ICICLE_STATE.HANGING) {
      for (const player of trigger_players) {
        // 跳過：玩家整個還在冰柱上方（腳尖比冰柱頂端還高 → 大於 topY 就 OK）。
        if (player.feetY < this.topY) continue;
        // 跳過：玩家太遠下方（不同樓層、看不到的距離）。
        if (player.y > this.bottomY + TRIGGER_VERTICAL_BELOW) continue;
        if (player.cx < this.x - TRIGGER_X_RANGE) continue;
        if (player.cx > this.x + ICICLE_W + TRIGGER_X_RANGE) continue;
        this.state = ICICLE_STATE.SHAKING;
        this.timer = 0;
        break;
      }
      return;
    }

    if (this.state === ICICLE_STATE.SHAKING) {
      this.timer += dt;
      if (this.timer >= SHAKE_DURATION) {
        this.state = ICICLE_STATE.FALLING;
        this.vy = FALL_INITIAL_VY;
      }
      return;
    }

    if (this.state === ICICLE_STATE.FALLING) {
      this.vy += FALL_GRAVITY * dt;
      if (this.vy > FALL_MAX_SPEED) this.vy = FALL_MAX_SPEED;
      this.y += this.vy * dt;

      const bottom_row = Math.ceil(-this.bottomY / CELL_H);
      if (grid.isSolidAt(this.col, bottom_row)) {
        this.state = ICICLE_STATE.DEAD;
        return;
      }
      if (this.y > this.base_y + FALL_OFF_LIMIT) this.state = ICICLE_STATE.DEAD;
    }
  }

  /**
   * 槌擊強制粉碎（hanging 或 shaking 時）；FALLING 中不能被打到，太晚。
   *
   * @returns {void}
   */
  shatter() {
    if (this.state === ICICLE_STATE.HANGING || this.state === ICICLE_STATE.SHAKING) {
      this.state = ICICLE_STATE.DEAD;
    }
  }

  serialize() {
    return {
      col: this.col, row: this.row,
      y: this.y, vy: this.vy, state: this.state, timer: this.timer,
    };
  }
  applySnapshot(s) {
    if (!s) return;
    this.col = s.col;
    this.row = s.row;
    this.x = this.col * CELL_W + (CELL_W - ICICLE_W) / 2;
    this.base_y = -this.row * CELL_H + CELL_H;
    this.y = s.y;
    this.vy = s.vy;
    this.state = s.state;
    this.timer = s.timer;
  }
}

/**
 * 找出所有「下方一格為空、自身為 solid」的 cell，rng 過濾後產生冰柱。
 *
 * @param {object} rng - seeded RNG。
 * @param {IceGrid} grid - 已產生完冰磚的網格。
 * @returns {Icicle[]} icicle 陣列。
 * @depends GOAL_ROW
 */
export function spawnIcicles(rng, grid) {
  const icicles = [];
  for (let row = 2; row < GOAL_ROW; row++) {
    const cells = grid.rows[row];
    const below = grid.rows[row - 1];
    if (!cells || !below) continue;
    for (let col = 0; col < cells.length; col++) {
      const this_solid =
        cells[col].type === TYPE.ICE || cells[col].type === TYPE.SOLID;
      const below_empty = below[col].type === TYPE.EMPTY;
      if (!this_solid || !below_empty) continue;
      if (rng.next() < 0.10) icicles.push(new Icicle({ col, row }));
    }
  }
  return icicles;
}
