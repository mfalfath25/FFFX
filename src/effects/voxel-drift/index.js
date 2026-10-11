import { env, canvas, ctx } from '../../core/env.js';
import { hash } from '../../core/sat.js';

      const voxelDrift = {
        id: 'voxel-drift',
        label: 'voxel-drift',

        // Persistent analysis state
        analysisCanvas: document.createElement('canvas'),
        analysisCtx: null,
        bgData: null,
        energyGrid: null,
        gridW: 0,
        gridH: 0,
        subjectBounds: { cx: 0, cy: 0, w: 0, h: 0, active: false },

        init() {
          this.analysisCtx = this.analysisCanvas.getContext('2d', {
            willReadFrequently: true,
          })
        },

        groups: [
          {
            title: 'Dispersal Grid & Detection',
            controls: [
              {
                key: 'variation',
                label: 'Voxel style',
                type: 'select',
                options: ['DISPERSAL VOID'],
                value: 'DISPERSAL VOID',
              },
              {
                key: 'voxelSize',
                label: 'Voxel resolution',
                type: 'range',
                min: 10,
                max: 56,
                step: 2,
                value: 20,
                unit: 'px',
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
                label: 'Motion sensitivity',
                type: 'range',
                min: 0.05,
                max: 0.95,
                step: 0.01,
                value: 0.45,
                unit: '',
              },
            ],
          },
          {
            title: 'Dispersal & Drift Dynamics',
            controls: [
              {
                key: 'driftAmount',
                label: 'Displacement drift',
                type: 'range',
                min: 0,
                max: 3.5,
                step: 0.1,
                value: 1.4,
                unit: 'x',
              },
              {
                key: 'motionResponse',
                label: 'Motion burst reaction',
                type: 'range',
                min: 0,
                max: 4.0,
                step: 0.1,
                value: 2.0,
                unit: 'x',
              },
              {
                key: 'driftSpeed',
                label: 'Dispersal speed',
                type: 'range',
                min: 0.1,
                max: 3.0,
                step: 0.1,
                value: 1.1,
                unit: 'x',
              },
              {
                key: 'backgroundCutout',
                label: 'Isolate dispersing subject',
                type: 'checkbox',
                value: true,
              },
              {
                key: 'backgroundDim',
                label: 'Background void darkness',
                type: 'range',
                min: 0,
                max: 1.0,
                step: 0.05,
                value: 1.0,
                unit: '',
              },
            ],
          },
          {
            title: 'Neon Perimeter Seams',
            controls: [
              {
                key: 'wireframeEdges',
                label: 'Neon perimeter seams',
                type: 'checkbox',
                value: true,
              },
              {
                key: 'customEdgeColor',
                label: 'Perimeter seam color',
                type: 'color',
                value: '#ff2626',
              },
            ],
          },
        ],

        getGroups(v) {
          return this.groups
        },

        draw(v, dt) {
          const { W, H } = env
          env.time += dt

          if (!this.analysisCtx) this.init()

          const sz = Math.max(10, Math.min(64, Math.round(v.voxelSize || 20)))
          const cols = Math.ceil(W / sz)
          const rows = Math.ceil(H / sz)

          // 1. Update Motion & Subject Detection Energy Grid
          this.updateEnergyGrid(v, cols, rows, sz)

          // 2. Render Dispersal Void
          const activeVoxels = this.renderDispersalVoid(v, cols, rows, sz, dt)

          return `${activeVoxels} voxels dispersed · Dispersal Void · Motion Tracked`
        },

        updateEnergyGrid(v, cols, rows, sz) {
          const { W, H } = env
          if (this.gridW !== cols || this.gridH !== rows) {
            this.gridW = cols
            this.gridH = rows
            this.analysisCanvas.width = cols
            this.analysisCanvas.height = rows
            this.bgData = null
            this.energyGrid = new Float32Array(cols * rows)
          }

          this.analysisCtx.drawImage(env.sourceCanvas, 0, 0, cols, rows)
          const imgData = this.analysisCtx.getImageData(0, 0, cols, rows)
          const d = imgData.data

          if (!this.bgData || this.bgData.length !== cols * rows * 3) {
            this.bgData = new Float32Array(cols * rows * 3)
            for (let i = 0; i < cols * rows; i++) {
              this.bgData[i * 3] = d[i * 4]
              this.bgData[i * 3 + 1] = d[i * 4 + 1]
              this.bgData[i * 3 + 2] = d[i * 4 + 2]
            }
          }

          const sens = v.sensitivity !== undefined ? v.sensitivity : 0.45
          const mode = v.detectMode || 'hybrid'
          let minThreshold = 0.05 + (1 - sens) * 0.35

          let sumX = 0, sumY = 0, sumEnergy = 0, count = 0
          let minX = cols, maxX = 0, minY = rows, maxY = 0

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const idx = (r * cols + c) * 4
              const bgIdx = (r * cols + c) * 3
              const red = d[idx], green = d[idx + 1], blue = d[idx + 2]
              const luma = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

              const bgR = this.bgData[bgIdx]
              const bgG = this.bgData[bgIdx + 1]
              const bgB = this.bgData[bgIdx + 2]
              const motion = (Math.abs(red - bgR) + Math.abs(green - bgG) + Math.abs(blue - bgB)) / (3 * 255)

              // Update background model
              this.bgData[bgIdx] += (red - bgR) * 0.03
              this.bgData[bgIdx + 1] += (green - bgG) * 0.03
              this.bgData[bgIdx + 2] += (blue - bgB) * 0.03

              let rawEnergy = 0
              if (mode === 'motion') {
                rawEnergy = motion * 2.2
              } else if (mode === 'brightness') {
                rawEnergy = luma * 1.2
              } else {
                // hybrid: combines motion bursts with subject brightness silhouette
                rawEnergy = Math.max(motion * 2.0, luma * 0.9)
              }

              // Smooth decay on energy grid
              const cellIdx = r * cols + c
              const prev = this.energyGrid[cellIdx] || 0
              const curr = Math.max(rawEnergy, prev * 0.88)
              this.energyGrid[cellIdx] = curr

              if (curr > minThreshold) {
                sumX += (c + 0.5) * sz
                sumY += (r + 0.5) * sz
                sumEnergy += curr
                count++
                if (c < minX) minX = c
                if (c > maxX) maxX = c
                if (r < minY) minY = r
                if (r > maxY) maxY = r
              }
            }
          }

          if (count > 3 && sumEnergy > 0) {
            this.subjectBounds = {
              cx: sumX / sumEnergy,
              cy: sumY / sumEnergy,
              w: Math.max(sz * 2, (maxX - minX + 1) * sz),
              h: Math.max(sz * 2, (maxY - minY + 1) * sz),
              active: true,
            }
          } else {
            // Graceful center fallback if quiet
            this.subjectBounds = {
              cx: W * 0.5,
              cy: H * 0.5,
              w: W * 0.55,
              h: H * 0.70,
              active: false,
            }
          }
        },

        // --- DISPERSAL VOID ---
        renderDispersalVoid(v, cols, rows, sz, dt) {
          const { W, H, time } = env
          const drift = v.driftAmount !== undefined ? v.driftAmount : 1.4
          const speed = v.driftSpeed !== undefined ? v.driftSpeed : 1.1
          const motionResp = v.motionResponse !== undefined ? v.motionResponse : 2.0
          const sens = v.sensitivity !== undefined ? v.sensitivity : 0.45
          const cutoff = (1 - sens) * 0.22
          const redSeam = v.customEdgeColor || '#ff2626'
          const sub = this.subjectBounds

          let activeCount = 0
          ctx.save()

          // Pure black background for high contrast void
          const dim = v.backgroundDim !== undefined ? v.backgroundDim : 1.0
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, W, H)

          if (!v.backgroundCutout && dim < 1.0) {
            ctx.save()
            ctx.globalAlpha = 1 - dim
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            ctx.restore()
          }

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const e = this.energyGrid[r * cols + c] || 0
              if (v.backgroundCutout && e < cutoff) continue

              const sx = c * sz
              const sy = r * sz
              if (sx >= W || sy >= H) continue

              // Aggressive void dispersal drift
              const angle = Math.atan2(sy - sub.cy, sx - sub.cx)
              const kick = Math.sin(time * speed * 2 + c * 0.5 + r * 0.4) * (24 * drift) + (e * motionResp * 24)
              const waveX = Math.cos(time * speed * 1.4 + r * 0.3) * (8 * drift)
              const waveY = Math.sin(time * speed * 1.4 + c * 0.3) * (8 * drift)
              const x = sx + Math.cos(angle) * kick + waveX
              const y = sy + Math.sin(angle) * kick + waveY

              activeCount++

              // Draw disintegrated voxel block
              ctx.drawImage(env.sourceCanvas, sx, sy, sz, sz, x, y, sz, sz)

              // Glowing Neon Perimeter Seam
              if (v.wireframeEdges !== false) {
                ctx.save()
                ctx.strokeStyle = redSeam
                ctx.lineWidth = 1.6
                ctx.shadowColor = redSeam
                ctx.shadowBlur = 8
                ctx.strokeRect(x, y, sz, sz)
                ctx.restore()
              }
            }
          }

          ctx.restore()
          return activeCount
        },
      }

export default voxelDrift;
export { voxelDrift };
