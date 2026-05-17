import { CELL_H, CELL_W, PLAYFIELD_W, TYPE } from './IceGrid.js';
import { FLOOR_ROWS, GOAL_ROW } from './LevelGen.js';
import { PLAYER_H, PLAYER_W } from './Player.js';
import { TOPI_W, TOPI_H } from './Topi.js';
import { ICICLE_W, ICICLE_H, ICICLE_STATE } from './Icicle.js';
import { BIRD_W, BIRD_H } from './Nitpicker.js';

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
  }

  /**
   * 繪製紅鴨 Topi。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Topi} topi - Topi 狀態。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @param {number} elapsed - 用於走路上下彈跳動畫。
   * @returns {void}
   * @depends TOPI_W, TOPI_H
   */
  draw_topi(canvas_context, topi, offset_x, camera_y, elapsed) {
    if (!topi.alive) return;
    const bob = Math.floor(elapsed * 8) % 2 === 0 ? 0 : 1;
    const sx = Math.floor(topi.x + offset_x);
    const sy = Math.floor(topi.y - camera_y) + bob;

    canvas_context.fillStyle = 'rgba(0, 0, 0, 0.28)';
    canvas_context.fillRect(sx + 1, sy + TOPI_H, TOPI_W - 2, 1);

    canvas_context.fillStyle = '#9c2035';
    canvas_context.fillRect(sx + 1, sy + 2, TOPI_W - 2, TOPI_H - 3);
    canvas_context.fillStyle = '#d8485f';
    canvas_context.fillRect(sx + 2, sy + 1, TOPI_W - 4, TOPI_H - 2);

    canvas_context.fillStyle = '#ffe8d8';
    canvas_context.fillRect(sx + 4, sy + 4, TOPI_W - 8, TOPI_H - 5);

    canvas_context.fillStyle = '#ffd75a';
    const beak_x = topi.facing > 0 ? sx + TOPI_W - 1 : sx - 1;
    canvas_context.fillRect(beak_x, sy + 3, 2, 2);

    canvas_context.fillStyle = '#10172f';
    const eye_x = topi.facing > 0 ? sx + TOPI_W - 4 : sx + 2;
    canvas_context.fillRect(eye_x, sy + 2, 1, 1);

    canvas_context.fillStyle = '#c9871a';
    canvas_context.fillRect(sx + 3, sy + TOPI_H - 1, 2, 1);
    canvas_context.fillRect(sx + TOPI_W - 5, sy + TOPI_H - 1, 2, 1);
  }

  /**
   * 繪製獎勵關卡的冰凍蔬菜。type 決定外觀；taken=true 不畫。
   *
   * @param {CanvasRenderingContext2D} c - 2D canvas context。
   * @param {{col: number, row: number, type: string, taken: boolean}} veg - 蔬菜資料。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @returns {void}
   */
  draw_vegetable(c, veg, offset_x, camera_y) {
    if (veg.taken) return;
    const sx = Math.floor(veg.col * CELL_W + offset_x + (CELL_W - 8) / 2);
    const sy = Math.floor(-(veg.row + 1) * CELL_H - camera_y);

    // 共用：冰晶光暈背景
    c.fillStyle = 'rgba(220, 240, 255, 0.5)';
    c.fillRect(sx - 1, sy + 1, 10, 6);

    switch (veg.type) {
      case 'eggplant':
        c.fillStyle = '#6b3d8a'; c.fillRect(sx + 1, sy + 2, 6, 5);
        c.fillStyle = '#9b6dc4'; c.fillRect(sx + 2, sy + 3, 1, 1);
        c.fillStyle = '#4ea83a'; c.fillRect(sx + 3, sy + 1, 2, 2);
        break;
      case 'carrot':
        c.fillStyle = '#e08a30'; c.fillRect(sx + 2, sy + 3, 4, 4);
        c.fillStyle = '#ffb060'; c.fillRect(sx + 2, sy + 3, 1, 1);
        c.fillStyle = '#4ea83a'; c.fillRect(sx + 2, sy + 1, 1, 2);
        c.fillRect(sx + 4, sy + 1, 1, 2);
        break;
      case 'cabbage':
        c.fillStyle = '#65a83a'; c.fillRect(sx + 1, sy + 2, 6, 5);
        c.fillStyle = '#88c854'; c.fillRect(sx + 2, sy + 3, 4, 2);
        c.fillStyle = '#3e7522'; c.fillRect(sx + 2, sy + 6, 4, 1);
        break;
      case 'fish':
        c.fillStyle = '#a8b8d0'; c.fillRect(sx + 1, sy + 3, 5, 3);
        c.fillStyle = '#d8e0f0'; c.fillRect(sx + 1, sy + 4, 3, 1);
        c.fillStyle = '#a8b8d0'; c.fillRect(sx + 5, sy + 2, 2, 5);
        c.fillStyle = '#ffd75a'; c.fillRect(sx + 2, sy + 4, 1, 1);
        break;
      case 'corn':
        c.fillStyle = '#e8c038'; c.fillRect(sx + 2, sy + 2, 4, 5);
        c.fillStyle = '#ffea7a'; c.fillRect(sx + 3, sy + 3, 2, 1);
        c.fillRect(sx + 3, sy + 5, 2, 1);
        c.fillStyle = '#4ea83a'; c.fillRect(sx + 2, sy + 1, 1, 2);
        c.fillRect(sx + 5, sy + 1, 1, 2);
        break;
      default:
        c.fillStyle = '#ff6666'; c.fillRect(sx + 1, sy + 2, 6, 5);
    }
  }

  /**
   * 繪製 Nitpicker（鳥）。活著翅膀拍動，死掉旋轉墜落。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Nitpicker} bird - 鳥的狀態。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @param {number} elapsed - 動畫時間。
   * @returns {void}
   * @depends BIRD_W, BIRD_H
   */
  draw_nitpicker(canvas_context, bird, offset_x, camera_y, elapsed) {
    const sx = Math.floor(bird.x + offset_x);
    const sy = Math.floor(bird.y - camera_y);
    const flap = Math.floor(elapsed * 8) % 2 === 0 ? -1 : 1;
    const wing_y_top = bird.alive ? sy + (flap < 0 ? -1 : 1) : sy + 1;

    // 死掉用比較灰的色，活著用彩色
    const body = bird.alive ? '#4a2a86' : '#5a5a5a';
    const wing = bird.alive ? '#9b6ed8' : '#7a7a7a';
    const beak = bird.alive ? '#ffd75a' : '#a08020';

    // 身體
    canvas_context.fillStyle = body;
    canvas_context.fillRect(sx + 3, sy + 2, BIRD_W - 6, BIRD_H - 3);
    canvas_context.fillRect(sx + 4, sy + 1, BIRD_W - 8, 1);

    // 翅膀（會拍動）
    canvas_context.fillStyle = wing;
    if (bird.alive) {
      if (flap < 0) {
        canvas_context.fillRect(sx + 1, sy + 1, 3, 2);
        canvas_context.fillRect(sx + BIRD_W - 4, sy + 1, 3, 2);
      } else {
        canvas_context.fillRect(sx, sy + 3, 3, 2);
        canvas_context.fillRect(sx + BIRD_W - 3, sy + 3, 3, 2);
      }
    } else {
      // 死掉翅膀下垂
      canvas_context.fillRect(sx + 1, sy + 4, 2, 2);
      canvas_context.fillRect(sx + BIRD_W - 3, sy + 4, 2, 2);
    }

    // 鳥嘴（指 facing 方向）
    canvas_context.fillStyle = beak;
    const beak_x = bird.facing > 0 ? sx + BIRD_W - 1 : sx - 1;
    canvas_context.fillRect(beak_x, sy + 3, 2, 1);

    // 眼睛
    canvas_context.fillStyle = '#ffffff';
    const eye_x = bird.facing > 0 ? sx + BIRD_W - 4 : sx + 3;
    canvas_context.fillRect(eye_x, sy + 2, 1, 1);
  }

  /**
   * 繪製冰柱：hanging 穩定、shaking 左右抖動、falling 朝下移動。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Icicle} icicle - icicle 狀態。
   * @param {number} offset_x - 遊戲區域左側偏移。
   * @param {number} camera_y - 目前攝影機 Y 座標。
   * @param {number} elapsed - 抖動取樣用。
   * @returns {void}
   * @depends ICICLE_W, ICICLE_H, ICICLE_STATE
   */
  draw_icicle(canvas_context, icicle, offset_x, camera_y, elapsed) {
    if (icicle.state === ICICLE_STATE.DEAD) return;
    const shake_dx = icicle.state === ICICLE_STATE.SHAKING
      ? (Math.floor(elapsed * 40) % 2 === 0 ? -1 : 1)
      : 0;
    const sx = Math.floor(icicle.x + offset_x) + shake_dx;
    const sy = Math.floor(icicle.y - camera_y);

    canvas_context.fillStyle = '#a8d8ff';
    canvas_context.fillRect(sx, sy, ICICLE_W, ICICLE_H - 3);
    canvas_context.fillStyle = '#7cb6e0';
    canvas_context.fillRect(sx, sy + 1, 1, ICICLE_H - 4);
    canvas_context.fillRect(sx + ICICLE_W - 1, sy + 1, 1, ICICLE_H - 4);

    // 尖端逐漸收窄
    canvas_context.fillStyle = '#a8d8ff';
    canvas_context.fillRect(sx + 1, sy + ICICLE_H - 3, ICICLE_W - 2, 1);
    canvas_context.fillRect(sx + 1, sy + ICICLE_H - 2, 1, 1);
    canvas_context.fillRect(sx + ICICLE_W - 2, sy + ICICLE_H - 2, 1, 1);

    canvas_context.fillStyle = '#ffffff';
    canvas_context.fillRect(sx + 1, sy + 1, 1, 2);
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
