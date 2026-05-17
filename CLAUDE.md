# Gamu — 專案約定

給未來的 Claude session 看的專案備忘。人類使用說明請看 `README.md`。

## 專案目標
- 可擴充的 HTML5 遊戲平台
- 第一款遊戲：Ice Climber 簡化版（雙人合作爬塔）
- 部署到 GitHub Pages（純靜態，無後端）
- 支援桌機 + 手機（橫屏/豎屏）+ 線上雙人合作（PeerJS WebRTC P2P）

## 鎖定的技術決策
- **Vanilla JS + 原生 ES Modules**，無 build step、無 TypeScript、無框架
- **邏輯解析度 256×240**（對標 NES），CSS 整數倍縮放 + letterbox
- **連線**：PeerJS / WebRTC P2P，房間代碼配對（M4 才實作）
- **美術**：Ice Climber 目前使用程式化 pixel art；外部 CC0 素材保留在 assets 供後續替換
- **部署**：`main` 分支根目錄，commit 即 deploy

## 目錄結構
```
gamu/                     ← repo 根 = GitHub Pages 根
├── index.html            含 <canvas> 與觸控覆蓋層
├── 404.html              複製自 index（深層連結保險）
├── styles.css            橫豎屏佈局、letterbox、按鈕樣式
├── src/
│   ├── main.js           啟動、註冊遊戲、scene 切換
│   ├── engine/           遊戲共用，與具體遊戲無關（含 TouchOverlay）
│   ├── menu/             MainMenu、LobbyScene、GameRegistry
│   ├── net/              PeerJS 包裝、訊息協定、host/guest adapter
│   └── games/<id>/       每款遊戲自包含一個資料夾
├── vendor/               固化的第三方函式庫（如 peerjs.min.js）
├── CLAUDE.md             本檔
└── README.md
```

## 編碼慣例
- **路徑一律相對**：`./foo.js`、`./assets/x.png`，不用絕對路徑（GH Pages 在子路徑）
- **ES module 匯入必帶 `.js` 副檔名**：`import x from './foo.js'`
- **不直接綁鍵盤事件**：遊戲內透過 `ctx.input.isDown(Btn.X)` / `ctx.input.wasPressed(Btn.X)`
- **觸控輸入走 `TouchOverlay`**：DOM pointer 事件只寫入 `InputState.set(btn, true/false)`，遊戲不直接讀 DOM
- **不用 `Math.random()`**（M2 起）：所有亂數走 `engine/Random.js` 的 seeded PRNG，為了未來決定論
- **像素完美**：`image-rendering: pixelated`、`imageSmoothingEnabled = false`、backing store 不乘 DPR
- **不引入 npm 套件**：要用第三方函式庫就固化到 `vendor/`

## 新增遊戲的步驟
1. 建立 `src/games/<my-game>/index.js`，匯出：
   ```js
   export default {
     id: 'my-game',
     title: 'My Game',
     supports: { singlePlayer: true, twoPlayer: false },
     factory: () => new MyScene(),
     assetManifest: { images: {}, json: {} },
   };
   ```
2. 建立 `MyScene.js`，繼承 `engine/Scene.js`，實作 `init/update/render/destroy`
3. 在 `src/main.js` 加 `import MyGame from './games/my-game/index.js';` + `registerGame(MyGame);`
4. 重整頁面即可，新遊戲會出現在主選單

## Scene 介面
```
async init(ctx)       // ctx: {canvas, input, input2, net, audio, launchGame, openLobby, exitToMenu}
update(dt)            // 60Hz 固定步長
render(ctx2d, alpha)  // 在邏輯解析度上畫
destroy()             // 釋放資源
// 網路用（M4 起）：
serializeSnapshot()
applySnapshot(snap)
onRemoteInput(p2Input)
```

## 本機開發
```
# 在 repo 根目錄執行任一靜態伺服器，例：
python -m http.server 8000
# 開 http://localhost:8000/
```
**不能直接用 `file://` 打開** — ES modules 需要 HTTP 協定。

## 部署
- 推到 `main` 分支即更新 GH Pages（無 build step）
- GitHub repo 設定：Settings → Pages → Source = `main` / `/ (root)`
- 站點 URL：`https://<user>.github.io/gamu/`

## 里程碑進度
- [x] **M1** 引擎骨架 + 選單 + Dummy 遊戲
- [x] **M2** Ice Climber 單人 MVP
- [x] **M2.5** Ice Climber 程式化 pixel art + 手感優化
- [x] **M3** 觸控覆蓋層 + 手機 RWD
- [ ] 🟡 **M4** 雙人連線（PeerJS，host/join、guest interpolation、基礎重連已接入，待真機驗收）
- [ ] 🟡 **M5** 收尾 + 音效 + 第二款遊戲
  - ✅ `engine/Audio.js`（WebAudio 包裝，user gesture init）+ `scene_ctx.audio` 接入
  - ⬜ CC0 音效素材整合（Kenney Impact/Interface Sounds）
  - ⬜ 第二款遊戲（Snake/Pong 之一，驗證架構）
  - ⬜ 記憶體洩漏檢查、LICENSES 整理

## 計畫檔
完整計畫在 repo 內：`plans/html-ice-climber-github-playful-umbrella.md`

## GameLoop 與 Input 的耦合
- `update(dt)` 固定 60Hz；`render(ctx2d, alpha)` 收 0–1 插值因子，要做平滑動畫得自行用 alpha 內插上一/這一 tick 的狀態。
- 每個 tick 順序：scene.update → `inputMgr.beginTick()`，所以 scene 在 update 內讀 `wasPressed/wasReleased` 看的是「本 tick 內新發生」的邊緣。
- `main.js` 用 `loadingScene` 旗標讓 async `Scene.init()` 期間 update 跳過、render 畫 "LOADING..."。
- `TouchOverlay` 只在 coarse pointer 裝置顯示；`?touch=1` 強制開啟，`?touch=0` 強制關閉。豎屏觸控模式下 `Canvas.js` 會保留底部控制帶高度。
- `AudioSystem` 在第一次 `keydown` 或 `pointerdown` 時自動 init（iOS Safari / Chrome autoplay policy 要求 user gesture）。Scene 可透過 `ctx.audio.loadAll({name: url, ...})` 在 init 內預載，再用 `ctx.audio.play(name, { volume, loop })`。init 前的 load/play 會 silently no-op。

## M4 連線切片現況
- `vendor/peerjs.min.js` 已固化，`index.html` / `404.html` 會先載入 PeerJS 再載入 `main.js`。
- `src/net/NetProtocol.js`：房間代碼、input bitfield、message type。
- `src/net/PeerSession.js`：PeerJS host/join/send/onMessage/onDisconnect 包裝。
- `src/net/NetAdapters.js`：host authoritative；guest 每 tick 傳 input，host 每 2 tick 傳 snapshot。
- `src/menu/LobbyScene.js`：主選單 `HOST / JOIN` 入口，host 顯示 room code，join 使用 canvas 內 6 格輸入器（上下切字、左右切格、START 送出）。
- `IceClimberScene` 目前支援單人、host 雙人模擬、guest snapshot buffer/interpolation；斷線時 host 保留房間等待同房號 guest 重連，也可 A 轉單人續玩，guest 可 A 回 JOIN 大廳並預填原房號。尚未做 guest prediction、TURN fallback。

## 接續工作順序
1. 先做真機驗收：`HOST` → `JOIN` → 斷線 → 同房號重連。
2. 若真機畫面仍抖，優先調 `SNAPSHOT_INTERPOLATION_DELAY` / `SNAPSHOT_INTERVAL_TICKS`，不是先加 prediction。
3. 若跨網路連不上，先判定是 PeerJS broker / NAT / 手機瀏覽器行為，再決定要不要補 TURN fallback。
4. `M5` 之前不要重構遊戲架構，先把 `M4` 的收斂問題解完。

## 接手時先看
- `src/games/iceclimber/IceClimberScene.js`：net 狀態機、guest interpolation、斷線 overlay。
- `src/net/PeerSession.js`：重連時不要把舊 connection 的 close 誤判成新連線的斷線。
- `src/net/NetAdapters.js`：host 需在 open 後清 `disconnected`，並補送最後 snapshot。
- `plans/html-ice-climber-github-playful-umbrella.md`：M4 現況與下一步。
- `README.md`：使用者操作說明。

## 測試 / Lint
- 沒有測試框架、沒有 linter、沒有 build step。
- 純邏輯模組（Random / IceGrid / Player / LevelGen）可用 `node --input-type=module -e "..."` 做煙霧測試；DOM 依賴的部分一律靠瀏覽器手測。

## 不在範圍內
排行榜、帳號、雲端存檔、3+ 人、客端預測 rollback、振動回饋、自架 TURN、i18n
