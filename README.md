<p align="center">
  <img src="logo.png" width="120" alt="Re:List Logo" style="border-radius: 20px;"/>
</p>

<h1 align="center">𝕽𝖊:𝕷𝖎𝖘𝖙</h1>

<p align="center">
  <strong>A standalone Windows desktop anime tracker, player, and catalog manager.</strong><br>
  Built with Electron, React, Vite, Express, and SQLite.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-blue?logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-Electron-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Database-SQLite%20(Local)-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Auto--Updates-Enabled-brightgreen" alt="Auto-Updates" />
</p>

---

## ✨ Features

- **Dedicated Desktop App**: Runs in its own clean desktop window with custom dark mode branding (no browser tabs or command-line consoles needed).
- **Zero Dependencies for Users**: Packages Node.js, Chromium, and all backend dependencies into a single standalone `.exe` installer. Other PCs don't need anything pre-installed.
- **100% Local Privacy**: All watch history, watchlist categories, and settings are saved to a local SQLite database in `%APPDATA%`. No tracking, no harvesting, and no remote data storage.
- **Automated Background Updates**: Powered by `electron-updater` and GitHub Releases. Clients automatically detect, download, and apply bug fixes and new features with a single click.
- **Advanced Player Experience**:
  - Seamless episode resume (`?t=`) and continue-watching tracking.
  - Multi-source player fallback with theater mode and audio language preferences (SUB / DUB).
  - Configurable auto-next episode countdown banner.
- **Watchlist Organization**: Custom categories (*Watching*, *Completed*, *On-Hold*, *Dropped*, *Plan to Watch*) with quick status filters and search bar integration.
- **MyAnimeList (MAL) Backup**: One-click XML export and import tools to keep your catalog synced with MAL.
- **Built-in Support Channel**: In-app feedback and query tile connected directly to `support.relist@gmail.com`.

---

## 📥 Download & Installation (For Users)

1. Head over to the **[Releases](https://github.com/Re-List/AnimeViewerV3/releases)** page.
2. Download the latest installer: **`ReList Setup X.X.X.exe`**.
3. Run the installer:
   - Review and accept the Terms & Conditions.
   - Choose your preferred installation directory.
   - Shortcuts are automatically added to your Desktop and Windows Start Menu.
4. Launch **Re:List** from your desktop or app list.

---

## 🛠️ Development & Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ or v22+)
- Git

### 1. Clone & Install Dependencies
```bash
git clone [https://github.com/Re-List/AnimeViewerV3.git](https://github.com/Re-List/AnimeViewerV3.git)
cd AnimeViewerV3

# Install root dependencies (Electron, backend tools, electron-updater)
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..