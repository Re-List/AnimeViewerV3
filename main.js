const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const net = require("net");
const { autoUpdater } = require("electron-updater");

let mainWindow;

// 1. Launch the backend server
require(path.join(__dirname, "backend/server.js"));

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Re:List",
	fullscreen: true,
    backgroundColor: "#0a0a0a", // Prevents the white screen flash
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, "logo.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Ensure window title remains Re:List
  mainWindow.setTitle("Re:List");

  // Wait until backend port 5000 is open before loading
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

app.whenReady().then(() => {
  createWindow();

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
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
  if (process.platform !== "darwin") app.quit();
});