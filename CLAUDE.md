# Look Away — 專案交接文件 (CLAUDE.md)

實作 **20-20-20 護眼法則**的 Windows 桌面小工具:每專注 20 分鐘,提醒使用者看 20 呎(約 6 公尺)外 20 秒。

- **GitHub**: https://github.com/frankkn/LookAway (帳號 `frankkn`,分支 `master`)
- **技術棧**: Electron + React (無 UI library,純手寫 CSS) + Vite + electron-builder
- **平台**: Windows only

---

## 快速啟動

```powershell
npm install          # 首次;若中途被中斷,見下方「Electron 二進位」
npm run dev          # Vite dev server + Electron(熱更新)
npm run build        # 打包 → release/(NSIS 安裝檔 + portable exe)
npm run build:renderer   # 只 build 前端(驗證編譯用,很快)
```

---

## ⚠️ 換電腦 / 環境踩雷清單(務必先看)

1. **`ELECTRON_RUN_AS_NODE` 環境變數**
   若啟動時報錯 `TypeError: Cannot read properties of undefined (reading 'isPackaged')`,
   代表這個變數被設成 `1`,會讓 Electron 當成純 Node 跑、`require('electron')` 回傳字串而非 API。
   這**不是程式 bug**。啟動前清掉:
   ```powershell
   $env:ELECTRON_RUN_AS_NODE = ""
   ```
   (此變數在某些開發環境/工具會被預設帶入;一般乾淨的終端機不會有。)

2. **Vite `base: './'` 不能拿掉**
   打包後 Electron 用 `file://` 載入 HTML,若用預設的絕對路徑 `/assets/...` 會載不到資源、白畫面。
   `vite.config.mjs` 已設 `base: './'` 產生相對路徑,改動時別動掉。

3. **Electron 二進位下載**
   `node_modules/electron` 的實際執行檔是 postinstall 時另外下載的。若 `npm install` 中途被 kill,
   會出現 `Electron failed to install correctly`。補救:
   ```powershell
   node node_modules/electron/install.js
   ```

4. **PowerShell 提交含中文的 commit message 會壞掉**
   here-string (`@'...'@`) 遇到中文或內嵌引號常被 PowerShell 切斷。
   **一律改用檔案**:把訊息寫進 `.txt`(UTF-8)再 `git commit -F msg.txt`。

---

## 架構(最重要的心智模型)

**計時邏輯完全在主行程**,UI 只負責顯示。主行程每秒 `tick()`,再透過 IPC 廣播完整狀態給所有視窗。
關掉/重開任何視窗都不影響計時。

### 狀態機(四階段)
```
focus (倒數 20 分)
   │ 時間到 → 顯示 reminder 小視窗(搶焦點)
   ▼
reminder ── 使用者按「好,我知道了」──▶ ready
   │  (計時凍結,等使用者)              │  widget 顯示「▶ 開始計時休息」按鈕
   │                                    │  (計時仍凍結,等使用者按)
   │                                    ▼ 使用者按開始
   │                                  break (倒數 20 秒,widget 藍色弧形,可 Skip)
   │                                    │ 時間到 或 Skip → breaksToday +1
   └────────────────────────────────────┴──▶ 回到 focus
```
- `tick()` **只在 `focus` / `break` 遞減**;`reminder` / `ready` 是凍結等待狀態。
- **400ms 守門** (`START_GUARD_MS`) 用在兩處按鍵洩漏:
  1. reminder 剛彈出(搶焦點 + OK 鈕 autoFocus)→ 忽略 `acknowledge`,防止打字中的 Enter 直接按掉提醒;
  2. `ready` 剛開始 → 忽略 `startBreak`,防止 reminder 上的 Enter 洩漏到剛取得焦點的 widget、連鎖跳過 `ready`。
  滑鼠操作不受影響。
- `skipBreak` / `reset` 有 phase 守衛(只在 `break` / `focus` 生效),連點或 race 時回傳原 state(no-op)。
- widget 位置:使用者拖曳後存進 `settings.json`(`widgetX/widgetY`),重開還原;調整大小時以右下角為錨點,不會吸回預設角落。

### 視窗
| 視窗 | 檔案 | 說明 |
|------|------|------|
| Widget | `main.html` → `Widget.jsx` | 280×360 常駐小工具,螢幕右下角 |
| Reminder | `reminder.html` → `Reminder.jsx` | 400×300 置中暗色對話窗,休息時才 show(**非全螢幕**,這是刻意的) |
| Tray | 主行程內建 | 系統匣圖示,可隱藏/顯示 widget、離開 |

---

## 檔案結構

```
src/
  main/
    index.js      # 主行程:計時狀態機、視窗管理、tray、IPC handlers
    preload.js    # contextBridge 安全橋接(window.electronAPI)
  renderer/
    main.html / main.jsx           # Widget 進入點
    reminder.html / reminder.jsx   # Reminder 進入點
    components/
      Widget.jsx        # 主工具,依 phase 切換弧形/徽章/按鈕
      Reminder.jsx      # 「該休息了」對話窗內容
      ArcProgress.jsx   # 共用 SVG 圓弧進度條(兩邊都用)
    styles/
      widget.css / reminder.css
vite.config.mjs       # 多頁 build:main + reminder;base:'./';dev port 5173
electron-builder.yml  # Windows nsis + portable
```

---

## IPC 通道一覽

**Renderer → Main**(`preload.js` 對應方法):
| IPC channel | electronAPI 方法 | 作用 |
|-------------|------------------|------|
| `timer:pause` / `timer:resume` | `pauseTimer` / `resumeTimer` | 暫停/繼續(focus 階段) |
| `timer:reset` | `resetTimer` | 重置回 focus 20 分 |
| `break:acknowledge` | `acknowledgeBreak` | reminder 按「好,我知道了」→ ready |
| `break:start` | `startBreak` | widget 按「開始計時休息」→ break |
| `break:skip` | `skipBreak` | 跳過休息(仍計入 breaksToday) |
| `window:minimize` / `window:close` | `minimizeWindow` / `closeWindow` | 隱藏到 tray / 離開 |

**Main → Renderer**: `timer:tick`(廣播完整 state) — 前端用 `onTimerTick(cb)` 訂閱。
**Invoke**: `timer:getState`(`getTimerState()`) — 視窗載入時取初始狀態。

State 形狀:`{ phase, remaining, isPaused, stats: { breaksToday, focusTime } }`

---

## 設定值

| 常數 | 值 | 位置 |
|------|-----|------|
| `FOCUS_DURATION` | `20 * 60` 秒 | `src/main/index.js` |
| `BREAK_DURATION` | `20` 秒 | `src/main/index.js` |
| `START_GUARD_MS` | `400` ms | `src/main/index.js` |

> 測試時常把 `FOCUS_DURATION` 暫時改小(如 `4`)來快速觸發休息流程,**記得改回來再 commit**。

配色:背景 `#1a1a2e`、focus 橘 `#ff6b35`、break/stats 藍 `#4fc3f7`。

---

## Git 工作流程

- **User**: `Frank Yang` / `frank840629@gmail.com`(專案內已 `git config` 設定)
- **Commit**: 遵循 Conventional Commits(`feat:` / `fix:` …),結尾附:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Push**: `git push origin master`(remote `origin` = https://github.com/frankkn/LookAway.git)
- 完成一個段落(功能/修正)就 commit + push。
- 中文 commit message → 用 `git commit -F 檔案`(見上方踩雷第 4 點)。

---

## 尚未實作 / 可延伸

- 統計目前存在記憶體,**重開 App 會歸零**(未持久化)。
- 沒有跨日重置 `breaksToday` 的邏輯。
- 沒有設定畫面(間隔時間、開機自動啟動等目前為寫死)。
- Acrylic/blur 目前用 CSS `backdrop-filter` 近似,非 Windows 原生毛玻璃。
