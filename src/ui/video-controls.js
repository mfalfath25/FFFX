/**
 * Video Playback Controls Controller
 * Manages the bottom playback controls toolbar for video file inputs.
 */
import { env } from '../core/env.js';

const PLAY_SVG = `
  <svg class="lucide lucide-play" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
`;

const PAUSE_SVG = `
  <svg class="lucide lucide-pause" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="4" height="16" x="6" y="4"/>
    <rect width="4" height="16" x="14" y="4"/>
  </svg>
`;

const VOLUME_HIGH_SVG = `
  <svg class="lucide lucide-volume-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
`;

const VOLUME_LOW_SVG = `
  <svg class="lucide lucide-volume-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
`;

const VOLUME_MUTE_SVG = `
  <svg class="lucide lucide-volume-x" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="22" x2="16" y1="9" y2="15"/>
    <line x1="16" x2="22" y1="9" y2="15"/>
  </svg>
`;

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function initVideoControls() {
  const bar = document.getElementById('videoPlaybackBar');
  if (!bar) return;

  const playPauseBtn = document.getElementById('videoPlayPauseBtn');
  const speedSlider = document.getElementById('videoSpeedSlider');
  const speedVal = document.getElementById('videoSpeedVal');
  const volumeSlider = document.getElementById('videoVolumeSlider');
  const volumeVal = document.getElementById('videoVolumeVal');
  const volumeMuteBtn = document.getElementById('videoMuteBtn');
  const seekSlider = document.getElementById('videoSeekSlider');
  const timeCurrent = document.getElementById('videoTimeCurrent');
  const timeTotal = document.getElementById('videoTimeTotal');

  let activeVideo = null;
  let isUserSeeking = false;
  let savedVolume = 1;

  function updatePlayStateUI(isPlaying) {
    if (!playPauseBtn) return;
    if (isPlaying) {
      playPauseBtn.innerHTML = PAUSE_SVG;
      playPauseBtn.setAttribute('data-tooltip', 'Pause (Space)');
      playPauseBtn.setAttribute('aria-label', 'Pause Video');
    } else {
      playPauseBtn.innerHTML = PLAY_SVG;
      playPauseBtn.setAttribute('data-tooltip', 'Play (Space)');
      playPauseBtn.setAttribute('aria-label', 'Play Video');
    }
  }

  function updateVolumeUI(volume, muted) {
    const isMuted = muted || volume === 0;
    if (volumeSlider) {
      volumeSlider.value = isMuted ? 0 : volume;
    }
    if (volumeVal) {
      volumeVal.textContent = isMuted ? 'MUTE' : `${Math.round(volume * 100)}%`;
    }
    if (volumeMuteBtn) {
      if (isMuted) {
        volumeMuteBtn.innerHTML = VOLUME_MUTE_SVG;
        volumeMuteBtn.setAttribute('data-tooltip', 'Unmute');
        volumeMuteBtn.classList.add('muted');
      } else if (volume < 0.5) {
        volumeMuteBtn.innerHTML = VOLUME_LOW_SVG;
        volumeMuteBtn.setAttribute('data-tooltip', 'Mute');
        volumeMuteBtn.classList.remove('muted');
      } else {
        volumeMuteBtn.innerHTML = VOLUME_HIGH_SVG;
        volumeMuteBtn.setAttribute('data-tooltip', 'Mute');
        volumeMuteBtn.classList.remove('muted');
      }
    }
  }

  function updateSpeedUI(rate) {
    if (speedSlider) speedSlider.value = rate;
    if (speedVal) speedVal.textContent = `${Number(rate).toFixed(2)}x`;
  }

  function updateProgressUI() {
    if (!activeVideo || isUserSeeking) return;
    const cur = activeVideo.currentTime || 0;
    const dur = activeVideo.duration || 0;
    if (timeCurrent) timeCurrent.textContent = formatTime(cur);
    if (timeTotal) timeTotal.textContent = formatTime(dur);
    if (seekSlider && dur > 0) {
      seekSlider.value = (cur / dur) * 1000;
    }
  }

  function togglePlayPause() {
    if (!activeVideo) return;
    if (activeVideo.paused) {
      activeVideo.play().catch(() => {});
    } else {
      activeVideo.pause();
    }
  }

  function toggleMute() {
    if (!activeVideo) return;
    if (activeVideo.muted || activeVideo.volume === 0) {
      activeVideo.muted = false;
      activeVideo.volume = savedVolume > 0 ? savedVolume : 1;
    } else {
      savedVolume = activeVideo.volume;
      activeVideo.muted = true;
    }
    updateVolumeUI(activeVideo.volume, activeVideo.muted);
  }

  // Play / Pause Click
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', togglePlayPause);
  }

  // Speed Slider
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (activeVideo) {
        activeVideo.playbackRate = val;
      }
      updateSpeedUI(val);
    });
  }

  // Volume Slider
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (activeVideo) {
        activeVideo.muted = val === 0;
        activeVideo.volume = val;
        savedVolume = val > 0 ? val : savedVolume;
      }
      updateVolumeUI(val, val === 0);
    });
  }

  // Mute Button Click
  if (volumeMuteBtn) {
    volumeMuteBtn.addEventListener('click', toggleMute);
  }

  // Seek Slider
  if (seekSlider) {
    seekSlider.addEventListener('mousedown', () => {
      isUserSeeking = true;
    });
    seekSlider.addEventListener('touchstart', () => {
      isUserSeeking = true;
    });
    seekSlider.addEventListener('input', (e) => {
      if (!activeVideo || !activeVideo.duration) return;
      const progress = parseFloat(e.target.value) / 1000;
      const targetTime = progress * activeVideo.duration;
      if (timeCurrent) timeCurrent.textContent = formatTime(targetTime);
    });
    const finishSeek = (e) => {
      if (!isUserSeeking) return;
      isUserSeeking = false;
      if (activeVideo && activeVideo.duration) {
        const progress = parseFloat(seekSlider.value) / 1000;
        activeVideo.currentTime = progress * activeVideo.duration;
      }
    };
    seekSlider.addEventListener('mouseup', finishSeek);
    seekSlider.addEventListener('touchend', finishSeek);
    seekSlider.addEventListener('change', finishSeek);
  }

  // Keyboard shortcut Space for play/pause when video is active
  window.addEventListener('keydown', (e) => {
    if (
      !activeVideo ||
      bar.classList.contains('hidden') ||
      env.sourceType !== 'video' ||
      env.isWebcam
    ) {
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    }
  });

  // Event handlers attached to the active video instance
  function handlePlay() {
    updatePlayStateUI(true);
  }
  function handlePause() {
    updatePlayStateUI(false);
  }
  function handleTimeUpdate() {
    updateProgressUI();
  }
  function handleDurationChange() {
    updateProgressUI();
  }
  function handleRateChange() {
    if (activeVideo) updateSpeedUI(activeVideo.playbackRate);
  }
  function handleVolumeChange() {
    if (activeVideo) updateVolumeUI(activeVideo.volume, activeVideo.muted);
  }

  function detachVideoListeners(video) {
    if (!video) return;
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('durationchange', handleDurationChange);
    video.removeEventListener('loadedmetadata', handleDurationChange);
    video.removeEventListener('ratechange', handleRateChange);
    video.removeEventListener('volumechange', handleVolumeChange);
  }

  function attachVideoListeners(video) {
    if (!video) return;
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('volumechange', handleVolumeChange);
  }

  return {
    show(video) {
      if (activeVideo && activeVideo !== video) {
        detachVideoListeners(activeVideo);
      }
      activeVideo = video;
      attachVideoListeners(activeVideo);

      bar.classList.remove('hidden');
      updatePlayStateUI(!video.paused);
      updateSpeedUI(video.playbackRate || 1);
      updateVolumeUI(video.volume, video.muted);
      updateProgressUI();
    },

    hide() {
      if (activeVideo) {
        detachVideoListeners(activeVideo);
      }
      activeVideo = null;
      bar.classList.add('hidden');
    },

    updateFrame() {
      if (activeVideo && !isUserSeeking) {
        updateProgressUI();
      }
    },
  };
}
