import { InputState } from '../engine/Input.js';
import { MSG, applyInputBits, packInput } from './NetProtocol.js';

const SNAPSHOT_INTERVAL_TICKS = 2;

/**
 * Host 端 authoritative adapter：接收 guest input，定期送 snapshot。
 *
 * @returns {HostNetAdapter} host net adapter。
 * @depends PeerSession, NetProtocol
 */
export class HostNetAdapter {
  /**
   * 建立 host adapter。
   *
   * @param {PeerSession} session - 已連線的 PeerSession。
   * @returns {HostNetAdapter} host net adapter。
   * @depends InputState, PeerSession
   */
  constructor(session) {
    this.role = 'host';
    this.session = session;
    this.room_code = session.room_code;
    this.remote_input = new InputState();
    this.tick_index = 0;
    this.last_snapshot = null;
    this.disconnected = false;
    this.session.onMessage((message) => this._handleMessage(message));
    this.session.onOpen(() => {
      this.disconnected = false;
      this.remote_input = new InputState();
      if (this.last_snapshot) this.session.send({ type: MSG.SNAPSHOT, snapshot: this.last_snapshot });
    });
    this.session.onDisconnect(() => {
      this.disconnected = true;
      this.remote_input = new InputState();
    });
  }

  /**
   * 取得 guest 最近一筆輸入狀態。
   *
   * @returns {InputState} guest 輸入狀態。
   * @depends InputState
   */
  getRemoteInput() {
    return this.remote_input;
  }

  /**
   * host update 完成後呼叫，用來送 snapshot 給 guest。
   *
   * @param {object} snapshot - 遊戲完整快照。
   * @returns {void}
   * @depends PeerSession.send
   */
  afterTick(snapshot) {
    this.tick_index += 1;
    this.last_snapshot = snapshot;
    if (this.tick_index % SNAPSHOT_INTERVAL_TICKS !== 0) return;
    this.session.send({ type: MSG.SNAPSHOT, snapshot });
  }

  /**
   * 清除 remote input 的 pressed/released 邊緣。
   *
   * @returns {void}
   * @depends InputState.beginTick
   */
  beginTick() {
    this.remote_input.beginTick();
  }

  /**
   * 關閉底層 session。
   *
   * @returns {void}
   * @depends PeerSession.close
   */
  destroy() {
    this.session.close();
  }

  /**
   * 處理 guest 傳來的 protocol message。
   *
   * @param {object} message - protocol message。
   * @returns {void}
   * @depends applyInputBits
   */
  _handleMessage(message) {
    if (!message || message.type !== MSG.INPUT) return;
    applyInputBits(this.remote_input, message.bits || 0);
  }
}

/**
 * Guest 端 adapter：每 tick 傳 local input，收到 host snapshot 後交給 scene。
 *
 * @returns {GuestNetAdapter} guest net adapter。
 * @depends PeerSession, NetProtocol
 */
export class GuestNetAdapter {
  /**
   * 建立 guest adapter。
   *
   * @param {PeerSession} session - 已連線的 PeerSession。
   * @returns {GuestNetAdapter} guest net adapter。
   * @depends PeerSession
   */
  constructor(session) {
    this.role = 'guest';
    this.session = session;
    this.room_code = session.room_code;
    this.snapshot_handler = null;
    this.disconnected = false;
    this.session.onMessage((message) => this._handleMessage(message));
    this.session.onOpen(() => { this.disconnected = false; });
    this.session.onDisconnect(() => { this.disconnected = true; });
  }

  /**
   * 送出 guest 本機輸入。
   *
   * @param {InputState} input_state - guest 本機輸入狀態。
   * @returns {void}
   * @depends packInput, PeerSession.send
   */
  updateLocalInput(input_state) {
    this.session.send({ type: MSG.INPUT, bits: packInput(input_state) });
  }

  /**
   * 註冊 snapshot callback。
   *
   * @param {(snapshot: object) => void} handler - 收到 snapshot 後呼叫。
   * @returns {void}
   * @depends none
   */
  onSnapshot(handler) {
    this.snapshot_handler = handler;
  }

  /**
   * 關閉底層 session。
   *
   * @returns {void}
   * @depends PeerSession.close
   */
  destroy() {
    this.session.close();
  }

  /**
   * 處理 host 傳來的 protocol message。
   *
   * @param {object} message - protocol message。
   * @returns {void}
   * @depends MSG
   */
  _handleMessage(message) {
    if (!message || message.type !== MSG.SNAPSHOT || !this.snapshot_handler) return;
    this.snapshot_handler(message.snapshot);
  }
}
