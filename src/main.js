import { GameLoop } from './engine/GameLoop.js';
import { Canvas } from './engine/Canvas.js';
import { InputManager } from './engine/Input.js';
import { drawText } from './engine/PixelFont.js';
import { TouchOverlay } from './engine/TouchOverlay.js';
import { AudioSystem } from './engine/Audio.js';
import { registerGame, getGame } from './menu/GameRegistry.js';
import { MainMenu } from './menu/MainMenu.js';
import { LobbyScene } from './menu/LobbyScene.js';
import IceClimberGame from './games/iceclimber/index.js';

const canvas_el = document.getElementById('game');
const touch_overlay_el = document.getElementById('touch-overlay');
const canvas = new Canvas(canvas_el, { logicalW: 256, logicalH: 240 });
const input_mgr = new InputManager();
input_mgr.attach(window);
const touch_overlay = new TouchOverlay({ root: touch_overlay_el, input_state: input_mgr.state });
touch_overlay.attach();
const audio = new AudioSystem();

registerGame(IceClimberGame);

const scene_ctx = {
  canvas,
  input: input_mgr.state,
  input2: null,
  net: null,
  audio,
  launchOptions: {},
  launchGame,
  openLobby,
  exitToMenu,
};

/**
 * 在第一次 user gesture 內初始化 AudioContext（iOS Safari / Chrome autoplay policy）。
 * 註冊 keydown 與 pointerdown 兩條路徑各一次，無論誰先觸發都會喚醒 audio。
 *
 * @returns {void}
 * @depends AudioSystem.init
 */
function init_audio_on_first_gesture() {
  const fire = () => { audio.init(); };
  window.addEventListener('keydown', fire, { once: true });
  window.addEventListener('pointerdown', fire, { once: true });
}
init_audio_on_first_gesture();

let current_scene = null;
let pending_scene = null;
let loading_scene = false;
let load_error = null;

/**
 * 切換目前場景，並等待 async init 完成後才恢復 update。
 *
 * @param {Scene|null} scene - 下一個要啟用的 Scene。
 * @returns {Promise<void>} 場景初始化完成後 resolve。
 * @depends Scene.init, Scene.destroy
 */
async function set_scene(scene) {
  if (current_scene && typeof current_scene.destroy === 'function') {
    current_scene.destroy();
  }
  current_scene = null;
  loading_scene = true;
  load_error = null;
  try {
    if (scene && typeof scene.init === 'function') {
      await scene.init(scene_ctx);
    }
    current_scene = scene;
  } catch (err) {
    console.error('Scene init 失敗', err);
    load_error = err && err.message ? err.message : String(err);
  } finally {
    loading_scene = false;
  }
}

/**
 * 從遊戲註冊表建立指定遊戲的 Scene，交給下一個 tick 切換。
 *
 * @param {string} id - 遊戲模組 id。
 * @param {{net?: object}} options - 遊戲啟動選項，例如 M4 net adapter。
 * @returns {Promise<void>} 排定切換後 resolve。
 * @depends getGame, GameModule.factory
 */
async function launchGame(id, options = {}) {
  const mod = getGame(id);
  if (!mod) {
    console.error(`找不到遊戲: ${id}`);
    return;
  }
  scene_ctx.net = options.net || null;
  scene_ctx.input2 = options.input2 || null;
  scene_ctx.launchOptions = options;
  pending_scene = mod.factory(options);
}

/**
 * 開啟指定遊戲的 2P 配對大廳。
 *
 * @param {string} game_id - 要配對的遊戲 id。
 * @param {'host'|'join'} mode - 建立房間或加入房間。
 * @param {string} join_code - 可選的預填房間代碼。
 * @returns {void}
 * @depends LobbyScene
 */
function openLobby(game_id, mode, join_code = '') {
  scene_ctx.net = null;
  scene_ctx.input2 = null;
  scene_ctx.launchOptions = {};
  pending_scene = new LobbyScene({ game_id, mode, join_code });
}

/**
 * 排定回到主選單場景。
 *
 * @returns {void}
 * @depends MainMenu
 */
function exitToMenu() {
  if (scene_ctx.net && typeof scene_ctx.net.destroy === 'function') {
    scene_ctx.net.destroy();
  }
  scene_ctx.net = null;
  scene_ctx.input2 = null;
  scene_ctx.launchOptions = {};
  pending_scene = new MainMenu();
}

/**
 * 固定步長 update；場景切換與載入期間會跳過目前場景 update。
 *
 * @param {number} dt - 固定步長秒數。
 * @returns {void}
 * @depends GameLoop, InputManager.beginTick, Scene.update
 */
function update_loop(dt) {
  if (pending_scene) {
    const next_scene = pending_scene;
    pending_scene = null;
    set_scene(next_scene);
    input_mgr.beginTick();
    return;
  }
  if (loading_scene) {
    input_mgr.beginTick();
    return;
  }
  if (current_scene && typeof current_scene.update === 'function') {
    current_scene.update(dt);
  }
  input_mgr.beginTick();
}

/**
 * 繪製目前 frame；載入與錯誤狀態由 main.js 統一顯示。
 *
 * @param {number} alpha - 固定步長內插係數。
 * @returns {void}
 * @depends Canvas.clear, drawText, Scene.render
 */
function render_loop(alpha) {
  canvas.clear('#000');
  if (loading_scene) {
    drawText(canvas.ctx, 'LOADING...', canvas.lw / 2, canvas.lh / 2 - 4,
      { scale: 1, color: '#e8e8e8', align: 'center' });
    return;
  }
  if (load_error) {
    drawText(canvas.ctx, 'LOAD ERROR', canvas.lw / 2, canvas.lh / 2 - 12,
      { scale: 1, color: '#ff6666', align: 'center' });
    drawText(canvas.ctx, 'PRESS START', canvas.lw / 2, canvas.lh / 2 + 4,
      { scale: 1, color: '#a8b0c0', align: 'center' });
    return;
  }
  if (current_scene && typeof current_scene.render === 'function') {
    current_scene.render(canvas.ctx, alpha);
  }
}

const loop = new GameLoop({
  tickHz: 60,
  update: update_loop,
  render: render_loop,
});

/**
 * 載入失敗畫面下允許使用者按 START/A 回主選單。
 *
 * @param {KeyboardEvent} event - keydown 事件。
 * @returns {void}
 * @depends exitToMenu
 */
function handle_load_error_keydown(event) {
  if (load_error && (event.code === 'Enter' || event.code === 'KeyZ')) {
    load_error = null;
    exitToMenu();
  }
}

window.addEventListener('keydown', handle_load_error_keydown);

set_scene(new MainMenu()).then(() => loop.start());
