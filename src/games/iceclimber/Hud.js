import { drawText } from '../../engine/PixelFont.js';
import { TOTAL_FLOORS } from './LevelGen.js';

const SCREEN_W = 256;
const SCREEN_H = 240;

/**
 * 繪製 NES scoreboard 風格 HUD 與勝敗 overlay。
 *
 * @param {CanvasRenderingContext2D} c - 2D canvas context。
 * @param {{score: number, floor: number, state: string}} status - 分數、樓層與遊戲狀態。
 * @returns {void}
 * @depends drawText, TOTAL_FLOORS
 */
export function renderHud(c, { score, floor, state }) {
  const top_score = Math.max(score, 0);

  c.fillStyle = '#10172f';
  c.fillRect(0, 0, SCREEN_W, 24);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 23, SCREEN_W, 1);

  drawText(c, '1UP', 16, 4, { scale: 1, color: '#ff7070' });
  drawText(c, pad(score, 6), 8, 14, { scale: 1, color: '#ffffff' });
  drawText(c, 'TOP', 104, 4, { scale: 1, color: '#ffd86a' });
  drawText(c, pad(top_score, 6), 96, 14, { scale: 1, color: '#ffffff' });
  drawText(c, `FLOOR ${pad(floor, 2)}/${pad(TOTAL_FLOORS, 2)}`, SCREEN_W - 4, 9,
    { scale: 1, color: '#9cf7ff', align: 'right' });

  if (state === 'won') {
    overlay(c);
    drawText(c, 'YOU MADE IT', SCREEN_W / 2, 90, { scale: 2, color: '#ffef6a', align: 'center' });
    drawText(c, `SCORE ${score}`, SCREEN_W / 2, 120, { scale: 1, color: '#ffffff', align: 'center' });
    drawText(c, 'PRESS START', SCREEN_W / 2, 150, { scale: 1, color: '#a8b0c0', align: 'center' });
  } else if (state === 'lost') {
    overlay(c);
    drawText(c, 'GAME OVER', SCREEN_W / 2, 90, { scale: 2, color: '#ff6666', align: 'center' });
    drawText(c, `SCORE ${score}`, SCREEN_W / 2, 120, { scale: 1, color: '#ffffff', align: 'center' });
    drawText(c, 'PRESS START', SCREEN_W / 2, 150, { scale: 1, color: '#a8b0c0', align: 'center' });
  }
}

/**
 * 繪製半透明狀態遮罩。
 *
 * @param {CanvasRenderingContext2D} c - 2D canvas context。
 * @returns {void}
 * @depends SCREEN_W, SCREEN_H
 */
function overlay(c) {
  c.fillStyle = 'rgba(0, 0, 0, 0.65)';
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

/**
 * 將數字補零到指定寬度。
 *
 * @param {number} n - 要格式化的數字。
 * @param {number} w - 目標字元寬度。
 * @returns {string} 補零後字串。
 * @depends none
 */
function pad(n, w) {
  return String(n).padStart(w, '0');
}
