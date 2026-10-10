# Video Wallpaper for Windows 11

A Node.js + Electron desktop utility that attempts to show a looping video behind desktop icons. The app has a controller window, remembers the last selected video, and builds into a Windows NSIS installer with Start menu and desktop shortcuts.

## Requirements

- Windows 11 (64-bit)
- Node.js LTS (includes npm)
- Internet access during the first dependency installation

## Run from source

1. Extract this project folder.
2. Open Command Prompt in the project folder.
3. Run:

   ```bat
   npm install
   npm start
   ```

4. In the Video Wallpaper control window, choose an MP4 (H.264 is recommended).
5. The app creates a desktop video window and asks Windows PowerShell to attach it to the desktop's WorkerW layer.

## Build the Windows installer

Run these commands in the project folder:

```bat
npm install
npm run dist
```

The installer is written to `dist\Video-Wallpaper-Setup-1.0.0.exe`. Run it to install the app. The installer creates Start menu and desktop shortcuts.

## Features

- Select a local video file
- Loop playback
- Pause/resume playback
- Mute/unmute audio
- Stop the wallpaper
- Remember the selected video and mute preference between runs
- Windows installer with Start menu and desktop shortcuts

## Notes and limitations

- Windows does not provide a supported public API for animated desktop wallpapers. The PowerShell helper uses the undocumented Explorer `WorkerW` technique; Windows updates, Explorer restarts, virtual desktops, and some shell configurations can affect it.
- This version targets the primary display. Multi-monitor support is not implemented.
- The video window is intended to sit behind desktop icons. If the desktop integration fails, the app reports an error rather than claiming it succeeded.
- Use a common MP4/H.264 video for best playback compatibility. Other codecs depend on the media support available in the installed Electron runtime.
- This project does not automatically add itself to Windows startup. That can be added after confirming it behaves correctly on the target PC.
- Electron and its dependencies must be downloaded by `npm install`; no prebuilt installer is included in this source archive.

## Troubleshooting

- If the helper cannot attach, close and reopen the app. If Explorer has recently restarted, restarting Explorer or signing out and back in may restore the expected desktop window arrangement.
- If a video has sound, use **Mute audio** in the controller.
- If video playback fails, try a local H.264 MP4.

## Security

The renderer uses `contextIsolation`, `sandbox`, and `nodeIntegration: false`. File selection and Windows integration are handled by the main process and the bundled PowerShell helper.
