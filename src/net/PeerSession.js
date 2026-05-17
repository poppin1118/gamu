import { generateRoomCode, normalizeRoomCode } from './NetProtocol.js';

/**
 * 包裝 PeerJS Peer/DataConnection，提供遊戲需要的 host/join/send callback 介面。
 *
 * @returns {PeerSession} PeerJS session 實體。
 * @depends window.Peer
 */
export class PeerSession {
  /**
   * 建立 PeerSession。
   *
   * @param {{peer_factory?: Function}} options - 可注入 Peer factory 以便測試。
   * @returns {PeerSession} PeerJS session 實體。
   * @depends window.Peer
   */
  constructor({ peer_factory = globalThis.Peer } = {}) {
    this.peer_factory = peer_factory;
    this.peer = null;
    this.conn = null;
    this.room_code = '';
    this.message_handlers = [];
    this.open_handlers = [];
    this.disconnect_handlers = [];
  }

  /**
   * 建立可被 guest 加入的房間代碼。
   *
   * @returns {Promise<string>} PeerJS open 後 resolve 房間代碼。
   * @depends generateRoomCode, PeerJS
   */
  async host() {
    this._assertPeerAvailable();
    this.room_code = generateRoomCode();
    this.peer = new this.peer_factory(this.room_code);
    this.peer.on('connection', (connection) => this._bindConnection(connection));
    await this._waitPeerOpen();
    return this.room_code;
  }

  /**
   * 加入既有房間，並等待 DataConnection 開通。
   *
   * @param {string} raw_code - host 顯示的房間代碼。
   * @returns {Promise<string>} 連線成功後 resolve 正規化房間代碼。
   * @depends normalizeRoomCode, PeerJS
   */
  async join(raw_code) {
    this._assertPeerAvailable();
    this.room_code = normalizeRoomCode(raw_code);
    if (!this.room_code) throw new Error('ROOM CODE EMPTY');
    this.peer = new this.peer_factory();
    await this._waitPeerOpen();
    const connection = this.peer.connect(this.room_code, { reliable: false });
    this._bindConnection(connection);
    await this._waitConnectionOpen(connection);
    return this.room_code;
  }

  /**
   * 傳送 JSON-safe 訊息給對方。
   *
   * @param {object} message - 要傳送的協定訊息。
   * @returns {void}
   * @depends PeerJS DataConnection
   */
  send(message) {
    if (!this.conn || this.conn.open !== true) return;
    this.conn.send(message);
  }

  /**
   * 註冊收到訊息時的 callback。
   *
   * @param {(message: object) => void} handler - 訊息處理函式。
   * @returns {void}
   * @depends none
   */
  onMessage(handler) {
    this.message_handlers.push(handler);
  }

  /**
   * 註冊 DataConnection open callback。
   *
   * @param {() => void} handler - 連線開通處理函式。
   * @returns {void}
   * @depends none
   */
  onOpen(handler) {
    this.open_handlers.push(handler);
  }

  /**
   * 註冊斷線或 PeerJS error callback。
   *
   * @param {(error?: Error) => void} handler - 斷線處理函式。
   * @returns {void}
   * @depends none
   */
  onDisconnect(handler) {
    this.disconnect_handlers.push(handler);
  }

  /**
   * 關閉目前 PeerJS 連線。
   *
   * @returns {void}
   * @depends PeerJS
   */
  close() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.conn = null;
    this.peer = null;
  }

  /**
   * 確認 PeerJS script 已載入。
   *
   * @returns {void}
   * @throws {Error} PeerJS 不存在時丟出。
   * @depends window.Peer
   */
  _assertPeerAvailable() {
    if (typeof this.peer_factory !== 'function') {
      throw new Error('PEERJS NOT LOADED');
    }
  }

  /**
   * 等待 PeerJS peer open。
   *
   * @returns {Promise<void>} peer open 時 resolve。
   * @depends PeerJS
   */
  _waitPeerOpen() {
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => resolve());
      this.peer.on('error', (error) => reject(error));
    });
  }

  /**
   * 等待 DataConnection open。
   *
   * @param {DataConnection} connection - PeerJS DataConnection。
   * @returns {Promise<void>} connection open 時 resolve。
   * @depends PeerJS
   */
  _waitConnectionOpen(connection) {
    return new Promise((resolve, reject) => {
      connection.on('open', () => resolve());
      connection.on('error', (error) => reject(error));
    });
  }

  /**
   * 綁定 PeerJS DataConnection 事件。
   *
   * @param {DataConnection} connection - PeerJS DataConnection。
   * @returns {void}
   * @depends PeerJS
   */
  _bindConnection(connection) {
    const previous_connection = this.conn;
    this.conn = connection;
    if (previous_connection && previous_connection !== connection) previous_connection.close();
    connection.on('open', () => this._emitOpen());
    connection.on('data', (message) => this._emitMessage(message));
    connection.on('close', () => {
      if (this.conn !== connection) return;
      this._emitDisconnect();
    });
    connection.on('error', (error) => {
      if (this.conn !== connection) return;
      this._emitDisconnect(error);
    });
  }

  /**
   * 通知連線已開通。
   *
   * @returns {void}
   * @depends none
   */
  _emitOpen() {
    for (const handler of this.open_handlers) handler();
  }

  /**
   * 通知收到訊息。
   *
   * @param {object} message - PeerJS 收到的資料。
   * @returns {void}
   * @depends none
   */
  _emitMessage(message) {
    for (const handler of this.message_handlers) handler(message);
  }

  /**
   * 通知斷線或連線錯誤。
   *
   * @param {Error} error - PeerJS error。
   * @returns {void}
   * @depends none
   */
  _emitDisconnect(error) {
    for (const handler of this.disconnect_handlers) handler(error);
  }
}
