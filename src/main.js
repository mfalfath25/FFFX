/**
 * FFFX Vision & Shader Studio Bootstrap
 */
import './styles/main.css';

import { env, initEnv } from './core/env.js';
import { buildTables } from './core/sat.js';
import { updateAndDrawMotionDemo } from './core/motion-demo.js';
import {
  initMotionDemo,
  initMediaControls,
  toggleMirrorWebcam,
  setVideoController,
} from './core/media.js';
import { initVideoControls } from './ui/video-controls.js';
import { initMenu } from './ui/menu.js';
import { PanelRenderer } from './ui/renderers/panel-renderer.js';
import { initStageTools } from './ui/stage-tools.js';
import { effects } from './effects/index.js';
import { globalParameterStore } from './ui/headless/store.js';

// 1. DOM Elements
const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const statsEl = document.getElementById('stats');
const sourceBadge = document.getElementById('sourceBadge');
const effectPill = document.getElementById('effectPill');
const resPill = document.getElementById('resPill');
const menuEl = document.getElementById('menu');
const panelEl = document.getElementById('panel');
const fileInput = document.getElementById('file');

// 2. Initialize Core Environment
initEnv({
  canvas,
  stage,
  statsEl,
  sourceBadge,
  effectPill,
  resPill,
});

// 3. Initialize Parameter Store with Effect Defaults
const initialDefaults = {};
effects.forEach((effect) => {
  const defaults = {};
  const grps = effect.getGroups
    ? effect.getGroups({})
    : effect.groups || [];
  grps.forEach((g) =>
    g.controls.forEach((c) => {
      defaults[c.key] = c.value !== undefined ? c.value : null;
    })
  );
  initialDefaults[effect.id] = { ...defaults };
  globalParameterStore.initEffect(effect.id, defaults);
});

// 4. Active Effect State & UI
let activeEffect = effects[0];

const panelRenderer = new PanelRenderer(panelEl);

function setActiveEffect(effect) {
  activeEffect = effect;
  menuController.render(effects, activeEffect);
  panelRenderer.render(activeEffect);
}

function resetAllSettings() {
  effects.forEach((effect) => {
    const defaults = initialDefaults[effect.id] || {};
    globalParameterStore.values[effect.id] = { ...defaults };
    const grps = effect.getGroups
      ? effect.getGroups(defaults)
      : effect.groups || [];
    grps.forEach((g) =>
      g.controls.forEach((c) => {
        if (typeof c.onChange === 'function' && defaults[c.key] !== undefined) {
          try {
            c.onChange(defaults[c.key]);
          } catch (err) {
            console.error(`[FFFX Studio] Reset error in ${effect.id}.${c.key}:`, err);
          }
        }
      })
    );
  });
  panelRenderer.render(activeEffect);
}

const menuController = initMenu({
  menuEl,
  effectPill,
  onSelectEffect: (eff) => setActiveEffect(eff),
});

// 5. Initialize Stage Tools and Media Listeners
initStageTools({
  getActiveEffect: () => activeEffect,
  toggleMirrorWebcam,
  fileInput,
  resetAllSettings,
});

const videoController = initVideoControls();
setVideoController(videoController);

initMediaControls();

// Render initial navigation & controls
menuController.render(effects, activeEffect);
panelRenderer.render(activeEffect);
initMotionDemo();
updateAndDrawMotionDemo(0.016);

// 6. Main 60 FPS Render Loop
let lastFrame = performance.now();
let fpsCalcTimer = performance.now();
let fpsFrames = 0;
let currentFps = 60;

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  fpsFrames++;
  if (now - fpsCalcTimer >= 500) {
    currentFps = Math.round((fpsFrames * 1000) / (now - fpsCalcTimer));
    fpsFrames = 0;
    fpsCalcTimer = now;
  }

  // Step 1: Advance dynamic media source
  if (env.sourceType === 'demo') {
    updateAndDrawMotionDemo(dt);
  } else if (
    env.sourceType === 'video' &&
    env.sourceVideo &&
    env.sourceVideo.readyState >= 2
  ) {
    if (env.isWebcam && env.mirrorWebcam) {
      env.sourceCtx.save();
      env.sourceCtx.translate(env.W, 0);
      env.sourceCtx.scale(-1, 1);
      env.sourceCtx.drawImage(env.sourceVideo, 0, 0, env.W, env.H);
      env.sourceCtx.restore();
    } else {
      env.sourceCtx.drawImage(env.sourceVideo, 0, 0, env.W, env.H);
    }
    buildTables(env.sourceCtx.getImageData(0, 0, env.W, env.H));
    if (videoController) {
      videoController.updateFrame();
    }
  }

  // Step 2: Draw active effect
  if (env.W > 0 && env.H > 0 && activeEffect) {
    const t0 = performance.now();
    try {
      const effectValues = globalParameterStore.getEffectValues(activeEffect.id);
      activeEffect.draw(effectValues, dt);
      const dtMs = (performance.now() - t0).toFixed(1);
      if (statsEl) {
        statsEl.textContent = `${currentFps}fps · ${dtMs}ms`;
      }
    } catch (err) {
      console.error(`[FFFX Studio] Render error in ${activeEffect.id}:`, err);
      if (statsEl) {
        statsEl.textContent = `${currentFps}fps · ERR`;
      }
    }
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
