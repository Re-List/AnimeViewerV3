// main.js
const { app, BrowserWindow, dialog, ipcMain, shell, webFrameMain } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let rpc = null;

// ========================================================
// PLAYER KEYBOARD: ">" AFTER THE EPISODE ENDS -> NEXT EPISODE
// ========================================================
// Playback lives in a cross-origin embed, so its key presses never reach the
// React app. Instead the main process injects a tiny bridge into the player
// frame that reports when that frame's <video> finished, and before-input-event
// turns the next ">" into a next-episode request. Every other key (including
// ">" during normal playback) is left to the embed's own player.
let playerEnded = false;

const PLAYER_ENDED_BRIDGE = [
  "(function () {",
  "  if (window.__relistEndedBridge) return;",
  "  window.__relistEndedBridge = true;",
  "  var last = null;",
  "  function report(ended) {",
  "    if (last === ended) return;",
  "    last = ended;",
  "    try { window.top.postMessage({ __relist: 'player-ended', ended: ended }, '*'); } catch (e) {}",
  "  }",
  "  function attach() {",
  "    var videos = document.querySelectorAll('video');",
  "    for (var i = 0; i < videos.length; i++) {",
  "      var video = videos[i];",
  "      if (video.__relistEndedHooked) continue;",
  "      video.__relistEndedHooked = true;",
  "      video.addEventListener('ended', function () {",
  "        // Only full episodes count; short ads/promos inside the embed do not.",
  "        if ((this.duration || 0) > 300) report(true);",
  "      });",
  "      video.addEventListener('timeupdate', function () {",
  "        var duration = this.duration || 0;",
  "        // Rewatching from early on clears the flag again; the few seconds of",
  "        // the ending replayed by the old '>' behaviour does not.",
  "        if (duration > 300 && this.currentTime > 180 && this.currentTime < duration - 60) report(false);",
  "      });",
  "    }",
  "  }",
  "  attach();",
  "  try { new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}",
  "})();",
].join("\n");

// ========================================================
// EMBED FRAME UNBLOCKER (player iframe)
// ========================================================
// A few hosts (Flixera and NontonGo in particular) answer with X-Frame-Options
// or a CSP frame-ancestors rule, which Chromium turns into
// ERR_BLOCKED_BY_RESPONSE inside the player iframe. This is our own fullscreen
// window, not a tab on somebody else's page, so drop just those two frame
// blockers, and only for the embed hosts the player knows about.
const EMBED_HOSTS = [
  "megaplay.buzz",
  "megavid.buzz",
  "anixo.buzz",
  "vidhawk.buzz",
  "flixera.co",
  "tryembed.us.cc",
  "cinextream.cc",
  "aniembed.se",
  "nontongo.win",
  "ani.pm",
];

function isEmbedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return EMBED_HOSTS.some((domain) => host === domain || host.endsWith("." + domain));
}

function withoutFrameBlockers(responseHeaders) {
  const cleaned = {};
  for (const key of Object.keys(responseHeaders || {})) {
    const name = key.toLowerCase();
    // Framing is decided by these two headers alone; everything else is kept.
    if (name === "x-frame-options") continue;
    if (name === "content-security-policy") {
      const directives = []
        .concat(responseHeaders[key])
        .join(";")
        .split(";")
        .map((directive) => directive.trim())
        .filter((directive) => directive && !/^frame-ancestors(\s|$)/i.test(directive));
      if (directives.length === 0) continue;
      cleaned[key] = [directives.join("; ")];
      continue;
    }
    cleaned[key] = responseHeaders[key];
  }
  return cleaned;
}

function allowEmbedFrames(session) {
  session.webRequest.onHeadersReceived((details, callback) => {
    let hostname = "";
    try {
      hostname = new URL(details.url).hostname;
    } catch (err) {
      hostname = "";
    }
    if (!isEmbedHost(hostname)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({ responseHeaders: withoutFrameBlockers(details.responseHeaders) });
  });
}

// 1. Launch backend server in the background
require(path.join(__dirname, "backend/server.js"));

// 2. Initialize Discord Rich Presence (RPC)
function initDiscordRPC() {
  try {
    const DiscordRPC = require("discord-rpc");
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

  // Let the known embed hosts load inside the player iframe.
  allowEmbedFrames(mainWindow.webContents.session);

  // ========================================================
  // POPUP & AD-HIJACK BLOCKER
  // ========================================================

  // A. Intercept popups: Allow AniList, Discord, GitHub, and MAL in system browser; block all ads
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("https://github.com/") ||
      url.startsWith("https://discord.") ||
      url.startsWith("https://anilist.co/") ||
      url.startsWith("https://myanimelist.net/") ||
      url.includes("/auth/mal/login")
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

  // C. Hook every player (sub)frame so the bridge lands in the page that owns
  // the <video>, then use ">" for next-episode once that video has ended.
  mainWindow.webContents.on("did-frame-finish-load", (event, isMainFrame, frameProcessId, frameRoutingId) => {
    const frame =
      event?.frame ||
      (frameProcessId != null ? webFrameMain.fromId(frameProcessId, frameRoutingId) : null);
    if (!frame || !mainWindow || frame === mainWindow.webContents.mainFrame) return;
    const url = frame.url || "";
    if (!/^https?:\/\//i.test(url) || url.startsWith("http://localhost:5000")) return;
    frame.executeJavaScript(PLAYER_ENDED_BRIDGE, false).catch(() => {});
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!playerEnded || input.type !== "keyDown") return;
    if (input.key !== "ArrowRight" || input.shift || input.control || input.alt || input.meta) return;
    event.preventDefault();
    playerEnded = false;
    mainWindow.webContents.send("next-episode");
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

// The injected player bridge reports when the current episode finished.
ipcMain.on("player-ended", (event, ended) => {
  playerEnded = !!ended;
});

// Safely open external authentication and documentation links in default browser
ipcMain.on("open-external", (event, url) => {
  if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
    shell.openExternal(url);
  }
});