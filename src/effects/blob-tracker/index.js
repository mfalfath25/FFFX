import { env, canvas, ctx, TAU } from '../../core/env.js';
import { hash } from '../../core/sat.js';
import { hexToRgb } from '../../core/webgl.js';

const blobTracker = {
  id: 'blob-tracker',
  label: 'blob-tracker',

  // Persistent analysis & offscreen canvas state
  analysisCanvas: typeof document !== 'undefined' ? document.createElement('canvas') : null,
  analysisCtx: null,
  effectCanvas: typeof document !== 'undefined' ? document.createElement('canvas') : null,
  effectCtx: null,
  bgData: null,
  prevAnalysisData: null,
  trackedBlobs: [],

  init() {
    if (this.analysisCanvas) {
      this.analysisCtx = this.analysisCanvas.getContext('2d', {
        willReadFrequently: true,
      });
    }
    if (this.effectCanvas) {
      this.effectCtx = this.effectCanvas.getContext('2d', {
        willReadFrequently: true,
      });
    }
  },

  // Complete control definitions across all variations to initialize values[effect.id]
  groups: [
    {
      title: 'Detection & Variation',
      controls: [
        {
          key: 'variation',
          label: 'Tracking style',
          type: 'select',
          options: [
            'SQUARED COLOR FILTER',
            'GLITCH HUD & VECTOR TRACKER',
            'SCATTER NODES',
          ],
          value: 'SQUARED COLOR FILTER',
        },
        {
          key: 'detectMode',
          label: 'Detection mode',
          type: 'select',
          options: ['hybrid', 'motion', 'brightness'],
          value: 'hybrid',
        },
        {
          key: 'sensitivity',
          label: 'Sensitivity',
          type: 'range',
          min: 0.05,
          max: 0.95,
          step: 0.01,
          value: 0.45,
          unit: '',
        },
        {
          key: 'minSize',
          label: 'Min blob size',
          type: 'range',
          min: 10,
          max: 150,
          step: 5,
          value: 25,
          unit: 'px',
        },
        {
          key: 'maxBlobs',
          label: 'Max targets',
          type: 'range',
          min: 1,
          max: 10,
          step: 1,
          value: 5,
          unit: '',
        },
        {
          key: 'smoothing',
          label: 'Tracking smooth',
          type: 'range',
          min: 0.05,
          max: 0.8,
          step: 0.05,
          value: 0.25,
          unit: '',
        },
      ],
    },
    {
      title: 'Squared Color Isolation',
      controls: [
        {
          key: 'filterMode',
          label: 'Area filter effect',
          type: 'select',
          options: [
            'black-and-white',
            'custom-color-tint',
            'inverted-bw',
            'duotone',
          ],
          value: 'black-and-white',
        },
        {
          key: 'filterColor',
          label: 'Target custom color',
          type: 'color',
          value: '#ff0055',
        },
        {
          key: 'filterColor2',
          label: 'Secondary tint color',
          type: 'color',
          value: '#00e5ff',
        },
        {
          key: 'filterContrast',
          label: 'B&W / Tone contrast',
          type: 'range',
          min: 0.5,
          max: 2.5,
          step: 0.05,
          value: 1.35,
          unit: 'x',
        },
        {
          key: 'filterInvertTarget',
          label: 'Invert (effect outside blob)',
          type: 'checkbox',
          value: false,
        },
        {
          key: 'squarePadding',
          label: 'Detection area padding',
          type: 'range',
          min: 0,
          max: 80,
          step: 2,
          value: 16,
          unit: 'px',
        },
        {
          key: 'cornerRounding',
          label: 'Detection square radius',
          type: 'range',
          min: 0,
          max: 40,
          step: 2,
          value: 10,
          unit: 'px',
        },
        {
          key: 'borderWidth',
          label: 'Square border line',
          type: 'range',
          min: 0,
          max: 8,
          step: 1,
          value: 2,
          unit: 'px',
        },
        {
          key: 'borderColor',
          label: 'Square border color',
          type: 'color',
          value: '#ffffff',
        },
        {
          key: 'showSquareTags',
          label: 'Show HUD metadata tags',
          type: 'checkbox',
          value: true,
        },
      ],
    },
    {
      title: 'Glitch & Artifacts',
      controls: [
        {
          key: 'glitchIntensity',
          label: 'Glitch displacement',
          type: 'range',
          min: 0,
          max: 1,
          step: 0.05,
          value: 0.65,
          unit: '',
        },
        {
          key: 'rgbSplit',
          label: 'RGB chromatic split',
          type: 'range',
          min: 0,
          max: 20,
          step: 1,
          value: 6,
          unit: 'px',
        },
        {
          key: 'blockArtifacts',
          label: 'Digital glitch blocks',
          type: 'checkbox',
          value: true,
        },
      ],
    },
    {
      title: 'Photogrammetry HUD & Vectors',
      controls: [
        {
          key: 'landmarkCount',
          label: 'Landmark points',
          type: 'range',
          min: 6,
          max: 48,
          step: 2,
          value: 24,
          unit: ' / target',
        },
        {
          key: 'showCoordinates',
          label: 'x/y coordinate tags',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'showBoxes',
          label: 'Hierarchical boxes',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'cyanHighlight',
          label: 'Cyan sub-cluster frame',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'dotColor',
          label: 'Landmark dot color',
          type: 'color',
          value: '#00ff66',
        },
        {
          key: 'boxColor',
          label: 'Box outline color',
          type: 'color',
          value: '#ff2626',
        },
      ],
    },
    {
      title: 'Scatter Nodes',
      controls: [
        {
          key: 'nodeShape',
          label: 'Scatter asset',
          type: 'select',
          options: [
            'square',
            'diamond',
            'bracket',
            'crosshair',
            'circle',
            'triangle',
            'mixed',
          ],
          value: 'square',
        },
        {
          key: 'nodeCount',
          label: 'Node amount',
          type: 'range',
          min: 4,
          max: 48,
          step: 1,
          value: 16,
          unit: ' / blob',
        },
        {
          key: 'nodeSize',
          label: 'Node size',
          type: 'range',
          min: 3,
          max: 24,
          step: 1,
          value: 8,
          unit: 'px',
        },
        {
          key: 'jitter',
          label: 'Animation jitter',
          type: 'range',
          min: 0,
          max: 3,
          step: 0.1,
          value: 1.2,
          unit: 'x',
        },
        {
          key: 'nodeColor',
          label: 'Node color',
          type: 'color',
          value: '#00ff88',
        },
        {
          key: 'accentColor',
          label: 'Accent color',
          type: 'color',
          value: '#ffffff',
        },
      ],
    },
    {
      title: 'Edit Mode Framing',
      controls: [
        {
          key: 'showBoundingBox',
          label: 'Transform edit box',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'showHandles',
          label: 'Edit corner handles',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'showBrackets',
          label: 'CCTV corner brackets',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'showLabels',
          label: 'HUD coordinate tags',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'showCrosshair',
          label: 'Centroid crosshair',
          type: 'checkbox',
          value: true,
        },
        {
          key: 'boxColor',
          label: 'Box / bracket color',
          type: 'color',
          value: '#00ff88',
        },
      ],
    },
    {
      title: 'Background & Style',
      controls: [
        {
          key: 'backgroundDim',
          label: 'Background dim',
          type: 'range',
          min: 0,
          max: 0.95,
          step: 0.05,
          value: 0.35,
          unit: '',
        },
        {
          key: 'blendMode',
          label: 'Node glow blend',
          type: 'select',
          options: ['source-over', 'screen', 'lighter'],
          value: 'source-over',
        },
      ],
    },
  ],

  // Contextual groups returned depending on selected variation
  getGroups(v) {
    if (!v) v = {};
    const variation = v.variation || 'SQUARED COLOR FILTER';

    const grps = [
      {
        title: 'Detection & Variation',
        controls: [
          {
            key: 'variation',
            label: 'Tracking style',
            type: 'select',
            options: [
              'SQUARED COLOR FILTER',
              'GLITCH HUD & VECTOR TRACKER',
              'SCATTER NODES',
            ],
            value: variation,
          },
          {
            key: 'detectMode',
            label: 'Detection mode',
            type: 'select',
            options: ['hybrid', 'motion', 'brightness'],
            value: v.detectMode || 'hybrid',
          },
          {
            key: 'sensitivity',
            label: 'Sensitivity',
            type: 'range',
            min: 0.05,
            max: 0.95,
            step: 0.01,
            value: v.sensitivity !== undefined ? v.sensitivity : 0.45,
            unit: '',
          },
          {
            key: 'minSize',
            label: 'Min blob size',
            type: 'range',
            min: 10,
            max: 150,
            step: 5,
            value: v.minSize !== undefined ? v.minSize : 25,
            unit: 'px',
          },
          {
            key: 'maxBlobs',
            label: 'Max targets',
            type: 'range',
            min: 1,
            max: 10,
            step: 1,
            value: v.maxBlobs !== undefined ? v.maxBlobs : 5,
            unit: '',
          },
          {
            key: 'smoothing',
            label: 'Tracking smooth',
            type: 'range',
            min: 0.05,
            max: 0.8,
            step: 0.05,
            value: v.smoothing !== undefined ? v.smoothing : 0.25,
            unit: '',
          },
        ],
      },
    ];

    if (variation === 'SQUARED COLOR FILTER') {
      grps.push({
        title: 'Squared Color Isolation',
        controls: [
          {
            key: 'filterMode',
            label: 'Area filter effect',
            type: 'select',
            options: [
              'black-and-white',
              'custom-color-tint',
              'inverted-bw',
              'duotone',
            ],
            value: v.filterMode || 'black-and-white',
          },
          {
            key: 'filterColor',
            label: 'Target custom color',
            type: 'color',
            value: v.filterColor || '#ff0055',
          },
          {
            key: 'filterColor2',
            label: 'Secondary tint color',
            type: 'color',
            value: v.filterColor2 || '#00e5ff',
          },
          {
            key: 'filterContrast',
            label: 'B&W / Tone contrast',
            type: 'range',
            min: 0.5,
            max: 2.5,
            step: 0.05,
            value: v.filterContrast !== undefined ? v.filterContrast : 1.35,
            unit: 'x',
          },
          {
            key: 'filterInvertTarget',
            label: 'Invert (effect outside blob)',
            type: 'checkbox',
            value: v.filterInvertTarget !== undefined ? v.filterInvertTarget : false,
          },
          {
            key: 'squarePadding',
            label: 'Detection area padding',
            type: 'range',
            min: 0,
            max: 80,
            step: 2,
            value: v.squarePadding !== undefined ? v.squarePadding : 16,
            unit: 'px',
          },
          {
            key: 'cornerRounding',
            label: 'Detection square radius',
            type: 'range',
            min: 0,
            max: 40,
            step: 2,
            value: v.cornerRounding !== undefined ? v.cornerRounding : 10,
            unit: 'px',
          },
          {
            key: 'borderWidth',
            label: 'Square border line',
            type: 'range',
            min: 0,
            max: 8,
            step: 1,
            value: v.borderWidth !== undefined ? v.borderWidth : 2,
            unit: 'px',
          },
          {
            key: 'borderColor',
            label: 'Square border color',
            type: 'color',
            value: v.borderColor || '#ffffff',
          },
          {
            key: 'showSquareTags',
            label: 'Show HUD metadata tags',
            type: 'checkbox',
            value: v.showSquareTags !== undefined ? v.showSquareTags : true,
          },
        ],
      });
    } else if (variation === 'GLITCH HUD & VECTOR TRACKER') {
      grps.push(
        {
          title: 'Glitch & Artifacts',
          controls: [
            {
              key: 'glitchIntensity',
              label: 'Glitch displacement',
              type: 'range',
              min: 0,
              max: 1,
              step: 0.05,
              value: v.glitchIntensity !== undefined ? v.glitchIntensity : 0.65,
              unit: '',
            },
            {
              key: 'rgbSplit',
              label: 'RGB chromatic split',
              type: 'range',
              min: 0,
              max: 20,
              step: 1,
              value: v.rgbSplit !== undefined ? v.rgbSplit : 6,
              unit: 'px',
            },
            {
              key: 'blockArtifacts',
              label: 'Digital glitch blocks',
              type: 'checkbox',
              value: v.blockArtifacts !== undefined ? v.blockArtifacts : true,
            },
          ],
        },
        {
          title: 'Photogrammetry HUD & Vectors',
          controls: [
            {
              key: 'landmarkCount',
              label: 'Landmark points',
              type: 'range',
              min: 6,
              max: 48,
              step: 2,
              value: v.landmarkCount !== undefined ? v.landmarkCount : 24,
              unit: ' / target',
            },
            {
              key: 'showCoordinates',
              label: 'x/y coordinate tags',
              type: 'checkbox',
              value: v.showCoordinates !== undefined ? v.showCoordinates : true,
            },
            {
              key: 'showBoxes',
              label: 'Hierarchical boxes',
              type: 'checkbox',
              value: v.showBoxes !== undefined ? v.showBoxes : true,
            },
            {
              key: 'cyanHighlight',
              label: 'Cyan sub-cluster frame',
              type: 'checkbox',
              value: v.cyanHighlight !== undefined ? v.cyanHighlight : true,
            },
            {
              key: 'dotColor',
              label: 'Landmark dot color',
              type: 'color',
              value: v.dotColor || '#00ff66',
            },
            {
              key: 'boxColor',
              label: 'Box outline color',
              type: 'color',
              value: v.boxColor || '#ff2626',
            },
          ],
        },
      );
    } else {
      // SCATTER NODES
      grps.push(
        {
          title: 'Scatter Nodes',
          controls: [
            {
              key: 'nodeShape',
              label: 'Scatter asset',
              type: 'select',
              options: [
                'square',
                'diamond',
                'bracket',
                'crosshair',
                'circle',
                'triangle',
                'mixed',
              ],
              value: v.nodeShape || 'square',
            },
            {
              key: 'nodeCount',
              label: 'Node amount',
              type: 'range',
              min: 4,
              max: 48,
              step: 1,
              value: v.nodeCount !== undefined ? v.nodeCount : 16,
              unit: ' / blob',
            },
            {
              key: 'nodeSize',
              label: 'Node size',
              type: 'range',
              min: 3,
              max: 24,
              step: 1,
              value: v.nodeSize !== undefined ? v.nodeSize : 8,
              unit: 'px',
            },
            {
              key: 'jitter',
              label: 'Animation jitter',
              type: 'range',
              min: 0,
              max: 3,
              step: 0.1,
              value: v.jitter !== undefined ? v.jitter : 1.2,
              unit: 'x',
            },
            {
              key: 'nodeColor',
              label: 'Node color',
              type: 'color',
              value: v.nodeColor || '#00ff88',
            },
            {
              key: 'accentColor',
              label: 'Accent color',
              type: 'color',
              value: v.accentColor || '#ffffff',
            },
          ],
        },
        {
          title: 'Edit Mode Framing',
          controls: [
            {
              key: 'showBoundingBox',
              label: 'Transform edit box',
              type: 'checkbox',
              value: v.showBoundingBox !== undefined ? v.showBoundingBox : true,
            },
            {
              key: 'showHandles',
              label: 'Edit corner handles',
              type: 'checkbox',
              value: v.showHandles !== undefined ? v.showHandles : true,
            },
            {
              key: 'showBrackets',
              label: 'CCTV corner brackets',
              type: 'checkbox',
              value: v.showBrackets !== undefined ? v.showBrackets : true,
            },
            {
              key: 'showLabels',
              label: 'HUD coordinate tags',
              type: 'checkbox',
              value: v.showLabels !== undefined ? v.showLabels : true,
            },
            {
              key: 'showCrosshair',
              label: 'Centroid crosshair',
              type: 'checkbox',
              value: v.showCrosshair !== undefined ? v.showCrosshair : true,
            },
            {
              key: 'boxColor',
              label: 'Box / bracket color',
              type: 'color',
              value: v.boxColor || '#00ff88',
            },
          ],
        },
      );
    }

    grps.push({
      title: 'Background & Style',
      controls: [
        {
          key: 'backgroundDim',
          label: 'Background dim',
          type: 'range',
          min: 0,
          max: 0.95,
          step: 0.05,
          value: v.backgroundDim !== undefined ? v.backgroundDim : 0.35,
          unit: '',
        },
        {
          key: 'blendMode',
          label: 'Node glow blend',
          type: 'select',
          options: ['source-over', 'screen', 'lighter'],
          value: v.blendMode || 'source-over',
        },
      ],
    });

    return grps;
  },

  draw(v, dt) {
    const { W, H } = env;
    env.time += dt;

    if (!this.analysisCtx) this.init();

    // 1. Detect blobs from downsampled current frame
    const rawBlobs = this.detectBlobs(v);

    // 2. Temporally smooth blob bounding boxes and maintain node state
    this.updateTrackedBlobs(rawBlobs, v, dt);

    // 3. Render: Draw background media with dimming
    ctx.fillStyle = '#0a0b10';
    ctx.fillRect(0, 0, W, H);

    if (v.backgroundDim < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - v.backgroundDim;
      ctx.drawImage(env.sourceCanvas, 0, 0, W, H);
      ctx.restore();
    }

    // 4. Render selected variation
    const variation = v.variation || 'SQUARED COLOR FILTER';
    if (variation === 'SQUARED COLOR FILTER') {
      this.renderSquaredColorFilter(v, dt);
      const mode = v.filterMode || 'black-and-white';
      return `${this.trackedBlobs.length} tracked squares · Area isolation · ${mode}`;
    } else if (variation === 'GLITCH HUD & VECTOR TRACKER') {
      this.renderGlitchArrows(v, dt);
      const ptCount = this.trackedBlobs.reduce(
        (acc, b) => acc + (b.landmarks ? b.landmarks.length : 0),
        0,
      );
      return `${this.trackedBlobs.length || 1} tracked targets · ${ptCount || v.landmarkCount || 24} landmarks · Clean HUD`;
    } else {
      this.renderTracking(v);
      return `${this.trackedBlobs.length} tracked blobs · ${this.trackedBlobs.reduce((acc, b) => acc + b.nodes.length, 0)} nodes`;
    }
  },

  detectBlobs(v) {
    const { W, H } = env;
    const GW = 96;
    const GH = Math.max(24, Math.round(96 * (H / W)));

    if (
      this.analysisCanvas.width !== GW ||
      this.analysisCanvas.height !== GH
    ) {
      this.analysisCanvas.width = GW;
      this.analysisCanvas.height = GH;
      this.bgData = null;
    }

    // Downsample current source frame into analysis canvas
    this.analysisCtx.drawImage(env.sourceCanvas, 0, 0, GW, GH);
    const currImgData = this.analysisCtx.getImageData(0, 0, GW, GH);
    const data = currImgData.data;

    // Initialize background model on first run or dimension change
    if (!this.bgData || this.bgData.length !== GW * GH * 3) {
      this.bgData = new Float32Array(GW * GH * 3);
      for (let i = 0; i < GW * GH; i++) {
        this.bgData[i * 3] = data[i * 4];
        this.bgData[i * 3 + 1] = data[i * 4 + 1];
        this.bgData[i * 3 + 2] = data[i * 4 + 2];
      }
    }

    const energyGrid = new Float32Array(GW * GH);

    let threshold;
    const sens = v.sensitivity !== undefined ? v.sensitivity : 0.45;
    const mode = v.detectMode || 'hybrid';
    if (mode === 'motion') {
      threshold = 0.02 + (1 - sens) * 0.18;
    } else if (mode === 'brightness') {
      threshold = 0.12 + (1 - sens) * 0.65;
    } else {
      threshold = 0.03 + (1 - sens) * 0.25;
    }

    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const idx = (y * GW + x) * 4;
        const bgIdx = (y * GW + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        const bgR = this.bgData[bgIdx];
        const bgG = this.bgData[bgIdx + 1];
        const bgB = this.bgData[bgIdx + 2];
        const motion =
          (Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB)) /
          (3 * 255);

        const adaptRate = 0.035;
        this.bgData[bgIdx] += (r - bgR) * adaptRate;
        this.bgData[bgIdx + 1] += (g - bgG) * adaptRate;
        this.bgData[bgIdx + 2] += (b - bgB) * adaptRate;

        let val = 0;
        if (mode === 'motion') {
          val = motion;
        } else if (mode === 'brightness') {
          val = luma;
        } else {
          val = Math.max(motion * 1.5, luma * 0.8);
        }

        energyGrid[y * GW + x] = val > threshold ? val : 0;
      }
    }

    this.prevAnalysisData = currImgData;

    // Connected components (flood fill) clustering
    const visited = new Uint8Array(GW * GH);
    const rawClusters = [];

    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        if (visited[i] || energyGrid[i] === 0) continue;

        let minX = x,
          maxX = x,
          minY = y,
          maxY = y;
        let sumX = 0,
          sumY = 0,
          count = 0,
          sumEnergy = 0;
        const queue = [x, y];
        visited[i] = 1;

        while (queue.length > 0) {
          const qy = queue.pop();
          const qx = queue.pop();
          const qi = qy * GW + qx;
          const e = energyGrid[qi];

          sumX += qx * e;
          sumY += qy * e;
          sumEnergy += e;
          count++;

          if (qx < minX) minX = qx;
          if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy;
          if (qy > maxY) maxY = qy;

          const neighbors = [
            [qx + 1, qy],
            [qx - 1, qy],
            [qx, qy + 1],
            [qx, qy - 1],
          ];
          for (let k = 0; k < 4; k++) {
            const nx = neighbors[k][0],
              ny = neighbors[k][1];
            if (nx >= 0 && nx < GW && ny >= 0 && ny < GH) {
              const ni = ny * GW + nx;
              if (!visited[ni] && energyGrid[ni] > 0) {
                visited[ni] = 1;
                queue.push(nx, ny);
              }
            }
          }
        }

        const scaleX = W / GW;
        const scaleY = H / GH;
        const bw = (maxX - minX + 1) * scaleX;
        const bh = (maxY - minY + 1) * scaleY;
        const area = Math.max(bw, bh);
        const minSz = v.minSize !== undefined ? v.minSize : 25;

        if (area >= minSz && count >= 3) {
          rawClusters.push({
            x: minX * scaleX,
            y: minY * scaleY,
            w: bw,
            h: bh,
            cx: (sumX / sumEnergy) * scaleX,
            cy: (sumY / sumEnergy) * scaleY,
            mass: count,
            energy: sumEnergy / count,
          });
        }
      }
    }

    rawClusters.sort((a, b) => b.mass - a.mass);
    const maxB = v.maxBlobs !== undefined ? v.maxBlobs : 5;
    return rawClusters.slice(0, maxB);
  },

  updateTrackedBlobs(rawBlobs, v, dt) {
    const smooth = v.smoothing !== undefined ? v.smoothing : 0.25;
    const matched = new Set();
    const updated = [];

    rawBlobs.forEach((raw) => {
      let bestDist = 180;
      let bestBlob = null;

      this.trackedBlobs.forEach((tb) => {
        if (matched.has(tb)) return;
        const d = Math.hypot(tb.cx - raw.cx, tb.cy - raw.cy);
        if (d < bestDist) {
          bestDist = d;
          bestBlob = tb;
        }
      });

      if (bestBlob) {
        matched.add(bestBlob);
        bestBlob.x += (raw.x - bestBlob.x) * (1 - smooth);
        bestBlob.y += (raw.y - bestBlob.y) * (1 - smooth);
        bestBlob.w += (raw.w - bestBlob.w) * (1 - smooth);
        bestBlob.h += (raw.h - bestBlob.h) * (1 - smooth);
        bestBlob.cx += (raw.cx - bestBlob.cx) * (1 - smooth);
        bestBlob.cy += (raw.cy - bestBlob.cy) * (1 - smooth);
        bestBlob.mass = raw.mass;
        bestBlob.life = Math.min(1, bestBlob.life + dt * 4);
        this.syncNodes(bestBlob, v);
        this.syncLandmarks(bestBlob, v);
        updated.push(bestBlob);
      } else {
        const newBlob = {
          id: Math.floor(100 + Math.random() * 900),
          x: raw.x,
          y: raw.y,
          w: raw.w,
          h: raw.h,
          cx: raw.cx,
          cy: raw.cy,
          mass: raw.mass,
          life: 0.1,
          nodes: [],
          landmarks: [],
        };
        this.syncNodes(newBlob, v);
        this.syncLandmarks(newBlob, v);
        updated.push(newBlob);
      }
    });

    this.trackedBlobs = updated;
  },

  // Helper for drawing clean rounded rectangles
  drawRoundedRect(targetCtx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius, y);
    targetCtx.lineTo(x + w - radius, y);
    targetCtx.quadraticCurveTo(x + w, y, x + w, y + radius);
    targetCtx.lineTo(x + w, y + h - radius);
    targetCtx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    targetCtx.lineTo(x + radius, y + h);
    targetCtx.quadraticCurveTo(x, y + h, x, y + h - radius);
    targetCtx.lineTo(x, y + radius);
    targetCtx.quadraticCurveTo(x, y, x + radius, y);
    targetCtx.closePath();
  },

  // --- EFFECT: SQUARED COLOR FILTER (BLACK & WHITE / CUSTOM COLOR) ---
  renderSquaredColorFilter(v, dt) {
    const { W, H } = env;
    let blobs = this.trackedBlobs;
    if (blobs.length === 0) {
      blobs = [
        {
          id: 301,
          x: W * 0.28,
          y: H * 0.22,
          w: W * 0.44,
          h: H * 0.56,
          cx: W * 0.5,
          cy: H * 0.5,
          life: 1.0,
        },
      ];
    }

    if (!this.effectCanvas) {
      this.effectCanvas = document.createElement('canvas');
      this.effectCtx = this.effectCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (this.effectCanvas.width !== W || this.effectCanvas.height !== H) {
      this.effectCanvas.width = W;
      this.effectCanvas.height = H;
    }

    const eCtx = this.effectCtx;
    eCtx.clearRect(0, 0, W, H);
    eCtx.drawImage(env.sourceCanvas, 0, 0, W, H);

    const pad = v.squarePadding !== undefined ? v.squarePadding : 16;
    const radius = v.cornerRounding !== undefined ? v.cornerRounding : 10;
    const mode = v.filterMode || 'black-and-white';
    const invertTarget = v.filterInvertTarget !== undefined ? v.filterInvertTarget : false;
    const contrast = v.filterContrast !== undefined ? v.filterContrast : 1.35;
    const filterColor = v.filterColor || '#ff0055';
    const filterColor2 = v.filterColor2 || '#00e5ff';
    const c1 = hexToRgb(filterColor);
    const c2 = hexToRgb(filterColor2);

    const applyPixelFilter = (sx, sy, sw, sh) => {
      sx = Math.max(0, Math.floor(sx));
      sy = Math.max(0, Math.floor(sy));
      sw = Math.min(W - sx, Math.ceil(sw));
      sh = Math.min(H - sy, Math.ceil(sh));
      if (sw <= 0 || sh <= 0) return;

      const imgData = eCtx.getImageData(sx, sy, sw, sh);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        let luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Apply contrast curve
        luma = (luma - 0.5) * contrast + 0.5;
        luma = Math.max(0, Math.min(1, luma));

        if (mode === 'black-and-white') {
          const val = Math.round(luma * 255);
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        } else if (mode === 'inverted-bw') {
          const val = Math.round((1 - luma) * 255);
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        } else if (mode === 'custom-color-tint') {
          d[i] = Math.round(luma * c1[0] * 255);
          d[i + 1] = Math.round(luma * c1[1] * 255);
          d[i + 2] = Math.round(luma * c1[2] * 255);
        } else if (mode === 'duotone') {
          const rDuo = (1 - luma) * c1[0] + luma * c2[0];
          const gDuo = (1 - luma) * c1[1] + luma * c2[1];
          const bDuo = (1 - luma) * c1[2] + luma * c2[2];
          d[i] = Math.round(rDuo * 255);
          d[i + 1] = Math.round(gDuo * 255);
          d[i + 2] = Math.round(bDuo * 255);
        }
      }

      eCtx.putImageData(imgData, sx, sy);
    };

    if (invertTarget) {
      // Invert: entire canvas is transformed, then blob areas are restored to original
      applyPixelFilter(0, 0, W, H);
      eCtx.save();
      blobs.forEach((b) => {
        const sx = Math.max(0, b.x - pad);
        const sy = Math.max(0, b.y - pad);
        const sw = Math.min(W - sx, b.w + pad * 2);
        const sh = Math.min(H - sy, b.h + pad * 2);
        eCtx.save();
        this.drawRoundedRect(eCtx, sx, sy, sw, sh, radius);
        eCtx.clip();
        eCtx.drawImage(env.sourceCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
        eCtx.restore();
      });
      eCtx.restore();
    } else {
      // Normal: squared detected blob regions turn into B&W / custom color
      blobs.forEach((b) => {
        const sx = Math.max(0, b.x - pad);
        const sy = Math.max(0, b.y - pad);
        const sw = Math.min(W - sx, b.w + pad * 2);
        const sh = Math.min(H - sy, b.h + pad * 2);

        applyPixelFilter(sx, sy, sw, sh);

        if (radius > 0) {
          // Keep crisp rounded rectangle mask against the background
          eCtx.save();
          eCtx.beginPath();
          this.drawRoundedRect(eCtx, sx, sy, sw, sh, radius);
          eCtx.rect(W, 0, -W, H);
          eCtx.clip();
          eCtx.drawImage(env.sourceCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
          eCtx.restore();
        }
      });
    }

    // Render processed effect canvas to main canvas
    ctx.drawImage(this.effectCanvas, 0, 0);

    // Squared Detection HUD Overlays
    const bWidth = v.borderWidth !== undefined ? v.borderWidth : 2;
    const bColor = v.borderColor || '#ffffff';
    const showTags = v.showSquareTags !== false;

    blobs.forEach((b) => {
      const sx = Math.max(0, b.x - pad);
      const sy = Math.max(0, b.y - pad);
      const sw = Math.min(W - sx, b.w + pad * 2);
      const sh = Math.min(H - sy, b.h + pad * 2);

      ctx.save();

      // Outer Detection Border
      if (bWidth > 0) {
        ctx.strokeStyle = bColor;
        ctx.lineWidth = bWidth;
        this.drawRoundedRect(ctx, sx, sy, sw, sh, radius);
        ctx.stroke();
      }

      // Tech CCTV corner brackets
      const bl = Math.min(18, sw * 0.25, sh * 0.25);
      ctx.strokeStyle = bColor;
      ctx.lineWidth = Math.max(2, bWidth + 1);
      ctx.beginPath();
      ctx.moveTo(sx, sy + bl);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx + bl, sy);

      ctx.moveTo(sx + sw - bl, sy);
      ctx.lineTo(sx + sw, sy);
      ctx.lineTo(sx + sw, sy + bl);

      ctx.moveTo(sx, sy + sh - bl);
      ctx.lineTo(sx, sy + sh);
      ctx.lineTo(sx + bl, sy + sh);

      ctx.moveTo(sx + sw - bl, sy + sh);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.lineTo(sx + sw, sy + sh - bl);
      ctx.stroke();

      // Centroid Crosshair
      const cs = 7;
      ctx.strokeStyle = bColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.cx - cs, b.cy);
      ctx.lineTo(b.cx + cs, b.cy);
      ctx.moveTo(b.cx, b.cy - cs);
      ctx.lineTo(b.cx, b.cy + cs);
      ctx.stroke();

      // HUD Metadata Label Tag
      if (showTags) {
        ctx.font = '10px monospace';
        const tag = `DETECT #${b.id} [${Math.round(b.cx)},${Math.round(b.cy)}] ${Math.round(sw)}x${Math.round(sh)} · ${mode.toUpperCase()}`;
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = 'rgba(8, 10, 16, 0.85)';
        ctx.fillRect(sx, sy - 18, tw + 8, 14);
        ctx.strokeStyle = bColor;
        ctx.strokeRect(sx, sy - 18, tw + 8, 14);
        ctx.fillStyle = bColor;
        ctx.fillText(tag, sx + 4, sy - 7);
      }

      ctx.restore();
    });
  },

  // --- VARIATION 3: GLITCH HUD & VECTOR TRACKER (Cleaned up, no random connecting lines) ---
  syncLandmarks(blob, v) {
    if (!blob.landmarks) blob.landmarks = [];
    const count = v.landmarkCount !== undefined ? v.landmarkCount : 24;
    const crosshairColors = ['#00f0ff', '#ff00aa', '#ffff00', '#ffffff', '#00ff66'];

    while (blob.landmarks.length < count) {
      const idx = blob.landmarks.length;
      let rx, ry, sGroup;
      if (idx < count * 0.4) {
        rx = (Math.random() - 0.5) * 0.55;
        ry = -0.15 - Math.random() * 0.35;
        sGroup = 0;
      } else if (idx < count * 0.75) {
        rx = 0.08 + Math.random() * 0.42;
        ry = -0.05 + Math.random() * 0.45;
        sGroup = 1;
      } else {
        rx = (Math.random() - 0.5) * 0.45;
        ry = 0.12 + Math.random() * 0.38;
        sGroup = 2;
      }

      blob.landmarks.push({
        id: idx,
        relX: rx,
        relY: ry,
        speed: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        hasCrosshair: Math.random() < 0.38,
        crosshairColor: crosshairColors[Math.floor(Math.random() * crosshairColors.length)],
        showLabel: Math.random() < 0.55,
        subGroup: sGroup,
      });
    }
    if (blob.landmarks.length > count) {
      blob.landmarks.length = count;
    }
  },

  renderGlitchEffects(blobs, v) {
    const { W, H } = env;
    const intensity = v.glitchIntensity !== undefined ? v.glitchIntensity : 0.65;
    if (intensity <= 0.01) return;

    ctx.save();

    // 1. Horizontal Slices Displacement with Chromatic Aberration
    const numSlices = Math.floor(4 + intensity * 14);
    for (let i = 0; i < numSlices; i++) {
      const b = blobs[Math.floor(Math.random() * blobs.length)];
      const sy = Math.max(0, Math.min(H - 16, b.y + Math.random() * b.h));
      const sh = Math.floor(3 + Math.random() * 16);
      const sx = Math.max(0, b.x - 20);
      const sw = Math.min(W - sx, b.w + 40);
      const dx = (Math.random() - 0.5) * 44 * intensity;

      if (sw <= 4 || sh <= 2) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, sw, sh);
      ctx.clip();

      ctx.drawImage(env.sourceCanvas, sx, sy, sw, sh, sx + dx, sy, sw, sh);

      const rgbSplit = v.rgbSplit !== undefined ? v.rgbSplit : 6;
      if (rgbSplit > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(
          env.sourceCanvas,
          sx,
          sy,
          sw,
          sh,
          sx + dx + rgbSplit,
          sy,
          sw,
          sh,
        );
        ctx.fillStyle = 'rgba(255, 30, 40, 0.32)';
        ctx.fillRect(sx + dx, sy, sw, sh);

        ctx.drawImage(
          env.sourceCanvas,
          sx,
          sy,
          sw,
          sh,
          sx + dx - rgbSplit,
          sy,
          sw,
          sh,
        );
        ctx.fillStyle = 'rgba(0, 230, 255, 0.32)';
        ctx.fillRect(sx + dx, sy, sw, sh);
      }
      ctx.restore();
    }

    // 2. Digital Glitch / Datamosh Blocks
    if (v.blockArtifacts) {
      const blockCount = Math.floor(6 + intensity * 22);
      const blockColors = [
        '#ff3b30',
        '#ff9500',
        '#00e5ff',
        '#34c759',
        '#af52de',
        '#ffffff',
        '#ffd60a',
      ];
      for (let i = 0; i < blockCount; i++) {
        const b = blobs[Math.floor(Math.random() * blobs.length)];
        const bw = Math.floor(4 + Math.random() * 14);
        const bh = Math.floor(4 + Math.random() * 12);
        const bx = Math.max(
          0,
          Math.min(W - bw, b.x + Math.random() * b.w + (Math.random() - 0.5) * 30),
        );
        const by = Math.max(
          0,
          Math.min(H - bh, b.y + Math.random() * b.h + (Math.random() - 0.5) * 30),
        );

        if (Math.random() < 0.45) {
          ctx.fillStyle =
            blockColors[Math.floor(Math.random() * blockColors.length)];
          ctx.globalAlpha = 0.35 + Math.random() * 0.45;
          ctx.fillRect(bx, by, bw, bh);
        } else {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.75;
          const srcX = Math.max(
            0,
            Math.min(W - 4, bx + (Math.random() - 0.5) * 16),
          );
          const srcY = Math.max(
            0,
            Math.min(H - 4, by + (Math.random() - 0.5) * 16),
          );
          ctx.drawImage(env.sourceCanvas, srcX, srcY, 4, 4, bx, by, bw, bh);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  },

  renderGlitchArrows(v, dt) {
    const { W, H, time } = env;
    let blobs = this.trackedBlobs;
    if (blobs.length === 0) {
      blobs = [
        {
          id: 701,
          x: W * 0.2,
          y: H * 0.12,
          w: W * 0.6,
          h: H * 0.76,
          cx: W * 0.5,
          cy: H * 0.5,
          life: 1.0,
          mass: 120,
          landmarks: [],
        },
      ];
    }

    // 1. Render Glitch artifacts
    this.renderGlitchEffects(blobs, v);

    // 2. Render Photogrammetry HUD & Keypoints (WITHOUT random connecting lines)
    blobs.forEach((b) => {
      this.syncLandmarks(b, v);

      const pts = b.landmarks.map((lm) => {
        const jitterX = Math.sin(time * lm.speed + lm.phase) * (b.w * 0.018);
        const jitterY = Math.cos(time * lm.speed * 1.1 + lm.phase) * (b.h * 0.018);
        return {
          x: Math.max(6, Math.min(W - 6, b.cx + lm.relX * b.w + jitterX)),
          y: Math.max(6, Math.min(H - 6, b.cy + lm.relY * b.h + jitterY)),
          id: lm.id,
          hasCrosshair: lm.hasCrosshair,
          crosshairColor: lm.crosshairColor,
          showLabel: lm.showLabel,
          subGroup: lm.subGroup,
        };
      });

      // A. Hierarchical Wireframe Bounding Boxes
      if (v.showBoxes !== false) {
        ctx.save();
        ctx.strokeStyle = v.boxColor || '#ff2626';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        const groups = [0, 1, 2];
        groups.forEach((gId) => {
          const gPts = pts.filter((p) => p.subGroup === gId);
          if (gPts.length >= 2) {
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            gPts.forEach((p) => {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            });
            const pad = 12;
            const bx = Math.max(0, minX - pad);
            const by = Math.max(0, minY - pad);
            const bw = Math.min(W - bx, maxX - minX + pad * 2);
            const bh = Math.min(H - by, maxY - minY + pad * 2);

            ctx.strokeRect(bx, by, bw, bh);

            if (v.showCoordinates !== false) {
              ctx.font = '9px monospace';
              ctx.fillStyle = v.boxColor || '#ff2626';
              ctx.fillText(
                `x: ${Math.round(bx)} y: ${Math.round(by)}`,
                bx + 3,
                by - 4,
              );
            }
          }
        });

        if (v.cyanHighlight !== false) {
          const cyanPts = pts.filter((p) => p.subGroup === 1);
          if (cyanPts.length > 0) {
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            cyanPts.forEach((p) => {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            });
            const pad = 14;
            const cx = Math.max(0, minX - pad);
            const cy = Math.max(0, minY - pad);
            const cw = Math.min(W - cx, maxX - minX + pad * 2);
            const ch = Math.min(H - cy, maxY - minY + pad * 2);

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(cx, cy, cw, ch);

            if (v.showCoordinates !== false) {
              ctx.font = '9px monospace';
              ctx.fillStyle = '#00e5ff';
              ctx.fillText(
                `x: ${Math.round(cx)} y: ${Math.round(cy)}`,
                cx + 4,
                cy - 4,
              );
            }
          }
        }

        // Micro feature boxes around key landmarks
        for (let i = 0; i < Math.min(3, pts.length); i++) {
          const p = pts[i];
          ctx.strokeStyle = v.boxColor || '#ff2626';
          ctx.lineWidth = 0.9;
          const msz = 18;
          ctx.strokeRect(p.x - msz / 2, p.y - msz / 2, msz, msz);
        }

        ctx.restore();
      }

      // B. Landmark Keypoint Dots & Crosshairs & Coordinates
      ctx.save();
      pts.forEach((p) => {
        ctx.fillStyle = v.dotColor || '#00ff66';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#051108';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        if (p.hasCrosshair) {
          const cs = 5;
          ctx.strokeStyle = p.crosshairColor || '#00ffff';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(p.x - cs, p.y);
          ctx.lineTo(p.x + cs, p.y);
          ctx.moveTo(p.x, p.y - cs);
          ctx.lineTo(p.x, p.y + cs);
          ctx.stroke();
        }

        if (v.showCoordinates !== false && p.showLabel) {
          ctx.font = '9px monospace';
          const tag = `x: ${Math.round(p.x)} y: ${Math.round(p.y)}`;
          const tw = ctx.measureText(tag).width;
          ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
          ctx.fillRect(p.x + 5, p.y - 7, tw + 4, 10);
          ctx.fillStyle = '#f0f3f6';
          ctx.fillText(tag, p.x + 7, p.y + 1);
        }
      });
      ctx.restore();
    });
  },

  // --- VARIATION 4: SCATTER NODES (Cleaned up, no random connecting lines) ---
  syncNodes(blob, v) {
    const targetCount = v.nodeCount !== undefined ? v.nodeCount : 16;
    while (blob.nodes.length < targetCount) {
      blob.nodes.push({
        relX: (Math.random() - 0.5) * 0.85,
        relY: (Math.random() - 0.5) * 0.85,
        phase: Math.random() * TAU,
        speed: 0.8 + Math.random() * 1.6,
        shape: this.pickShape(v.nodeShape || 'square'),
        scale: 0.7 + Math.random() * 0.6,
      });
    }
    if (blob.nodes.length > targetCount) {
      blob.nodes.length = targetCount;
    }
    blob.nodes.forEach((n) => {
      if (v.nodeShape && v.nodeShape !== 'mixed') {
        n.shape = v.nodeShape;
      }
    });
  },

  pickShape(shapePref) {
    if (shapePref !== 'mixed') return shapePref;
    const shapes = [
      'square',
      'diamond',
      'bracket',
      'crosshair',
      'circle',
      'triangle',
    ];
    return shapes[Math.floor(Math.random() * shapes.length)];
  },

  renderTracking(v) {
    const { time } = env;

    this.trackedBlobs.forEach((b) => {
      const alpha = Math.min(1, b.life);
      ctx.save();
      ctx.globalAlpha = alpha;

      // 1. Edit Mode Bounding Box & Handles
      if (v.showBoundingBox !== false) {
        ctx.strokeStyle = v.boxColor || '#00ff88';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        if (v.showHandles !== false) {
          const handles = [
            [b.x, b.y],
            [b.x + b.w, b.y],
            [b.x, b.y + b.h],
            [b.x + b.w, b.y + b.h],
            [b.x + b.w / 2, b.y],
            [b.x + b.w / 2, b.y + b.h],
            [b.x, b.y + b.h / 2],
            [b.x + b.w, b.y + b.h / 2],
          ];
          const hs = 5;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = v.boxColor || '#00ff88';
          ctx.lineWidth = 1;
          handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
            ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
          });
        }
      }

      // 2. CCTV Corner Brackets
      if (v.showBrackets !== false) {
        const bl = Math.min(14, b.w * 0.25, b.h * 0.25);
        ctx.strokeStyle = v.boxColor || '#00ff88';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(b.x, b.y + bl);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + bl, b.y);

        ctx.moveTo(b.x + b.w - bl, b.y);
        ctx.lineTo(b.x + b.w, b.y);
        ctx.lineTo(b.x + b.w, b.y + bl);

        ctx.moveTo(b.x, b.y + b.h - bl);
        ctx.lineTo(b.x, b.y + b.h);
        ctx.lineTo(b.x + bl, b.y + b.h);

        ctx.moveTo(b.x + b.w - bl, b.y + b.h);
        ctx.lineTo(b.x + b.w, b.y + b.h);
        ctx.lineTo(b.x + b.w, b.y + b.h - bl);
        ctx.stroke();
      }

      // 3. Centroid Crosshair
      if (v.showCrosshair !== false) {
        const cs = 7;
        ctx.strokeStyle = v.accentColor || '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.cx - cs, b.cy);
        ctx.lineTo(b.cx + cs, b.cy);
        ctx.moveTo(b.cx, b.cy - cs);
        ctx.lineTo(b.cx, b.cy + cs);
        ctx.stroke();
      }

      // 4. Tech HUD Labels
      if (v.showLabels !== false) {
        ctx.font = '9px monospace';
        const label = `ID#${b.id} [${Math.round(b.cx)},${Math.round(b.cy)}] ${Math.round(b.w)}x${Math.round(b.h)}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10, 12, 18, 0.75)';
        ctx.fillRect(b.x, b.y - 14, tw + 8, 12);
        ctx.strokeStyle = v.boxColor || '#00ff88';
        ctx.strokeRect(b.x, b.y - 14, tw + 8, 12);
        ctx.fillStyle = v.boxColor || '#00ff88';
        ctx.fillText(label, b.x + 4, b.y - 5);
      }

      // Calculate animated node positions
      const computedNodes = b.nodes.map((n) => {
        const jit = v.jitter !== undefined ? v.jitter : 1.2;
        const ox = Math.sin(time * n.speed + n.phase) * (b.w * 0.18 * jit);
        const oy = Math.cos(time * n.speed * 1.2 + n.phase) * (b.h * 0.18 * jit);
        return {
          x: b.cx + n.relX * b.w + ox,
          y: b.cy + n.relY * b.h + oy,
          shape: n.shape,
          size: (v.nodeSize !== undefined ? v.nodeSize : 8) * n.scale,
        };
      });

      // 5. Draw Scattered Nodes (without random interconnecting mesh lines)
      ctx.save();
      const blend = v.blendMode || 'source-over';
      if (blend !== 'source-over') {
        ctx.globalCompositeOperation = blend;
      }
      computedNodes.forEach((cn, idx) => {
        this.drawNodeShape(
          cn.x,
          cn.y,
          cn.size,
          cn.shape,
          v.nodeColor || '#00ff88',
          v.accentColor || '#ffffff',
          idx,
        );
      });
      ctx.restore();

      ctx.restore();
    });
  },

  drawNodeShape(x, y, s, shape, color, accentColor, idx) {
    ctx.save();
    ctx.translate(x, y);

    if (shape === 'square') {
      ctx.fillStyle = color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    } else if (shape === 'diamond') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    } else if (shape === 'bracket') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      const hs = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(-hs, 0);
      ctx.lineTo(-hs, -hs);
      ctx.lineTo(0, -hs);
      ctx.moveTo(hs, 0);
      ctx.lineTo(hs, hs);
      ctx.lineTo(0, hs);
      ctx.stroke();
    } else if (shape === 'crosshair') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      const hs = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(-hs, 0);
      ctx.lineTo(hs, 0);
      ctx.moveTo(0, -hs);
      ctx.lineTo(0, hs);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.fillRect(-1, -1, 2, 2);
    } else if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, TAU);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, s / 4, 0, TAU);
      ctx.fill();
    } else if (shape === 'triangle') {
      const hs = s * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -hs);
      ctx.lineTo(hs, hs * 0.8);
      ctx.lineTo(-hs, hs * 0.8);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  },
};

export default blobTracker;
export { blobTracker };
