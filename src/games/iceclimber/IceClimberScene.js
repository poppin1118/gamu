import { Scene } from '../../engine/Scene.js';
import { Btn } from '../../engine/Input.js';
import { makeRng } from '../../engine/Random.js';
import {
  IceGrid, GRID_W, CELL_W, CELL_H, PLAYFIELD_W, TYPE,
} from './IceGrid.js';
import { Player, PLAYER_W, PLAYER_H } from './Player.js';
import { Camera } from './Camera.js';
import { hammerHitbox } from './HammerHitbox.js';
import { generateLevel, GOAL_ROW, FLOOR_ROWS, TOTAL_FLOORS } from './LevelGen.js';
import { renderHud } from './Hud.js';

export const PLAYFIELD_OFFSET_X = (256 - PLAYFIELD_W) / 2;
const VIEW_H = 240;
const VIEW_W = 256;

const END_DELAY = 1.0;

export class IceClimberScene extends Scene {
  async init(ctx) {
    this.ctx = ctx;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = makeRng(this.seed);
    this.grid = new IceGrid();

    const rows = generateLevel(this.rng);
    rows.forEach((types, r) => this.grid.setRow(r, types));

    const spawnCol = Math.floor(GRID_W / 2);
    for (let r = 1; r <= 2; r++) {
      for (let c = spawnCol - 1; c <= spawnCol + 1; c++) {
        const cell = this.grid.cellAt(c, r);
        if (cell) { cell.type = TYPE.EMPTY; cell.hits = 0; }
      }
    }

    this.player = new Player({
      x: spawnCol * CELL_W + (CELL_W - PLAYER_W) / 2,
      y: -PLAYER_H,
    });
    this.camera = new Camera({ viewH: VIEW_H, deadzoneTop: 120 });
    this.camera.setInitial(this.player.y);

    this.score = 0;
    this.floor = 0;
    this.maxFloor = 0;
    this.gameState = 'playing';
    this.endTimer = 0;
  }

  update(dt) {
    const input = this.ctx.input;

    if (this.gameState === 'playing') {
      this.player.update(dt, input, this.grid);
      this.camera.follow(this.player.y);

      this.score += this.player.brokeCells.length * 10;

      if (this.player.onGround) {
        const standingRow = Math.round(-this.player.feetY / CELL_H);
        const newFloor = Math.max(0, Math.floor(standingRow / FLOOR_ROWS));
        if (newFloor > this.maxFloor) {
          this.score += (newFloor - this.maxFloor) * 100;
          this.maxFloor = newFloor;
        }
        this.floor = newFloor;
        if (standingRow >= GOAL_ROW) {
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

  render(c) {
    this._drawBackground(c);
    this._drawSideWalls(c);
    this._drawGrid(c);
    this._drawGoalLine(c);
    this._drawPlayer(c);
    renderHud(c, { score: this.score, floor: this.maxFloor, state: this.gameState });
  }

  _drawBackground(c) {
    const g = c.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#0a1428');
    g.addColorStop(1, '#1c3a5a');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) {
      const x = (i * 53 + ((this.camera.y * 0.05) | 0)) % VIEW_W;
      const y = (i * 31) % (VIEW_H / 2);
      c.fillRect(((x + VIEW_W) % VIEW_W) | 0, y | 0, 1, 1);
    }
  }

  _drawSideWalls(c) {
    c.fillStyle = 'rgba(0, 0, 0, 0.5)';
    c.fillRect(0, 0, PLAYFIELD_OFFSET_X, VIEW_H);
    c.fillRect(PLAYFIELD_OFFSET_X + PLAYFIELD_W, 0, PLAYFIELD_OFFSET_X, VIEW_H);
  }

  _drawGrid(c) {
    const camY = this.camera.y;
    const minR = Math.floor(-(camY + VIEW_H) / CELL_H) - 1;
    const maxR = Math.ceil(-camY / CELL_H) + 1;
    for (let r = minR; r <= maxR; r++) {
      const cellsRow = this.grid.rows[r];
      if (!cellsRow) continue;
      const sy = -r * CELL_H - camY;
      for (let col = 0; col < GRID_W; col++) {
        const cell = cellsRow[col];
        if (cell.type === TYPE.EMPTY) continue;
        const sx = col * CELL_W + PLAYFIELD_OFFSET_X;
        if (cell.type === TYPE.ICE) {
          c.fillStyle = cell.hits === 2 ? '#bfe2ff' : '#7fa8c8';
          c.fillRect(sx, sy, CELL_W, CELL_H);
          c.fillStyle = '#3f6088';
          c.fillRect(sx, sy + CELL_H - 1, CELL_W, 1);
          c.fillRect(sx, sy, 1, CELL_H);
          if (cell.hits === 1) {
            c.fillStyle = '#3f6088';
            c.fillRect(sx + 3, sy + 2, 2, 1);
            c.fillRect(sx + 8, sy + 4, 3, 1);
            c.fillRect(sx + 5, sy + 6, 2, 1);
          }
        } else {
          const isGoal = r === GOAL_ROW;
          c.fillStyle = isGoal ? '#ffcc33' : '#888888';
          c.fillRect(sx, sy, CELL_W, CELL_H);
          c.fillStyle = isGoal ? '#cc8810' : '#555555';
          c.fillRect(sx, sy + CELL_H - 1, CELL_W, 1);
        }
      }
    }
  }

  _drawGoalLine(c) {
    const camY = this.camera.y;
    const goalY = -GOAL_ROW * CELL_H - camY;
    if (goalY < -CELL_H || goalY > VIEW_H) return;
    c.fillStyle = '#ffcc33';
    for (let x = PLAYFIELD_OFFSET_X; x < PLAYFIELD_OFFSET_X + PLAYFIELD_W; x += 4) {
      c.fillRect(x, goalY - 2, 2, 1);
    }
  }

  _drawPlayer(c) {
    const camY = this.camera.y;
    const px = this.player.x + PLAYFIELD_OFFSET_X;
    const py = this.player.y - camY;

    c.fillStyle = '#ffcc33';
    c.fillRect(px, py, PLAYER_W, PLAYER_H);
    c.fillStyle = '#cc8810';
    c.fillRect(px, py, PLAYER_W, 3);
    c.fillStyle = '#000';
    const eyeX = this.player.facing > 0 ? px + PLAYER_W - 4 : px + 2;
    c.fillRect(eyeX, py + 5, 2, 2);

    if (this.player.state === 'hammer') {
      const box = hammerHitbox(this.player);
      c.fillStyle = 'rgba(255, 240, 160, 0.5)';
      c.fillRect(box.x + PLAYFIELD_OFFSET_X, box.y - camY, box.w, box.h);
      c.fillStyle = '#ffeeaa';
      const handleX = this.player.facing > 0 ? px + PLAYER_W - 1 : px - 1;
      c.fillRect(handleX, py + 2, 2, 6);
    }
  }

  destroy() {}
}
