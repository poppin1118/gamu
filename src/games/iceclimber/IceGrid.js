export const GRID_W = 8;
export const CELL_W = 16;
export const CELL_H = 16;
export const PLAYFIELD_W = GRID_W * CELL_W;

export const TYPE = Object.freeze({
  EMPTY: 0,
  ICE: 1,
  SOLID: 2,
});

export const ICE_HITS = 2;

export class IceGrid {
  constructor() {
    this.rows = [];
  }

  numRows() { return this.rows.length; }

  setRow(r, types) {
    while (this.rows.length <= r) this.rows.push(this._emptyRow());
    this.rows[r] = types.map((t) => ({
      type: t,
      hits: t === TYPE.ICE ? ICE_HITS : (t === TYPE.SOLID ? 99 : 0),
    }));
  }

  _emptyRow() {
    const arr = new Array(GRID_W);
    for (let i = 0; i < GRID_W; i++) arr[i] = { type: TYPE.EMPTY, hits: 0 };
    return arr;
  }

  cellAt(col, row) {
    if (col < 0 || col >= GRID_W) return null;
    if (row < 0 || row >= this.rows.length) return null;
    return this.rows[row][col];
  }

  isSolidAt(col, row) {
    const c = this.cellAt(col, row);
    return !!c && (c.type === TYPE.ICE || c.type === TYPE.SOLID);
  }

  rowTopY(r) { return -r * CELL_H; }
  rowBottomY(r) { return -r * CELL_H + CELL_H; }
  colLeftX(c) { return c * CELL_W; }
  colRightX(c) { return c * CELL_W + CELL_W; }

  hit(col, row, dmg) {
    const c = this.cellAt(col, row);
    if (!c || c.type !== TYPE.ICE) return false;
    c.hits -= dmg;
    if (c.hits <= 0) {
      c.type = TYPE.EMPTY;
      c.hits = 0;
      return true;
    }
    return false;
  }
}
