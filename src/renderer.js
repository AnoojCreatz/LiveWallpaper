'use strict';

const api = window.videoWallpaper;
const fileName = document.getElementById('fileName');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const message = document.getElementById('message');
const muteButton = document.getElementById('mute');
const playPauseButton = document.getElementById('playPause');

let state = { videoPath: '', muted: true, paused: false, running: false };

function render(next) {
  state = { ...state, ...next };
  fileName.textContent = state.videoPath || 'No video selected yet.';
  dot.classList.toggle('on', !!state.running);
  statusText.textContent = state.running
    ? (state.paused ? 'Wallpaper is paused' : 'Wallpaper is running')
    : 'Wallpaper is stopped';
  muteButton.textContent = state.muted ? 'Unmute audio' : 'Mute audio';
  playPauseButton.textContent = state.paused ? 'Resume playback' : 'Pause playback';
}

function showMessage(text = '') { message.textContent = text; }

document.getElementById('choose').addEventListener('click', async () => {
  showMessage('');
  try {
    const result = await api.chooseVideo();
    if (result?.canceled) return;
    if (result?.ok) render({ videoPath: result.videoPath, running: true, paused: false });
  } catch (error) {
    showMessage(error.message || 'Could not open the selected video.');
  }
});

document.getElementById('apply').addEventListener('click', async () => {
  showMessage('');
  try {
    const result = await api.applyLast();
    if (result?.ok) render({ videoPath: result.videoPath, running: true, paused: false });
    else showMessage(result?.message || 'Choose a video first.');
  } catch (error) { showMessage(error.message || 'Could not apply the video.'); }
});

document.getElementById('playPause').addEventListener('click', async () => {
  showMessage('');
  const result = await api.togglePlayback();
  if (!result.ok) showMessage(result.message);
  else render({ paused: result.paused });
});

document.getElementById('mute').addEventListener('click', async () => {
  const result = await api.toggleMute();
  render({ muted: result.muted });
});

document.getElementById('stop').addEventListener('click', async () => {
  await api.stop();
  render({ running: false, paused: false });
  showMessage('Wallpaper stopped. Your selected video is saved.');
});

api.onStatus(render);
api.getState().then(render).catch(() => {});
