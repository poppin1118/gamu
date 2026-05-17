import { CELL_H, CELL_W, PLAYFIELD_W, TYPE } from './IceGrid.js';
import { FLOOR_ROWS, GOAL_ROW } from './LevelGen.js';

export const TOPI_W = 14;
export const TOPI_H = 8;

const TOPI_SPEED = 24;
const TOPI_GRAVITY = 480;
const TOPI_MAX_FALL = 320;
const EPS = 1e-6;

/**
 * 紅鴨 Topi 敵人。沿著平台走、撞牆轉身、走到邊緣也轉身（不掉下去）。
 * 撞到玩家會把玩家橫向推飛，被 hammer 擊中該格時 kill。
 */
export class Topi {
  constructor({ x = 0, y = 0, facing = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.vx = facing * TOPI_SPEED;
    this.vy = 0;
    this.facing = facing;
    this.alive = true;
    this.onGround = false;
  }

  get feetY() { return this.y + TOPI_H; }
  get leftX() { return this.x; }
  get rightX() { return this.x + TOPI_W; }
  get cx() { return this.x + TOPI_W / 2; }

  /**
   * 推進 Topi：重力 → Y 軸 sweep（落地 / 落空） → X 軸 sweep（撞牆轉身） → 邊緣轉身。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {IceGrid} grid - 冰磚網格。
   * @returns {void}
   * @depends IceGrid.isSolidAt
   */
  update(dt, grid) {
    if (!this.alive) return;

    this.vy += TOPI_GRAVITY * dt;
    if (this.vy > TOPI_MAX_FALL) this.vy = TOPI_MAX_FALL;
    this._moveY(this.vy * dt, grid);

    this._moveX(this.vx * dt, grid);

    if (this.onGround) {
      // 邊緣：若前方腳下沒有 ground，轉身。
      const foot_row = Math.ceil(-(this.feetY + 1) / CELL_H);
      const ahead_x = this.facing > 0 ? this.rightX + 1 : this.leftX - 1;
      const ahead_col = Math.floor(ahead_x / CELL_W);
      if (!grid.isSolidAt(ahead_col, foot_row)) {
        this.facing *= -1;
        this.vx = this.facing * TOPI_SPEED;
      }
    }
  }

  _moveX(dx, grid) {
    if (dx === 0) return;
    let new_x = this.x + dx;
    if (new_x < 0) {
      this.x = 0;
      this.facing = 1;
      this.vx = TOPI_SPEED;
      return;
    }
    if (new_x + TOPI_W > PLAYFIELD_W) {
      this.x = PLAYFIELD_W - TOPI_W;
      this.facing = -1;
      this.vx = -TOPI_SPEED;
      return;
    }
    const top_y = this.y;
    const bottom_y = this.y + TOPI_H;
    const first_col = Math.floor(new_x / CELL_W);
    const last_col = Math.floor((new_x + TOPI_W - EPS) / CELL_W);
    const first_row = Math.ceil(-(bottom_y - EPS) / CELL_H);
    const last_row = Math.ceil(-top_y / CELL_H);
    for (let row_index = first_row; row_index <= last_row; row_index++) {
      for (let col_index = first_col; col_index <= last_col; col_index++) {
        if (grid.isSolidAt(col_index, row_index)) {
          if (dx > 0) this.x = grid.colLeftX(col_index) - TOPI_W;
          else this.x = grid.colRightX(col_index);
          this.facing *= -1;
          this.vx = this.facing * TOPI_SPEED;
          return;
        }
      }
    }
    this.x = new_x;
  }

  _moveY(dy, grid) {
    if (dy === 0) return;
    const new_y = this.y + dy;
    const first_col = Math.floor(this.x / CELL_W);
    const last_col = Math.floor((this.x + TOPI_W - EPS) / CELL_W);
    if (dy > 0) {
      const old_feet = this.y + TOPI_H;
      const new_feet = new_y + TOPI_H;
      const start_row = Math.floor(-old_feet / CELL_H);
      const end_row = Math.ceil(-new_feet / CELL_H);
      for (let row_index = start_row; row_index >= end_row; row_index--) {
        for (let col_index = first_col; col_index <= last_col; col_index++) {
          if (grid.isSolidAt(col_index, row_index)) {
            this.y = -row_index * CELL_H - TOPI_H;
            this.vy = 0;
            this.onGround = true;
            return;
          }
        }
      }
      this.y = new_y;
      this.onGround = false;
    } else {
      this.y = new_y;
      this.onGround = false;
    }
  }

  kill() { this.alive = false; }

  serialize() {
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy,
      facing: this.facing, alive: this.alive, onGround: this.onGround,
    };
  }

  applySnapshot(s) {
    if (!s) return;
    this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy;
    this.facing = s.facing; this.alive = s.alive; this.onGround = s.onGround;
  }
}

/**
 * 依關卡找出每個 floor-line 上合適的 Topi 出生位置（地基為 solid、上方一格為空）。
 * 每個 floor 約 65% 機率出 1 隻，以 rng 決定，確保 host/guest 種子一致時結果相同。
 *
 * @param {object} rng - seeded RNG。
 * @param {IceGrid} grid - 已產生完冰磚的網格。
 * @returns {Topi[]} 已 spawn 的 Topi 陣列。
 * @depends FLOOR_ROWS, GOAL_ROW
 */
export function spawnTopis(rng, grid) {
  const topis = [];
  for (let foundation_row = FLOOR_ROWS; foundation_row < GOAL_ROW; foundation_row += FLOOR_ROWS) {
    const foundation_cells = grid.rows[foundation_row];
    const body_cells = grid.rows[foundation_row + 1];
    if (!foundation_cells || !body_cells) continue;
    const candidates = [];
    for (let col = 0; col < foundation_cells.length; col++) {
      const foundation_solid =
        foundation_cells[col].type === TYPE.ICE || foundation_cells[col].type === TYPE.SOLID;
      const body_empty = body_cells[col].type === TYPE.EMPTY;
      if (foundation_solid && body_empty) candidates.push(col);
    }
    if (candidates.length === 0) continue;
    if (rng.next() > 0.65) continue;
    const col = candidates[Math.floor(rng.next() * candidates.length)];
    const x = col * CELL_W + (CELL_W - TOPI_W) / 2;
    const y = -foundation_row * CELL_H - TOPI_H;
    const facing = rng.next() < 0.5 ? -1 : 1;
    topis.push(new Topi({ x, y, facing }));
  }
  return topis;
}
