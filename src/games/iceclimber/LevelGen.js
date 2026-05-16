import { TYPE, GRID_W } from './IceGrid.js';

export const TOTAL_ROWS = 33;
export const GOAL_ROW = 32;
export const FLOOR_ROWS = 4;
export const TOTAL_FLOORS = 8;

export function generateLevel(rng) {
  const rows = [];
  rows.push(new Array(GRID_W).fill(TYPE.SOLID));

  for (let r = 1; r <= GOAL_ROW - 1; r++) {
    rows.push(generateRow(r, rng, rows[r - 1], rows[r - 2]));
  }

  const finalRow = new Array(GRID_W).fill(TYPE.SOLID);
  const finalGapCol = Math.floor(rng.next() * GRID_W);
  finalRow[finalGapCol] = TYPE.EMPTY;
  rows.push(finalRow);

  for (let r = GOAL_ROW - 3; r <= GOAL_ROW - 1; r++) {
    rows[r][finalGapCol] = TYPE.EMPTY;
  }

  return rows;
}

export function generateRow(rowIndex, rng, prev1, prev2) {
  if (rowIndex === 0 || rowIndex === GOAL_ROW) {
    return new Array(GRID_W).fill(TYPE.SOLID);
  }

  const isFloorLine = rowIndex % FLOOR_ROWS === 0;
  const minGaps = 1;
  const maxGaps = isFloorLine ? 2 : 4;
  const numGaps = minGaps + Math.floor(rng.next() * (maxGaps - minGaps + 1));

  const cols = [];
  for (let i = 0; i < GRID_W; i++) cols.push(i);
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }

  const row = new Array(GRID_W).fill(TYPE.ICE);
  let placed = 0;
  for (const c of cols) {
    if (placed >= numGaps) break;
    const p1 = prev1 && prev1[c] === TYPE.EMPTY;
    const p2 = prev2 && prev2[c] === TYPE.EMPTY;
    if (p1 && p2) continue;
    row[c] = TYPE.EMPTY;
    placed++;
  }
  if (placed === 0) {
    row[Math.floor(rng.next() * GRID_W)] = TYPE.EMPTY;
  }
  return row;
}
