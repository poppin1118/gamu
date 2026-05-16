import { Scene } from '../../engine/Scene.js';
import { drawText } from '../../engine/PixelFont.js';
import { Btn } from '../../engine/Input.js';
import {
  IceGrid, GRID_W, CELL_W, CELL_H, PLAYFIELD_W, TYPE,
} from './IceGrid.js';
import { Player, PLAYER_W, PLAYER_H } from './Player.js';
import { Camera } from './Camera.js';
import { hammerHitbox } from './HammerHitbox.js';

export const PLAYFIELD_OFFSET_X = (256 - PLAYFIELD_W) / 2;

export class IceClimberScene extends Scene {
  async init(ctx) {
    this.ctx = ctx;
    this.grid = new IceGrid();
    this._buildPlaceholderLevel();

    const spawnCol = Math.floor(GRID_W / 2);
    this.player = new Player({
      x: spawnCol * CELL_W + (CELL_W - PLAYER_W) / 2,
      y: -PLAYER_H,
    });

    this.camera = new Camera({ viewH: 240, deadzoneTop: 110 });
    this.camera.setInitial(this.player.y);
  }

  _buildPlaceholderLevel() {
    this.grid.setRow(0, new Array(GRID_W).fill(TYPE.SOLID));
    this.grid.setRow(1, new Array(GRID_W).fill(TYPE.EMPTY));
    this.grid.setRow(2, new Array(GRID_W).fill(TYPE.EMPTY));
    for (let r = 3; r < 32; r++) {
      const row = new Array(GRID_W).fill(TYPE.ICE);
      const gap1 = (r * 3) % GRID_W;
      const gap2 = (gap1 + 4) % GRID_W;
      row[gap1] = TYPE.EMPTY;
      row[gap2] = TYPE.EMPTY;
      this.grid.setRow(r, row);
    }
  }

  update(dt) {
    this.player.update(dt, this.ctx.input, this.grid);
    this.camera.follow(this.player.y);

    if (this.player.feetY > this.camera.y + 240) {
      this.player.alive = false;
      this.ctx.exitToMenu();
    }

    if (this.ctx.input.wasPressed(Btn.START)) this.ctx.exitToMenu();
  }

  render(c) {
    const { lw, lh } = this.ctx.canvas;

    const g = c.createLinearGradient(0, 0, 0, lh);
    g.addColorStop(0, '#0b1a2e');
    g.addColorStop(1, '#1a3550');
    c.fillStyle = g;
    c.fillRect(0, 0, lw, lh);

    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(0, 0, PLAYFIELD_OFFSET_X, lh);
    c.fillRect(PLAYFIELD_OFFSET_X + PLAYFIELD_W, 0, PLAYFIELD_OFFSET_X, lh);

    const camY = this.camera.y;
    const minVisR = Math.floor(-(camY + lh) / CELL_H) - 1;
    const maxVisR = Math.ceil(-camY / CELL_H) + 1;
    for (let r = minVisR; r <= maxVisR; r++) {
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
        } else {
          c.fillStyle = '#888888';
          c.fillRect(sx, sy, CELL_W, CELL_H);
          c.fillStyle = '#555555';
          c.fillRect(sx, sy + CELL_H - 1, CELL_W, 1);
        }
      }
    }

    const px = this.player.x + PLAYFIELD_OFFSET_X;
    const py = this.player.y - camY;
    c.fillStyle = '#ffcc33';
    c.fillRect(px, py, PLAYER_W, PLAYER_H);
    c.fillStyle = '#000';
    const eyeX = this.player.facing > 0 ? px + PLAYER_W - 4 : px + 2;
    c.fillRect(eyeX, py + 3, 2, 2);

    if (this.player.state === 'hammer') {
      const box = hammerHitbox(this.player);
      c.fillStyle = 'rgba(255, 240, 160, 0.6)';
      c.fillRect(box.x + PLAYFIELD_OFFSET_X, box.y - camY, box.w, box.h);
      c.fillStyle = '#ffeeaa';
      c.fillRect(box.x + PLAYFIELD_OFFSET_X, box.y - camY, box.w, 2);
    }

    drawText(c, 'ENTER: EXIT', 8, 8, { scale: 1, color: '#ffffff' });
  }

  destroy() {}
}
