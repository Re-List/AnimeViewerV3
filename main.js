// main.js
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let rpc = null;

// 1. Launch backend server in the background
require(path.join(__dirname, "backend/server.js"));

// 2. Initialize Discord Rich Presence (RPC)
function initDiscordRPC() {
  try {
    const DiscordRPC = require("discord-rpc");
    // Keep your numerical Application ID from Discord Developer Portal here
    const CLIENT_ID = "1565774295349854278"; 
    
    rpc = new DiscordRPC.Client({ transport: "ipc" });

    rpc.on("ready", () => {
      console.log("Discord Rich Presence connected successfully.");
      setMenuPresence();
    });

    rpc.login({ clientId: CLIENT_ID }).catch((err) => {
      console.warn("Discord RPC login skipped (Discord desktop app not active):", err.message);
      rpc = null;
    });
  } catch (err) {
    console.warn("discord-rpc module unavailable:", err.message);
  }
}

function setMenuPresence() {
  if (!rpc) return;
  rpc.setActivity({
    details: "Browsing Anime",
    state: "In Menus",
    largeImageKey: "logo",
    largeImageText: "Re:List Anime Player",
    instance: false,
  }).catch(() => {});
}

// 3. Create Main Desktop Window
function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    title: "Re:List",
    fullscreen: true,
    backgroundColor: "#0a0a0a",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, "logo.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
    },
  });

  mainWindow.maximize();
  mainWindow.setFullScreen(true);
  mainWindow.setTitle("Re:List");

  // ========================================================
  // POPUP & AD-HIJACK BLOCKER
  // ========================================================

  // A. Intercept popups: Allow AniList, Discord, and GitHub in system browser; block all ads
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("https://github.com/") ||
      url.startsWith("https://discord.") ||
      url.startsWith("https://anilist.co/") ||
      url.startsWith("https://myanimelist.net/")
    ) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    // Block all other ad popups and redirects completely
    return { action: "deny" };
  });

  // B. Prevent shady video embeds from redirecting the main app window
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("http://localhost:5000")) {
      event.preventDefault();
    }
  });

  // Connect to backend port 5000 when ready
  function connectWhenReady() {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      mainWindow.loadURL("http://localhost:5000");
    });
    socket.on("error", () => {
      socket.destroy();
      setTimeout(connectWhenReady, 250);
    });
    socket.on("timeout", () => {
      socket.destroy();
      setTimeout(connectWhenReady, 250);
    });
    socket.connect(5000, "127.0.0.1");
  }

  connectWhenReady();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Global guard: Deny popups from any child iframes created inside the player
app.on("web-contents-created", (event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});

// 4. App Lifecycle & Auto-Updater
app.whenReady().then(() => {
  createWindow();
  initDiscordRPC();

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "A new version of Re:List has been downloaded. Restart now to apply?",
        buttons: ["Restart and Update", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });
});

app.on("window-all-closed", () => {
  if (rpc) {
    rpc.destroy().catch(() => {});
  }
  if (process.platform !== "darwin") app.quit();
});

// 5. IPC Handlers
ipcMain.on("set-discord-status", (event, { title, episode, image }) => {
  if (!rpc) return;
  rpc.setActivity({
    details: `Watching ${title}`,
    state: `Episode ${episode}`,
    startTimestamp: new Date(),
    largeImageKey: (image && image.startsWith("http")) ? image : "logo",
    largeImageText: title,
    smallImageKey: "logo",
    smallImageText: "Re:List",
    instance: false,
  }).catch(() => {});
});

ipcMain.on("clear-discord-status", () => {
  setMenuPresence();
});

// Safely open external authentication and documentation links in default browser
ipcMain.on("open-external", (event, url) => {
  if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
    shell.openExternal(url);
  }
});