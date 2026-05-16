import { CELL_W, CELL_H } from './IceGrid.js';

export const HBOX_W = CELL_W;
export const HBOX_H = CELL_H * 2;
export const HBOX_Y_OFFSET = 2;

export function hammerHitbox(player) {
  const x = player.facing > 0 ? player.x + 12 : player.x - HBOX_W;
  const y = player.y + HBOX_Y_OFFSET;
  return { x, y, w: HBOX_W, h: HBOX_H };
}
