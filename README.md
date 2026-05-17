# Gamu 🎮

可擴充的 HTML5 網頁遊戲平台。第一款遊戲是任天堂《Ice Climber》風格的雙人合作爬塔遊戲，桌機與手機（橫豎屏）皆可遊玩。

## 🎮 線上遊玩
> M1 部署後填入 GitHub Pages 連結

## 🕹️ 操作方式

| 動作       | 鍵盤      | 觸控     | 手把   |
| ---------- | --------- | -------- | ------ |
| 移動       | ← →       | D-pad    | 左類比 |
| 跳躍       | `Z`       | A 鍵     | A      |
| 槌擊       | `X`       | B 鍵     | X      |
| 開始/暫停  | `Enter`   | START    | Start  |
| 退出至選單 | `Enter`   | START    | Start  |

觸控按鈕會在手機/平板自動顯示；桌機可加 `?touch=1` 強制測試，或用 `?touch=0` 強制關閉。

## 👥 兩人連線玩法（M4 進行中）

> 目前已有 M4 基礎版：主選單可切 `SINGLE / HOST / JOIN`，JOIN 使用 canvas 內 6 格代碼輸入，PeerJS 已固化在 `vendor/peerjs.min.js`。guest 端已加入 snapshot interpolation，host 可保留原房等待 guest 重連；跨裝置 WebRTC 仍待驗收。

1. **主機端**：選單 → Ice Climber → `HOST` → 看到 6 字代碼（例 `gamu-A7K9QX`）
2. **客端**：選單 → Ice Climber → `JOIN` → 用上下切字、左右切格，輸入 6 字代碼 → `START` 配對
3. 兩邊都會看到遊戲畫面，一起爬塔

斷線時 host 會保留房間等 guest 用原代碼重連，也可按 A 轉單人續玩；guest 可按 A 回 JOIN 大廳並預填原房號。

兩台裝置不需要在同一個網路，透過 WebRTC P2P 直連。

## 🛠️ 本機開發

需要 Python 3（或任何能架靜態檔的工具）：

```bash
# 進專案目錄
cd gamu

# 啟動本機 HTTP 伺服器
python -m http.server 8000

# 瀏覽器開啟
# http://localhost:8000/
```

> **不能直接用 `file://` 開啟 `index.html`** — ES Modules 需要 HTTP 協定。

替代方案：VS Code 的 Live Server 外掛、Node 的 `npx serve`。

## 🚀 部署到 GitHub Pages

1. 推到 GitHub `main` 分支
2. Repo 設定 → **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
3. 等約 1 分鐘，訪問 `https://<your-username>.github.io/gamu/`

第一次部署完，把上方的「線上遊玩」連結改成你的 URL。

## ➕ 新增一款遊戲

1. 在 `src/games/` 建立新資料夾，例如 `src/games/my-game/`
2. 仿照 `src/games/iceclimber/` 建立 `index.js` 與 `MyScene.js`
3. 在 `src/main.js` 加：
   ```js
   import MyGame from './games/my-game/index.js';
   registerGame(MyGame);
   ```
4. 重整頁面，新遊戲會出現在主選單

詳細的 Scene 生命週期介面見 `CLAUDE.md`。

## 📂 目錄結構

```
gamu/                      ← repo 根 = GitHub Pages 根
├── index.html
├── styles.css
├── 404.html
├── src/
│   ├── main.js            啟動、註冊遊戲
│   ├── engine/            共用引擎（GameLoop、Canvas、Input、TouchOverlay、Scene）
│   ├── menu/              主選單、LobbyScene、遊戲註冊
│   ├── net/               PeerJS 連線、protocol、host/guest adapter
│   └── games/             各款遊戲
│       └── iceclimber/    Ice Climber 簡化版（M2 起）
├── CLAUDE.md              專案約定（給未來 Claude session 讀）
└── README.md
```

## 🗺️ 里程碑

- [x] **M1** 引擎骨架 + 選單（Dummy 範例已於 M5 移除）
- [x] **M2** Ice Climber 單人 MVP（程式生關卡、爬到第 8 層）
- [x] **M2.5** Ice Climber 畫面與手感優化
- [x] **M3** 觸控覆蓋層 + 手機橫豎屏
- [ ] 🟡 **M4** 雙人連線（PeerJS WebRTC P2P，基礎版已接入，待真機驗收）
- [ ] **M5** 收尾 + 音效 + 第二款遊戲示範

## 📜 授權

- 程式碼：MIT
- 美術素材：CC0（清單見各遊戲資料夾下的 `LICENSES.md`）

## 🙏 致謝

- 像素素材：[Kenney.nl](https://kenney.nl)（CC0）
- 連線：[PeerJS](https://peerjs.com)
- 靈感：任天堂《Ice Climber》(1985)
