import { Btn } from '../../engine/Input.js';
import { CELL_W, CELL_H, PLAYFIELD_W, TYPE } from './IceGrid.js';
import { hammerHitbox } from './HammerHitbox.js';

export const PLAYER_W = 12;
export const PLAYER_H = 14;

export const GRAVITY = 520;
export const JUMP_VY = -185;
export const MAX_RUN_SPEED = 54;
export const RUN_ACCEL = 520;
export const RUN_DECEL = 760;
export const AIR_ACCEL = 180;
export const AIR_DECEL = 90;
export const MAX_FALL_SPEED = 320;
export const JUMP_CUT_MUL = 2.2;

export const HAMMER_DURATION = 0.25;
export const HAMMER_HIT_T = 0.10;
export const HAMMER_AIR_DRAG = 0.35;

const EPS = 1e-6;

export class Player {
  /**
   * 建立玩家實體與可序列化的物理狀態。
   *
   * @param {{x?: number, y?: number}} options - 初始座標設定。
   * @returns {Player} 玩家實體。
   * @depends Btn, IceGrid, hammerHitbox
   */
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

  /**
   * 依目前輸入推進玩家物理、跳躍、槌擊與冰塊碰撞。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {InputState} input - 目前 tick 的輸入狀態。
   * @param {IceGrid} grid - 可碰撞與可破壞的冰磚網格。
   * @returns {void}
   * @depends Btn, IceGrid.hit, hammerHitbox
   */
  update(dt, input, grid) {
    this.brokeCells.length = 0;

    const is_hammering = this.state === 'hammer';

    if (!is_hammering) {
      let move_dir = 0;
      if (input.isDown(Btn.LEFT)) { move_dir -= 1; this.facing = -1; }
      if (input.isDown(Btn.RIGHT)) { move_dir += 1; this.facing = 1; }

      const target_speed = move_dir * MAX_RUN_SPEED;
      const accel = this.onGround ? RUN_ACCEL : AIR_ACCEL;
      const decel = this.onGround ? RUN_DECEL : AIR_DECEL;
      const velocity_step = (move_dir === 0 ? decel : accel) * dt;
      this.vx = this._approach(this.vx, target_speed, velocity_step);
    } else {
      const hammer_decel = (this.onGround ? RUN_DECEL : AIR_DECEL * HAMMER_AIR_DRAG) * dt;
      this.vx = this._approach(this.vx, 0, hammer_decel);
    }

    if (!is_hammering && this.onGround && input.wasPressed(Btn.A)) {
      this.vy = JUMP_VY;
      this.onGround = false;
    }

    if (!is_hammering && input.wasPressed(Btn.B)) {
      this._startHammer();
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

    let gravity = GRAVITY;
    if (this.vy < 0 && !input.isDown(Btn.A)) gravity = GRAVITY * JUMP_CUT_MUL;
    this.vy += gravity * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    this._moveX(this.vx * dt, grid);
    this._moveY(this.vy * dt, grid);

    if (this.state !== 'hammer') {
      if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.vx) > 0.01) this.state = 'run';
      else this.state = 'idle';
    }
  }

  /**
   * 將數值以固定步幅靠近目標，用於帶慣性的地面/空中移動。
   *
   * @param {number} current_value - 目前速度。
   * @param {number} target_value - 目標速度。
   * @param {number} step_value - 本 tick 允許改變的速度量。
   * @returns {number} 更新後速度。
   * @depends none
   */
  _approach(current_value, target_value, step_value) {
    if (current_value < target_value) return Math.min(current_value + step_value, target_value);
    if (current_value > target_value) return Math.max(current_value - step_value, target_value);
    return target_value;
  }

  /**
   * 進入槌擊狀態；地面槌擊會煞停，空中槌擊保留跳躍動量。
   *
   * @returns {void}
   * @depends HAMMER_DURATION, HAMMER_HIT_T
   */
  _startHammer() {
    this.state = 'hammer';
    this.hammerTimer = 0;
    this.hammerDidHit = false;
    // 空中槌擊不能把角色釘在半空中，否則跳敲上方冰塊會失手。
    if (this.onGround) this.vx = 0;
  }

  /**
   * 進行 X 軸移動與側向碰撞，側撞冰塊只阻擋不破壞。
   *
   * @param {number} dx - 本 tick X 軸位移。
   * @param {IceGrid} grid - 可碰撞的冰磚網格。
   * @returns {void}
   * @depends IceGrid.isSolidAt
   */
  _moveX(dx, grid) {
    if (dx === 0) return;
    const new_x = this.x + dx;
    if (new_x < 0) { this.x = 0; this.vx = 0; return; }
    if (new_x + PLAYER_W > PLAYFIELD_W) {
      this.x = PLAYFIELD_W - PLAYER_W;
      this.vx = 0;
      return;
    }
    const left_x = new_x;
    const right_x = new_x + PLAYER_W;
    const top_y = this.y;
    const bottom_y = this.y + PLAYER_H;
    const first_col = Math.floor(left_x / CELL_W);
    const last_col = Math.floor((right_x - EPS) / CELL_W);
    const first_row = Math.ceil(-(bottom_y - EPS) / CELL_H);
    const last_row = Math.ceil(-top_y / CELL_H);
    for (let row_index = first_row; row_index <= last_row; row_index++) {
      for (let col_index = first_col; col_index <= last_col; col_index++) {
        if (grid.isSolidAt(col_index, row_index)) {
          if (dx > 0) this.x = grid.colLeftX(col_index) - PLAYER_W;
          else this.x = grid.colRightX(col_index);
          this.vx = 0;
          return;
        }
      }
    }
    this.x = new_x;
  }

  /**
   * 進行 Y 軸移動與垂直碰撞，頭撞冰塊會扣 hit。
   *
   * @param {number} dy - 本 tick Y 軸位移。
   * @param {IceGrid} grid - 可碰撞與可破壞的冰磚網格。
   * @returns {void}
   * @depends IceGrid.isSolidAt, IceGrid.hit
   */
  _moveY(dy, grid) {
    if (dy === 0) return;
    const new_y = this.y + dy;
    const first_col = Math.floor(this.x / CELL_W);
    const last_col = Math.floor((this.x + PLAYER_W - EPS) / CELL_W);

    if (dy > 0) {
      const old_feet_y = this.y + PLAYER_H;
      const new_feet_y = new_y + PLAYER_H;
      const start_row = Math.floor(-old_feet_y / CELL_H);
      const end_row = Math.ceil(-new_feet_y / CELL_H);
      for (let row_index = start_row; row_index >= end_row; row_index--) {
        for (let col_index = first_col; col_index <= last_col; col_index++) {
          if (grid.isSolidAt(col_index, row_index)) {
            this.y = -row_index * CELL_H - PLAYER_H;
            this.vy = 0;
            this.onGround = true;
            return;
          }
        }
      }
      this.y = new_y;
      this.onGround = false;
    } else {
      const start_row = Math.ceil(-this.y / CELL_H);
      const end_row = Math.ceil(-new_y / CELL_H);
      for (let row_index = start_row; row_index <= end_row; row_index++) {
        let blocked = false;
        for (let col_index = first_col; col_index <= last_col; col_index++) {
          if (grid.isSolidAt(col_index, row_index)) { blocked = true; break; }
        }
        if (blocked) {
          this.y = -row_index * CELL_H + CELL_H;
          this.vy = 0;
          for (let col_index = first_col; col_index <= last_col; col_index++) {
            const cell = grid.cellAt(col_index, row_index);
            if (cell && cell.type === TYPE.ICE) {
              const broke = grid.hit(col_index, row_index, 1);
              if (broke) this.brokeCells.push({ col: col_index, row: row_index, by: 'head' });
            }
          }
          return;
        }
      }
      this.y = new_y;
      this.onGround = false;
    }
  }

  /**
   * 依槌擊 hitbox 破壞前方冰塊。
   *
   * @param {IceGrid} grid - 可破壞的冰磚網格。
   * @returns {void}
   * @depends hammerHitbox, IceGrid.hit
   */
  _doHammerHit(grid) {
    const box = hammerHitbox(this);
    const first_col = Math.floor(box.x / CELL_W);
    const last_col = Math.floor((box.x + box.w - EPS) / CELL_W);
    const first_row = Math.ceil(-(box.y + box.h - EPS) / CELL_H);
    const last_row = Math.ceil(-box.y / CELL_H);
    for (let row_index = first_row; row_index <= last_row; row_index++) {
      for (let col_index = first_col; col_index <= last_col; col_index++) {
        const cell = grid.cellAt(col_index, row_index);
        if (cell && cell.type === TYPE.ICE) {
          const broke = grid.hit(col_index, row_index, 2);
          if (broke) this.brokeCells.push({ col: col_index, row: row_index, by: 'hammer' });
        }
      }
    }
  }
}
