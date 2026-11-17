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
  // Tells the main process whether the current episode has finished, so ">"
  // can advance instead of the embed replaying the same episode.
  setPlayerEnded: (ended) => {
    ipcRenderer.send("player-ended", !!ended);
  },
  onNextEpisode: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("next-episode", handler);
    return () => ipcRenderer.removeListener("next-episode", handler);
  },
});