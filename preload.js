// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setDiscordStatus: (title, episode, image) => {
    ipcRenderer.send("set-discord-status", { title, episode, image });
  },
  clearDiscordStatus: () => {
    ipcRenderer.send("clear-discord-status");
  },
  openExternal: (url) => {
    ipcRenderer.send("open-external", url);
  },
});