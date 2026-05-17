import { TYPE, GRID_W } from './IceGrid.js';

export const TOTAL_ROWS = 33;
export const GOAL_ROW = 32;
export const FLOOR_ROWS = 4;
export const TOTAL_FLOORS = 8;

/**
 * 產生 8 層敲冰塊關卡。
 *
 * @param {object} rng - 由 makeRng 建立的 deterministic random helper。
 * @returns {number[][]} 每一列的 cell type 陣列。
 * @depends TYPE, GRID_W, GOAL_ROW
 */
export function generateLevel(rng) {
  const rows = [];
  rows.push(new Array(GRID_W).fill(TYPE.SOLID));

  for (let row_index = 1; row_index <= GOAL_ROW - 1; row_index++) {
    rows.push(generateRow(row_index, rng, rows[row_index - 1], rows[row_index - 2]));
  }

  const final_row = new Array(GRID_W).fill(TYPE.SOLID);
  const final_gap_candidates = [];
  for (let col_index = 0; col_index < GRID_W; col_index++) {
    if (rows[GOAL_ROW - 3][col_index] !== TYPE.EMPTY) final_gap_candidates.push(col_index);
  }
  const final_gap_col = final_gap_candidates.length > 0
    ? final_gap_candidates[Math.floor(rng.next() * final_gap_candidates.length)]
    : Math.floor(rng.next() * GRID_W);
  final_row[final_gap_col] = TYPE.EMPTY;
  rows.push(final_row);

  // 終點前固定挖出短通道，避免最後一段死路但不讓同欄缺口過長。
  for (let row_index = GOAL_ROW - 2; row_index <= GOAL_ROW - 1; row_index++) {
    rows[row_index][final_gap_col] = TYPE.EMPTY;
  }

  return rows;
}

/**
 * 產生單列冰磚配置，限制連續缺口並讓樓層線比一般列更完整。
 *
 * @param {number} row_index - 目前列索引，0 為出生平台。
 * @param {object} rng - 由 makeRng 建立的 deterministic random helper。
 * @param {number[] | undefined} prev_row - 前一列 cell type。
 * @param {number[] | undefined} prev_prev_row - 前兩列 cell type。
 * @returns {number[]} 這一列的 cell type 陣列。
 * @depends TYPE, GRID_W, GOAL_ROW, FLOOR_ROWS
 */
export function generateRow(row_index, rng, prev_row, prev_prev_row) {
  if (row_index === 0 || row_index === GOAL_ROW) {
    return new Array(GRID_W).fill(TYPE.SOLID);
  }

  const is_floor_line = row_index % FLOOR_ROWS === 0;
  const min_gaps = 1;
  const max_gaps = is_floor_line ? 2 : 4;
  const num_gaps = min_gaps + Math.floor(rng.next() * (max_gaps - min_gaps + 1));

  const cols = [];
  for (let col_index = 0; col_index < GRID_W; col_index++) cols.push(col_index);
  for (let shuffle_index = cols.length - 1; shuffle_index > 0; shuffle_index--) {
    const swap_index = Math.floor(rng.next() * (shuffle_index + 1));
    [cols[shuffle_index], cols[swap_index]] = [cols[swap_index], cols[shuffle_index]];
  }

  const row = new Array(GRID_W).fill(TYPE.ICE);
  let placed = 0;
  for (const col_index of cols) {
    if (placed >= num_gaps) break;
    const prev_gap = prev_row && prev_row[col_index] === TYPE.EMPTY;
    const prev_prev_gap = prev_prev_row && prev_prev_row[col_index] === TYPE.EMPTY;
    if (prev_gap && prev_prev_gap) continue;
    row[col_index] = TYPE.EMPTY;
    placed++;
  }
  if (placed === 0) {
    row[Math.floor(rng.next() * GRID_W)] = TYPE.EMPTY;
  }
  return row;
}
