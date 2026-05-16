import { GameLoop } from './engine/GameLoop.js';
import { Canvas } from './engine/Canvas.js';
import { InputManager } from './engine/Input.js';
import { drawText } from './engine/PixelFont.js';
import { registerGame, getGame } from './menu/GameRegistry.js';
import { MainMenu } from './menu/MainMenu.js';
import DummyGame from './games/dummy/index.js';

const canvasEl = document.getElementById('game');
const canvas = new Canvas(canvasEl, { logicalW: 256, logicalH: 240 });
const inputMgr = new InputManager();
inputMgr.attach(window);

registerGame(DummyGame);

const sceneCtx = {
  canvas,
  input: inputMgr.state,
  input2: null,
  net: null,
  launchGame,
  exitToMenu,
};

let currentScene = null;
let pendingScene = null;
let loadingScene = false;
let loadError = null;

async function setScene(scene) {
  if (currentScene && typeof currentScene.destroy === 'function') {
    currentScene.destroy();
  }
  currentScene = null;
  loadingScene = true;
  loadError = null;
  try {
    if (scene && typeof scene.init === 'function') {
      await scene.init(sceneCtx);
    }
    currentScene = scene;
  } catch (err) {
    console.error('Scene init 失敗', err);
    loadError = err && err.message ? err.message : String(err);
  } finally {
    loadingScene = false;
  }
}

async function launchGame(id) {
  const mod = getGame(id);
  if (!mod) {
    console.error(`找不到遊戲: ${id}`);
    return;
  }
  pendingScene = mod.factory();
}

function exitToMenu() {
  pendingScene = new MainMenu();
}

const loop = new GameLoop({
  tickHz: 60,
  update: (dt) => {
    if (pendingScene) {
      const s = pendingScene;
      pendingScene = null;
      setScene(s);
      inputMgr.beginTick();
      return;
    }
    if (loadingScene) {
      inputMgr.beginTick();
      return;
    }
    if (currentScene && typeof currentScene.update === 'function') {
      currentScene.update(dt);
    }
    inputMgr.beginTick();
  },
  render: (alpha) => {
    canvas.clear('#000');
    if (loadingScene) {
      drawText(canvas.ctx, 'LOADING...', canvas.lw / 2, canvas.lh / 2 - 4,
        { scale: 1, color: '#e8e8e8', align: 'center' });
      return;
    }
    if (loadError) {
      drawText(canvas.ctx, 'LOAD ERROR', canvas.lw / 2, canvas.lh / 2 - 12,
        { scale: 1, color: '#ff6666', align: 'center' });
      drawText(canvas.ctx, 'PRESS START', canvas.lw / 2, canvas.lh / 2 + 4,
        { scale: 1, color: '#a8b0c0', align: 'center' });
      return;
    }
    if (currentScene && typeof currentScene.render === 'function') {
      currentScene.render(canvas.ctx, alpha);
    }
  },
});

window.addEventListener('keydown', (e) => {
  if (loadError && (e.code === 'Enter' || e.code === 'KeyZ')) {
    loadError = null;
    exitToMenu();
  }
});

setScene(new MainMenu()).then(() => loop.start());
