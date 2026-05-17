export const GRID_W = 8;
export const CELL_W = 16;
export const CELL_H = 8;
export const PLAYFIELD_W = GRID_W * CELL_W;

export const TYPE = Object.freeze({
  EMPTY: 0,
  ICE: 1,
  SOLID: 2,
});

export const ICE_HITS = 2;

/**
 * 管理冰塔格狀資料與破冰規則。
 *
 * @returns {IceGrid} 冰磚網格實體。
 * @depends TYPE, GRID_W, CELL_W, CELL_H
 */
export class IceGrid {
  /**
   * 建立空白冰磚列集合。
   *
   * @returns {IceGrid} 冰磚網格實體。
   * @depends none
   */
  constructor() {
    this.rows = [];
  }

  /**
   * 取得目前已建立的列數。
   *
   * @returns {number} rows 陣列長度。
   * @depends none
   */
  numRows() { return this.rows.length; }

  /**
   * 設定指定列的 cell type，並轉成含 hits 的 cell 物件。
   *
   * @param {number} row_index - 要寫入的列索引。
   * @param {number[]} types - 該列每一欄的 cell type。
   * @returns {void}
   * @depends TYPE, ICE_HITS
   */
  setRow(row_index, types) {
    while (this.rows.length <= row_index) this.rows.push(this._emptyRow());
    this.rows[row_index] = types.map((type) => ({
      type,
      hits: type === TYPE.ICE ? ICE_HITS : (type === TYPE.SOLID ? 99 : 0),
    }));
  }

  /**
   * 建立一列空白 cell。
   *
   * @returns {{type: number, hits: number}[]} 空白 cell 陣列。
   * @depends GRID_W, TYPE
   */
  _emptyRow() {
    const row = new Array(GRID_W);
    for (let col_index = 0; col_index < GRID_W; col_index++) {
      row[col_index] = { type: TYPE.EMPTY, hits: 0 };
    }
    return row;
  }

  /**
   * 依欄列取得 cell。
   *
   * @param {number} col_index - 欄索引。
   * @param {number} row_index - 列索引。
   * @returns {{type: number, hits: number} | null} 找到的 cell，超界時為 null。
   * @depends GRID_W
   */
  cellAt(col_index, row_index) {
    if (col_index < 0 || col_index >= GRID_W) return null;
    if (row_index < 0 || row_index >= this.rows.length) return null;
    return this.rows[row_index][col_index];
  }

  /**
   * 判斷指定 cell 是否可碰撞。
   *
   * @param {number} col_index - 欄索引。
   * @param {number} row_index - 列索引。
   * @returns {boolean} true 表示冰磚或不可破底層。
   * @depends TYPE, cellAt
   */
  isSolidAt(col_index, row_index) {
    const cell = this.cellAt(col_index, row_index);
    return !!cell && (cell.type === TYPE.ICE || cell.type === TYPE.SOLID);
  }

  /**
   * 取得列頂端世界座標。
   *
   * @param {number} row_index - 列索引。
   * @returns {number} 該列頂端 Y。
   * @depends CELL_H
   */
  rowTopY(row_index) { return -row_index * CELL_H; }

  /**
   * 取得列底端世界座標。
   *
   * @param {number} row_index - 列索引。
   * @returns {number} 該列底端 Y。
   * @depends CELL_H
   */
  rowBottomY(row_index) { return -row_index * CELL_H + CELL_H; }

  /**
   * 取得欄左側世界座標。
   *
   * @param {number} col_index - 欄索引。
   * @returns {number} 該欄左側 X。
   * @depends CELL_W
   */
  colLeftX(col_index) { return col_index * CELL_W; }

  /**
   * 取得欄右側世界座標。
   *
   * @param {number} col_index - 欄索引。
   * @returns {number} 該欄右側 X。
   * @depends CELL_W
   */
  colRightX(col_index) { return col_index * CELL_W + CELL_W; }

  /**
   * 對冰磚造成傷害，破壞成功時轉為空格。
   *
   * @param {number} col_index - 欄索引。
   * @param {number} row_index - 列索引。
   * @param {number} damage - 傷害值。
   * @returns {boolean} true 表示本次擊碎冰磚。
   * @depends TYPE, cellAt
   */
  hit(col_index, row_index, damage) {
    const cell = this.cellAt(col_index, row_index);
    if (!cell || cell.type !== TYPE.ICE) return false;
    cell.hits -= damage;
    if (cell.hits <= 0) {
      cell.type = TYPE.EMPTY;
      cell.hits = 0;
      return true;
    }
    return false;
  }
}
