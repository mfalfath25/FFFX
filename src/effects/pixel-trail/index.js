import { env, canvas, ctx, TAU } from '../../core/env.js';

      const pixelTrail = {
        id: 'pixel-trail',
        label: 'pixel-trail',
        groups: [
          {
            title: 'Trail Dynamics',
            controls: [
              {
                key: 'pixelSize',
                label: 'Pixel block size',
                type: 'range',
                min: 4,
                max: 48,
                step: 2,
                value: 12,
                unit: 'px',
              },
              {
                key: 'persistence',
                label: 'Trail persistence',
                type: 'range',
                min: 0.5,
                max: 0.98,
                step: 0.01,
                value: 0.91,
                unit: '',
              },
              {
                key: 'motionSensitivity',
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
            title: 'Color & Aesthetics',
            controls: [
              {
                key: 'colorMode',
                label: 'Trail color palette',
                type: 'select',
                options: [
                  'chromatic',
                  'original',
                  'thermal',
                  'phosphor',
                  'tint',
                ],
                value: 'chromatic',
              },
              {
                key: 'trailColor',
                label: 'Tint color (for tint mode)',
                type: 'color',
                value: '#00ff88',
              },
              {
                key: 'blendMode',
                label: 'Trail blend mode',
                type: 'select',
                options: ['screen', 'lighter', 'source-over'],
                value: 'screen',
              },
              {
                key: 'glowIntensity',
                label: 'Glow intensity',
                type: 'range',
                min: 0.5,
                max: 2.5,
                step: 0.1,
                value: 1.3,
                unit: 'x',
              },
            ],
          },
          {
            title: 'Physics & Drift',
            controls: [
              {
                key: 'driftDirection',
                label: 'Trail drift',
                type: 'select',
                options: [
                  'none',
                  'down (drip)',
                  'up (float)',
                  'wind-right',
                  'scatter',
                ],
                value: 'none',
              },
              {
                key: 'driftSpeed',
                label: 'Drift velocity',
                type: 'range',
                min: 0,
                max: 6,
                step: 0.5,
                value: 1.5,
                unit: 'px',
              },
            ],
          },
          {
            title: 'Display & Base',
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
                key: 'showGrid',
                label: 'Pixel grid lines',
                type: 'checkbox',
                value: false,
              },
              {
                key: 'gridColor',
                label: 'Grid color',
                type: 'color',
                value: '#151722',
              },
            ],
          },
        ],

        // Trail grid buffers
        gridW: 0,
        gridH: 0,
        cellSize: 0,
        trailR: null,
        trailG: null,
        trailB: null,
        trailLife: null,
        prevR: null,
        prevG: null,
        prevB: null,
        downCanvas: document.createElement('canvas'),
        downCtx: null,

        initGrid(cols, rows, sz) {
          this.gridW = cols
          this.gridH = rows
          this.cellSize = sz
          const total = cols * rows
          this.trailR = new Float32Array(total)
          this.trailG = new Float32Array(total)
          this.trailB = new Float32Array(total)
          this.trailLife = new Float32Array(total)
          this.prevR = new Uint8Array(total)
          this.prevG = new Uint8Array(total)
          this.prevB = new Uint8Array(total)
          this.downCanvas.width = cols
          this.downCanvas.height = rows
          this.downCtx = this.downCanvas.getContext('2d', {
            willReadFrequently: true,
          })
        },

        draw(v, dt) {
          const { W, H, cursor } = env
          env.time += dt

          const sz = Math.max(4, Math.floor(v.pixelSize))
          const cols = Math.ceil(W / sz)
          const rows = Math.ceil(H / sz)

          if (
            this.gridW !== cols ||
            this.gridH !== rows ||
            this.cellSize !== sz ||
            !this.downCtx
          ) {
            this.initGrid(cols, rows, sz)
          }

          // Sample downsampled source frame
          this.downCtx.drawImage(env.sourceCanvas, 0, 0, cols, rows)
          const imgData = this.downCtx.getImageData(0, 0, cols, rows)
          const data = imgData.data

          const motionThreshold = Math.max(
            0.02,
            (1 - v.motionSensitivity) * 0.22,
          )
          const persistence = v.persistence
          const glow = v.glowIntensity

          let activeCount = 0

          // 1. Process cells: detect motion triggers and decay unactivated cells
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const idx = y * cols + x
              const pIdx = idx * 4

              const r = data[pIdx]
              const g = data[pIdx + 1]
              const b = data[pIdx + 2]

              // Motion delta
              const pr = this.prevR[idx]
              const pg = this.prevG[idx]
              const pb = this.prevB[idx]
              const motion =
                (Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb)) /
                (3 * 255)

              // Update previous frame
              this.prevR[idx] = r
              this.prevG[idx] = g
              this.prevB[idx] = b

              // Motion trigger
              if (motion > motionThreshold) {
                this.trailLife[idx] = 1.0
                this.trailR[idx] = r
                this.trailG[idx] = g
                this.trailB[idx] = b
              } else {
                this.trailLife[idx] *= persistence
              }

              if (this.trailLife[idx] > 0.02) activeCount++
            }
          }

          // 2. Physics & Drift (optional dispersal)
          if (v.driftDirection !== 'none' && v.driftSpeed > 0) {
            this.applyDrift(cols, rows, v.driftDirection, v.driftSpeed * 0.15)
          }

          // 3. Render
          ctx.fillStyle = '#0a0b10'
          ctx.fillRect(0, 0, W, H)

          // Draw underlying video/image with dimming
          if (v.backgroundDim < 1) {
            ctx.save()
            ctx.globalAlpha = 1 - v.backgroundDim
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            ctx.restore()
          }

          // Draw trailing pixel blocks
          ctx.save()
          if (v.blendMode !== 'source-over') {
            ctx.globalCompositeOperation = v.blendMode
          }

          const mode = v.colorMode
          const showGrid = v.showGrid
          const gridColor = v.gridColor

          // Parse tint color once if tint mode
          let tintR = 0,
            tintG = 255,
            tintB = 136
          if (mode === 'tint') {
            const hex = v.trailColor.replace('#', '')
            tintR = parseInt(hex.substring(0, 2), 16) || 0
            tintG = parseInt(hex.substring(2, 4), 16) || 255
            tintB = parseInt(hex.substring(4, 6), 16) || 136
          }

          for (let y = 0; y < rows; y++) {
            const py = y * sz
            for (let x = 0; x < cols; x++) {
              const idx = y * cols + x
              const life = this.trailLife[idx]
              if (life <= 0.02) continue

              const px = x * sz
              let cr = 0,
                cg = 0,
                cb = 0,
                alpha = life

              if (mode === 'original') {
                cr = this.trailR[idx] * glow
                cg = this.trailG[idx] * glow
                cb = this.trailB[idx] * glow
              } else if (mode === 'chromatic') {
                // Signature chromatic aberration: R, G, B decay at different rates
                const rLife = life
                const gLife = Math.pow(life, 1.25)
                const bLife = Math.pow(life, 1.6)
                cr = this.trailR[idx] * rLife * glow
                cg = this.trailG[idx] * gLife * glow
                cb = this.trailB[idx] * bLife * glow
              } else if (mode === 'phosphor') {
                // Cyberpunk CRT phosphor glow (green/amber)
                cr = 20 * life
                cg = 255 * Math.min(1, life * 1.3) * glow
                cb = 140 * Math.pow(life, 2) * glow
              } else if (mode === 'thermal') {
                // Heat map spectrum based on trail age/life
                const [tr, tg, tb] = this.thermalColor(life)
                cr = tr * glow
                cg = tg * glow
                cb = tb * glow
              } else if (mode === 'tint') {
                cr = tintR * life * glow
                cg = tintG * life * glow
                cb = tintB * life * glow
              }

              ctx.fillStyle = `rgb(${Math.min(255, cr | 0)}, ${Math.min(255, cg | 0)}, ${Math.min(255, cb | 0)})`
              ctx.globalAlpha = Math.min(1, alpha)

              if (showGrid && sz > 4) {
                ctx.fillRect(px + 0.5, py + 0.5, sz - 1, sz - 1)
              } else {
                ctx.fillRect(px, py, sz, sz)
              }
            }
          }

          // Optional grid lines
          if (showGrid) {
            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = 0.35
            ctx.strokeStyle = gridColor
            ctx.lineWidth = 0.5
            ctx.beginPath()
            for (let x = 0; x <= W; x += sz) {
              ctx.moveTo(x + 0.5, 0)
              ctx.lineTo(x + 0.5, H)
            }
            for (let y = 0; y <= H; y += sz) {
              ctx.moveTo(0, y + 0.5)
              ctx.lineTo(W, y + 0.5)
            }
            ctx.stroke()
          }

          ctx.restore()

          return `${activeCount.toLocaleString()} active trail blocks · ${sz}px grid`
        },

        thermalColor(t) {
          let r = 0,
            g = 0,
            b = 0
          if (t < 0.25) {
            b = Math.floor(t * 4 * 255)
          } else if (t < 0.5) {
            r = Math.floor((t - 0.25) * 4 * 255)
            b = 255
          } else if (t < 0.75) {
            r = 255
            g = Math.floor((t - 0.5) * 4 * 200)
            b = Math.floor((1 - (t - 0.5) * 4) * 255)
          } else {
            r = 255
            g = Math.floor(200 + (t - 0.75) * 4 * 55)
            b = Math.floor((t - 0.75) * 4 * 255)
          }
          return [r, g, b]
        },

        applyDrift(cols, rows, dir, rate) {
          const shiftChance = Math.min(0.6, rate)
          if (dir === 'down (drip)') {
            for (let y = rows - 2; y >= 0; y--) {
              for (let x = 0; x < cols; x++) {
                const i = y * cols + x
                const down = (y + 1) * cols + x
                if (this.trailLife[i] > 0.05 && Math.random() < shiftChance) {
                  this.trailLife[down] = Math.max(
                    this.trailLife[down],
                    this.trailLife[i] * 0.95,
                  )
                  this.trailR[down] = this.trailR[i]
                  this.trailG[down] = this.trailG[i]
                  this.trailB[down] = this.trailB[i]
                }
              }
            }
          } else if (dir === 'up (float)') {
            for (let y = 1; y < rows; y++) {
              for (let x = 0; x < cols; x++) {
                const i = y * cols + x
                const up = (y - 1) * cols + x
                if (this.trailLife[i] > 0.05 && Math.random() < shiftChance) {
                  this.trailLife[up] = Math.max(
                    this.trailLife[up],
                    this.trailLife[i] * 0.95,
                  )
                  this.trailR[up] = this.trailR[i]
                  this.trailG[up] = this.trailG[i]
                  this.trailB[up] = this.trailB[i]
                }
              }
            }
          } else if (dir === 'wind-right') {
            for (let y = 0; y < rows; y++) {
              for (let x = cols - 2; x >= 0; x--) {
                const i = y * cols + x
                const right = y * cols + (x + 1)
                if (this.trailLife[i] > 0.05 && Math.random() < shiftChance) {
                  this.trailLife[right] = Math.max(
                    this.trailLife[right],
                    this.trailLife[i] * 0.95,
                  )
                  this.trailR[right] = this.trailR[i]
                  this.trailG[right] = this.trailG[i]
                  this.trailB[right] = this.trailB[i]
                }
              }
            }
          } else if (dir === 'scatter') {
            for (let y = 1; y < rows - 1; y++) {
              for (let x = 1; x < cols - 1; x++) {
                const i = y * cols + x
                if (
                  this.trailLife[i] > 0.1 &&
                  Math.random() < shiftChance * 0.3
                ) {
                  const ox = Math.random() > 0.5 ? 1 : -1
                  const oy = Math.random() > 0.5 ? 1 : -1
                  const ni = (y + oy) * cols + (x + ox)
                  this.trailLife[ni] = Math.max(
                    this.trailLife[ni],
                    this.trailLife[i] * 0.9,
                  )
                }
              }
            }
          }
        },
      }

export default pixelTrail;
export { pixelTrail };
