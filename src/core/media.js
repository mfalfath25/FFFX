import { env, ROOT, TAU } from './env.js';
import { buildTables } from './sat.js';
import { initMotionDemoState } from './motion-demo.js';
import { updateDrawerSources } from '../ui/menu.js';

export function setCanvasDimensions(sw, sh) {
  const scale = Math.min(960 / sw, 640 / sh, 1.5);
  env.W = Math.max(ROOT, Math.floor((sw * scale) / ROOT) * ROOT);
  env.H = Math.max(ROOT, Math.floor((sh * scale) / ROOT) * ROOT);
  if (env.canvas) {
    env.canvas.width = env.W;
    env.canvas.height = env.H;
  }
  env.sourceCanvas.width = env.W;
  env.sourceCanvas.height = env.H;
  env.cursor.x = env.cursor.targetX = env.W / 2;
  env.cursor.y = env.cursor.targetY = env.H / 2;
  if (env.resPill) {
    env.resPill.textContent = `${env.W}×${env.H}`;
  }
}

export function updateMirrorWebcamUI() {
  const mirrorWebcamBtn = document.getElementById('mirrorWebcamBtn');
  if (!mirrorWebcamBtn) return;
  mirrorWebcamBtn.classList.toggle('active', !!env.mirrorWebcam);
  mirrorWebcamBtn.setAttribute(
    'data-tooltip',
    env.mirrorWebcam
      ? 'Mirror Camera: ON (H or Click)'
      : 'Mirror Camera: OFF (H or Click)'
  );
}

export function toggleMirrorWebcam() {
  env.mirrorWebcam = !env.mirrorWebcam;
  updateMirrorWebcamUI();
}

export function updateWebcamUI(active) {
  env.isWebcam = active;
  const stopWebcamBtn = document.getElementById('stopWebcamBtn');
  const webcamBtn = document.getElementById('webcamBtn');
  if (stopWebcamBtn) {
    stopWebcamBtn.disabled = !active;
    stopWebcamBtn.classList.toggle('disabled', !active);
    stopWebcamBtn.classList.toggle('danger-active', active);
    stopWebcamBtn.setAttribute(
      'data-tooltip',
      active ? 'Stop Live Webcam' : 'Webcam Inactive'
    );
  }
  if (webcamBtn) {
    webcamBtn.classList.toggle('active', active);
  }
  updateMirrorWebcamUI();
}

export function stopActiveMedia() {
  if (env.sourceVideo) {
    env.sourceVideo.pause();
    if (env.sourceVideo.srcObject) {
      env.sourceVideo.srcObject.getTracks().forEach((t) => t.stop());
    }
    env.sourceVideo = null;
  }
  updateWebcamUI(false);
}

export function initMotionDemo() {
  stopActiveMedia();
  env.sourceType = 'demo';
  if (env.sourceBadge) env.sourceBadge.textContent = 'MOTION-DEMO';
  updateDrawerSources('motion-demo');
  setCanvasDimensions(960, 640);
  initMotionDemoState();
}

export function stopWebcam() {
  stopActiveMedia();
  initMotionDemo();
}

export function loadImageSource(img, label = 'IMAGE') {
  stopActiveMedia();
  env.sourceType = 'image';
  if (env.sourceBadge) env.sourceBadge.textContent = label;
  setCanvasDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height
  );
  env.sourceCtx.drawImage(img, 0, 0, env.W, env.H);
  buildTables(env.sourceCtx.getImageData(0, 0, env.W, env.H));
}

export function loadVideoElement(video, label = 'VIDEO') {
  stopActiveMedia();
  env.sourceVideo = video;
  env.sourceType = 'video';
  if (env.sourceBadge) env.sourceBadge.textContent = label;

  const onReady = () => {
    setCanvasDimensions(video.videoWidth || 960, video.videoHeight || 640);
  };
  if (video.readyState >= 2) onReady();
  else video.addEventListener('loadedmetadata', onReady, { once: true });
}

export function loadMediaFile(file) {
  if (!file) return;
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    loadVideoElement(video, 'VIDEO FILE');
    updateDrawerSources('');
  } else if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      loadImageSource(img, 'IMAGE FILE');
      URL.revokeObjectURL(url);
      updateDrawerSources('');
    };
    img.src = url;
  }
}

export async function loadWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 640 } },
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play();
    loadVideoElement(video, 'LIVE WEBCAM');
    updateWebcamUI(true);
    updateDrawerSources('');
  } catch (err) {
    alert('Could not access webcam: ' + err.message);
    updateWebcamUI(false);
  }
}

export function makePreset(name) {
  updateDrawerSources(name);
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 640;
  const p = c.getContext('2d');
  const w = 960,
    h = 640;

  if (name === 'sunset') {
    const sky = p.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#100c2a');
    sky.addColorStop(0.35, '#5c1d58');
    sky.addColorStop(0.65, '#db4d3f');
    sky.addColorStop(0.85, '#fca242');
    sky.addColorStop(1, '#fedd74');
    p.fillStyle = sky;
    p.fillRect(0, 0, w, h);
    const sun = p.createRadialGradient(
      w * 0.52,
      h * 0.62,
      10,
      w * 0.52,
      h * 0.62,
      140
    );
    sun.addColorStop(0, '#fffbe6');
    sun.addColorStop(0.4, '#ffd159');
    sun.addColorStop(1, 'transparent');
    p.fillStyle = sun;
    p.beginPath();
    p.arc(w * 0.52, h * 0.62, 140, 0, TAU);
    p.fill();
    const ridges = [
      ['#7a1f4b', 0.55, 25],
      ['#4a2a5c', 0.66, 40],
      ['#2c1a45', 0.76, 55],
      ['#150f2a', 0.88, 35],
    ];
    ridges.forEach(([col, base, amp], k) => {
      p.fillStyle = col;
      p.beginPath();
      p.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        p.lineTo(
          x,
          h * base +
            Math.sin(x * 0.012 + k * 2) * amp +
            Math.sin(x * 0.037 + k) * amp * 0.4
        );
      }
      p.lineTo(w, h);
      p.closePath();
      p.fill();
    });
    p.fillStyle = '#0b0818';
    for (let i = 0; i < 9; i++) {
      const x = 80 + i * 105,
        th = 60 + ((i * 37) % 50);
      p.beginPath();
      p.moveTo(x, h);
      p.lineTo(x + 18, h - th);
      p.lineTo(x + 36, h);
      p.fill();
    }
  }
  loadImageSource(c, `${name.toUpperCase()} PRESET`);
}

/**
 * Attaches UI event listeners for media controls
 */
export function initMediaControls() {
  // Drawer Sources Clicks
  document.querySelectorAll('#drawerSources .drawer-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-source');
      if (src === 'motion-demo') {
        initMotionDemo();
      } else {
        makePreset(src);
      }
    });
  });

  // Image Dropdown Menu Trigger
  const imageDropdownWrap = document.getElementById('imageDropdownWrap');
  const imageBtn = document.getElementById('imageBtn');
  if (imageBtn && imageDropdownWrap) {
    imageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      imageDropdownWrap.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!imageDropdownWrap.contains(e.target)) {
        imageDropdownWrap.classList.remove('open');
      }
    });
  }

  const fileInput = document.getElementById('file');
  document.querySelectorAll('#imageMenu .dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (imageDropdownWrap) imageDropdownWrap.classList.remove('open');
      const act = item.getAttribute('data-action');
      const preset = item.getAttribute('data-preset');
      if (act === 'open-file' && fileInput) {
        fileInput.click();
      } else if (preset) {
        makePreset(preset);
      }
    });
  });

  // Video Button
  const videoBtn = document.getElementById('videoBtn');
  if (videoBtn) {
    videoBtn.addEventListener('click', () => {
      initMotionDemo();
    });
  }

  // File upload drop card & input
  const dropCard = document.getElementById('dropCard');
  if (dropCard && fileInput) {
    dropCard.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) =>
      loadMediaFile(e.target.files[0])
    );
  }

  // Webcam & Stop Webcam & Mirror Webcam
  const webcamBtn = document.getElementById('webcamBtn');
  const stopWebcamBtn = document.getElementById('stopWebcamBtn');
  const mirrorWebcamBtn = document.getElementById('mirrorWebcamBtn');
  if (webcamBtn) webcamBtn.addEventListener('click', loadWebcam);
  if (stopWebcamBtn) stopWebcamBtn.addEventListener('click', stopWebcam);
  if (mirrorWebcamBtn) mirrorWebcamBtn.addEventListener('click', toggleMirrorWebcam);

  // Drag & drop handlers
  const stage = document.getElementById('stage');
  if (stage) {
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      stage.classList.add('dragging');
    });
    stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      stage.classList.remove('dragging');
      loadMediaFile(e.dataTransfer.files[0]);
    });
  }

  if (dropCard) {
    dropCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropCard.style.borderColor = 'var(--accent)';
    });
    dropCard.addEventListener('dragleave', () => {
      dropCard.style.borderColor = '';
    });
    dropCard.addEventListener('drop', (e) => {
      e.preventDefault();
      dropCard.style.borderColor = '';
      loadMediaFile(e.dataTransfer.files[0]);
    });
  }
}
