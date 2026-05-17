import { Scene } from '../../engine/Scene.js';
import { Btn } from '../../engine/Input.js';
import { makeRng } from '../../engine/Random.js';
import {
  IceGrid, GRID_W, CELL_W, CELL_H, PLAYFIELD_W, TYPE,
} from './IceGrid.js';
import { Player, PLAYER_W, PLAYER_H } from './Player.js';
import { Camera } from './Camera.js';
import { generateLevel, GOAL_ROW, FLOOR_ROWS } from './LevelGen.js';
import { IceClimberArt } from './IceClimberArt.js';
import { renderHud } from './Hud.js';

export const PLAYFIELD_OFFSET_X = (256 - PLAYFIELD_W) / 2;
const VIEW_H = 240;

const END_DELAY = 1.0;
const PARTICLE_LIFE = 0.28;

export class IceClimberScene extends Scene {
  /**
   * 初始化 Ice Climber 單人場景與 deterministic 關卡。
   *
   * @param {object} ctx - Scene context，包含 canvas、input 與切換場景 callback。
   * @returns {Promise<void>} 初始化完成後 resolve。
   * @depends makeRng, IceGrid, Player, Camera, IceClimberArt
   */
  async init(ctx) {
    this.ctx = ctx;
    this.seed = Date.now() >>> 0;
    this.rng = makeRng(this.seed);
    this.grid = new IceGrid();
    this.art = new IceClimberArt();

    const rows = generateLevel(this.rng);
    rows.forEach((types, row_index) => this.grid.setRow(row_index, types));

    const spawn_col = Math.floor(GRID_W / 2);
    for (let col_index = spawn_col - 1; col_index <= spawn_col + 1; col_index++) {
      const cell = this.grid.cellAt(col_index, 1);
      if (cell) { cell.type = TYPE.EMPTY; cell.hits = 0; }
    }

    this.player = new Player({
      x: spawn_col * CELL_W + (CELL_W - PLAYER_W) / 2,
      y: -PLAYER_H,
    });
    this.camera = new Camera({ viewH: VIEW_H, deadzoneTop: 140 });
    this.camera.setInitial(this.player.y);

    this.score = 0;
    this.floor = 0;
    this.maxFloor = 0;
    this.gameState = 'playing';
    this.endTimer = 0;
    this.elapsed = 0;
    this.break_effects = [];
  }

  /**
   * 推進遊戲狀態、玩家、攝影機與破冰粒子。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Player.update, Camera.follow, IceGrid
   */
  update(dt) {
    const input = this.ctx.input;
    this.elapsed += dt;
    this._updateBreakEffects(dt);

    if (this.gameState === 'playing') {
      this.player.update(dt, input, this.grid);
      this.camera.follow(this.player.y);

      this.score += this.player.brokeCells.length * 10;
      this._spawnBreakEffects(this.player.brokeCells);

      if (this.player.onGround) {
        const standing_row = Math.round(-this.player.feetY / CELL_H);
        const new_floor = Math.max(0, Math.floor(standing_row / FLOOR_ROWS));
        if (new_floor > this.maxFloor) {
          this.score += (new_floor - this.maxFloor) * 100;
          this.maxFloor = new_floor;
        }
        this.floor = new_floor;
        if (standing_row >= GOAL_ROW) {
          this.gameState = 'won';
          this.endTimer = 0;
        }
      }

      if (this.player.feetY > this.camera.y + VIEW_H + 4) {
        this.gameState = 'lost';
        this.endTimer = 0;
      }

      if (input.wasPressed(Btn.START)) this.ctx.exitToMenu();
    } else {
      this.endTimer += dt;
      if (this.endTimer >= END_DELAY) {
        if (input.wasPressed(Btn.START) || input.wasPressed(Btn.A)) {
          this.ctx.exitToMenu();
        }
      }
    }
  }

  /**
   * 繪製完整遊戲畫面。
   *
   * @param {CanvasRenderingContext2D} c - 2D canvas context。
   * @returns {void}
   * @depends IceClimberArt, renderHud
   */
  render(c) {
    this.art.draw_background(c, this.camera.y);
    this.art.draw_side_walls(c, PLAYFIELD_OFFSET_X);
    this._drawGrid(c);
    this.art.draw_goal_line(c, PLAYFIELD_OFFSET_X, this.camera.y);
    this.art.draw_break_effects(c, this.break_effects, PLAYFIELD_OFFSET_X, this.camera.y);
    this._drawPlayer(c);
    renderHud(c, { score: this.score, floor: this.maxFloor, state: this.gameState });
  }

  /**
   * 只繪製攝影機附近的可見冰磚列。
   *
   * @param {CanvasRenderingContext2D} c - 2D canvas context。
   * @returns {void}
   * @depends IceGrid, IceClimberArt
   */
  _drawGrid(c) {
    const camera_y = this.camera.y;
    const first_row = Math.floor(-(camera_y + VIEW_H) / CELL_H) - 1;
    const last_row = Math.ceil(-camera_y / CELL_H) + 1;
    for (let row_index = first_row; row_index <= last_row; row_index++) {
      const cells_row = this.grid.rows[row_index];
      if (!cells_row) continue;
      const screen_y = -row_index * CELL_H - camera_y;
      for (let col_index = 0; col_index < GRID_W; col_index++) {
        const cell = cells_row[col_index];
        if (cell.type === TYPE.EMPTY) continue;
        const screen_x = col_index * CELL_W + PLAYFIELD_OFFSET_X;
        this.art.draw_cell(c, cell, screen_x, screen_y, {
          is_goal: row_index === GOAL_ROW,
          row_index,
        });
      }
    }
  }

  /**
   * 繪製玩家與槌子。
   *
   * @param {CanvasRenderingContext2D} c - 2D canvas context。
   * @returns {void}
   * @depends IceClimberArt.draw_player
   */
  _drawPlayer(c) {
    const camera_y = this.camera.y;
    const player_x = this.player.x + PLAYFIELD_OFFSET_X;
    const player_y = this.player.y - camera_y;
    this.art.draw_player(c, this.player, player_x, player_y, this.elapsed);
  }

  /**
   * 推進破冰粒子的生命週期。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends PARTICLE_LIFE
   */
  _updateBreakEffects(dt) {
    for (const effect of this.break_effects) {
      effect.age += dt;
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 240 * dt;
    }
    this.break_effects = this.break_effects.filter((effect) => effect.age < effect.life);
  }

  /**
   * 依破掉的冰磚建立短暫碎冰粒子。
   *
   * @param {{col: number, row: number, by: string}[]} broke_cells - 本 tick 破掉的 cell 清單。
   * @returns {void}
   * @depends CELL_W, CELL_H
   */
  _spawnBreakEffects(broke_cells) {
    for (const broke_cell of broke_cells) {
      const origin_x = broke_cell.col * CELL_W + CELL_W / 2;
      const origin_y = -broke_cell.row * CELL_H + CELL_H / 2;
      for (let particle_index = 0; particle_index < 5; particle_index++) {
        const spread_x = (particle_index - 2) * 34;
        const spread_y = -90 - particle_index * 8;
        this.break_effects.push({
          x: origin_x,
          y: origin_y,
          vx: spread_x,
          vy: spread_y,
          age: 0,
          life: PARTICLE_LIFE,
        });
      }
    }
  }

  /**
   * 釋放場景資源；目前場景沒有額外事件監聽需要移除。
   *
   * @returns {void}
   * @depends none
   */
  destroy() {}
}
