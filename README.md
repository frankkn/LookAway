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
- **系統匣圖示**：右鍵可隱藏 / 顯示 Widget，或完全離開
- **暫停 / 繼續**：focus 階段可暫停計時

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

### 打包發布

```powershell
npm run build      # → release/ 資料夾（安裝檔 + portable exe）
```

---

## 狀態機說明

```
focus（倒數 20 分）
   │ 時間到
   ▼
reminder ──「好，我知道了」──▶ ready
                                │ 按「開始計時休息」
                                ▼
                              break（倒數 20 秒）
                                │ 時間到 / Skip
                                ▼
                             回到 focus
```

- `tick()` **只在 focus / break 遞減**；reminder / ready 為凍結等待狀態。
- reminder → ready 有 **400 ms 守門**，防止 Enter 鍵洩漏連鎖觸發。

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

## 設定值

| 常數 | 預設值 | 位置 |
|------|--------|------|
| `FOCUS_DURATION` | `20 × 60` 秒 | `src/main/index.js` |
| `BREAK_DURATION` | `20` 秒 | `src/main/index.js` |
| `START_GUARD_MS` | `400` ms | `src/main/index.js` |

> 開發測試時可暫時把 `FOCUS_DURATION` 改小（如 `4`）快速觸發休息流程，**記得 commit 前改回來**。

---

## 已知限制 / 未來規劃

- [ ] 統計存在記憶體，**重開 App 會歸零**（未持久化）
- [ ] 無跨日重置 `breaksToday` 的邏輯
- [ ] 無設定畫面（間隔、開機自啟等皆為寫死）
- [ ] Acrylic / blur 以 CSS `backdrop-filter` 近似，非 Windows 原生毛玻璃

---

## License

MIT
