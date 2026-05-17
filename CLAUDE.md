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
- [x] **M1** 引擎骨架 + 選單（Dummy 範例已於 M5 移除）
- [x] **M2** Ice Climber 單人 MVP
- [x] **M2.5** Ice Climber 程式化 pixel art + 手感優化
- [x] **M3** 觸控覆蓋層 + 手機 RWD
- [ ] 🟡 **M4** 雙人連線（PeerJS，host/join、guest interpolation、基礎重連已接入，待真機驗收）
- [ ] 🟡 **M5** 收尾 + 音效 + Ice Climber 內容擴充
  - ✅ `engine/Audio.js`（WebAudio 包裝，user gesture init）+ `scene_ctx.audio` 接入
  - ✅ Kenney Impact/Interface SFX 整合（jump/hammer/break/win/lose）
  - ✅ Ice Climber 加 Topi（紅鴨）、Icicle（冰柱）、Nitpicker（鳥）、Bonus 蔬菜關卡
  - ⬜ 記憶體洩漏檢查、LICENSES 整理
  - ⬜（可選）第二款遊戲（架構驗證）

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

## M5 內容擴充現況（2026-05 完成）
- **Hammer**：`Player._doHammerHit` 改成單格 1 damage，候選優先序 `前方體高 → 前方頭頂 → 正上方`；player 對外暴露 `hammerJustLanded` / `hammerTargetCol` / `hammerTargetRow` 給 scene 做敵人撃殺判定。
- **LevelGen**：gap 密度收緊到一般列 1..2、floor 線 1..2。
- **Topi.js**（紅鴨）：14×8、沿 floor-line 走、撞玩家推飛、hammer 同 cell 秒殺 +200。spawn 規則：每 floor-line 約 65% 機率出 1 隻。
- **Icicle.js**（冰柱）：4×8、狀態機 `HANGING/SHAKING/FALLING/DEAD`、撞玩家 → `gameState='lost'`、hammer 預先打碎 +50。
- **Nitpicker.js**（鳥）：12×8、不受 grid 影響、定時 spawn（玩家過 floor 2 後）、撞玩家推飛、hammer +500、墜落 1.5s 後 despawn。
- **Bonus 蔬菜關**：`IceClimberScene.stage_mode='climb'|'bonus'`；過 floor 8 自動進入；固定 4 平台、10 蔬菜、20s 倒數；每個 +300、全收完 +500；結束 → `gameState='bonus_done'`。
- **Audio**：`engine/Audio.js`，首次 keydown/pointerdown init；load 未 init 時先 fetch 暫存 ArrayBuffer。SFX 在 `src/games/iceclimber/assets/sfx/`（jump/hammer/break/win/lose，Kenney CC0）。
- **Snapshot 擴充**：`serializeSnapshot` 新增 `topis / icicles / nitpickers / bird_spawn_timer / stage_mode / bonus_timer / vegetables`。
- **Dummy Bouncer 已移除**：選單只剩 Ice Climber。

## 接續工作順序
1. **（待做）M5 收尾**：記憶體洩漏檢查（反覆 MainMenu ↔ IceClimber 切換 100+ 次、`getEventListeners(window)` 抓殘留、Scene.destroy() 清 listener）。
2. **（待做）LICENSES / README 整理**：補正式 GH Pages URL、repo 根放 `LICENSE`（MIT 建議）。
3. **（可選）第二款遊戲**：Snake / Pong / Memory Match 任選，驗證 GameRegistry 擴充不需碰 engine。
4. **（M4 仍待）真機驗收**：`HOST` / `JOIN` / 斷線 / 同房號重連；若畫面抖，先調 `SNAPSHOT_INTERPOLATION_DELAY` / `SNAPSHOT_INTERVAL_TICKS`，不要先加 prediction。

## 接手時先看
- `src/games/iceclimber/IceClimberScene.js`：含 climb + bonus 雙 stage_mode、敵人 collision/kill helper、guest snapshot interpolation、斷線 overlay。
- `src/games/iceclimber/Player.js`：`_doHammerHit` 候選格邏輯；`hammerJustLanded` 旗標 / `hammerTargetCol/Row` 給場景做敵人撃殺。
- `src/games/iceclimber/{Topi,Icicle,Nitpicker}.js`：各自的物理 + snapshot；spawn helper 在檔尾。
- `src/games/iceclimber/Hud.js`：bonus_timer 顯示與 BONUS CLEAR overlay。
- `src/net/{PeerSession,NetAdapters}.js`：M4 重連邏輯（重連時不要把舊 connection close 誤判成新連線斷線；host open 後要清 `disconnected` 並補送最後 snapshot）。
- `plans/html-ice-climber-github-playful-umbrella.md`：M5 完成項目與下一步。
- `README.md`：使用者操作說明。

## 測試 / Lint
- 沒有測試框架、沒有 linter、沒有 build step。
- 純邏輯模組（Random / IceGrid / Player / LevelGen）可用 `node --input-type=module -e "..."` 做煙霧測試；DOM 依賴的部分一律靠瀏覽器手測。

## 不在範圍內
排行榜、帳號、雲端存檔、3+ 人、客端預測 rollback、振動回饋、自架 TURN、i18n
