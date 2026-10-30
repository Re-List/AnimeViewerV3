# 🎬 Re:List (AnimeViewer)

<div align="center">

[https://raw.githubusercontent.com/Re-List/AnimeViewerV3/main/frontend/public/logo.png]

**A high-performance, ad-free desktop anime streaming and catalog player with seamless cloud synchronization.**

[[https://img.shields.io/badge/version-1.2.0-blue.svg?style=for-the-badge]](https://github.com/Re-List/AnimeViewerV3/releases)
[[https://img.shields.io/badge/platform-Windows%20x64-brightgreen.svg?style=for-the-badge]](https://github.com/Re-List/AnimeViewerV3/releases)
[[https://img.shields.io/badge/license-MIT-purple.svg?style=for-the-badge]](LICENSE)
[[https://img.shields.io/badge/React-19.0-61dafb.svg?style=for-the-badge&logo=react]](https://react.dev/)
[[https://img.shields.io/badge/Electron-Latest-47848F.svg?style=for-the-badge&logo=electron]](https://www.electronjs.org/)

[Features](#-key-features) • [Installation](#-installation) • [Architecture](#-architecture) • [Building from Source](#-building-from-source) • [Privacy](#-privacy--security)

</div>

---

## 🌟 Key Features

- **⭐ 1-Click MyAnimeList & AniList Sync**:
  - Direct 1-click OAuth PKCE connection for MyAnimeList without needing your own developer Client ID.
  - Automatic progress tracking when finishing episodes.
  - One-click full library import from MAL into your local Watch List.
  - On-demand Pause/Resume toggle for auto-sync.
- **📅 Weekly Simulcast Broadcast Schedule**:
  - Browse airing schedules by day of the week with real-time countdown clocks for upcoming releases.
- **⚡ Next-Episode Pre-Buffering**:
  - Hidden stream pre-caching ensures zero wait times when binge-watching series.
- **🔔 Unwatched Episode Badges**:
  - Dynamic navigation counter highlights when new episodes drop for titles in your Watch List.
- **🎨 Dynamic Theming Engine**:
  - 6 built-in presets: *Midnight Velvet*, *Cyber Neon*, *Crimson Eclipse*, *Emerald Abyss*, *Sakura Day*, and *Nordic Frost*.
  - Real-time custom 2-color gradient creator with persistent CSS variable styling.
- **🎮 Discord Rich Presence (RPC)**:
  - Dynamically broadcasts current anime title, episode number, and official poster artwork to your Discord profile.
- **🛡️ Built-in Ad-Shield**:
  - Electron window filters intercept and kill 100% of third-party streaming iframe ad redirects and popunders.
- **🔒 100% Offline Database**:
  - Stores your history, favorites, and settings locally in SQLite (`%APPDATA%`). No external telemetry, tracking, or account lock-in.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Wrapper** | Electron, Electron Builder, Electron Updater, Discord-RPC |
| **Frontend UI** | React 19, Vite, React Router v7, Lucide Icons, Vanilla CSS Variables |
| **Local Server** | Express 5, SQLite3 / SQLite, Axios, CORS, Path-to-Regexp v8 |
| **Metadata Sources** | AniList GraphQL API, MyAnimeList v2 REST API |

---

## 📦 Installation

1. Navigate to the [Latest Releases](https://github.com/Re-List/AnimeViewerV3/releases) page.
2. Download **`ReList-Setup-1.2.0.exe`**.
3. Run the installer, select your install destination, and launch Re:List.
4. Auto-updates will notify and install automatically on future releases.

---

## 🛠️ Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20 LTS recommended)
- Git

### Setup & Run
```bash
# 1. Clone the repository
git clone [https://github.com/Re-List/AnimeViewerV3.git](https://github.com/Re-List/AnimeViewerV3.git)
cd AnimeViewerV3

# 2. Install root dependencies
npm install

# 3. Build the React frontend
npm run build:frontend

# 4. Launch in development mode
npm start