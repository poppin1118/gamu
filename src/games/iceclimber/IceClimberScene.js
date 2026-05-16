import { Scene } from '../../engine/Scene.js';
import { Btn } from '../../engine/Input.js';
import { makeRng } from '../../engine/Random.js';
import { loadAssets } from '../../engine/AssetLoader.js';
import { SpriteSheet } from '../../engine/SpriteSheet.js';
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

const MANIFEST = {
  images: {
    tiles: './src/games/iceclimber/assets/Tilemap/tilemap_packed.png',
    chars: './src/games/iceclimber/assets/Tilemap/tilemap-characters_packed.png',
    backgrounds: './src/games/iceclimber/assets/Tilemap/tilemap-backgrounds_packed.png',
  },
  json: {},
};

const FRAME = {
  ICE: 95,
  SOLID: 40,
  GOAL: 40,
  P_IDLE: 13,
  P_RUN_A: 13,
  P_RUN_B: 14,
  P_JUMP: 15,
  P_FALL: 16,
  P_HAMMER: 17,
  BG_SKY: 0,
};

const RUN_ANIM_HZ = 8;

export class IceClimberScene extends Scene {
  async init(ctx) {
    this.ctx = ctx;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = makeRng(this.seed);
    this.grid = new IceGrid();

    const rows = generateLevel(this.rng);
    rows.forEach((types, r) => this.grid.setRow(r, types));

    const spawnCol = Math.floor(GRID_W / 2);
    for (let c = spawnCol - 1; c <= spawnCol + 1; c++) {
      const cell = this.grid.cellAt(c, 1);
      if (cell) { cell.type = TYPE.EMPTY; cell.hits = 0; }
    }

    this.player = new Player({
      x: spawnCol * CELL_W + (CELL_W - PLAYER_W) / 2,
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

    try {
      const assets = await loadAssets(MANIFEST);
      this.sheets = {
        tiles: new SpriteSheet(assets.images.tiles, { tileSize: 18, spacing: 0, cols: 20 }),
        chars: new SpriteSheet(assets.images.chars, { tileSize: 24, spacing: 0, cols: 9 }),
        bg: new SpriteSheet(assets.images.backgrounds, { tileSize: 24, spacing: 0, cols: 8 }),
      };
    } catch (err) {
      console.warn('Ice Climber 素材載入失敗，使用色塊 fallback', err);
      this.sheets = null;
    }
  }

  update(dt) {
    const input = this.ctx.input;
    this.elapsed += dt;

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
        this._drawCell(c, cell, sx, sy, r === GOAL_ROW);
      }
    }
  }

  _drawCell(c, cell, sx, sy, isGoal) {
    if (this.sheets) {
      if (cell.type === TYPE.ICE) {
        this.sheets.tiles.draw(c, FRAME.ICE, sx, sy, CELL_W, CELL_H);
        if (cell.hits === 1) {
          c.fillStyle = 'rgba(0, 0, 0, 0.35)';
          c.fillRect(sx, sy, CELL_W, CELL_H);
        }
      } else {
        this.sheets.tiles.draw(c, isGoal ? FRAME.GOAL : FRAME.SOLID, sx, sy, CELL_W, CELL_H);
        if (isGoal) {
          c.fillStyle = 'rgba(255, 204, 51, 0.45)';
          c.fillRect(sx, sy, CELL_W, CELL_H);
        }
      }
      return;
    }
    // fallback 色塊
    if (cell.type === TYPE.ICE) {
      c.fillStyle = cell.hits === 2 ? '#bfe2ff' : '#7fa8c8';
      c.fillRect(sx, sy, CELL_W, CELL_H);
      c.fillStyle = '#3f6088';
      c.fillRect(sx, sy + CELL_H - 1, CELL_W, 1);
      c.fillRect(sx, sy, 1, CELL_H);
    } else {
      c.fillStyle = isGoal ? '#ffcc33' : '#888888';
      c.fillRect(sx, sy, CELL_W, CELL_H);
      c.fillStyle = isGoal ? '#cc8810' : '#555555';
      c.fillRect(sx, sy + CELL_H - 1, CELL_W, 1);
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

    if (this.sheets) {
      const frame = this._playerFrame();
      const flipX = this.player.facing < 0;
      this.sheets.chars.draw(c, frame, px - 2, py - 2, 16, 16, { flipX });
    } else {
      c.fillStyle = '#ffcc33';
      c.fillRect(px, py, PLAYER_W, PLAYER_H);
      c.fillStyle = '#cc8810';
      c.fillRect(px, py, PLAYER_W, 3);
      c.fillStyle = '#000';
      const eyeX = this.player.facing > 0 ? px + PLAYER_W - 4 : px + 2;
      c.fillRect(eyeX, py + 5, 2, 2);
    }

    if (this.player.state === 'hammer') {
      const box = hammerHitbox(this.player);
      c.fillStyle = 'rgba(255, 240, 160, 0.5)';
      c.fillRect(box.x + PLAYFIELD_OFFSET_X, box.y - camY, box.w, box.h);
      c.fillStyle = '#ffeeaa';
      const handleX = this.player.facing > 0 ? px + PLAYER_W - 1 : px - 1;
      c.fillRect(handleX, py + 2, 2, 6);
    }
  }

  _playerFrame() {
    const s = this.player.state;
    if (s === 'hammer') return FRAME.P_HAMMER;
    if (s === 'jump') return FRAME.P_JUMP;
    if (s === 'fall') return FRAME.P_FALL;
    if (s === 'run') {
      return (Math.floor(this.elapsed * RUN_ANIM_HZ) % 2) ? FRAME.P_RUN_B : FRAME.P_RUN_A;
    }
    return FRAME.P_IDLE;
  }

  destroy() {}
}
