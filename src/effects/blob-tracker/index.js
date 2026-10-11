import { env, canvas, ctx, TAU } from '../../core/env.js';
import { hash } from '../../core/sat.js';

      const blobTracker = {
        id: 'blob-tracker',
        label: 'blob-tracker',

        // Persistent analysis & particle state
        analysisCanvas: document.createElement('canvas'),
        analysisCtx: null,
        bgData: null,
        prevAnalysisData: null,
        trackedBlobs: [],
        webParticles: [],

        init() {
          this.analysisCtx = this.analysisCanvas.getContext('2d', {
            willReadFrequently: true,
          })
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
                  'GLITCH ARROWS & HUD',
                  'INTERCONNECTED WEB SWARM',
                  'SCATTER NODES',
                ],
                value: 'GLITCH ARROWS & HUD',
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
                key: 'arrowDensity',
                label: 'Directed arrows',
                type: 'range',
                min: 2,
                max: 30,
                step: 1,
                value: 14,
                unit: '',
              },
              {
                key: 'showCoordinates',
                label: 'x/y coordinate tags',
                type: 'checkbox',
                value: true,
              },
              {
                key: 'showBoxes',
                label: 'Hierarchical red boxes',
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
                label: 'Red box color',
                type: 'color',
                value: '#ff2626',
              },
            ],
          },
          {
            title: 'Web Swarm Dynamics',
            controls: [
              {
                key: 'swarmCount',
                label: 'Swarm particle count',
                type: 'range',
                min: 20,
                max: 180,
                step: 5,
                value: 80,
                unit: ' nodes',
              },
              {
                key: 'swarmAttract',
                label: 'Target attraction pull',
                type: 'range',
                min: 0.2,
                max: 3.0,
                step: 0.1,
                value: 1.4,
                unit: 'x',
              },
              {
                key: 'webReach',
                label: 'Web string reach',
                type: 'range',
                min: 40,
                max: 260,
                step: 5,
                value: 120,
                unit: 'px',
              },
              {
                key: 'stringTension',
                label: 'String tension (sag)',
                type: 'range',
                min: 0.1,
                max: 1.0,
                step: 0.05,
                value: 0.65,
                unit: '',
              },
              {
                key: 'radialSpokes',
                label: 'Radial anchor threads',
                type: 'range',
                min: 4,
                max: 24,
                step: 1,
                value: 12,
                unit: ' rays',
              },
              {
                key: 'vibration',
                label: 'String tremor jitter',
                type: 'range',
                min: 0,
                max: 2.0,
                step: 0.1,
                value: 0.4,
                unit: 'x',
              },
              {
                key: 'webColor',
                label: 'Web string color',
                type: 'color',
                value: '#99e0ff',
              },
              {
                key: 'silkJointsGlow',
                label: 'Silk joints luminous glow',
                type: 'checkbox',
                value: true,
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
                key: 'connectNodes',
                label: 'Connect nodes (mesh)',
                type: 'checkbox',
                value: true,
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
          if (!v) v = {}
          const variation = v.variation || 'GLITCH ARROWS & HUD'

          const grps = [
            {
              title: 'Detection & Variation',
              controls: [
                {
                  key: 'variation',
                  label: 'Tracking style',
                  type: 'select',
                  options: [
                    'GLITCH ARROWS & HUD',
                    'INTERCONNECTED WEB SWARM',
                    'SCATTER NODES',
                  ],
                  value: variation,
                  onChange() {
                    renderPanel()
                  },
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
          ]

          if (variation === 'GLITCH ARROWS & HUD') {
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
                    key: 'arrowDensity',
                    label: 'Directed arrows',
                    type: 'range',
                    min: 2,
                    max: 30,
                    step: 1,
                    value: v.arrowDensity !== undefined ? v.arrowDensity : 14,
                    unit: '',
                  },
                  {
                    key: 'showCoordinates',
                    label: 'x/y coordinate tags',
                    type: 'checkbox',
                    value: v.showCoordinates !== undefined ? v.showCoordinates : true,
                  },
                  {
                    key: 'showBoxes',
                    label: 'Hierarchical red boxes',
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
                    label: 'Red box color',
                    type: 'color',
                    value: v.boxColor || '#ff2626',
                  },
                ],
              },
            )
          } else if (variation === 'INTERCONNECTED WEB SWARM') {
            grps.push({
              title: 'Web Swarm Dynamics',
              controls: [
                {
                  key: 'swarmCount',
                  label: 'Swarm particle count',
                  type: 'range',
                  min: 20,
                  max: 180,
                  step: 5,
                  value: v.swarmCount !== undefined ? v.swarmCount : 80,
                  unit: ' nodes',
                },
                {
                  key: 'swarmAttract',
                  label: 'Target attraction pull',
                  type: 'range',
                  min: 0.2,
                  max: 3.0,
                  step: 0.1,
                  value: v.swarmAttract !== undefined ? v.swarmAttract : 1.4,
                  unit: 'x',
                },
                {
                  key: 'webReach',
                  label: 'Web string reach',
                  type: 'range',
                  min: 40,
                  max: 260,
                  step: 5,
                  value: v.webReach !== undefined ? v.webReach : 120,
                  unit: 'px',
                },
                {
                  key: 'stringTension',
                  label: 'String tension (sag)',
                  type: 'range',
                  min: 0.1,
                  max: 1.0,
                  step: 0.05,
                  value: v.stringTension !== undefined ? v.stringTension : 0.65,
                  unit: '',
                },
                {
                  key: 'radialSpokes',
                  label: 'Radial anchor threads',
                  type: 'range',
                  min: 4,
                  max: 24,
                  step: 1,
                  value: v.radialSpokes !== undefined ? v.radialSpokes : 12,
                  unit: ' rays',
                },
                {
                  key: 'vibration',
                  label: 'String tremor jitter',
                  type: 'range',
                  min: 0,
                  max: 2.0,
                  step: 0.1,
                  value: v.vibration !== undefined ? v.vibration : 0.4,
                  unit: 'x',
                },
                {
                  key: 'webColor',
                  label: 'Web string color',
                  type: 'color',
                  value: v.webColor || '#99e0ff',
                },
                {
                  key: 'silkJointsGlow',
                  label: 'Silk joints luminous glow',
                  type: 'checkbox',
                  value: v.silkJointsGlow !== undefined ? v.silkJointsGlow : true,
                },
              ],
            })
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
                    key: 'connectNodes',
                    label: 'Connect nodes (mesh)',
                    type: 'checkbox',
                    value: v.connectNodes !== undefined ? v.connectNodes : true,
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
            )
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
          })

          return grps
        },

        draw(v, dt) {
          const { W, H } = env
          env.time += dt

          if (!this.analysisCtx) this.init()

          // 1. Detect blobs from downsampled current frame
          const rawBlobs = this.detectBlobs(v)

          // 2. Temporally smooth blob bounding boxes and maintain node state
          this.updateTrackedBlobs(rawBlobs, v, dt)

          // 3. Render: Draw background media with dimming
          ctx.fillStyle = '#0a0b10'
          ctx.fillRect(0, 0, W, H)

          if (v.backgroundDim < 1) {
            ctx.save()
            ctx.globalAlpha = 1 - v.backgroundDim
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            ctx.restore()
          }

          // 4. Render selected variation
          const variation = v.variation || 'GLITCH ARROWS & HUD'
          if (variation === 'GLITCH ARROWS & HUD') {
            this.renderGlitchArrows(v, dt)
            const ptCount = this.trackedBlobs.reduce(
              (acc, b) => acc + (b.landmarks ? b.landmarks.length : 0),
              0,
            )
            return `${this.trackedBlobs.length || 1} tracked targets · ${ptCount || v.landmarkCount || 24} landmarks · Forensic HUD`
          } else if (variation === 'INTERCONNECTED WEB SWARM') {
            this.renderWebSwarm(v, dt)
            return `${this.trackedBlobs.length} tracked targets · ${this.webParticles.length} swarm filaments · Web Lattice`
          } else {
            this.renderTracking(v)
            return `${this.trackedBlobs.length} tracked blobs · ${this.trackedBlobs.reduce((acc, b) => acc + b.nodes.length, 0)} nodes`
          }
        },

        detectBlobs(v) {
          const { W, H } = env
          // Grid analysis resolution
          const GW = 96
          const GH = Math.max(24, Math.round(96 * (H / W)))

          if (
            this.analysisCanvas.width !== GW ||
            this.analysisCanvas.height !== GH
          ) {
            this.analysisCanvas.width = GW
            this.analysisCanvas.height = GH
            this.bgData = null
          }

          // Downsample current source frame into analysis canvas
          this.analysisCtx.drawImage(env.sourceCanvas, 0, 0, GW, GH)
          const currImgData = this.analysisCtx.getImageData(0, 0, GW, GH)
          const data = currImgData.data

          // Initialize background model on first run or dimension change
          if (!this.bgData || this.bgData.length !== GW * GH * 3) {
            this.bgData = new Float32Array(GW * GH * 3)
            for (let i = 0; i < GW * GH; i++) {
              this.bgData[i * 3] = data[i * 4]
              this.bgData[i * 3 + 1] = data[i * 4 + 1]
              this.bgData[i * 3 + 2] = data[i * 4 + 2]
            }
          }

          const energyGrid = new Float32Array(GW * GH)

          // Calibrated threshold based on sensitivity slider
          let threshold
          const sens = v.sensitivity !== undefined ? v.sensitivity : 0.45
          const mode = v.detectMode || 'hybrid'
          if (mode === 'motion') {
            threshold = 0.02 + (1 - sens) * 0.18
          } else if (mode === 'brightness') {
            threshold = 0.12 + (1 - sens) * 0.65
          } else {
            // hybrid
            threshold = 0.03 + (1 - sens) * 0.25
          }

          // Compute per-cell motion / brightness energy
          for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
              const idx = (y * GW + x) * 4
              const bgIdx = (y * GW + x) * 3
              const r = data[idx],
                g = data[idx + 1],
                b = data[idx + 2]
              const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255

              // Motion delta against background model
              const bgR = this.bgData[bgIdx]
              const bgG = this.bgData[bgIdx + 1]
              const bgB = this.bgData[bgIdx + 2]
              const motion =
                (Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB)) /
                (3 * 255)

              // Background model adaptation rate
              const adaptRate = 0.035
              this.bgData[bgIdx] += (r - bgR) * adaptRate
              this.bgData[bgIdx + 1] += (g - bgG) * adaptRate
              this.bgData[bgIdx + 2] += (b - bgB) * adaptRate

              let val = 0
              if (mode === 'motion') {
                val = motion
              } else if (mode === 'brightness') {
                val = luma
              } else {
                // hybrid: strong blend that works on both moving video and static subject photos
                val = Math.max(motion * 1.5, luma * 0.8)
              }

              energyGrid[y * GW + x] = val > threshold ? val : 0
            }
          }

          // Save current frame for next difference
          this.prevAnalysisData = currImgData

          // Connected components (flood fill) clustering
          const visited = new Uint8Array(GW * GH)
          const rawClusters = []

          for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
              const i = y * GW + x
              if (visited[i] || energyGrid[i] === 0) continue

              // BFS to find cluster
              let minX = x,
                maxX = x,
                minY = y,
                maxY = y
              let sumX = 0,
                sumY = 0,
                count = 0,
                sumEnergy = 0
              const queue = [x, y]
              visited[i] = 1

              while (queue.length > 0) {
                const qy = queue.pop()
                const qx = queue.pop()
                const qi = qy * GW + qx
                const e = energyGrid[qi]

                sumX += qx * e
                sumY += qy * e
                sumEnergy += e
                count++

                if (qx < minX) minX = qx
                if (qx > maxX) maxX = qx
                if (qy < minY) minY = qy
                if (qy > maxY) maxY = qy

                // 4-neighborhood
                const neighbors = [
                  [qx + 1, qy],
                  [qx - 1, qy],
                  [qx, qy + 1],
                  [qx, qy - 1],
                ]
                for (let k = 0; k < 4; k++) {
                  const nx = neighbors[k][0],
                    ny = neighbors[k][1]
                  if (nx >= 0 && nx < GW && ny >= 0 && ny < GH) {
                    const ni = ny * GW + nx
                    if (!visited[ni] && energyGrid[ni] > 0) {
                      visited[ni] = 1
                      queue.push(nx, ny)
                    }
                  }
                }
              }

              // Filter out noise
              const scaleX = W / GW
              const scaleY = H / GH
              const bw = (maxX - minX + 1) * scaleX
              const bh = (maxY - minY + 1) * scaleY
              const area = Math.max(bw, bh)
              const minSz = v.minSize !== undefined ? v.minSize : 25

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
                })
              }
            }
          }

          // Sort by mass and limit to maxBlobs
          rawClusters.sort((a, b) => b.mass - a.mass)
          const maxB = v.maxBlobs !== undefined ? v.maxBlobs : 5
          return rawClusters.slice(0, maxB)
        },

        updateTrackedBlobs(rawBlobs, v, dt) {
          const smooth = v.smoothing !== undefined ? v.smoothing : 0.25

          // Match rawBlobs to existing trackedBlobs by centroid distance
          const matched = new Set()
          const updated = []

          rawBlobs.forEach((raw) => {
            let bestDist = 180
            let bestBlob = null

            this.trackedBlobs.forEach((tb) => {
              if (matched.has(tb)) return
              const d = Math.hypot(tb.cx - raw.cx, tb.cy - raw.cy)
              if (d < bestDist) {
                bestDist = d
                bestBlob = tb
              }
            })

            if (bestBlob) {
              matched.add(bestBlob)
              // Lerp bounding box
              bestBlob.x += (raw.x - bestBlob.x) * (1 - smooth)
              bestBlob.y += (raw.y - bestBlob.y) * (1 - smooth)
              bestBlob.w += (raw.w - bestBlob.w) * (1 - smooth)
              bestBlob.h += (raw.h - bestBlob.h) * (1 - smooth)
              bestBlob.cx += (raw.cx - bestBlob.cx) * (1 - smooth)
              bestBlob.cy += (raw.cy - bestBlob.cy) * (1 - smooth)
              bestBlob.mass = raw.mass
              bestBlob.life = Math.min(1, bestBlob.life + dt * 4)
              this.syncNodes(bestBlob, v)
              this.syncLandmarks(bestBlob, v)
              updated.push(bestBlob)
            } else {
              // New blob
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
              }
              this.syncNodes(newBlob, v)
              this.syncLandmarks(newBlob, v)
              updated.push(newBlob)
            }
          })

          this.trackedBlobs = updated
        },

        // --- VARIATION 1: GLITCH ARROWS & HUD (Photogrammetry / Computer Vision Tracking) ---
        syncLandmarks(blob, v) {
          if (!blob.landmarks) blob.landmarks = []
          const count = v.landmarkCount !== undefined ? v.landmarkCount : 24
          const crosshairColors = ['#00f0ff', '#ff00aa', '#ffff00', '#ffffff', '#00ff66']

          while (blob.landmarks.length < count) {
            const idx = blob.landmarks.length
            // Distribute points across 3 feature clusters (top flower cluster, right fingers/hand cluster, lower stem/wrist)
            let rx, ry, sGroup
            if (idx < count * 0.40) {
              // Cluster 0: Upper feature group (flowers / top subject)
              rx = (Math.random() - 0.5) * 0.55
              ry = -0.15 - Math.random() * 0.35
              sGroup = 0
            } else if (idx < count * 0.75) {
              // Cluster 1: Mid-right feature group (fingers / lateral structure)
              rx = 0.08 + Math.random() * 0.42
              ry = -0.05 + Math.random() * 0.45
              sGroup = 1
            } else {
              // Cluster 2: Lower anchor group (stem / palm / wrist)
              rx = (Math.random() - 0.5) * 0.45
              ry = 0.12 + Math.random() * 0.38
              sGroup = 2
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
            })
          }
          if (blob.landmarks.length > count) {
            blob.landmarks.length = count
          }
        },

        renderGlitchEffects(blobs, v) {
          const { W, H } = env
          const intensity = v.glitchIntensity !== undefined ? v.glitchIntensity : 0.65
          if (intensity <= 0.01) return

          ctx.save()

          // 1. Horizontal Slices Displacement with Chromatic Aberration
          const numSlices = Math.floor(4 + intensity * 14)
          for (let i = 0; i < numSlices; i++) {
            const b = blobs[Math.floor(Math.random() * blobs.length)]
            const sy = Math.max(0, Math.min(H - 16, b.y + Math.random() * b.h))
            const sh = Math.floor(3 + Math.random() * 16)
            const sx = Math.max(0, b.x - 20)
            const sw = Math.min(W - sx, b.w + 40)
            const dx = (Math.random() - 0.5) * 44 * intensity

            if (sw <= 4 || sh <= 2) continue

            // Shifted slice clip
            ctx.save()
            ctx.beginPath()
            ctx.rect(sx, sy, sw, sh)
            ctx.clip()

            // Displaced source slice
            ctx.drawImage(env.sourceCanvas, sx, sy, sw, sh, sx + dx, sy, sw, sh)

            const rgbSplit = v.rgbSplit !== undefined ? v.rgbSplit : 6
            if (rgbSplit > 0) {
              // Red chromatic shift
              ctx.globalCompositeOperation = 'screen'
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
              )
              ctx.fillStyle = 'rgba(255, 30, 40, 0.32)'
              ctx.fillRect(sx + dx, sy, sw, sh)

              // Cyan chromatic shift
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
              )
              ctx.fillStyle = 'rgba(0, 230, 255, 0.32)'
              ctx.fillRect(sx + dx, sy, sw, sh)
            }
            ctx.restore()
          }

          // 2. Digital Glitch / Datamosh Blocks (matching reference images.jpeg)
          if (v.blockArtifacts) {
            const blockCount = Math.floor(6 + intensity * 22)
            const blockColors = [
              '#ff3b30',
              '#ff9500',
              '#00e5ff',
              '#34c759',
              '#af52de',
              '#ffffff',
              '#ffd60a',
            ]
            for (let i = 0; i < blockCount; i++) {
              const b = blobs[Math.floor(Math.random() * blobs.length)]
              const bw = Math.floor(4 + Math.random() * 14)
              const bh = Math.floor(4 + Math.random() * 12)
              const bx = Math.max(
                0,
                Math.min(W - bw, b.x + Math.random() * b.w + (Math.random() - 0.5) * 30),
              )
              const by = Math.max(
                0,
                Math.min(H - bh, b.y + Math.random() * b.h + (Math.random() - 0.5) * 30),
              )

              if (Math.random() < 0.45) {
                // Pixelated color noise block
                ctx.fillStyle =
                  blockColors[Math.floor(Math.random() * blockColors.length)]
                ctx.globalAlpha = 0.35 + Math.random() * 0.45
                ctx.fillRect(bx, by, bw, bh)
              } else {
                // Datamosh pixel stretch block
                ctx.save()
                ctx.imageSmoothingEnabled = false
                ctx.globalAlpha = 0.75
                const srcX = Math.max(
                  0,
                  Math.min(W - 4, bx + (Math.random() - 0.5) * 16),
                )
                const srcY = Math.max(
                  0,
                  Math.min(H - 4, by + (Math.random() - 0.5) * 16),
                )
                ctx.drawImage(env.sourceCanvas, srcX, srcY, 4, 4, bx, by, bw, bh)
                ctx.restore()
              }
            }
          }

          ctx.restore()
        },

        renderGlitchArrows(v, dt) {
          const { W, H, time } = env
          let blobs = this.trackedBlobs
          if (blobs.length === 0) {
            // Graceful subject fallback target framing the canvas content
            blobs = [
              {
                id: 701,
                x: W * 0.20,
                y: H * 0.12,
                w: W * 0.60,
                h: H * 0.76,
                cx: W * 0.50,
                cy: H * 0.50,
                life: 1.0,
                mass: 120,
                landmarks: [],
              },
            ]
          }

          // 1. Render Glitch artifacts (displacement & datamosh blocks)
          this.renderGlitchEffects(blobs, v)

          // 2. Render Photogrammetry HUD & Vectors
          blobs.forEach((b) => {
            this.syncLandmarks(b, v)

            const pts = b.landmarks.map((lm) => {
              const jitterX = Math.sin(time * lm.speed + lm.phase) * (b.w * 0.018)
              const jitterY = Math.cos(time * lm.speed * 1.1 + lm.phase) * (b.h * 0.018)
              return {
                x: Math.max(6, Math.min(W - 6, b.cx + lm.relX * b.w + jitterX)),
                y: Math.max(6, Math.min(H - 6, b.cy + lm.relY * b.h + jitterY)),
                id: lm.id,
                hasCrosshair: lm.hasCrosshair,
                crosshairColor: lm.crosshairColor,
                showLabel: lm.showLabel,
                subGroup: lm.subGroup,
              }
            })

            // A. Hierarchical Wireframe Bounding Boxes (Red & Cyan)
            if (v.showBoxes !== false) {
              ctx.save()
              ctx.strokeStyle = v.boxColor || '#ff2626'
              ctx.lineWidth = 1.0

              // 1. Outer full bounding box
              ctx.strokeRect(b.x, b.y, b.w, b.h)

              // Canvas-wide vertical reference lines (as seen in reference images.jpeg)
              ctx.beginPath()
              ctx.moveTo(b.x, 0)
              ctx.lineTo(b.x, H)
              ctx.moveTo(b.x + b.w, 0)
              ctx.lineTo(b.x + b.w, H)
              ctx.moveTo(b.x + b.w * 0.86, 0)
              ctx.lineTo(b.x + b.w * 0.86, H)
              ctx.stroke()

              // 2. Sub-cluster red boxes (framing dense feature sub-groups)
              const groups = [0, 1, 2]
              groups.forEach((gId) => {
                const gPts = pts.filter((p) => p.subGroup === gId)
                if (gPts.length >= 2) {
                  let minX = Infinity,
                    maxX = -Infinity,
                    minY = Infinity,
                    maxY = -Infinity
                  gPts.forEach((p) => {
                    if (p.x < minX) minX = p.x
                    if (p.x > maxX) maxX = p.x
                    if (p.y < minY) minY = p.y
                    if (p.y > maxY) maxY = p.y
                  })
                  const pad = 12
                  const bx = Math.max(0, minX - pad)
                  const by = Math.max(0, minY - pad)
                  const bw = Math.min(W - bx, maxX - minX + pad * 2)
                  const bh = Math.min(H - by, maxY - minY + pad * 2)

                  ctx.strokeRect(bx, by, bw, bh)

                  if (v.showCoordinates !== false) {
                    ctx.font = '9px monospace'
                    ctx.fillStyle = v.boxColor || '#ff2626'
                    ctx.fillText(
                      `x: ${Math.round(bx)} y: ${Math.round(by)}`,
                      bx + 3,
                      by - 4,
                    )
                  }
                }
              })

              // 3. Cyan highlight bounding box (framing the secondary cluster, e.g. fingers/hand)
              if (v.cyanHighlight !== false) {
                const cyanPts = pts.filter((p) => p.subGroup === 1)
                if (cyanPts.length > 0) {
                  let minX = Infinity,
                    maxX = -Infinity,
                    minY = Infinity,
                    maxY = -Infinity
                  cyanPts.forEach((p) => {
                    if (p.x < minX) minX = p.x
                    if (p.x > maxX) maxX = p.x
                    if (p.y < minY) minY = p.y
                    if (p.y > maxY) maxY = p.y
                  })
                  const pad = 14
                  const cx = Math.max(0, minX - pad)
                  const cy = Math.max(0, minY - pad)
                  const cw = Math.min(W - cx, maxX - minX + pad * 2)
                  const ch = Math.min(H - cy, maxY - minY + pad * 2)

                  ctx.strokeStyle = '#00e5ff'
                  ctx.lineWidth = 1.2
                  ctx.strokeRect(cx, cy, cw, ch)

                  if (v.showCoordinates !== false) {
                    ctx.font = '9px monospace'
                    ctx.fillStyle = '#00e5ff'
                    ctx.fillText(
                      `x: ${Math.round(cx)} y: ${Math.round(cy)}`,
                      cx + 4,
                      cy - 4,
                    )
                  }
                }
              }

              // 4. Micro feature boxes around 2-3 specific landmarks
              for (let i = 0; i < Math.min(3, pts.length); i++) {
                const p = pts[i]
                ctx.strokeStyle = v.boxColor || '#ff2626'
                ctx.lineWidth = 0.9
                const msz = 18
                ctx.strokeRect(p.x - msz / 2, p.y - msz / 2, msz, msz)
              }

              ctx.restore()
            }

            // B. Directed Dashed Vector Arrows (--->)
            ctx.save()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)'
            ctx.lineWidth = 1.1
            ctx.setLineDash([4, 4])

            const maxArrows = v.arrowDensity !== undefined ? v.arrowDensity : 14
            let arrowsDrawn = 0

            for (let i = 0; i < pts.length && arrowsDrawn < maxArrows; i++) {
              let bestTarget = null
              let bestDist = Infinity
              for (let j = 0; j < pts.length; j++) {
                if (i === j) continue
                const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
                if (d > 22 && d < b.w * 0.65 && d < bestDist) {
                  bestDist = d
                  bestTarget = pts[j]
                }
              }

              if (bestTarget && bestDist < Infinity) {
                const p1 = pts[i]
                const p2 = bestTarget

                // Dashed vector line
                ctx.beginPath()
                ctx.moveTo(p1.x, p1.y)
                ctx.lineTo(p2.x, p2.y)
                ctx.stroke()

                // Vector arrowhead at destination (p2)
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
                const arrowLen = 7
                const arrowAngle = 0.44
                ctx.beginPath()
                ctx.moveTo(p2.x, p2.y)
                ctx.lineTo(
                  p2.x - arrowLen * Math.cos(angle - arrowAngle),
                  p2.y - arrowLen * Math.sin(angle - arrowAngle),
                )
                ctx.moveTo(p2.x, p2.y)
                ctx.lineTo(
                  p2.x - arrowLen * Math.cos(angle + arrowAngle),
                  p2.y - arrowLen * Math.sin(angle + arrowAngle),
                )
                ctx.stroke()

                arrowsDrawn++
              }
            }

            // Prominent dashed circular arc in center with vector arrowhead (matching images.jpeg)
            const arcR = Math.max(12, Math.min(b.w || 60, b.h || 60) * 0.28)
            ctx.beginPath()
            ctx.arc(b.cx, b.cy, arcR, -0.65 * Math.PI, 0.38 * Math.PI)
            ctx.stroke()

            const endAngle = 0.38 * Math.PI
            const ax = b.cx + arcR * Math.cos(endAngle)
            const ay = b.cy + arcR * Math.sin(endAngle)
            const tangAngle = endAngle + Math.PI / 2
            const arcArrowLen = 7
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(
              ax - arcArrowLen * Math.cos(tangAngle - 0.42),
              ay - arcArrowLen * Math.sin(tangAngle - 0.42),
            )
            ctx.moveTo(ax, ay)
            ctx.lineTo(
              ax - arcArrowLen * Math.cos(tangAngle + 0.42),
              ay - arcArrowLen * Math.sin(tangAngle + 0.42),
            )
            ctx.stroke()

            ctx.restore()

            // C. Landmark Keypoint Dots & Crosshairs & Coordinates
            ctx.save()
            pts.forEach((p) => {
              // 1. Bright lime-green landmark dot
              ctx.fillStyle = v.dotColor || '#00ff66'
              ctx.beginPath()
              ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = '#051108'
              ctx.lineWidth = 1.0
              ctx.stroke()

              // 2. Micro crosshair (+) on selected points
              if (p.hasCrosshair) {
                const cs = 5
                ctx.strokeStyle = p.crosshairColor || '#00ffff'
                ctx.lineWidth = 1.0
                ctx.beginPath()
                ctx.moveTo(p.x - cs, p.y)
                ctx.lineTo(p.x + cs, p.y)
                ctx.moveTo(p.x, p.y - cs)
                ctx.lineTo(p.x, p.y + cs)
                ctx.stroke()
              }

              // 3. Monospace Coordinate Tag: x: [val] y: [val]
              if (v.showCoordinates !== false && p.showLabel) {
                ctx.font = '9px monospace'
                const tag = `x: ${Math.round(p.x)} y: ${Math.round(p.y)}`
                const tw = ctx.measureText(tag).width
                ctx.fillStyle = 'rgba(10, 12, 16, 0.72)'
                ctx.fillRect(p.x + 5, p.y - 7, tw + 4, 10)
                ctx.fillStyle = '#f0f3f6'
                ctx.fillText(tag, p.x + 7, p.y + 1)
              }
            })
            ctx.restore()
          })
        },

        // --- VARIATION 2: INTERCONNECTED WEB SWARM ---
        renderWebSwarm(v, dt) {
          const { W, H, time } = env
          let blobs = this.trackedBlobs

          const targetCount = v.swarmCount !== undefined ? v.swarmCount : 80
          if (!this.webParticles) this.webParticles = []

          while (this.webParticles.length < targetCount) {
            this.webParticles.push({
              x: Math.random() * W,
              y: Math.random() * H,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              phase: Math.random() * Math.PI * 2,
              speed: 0.8 + Math.random() * 1.5,
              mass: 0.8 + Math.random() * 0.5,
            })
          }
          if (this.webParticles.length > targetCount) {
            this.webParticles.length = targetCount
          }

          const attract = v.swarmAttract !== undefined ? v.swarmAttract : 1.4
          const tension = v.stringTension !== undefined ? v.stringTension : 0.65
          const reach = v.webReach !== undefined ? v.webReach : 120
          const vib = v.vibration !== undefined ? v.vibration : 0.4
          const webColor = v.webColor || '#99e0ff'

          // Swarm Physics Simulation
          this.webParticles.forEach((p) => {
            if (blobs.length > 0) {
              // Find nearest tracked blob
              let nearB = blobs[0]
              let nearDist = Math.hypot(blobs[0].cx - p.x, blobs[0].cy - p.y)
              for (let i = 1; i < blobs.length; i++) {
                const d = Math.hypot(blobs[i].cx - p.x, blobs[i].cy - p.y)
                if (d < nearDist) {
                  nearDist = d
                  nearB = blobs[i]
                }
              }

              const dx = nearB.cx - p.x
              const dy = nearB.cy - p.y
              const dist = Math.hypot(dx, dy) || 1

              // Gravitational swarm attraction force
              const force = (attract * 340) / Math.max(35, dist)
              const nx = dx / dist
              const ny = dy / dist

              p.vx += nx * force * dt * 2.5
              p.vy += ny * force * dt * 2.5

              // Orbital tangential swirl around the blob centroid
              p.vx += -ny * force * 0.45 * dt
              p.vy += nx * force * 0.45 * dt

              // Repulsion core preventing collapse into a single pixel
              if (dist < nearB.w * 0.22) {
                p.vx -= nx * 85 * dt
                p.vy -= ny * 85 * dt
              }
            } else {
              // Ambient gentle float when no target active
              p.vx += Math.sin(time * p.speed + p.phase) * 12 * dt
              p.vy += Math.cos(time * p.speed * 0.9 + p.phase) * 12 * dt
            }

            // Drag / friction damping
            p.vx *= 0.93
            p.vy *= 0.93
            p.x += p.vx
            p.y += p.vy

            // Canvas boundary constraints
            if (p.x < 10) {
              p.x = 10
              p.vx *= -0.5
            }
            if (p.x > W - 10) {
              p.x = W - 10
              p.vx *= -0.5
            }
            if (p.y < 10) {
              p.y = 10
              p.vy *= -0.5
            }
            if (p.y > H - 10) {
              p.y = H - 10
              p.vy *= -0.5
            }
          })

          ctx.save()

          // 1. Interconnected Web Strings between particles
          ctx.strokeStyle = webColor
          ctx.lineWidth = 0.85

          const n = this.webParticles.length
          for (let i = 0; i < n; i++) {
            const p1 = this.webParticles[i]
            const jit1X = Math.sin(time * 26 + p1.phase) * vib * 1.5
            const jit1Y = Math.cos(time * 26 + p1.phase) * vib * 1.5
            const x1 = p1.x + jit1X
            const y1 = p1.y + jit1Y

            for (let j = i + 1; j < n; j++) {
              const p2 = this.webParticles[j]
              const d = Math.hypot(p1.x - p2.x, p1.y - p2.y)
              if (d < reach) {
                const alpha = (1 - d / reach) * 0.68
                ctx.globalAlpha = alpha

                const jit2X = Math.sin(time * 26 + p2.phase) * vib * 1.5
                const jit2Y = Math.cos(time * 26 + p2.phase) * vib * 1.5
                const x2 = p2.x + jit2X
                const y2 = p2.y + jit2Y

                if (tension < 0.95) {
                  // Catenary tension sag curve
                  const midX = (x1 + x2) / 2
                  const midY = (y1 + y2) / 2
                  const sag = (1 - tension) * 14
                  ctx.beginPath()
                  ctx.moveTo(x1, y1)
                  ctx.quadraticCurveTo(midX, midY + sag, x2, y2)
                  ctx.stroke()
                } else {
                  ctx.beginPath()
                  ctx.moveTo(x1, y1)
                  ctx.lineTo(x2, y2)
                  ctx.stroke()
                }
              }
            }
          }

          // 2. Radial Anchor Threads from Blobs
          blobs.forEach((b) => {
            const spokes = v.radialSpokes !== undefined ? v.radialSpokes : 12
            const sortedByDist = [...this.webParticles].sort((a, bPt) => {
              return (
                Math.hypot(a.x - b.cx, a.y - b.cy) -
                Math.hypot(bPt.x - b.cx, bPt.y - b.cy)
              )
            })

            ctx.lineWidth = 1.0
            for (let k = 0; k < Math.min(spokes, sortedByDist.length); k++) {
              const targetP = sortedByDist[k]
              const d = Math.hypot(targetP.x - b.cx, targetP.y - b.cy)
              ctx.globalAlpha = Math.max(
                0.2,
                Math.min(0.85, 1 - d / (b.w * 1.3)),
              )
              ctx.beginPath()
              ctx.moveTo(b.cx, b.cy)
              ctx.lineTo(targetP.x, targetP.y)
              ctx.stroke()
            }

            // Concentric web rings around centroid
            const rings = 3
            ctx.lineWidth = 0.75
            for (let r = 1; r <= rings; r++) {
              const radius = Math.max(4, (b.w || 40) * 0.16 * r + Math.sin(time * 2 + r) * 3)
              ctx.globalAlpha = 0.45 / r
              ctx.beginPath()
              ctx.arc(b.cx, b.cy, radius, 0, Math.PI * 2)
              ctx.stroke()
            }
          })

          // 3. Silk Joint Nodes
          if (v.silkJointsGlow !== false) {
            ctx.shadowColor = webColor
            ctx.shadowBlur = 6
          }
          this.webParticles.forEach((p) => {
            ctx.globalAlpha = 0.85
            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
            ctx.fill()
          })

          ctx.restore()
        },

        // --- VARIATION 3: SCATTER NODES (Classic CCTV / Edit Box Preserved 100%) ---
        syncNodes(blob, v) {
          const targetCount = v.nodeCount !== undefined ? v.nodeCount : 16
          while (blob.nodes.length < targetCount) {
            blob.nodes.push({
              relX: (Math.random() - 0.5) * 0.85,
              relY: (Math.random() - 0.5) * 0.85,
              phase: Math.random() * TAU,
              speed: 0.8 + Math.random() * 1.6,
              shape: this.pickShape(v.nodeShape || 'square'),
              scale: 0.7 + Math.random() * 0.6,
            })
          }
          if (blob.nodes.length > targetCount) {
            blob.nodes.length = targetCount
          }
          // Update shape if changed
          blob.nodes.forEach((n) => {
            if (v.nodeShape && v.nodeShape !== 'mixed') {
              n.shape = v.nodeShape
            }
          })
        },

        pickShape(shapePref) {
          if (shapePref !== 'mixed') return shapePref
          const shapes = [
            'square',
            'diamond',
            'bracket',
            'crosshair',
            'circle',
            'triangle',
          ]
          return shapes[Math.floor(Math.random() * shapes.length)]
        },

        renderTracking(v) {
          const { time } = env

          this.trackedBlobs.forEach((b) => {
            const alpha = Math.min(1, b.life)
            ctx.save()
            ctx.globalAlpha = alpha

            // 1. Edit Mode Bounding Box & Handles
            if (v.showBoundingBox !== false) {
              ctx.strokeStyle = v.boxColor || '#00ff88'
              ctx.lineWidth = 1
              ctx.strokeRect(b.x, b.y, b.w, b.h)

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
                ]
                const hs = 5
                ctx.fillStyle = '#ffffff'
                ctx.strokeStyle = v.boxColor || '#00ff88'
                ctx.lineWidth = 1
                handles.forEach(([hx, hy]) => {
                  ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
                  ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
                })
              }
            }

            // 2. CCTV Corner Brackets
            if (v.showBrackets !== false) {
              const bl = Math.min(14, b.w * 0.25, b.h * 0.25)
              ctx.strokeStyle = v.boxColor || '#00ff88'
              ctx.lineWidth = 1.5

              // Top-left
              ctx.beginPath()
              ctx.moveTo(b.x, b.y + bl)
              ctx.lineTo(b.x, b.y)
              ctx.lineTo(b.x + bl, b.y)
              // Top-right
              ctx.moveTo(b.x + b.w - bl, b.y)
              ctx.lineTo(b.x + b.w, b.y)
              ctx.lineTo(b.x + b.w, b.y + bl)
              // Bottom-left
              ctx.moveTo(b.x, b.y + b.h - bl)
              ctx.lineTo(b.x, b.y + b.h)
              ctx.lineTo(b.x + bl, b.y + b.h)
              // Bottom-right
              ctx.moveTo(b.x + b.w - bl, b.y + b.h)
              ctx.lineTo(b.x + b.w, b.y + b.h)
              ctx.lineTo(b.x + b.w, b.y + b.h - bl)
              ctx.stroke()
            }

            // 3. Centroid Crosshair
            if (v.showCrosshair !== false) {
              const cs = 7
              ctx.strokeStyle = v.accentColor || '#ffffff'
              ctx.lineWidth = 1
              ctx.beginPath()
              ctx.moveTo(b.cx - cs, b.cy)
              ctx.lineTo(b.cx + cs, b.cy)
              ctx.moveTo(b.cx, b.cy - cs)
              ctx.lineTo(b.cx, b.cy + cs)
              ctx.stroke()
            }

            // 4. Tech HUD Labels
            if (v.showLabels !== false) {
              ctx.font = '9px monospace'
              const label = `ID#${b.id} [${Math.round(b.cx)},${Math.round(b.cy)}] ${Math.round(b.w)}x${Math.round(b.h)}`
              const tw = ctx.measureText(label).width
              ctx.fillStyle = 'rgba(10, 12, 18, 0.75)'
              ctx.fillRect(b.x, b.y - 14, tw + 8, 12)
              ctx.strokeStyle = v.boxColor || '#00ff88'
              ctx.strokeRect(b.x, b.y - 14, tw + 8, 12)
              ctx.fillStyle = v.boxColor || '#00ff88'
              ctx.fillText(label, b.x + 4, b.y - 5)
            }

            // Calculate animated node positions
            const computedNodes = b.nodes.map((n) => {
              const jit = v.jitter !== undefined ? v.jitter : 1.2
              const ox = Math.sin(time * n.speed + n.phase) * (b.w * 0.18 * jit)
              const oy =
                Math.cos(time * n.speed * 1.2 + n.phase) * (b.h * 0.18 * jit)
              return {
                x: b.cx + n.relX * b.w + ox,
                y: b.cy + n.relY * b.h + oy,
                shape: n.shape,
                size: (v.nodeSize !== undefined ? v.nodeSize : 8) * n.scale,
              }
            })

            // 5. Connect Nodes (Mesh wireframe)
            if (v.connectNodes !== false && computedNodes.length > 1) {
              ctx.save()
              ctx.strokeStyle = v.nodeColor || '#00ff88'
              ctx.lineWidth = 0.75
              const maxDist = Math.max(b.w, b.h) * 0.45

              for (let i = 0; i < computedNodes.length; i++) {
                for (let j = i + 1; j < computedNodes.length; j++) {
                  const d = Math.hypot(
                    computedNodes[i].x - computedNodes[j].x,
                    computedNodes[i].y - computedNodes[j].y,
                  )
                  if (d < maxDist) {
                    ctx.globalAlpha = alpha * (1 - d / maxDist) * 0.4
                    ctx.beginPath()
                    ctx.moveTo(computedNodes[i].x, computedNodes[i].y)
                    ctx.lineTo(computedNodes[j].x, computedNodes[j].y)
                    ctx.stroke()
                  }
                }
              }
              ctx.restore()
            }

            // 6. Draw Scattered Nodes
            ctx.save()
            const blend = v.blendMode || 'source-over'
            if (blend !== 'source-over') {
              ctx.globalCompositeOperation = blend
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
              )
            })
            ctx.restore()

            ctx.restore()
          })
        },

        drawNodeShape(x, y, s, shape, color, accentColor, idx) {
          ctx.save()
          ctx.translate(x, y)

          if (shape === 'square') {
            ctx.fillStyle = color
            ctx.fillRect(-s / 2, -s / 2, s, s)
            ctx.strokeStyle = accentColor
            ctx.lineWidth = 1
            ctx.strokeRect(-s / 2, -s / 2, s, s)
          } else if (shape === 'diamond') {
            ctx.rotate(Math.PI / 4)
            ctx.fillStyle = color
            ctx.fillRect(-s / 2, -s / 2, s, s)
            ctx.strokeStyle = accentColor
            ctx.lineWidth = 1
            ctx.strokeRect(-s / 2, -s / 2, s, s)
          } else if (shape === 'bracket') {
            ctx.strokeStyle = color
            ctx.lineWidth = 1.5
            const hs = s * 0.6
            ctx.beginPath()
            ctx.moveTo(-hs, 0)
            ctx.lineTo(-hs, -hs)
            ctx.lineTo(0, -hs)
            ctx.moveTo(hs, 0)
            ctx.lineTo(hs, hs)
            ctx.lineTo(0, hs)
            ctx.stroke()
          } else if (shape === 'crosshair') {
            ctx.strokeStyle = color
            ctx.lineWidth = 1.2
            const hs = s * 0.6
            ctx.beginPath()
            ctx.moveTo(-hs, 0)
            ctx.lineTo(hs, 0)
            ctx.moveTo(0, -hs)
            ctx.lineTo(0, hs)
            ctx.stroke()
            ctx.fillStyle = accentColor
            ctx.fillRect(-1, -1, 2, 2)
          } else if (shape === 'circle') {
            ctx.beginPath()
            ctx.arc(0, 0, s / 2, 0, TAU)
            ctx.strokeStyle = color
            ctx.lineWidth = 1.2
            ctx.stroke()
            ctx.fillStyle = accentColor
            ctx.beginPath()
            ctx.arc(0, 0, s / 4, 0, TAU)
            ctx.fill()
          } else if (shape === 'triangle') {
            const hs = s * 0.6
            ctx.beginPath()
            ctx.moveTo(0, -hs)
            ctx.lineTo(hs, hs * 0.8)
            ctx.lineTo(-hs, hs * 0.8)
            ctx.closePath()
            ctx.fillStyle = color
            ctx.fill()
            ctx.strokeStyle = accentColor
            ctx.lineWidth = 1
            ctx.stroke()
          }
          ctx.restore()
        },
      }

export default blobTracker;
export { blobTracker };
