import { Scene } from '../engine/Scene.js';
import { Btn } from '../engine/Input.js';
import { drawText } from '../engine/PixelFont.js';
import { listGames } from './GameRegistry.js';

const ACTIONS = Object.freeze([
  { id: 'single', label: 'SINGLE' },
  { id: 'host', label: 'HOST' },
  { id: 'join', label: 'JOIN' },
]);

export class MainMenu extends Scene {
  /**
   * 初始化主選單狀態。
   *
   * @param {object} ctx - Scene context。
   * @returns {Promise<void>} 初始化完成後 resolve。
   * @depends listGames
   */
  async init(ctx) {
    this.ctx = ctx;
    this.games = listGames();
    this.cursor = 0;
    this.action_cursor = 0;
    this.blink = 0;
  }

  /**
   * 更新選單游標與啟動目前 action。
   *
   * @param {number} dt - 固定步長秒數。
   * @returns {void}
   * @depends Btn
   */
  update(dt) {
    const input = this.ctx.input;
    this.blink = (this.blink + dt) % 1.0;

    if (input.wasPressed(Btn.UP))   this.cursor = (this.cursor - 1 + this.games.length) % this.games.length;
    if (input.wasPressed(Btn.DOWN)) this.cursor = (this.cursor + 1) % this.games.length;
    this._clampActionCursor();

    const selected_game = this.games[this.cursor];
    if (selected_game && selected_game.supports.twoPlayer) {
      if (input.wasPressed(Btn.LEFT)) {
        this.action_cursor = (this.action_cursor - 1 + ACTIONS.length) % ACTIONS.length;
      }
      if (input.wasPressed(Btn.RIGHT)) {
        this.action_cursor = (this.action_cursor + 1) % ACTIONS.length;
      }
    }

    if (input.wasPressed(Btn.A) || input.wasPressed(Btn.START)) {
      this._launchSelected();
    }
  }

  /**
   * 繪製主選單與 2P action selector。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @returns {void}
   * @depends drawText
   */
  render(canvas_context) {
    const { lw: logical_w, lh: logical_h } = this.ctx.canvas;

    const gradient = canvas_context.createLinearGradient(0, 0, 0, logical_h);
    gradient.addColorStop(0, '#1a2747');
    gradient.addColorStop(1, '#0b0f1a');
    canvas_context.fillStyle = gradient;
    canvas_context.fillRect(0, 0, logical_w, logical_h);

    canvas_context.fillStyle = '#ffffff';
    for (let star_index = 0; star_index < 30; star_index++) {
      const star_x = (star_index * 73) % logical_w;
      const star_y = (star_index * 41) % (logical_h / 2);
      canvas_context.fillRect(star_x, star_y, 1, 1);
    }

    drawText(canvas_context, 'GAMU', logical_w / 2, 36, { scale: 3, color: '#ffcc33', align: 'center' });
    drawText(canvas_context, 'GAME HUB', logical_w / 2, 64, { scale: 1, color: '#e8e8e8', align: 'center' });

    const baseY = 110;
    const rowH = 16;
    for (let game_index = 0; game_index < this.games.length; game_index++) {
      const game = this.games[game_index];
      const y = baseY + game_index * rowH;
      const selected = game_index === this.cursor;
      const color = selected ? '#ffcc33' : '#a8b0c0';
      if (selected && this.blink < 0.5) {
        drawText(canvas_context, '>', 60, y, { scale: 1, color, align: 'left' });
      }
      drawText(canvas_context, game.title.toUpperCase(), 76, y, { scale: 1, color, align: 'left' });
    }

    this._drawActionSelector(canvas_context, logical_w, logical_h);
    drawText(canvas_context, 'UD GAME  LR MODE', logical_w / 2, logical_h - 28,
      { scale: 1, color: '#6b7388', align: 'center' });
    drawText(canvas_context, 'A/START GO', logical_w / 2, logical_h - 16,
      { scale: 1, color: '#6b7388', align: 'center' });
  }

  /**
   * 釋放主選單資源；目前沒有外部事件監聽。
   *
   * @returns {void}
   * @depends none
   */
  destroy() {}

  /**
   * 依目前遊戲是否支援 2P，限制 action 游標。
   *
   * @returns {void}
   * @depends ACTIONS
   */
  _clampActionCursor() {
    const game = this.games[this.cursor];
    if (!game || !game.supports.twoPlayer) this.action_cursor = 0;
  }

  /**
   * 啟動目前選取的遊戲 action。
   *
   * @returns {void}
   * @depends ctx.launchGame, ctx.openLobby
   */
  _launchSelected() {
    const game = this.games[this.cursor];
    if (!game) return;
    const action = ACTIONS[this.action_cursor];
    if (action.id === 'single') {
      this.ctx.launchGame(game.id);
      return;
    }
    this.ctx.openLobby(game.id, action.id);
  }

  /**
   * 繪製目前選取遊戲的 single/host/join action。
   *
   * @param {CanvasRenderingContext2D} canvas_context - 2D canvas context。
   * @param {number} logical_w - 邏輯畫面寬度。
   * @param {number} logical_h - 邏輯畫面高度。
   * @returns {void}
   * @depends drawText, ACTIONS
   */
  _drawActionSelector(canvas_context, logical_w, logical_h) {
    const game = this.games[this.cursor];
    const action = ACTIONS[this.action_cursor];
    const mode_text = game && game.supports.twoPlayer ? `< ${action.label} >` : action.label;
    drawText(canvas_context, `MODE ${mode_text}`, logical_w / 2, logical_h - 48,
      { scale: 1, color: '#9cf7ff', align: 'center' });
  }
}
