import { Scene } from '../engine/Scene.js';
import { Btn } from '../engine/Input.js';
import { drawText } from '../engine/PixelFont.js';
import { PeerSession } from '../net/PeerSession.js';
import { HostNetAdapter, GuestNetAdapter } from '../net/NetAdapters.js';
import { ROOM_ALPHABET, ROOM_PREFIX, normalizeRoomCode } from '../net/NetProtocol.js';

const MODE_LABELS = Object.freeze({
  host: 'HOST',
  join: 'JOIN',
});

/**
 * WebRTC 配對大廳；負責建立/加入 PeerJS 房間，成功後切進遊戲。
 *
 * @returns {LobbyScene} lobby scene。
 * @depends PeerSession, HostNetAdapter, GuestNetAdapter
 */
export class LobbyScene extends Scene {
  /**
   * 建立 LobbyScene。
   *
   * @param {{game_id: string, mode: 'host'|'join', join_code?: string}} options - 連線目標與模式。
   * @returns {LobbyScene} lobby scene。
   * @depends PeerSession
   */
  constructor({ game_id, mode, join_code = '' }) {
    super();
    this.game_id = game_id;
    this.mode = mode;
    this.join_code = join_code;
    this.ctx = null;
    this.session = null;
    this.adapter = null;
    this.room_code = '';
    this.status = 'CONNECTING';
    this.error = '';
    this.launched = false;
    this.blink = 0;
    this.code_slots = this._makeCodeSlots(join_code);
    this.code_cursor = Math.min(this._filledSlotCount(), this.code_slots.length - 1);
    this.char_cursor = this._charIndexForSlot(this.code_cursor);
  }

  /**
   * 初始化大廳並開始 PeerJS 連線流程。
   *
   * @param {object} ctx - Scene context。
   * @returns {Promise<void>} 初始化流程排定後 resolve。
   * @depends PeerSession
   */
  async init(ctx) {
    this.ctx = ctx;
    if (this.mode === 'host') {
      this._startConnection();
    } else {
      this.status = 'ENTER CODE';
    }
  }

  /**
   * 更新大廳輸入；START/B 取消，錯誤時 A 重試。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Btn
   */
  update(dt) {
    const input = this.ctx.input;
    this.blink = (this.blink + dt) % 1.0;

    if (this.mode === 'join' && !this.error && this.status !== 'CONNECTING') {
      this._updateJoinInput(input);
      return;
    }

    if (this.error && input.wasPressed(Btn.A)) {
      if (this.mode === 'join' && this.error === 'CODE INCOMPLETE') {
        this.error = '';
        this.status = 'ENTER CODE';
        return;
      }
      this._startConnection();
      return;
    }

    if (input.wasPressed(Btn.START) || input.wasPressed(Btn.B)) {
      this.ctx.exitToMenu();
    }
  }

  /**
   * 繪製大廳狀態。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @returns {void}
   * @depends drawText
   */
  render(canvas_context) {
    const { lw: logical_w, lh: logical_h } = this.ctx.canvas;
    canvas_context.fillStyle = '#10172f';
    canvas_context.fillRect(0, 0, logical_w, logical_h);
    canvas_context.fillStyle = '#6bb6d6';
    canvas_context.fillRect(0, 0, logical_w, 24);
    canvas_context.fillStyle = '#ffffff';
    canvas_context.fillRect(0, 23, logical_w, 1);

    drawText(canvas_context, '2P LOBBY', logical_w / 2, 42, { scale: 2, color: '#ffcc33', align: 'center' });
    drawText(canvas_context, `MODE ${MODE_LABELS[this.mode] || '2P'}`, logical_w / 2, 74,
      { scale: 1, color: '#e8e8e8', align: 'center' });

    if (this.room_code) {
      drawText(canvas_context, this.room_code.toUpperCase(), logical_w / 2, 102,
        { scale: 1, color: '#9cf7ff', align: 'center' });
    } else if (this.mode === 'join') {
      this._drawJoinEditor(canvas_context, logical_w);
    }

    const status_color = this.error ? '#ff6666' : '#a8b0c0';
    const status_text = this.error || this.status;
    drawText(canvas_context, status_text, logical_w / 2, 132, { scale: 1, color: status_color, align: 'center' });

    if (this.mode === 'host' && !this.error && this.blink < 0.5) {
      drawText(canvas_context, 'WAITING GUEST', logical_w / 2, 154,
        { scale: 1, color: '#ffffff', align: 'center' });
    }

    const hint = this._hintText();
    drawText(canvas_context, hint, logical_w / 2, logical_h - 22,
      { scale: 1, color: '#6b7388', align: 'center' });
  }

  /**
   * 離開大廳時釋放尚未轉交給遊戲的連線。
   *
   * @returns {void}
   * @depends PeerSession.close
   */
  destroy() {
    if (this.launched) return;
    if (this.adapter) this.adapter.destroy();
    else if (this.session) this.session.close();
  }

  /**
   * 依目前模式開始建立或加入房間。
   *
   * @returns {void}
   * @depends PeerSession
   */
  _startConnection() {
    if (this.adapter) {
      this.adapter.destroy();
    } else if (this.session) {
      this.session.close();
    }
    this.session = new PeerSession();
    this.adapter = null;
    this.error = '';
    this.status = 'CONNECTING';
    this.room_code = '';
    if (this.mode === 'host') {
      this._connectHost();
    } else {
      this._connectJoin();
    }
  }

  /**
   * 建立 host 房間，等 guest 連上後進入遊戲。
   *
   * @returns {void}
   * @depends PeerSession.host, HostNetAdapter
   */
  async _connectHost() {
    try {
      this.room_code = await this.session.host();
      this.status = 'WAITING';
      this.session.onOpen(() => {
        this.adapter = new HostNetAdapter(this.session);
        this._launchGame(this.adapter);
      });
    } catch (error) {
      this._setError(error);
    }
  }

  /**
   * 加入 host 房間，成功後進入遊戲。
   *
   * @returns {void}
   * @depends PeerSession.join, GuestNetAdapter
   */
  async _connectJoin() {
    try {
      this.room_code = normalizeRoomCode(this.code_slots.join(''));
      await this.session.join(this.room_code);
      this.adapter = new GuestNetAdapter(this.session);
      this._launchGame(this.adapter);
    } catch (error) {
      this._setError(error);
    }
  }

  /**
   * 將 net adapter 轉交給遊戲場景。
   *
   * @param {HostNetAdapter|GuestNetAdapter} adapter - 已連線的 net adapter。
   * @returns {void}
   * @depends ctx.launchGame
   */
  _launchGame(adapter) {
    this.launched = true;
    this.status = 'CONNECTED';
    this.ctx.launchGame(this.game_id, { net: adapter });
  }

  /**
   * 轉換錯誤為可顯示文字。
   *
   * @param {Error} error - 連線錯誤。
   * @returns {void}
   * @depends none
   */
  _setError(error) {
    this.error = error && error.message ? error.message.toUpperCase().slice(0, 24) : 'CONNECT FAILED';
    this.status = 'ERROR';
  }

  /**
   * 從預填代碼建立 6 格 join code slot。
   *
   * @param {string} join_code - 可選的完整或簡短房間代碼。
   * @returns {string[]} 長度固定為 6 的代碼 slot。
   * @depends normalizeRoomCode, ROOM_PREFIX
   */
  _makeCodeSlots(join_code) {
    const slots = new Array(6).fill('');
    const normalized_code = normalizeRoomCode(join_code);
    const suffix = normalized_code.startsWith(ROOM_PREFIX)
      ? normalized_code.slice(ROOM_PREFIX.length)
      : normalized_code;
    suffix.slice(0, slots.length).split('').forEach((code_char, char_index) => {
      if (ROOM_ALPHABET.includes(code_char)) slots[char_index] = code_char;
    });
    return slots;
  }

  /**
   * 更新 JOIN 代碼輸入器。
   *
   * @param {InputState} input - 目前 tick 的輸入狀態。
   * @returns {void}
   * @depends Btn, ROOM_ALPHABET
   */
  _updateJoinInput(input) {
    if (input.wasPressed(Btn.LEFT)) this._moveJoinCursor(-1);
    if (input.wasPressed(Btn.RIGHT)) this._moveJoinCursor(1);
    if (input.wasPressed(Btn.UP)) this._setJoinChar(-1);
    if (input.wasPressed(Btn.DOWN)) this._setJoinChar(1);
    if (input.wasPressed(Btn.A)) {
      this.code_slots[this.code_cursor] = ROOM_ALPHABET[this.char_cursor];
      if (this.code_cursor < this.code_slots.length - 1) this.code_cursor += 1;
      else this._submitJoinCode();
    }
    if (input.wasPressed(Btn.B)) this._deleteJoinChar();
    if (input.wasPressed(Btn.START)) this._submitJoinCode();
  }

  /**
   * 移動 JOIN code slot 游標。
   *
   * @param {number} direction - -1 往左，1 往右。
   * @returns {void}
   * @depends ROOM_ALPHABET
   */
  _moveJoinCursor(direction) {
    this.code_cursor = (this.code_cursor + direction + this.code_slots.length) % this.code_slots.length;
    this.char_cursor = this._charIndexForSlot(this.code_cursor);
  }

  /**
   * 切換目前 slot 的候選字元。
   *
   * @param {number} direction - -1 往上一個字元，1 往下一個字元。
   * @returns {void}
   * @depends ROOM_ALPHABET
   */
  _setJoinChar(direction) {
    this.char_cursor = (this.char_cursor + direction + ROOM_ALPHABET.length) % ROOM_ALPHABET.length;
    this.code_slots[this.code_cursor] = ROOM_ALPHABET[this.char_cursor];
  }

  /**
   * 刪除目前或前一個 slot 的字元。
   *
   * @returns {void}
   * @depends none
   */
  _deleteJoinChar() {
    if (this.code_slots[this.code_cursor]) {
      this.code_slots[this.code_cursor] = '';
      return;
    }
    if (this.code_cursor > 0) {
      this.code_cursor -= 1;
      this.code_slots[this.code_cursor] = '';
    }
  }

  /**
   * 檢查代碼完整後開始 join。
   *
   * @returns {void}
   * @depends PeerSession.join
   */
  _submitJoinCode() {
    if (this._filledSlotCount() !== this.code_slots.length) {
      this.error = 'CODE INCOMPLETE';
      this.status = 'ERROR';
      return;
    }
    this._startConnection();
  }

  /**
   * 計算已輸入 slot 數量。
   *
   * @returns {number} 已填入的 slot 數量。
   * @depends none
   */
  _filledSlotCount() {
    return this.code_slots.filter(Boolean).length;
  }

  /**
   * 取得指定 slot 目前字元在 ROOM_ALPHABET 的索引。
   *
   * @param {number} slot_index - 代碼 slot 索引。
   * @returns {number} 字元索引；空 slot 回傳 0。
   * @depends ROOM_ALPHABET
   */
  _charIndexForSlot(slot_index) {
    const slot_char = this.code_slots[slot_index];
    const char_index = ROOM_ALPHABET.indexOf(slot_char);
    return char_index >= 0 ? char_index : 0;
  }

  /**
   * 繪製 canvas 內 JOIN 代碼輸入器。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} logical_w - 邏輯畫面寬度。
   * @returns {void}
   * @depends drawText, ROOM_ALPHABET
   */
  _drawJoinEditor(canvas_context, logical_w) {
    drawText(canvas_context, ROOM_PREFIX.toUpperCase(), 50, 102,
      { scale: 1, color: '#6b7388', align: 'left' });
    for (let slot_index = 0; slot_index < this.code_slots.length; slot_index++) {
      const slot_x = 94 + slot_index * 18;
      const is_selected = slot_index === this.code_cursor;
      canvas_context.fillStyle = is_selected ? '#ffcc33' : '#24315a';
      canvas_context.fillRect(slot_x - 3, 96, 14, 18);
      canvas_context.fillStyle = '#10172f';
      canvas_context.fillRect(slot_x - 1, 98, 10, 14);
      const slot_char = this.code_slots[slot_index] || (is_selected ? ROOM_ALPHABET[this.char_cursor] : '-');
      drawText(canvas_context, slot_char, slot_x, 101,
        { scale: 1, color: is_selected ? '#ffcc33' : '#9cf7ff', align: 'left' });
    }
    drawText(canvas_context, 'UD CHANGE  LR SLOT', logical_w / 2, 154,
      { scale: 1, color: '#ffffff', align: 'center' });
  }

  /**
   * 依目前狀態產生底部操作提示。
   *
   * @returns {string} HUD 提示文字。
   * @depends none
   */
  _hintText() {
    if (this.error) return 'A RETRY  START BACK';
    if (this.mode === 'join' && this.status !== 'CONNECTING') return 'A SET  START JOIN';
    return 'START BACK';
  }
}
