'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoWallpaper', {
  chooseVideo: () => ipcRenderer.invoke('video:choose'),
  applyLast: () => ipcRenderer.invoke('wallpaper:apply-last'),
  togglePlayback: () => ipcRenderer.invoke('wallpaper:toggle'),
  toggleMute: () => ipcRenderer.invoke('wallpaper:mute'),
  stop: () => ipcRenderer.invoke('wallpaper:stop'),
  getState: () => ipcRenderer.invoke('app:get-state'),
  onStatus: callback => ipcRenderer.on('app:status', (_event, state) => callback(state)),
  onWallpaperLoad: callback => ipcRenderer.on('wallpaper:load', (_event, data) => callback(data)),
  onPause: callback => ipcRenderer.on('wallpaper:pause', (_event, paused) => callback(paused)),
  onMute: callback => ipcRenderer.on('wallpaper:mute', (_event, muted) => callback(muted)),
  onAttached: callback => ipcRenderer.on('wallpaper:attached', () => callback())
});
