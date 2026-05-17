import { Scene } from '../../engine/Scene.js';
import { Btn } from '../../engine/Input.js';
import { makeRng } from '../../engine/Random.js';
import { drawText } from '../../engine/PixelFont.js';
import {
  IceGrid, GRID_W, CELL_W, CELL_H, PLAYFIELD_W, TYPE,
} from './IceGrid.js';
import { Player, PLAYER_W, PLAYER_H } from './Player.js';
import { Camera } from './Camera.js';
import { generateLevel, GOAL_ROW, FLOOR_ROWS } from './LevelGen.js';
import { IceClimberArt } from './IceClimberArt.js';
import { renderHud } from './Hud.js';
import { Topi, spawnTopis } from './Topi.js';
import { Icicle, spawnIcicles, ICICLE_STATE } from './Icicle.js';
import { Nitpicker, spawnNitpickerAtCamera } from './Nitpicker.js';

export const PLAYFIELD_OFFSET_X = (256 - PLAYFIELD_W) / 2;
const VIEW_H = 240;

const END_DELAY = 1.0;
const PARTICLE_LIFE = 0.28;
const P2_SPAWN_OFFSET_X = CELL_W;
const SNAPSHOT_BUFFER_LIMIT = 8;
const SNAPSHOT_INTERPOLATION_DELAY = 0.08;

export class IceClimberScene extends Scene {
  /**
   * 初始化 Ice Climber 單人場景與 deterministic 關卡。
   *
   * @param {object} ctx - Scene context，包含 canvas、input 與切換場景 callback。
   * @returns {Promise<void>} 初始化完成後 resolve。
   * @depends makeRng, IceGrid, Player, Camera, IceClimberArt
   */
  async init(ctx) {
    this.ctx = ctx;
    this.seed = Date.now() >>> 0;
    this.rng = makeRng(this.seed);
    this.grid = new IceGrid();
    this.art = new IceClimberArt();

    if (ctx.audio) {
      ctx.audio.loadAll({
        jump: './src/games/iceclimber/assets/sfx/jump.ogg',
        hammer: './src/games/iceclimber/assets/sfx/hammer.ogg',
        break: './src/games/iceclimber/assets/sfx/break.ogg',
        win: './src/games/iceclimber/assets/sfx/win.ogg',
        lose: './src/games/iceclimber/assets/sfx/lose.ogg',
      }).catch((err) => console.warn('Ice Climber 音效載入失敗', err));
    }
    this._sfx_prev = { gameState: 'playing', players: [] };

    const rows = generateLevel(this.rng);
    rows.forEach((types, row_index) => this.grid.setRow(row_index, types));

    const spawn_col = Math.floor(GRID_W / 2);
    for (let col_index = spawn_col - 1; col_index <= spawn_col + 1; col_index++) {
      const cell = this.grid.cellAt(col_index, 1);
      if (cell) { cell.type = TYPE.EMPTY; cell.hits = 0; }
    }

    this.net = ctx.net;
    this.net_role = this.net ? this.net.role : 'single';
    const spawn_x = spawn_col * CELL_W + (CELL_W - PLAYER_W) / 2;
    const p1_offset_x = this.net_role === 'single' ? 0 : -P2_SPAWN_OFFSET_X / 2;
    this.player = new Player({
      x: spawn_x + p1_offset_x,
      y: -PLAYER_H,
      tunic_color: '#2472d8',
      tunic_shade: '#174aa3',
    });
    this.player2 = null;
    this.camera = new Camera({ viewH: VIEW_H, deadzoneTop: 140 });
    this.camera.setInitial(this.player.y);

    if (this.net_role !== 'single') {
      this.player2 = new Player({
        x: spawn_x + P2_SPAWN_OFFSET_X / 2,
        y: -PLAYER_H,
        tunic_color: '#d8485f',
        tunic_shade: '#9c2035',
      });
    }
    this.score = 0;
    this.floor = 0;
    this.maxFloor = 0;
    this.gameState = 'playing';
    this.endTimer = 0;
    this.elapsed = 0;
    this.break_effects = [];
    this.topis = spawnTopis(this.rng, this.grid);
    this.icicles = spawnIcicles(this.rng, this.grid);
    this.nitpickers = [];
    this.bird_spawn_timer = 4 + this.rng.next() * 3;
    this.stage_mode = 'climb';
    this.bonus_timer = 0;
    this.vegetables = [];
    this.net_disconnected = false;
    this.net_disconnect_timer = 0;
    this.snapshot_buffer = [];

    if (this.net_role === 'guest' && this.net && typeof this.net.onSnapshot === 'function') {
      this.net.onSnapshot((snapshot) => this._receiveGuestSnapshot(snapshot));
    }
  }

  /**
   * 推進遊戲狀態、玩家、攝影機與破冰粒子。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Player.update, Camera.follow, IceGrid
   */
  update(dt) {
    const input = this.ctx.input;
    this.elapsed += dt;
    this._updateBreakEffects(dt);

    if (this.net_role !== 'single' && this.net) {
      if (this.net.disconnected) {
        this.net_disconnected = true;
      } else if (this.net_disconnected) {
        this._resumeNetworkPlay();
      }
    }
    if (this.net_disconnected) {
      this._updateDisconnect(dt, input);
      return;
    }

    if (this.net_role === 'guest') {
      this._updateGuest(dt, input);
      return;
    }

    if (this.gameState === 'playing' && this.stage_mode === 'bonus') {
      this._updateBonus(dt, input);
      if (this.net_role === 'host' && this.net) {
        this.net.afterTick(this.serializeSnapshot());
        this.net.beginTick();
      }
      return;
    }

    if (this.gameState === 'playing') {
      const players = this._activePlayers();
      const player_inputs = [input, this._getRemoteInput()];
      players.forEach((player, player_index) => {
        player.update(dt, player_inputs[player_index], this.grid);
      });
      this._updateTopis(dt);
      this._updateIcicles(dt, players);
      this._updateNitpickers(dt);
      this._resolveTopiPlayerCollisions(players);
      this._resolveTopiHammerKills(players);
      this._resolveIcicleHammerHits(players);
      this._resolveNitpickerPlayerCollisions(players);
      this._resolveNitpickerHammerKills(players);
      const icicle_killed_player = this._checkIcicleKillsPlayer(players);
      if (icicle_killed_player) {
        this.gameState = 'lost';
        this.endTimer = 0;
      }

      const highest_player_y = Math.min(...players.map((player) => player.y));
      this.camera.follow(highest_player_y);

      for (const player of players) {
        this.score += player.brokeCells.length * 10;
        this._spawnBreakEffects(player.brokeCells);
        if (player.brokeCells.length > 0) this._playSfx('break', { volume: 0.6 });
      }

      const leading_player = players.reduce((best_player, player) => (
        player.y < best_player.y ? player : best_player
      ), players[0]);
      if (leading_player.onGround) {
        const standing_row = Math.round(-leading_player.feetY / CELL_H);
        const new_floor = Math.max(0, Math.floor(standing_row / FLOOR_ROWS));
        if (new_floor > this.maxFloor) {
          this.score += (new_floor - this.maxFloor) * 100;
          this.maxFloor = new_floor;
        }
        this.floor = new_floor;
        if (standing_row >= GOAL_ROW) {
          this.gameState = 'won';
          this.endTimer = 0;
        }
      }

      const every_player_fell = players.every((player) => player.feetY > this.camera.y + VIEW_H + 4);
      if (every_player_fell) {
        this.gameState = 'lost';
        this.endTimer = 0;
      }

      this._emitStateSfx(players);

      if (input.wasPressed(Btn.START)) this.ctx.exitToMenu();
    } else {
      this.endTimer += dt;
      if (this.endTimer >= END_DELAY) {
        if (this.gameState === 'won' && this.stage_mode === 'climb') {
          this._enterBonusStage();
        } else if (input.wasPressed(Btn.START) || input.wasPressed(Btn.A)) {
          this.ctx.exitToMenu();
        }
      }
    }

    if (this.net_role === 'host' && this.net) {
      this.net.afterTick(this.serializeSnapshot());
      this.net.beginTick();
    }
  }

  /**
   * 繪製完整遊戲畫面。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @returns {void}
   * @depends IceClimberArt, renderHud
   */
  render(canvas_context) {
    const render_state = this._guestRenderState();
    const camera_y = render_state ? render_state.camera_y : this.camera.y;
    const players = render_state ? render_state.players : this._activePlayers();
    const elapsed = render_state ? render_state.elapsed : this.elapsed;

    this.art.draw_background(canvas_context, camera_y);
    this.art.draw_side_walls(canvas_context, PLAYFIELD_OFFSET_X);
    this._drawGrid(canvas_context, camera_y);
    this.art.draw_goal_line(canvas_context, PLAYFIELD_OFFSET_X, camera_y);
    for (const topi of this.topis) {
      this.art.draw_topi(canvas_context, topi, PLAYFIELD_OFFSET_X, camera_y, elapsed);
    }
    for (const icicle of this.icicles) {
      this.art.draw_icicle(canvas_context, icicle, PLAYFIELD_OFFSET_X, camera_y, elapsed);
    }
    for (const bird of this.nitpickers) {
      this.art.draw_nitpicker(canvas_context, bird, PLAYFIELD_OFFSET_X, camera_y, elapsed);
    }
    for (const veg of this.vegetables) {
      this.art.draw_vegetable(canvas_context, veg, PLAYFIELD_OFFSET_X, camera_y);
    }
    this.art.draw_break_effects(canvas_context, this.break_effects, PLAYFIELD_OFFSET_X, camera_y);
    players.forEach((player) => this._drawPlayer(canvas_context, player, camera_y, elapsed));
    renderHud(canvas_context, {
      score: this.score,
      floor: this.maxFloor,
      state: this.gameState,
      stage_mode: this.stage_mode,
      bonus_timer: this.bonus_timer,
    });
    if (this.net_disconnected) this._drawDisconnectOverlay(canvas_context);
  }

  /**
   * 匯出 authoritative 遊戲狀態供 host 傳給 guest。
   *
   * @returns {object} 可 JSON 序列化的遊戲 snapshot。
   * @depends Player.serialize, IceGrid.serialize
   */
  serializeSnapshot() {
    return {
      seed: this.seed,
      players: this._activePlayers().map((player) => player.serialize()),
      grid: this.grid.serialize(),
      camera_y: this.camera.y,
      score: this.score,
      floor: this.floor,
      maxFloor: this.maxFloor,
      gameState: this.gameState,
      endTimer: this.endTimer,
      elapsed: this.elapsed,
      topis: this.topis.map((topi) => topi.serialize()),
      icicles: this.icicles.map((icicle) => icicle.serialize()),
      nitpickers: this.nitpickers.map((bird) => bird.serialize()),
      bird_spawn_timer: this.bird_spawn_timer,
      stage_mode: this.stage_mode,
      bonus_timer: this.bonus_timer,
      vegetables: this.vegetables.map((v) => ({ ...v })),
    };
  }

  /**
   * 套用 host 傳來的 authoritative snapshot。
   *
   * @param {object} snapshot - host 產生的完整遊戲狀態。
   * @returns {void}
   * @depends Player.applySnapshot, IceGrid.applySnapshot
   */
  applySnapshot(snapshot) {
    if (!snapshot) return;
    this.seed = snapshot.seed;
    if (snapshot.players && snapshot.players[0]) this.player.applySnapshot(snapshot.players[0]);
    if (snapshot.players && snapshot.players[1]) {
      if (!this.player2) this.player2 = new Player();
      this.player2.applySnapshot(snapshot.players[1]);
    }
    this.grid.applySnapshot(snapshot.grid);
    this.camera.y = snapshot.camera_y;
    this.score = snapshot.score;
    this.floor = snapshot.floor;
    this.maxFloor = snapshot.maxFloor;
    this.gameState = snapshot.gameState;
    this.endTimer = snapshot.endTimer;
    this.elapsed = snapshot.elapsed;

    if (Array.isArray(snapshot.topis)) {
      while (this.topis.length < snapshot.topis.length) this.topis.push(new Topi());
      this.topis.length = snapshot.topis.length;
      for (let i = 0; i < snapshot.topis.length; i++) this.topis[i].applySnapshot(snapshot.topis[i]);
    }
    if (Array.isArray(snapshot.icicles)) {
      while (this.icicles.length < snapshot.icicles.length) this.icicles.push(new Icicle());
      this.icicles.length = snapshot.icicles.length;
      for (let i = 0; i < snapshot.icicles.length; i++) this.icicles[i].applySnapshot(snapshot.icicles[i]);
    }
    if (Array.isArray(snapshot.nitpickers)) {
      while (this.nitpickers.length < snapshot.nitpickers.length) this.nitpickers.push(new Nitpicker());
      this.nitpickers.length = snapshot.nitpickers.length;
      for (let i = 0; i < snapshot.nitpickers.length; i++) this.nitpickers[i].applySnapshot(snapshot.nitpickers[i]);
    }
    if (typeof snapshot.bird_spawn_timer === 'number') this.bird_spawn_timer = snapshot.bird_spawn_timer;
    if (snapshot.stage_mode) this.stage_mode = snapshot.stage_mode;
    if (typeof snapshot.bonus_timer === 'number') this.bonus_timer = snapshot.bonus_timer;
    if (Array.isArray(snapshot.vegetables)) this.vegetables = snapshot.vegetables.map((v) => ({ ...v }));
  }

  /**
   * 只繪製攝影機附近的可見冰磚列。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} camera_y - 本次繪製使用的攝影機 Y 座標。
   * @returns {void}
   * @depends IceGrid, IceClimberArt
   */
  _drawGrid(canvas_context, camera_y = this.camera.y) {
    const first_row = Math.floor(-(camera_y + VIEW_H) / CELL_H) - 1;
    const last_row = Math.ceil(-camera_y / CELL_H) + 1;
    for (let row_index = first_row; row_index <= last_row; row_index++) {
      const cells_row = this.grid.rows[row_index];
      if (!cells_row) continue;
      const screen_y = -row_index * CELL_H - camera_y;
      for (let col_index = 0; col_index < GRID_W; col_index++) {
        const cell = cells_row[col_index];
        if (cell.type === TYPE.EMPTY) continue;
        const screen_x = col_index * CELL_W + PLAYFIELD_OFFSET_X;
        this.art.draw_cell(canvas_context, cell, screen_x, screen_y, {
          is_goal: row_index === GOAL_ROW,
          row_index,
        });
      }
    }
  }

  /**
   * 繪製玩家與槌子。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {Player|object} player - 要繪製的玩家狀態，可為 Player 或插值後的 snapshot。
   * @param {number} camera_y - 本次繪製使用的攝影機 Y 座標。
   * @param {number} elapsed - 本次繪製使用的動畫時間。
   * @returns {void}
   * @depends IceClimberArt.draw_player
   */
  _drawPlayer(canvas_context, player = this.player, camera_y = this.camera.y, elapsed = this.elapsed) {
    const player_x = player.x + PLAYFIELD_OFFSET_X;
    const player_y = player.y - camera_y;
    this.art.draw_player(canvas_context, player, player_x, player_y, elapsed);
  }

  /**
   * guest 端每 tick 只送輸入並等待 host snapshot。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {InputState} input - guest 本機輸入。
   * @returns {void}
   * @depends GuestNetAdapter.updateLocalInput
   */
  _updateGuest(dt, input) {
    if (this.net && typeof this.net.updateLocalInput === 'function') {
      this.net.updateLocalInput(input);
    }
    if (input.wasPressed(Btn.START)) this.ctx.exitToMenu();
    this.endTimer += this.gameState === 'playing' ? 0 : dt;
  }

  /**
   * 收到 host snapshot 時保存 render buffer，並同步最新 authoritative 狀態。
   *
   * @param {object} snapshot - host 傳來的完整遊戲 snapshot。
   * @returns {void}
   * @depends applySnapshot, performance.now
   */
  _receiveGuestSnapshot(snapshot) {
    if (!snapshot) return;
    this.snapshot_buffer.push({
      received_at: this._nowSeconds(),
      snapshot,
    });
    if (this.snapshot_buffer.length > SNAPSHOT_BUFFER_LIMIT) {
      this.snapshot_buffer.splice(0, this.snapshot_buffer.length - SNAPSHOT_BUFFER_LIMIT);
    }
    this.applySnapshot(snapshot);
    this._emitStateSfx(this._activePlayers());
  }

  /**
   * 建立 guest render 用的插值狀態；遊戲邏輯仍以最新 snapshot 為準。
   *
   * @returns {{camera_y: number, elapsed: number, players: object[]}|null} 可直接繪製的狀態，資料不足時回傳 null。
   * @depends _interpolateSnapshotPair
   */
  _guestRenderState() {
    if (this.net_role !== 'guest' || this.snapshot_buffer.length < 2) return null;

    const target_time = this._nowSeconds() - SNAPSHOT_INTERPOLATION_DELAY;
    let from_entry = this.snapshot_buffer[0];
    let to_entry = this.snapshot_buffer[this.snapshot_buffer.length - 1];

    for (let buffer_index = 1; buffer_index < this.snapshot_buffer.length; buffer_index++) {
      const current_entry = this.snapshot_buffer[buffer_index];
      if (current_entry.received_at >= target_time) {
        from_entry = this.snapshot_buffer[buffer_index - 1];
        to_entry = current_entry;
        break;
      }
    }

    if (target_time <= this.snapshot_buffer[0].received_at) {
      return this._snapshotRenderState(this.snapshot_buffer[0].snapshot);
    }
    if (target_time >= to_entry.received_at) {
      return this._snapshotRenderState(to_entry.snapshot);
    }

    const duration = Math.max(0.001, to_entry.received_at - from_entry.received_at);
    const alpha = Math.max(0, Math.min(1, (target_time - from_entry.received_at) / duration));
    return this._interpolateSnapshotPair(from_entry.snapshot, to_entry.snapshot, alpha);
  }

  /**
   * 將 snapshot 轉成 render 狀態，不改動場景目前 authoritative 物件。
   *
   * @param {object} snapshot - host snapshot。
   * @returns {{camera_y: number, elapsed: number, players: object[]}} 可繪製的狀態。
   * @depends none
   */
  _snapshotRenderState(snapshot) {
    return {
      camera_y: snapshot.camera_y,
      elapsed: snapshot.elapsed,
      players: (snapshot.players || []).map((player_snapshot) => ({ ...player_snapshot })),
    };
  }

  /**
   * 在兩個 host snapshot 之間插值座標與攝影機，降低 guest 端畫面跳動。
   *
   * @param {object} from_snapshot - 較舊的 host snapshot。
   * @param {object} to_snapshot - 較新的 host snapshot。
   * @param {number} alpha - 0 到 1 的插值比例。
   * @returns {{camera_y: number, elapsed: number, players: object[]}} 可繪製的插值狀態。
   * @depends _lerp, _interpolatePlayerSnapshot
   */
  _interpolateSnapshotPair(from_snapshot, to_snapshot, alpha) {
    const from_players = from_snapshot.players || [];
    const to_players = to_snapshot.players || [];
    return {
      camera_y: this._lerp(from_snapshot.camera_y, to_snapshot.camera_y, alpha),
      elapsed: this._lerp(from_snapshot.elapsed, to_snapshot.elapsed, alpha),
      players: to_players.map((to_player, player_index) => (
        this._interpolatePlayerSnapshot(from_players[player_index], to_player, alpha)
      )),
    };
  }

  /**
   * 在兩個玩家 snapshot 之間插值數值欄位，非數值狀態採用較新的 snapshot。
   *
   * @param {object|undefined} from_player - 較舊的玩家 snapshot。
   * @param {object} to_player - 較新的玩家 snapshot。
   * @param {number} alpha - 0 到 1 的插值比例。
   * @returns {object} 可繪製的玩家狀態。
   * @depends _lerp
   */
  _interpolatePlayerSnapshot(from_player, to_player, alpha) {
    if (!from_player) return { ...to_player };
    return {
      ...to_player,
      x: this._lerp(from_player.x, to_player.x, alpha),
      y: this._lerp(from_player.y, to_player.y, alpha),
      vx: this._lerp(from_player.vx, to_player.vx, alpha),
      vy: this._lerp(from_player.vy, to_player.vy, alpha),
      hammerTimer: this._lerp(from_player.hammerTimer, to_player.hammerTimer, alpha),
    };
  }

  /**
   * 取得單調遞增秒數，用於 snapshot render buffer 計時。
   *
   * @returns {number} 目前秒數。
   * @depends performance.now
   */
  _nowSeconds() {
    if (globalThis.performance && typeof globalThis.performance.now === 'function') {
      return globalThis.performance.now() / 1000;
    }
    return Date.now() / 1000;
  }

  /**
   * 線性插值兩個數值。
   *
   * @param {number} from_value - 起始值。
   * @param {number} to_value - 目標值。
   * @param {number} alpha - 0 到 1 的插值比例。
   * @returns {number} 插值後的數值。
   * @depends none
   */
  _lerp(from_value, to_value, alpha) {
    return from_value + (to_value - from_value) * alpha;
  }

  /**
   * 取得目前需要模擬/繪製的玩家清單。
   *
   * @returns {Player[]} 玩家陣列。
   * @depends Player
   */
  _activePlayers() {
    return this.player2 ? [this.player, this.player2] : [this.player];
  }

  /**
   * 取得 host 端遠端玩家輸入；單人時回用本機 input 以避免空值分支。
   *
   * @returns {InputState} remote input 或本機 input。
   * @depends HostNetAdapter.getRemoteInput
   */
  _getRemoteInput() {
    if (this.net_role === 'host' && this.net && typeof this.net.getRemoteInput === 'function') {
      return this.net.getRemoteInput();
    }
    return this.ctx.input;
  }

  /**
   * 更新斷線 overlay 的操作。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {InputState} input - 目前 tick 的輸入狀態。
   * @returns {void}
   * @depends Btn, ctx.openLobby, ctx.exitToMenu
   */
  _updateDisconnect(dt, input) {
    this.net_disconnect_timer += dt;
    if (input.wasPressed(Btn.START)) {
      this.ctx.exitToMenu();
      return;
    }
    if (!input.wasPressed(Btn.A)) return;
    if (this.net_role === 'host') {
      this._continueAsSinglePlayer();
      return;
    }
    this._rejoinLastRoom();
  }

  /**
   * 連線恢復後解除斷線 overlay，保留原局狀態繼續遊玩。
   *
   * @returns {void}
   * @depends none
   */
  _resumeNetworkPlay() {
    this.net_disconnected = false;
    this.net_disconnect_timer = 0;
    if (this.net_role === 'guest') this.snapshot_buffer = [];
  }

  /**
   * host 斷線後釋放 net adapter，轉回單人續玩。
   *
   * @returns {void}
   * @depends NetAdapter.destroy
   */
  _continueAsSinglePlayer() {
    if (this.net && typeof this.net.destroy === 'function') this.net.destroy();
    this.net = null;
    this.ctx.net = null;
    this.net_role = 'single';
    this.net_disconnected = false;
    this.player2 = null;
  }

  /**
   * guest 斷線後回到 JOIN 大廳並預填原房號。
   *
   * @returns {void}
   * @depends ctx.openLobby
   */
  _rejoinLastRoom() {
    const room_code = this.net && this.net.room_code ? this.net.room_code : '';
    if (this.net && typeof this.net.destroy === 'function') this.net.destroy();
    this.ctx.openLobby('iceclimber', 'join', room_code);
  }

  /**
   * 繪製斷線提示 overlay。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @returns {void}
   * @depends drawText
   */
  _drawDisconnectOverlay(canvas_context) {
    canvas_context.fillStyle = 'rgba(0, 0, 0, 0.72)';
    canvas_context.fillRect(0, 0, 256, 240);
    drawText(canvas_context, 'LINK LOST', 128, 86,
      { scale: 2, color: '#ff6666', align: 'center' });
    if (this.net_role === 'host') {
      drawText(canvas_context, 'WAIT REJOIN', 128, 118,
        { scale: 1, color: '#ffffff', align: 'center' });
      drawText(canvas_context, 'A SINGLE', 128, 138,
        { scale: 1, color: '#a8b0c0', align: 'center' });
    } else {
      drawText(canvas_context, 'A REJOIN', 128, 122,
        { scale: 1, color: '#ffffff', align: 'center' });
    }
    drawText(canvas_context, 'START MENU', 128, 158,
      { scale: 1, color: '#a8b0c0', align: 'center' });
  }

  /**
   * 推進破冰粒子的生命週期。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends PARTICLE_LIFE
   */
  _updateBreakEffects(dt) {
    for (const effect of this.break_effects) {
      effect.age += dt;
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 240 * dt;
    }
    this.break_effects = this.break_effects.filter((effect) => effect.age < effect.life);
  }

  /**
   * 依破掉的冰磚建立短暫碎冰粒子。
   *
   * @param {{col: number, row: number, by: string}[]} broke_cells - 本 tick 破掉的 cell 清單。
   * @returns {void}
   * @depends CELL_W, CELL_H
   */
  _spawnBreakEffects(broke_cells) {
    for (const broke_cell of broke_cells) {
      const origin_x = broke_cell.col * CELL_W + CELL_W / 2;
      const origin_y = -broke_cell.row * CELL_H + CELL_H / 2;
      for (let particle_index = 0; particle_index < 5; particle_index++) {
        const spread_x = (particle_index - 2) * 34;
        const spread_y = -90 - particle_index * 8;
        this.break_effects.push({
          x: origin_x,
          y: origin_y,
          vx: spread_x,
          vy: spread_y,
          age: 0,
          life: PARTICLE_LIFE,
        });
      }
    }
  }

  /**
   * 推進所有 Topi 的物理；死掉的 Topi 留在陣列以維持 snapshot index 對齊，下回合 reset 才清空。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Topi.update
   */
  _updateTopis(dt) {
    for (const topi of this.topis) topi.update(dt, this.grid);
  }

  /**
   * Topi 撞玩家：以 Topi.facing 方向把玩家橫向推飛、加一點 lift，玩家可能因此被推下平台。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {void}
   * @depends Topi.alive
   */
  _resolveTopiPlayerCollisions(players) {
    for (const player of players) {
      for (const topi of this.topis) {
        if (!topi.alive) continue;
        if (player.rightX <= topi.leftX || player.leftX >= topi.rightX) continue;
        if (player.feetY <= topi.y || player.y >= topi.feetY) continue;
        const push_dir = topi.facing;
        player.vx = push_dir * 100;
        if (player.onGround) player.vy = -130;
      }
    }
  }

  /**
   * 槌擊剛落下的那一 tick，檢查 Topi 是否在 hammerTarget cell 範圍內，是則 kill。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {void}
   * @depends Player.hammerJustLanded, Topi.kill
   */
  _resolveTopiHammerKills(players) {
    for (const player of players) {
      if (!player.hammerJustLanded) continue;
      const col = player.hammerTargetCol;
      const row = player.hammerTargetRow;
      if (col == null || row == null) continue;
      const cell_left = col * CELL_W;
      const cell_right = cell_left + CELL_W;
      const cell_top = -row * CELL_H;
      const cell_bottom = cell_top + CELL_H;
      for (const topi of this.topis) {
        if (!topi.alive) continue;
        if (topi.rightX <= cell_left || topi.leftX >= cell_right) continue;
        if (topi.feetY <= cell_top || topi.y >= cell_bottom) continue;
        topi.kill();
        this.score += 200;
        this._playSfx('break', { volume: 0.7 });
      }
    }
  }

  /**
   * 進入獎勵關卡：清掉敵人與冰柱，重建 SOLID 平台、撒蔬菜、重設玩家位置與固定攝影機。
   *
   * @returns {void}
   * @depends IceGrid, Player
   */
  _enterBonusStage() {
    this.stage_mode = 'bonus';
    this.gameState = 'playing';
    this.endTimer = 0;
    this.bonus_timer = 20;
    this.topis = [];
    this.icicles = [];
    this.nitpickers = [];
    this.break_effects = [];

    const ROW_GROUND = 0;
    const ROW_P1 = 3;
    const ROW_P2 = 6;
    const ROW_P3 = 9;
    const ROW_TOP = 13;
    const BONUS_ROWS = 16;

    this.grid = new IceGrid();
    for (let row = 0; row < BONUS_ROWS; row++) {
      this.grid.setRow(row, new Array(GRID_W).fill(TYPE.EMPTY));
    }
    this.grid.setRow(ROW_GROUND, new Array(GRID_W).fill(TYPE.SOLID));

    const p1 = new Array(GRID_W).fill(TYPE.EMPTY);
    for (let c = 0; c <= 3; c++) p1[c] = TYPE.SOLID;
    this.grid.setRow(ROW_P1, p1);

    const p2 = new Array(GRID_W).fill(TYPE.EMPTY);
    for (let c = 4; c <= 7; c++) p2[c] = TYPE.SOLID;
    this.grid.setRow(ROW_P2, p2);

    const p3 = new Array(GRID_W).fill(TYPE.EMPTY);
    for (let c = 0; c <= 3; c++) p3[c] = TYPE.SOLID;
    this.grid.setRow(ROW_P3, p3);

    const top = new Array(GRID_W).fill(TYPE.EMPTY);
    for (let c = 4; c <= 7; c++) top[c] = TYPE.SOLID;
    this.grid.setRow(ROW_TOP, top);

    this.vegetables = [
      { col: 4, row: ROW_GROUND, type: 'eggplant', taken: false },
      { col: 6, row: ROW_GROUND, type: 'carrot', taken: false },
      { col: 1, row: ROW_P1, type: 'cabbage', taken: false },
      { col: 3, row: ROW_P1, type: 'fish', taken: false },
      { col: 5, row: ROW_P2, type: 'corn', taken: false },
      { col: 7, row: ROW_P2, type: 'eggplant', taken: false },
      { col: 1, row: ROW_P3, type: 'cabbage', taken: false },
      { col: 3, row: ROW_P3, type: 'fish', taken: false },
      { col: 5, row: ROW_TOP, type: 'corn', taken: false },
      { col: 7, row: ROW_TOP, type: 'carrot', taken: false },
    ];

    const spawn_col = 4;
    const spawn_x = spawn_col * CELL_W + (CELL_W - PLAYER_W) / 2;
    this.player.x = spawn_x;
    this.player.y = -PLAYER_H - 2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.state = 'idle';
    this.player.facing = 1;
    if (this.player2) {
      this.player2.x = 5 * CELL_W + (CELL_W - PLAYER_W) / 2;
      this.player2.y = -PLAYER_H - 2;
      this.player2.vx = 0;
      this.player2.vy = 0;
      this.player2.state = 'idle';
    }

    // 固定攝影機，把整個獎勵舞台塞進畫面（hud 佔頂端 24 px）。
    this.camera.y = -(ROW_TOP + 3) * CELL_H;
  }

  /**
   * 獎勵關卡 update：玩家正常移動跳躍、無 hammer 破壞（platform 全 SOLID）、收集蔬菜、倒數時間。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {InputState} input - 本機輸入。
   * @returns {void}
   * @depends Player.update, AudioSystem.play
   */
  _updateBonus(dt, input) {
    const players = this._activePlayers();
    const player_inputs = [input, this._getRemoteInput()];
    players.forEach((player, idx) => player.update(dt, player_inputs[idx], this.grid));

    const VEG_W = 8;
    const VEG_H = 8;
    for (const veg of this.vegetables) {
      if (veg.taken) continue;
      const veg_x = veg.col * CELL_W + (CELL_W - VEG_W) / 2;
      const veg_y = -(veg.row + 1) * CELL_H;
      for (const player of players) {
        if (player.rightX <= veg_x || player.leftX >= veg_x + VEG_W) continue;
        if (player.feetY <= veg_y || player.y >= veg_y + VEG_H) continue;
        veg.taken = true;
        this.score += 300;
        this._playSfx('win', { volume: 0.35 });
        break;
      }
    }

    this.bonus_timer -= dt;
    const all_collected = this.vegetables.every((v) => v.taken);
    if (this.bonus_timer <= 0 || all_collected) {
      if (all_collected) this.score += 500; // 全收完額外獎勵
      this.gameState = 'bonus_done';
      this.endTimer = 0;
      this._playSfx('win', { volume: 0.7 });
    }

    if (input.wasPressed(Btn.START)) this.ctx.exitToMenu();
  }

  /**
   * 推進 Nitpicker：飛行、墜落、移除離場個體；玩家通過 floor 2 後啟用 spawn 計時器。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Nitpicker.update, spawnNitpickerAtCamera
   */
  _updateNitpickers(dt) {
    for (const bird of this.nitpickers) bird.update(dt);
    this.nitpickers = this.nitpickers.filter((bird) => !bird.shouldDespawn());

    if (this.maxFloor < 2) return;
    this.bird_spawn_timer -= dt;
    if (this.bird_spawn_timer > 0) return;
    if (this.nitpickers.length >= 2) {
      this.bird_spawn_timer = 1;
      return;
    }
    this.nitpickers.push(spawnNitpickerAtCamera(this.rng, this.camera.y));
    this.bird_spawn_timer = 5 + this.rng.next() * 4;
  }

  /**
   * Nitpicker 撞玩家：把玩家向 bird.facing 方向推、稍微抬起，不致死。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {void}
   */
  _resolveNitpickerPlayerCollisions(players) {
    for (const player of players) {
      for (const bird of this.nitpickers) {
        if (!bird.alive) continue;
        if (player.rightX <= bird.leftX || player.leftX >= bird.rightX) continue;
        if (player.feetY <= bird.y || player.y >= bird.feetY) continue;
        player.vx = bird.facing * 80;
        if (player.onGround) player.vy = -90;
      }
    }
  }

  /**
   * 槌擊剛落下時，若 Nitpicker AABB 與 hammer target cell 重疊則 kill。+500 分。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {void}
   */
  _resolveNitpickerHammerKills(players) {
    for (const player of players) {
      if (!player.hammerJustLanded) continue;
      const col = player.hammerTargetCol;
      const row = player.hammerTargetRow;
      if (col == null || row == null) continue;
      const cell_left = col * CELL_W;
      const cell_right = cell_left + CELL_W;
      const cell_top = -row * CELL_H;
      const cell_bottom = cell_top + CELL_H;
      for (const bird of this.nitpickers) {
        if (!bird.alive) continue;
        if (bird.rightX <= cell_left || bird.leftX >= cell_right) continue;
        if (bird.feetY <= cell_top || bird.y >= cell_bottom) continue;
        bird.kill();
        this.score += 500;
        this._playSfx('break', { volume: 0.65 });
      }
    }
  }

  /**
   * 推進所有冰柱狀態機；hanging 在玩家走到下方時觸發 shaking。
   *
   * @param {number} dt - 固定步長秒數。
   * @param {Player[]} players - 觸發抖動的玩家清單。
   * @returns {void}
   * @depends Icicle.update
   */
  _updateIcicles(dt, players) {
    for (const icicle of this.icicles) icicle.update(dt, this.grid, players);
  }

  /**
   * 槌擊剛落下且 hammer target cell 內有 hanging/shaking 冰柱 → 提早粉碎。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {void}
   * @depends Icicle.shatter
   */
  _resolveIcicleHammerHits(players) {
    for (const player of players) {
      if (!player.hammerJustLanded) continue;
      const col = player.hammerTargetCol;
      const row = player.hammerTargetRow;
      if (col == null || row == null) continue;
      for (const icicle of this.icicles) {
        if (icicle.state !== ICICLE_STATE.HANGING && icicle.state !== ICICLE_STATE.SHAKING) continue;
        if (icicle.col !== col) continue;
        // 掛在 row=parent 的冰柱實際視覺位置在 row=parent-1，因此 hammer target row 必須 == parent-1
        if (icicle.row - 1 !== row) continue;
        icicle.shatter();
        this.score += 50;
        this._playSfx('break', { volume: 0.55 });
      }
    }
  }

  /**
   * 落下中的冰柱撞到任一玩家 → 回傳該玩家，否則 null。讓上層決定結束遊戲。
   *
   * @param {Player[]} players - 本 tick 的玩家陣列。
   * @returns {Player|null}
   */
  _checkIcicleKillsPlayer(players) {
    for (const icicle of this.icicles) {
      if (icicle.state !== ICICLE_STATE.FALLING) continue;
      for (const player of players) {
        if (player.rightX <= icicle.leftX || player.leftX >= icicle.rightX) continue;
        if (player.feetY <= icicle.topY || player.y >= icicle.bottomY) continue;
        return player;
      }
    }
    return null;
  }

  /**
   * 對 player.state / gameState 做邊緣偵測並播放對應音效。
   *
   * jump：state 從非 'jump' 進入 'jump' 且 vy < 0。
   * hammer：state 從非 'hammer' 進入 'hammer'。
   * win/lose：gameState 從 'playing' 進入該狀態。
   * 不需要 AudioContext 已 init —— `audio.play` 會在未 init 時自行 no-op。
   *
   * @param {Player[]|object[]} players_to_check - 本 tick 想檢查的玩家陣列（含 snapshot 後的 plain object）。
   * @returns {void}
   * @depends AudioSystem.play
   */
  _emitStateSfx(players_to_check) {
    if (this._sfx_prev.gameState === 'playing' && this.gameState === 'won') {
      this._playSfx('win', { volume: 0.8 });
    }
    if (this._sfx_prev.gameState === 'playing' && this.gameState === 'lost') {
      this._playSfx('lose', { volume: 0.7 });
    }
    this._sfx_prev.gameState = this.gameState;

    players_to_check.forEach((player, player_index) => {
      const prev = this._sfx_prev.players[player_index] || { state: 'idle' };
      if (prev.state !== 'jump' && player.state === 'jump' && player.vy < 0) {
        this._playSfx('jump', { volume: 0.4 });
      }
      if (prev.state !== 'hammer' && player.state === 'hammer') {
        this._playSfx('hammer', { volume: 0.55 });
      }
      this._sfx_prev.players[player_index] = { state: player.state };
    });
  }

  /**
   * 播放音效；ctx.audio 若不存在則略過。
   *
   * @param {string} name - 已 load 的音效 key。
   * @param {{volume?: number, loop?: boolean}} opts
   * @returns {void}
   * @depends AudioSystem.play
   */
  _playSfx(name, opts = {}) {
    if (this.ctx && this.ctx.audio) this.ctx.audio.play(name, opts);
  }

  /**
   * 釋放場景資源；目前場景沒有額外事件監聽需要移除。
   *
   * @returns {void}
   * @depends none
   */
  destroy() {}
}
