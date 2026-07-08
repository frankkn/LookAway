<div align="right">

**English** | [繁體中文](README.zh-TW.md)

</div>

# LookAway 👁️

> A Windows desktop widget for the **20-20-20 rule** of eye care

Every **20 minutes** of focus, it reminds you to look at something **20 feet** (about 6 meters) away for **20 seconds** — an effective way to relieve eye strain from long screen sessions.

---

## Screenshots

| Widget (always-on-top) | Reminder (break prompt) | Settings |
|:-:|:-:|:-:|
| <img src="docs/screenshots/widget.png" width="240" alt="Widget"> | <img src="docs/screenshots/reminder.png" width="240" alt="Reminder"> | <img src="docs/screenshots/settings.png" width="240" alt="Settings"> |

---

## Features

- ⏰ **Focus timer**: automatically pops up a break reminder when the countdown ends; pause / reset anytime
- 👁 **Eye-care breaks**: a break countdown reminds you to look into the distance, and you can skip at any time
- ⚙️ **Customizable**: work / break durations, window size, and overall scale — all with live preview
- 📊 **Daily stats**: breaks completed and total focus time for today
- 🔔 **Resident widget**: sits in the bottom-right corner of your screen and can minimize to the system tray
- 🔄 **Auto-update**: the installer version checks for updates automatically on launch

---

## Download & Install (for users)

Grab a build from the **[Releases page](https://github.com/frankkn/LookAway/releases/latest)** — pick one of the two flavors:

| Flavor | Filename | Notes |
|------|------|------|
| **Installer** (recommended) | `Look Away Setup x.x.x.exe` | Guided install, Start Menu shortcut, uninstallable, **and supports auto-update** |
| **Portable** | `Look Away x.x.x.exe` | Download and double-click to run — great for USB drives or trying it out (**no auto-update**) |

> ⚠️ **SmartScreen warning**: this app is not code-signed (no certificate purchased), so on first run Windows may show "Windows protected your PC".
> Click **"More info" → "Run anyway"**. This is normal for unsigned apps — it is not a virus.

### Auto-update (installer version only)

The installer version checks GitHub for a new release every time it starts:
- New version available → downloads in the background → shows a dialog when done, letting you choose "Restart & update now" or "Later".
- You can also check manually via **right-click on the tray icon → "Check for updates"**.

---

## Tech Stack

| Layer | Technology |
|------|------|
| Desktop shell | Electron |
| Frontend framework | React + Vite |
| Styling | Hand-written CSS (no UI library) |
| Packaging | electron-builder (NSIS installer + portable exe) |
| Platform | Windows only |

---

## Setup & Run

### Development mode

```powershell
npm install
npm run dev        # Vite dev server + Electron with hot reload
```

### Local build (no publishing)

```powershell
npm run build      # → release/ folder (installer + portable exe)
```

---

## Release Process (for maintainers)

Auto-update is powered by GitHub Releases.

### One-time setup

1. **Create a GitHub token**: GitHub → Settings → Developer settings → Personal access tokens →
   **Tokens (classic)** → Generate, check the `repo` scope, and copy the generated token (`ghp_…`).
2. **Set it as a persistent environment variable** (so you never have to enter it again):
   ```powershell
   [System.Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_your_token", "User")
   ```
   Restart PowerShell for it to take effect. ⚠️ Never put the token in code or commit it.

### Shipping a new version (four steps)

```powershell
# 1. Bump the version (critical! if it doesn't increase, users won't get the update)
npm version patch --no-git-tag-version      # e.g. 1.0.0 → 1.0.1

# 2. Verify the packaged build actually launches (dev working doesn't mean the package works —
#    a missing file once shipped a version that crashed on startup)
npm run dist
& ".\release\win-unpacked\Look Away.exe"    # confirm the window appears with no error dialogs

# 3. Build and upload to a *draft* Release
npm run release

# 4. Review the draft on GitHub Releases and hit Publish
```

> Only a formally **published** Release triggers user updates; drafts and pre-releases do not.

---

## Project Structure

```
src/
  main/
    index.js        # Main process: timer state machine, window management, Tray, IPC
    preload.js      # contextBridge secure bridge
  renderer/
    main.html / main.jsx          # Widget entry point
    reminder.html / reminder.jsx  # Reminder entry point
    components/
      Widget.jsx      # Main widget; switches between arc / badge / buttons by phase
      Reminder.jsx    # "Time for a break" dialog
      ArcProgress.jsx # Shared SVG arc progress indicator
    styles/
      widget.css / reminder.css
vite.config.mjs       # Multi-page build; base: './'
electron-builder.yml  # Windows nsis + portable
```

---

## License

MIT
