import { CELL_H, CELL_W, PLAYFIELD_W, TYPE } from './IceGrid.js';
import { FLOOR_ROWS, GOAL_ROW } from './LevelGen.js';
import { PLAYER_H, PLAYER_W } from './Player.js';
import { hammerHitbox } from './HammerHitbox.js';

const VIEW_W = 256;
const VIEW_H = 240;

const FLOOR_PALETTE = [
  { ice: '#8ee8ff', shade: '#3ca6d6', edge: '#f8ffff' },
  { ice: '#f7a8ff', shade: '#a34fca', edge: '#fff0ff' },
  { ice: '#9cffb6', shade: '#3faa6c', edge: '#f3fff6' },
  { ice: '#ffd36a', shade: '#bd7c28', edge: '#fff2bd' },
];

/**
 * Ice Climber 風格的 procedural pixel art renderer。
 *
 * @returns {IceClimberArt} 美術渲染器。
 * @depends CanvasRenderingContext2D
 */
export class IceClimberArt {
  /**
   * 繪製低解析度雪山背景。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @returns {void}
   * @depends VIEW_W, VIEW_H
   */
  draw_background(canvas_context, camera_y) {
    canvas_context.fillStyle = '#6bb6d6';
    canvas_context.fillRect(0, 0, VIEW_W, VIEW_H);

    const mountain_shift = Math.floor(camera_y * 0.03) % VIEW_W;
    this._draw_mountain_band(canvas_context, mountain_shift, 138, '#bdf2ff', '#7cc4dd');
    this._draw_mountain_band(canvas_context, mountain_shift + 70, 164, '#ffffff', '#9bd9ea');

    canvas_context.fillStyle = '#dff9ff';
    for (let cloud_index = 0; cloud_index < 8; cloud_index++) {
      const cloud_x = ((cloud_index * 42 - Math.floor(camera_y * 0.08)) % (VIEW_W + 32)) - 16;
      const cloud_y = 36 + (cloud_index % 3) * 18;
      canvas_context.fillRect(cloud_x, cloud_y, 16, 4);
      canvas_context.fillRect(cloud_x + 4, cloud_y - 4, 16, 4);
      canvas_context.fillRect(cloud_x + 12, cloud_y, 12, 4);
    }

    canvas_context.fillStyle = '#ffffff';
    for (let snow_index = 0; snow_index < 24; snow_index++) {
      const snow_x = (snow_index * 47 + Math.floor(camera_y * 0.12)) % VIEW_W;
      const snow_y = (snow_index * 29) % 126;
      canvas_context.fillRect(snow_x, snow_y, 1, 1);
    }
  }

  /**
   * 繪製左右暗色邊界，讓 8 欄冰塔有明確舞台框。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @returns {void}
   * @depends PLAYFIELD_W, VIEW_H
   */
  draw_side_walls(canvas_context, offset_x) {
    canvas_context.fillStyle = '#24315a';
    canvas_context.fillRect(0, 0, offset_x, VIEW_H);
    canvas_context.fillRect(offset_x + PLAYFIELD_W, 0, offset_x, VIEW_H);

    canvas_context.fillStyle = '#111a35';
    canvas_context.fillRect(offset_x - 2, 0, 2, VIEW_H);
    canvas_context.fillRect(offset_x + PLAYFIELD_W, 0, 2, VIEW_H);
  }

  /**
   * 繪製單格冰磚、不可破底層或終點磚。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {{type: number, hits: number}} cell - IceGrid cell。
   * @param {number} screen_x - 螢幕 X 座標。
   * @param {number} screen_y - 螢幕 Y 座標。
   * @param {{is_goal?: boolean, row_index?: number}} options - 額外繪製狀態。
   * @returns {void}
   * @depends TYPE, CELL_W, CELL_H, FLOOR_ROWS
   */
  draw_cell(canvas_context, cell, screen_x, screen_y, { is_goal = false, row_index = 0 } = {}) {
    if (cell.type === TYPE.ICE) {
      const palette = FLOOR_PALETTE[Math.floor(row_index / FLOOR_ROWS) % FLOOR_PALETTE.length];
      canvas_context.fillStyle = palette.ice;
      canvas_context.fillRect(screen_x, screen_y, CELL_W, CELL_H);
      canvas_context.fillStyle = palette.edge;
      canvas_context.fillRect(screen_x, screen_y, CELL_W, 2);
      canvas_context.fillStyle = palette.shade;
      canvas_context.fillRect(screen_x, screen_y + CELL_H - 2, CELL_W, 2);
      canvas_context.fillRect(screen_x, screen_y + 1, 1, CELL_H - 1);

      if (cell.hits === 1) {
        // 裂紋用鋸齒線強化「下一擊會破」的回饋。
        canvas_context.fillStyle = '#173a78';
        canvas_context.fillRect(screen_x + 4, screen_y + 2, 1, 2);
        canvas_context.fillRect(screen_x + 5, screen_y + 4, 3, 1);
        canvas_context.fillRect(screen_x + 8, screen_y + 5, 1, 2);
        canvas_context.fillRect(screen_x + 10, screen_y + 3, 2, 1);
      }
      return;
    }

    if (is_goal) {
      canvas_context.fillStyle = '#fff3a6';
      canvas_context.fillRect(screen_x, screen_y, CELL_W, CELL_H);
      canvas_context.fillStyle = '#d98f23';
      canvas_context.fillRect(screen_x, screen_y + CELL_H - 2, CELL_W, 2);
      canvas_context.fillStyle = '#ffffff';
      canvas_context.fillRect(screen_x + 2, screen_y + 1, 10, 1);
      return;
    }

    canvas_context.fillStyle = '#493e88';
    canvas_context.fillRect(screen_x, screen_y, CELL_W, CELL_H);
    canvas_context.fillStyle = '#b7efff';
    canvas_context.fillRect(screen_x, screen_y, CELL_W, 2);
    canvas_context.fillStyle = '#1d2559';
    canvas_context.fillRect(screen_x, screen_y + CELL_H - 2, CELL_W, 2);
  }

  /**
   * 繪製終點提示線。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @returns {void}
   * @depends GOAL_ROW, CELL_H, PLAYFIELD_W
   */
  draw_goal_line(canvas_context, offset_x, camera_y) {
    const goal_y = -GOAL_ROW * CELL_H - camera_y;
    if (goal_y < -CELL_H || goal_y > VIEW_H) return;

    canvas_context.fillStyle = '#fff3a6';
    for (let line_x = offset_x; line_x < offset_x + PLAYFIELD_W; line_x += 8) {
      canvas_context.fillRect(line_x, goal_y - 4, 4, 2);
    }
  }

  /**
   * 繪製原創雪衣槌子角色。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Player} player - 玩家狀態。
   * @param {number} screen_x - 角色螢幕 X 座標。
   * @param {number} screen_y - 角色螢幕 Y 座標。
   * @param {number} elapsed - 場景經過秒數，用於跑步腳步動畫。
   * @returns {void}
   * @depends PLAYER_W, PLAYER_H
   */
  draw_player(canvas_context, player, screen_x, screen_y, elapsed) {
    const bob_y = player.state === 'run' && Math.floor(elapsed * 12) % 2 === 0 ? 1 : 0;
    const body_y = screen_y + bob_y;
    const face_x = player.facing > 0 ? screen_x + 7 : screen_x + 3;

    canvas_context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    canvas_context.fillRect(screen_x + 1, screen_y + PLAYER_H, PLAYER_W - 2, 2);

    canvas_context.fillStyle = '#ffffff';
    canvas_context.fillRect(screen_x + 2, body_y, 8, 3);
    canvas_context.fillRect(screen_x + 1, body_y + 2, 10, 2);
    canvas_context.fillStyle = player.tunicColor || '#2472d8';
    canvas_context.fillRect(screen_x + 2, body_y + 4, 8, 7);
    canvas_context.fillStyle = player.tunicShade || '#174aa3';
    canvas_context.fillRect(screen_x + 2, body_y + 9, 8, 3);
    canvas_context.fillStyle = '#ffd7a8';
    canvas_context.fillRect(screen_x + 4, body_y + 3, 4, 3);
    canvas_context.fillStyle = '#111827';
    canvas_context.fillRect(face_x, body_y + 4, 1, 1);

    canvas_context.fillStyle = '#ffffff';
    canvas_context.fillRect(screen_x + 1, body_y + 11, 3, 2);
    canvas_context.fillRect(screen_x + 8, body_y + 11, 3, 2);
    canvas_context.fillStyle = '#10172f';
    canvas_context.fillRect(screen_x + 2, body_y + 13, 3, 1);
    canvas_context.fillRect(screen_x + 7, body_y + 13, 3, 1);

    this.draw_hammer(canvas_context, player, screen_x, body_y);
  }

  /**
   * 繪製槌子與槌擊方向。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Player} player - 玩家狀態。
   * @param {number} screen_x - 角色螢幕 X 座標。
   * @param {number} screen_y - 角色螢幕 Y 座標。
   * @returns {void}
   * @depends hammerHitbox
   */
  draw_hammer(canvas_context, player, screen_x, screen_y) {
    if (player.state !== 'hammer') return;

    const direction = player.facing;
    const handle_x = direction > 0 ? screen_x + PLAYER_W - 1 : screen_x - 1;
    const head_x = direction > 0 ? screen_x + PLAYER_W + 1 : screen_x - 5;
    canvas_context.fillStyle = '#7a4a24';
    canvas_context.fillRect(handle_x, screen_y - 6, 2, 10);
    canvas_context.fillStyle = '#d8c08b';
    canvas_context.fillRect(head_x, screen_y - 8, 5, 4);

    const hitbox = hammerHitbox(player);
    const hitbox_x = hitbox.x - player.x + screen_x;
    const hitbox_y = hitbox.y - player.y + screen_y;
    canvas_context.fillStyle = 'rgba(255, 255, 255, 0.35)';
    canvas_context.fillRect(hitbox_x, hitbox_y, hitbox.w, hitbox.h);
  }

  /**
   * 繪製破冰粒子。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {{x: number, y: number, vx: number, vy: number, age: number, life: number}[]} effects - 粒子狀態。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @returns {void}
   * @depends none
   */
  draw_break_effects(canvas_context, effects, offset_x, camera_y) {
    canvas_context.fillStyle = '#f8ffff';
    for (const effect of effects) {
      const screen_x = Math.floor(effect.x + offset_x);
      const screen_y = Math.floor(effect.y - camera_y);
      canvas_context.fillRect(screen_x, screen_y, 2, 2);
    }
  }

  /**
   * 繪製像素山脈帶。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} shift_x - 水平位移。
   * @param {number} base_y - 山脈基準高度。
   * @param {string} peak_color - 山頂顏色。
   * @param {string} shade_color - 山體陰影顏色。
   * @returns {void}
   * @depends VIEW_W
   */
  _draw_mountain_band(canvas_context, shift_x, base_y, peak_color, shade_color) {
    canvas_context.fillStyle = shade_color;
    canvas_context.beginPath();
    canvas_context.moveTo(-32, VIEW_H);
    for (let point_index = -1; point_index <= 8; point_index++) {
      const point_x = point_index * 42 - (shift_x % 42);
      const point_y = base_y - (point_index % 2 === 0 ? 22 : 10);
      canvas_context.lineTo(point_x, point_y);
    }
    canvas_context.lineTo(VIEW_W + 32, VIEW_H);
    canvas_context.closePath();
    canvas_context.fill();

    canvas_context.fillStyle = peak_color;
    for (let peak_index = 0; peak_index < 7; peak_index++) {
      const peak_x = peak_index * 42 - (shift_x % 42) - 5;
      canvas_context.fillRect(peak_x, base_y - 22, 10, 4);
      canvas_context.fillRect(peak_x + 3, base_y - 26, 4, 4);
    }
  }
}
