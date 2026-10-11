import { env, canvas, ctx, ROOT, TAU } from '../../core/env.js';
import { rectSum, lumaStdDev, hash } from '../../core/sat.js';

      const quadtreeBokeh = {
        id: 'quadtree-bokeh',
        label: 'quadtree-bokeh',
        groups: [
          {
            title: 'Focus',
            controls: [
              {
                key: 'shape',
                label: 'Focus shape',
                type: 'select',
                options: ['square', 'circle'],
                value: 'square',
              },
              {
                key: 'radius',
                label: 'Focus size',
                type: 'range',
                min: 20,
                max: 400,
                step: 1,
                value: 110,
                unit: 'px',
              },
              {
                key: 'falloff',
                label: 'Falloff distance',
                type: 'range',
                min: 40,
                max: 800,
                step: 1,
                value: 320,
                unit: 'px',
              },
              {
                key: 'minSize',
                label: 'Finest square',
                type: 'select',
                options: [1, 2, 4, 8],
                value: 2,
              },
              {
                key: 'maxSize',
                label: 'Coarsest square',
                type: 'select',
                options: [16, 32, 64],
                value: 64,
              },
              {
                key: 'skipFlat',
                label: 'Skip flat regions',
                type: 'checkbox',
                value: true,
              },
            ],
          },
          {
            title: 'Alive',
            controls: [
              {
                key: 'speed',
                label: 'Speed',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.05,
                value: 1,
                unit: 'x',
              },
              {
                key: 'shimmer',
                label: 'Edge shimmer',
                type: 'range',
                min: 0,
                max: 160,
                step: 1,
                value: 60,
                unit: 'px',
              },
              {
                key: 'glitter',
                label: 'Glitter',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                value: 0.35,
                unit: '',
              },
              {
                key: 'breathing',
                label: 'Focus breathing',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                value: 0.25,
                unit: '',
              },
              {
                key: 'wander',
                label: 'Wander when idle',
                type: 'checkbox',
                value: true,
              },
            ],
          },
          {
            title: 'Display',
            controls: [
              {
                key: 'showGrid',
                label: 'Show grid',
                type: 'checkbox',
                value: false,
              },
              {
                key: 'gridWidth',
                label: 'Grid width',
                type: 'range',
                min: 0.01,
                max: 10,
                step: 0.01,
                value: 1,
                unit: 'px',
              },
              {
                key: 'gridColor',
                label: 'Grid color',
                type: 'color',
                value: '#000000',
              },
            ],
          },
        ],

        flatThreshold: 6,
        leaves: [],

        draw(v, dt) {
          const { W, H, cursor } = env
          env.time += dt * v.speed

          if (env.cursorEnabled && v.wander && performance.now() - cursor.lastMoveAt > 2500) {
            cursor.targetX = W * (0.5 + 0.32 * Math.sin(env.time * 0.55))
            cursor.targetY = H * (0.5 + 0.3 * Math.sin(env.time * 0.83 + 1.2))
          }
          if (env.cursorEnabled) {
            cursor.x += (cursor.targetX - cursor.x) * 0.18
            cursor.y += (cursor.targetY - cursor.y) * 0.18
          }

          const radius =
            v.radius * (1 + v.breathing * 0.3 * Math.sin(env.time * 0.9))
          const params = { ...v, radius, time: env.time }

          this.leaves = []
          for (let y = 0; y < H; y += ROOT) {
            for (let x = 0; x < W; x += ROOT) {
              this.subdivide(x, y, ROOT, params)
            }
          }
          this.render(v)
          return `${(this.leaves.length / 6).toLocaleString()} squares`
        },

        distance(x, y, s, shape) {
          const { cursor } = env
          const dx = Math.max(x - cursor.x, 0, cursor.x - (x + s))
          const dy = Math.max(y - cursor.y, 0, cursor.y - (y + s))
          return shape === 'square' ? Math.max(dx, dy) : Math.hypot(dx, dy)
        },

        allowedSize(x, y, s, p) {
          if (!env.cursorEnabled) {
            return p.minSize
          }
          let d = this.distance(x, y, s, p.shape)
          if (p.shimmer > 0) {
            d += p.shimmer * Math.sin(p.time * 2.2 + hash(x, y, s) * TAU)
          }
          if (d <= p.radius) return p.minSize
          const t = Math.min(1, (d - p.radius) / p.falloff)
          return p.minSize + (p.maxSize - p.minSize) * t * t
        },

        subdivide(x, y, s, p) {
          const wantSplit = s > p.minSize && s > this.allowedSize(x, y, s, p)
          const isFlat =
            p.skipFlat && wantSplit && lumaStdDev(x, y, s) < this.flatThreshold

          if (wantSplit && !isFlat) {
            const h = s / 2
            this.subdivide(x, y, h, p)
            this.subdivide(x + h, y, h, p)
            this.subdivide(x, y + h, h, p)
            this.subdivide(x + h, y + h, h, p)
            return
          }

          const n = s * s
          this.leaves.push(
            x,
            y,
            s,
            rectSum(env.sat.r, x, y, s) / n,
            rectSum(env.sat.g, x, y, s) / n,
            rectSum(env.sat.b, x, y, s) / n,
          )
        },

        render(v) {
          const { W, H, time } = env
          const leaves = this.leaves
          const gutterGrid = v.showGrid && v.gridWidth >= 1
          const hairlineGrid = v.showGrid && v.gridWidth < 1

          ctx.fillStyle = gutterGrid ? v.gridColor : '#000'
          ctx.fillRect(0, 0, W, H)

          for (let i = 0; i < leaves.length; i += 6) {
            const x = leaves[i],
              y = leaves[i + 1],
              s = leaves[i + 2]
            let r = leaves[i + 3],
              g = leaves[i + 4],
              b = leaves[i + 5]

            if (v.glitter > 0) {
              const phase = hash(x, y, s + 101)
              const flicker =
                1 + 0.07 * v.glitter * Math.sin(time * 3 + phase * 60)
              const pulse = Math.max(0, Math.sin(time * 1.7 + phase * 80))
              const sparkle =
                Math.pow(pulse, 16) *
                v.glitter *
                (0.35 + (0.65 * s) / v.maxSize)
              r = Math.min(255, r * flicker + (255 - r) * sparkle)
              g = Math.min(255, g * flicker + (255 - g) * sparkle)
              b = Math.min(255, b * flicker + (255 - b) * sparkle)
            }

            ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`
            const inset = gutterGrid ? Math.min(v.gridWidth / 2, s * 0.25) : 0
            ctx.fillRect(x + inset, y + inset, s - inset * 2, s - inset * 2)
          }

          if (hairlineGrid) {
            ctx.globalAlpha = v.gridWidth
            ctx.strokeStyle = v.gridColor
            ctx.lineWidth = 1
            ctx.beginPath()
            for (let i = 0; i < leaves.length; i += 6) {
              ctx.rect(leaves[i], leaves[i + 1], leaves[i + 2], leaves[i + 2])
            }
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        },
      }

export default quadtreeBokeh;
export { quadtreeBokeh };
