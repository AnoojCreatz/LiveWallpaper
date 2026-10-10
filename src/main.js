'use strict';

const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let controlWindow = null;
let wallpaperWindow = null;
let currentVideoPath = '';
let muted = true;
let isPaused = false;
let attachInProgress = false;

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const wallpaperPage = () => path.join(__dirname, 'wallpaper.html');
const helperPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'desktop-wallpaper.ps1')
  : path.join(__dirname, 'desktop-wallpaper.ps1');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify({ videoPath: currentVideoPath, muted }, null, 2));
  } catch (error) {
    console.error('Could not save settings:', error);
  }
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 560,
    height: 510,
    minWidth: 500,
    minHeight: 450,
    title: 'Video Wallpaper',
    backgroundColor: '#10141d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  controlWindow.loadFile(path.join(__dirname, 'index.html'));
  controlWindow.on('closed', () => { controlWindow = null; });
}

function createWallpaperWindow() {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) return wallpaperWindow;

  const bounds = screen.getPrimaryDisplay().bounds;
  wallpaperWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    show: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  wallpaperWindow.loadFile(wallpaperPage());
  wallpaperWindow.on('closed', () => { wallpaperWindow = null; });
  return wallpaperWindow;
}

function attachToDesktop() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed() || attachInProgress) return;
  attachInProgress = true;

  const bounds = screen.getPrimaryDisplay().bounds;
  const handle = wallpaperWindow.getNativeWindowHandle();
  const hwnd = handle.length >= 8
    ? Number(handle.readBigUInt64LE(0)).toString(10)
    : handle.readUInt32LE(0).toString(10);

  const child = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', helperPath(),
    '-WindowHandle', hwnd,
    '-Width', String(bounds.width),
    '-Height', String(bounds.height)
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('error', error => {
    attachInProgress = false;
    reportError('Could not start the Windows desktop helper. Make sure Windows PowerShell is available.\n\n' + error.message);
  });
  child.on('close', code => {
    attachInProgress = false;
    if (code !== 0) {
      reportError('Windows could not attach the video to the desktop.\n\n' + (stderr || stdout || `Helper exited with code ${code}`));
      return;
    }
    wallpaperWindow.webContents.send('wallpaper:attached');
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('app:status', { running: true, videoPath: currentVideoPath, muted, paused: isPaused });
    }
  });
}

function reportError(message) {
  console.error(message);
  if (controlWindow && !controlWindow.isDestroyed()) {
    dialog.showMessageBox(controlWindow, {
      type: 'error',
      title: 'Video Wallpaper',
      message: 'Could not set the video wallpaper',
      detail: message
    });
  }
}

async function setVideo(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) throw new Error('The selected video file could not be found.');
  currentVideoPath = videoPath;
  isPaused = false;
  writeSettings();

  const win = createWallpaperWindow();
  if (win.webContents.isLoading()) {
    await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
  }
  win.webContents.send('wallpaper:load', { videoPath, muted });
  if (!win.isVisible()) win.showInactive();
  attachToDesktop();
  return { ok: true, videoPath };
}

app.whenReady().then(() => {
  const settings = readSettings();
  currentVideoPath = settings.videoPath && fs.existsSync(settings.videoPath) ? settings.videoPath : '';
  muted = settings.muted !== false;
  createControlWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

ipcMain.handle('video:choose', async () => {
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Choose a video wallpaper',
    properties: ['openFile'],
    filters: [{ name: 'Video files', extensions: ['mp4', 'webm', 'm4v', 'mov', 'avi', 'mkv'] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return setVideo(result.filePaths[0]);
});

ipcMain.handle('wallpaper:apply-last', async () => {
  if (!currentVideoPath || !fs.existsSync(currentVideoPath)) {
    return { ok: false, message: 'Choose a video file first.' };
  }
  return setVideo(currentVideoPath);
});

ipcMain.handle('wallpaper:toggle', () => {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return { ok: false, message: 'No wallpaper is running.' };
  isPaused = !isPaused;
  wallpaperWindow.webContents.send('wallpaper:pause', isPaused);
  writeSettings();
  return { ok: true, paused: isPaused };
});

ipcMain.handle('wallpaper:mute', () => {
  muted = !muted;
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) wallpaperWindow.webContents.send('wallpaper:mute', muted);
  writeSettings();
  return { ok: true, muted };
});

ipcMain.handle('wallpaper:stop', () => {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    wallpaperWindow.close();
    wallpaperWindow = null;
  }
  isPaused = false;
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('app:status', { running: false, videoPath: currentVideoPath, muted, paused: false });
  }
  return { ok: true };
});

ipcMain.handle('app:get-state', () => ({
  videoPath: currentVideoPath,
  muted,
  paused: isPaused,
  running: !!(wallpaperWindow && !wallpaperWindow.isDestroyed() && wallpaperWindow.isVisible())
}));

app.on('before-quit', () => {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) wallpaperWindow.close();
});
