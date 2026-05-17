import { CELL_W, CELL_H } from './IceGrid.js';

export const HBOX_W = CELL_W;
export const HBOX_H = CELL_H * 2;
export const HBOX_Y_OFFSET = -CELL_H;

/**
 * 取得槌擊判定盒；判定偏向玩家前上方，用來敲開跳躍路徑上的冰塊。
 *
 * @param {Player} player - 目前玩家位置、面向與尺寸狀態。
 * @returns {{x: number, y: number, w: number, h: number}} 槌擊 AABB 判定盒。
 * @depends CELL_W, CELL_H
 */
export function hammerHitbox(player) {
  const x = player.facing > 0 ? player.x + 12 : player.x - HBOX_W;
  const y = player.y + HBOX_Y_OFFSET;
  return { x, y, w: HBOX_W, h: HBOX_H };
}
