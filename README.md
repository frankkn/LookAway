# LookAway 👁️

> **20-20-20 護眼法則** Windows 桌面小工具

每專注 **20 分鐘**,提醒你看 **20 呎**（約 6 公尺）外 **20 秒**,有效緩解長時間用眼疲勞。

---

## 畫面預覽

| Widget（常駐） | Reminder（提醒） |
|:-:|:-:|
| 右下角橘色倒數圓弧 | 置中暗色對話窗 |

---

## 功能

- **狀態機驅動**：focus → reminder → ready → break → focus 四階段自動循環
- **常駐 Widget**：280×360 小視窗停在螢幕右下角，計時不干擾作業
- **Reminder 對話窗**：時間到彈出置中提醒，按「好，我知道了」進入 ready 階段
- **計時休息**：進入 break 後藍色圓弧倒數 20 秒，可隨時 Skip
- **今日統計**：記錄本日完成休息次數與累計專注時間
- **系統匣圖示**：右鍵可隱藏 / 顯示 Widget、開設定、檢查更新，或完全離開
- **暫停 / 繼續**：focus 階段可暫停計時
- **設定視窗**：可自訂工作 / 休息時長、兩個視窗的大小與字體、主視窗整體縮放，並提供即時預覽
- **自動更新**：安裝版開啟時自動檢查 GitHub 新版，下載後提示重啟套用

---

## 下載安裝（一般使用者）

到 **[Releases 頁面](https://github.com/frankkn/LookAway/releases/latest)** 下載,兩種版本擇一:

| 版本 | 檔名 | 說明 |
|------|------|------|
| **安裝版**（推薦） | `Look Away Setup x.x.x.exe` | 有安裝流程、開始選單捷徑、可解除安裝,**且支援自動更新** |
| **免安裝版** | `Look Away x.x.x.exe` | 下載後雙擊即用,適合隨身碟／試用（**不會自動更新**） |

> ⚠️ **SmartScreen 警告**：本程式未購買程式碼簽章憑證,首次執行 Windows 可能跳出「Windows 已保護您的電腦」。
> 點 **「其他資訊」→「仍要執行」** 即可。這是未簽章程式的正常現象,非病毒。

### 自動更新（僅安裝版）

安裝版每次開啟時會自動向 GitHub 檢查是否有新版:
- 有新版 → 背景下載 → 完成後跳出對話框,可選「立即重啟更新」或「稍後」。
- 也可從**系統匣圖示右鍵 →「檢查更新」**手動檢查。

---

## 技術棧

| 層次 | 技術 |
|------|------|
| 桌面容器 | Electron |
| 前端框架 | React + Vite |
| 樣式 | 純手寫 CSS（無 UI library） |
| 打包 | electron-builder（NSIS 安裝檔 + Portable exe） |
| 平台 | Windows only |

---

## 安裝與執行

### 開發模式

```powershell
npm install
npm run dev        # Vite dev server + Electron 熱更新
```

### 本機打包（不發布）

```powershell
npm run build      # → release/ 資料夾（安裝檔 + portable exe）
```

---

## 發版流程（維護者）

自動更新的來源是 GitHub Releases,發一次新版給所有使用者只需三步:

1. **改版本號**：編輯 `package.json` 的 `version`（例如 `1.0.0` → `1.0.1`）。
   > 這是自動更新的**唯一觸發依據**——版本號沒往上加,使用者就不會收到更新,即使開了新 tag 也一樣。

2. **打包並上傳**：
   ```powershell
   $env:GH_TOKEN = "<你的 GitHub Personal Access Token>"   # 需有 repo 權限
   npm run release      # build + 上傳 installer / portable / latest.yml 到「草稿」Release
   ```

3. **發布 Release**：到 GitHub 的 Releases 頁,把剛產生的**草稿（draft）**確認無誤後按 **Publish**。
   - 只有正式發布的 Release 才會觸發使用者更新;草稿與 pre-release 不會。

> **GH_TOKEN** 取得:GitHub → Settings → Developer settings → Personal access tokens,
> 建立一個有 `repo` 權限的 token。不要把 token 寫進程式碼或 commit。

---

## 專案結構

```
src/
  main/
    index.js        # 主行程：計時狀態機、視窗管理、Tray、IPC
    preload.js      # contextBridge 安全橋接
  renderer/
    main.html / main.jsx          # Widget 進入點
    reminder.html / reminder.jsx  # Reminder 進入點
    components/
      Widget.jsx      # 主工具，依 phase 切換弧形 / 徽章 / 按鈕
      Reminder.jsx    # 「該休息了」對話窗
      ArcProgress.jsx # 共用 SVG 圓弧進度條
    styles/
      widget.css / reminder.css
vite.config.mjs       # 多頁 build；base: './'
electron-builder.yml  # Windows nsis + portable
```

---

## License

MIT
