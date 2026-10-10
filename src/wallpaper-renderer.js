'use strict';

const video = document.getElementById('wallpaperVideo');
let activeObjectUrl = null;

window.videoWallpaper.onWallpaperLoad(async ({ videoPath, muted }) => {
  try {
    // Local video files are loaded by converting the path to a file URL.
    video.src = pathToFileURL(videoPath);
    video.muted = muted;
    video.loop = true;
    await video.play();
  } catch (error) {
    console.error('Video playback failed:', error);
  }
});

window.videoWallpaper.onPause(paused => {
  if (paused) video.pause();
  else video.play().catch(console.error);
});

window.videoWallpaper.onMute(muted => { video.muted = muted; });

function pathToFileURL(filePath) {
  // Convert a Windows path to a valid file:/// URL without requiring Node access in the page.
  const normalized = filePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:');
  return 'file:///' + normalized.split('/').map((part, index) => {
    if (index === 0 && /^[A-Za-z]:$/.test(part)) return part;
    return encodeURIComponent(part).replace(/%3A/gi, ':');
  }).join('/');
}
