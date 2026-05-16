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
- **美術**：CC0 像素素材，主用 Kenney.nl
- **部署**：`main` 分支根目錄，commit 即 deploy

## 目錄結構
```
gamu/                     ← repo 根 = GitHub Pages 根
├── index.html            含 <canvas> 與觸控覆蓋層
├── 404.html              複製自 index（深層連結保險）
├── styles.css            橫豎屏佈局、letterbox、按鈕樣式
├── src/
│   ├── main.js           啟動、註冊遊戲、scene 切換
│   ├── engine/           遊戲共用，與具體遊戲無關
│   ├── menu/             MainMenu、LobbyScene、GameRegistry
│   ├── net/              M4 才加入 — PeerJS 包裝、訊息協定
│   └── games/<id>/       每款遊戲自包含一個資料夾
├── vendor/               固化的第三方函式庫（如 peerjs.min.js）
├── CLAUDE.md             本檔
└── README.md
```

## 編碼慣例
- **路徑一律相對**：`./foo.js`、`./assets/x.png`，不用絕對路徑（GH Pages 在子路徑）
- **ES module 匯入必帶 `.js` 副檔名**：`import x from './foo.js'`
- **不直接綁鍵盤事件**：遊戲內透過 `ctx.input.isDown(Btn.X)` / `ctx.input.wasPressed(Btn.X)`
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
async init(ctx)       // ctx: {canvas, input, input2, net, launchGame, exitToMenu}
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
- [x] **M2** Ice Climber 單人 MVP（色塊渲染，素材待 M3 前補）
- [ ] **M3** 觸控覆蓋層 + 手機 RWD
- [ ] **M4** 雙人連線（PeerJS）
- [ ] **M5** 收尾 + 音效 + 第二款遊戲

## 計畫檔
完整計畫在 repo 內：`plans/html-ice-climber-github-playful-umbrella.md`

## GameLoop 與 Input 的耦合
- `update(dt)` 固定 60Hz；`render(ctx2d, alpha)` 收 0–1 插值因子，要做平滑動畫得自行用 alpha 內插上一/這一 tick 的狀態。
- 每個 tick 順序：scene.update → `inputMgr.beginTick()`，所以 scene 在 update 內讀 `wasPressed/wasReleased` 看的是「本 tick 內新發生」的邊緣。
- `main.js` 用 `loadingScene` 旗標讓 async `Scene.init()` 期間 update 跳過、render 畫 "LOADING..."。

## 測試 / Lint
- 沒有測試框架、沒有 linter、沒有 build step。
- 純邏輯模組（Random / IceGrid / Player / LevelGen）可用 `node --input-type=module -e "..."` 做煙霧測試；DOM 依賴的部分一律靠瀏覽器手測。

## 不在範圍內
排行榜、帳號、雲端存檔、3+ 人、客端預測 rollback、振動回饋、自架 TURN、i18n
