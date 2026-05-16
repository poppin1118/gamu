import { GameLoop } from './engine/GameLoop.js';
import { Canvas } from './engine/Canvas.js';
import { InputManager, Btn } from './engine/Input.js';
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

async function setScene(scene) {
  if (currentScene && typeof currentScene.destroy === 'function') {
    currentScene.destroy();
  }
  currentScene = scene;
  if (scene && typeof scene.init === 'function') {
    await scene.init(sceneCtx);
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
      return;
    }
    inputMgr.beginTick();
    if (currentScene && typeof currentScene.update === 'function') {
      currentScene.update(dt);
    }
  },
  render: (alpha) => {
    canvas.clear('#000');
    if (currentScene && typeof currentScene.render === 'function') {
      currentScene.render(canvas.ctx, alpha);
    }
  },
});

setScene(new MainMenu()).then(() => loop.start());
