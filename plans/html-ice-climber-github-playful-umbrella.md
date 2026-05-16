# Ice Climber 風格網頁遊戲（可擴充遊戲平台）

> **狀態（最後更新時間：M1 完成 + 重構）**
> - ✅ M1 引擎骨架 + 選單 + Dummy 遊戲（commit `1e083fd`）
> - 🟡 M2 Ice Climber 單人 MVP — **下一步**
> - ⬜ M3 觸控覆蓋層 + 手機 RWD
> - ⬜ M4 雙人連線（PeerJS）
> - ⬜ M5 收尾 + 音效 + 第二款遊戲

---

## 🔄 換電腦繼續工作的步驟

1. 在新電腦 clone 專案：
   ```powershell
   git clone https://github.com/<你的帳號>/gamu.git
   cd gamu
   ```
   （如果還沒推上 GitHub，要用某種方式把資料夾搬過去：USB、雲端硬碟、scp 等。`.git/` 資料夾一定要一起搬，才有歷史紀錄。）

2. 本機跑：
   ```powershell
   python -m http.server 8000
   # 瀏覽器開 http://localhost:8000/
   ```
   應該要看到 Gamu 選單 + Dummy Bouncer 一個項目。

3. 跟 Claude Code 說「**接續 M2，依照 plans/html-ice-climber-github-playful-umbrella.md**」即可。

---

## Context

使用者想做一個部署在 GitHub Pages 上的 HTML5 遊戲平台。第一款遊戲是參考任天堂《Ice Climber》的簡化版雙人合作爬塔遊戲，後續要能擴充更多遊戲。需求重點：

- 桌機 + 手機（橫屏與豎屏都要）皆可遊玩
- 兩人線上合作（兩台裝置各自連網站，用房間代碼配對）
- 也要能單人玩
- 部署在 GitHub Pages（純靜態託管 → 不能跑後端）
- 主選單可選擇遊戲，未來新遊戲只要實作共同介面就能掛進去

---

## 鎖定的決策

| 項目 | 決策 |
|---|---|
| 連線方式 | **PeerJS / WebRTC P2P**（用 PeerJS 公共 signaling，房間代碼配對） |
| 玩家模式 | 線上雙人合作 + 單人 |
| Ice Climber 範圍 | **簡化版 MVP**：主角、槌子、可敲冰塊、爬到第 8 層獲勝。**不做敵人、不做獎勵關**。 |
| 美術 | **CC0 像素素材**（主用 Kenney.nl 的 Pixel Platformer + Background Elements） |
| 技術選型 | **Vanilla JS + 原生 ES Modules**（無 build step、無 TypeScript） |
| 部署 | GitHub Pages，從 `main` 分支 **`/ (root)`**（之前計畫的 `/docs` 已重構掉） |
| 交付節奏 | **每個里程碑驗收一次**（5 個里程碑） |
| Git 倉初始化 | ✅ 已完成，3 個 commit 在 `main` |

---

## 目前的專案結構（M1 完成後）

```
gamu/                              ← repo 根 = GitHub Pages 根
├── index.html                     <canvas id="game"> + 觸控覆蓋層容器
├── 404.html                       複製自 index.html
├── styles.css                     橫豎屏 body class、letterbox
├── src/
│   ├── main.js                    啟動、scene 切換、registerGame、暴露 ctx
│   ├── engine/
│   │   ├── GameLoop.js            固定步長 60Hz update + 變動 render
│   │   ├── Canvas.js              邏輯解析度 256×240，整數縮放
│   │   ├── Input.js               InputManager + Btn 列舉；鍵盤映射
│   │   └── Scene.js               Scene 基底類別
│   ├── menu/
│   │   ├── GameRegistry.js        registerGame / listGames / getGame
│   │   └── MainMenu.js            含內嵌 5×7 像素字型，無素材依賴
│   └── games/dummy/
│       ├── index.js               GameModule 宣告
│       └── DummyScene.js          彈跳球，驗證 Scene 介面
├── plans/
│   └── html-ice-climber-github-playful-umbrella.md   ← 本檔
├── note/
│   └── note.md                    最早的需求備忘
├── CLAUDE.md                      專案約定（給未來 Claude session）
├── README.md                      使用方式（給人類）
└── .gitignore
```

### M1 已實作的引擎細節（接續者必讀）

#### `engine/GameLoop.js`
- `new GameLoop({ tickHz: 60, update, render })`
- `start()` / `stop()`
- 固定步長 `dt = 1/60`，`while (acc >= dt) update(dt)`，最多 8 個 tick safety clamp
- frameDt 上限 100ms 防 tab 切換 spiral-of-death
- render 收到 `alpha` 內插係數

#### `engine/Canvas.js`
- `new Canvas(el, { logicalW, logicalH })`
- 自動 listen `resize` + `orientationchange`
- 整數倍縮放 + 切換 `body.portrait` / `body.landscape` class
- `canvas.clear(color)`、`canvas.ctx` 直接取得 2d context
- backing store == 邏輯解析度，CSS 控制顯示大小

#### `engine/Input.js`
- `Btn` 凍結列舉：LEFT/RIGHT/UP/DOWN/A/B/START/SELECT
- `InputState`：`isDown(btn)`、`wasPressed(btn)`、`wasReleased(btn)`、`beginTick()`
- `InputManager`：`attach(target)`、`detach()`、`beginTick()`、`_onBlur` 在失焦時全部歸零
- 預設鍵盤映射：方向鍵、Z（A=跳）、X（B=槌）、Enter（START）、Shift（SELECT）

#### `engine/Scene.js`
基底類別，所有方法都 noop：
```js
async init(ctx)
update(dt)
render(ctx2d, alpha)
destroy()
pause()
resume()
serializeSnapshot()
applySnapshot(snap)
onRemoteInput(p2Input)
```

#### `src/main.js`
- `sceneCtx = { canvas, input, input2:null, net:null, launchGame, exitToMenu }`
- `currentScene` + `pendingScene` 機制，scene 切換在 update tick 開頭執行
- ⚠️ **重要修正紀錄**：`inputMgr.beginTick()` 必須在 `scene.update(dt)` **之後**才呼叫，否則 keydown 設的 `pressed` 邊緣事件會被清掉，scene 永遠收不到 `wasPressed`。

#### `menu/MainMenu.js`
- 內嵌 5×7 bitmap 字型（A-Z、0-9、少數符號），無素材依賴
- 上下選擇遊戲，A/START 進入
- ⚠️ 進 M2 後字型最好抽到 `engine/PixelFont.js`，避免 MainMenu 跟 Hud 各自有一份

---

## 遊戲模組介面（M2 起延用）

```js
// src/games/<id>/index.js
export default {
  id: 'iceclimber',
  title: 'Ice Climber',
  supports: { singlePlayer: true, twoPlayer: true },
  factory: () => new IceClimberScene(),
  assetManifest: { images: {...}, json: {...} },  // M2 起會用到
};
```

Scene 在 `init(ctx)` 中可用：
- `ctx.canvas` — Canvas 實例（`.ctx`、`.lw`、`.lh`）
- `ctx.input` — InputState（P1）
- `ctx.input2` — InputState | null（P2，M4 才會非 null）
- `ctx.net` — NetAdapter | null（M4 才會非 null）
- `ctx.launchGame(id)` — 切換到另一款遊戲
- `ctx.exitToMenu()` — 回主選單

---

# 🎯 M2 — Ice Climber 單人 MVP（下一步）

## 目標
桌機可玩、可從第 1 層爬到第 8 層通關、掉出鏡頭失敗。

## 任務清單

### 1. 引擎補充
- `engine/Random.js` — Seeded PRNG（mulberry32）
  ```js
  export function mulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  export function makeRng(seed) {
    const rand = mulberry32(seed);
    return {
      next: rand,
      int: (n) => Math.floor(rand() * n),
      pick: (arr) => arr[Math.floor(rand() * arr.length)],
      range: (a, b) => a + rand() * (b - a),
    };
  }
  ```
  從 M2 起所有亂數走這裡（為了未來 M4 雙人決定論）。

- `engine/AssetLoader.js` — 圖片/JSON 預載
  ```js
  export async function loadAssets({ images = {}, json = {} } = {}) {
    const out = { images: {}, json: {} };
    const imgTasks = Object.entries(images).map(([k, url]) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => { out.images[k] = i; res(); };
      i.onerror = () => rej(new Error(`圖片載入失敗: ${url}`));
      i.src = url;
    }));
    const jsonTasks = Object.entries(json).map(([k, url]) =>
      fetch(url).then(r => r.json()).then(j => { out.json[k] = j; }));
    await Promise.all([...imgTasks, ...jsonTasks]);
    return out;
  }
  ```

- `engine/PixelFont.js` — 把 `MainMenu` 內嵌字型抽出來，HUD 也用同一份
  - 提供 `drawText(c, text, x, y, { scale, color, align })`

- `engine/SpriteSheet.js`（可選，M2 看素材複雜度再決定）
  - 用來從 tilesheet 切 frame，提供 `drawFrame(c, sheet, frameIndex, x, y, scale)`

### 2. 素材取得
從 Kenney.nl 下載（直接放在 `src/games/iceclimber/assets/`）：

- **Pixel Platformer**（主角、地形）：https://kenney.nl/assets/pixel-platformer
- **Background Elements Redux**（雪山遠景）：https://kenney.nl/assets/background-elements-redux

最少需要：
- `player.png`（主角 idle/run/jump/hammer 至少 4 frames，可從 Pixel Platformer 的 character sheet 挑）
- `tiles.png`（冰塊：完整/裂開/破碎 三態 + 不可破地基）
- `bg.png`（雪山遠景，水平 tileable）

建立 `assets/LICENSES.md`：
```markdown
# 素材授權

## player.png
- 來源：https://kenney.nl/assets/pixel-platformer
- 授權：CC0
- 下載日期：YYYY-MM-DD

## tiles.png
- 來源：https://kenney.nl/assets/pixel-platformer
- 授權：CC0
- 下載日期：YYYY-MM-DD

## bg.png
- 來源：https://kenney.nl/assets/background-elements-redux
- 授權：CC0
- 下載日期：YYYY-MM-DD
```

### 3. Ice Climber 遊戲模組

目錄結構：
```
src/games/iceclimber/
├── index.js                 GameModule 宣告 + assetManifest
├── IceClimberScene.js       主場景，協調其他模組
├── Player.js                玩家實體 + 物理
├── IceGrid.js               冰塊網格 + 破壞邏輯
├── HammerHitbox.js          槌擊判定
├── Camera.js                Y 軸跟隨 + 永不下捲
├── LevelGen.js              程式產生關卡（用 makeRng）
├── Hud.js                   分數 / 層數 / 生命
└── assets/
    ├── player.png
    ├── tiles.png
    ├── bg.png
    └── LICENSES.md
```

### 4. 規格細節（從計畫沿用）

#### 實體
- **Player**：12×14 AABB；狀態 `idle/run/jump/fall/hammer`；`facing: -1|1`；`hammerTimer` 槌擊倒數
- **IceGrid**：8 欄 × 無限行；每格 16×8 像素；cell `{ type, hits }`，`hits=2` 才破
- **HammerHitbox**：槌擊動畫 frame 3–6 生成在前方

#### 物理
- 重力 ~480 px/s²，跳躍初速 -180 px/s（鬆 A 加重力）
- 橫向速度 60 px/s，空中減為 0.7×
- 軸分離 sweep AABB
- 頭撞冰塊（vy < 0）：hits -1
- 槌擊：hits -2
- 側撞冰塊：擋住不破

#### 鏡頭（`Camera.js`）
- Y 軸 deadzone，玩家上升超過 deadzone 時鏡頭往上
- **永不下捲** → 掉到鏡頭底部即死
- 渲染只畫 `[camY - 8, camY + 240 + 8]` 範圍內的 cell

#### 勝負
- **勝**：到達第 8 層 → "YOU MADE IT" → 回選單
- **敗**：player.y > camY + 240 → "GAME OVER" → 回選單
- 計分：每破一塊 +10、每過一層 +100

#### 關卡產生（`LevelGen.js`）
```js
// generateRow(rowIndex, rng, prevRow) → array of 8 cell types
// 規則：
// - 第 0 行全實心（出生平台）
// - 一般行：1–4 個 gap
// - 同欄 gap 連續不超過 2 行
// - 每 4 行為「樓層線」：只 1–2 個 gap
// - 第 32 行（floor 8 × 4 rows）為終點地基
```

### 5. 接入主選單
在 `src/main.js`：
```js
import IceClimberGame from './games/iceclimber/index.js';
// ...
registerGame(IceClimberGame);
```

`MainMenu` 自動會顯示新項目（不用改 MainMenu）。

### 6. Scene 切換要支援 async init
⚠️ 目前 `main.js` 的 `setScene` 是 async，但 update tick 沒 await。對 DummyScene/MainMenu 沒影響（init 沒實際 await），但 IceClimberScene 要 `await loadAssets()`。需要加 loading 狀態：

```js
let loadingScene = false;

async function setScene(scene) {
  loadingScene = true;
  // ... 現有邏輯 + await scene.init(sceneCtx)
  loadingScene = false;
}

// loop update:
update: (dt) => {
  if (pendingScene) { ... return; }
  if (loadingScene) return;  // ← 載入中跳過 update
  if (currentScene && ...) currentScene.update(dt);
  inputMgr.beginTick();
}

// render 也要處理 loading：
render: (alpha) => {
  canvas.clear('#000');
  if (loadingScene) {
    // 畫個 "LOADING..." 文字
    return;
  }
  if (currentScene && ...) currentScene.render(canvas.ctx, alpha);
}
```

### 7. 驗收標準
- 從選單進 Ice Climber 不卡（資產載入有 LOADING 提示）
- 跳躍/槌擊/頭撞/側撞 4 種互動都正確
- 連跑 10 次新關卡都可通（沒死路）
- 第 8 層通關 → 回選單；掉出鏡頭 → 回選單
- DevTools Performance 確認 60 FPS
- 像素清晰、整數縮放、無模糊

### 8. 可能的取捨／問題
- **素材切版**：Kenney 的 sheet 內每格大小要實測，可能需要寫個 sprite frame 對照表。建議在 `assets/data.json` 存 frame 索引。
- **角色尺寸**：若 Kenney 角色比 12×14 大，調整 Player AABB 或 sprite 縮放
- **冰塊高度 16×8**：若 Kenney 的塊是 16×16，整個遊戲改成 16×16 也可，記得改 floor 行數定義（每 4 行 = 1 floor → 每 2 行 = 1 floor）

---

# 🎯 M3 — 觸控覆蓋層 + 手機 RWD

## 目標
iPhone / Android 橫豎屏都能順手玩 Ice Climber。

## 任務
1. `engine/TouchOverlay.js` — DOM 虛擬按鈕
   - 用 `<div>` + CSS flex，不在 Canvas 內畫
   - 4 顆方向鍵（左下「+」字佈局）+ 2 顆動作鍵 A/B（右下）
   - `pointer-events` + `setPointerCapture` 處理多點觸控
   - 每個按鈕監聽 `pointerdown`/`pointerup`/`pointercancel` → 呼叫 `inputMgr.state.set(btn, true/false)`

2. CSS（`styles.css`）
   - 橫屏：浮在 letterbox 上（`position: fixed`）
   - 豎屏：佔下方 ~40% 視窗高度的控制帶
   - `touch-action: none` 全域、`env(safe-area-inset-*)` 避開 iOS notch

3. 顯示時機
   - 偵測 `matchMedia('(pointer: coarse)')` 才顯示
   - 或加 URL `?touch=1` debug flag 強制顯示

4. 處理瀏覽器奇怪行為
   - `viewport` meta：`maximum-scale=1.0, user-scalable=no, viewport-fit=cover`（M1 已設）
   - 防止雙擊縮放、滑動瀏覽器 UI（iOS Safari 動態工具列）

## 驗收
- iOS Safari + Android Chrome 真機測
- 橫豎屏切換時 layout 正確
- 同時按方向 + A 跳能多點觸控
- 不會誤觸發頁面捲動 / 縮放

---

# 🎯 M4 — 雙人連線（PeerJS）

## 目標
兩台裝置（瀏覽器分頁或筆電 + 手機）能用 6 字房間代碼配對，合作玩 Ice Climber。

## 任務

### 1. 固化 PeerJS
下載 https://github.com/peers/peerjs/releases 的 `peerjs.min.js` 到 `vendor/peerjs.min.js`。

在 `index.html` 引入：
```html
<script src="./vendor/peerjs.min.js"></script>
<script type="module" src="./src/main.js"></script>
```
PeerJS 會掛在 `window.Peer`。

### 2. 網路層
建立 `src/net/`：

- `PeerSession.js` — PeerJS 包裝
  ```js
  class PeerSession {
    async host() {
      const code = generateRoomCode();  // 'gamu-XXXXXX'
      this.peer = new Peer(code);
      // 處理 'unavailable-id' 重試
      // 等待 'connection' 事件
    }
    async join(code) {
      this.peer = new Peer();
      this.conn = this.peer.connect(code, { reliable: false });
    }
    send(msg) { this.conn.send(msg); }
    onMessage(cb) { ... }
    onDisconnect(cb) { ... }
  }
  ```

- `NetProtocol.js` — 訊息型別
  ```js
  export const MSG = {
    HELLO: 1, START: 2, INPUT: 3, SNAPSHOT: 4, PING: 5, PONG: 6, BYE: 7,
  };
  // INPUT 用 bitfield：bit0=LEFT, ..., bit5=B
  export function packInput(state) { ... }
  export function unpackInput(byte) { ... }
  ```

- `HostNetAdapter.js`
  - 收集 guest INPUT 訊息，存為 `lastGuestInput`（過期就沿用）
  - 每 2 tick 呼叫 `scene.serializeSnapshot()` 並發送
  - tick 計數同步用

- `GuestNetAdapter.js`
  - 每 tick 把 local input 打包送出
  - 收 SNAPSHOT 呼叫 `scene.applySnapshot()`
  - 兩個 snapshot 之間做插值

### 3. 大廳
- `src/menu/LobbyScene.js`
  - Mode = `host`：產代碼、顯示、等對方連
  - Mode = `join`：6 格輸入框 + 連線
  - 連上後 `ctx.launchGame('iceclimber', { net: hostOrGuestAdapter })`

主選單擴充：每個遊戲卡片下方加「2P 主機」「2P 加入」兩個選項（單人遊戲跳過）。

### 4. IceClimberScene 擴充支援雙人
- 第二個 Player 實例
- `serializeSnapshot()` 回傳完整狀態（雙方位置、grid diff、camY、score、floor）
- `applySnapshot()` 套用，render 時對位置做插值
- Host 模式 update 時讀 `ctx.input`（P1）+ `ctx.input2`（P2，來自 net adapter）
- Guest 模式 update 退化為「只送輸入」，狀態完全由 snapshot 決定

### 5. 斷線處理
- `dataConnection.on('close')` 觸發 `ctx.net.onDisconnect`
- Host：暫停 5 秒等重連 → 否則顯示「對方斷線，繼續單人？」
- Guest：顯示「失去連線」→ 回大廳並預填上次的代碼

## 驗收
- 兩個瀏覽器視窗能配對、合作爬塔
- 筆電 + 手機（不同網路）也能配對（測 STUN 穿透）
- 斷線提示出現、重連可繼續
- Chrome DevTools → Network → WS：連線時有 PeerJS broker 流量，遊戲中只有 P2P

## 已知限制（MVP 範圍）
- 不做客端預測 → guest 端會有 ~50–100ms 延遲
- 沒 TURN，對稱型 NAT 連不通時提示「試試手機熱點」
- 若 PeerJS 公共 broker 掛了會無法配對（之後可自架）

---

# 🎯 M5 — 收尾 + 音效 + 第二款遊戲示範

## 目標
- 整個系統打磨完
- 證明「擴充其他遊戲」確實可行

## 任務

### 1. 音效系統
- `engine/Audio.js` — WebAudio 包裝
  ```js
  class AudioSystem {
    constructor() { this.ctx = null; this.buffers = {}; }
    async init() {
      // 首次 user gesture 時呼叫
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    async load(name, url) { ... }
    play(name, { volume = 1, loop = false } = {}) { ... }
    stop(name) { ... }
  }
  ```
- 在 `main.js` 首次 keydown/click 時 `audio.init()`（iOS Safari 需求）

### 2. CC0 音效
從 Kenney audio packs：
- **Impact Sounds** — 槌擊、破冰音
- **Interface Sounds** — 跳躍、過關音
- 不需要背景音樂（先省略）

放在 `src/games/iceclimber/assets/sfx/`，加入 `LICENSES.md`。

### 3. 第二款遊戲（架構驗證）
做個極簡的遊戲，例如：
- **Snake**（貪食蛇）— 8×8 格、吃蘋果、撞牆死
- **Pong vs CPU** — 玩家上下移動板子、撞球比分
- **Memory Match** — 翻牌配對

選一個 30 分鐘能寫完的。重點是**不改 engine、不改 main.js 引擎邏輯**，只新增 `src/games/<id>/` 資料夾 + 加一行 `registerGame()`。

### 4. README / LICENSES 整理
- 填入正式的 GitHub Pages URL
- 整理每個遊戲的 `LICENSES.md`
- 程式碼授權選擇（建議 MIT）

### 5. 記憶體洩漏檢查
- 在 DevTools 開 Performance Memory profiler
- 反覆切換 選單 → A → 選單 → B → 選單 → A 多次
- `getEventListeners(window)` 確認沒殘留
- Scene 的 `destroy()` 要把所有 `addEventListener` 對應移除

## 驗收
- 兩款遊戲都能從選單進、回得來、可重複切換
- 跳躍、破冰、過關音效在桌機 + iOS Safari 都能播放
- 反覆切換無明顯記憶體成長

---

## 風險清單（M2 之後可能踩到的）

| 風險 | 緩解 |
|---|---|
| Kenney 素材尺寸與規格不合（12×14 / 16×8） | M2 開頭實測，必要時調整邏輯尺寸或縮放 sprite |
| PeerJS 公共 broker 偶有故障（M4） | `PeerSession` 設計接受替代 host 參數；之後可自架 |
| 對稱型 NAT 連不通（M4） | 連線 10 秒未成功顯示提示，未來可付費接 TURN |
| iOS Safari 音訊需手勢觸發（M5） | 第一次 click/keydown 後才 init AudioContext |
| 高 DPI 縮放模糊 | M1 已處理（整數倍 + pixelated + 不乘 DPR） |
| CC0 素材授權誤判 | 全部以 Kenney.nl 為主，逐項記錄到 `LICENSES.md` |
| async scene init 競態（M2 起） | 加 `loadingScene` 旗標，loading 期間跳過 update + 畫 LOADING |

---

## 不在本計畫範圍

- 排行榜、帳號系統、雲端存檔
- 觀戰模式、3+ 人遊玩
- 客端預測 / rollback netcode
- 移動裝置振動回饋
- 自架 PeerJS server 或 TURN server
- 國際化（先繁體中文 UI）

以上若日後需要，再開新計畫。

---

## Git 提交紀錄參考

```
1e083fd  修正 main.js 輸入清除順序
58270ca  重構：把 docs/ 內容搬到 repo 根目錄
4f0f0aa  M1: 引擎骨架 + 主選單 + Dummy Bouncer
```

未來每個里程碑建議拆 1–3 個 commit。M2 建議的拆法：
1. `M2-1: 引擎補充 (Random/AssetLoader/PixelFont) + scene async 載入`
2. `M2-2: Ice Climber 物理與冰塊網格`
3. `M2-3: 程式生關卡 + HUD + 勝負流程 + 素材整合`
