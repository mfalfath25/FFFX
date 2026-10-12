/**
 * FFFX Core Environment & Shared Canvas State
 */

export const ROOT = 64; // Canvas dimensions snapped to multiples of this
export const TAU = Math.PI * 2;

const offscreenSourceCanvas =
  typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (offscreenSourceCanvas) {
  offscreenSourceCanvas.width = 960;
  offscreenSourceCanvas.height = 640;
}
const offscreenSourceCtx = offscreenSourceCanvas
  ? offscreenSourceCanvas.getContext('2d', { willReadFrequently: true })
  : null;

export let canvas =
  typeof document !== 'undefined' ? document.getElementById('canvas') : null;
if (canvas) {
  canvas.width = 960;
  canvas.height = 640;
}
export let ctx = canvas ? canvas.getContext('2d') : null;

export const env = {
  W: 960,
  H: 640,
  time: 0,
  sat: null, // Summed-area table for quadtree / computer vision
  cursor: {
    x: 480,
    y: 320,
    targetX: 480,
    targetY: 320,
    isDown: false,
    lastMoveAt: 0,
  },
  cursorEnabled: false,

  // Offscreen canvas storing current source frame
  sourceCanvas: offscreenSourceCanvas,
  sourceCtx: offscreenSourceCtx,

  // Media source state
  sourceType: 'demo', // 'image' | 'video' | 'webcam' | 'demo'
  sourceVideo: null,
  sourceImage: null,
  demoState: null,
  isWebcam: false,
  mirrorWebcam: true,

  // Bound DOM elements
  canvas: canvas,
  ctx: ctx,
  stage: null,
  statsEl: null,
  sourceBadge: null,
  effectPill: null,
  resPill: null,
};

/**
 * Initializes the environment with DOM element references
 * @param {Object} domElements 
 */
export function initEnv(domElements = {}) {
  Object.assign(env, domElements);
  if (domElements.canvas) {
    canvas = domElements.canvas;
    ctx = domElements.ctx || canvas.getContext('2d');
    env.canvas = canvas;
    env.ctx = ctx;
  }
}
