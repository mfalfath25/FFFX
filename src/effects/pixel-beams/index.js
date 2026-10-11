import { env, canvas, ctx, TAU } from '../../core/env.js';

      // EFFECT 5: pixel-beams (Dither Wave)
      // Inspired by Shaders.com "Pixel Beams" & "Dither Wave" and
      // basementstudio/shader-lab WebGPU retro compositing presets.
      // Turns any image, video, webcam, or generative motion input into
      // undulating, retro-dithered light beams, wavefields, and CRT phosphor rays.
      // ======================================================================
      const BAYER2_DATA = [0 / 4, 2 / 4, 3 / 4, 1 / 4]

      const BAYER4_DATA = [
        0 / 16,
        8 / 16,
        2 / 16,
        10 / 16,
        12 / 16,
        4 / 16,
        14 / 16,
        6 / 16,
        3 / 16,
        11 / 16,
        1 / 16,
        9 / 16,
        15 / 16,
        7 / 16,
        13 / 16,
        5 / 16,
      ]

      const BAYER8_DATA = new Float32Array([
        0 / 64,
        32 / 64,
        8 / 64,
        40 / 64,
        2 / 64,
        34 / 64,
        10 / 64,
        42 / 64,
        48 / 64,
        16 / 64,
        56 / 64,
        24 / 64,
        50 / 64,
        18 / 64,
        58 / 64,
        26 / 64,
        12 / 64,
        44 / 64,
        4 / 64,
        36 / 64,
        14 / 64,
        46 / 64,
        6 / 64,
        38 / 64,
        60 / 64,
        28 / 64,
        52 / 64,
        20 / 64,
        62 / 64,
        30 / 64,
        54 / 64,
        22 / 64,
        3 / 64,
        35 / 64,
        11 / 64,
        43 / 64,
        1 / 64,
        33 / 64,
        9 / 64,
        41 / 64,
        51 / 64,
        19 / 64,
        59 / 64,
        27 / 64,
        49 / 64,
        17 / 64,
        57 / 64,
        25 / 64,
        15 / 64,
        47 / 64,
        7 / 64,
        39 / 64,
        13 / 64,
        45 / 64,
        5 / 64,
        37 / 64,
        63 / 64,
        31 / 64,
        55 / 64,
        23 / 64,
        61 / 64,
        29 / 64,
        53 / 64,
        21 / 64,
      ])

      const CLUSTERED4_DATA = [
        12 / 16,
        5 / 16,
        6 / 16,
        13 / 16,
        4 / 16,
        0 / 16,
        1 / 16,
        7 / 16,
        11 / 16,
        3 / 16,
        2 / 16,
        8 / 16,
        15 / 16,
        10 / 16,
        9 / 16,
        14 / 16,
      ]

      function parseHexColor(hex) {
        if (!hex) return [0, 0, 0]
        let c = hex.replace('#', '')
        if (c.length === 3)
          c = c
            .split('')
            .map((ch) => ch + ch)
            .join('')
        const num = parseInt(c, 16)
        return isNaN(num)
          ? [0, 0, 0]
          : [(num >> 16) & 255, (num >> 8) & 255, num & 255]
      }

      function packRgba32(r, g, b, a = 255) {
        return (
          ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)
        )
      }

      function hashNoise(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
        return n - Math.floor(n)
      }

      const pixelBeams = {
        id: 'pixel-beams',
        label: 'pixel-beams',
        groups: [
          {
            title: 'Presets & Style',
            controls: [
              {
                key: 'presetStyle',
                label: 'Style preset',
                type: 'select',
                options: [
                  'Dither Wave Cyan (Shaders.com)',
                  'Laser Beams Green (CRT Matrix)',
                  'Amber Horizon (Terminal Wave)',
                  'Solar Flare (Heatwave Beams)',
                  'GameBoy 4-Tone (Retro Lo-Fi)',
                  'Cyberpunk Neon (Dual Chromatic)',
                  'Source Color Rainbow Dither',
                ],
                value: 'Dither Wave Cyan (Shaders.com)',
                onChange: (val) => pixelBeams.applyPreset(val),
              },
              {
                key: 'colorPalette',
                label: 'Color palette',
                type: 'select',
                options: [
                  'neon-cyan',
                  'cyber-green',
                  'amber-crt',
                  'gameboy',
                  'sunset',
                  'source-rgb',
                  'monochrome',
                  'custom',
                ],
                value: 'neon-cyan',
              },
              {
                key: 'colorA',
                label: 'Shadow color (A)',
                type: 'color',
                value: '#060919',
              },
              {
                key: 'colorB',
                label: 'Beam color (B)',
                type: 'color',
                value: '#00f2ff',
              },
            ],
          },
          {
            title: 'Pixel Beams Engine',
            controls: [
              {
                key: 'beamDirection',
                label: 'Beam direction',
                type: 'select',
                options: [
                  'down',
                  'up',
                  'horizontal',
                  'diagonal-down',
                  'radial-out',
                ],
                value: 'down',
              },
              {
                key: 'beamLength',
                label: 'Beam extrusion length',
                type: 'range',
                min: 0,
                max: 80,
                step: 1,
                value: 36,
                unit: 'px',
              },
              {
                key: 'beamIntensity',
                label: 'Beam intensity',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                value: 1.35,
                unit: 'x',
              },
              {
                key: 'beamDecay',
                label: 'Beam falloff decay',
                type: 'range',
                min: 0.5,
                max: 0.98,
                step: 0.01,
                value: 0.88,
                unit: '',
              },
            ],
          },
          {
            title: 'Dither Wave Dynamics',
            controls: [
              {
                key: 'waveSpeed',
                label: 'Wave speed',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.1,
                value: 1.4,
                unit: 'x',
              },
              {
                key: 'waveFrequency',
                label: 'Wave frequency',
                type: 'range',
                min: 0.5,
                max: 8,
                step: 0.1,
                value: 2.8,
                unit: '',
              },
              {
                key: 'waveAmplitude',
                label: 'Wave amplitude / warp',
                type: 'range',
                min: 0,
                max: 1.5,
                step: 0.05,
                value: 0.45,
                unit: '',
              },
              {
                key: 'wavePattern',
                label: 'Wave type',
                type: 'select',
                options: [
                  'ocean-swell',
                  'harmonic-sine',
                  'diagonal-flow',
                  'radial-pulse',
                  'glitch-steps',
                ],
                value: 'ocean-swell',
              },
              {
                key: 'interactiveRipple',
                label: 'Cursor wave ripple',
                type: 'range',
                min: 0,
                max: 2,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
            ],
          },
          {
            title: 'Dithering & Pixel Grid',
            controls: [
              {
                key: 'pixelSize',
                label: 'Pixel size',
                type: 'range',
                min: 2,
                max: 20,
                step: 1,
                value: 4,
                unit: 'px',
              },
              {
                key: 'ditherPattern',
                label: 'Dither pattern',
                type: 'select',
                options: [
                  'bayer4',
                  'bayer8',
                  'bayer2',
                  'clustered-dot',
                  'blue-noise',
                  'threshold-only',
                ],
                value: 'bayer4',
              },
              {
                key: 'ditherLevels',
                label: 'Quantize levels',
                type: 'select',
                options: [
                  '2-level (1-bit Binary)',
                  '4-level (Gameboy)',
                  '8-level (Multi-tone)',
                  'continuous',
                ],
                value: '2-level (1-bit Binary)',
              },
              {
                key: 'threshold',
                label: 'Luminance threshold',
                type: 'range',
                min: 0.1,
                max: 0.9,
                step: 0.02,
                value: 0.48,
                unit: '',
              },
              {
                key: 'spread',
                label: 'Dither spread range',
                type: 'range',
                min: 0,
                max: 2,
                step: 0.05,
                value: 1.1,
                unit: '',
              },
              {
                key: 'contrast',
                label: 'Input contrast boost',
                type: 'range',
                min: 0.5,
                max: 3.0,
                step: 0.05,
                value: 1.35,
                unit: 'x',
              },
            ],
          },
          {
            title: 'CRT Optics & Atmosphere',
            controls: [
              {
                key: 'bloomGlow',
                label: 'Phosphor bloom glow',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.05,
                value: 0.4,
                unit: '',
              },
              {
                key: 'scanlines',
                label: 'CRT scanlines opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.05,
                value: 0.22,
                unit: '',
              },
              {
                key: 'vignette',
                label: 'Cinematic vignette',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.05,
                value: 0.35,
                unit: '',
              },
            ],
          },
        ],

        // Internal rendering buffers (zero allocation per frame)
        animTime: 0,
        cols: 0,
        rows: 0,
        sampleCanvas: document.createElement('canvas'),
        sampleCtx: null,
        offCanvas: document.createElement('canvas'),
        offCtx: null,
        imgData: null,
        pixels32: null,
        lumGrid: null,
        beamGrid: null,
        srcRGrid: null,
        srcGGrid: null,
        srcBGrid: null,

        initBuffers(cols, rows) {
          if (this.cols === cols && this.rows === rows && this.imgData) return
          this.cols = cols
          this.rows = rows

          this.sampleCanvas.width = cols
          this.sampleCanvas.height = rows
          this.sampleCtx = this.sampleCanvas.getContext('2d', {
            willReadFrequently: true,
          })

          this.offCanvas.width = cols
          this.offCanvas.height = rows
          this.offCtx = this.offCanvas.getContext('2d')

          this.imgData = this.offCtx.createImageData(cols, rows)
          this.pixels32 = new Uint32Array(this.imgData.data.buffer)

          const size = cols * rows
          this.lumGrid = new Float32Array(size)
          this.beamGrid = new Float32Array(size)
          this.srcRGrid = new Uint8Array(size)
          this.srcGGrid = new Uint8Array(size)
          this.srcBGrid = new Uint8Array(size)
        },

        applyPreset(name) {
          const v = values[this.id]
          if (!v) return
          v.presetStyle = name

          if (name === 'Dither Wave Cyan (Shaders.com)') {
            v.colorPalette = 'neon-cyan'
            v.beamDirection = 'down'
            v.beamLength = 36
            v.beamIntensity = 1.35
            v.beamDecay = 0.88
            v.waveSpeed = 1.4
            v.waveFrequency = 2.8
            v.waveAmplitude = 0.45
            v.wavePattern = 'ocean-swell'
            v.pixelSize = 4
            v.ditherPattern = 'bayer4'
            v.ditherLevels = '2-level (1-bit Binary)'
            v.threshold = 0.48
            v.spread = 1.1
            v.contrast = 1.35
            v.bloomGlow = 0.4
            v.scanlines = 0.22
            v.vignette = 0.35
          } else if (name === 'Laser Beams Green (CRT Matrix)') {
            v.colorPalette = 'cyber-green'
            v.beamDirection = 'down'
            v.beamLength = 65
            v.beamIntensity = 1.75
            v.beamDecay = 0.92
            v.waveSpeed = 1.2
            v.waveFrequency = 3.5
            v.waveAmplitude = 0.3
            v.wavePattern = 'harmonic-sine'
            v.pixelSize = 3
            v.ditherPattern = 'bayer8'
            v.ditherLevels = '2-level (1-bit Binary)'
            v.threshold = 0.42
            v.spread = 1.2
            v.contrast = 1.5
            v.bloomGlow = 0.6
            v.scanlines = 0.35
            v.vignette = 0.4
          } else if (name === 'Amber Horizon (Terminal Wave)') {
            v.colorPalette = 'amber-crt'
            v.beamDirection = 'up'
            v.beamLength = 48
            v.beamIntensity = 1.4
            v.beamDecay = 0.86
            v.waveSpeed = 1.0
            v.waveFrequency = 2.0
            v.waveAmplitude = 0.55
            v.wavePattern = 'harmonic-sine'
            v.pixelSize = 5
            v.ditherPattern = 'bayer4'
            v.ditherLevels = '2-level (1-bit Binary)'
            v.threshold = 0.45
            v.spread = 1.0
            v.contrast = 1.4
            v.bloomGlow = 0.5
            v.scanlines = 0.25
            v.vignette = 0.35
          } else if (name === 'Solar Flare (Heatwave Beams)') {
            v.colorPalette = 'sunset'
            v.beamDirection = 'diagonal-down'
            v.beamLength = 45
            v.beamIntensity = 1.5
            v.beamDecay = 0.88
            v.waveSpeed = 2.0
            v.waveFrequency = 3.2
            v.waveAmplitude = 0.55
            v.wavePattern = 'diagonal-flow'
            v.pixelSize = 4
            v.ditherPattern = 'clustered-dot'
            v.ditherLevels = '2-level (1-bit Binary)'
            v.threshold = 0.46
            v.spread = 1.15
            v.contrast = 1.45
            v.bloomGlow = 0.5
            v.scanlines = 0.2
            v.vignette = 0.3
          } else if (name === 'GameBoy 4-Tone (Retro Lo-Fi)') {
            v.colorPalette = 'gameboy'
            v.beamDirection = 'down'
            v.beamLength = 22
            v.beamIntensity = 1.1
            v.beamDecay = 0.82
            v.waveSpeed = 0.8
            v.waveFrequency = 2.2
            v.waveAmplitude = 0.35
            v.wavePattern = 'ocean-swell'
            v.pixelSize = 6
            v.ditherPattern = 'bayer4'
            v.ditherLevels = '4-level (Gameboy)'
            v.threshold = 0.5
            v.spread = 1.25
            v.contrast = 1.2
            v.bloomGlow = 0.1
            v.scanlines = 0.15
            v.vignette = 0.2
          } else if (name === 'Cyberpunk Neon (Dual Chromatic)') {
            v.colorPalette = 'custom'
            v.colorA = '#140026'
            v.colorB = '#00f7ff'
            v.beamDirection = 'horizontal'
            v.beamLength = 52
            v.beamIntensity = 1.6
            v.beamDecay = 0.9
            v.waveSpeed = 1.8
            v.waveFrequency = 4.0
            v.waveAmplitude = 0.6
            v.wavePattern = 'glitch-steps'
            v.pixelSize = 4
            v.ditherPattern = 'bayer4'
            v.ditherLevels = '2-level (1-bit Binary)'
            v.threshold = 0.45
            v.spread = 1.2
            v.contrast = 1.5
            v.bloomGlow = 0.55
            v.scanlines = 0.3
            v.vignette = 0.4
          } else if (name === 'Source Color Rainbow Dither') {
            v.colorPalette = 'source-rgb'
            v.beamDirection = 'down'
            v.beamLength = 35
            v.beamIntensity = 1.3
            v.beamDecay = 0.86
            v.waveSpeed = 1.4
            v.waveFrequency = 2.5
            v.waveAmplitude = 0.4
            v.wavePattern = 'harmonic-sine'
            v.pixelSize = 4
            v.ditherPattern = 'bayer8'
            v.ditherLevels = 'continuous'
            v.threshold = 0.48
            v.spread = 1.1
            v.contrast = 1.35
            v.bloomGlow = 0.35
            v.scanlines = 0.18
            v.vignette = 0.25
          }

          renderPanel()
        },

        draw(v, dt) {
          const { W, H } = env
          if (!W || !H) return 'Initializing'

          this.animTime += dt * v.waveSpeed
          const time = this.animTime

          const pSize = Math.max(2, Math.floor(v.pixelSize))
          const cols = Math.ceil(W / pSize)
          const rows = Math.ceil(H / pSize)
          this.initBuffers(cols, rows)

          // 1. Downscale source frame into sample buffer
          this.sampleCtx.drawImage(env.sourceCanvas, 0, 0, cols, rows)
          const srcData = this.sampleCtx.getImageData(0, 0, cols, rows).data

          const lumGrid = this.lumGrid
          const beamGrid = this.beamGrid
          const srcRGrid = this.srcRGrid
          const srcGGrid = this.srcGGrid
          const srcBGrid = this.srcBGrid
          const pixels32 = this.pixels32

          const wFreq = v.waveFrequency
          const wAmp = v.waveAmplitude
          const wPattern = v.wavePattern
          const cursor = env.cursor
          const hasCursor = env.cursorEnabled && cursor && (cursor.x > 0 || cursor.y > 0)
          const mouseU = hasCursor ? cursor.x / W : -10
          const mouseV = hasCursor ? cursor.y / H : -10
          const rippleStrength = env.cursorEnabled ? v.interactiveRipple : 0

          // 2. Wave displacement & luminance sampling
          for (let y = 0; y < rows; y++) {
            const vCoord = y / rows
            for (let x = 0; x < cols; x++) {
              const uCoord = x / cols
              let dispX = 0
              let dispY = 0
              let waveLum = 0

              if (wPattern === 'ocean-swell') {
                const swell = Math.sin(
                  (uCoord * 2.2 + vCoord * 3.4) * wFreq - time,
                )
                dispX = swell * 0.05 * wAmp
                dispY =
                  Math.cos((uCoord * 3.0 - vCoord * 1.5) * wFreq + time * 0.8) *
                  0.04 *
                  wAmp
                waveLum = (swell * 0.5 + 0.5) * (wAmp * 0.45)
              } else if (wPattern === 'diagonal-flow') {
                const diag = Math.sin(
                  (uCoord + vCoord) * wFreq * 3.8 - time * 1.6,
                )
                dispX = diag * 0.045 * wAmp
                dispY = diag * 0.045 * wAmp
                waveLum = (diag * 0.5 + 0.5) * (wAmp * 0.5)
              } else if (wPattern === 'radial-pulse') {
                const dx = uCoord - 0.5
                const dy = vCoord - 0.5
                const r = Math.hypot(dx, dy)
                const p = Math.sin(r * wFreq * 16.0 - time * 2.5)
                dispX = (dx / (r || 1)) * p * 0.05 * wAmp
                dispY = (dy / (r || 1)) * p * 0.05 * wAmp
                waveLum = (p * 0.5 + 0.5) * (wAmp * 0.4)
              } else if (wPattern === 'glitch-steps') {
                const step = Math.floor(vCoord * 14.0)
                const g =
                  (Math.sin(step * 78.2 + Math.floor(time * 5.0)) > 0.4
                    ? 0.06
                    : -0.02) * wAmp
                dispX = g
                dispY = 0
                waveLum = (step % 2 === 0 ? 0.2 : -0.1) * wAmp
              } else {
                // harmonic-sine (default)
                const w1 = Math.sin(vCoord * wFreq * 6.28 + time)
                const w2 = Math.cos(uCoord * wFreq * 4.71 - time * 0.7)
                dispX = (w1 * 0.035 + w2 * 0.02) * wAmp
                dispY =
                  (Math.cos(vCoord * wFreq * 5.0 - time * 0.8) * 0.035 +
                    Math.sin(uCoord * wFreq * 3.14 + time) * 0.02) *
                  wAmp
                waveLum =
                  (Math.sin(
                    (uCoord * 1.5 + vCoord * 2.5) * wFreq * 3.14 - time,
                  ) *
                    0.5 +
                    0.5) *
                  (wAmp * 0.4)
              }

              // Interactive mouse ripple deflection
              if (hasCursor) {
                const dist = Math.hypot(uCoord - mouseU, vCoord - mouseV)
                if (dist < 0.45) {
                  const rip =
                    Math.sin(dist * 28.0 - time * 9.0) *
                    Math.exp(-dist * 5.0) *
                    rippleStrength *
                    0.07
                  dispX += ((uCoord - mouseU) / (dist || 1)) * rip
                  dispY += ((vCoord - mouseV) / (dist || 1)) * rip
                  waveLum += rip * 2.5
                }
              }

              const sx = Math.max(
                0,
                Math.min(cols - 1, Math.round((uCoord + dispX) * cols)),
              )
              const sy = Math.max(
                0,
                Math.min(rows - 1, Math.round((vCoord + dispY) * rows)),
              )
              const sidx = (sy * cols + sx) * 4

              const r = srcData[sidx]
              const g = srcData[sidx + 1]
              const b = srcData[sidx + 2]

              const idx = y * cols + x
              srcRGrid[idx] = r
              srcGGrid[idx] = g
              srcBGrid[idx] = b

              let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
              lum = Math.min(1, Math.max(0, lum + waveLum))
              lumGrid[idx] = lum
            }
          }

          // 3. Pixel Beams Extrusion
          const bDir = v.beamDirection
          const intensity = v.beamIntensity
          const decay = v.beamDecay
          const beamThreshold = 0.42

          if (bDir === 'down') {
            for (let x = 0; x < cols; x++) {
              let beam = 0
              for (let y = 0; y < rows; y++) {
                const idx = y * cols + x
                const lum = lumGrid[idx]
                const emit =
                  lum > beamThreshold
                    ? (lum - beamThreshold) * 1.8 * intensity
                    : 0
                beam = Math.max(emit, beam * decay)
                beamGrid[idx] = beam
              }
            }
          } else if (bDir === 'up') {
            for (let x = 0; x < cols; x++) {
              let beam = 0
              for (let y = rows - 1; y >= 0; y--) {
                const idx = y * cols + x
                const lum = lumGrid[idx]
                const emit =
                  lum > beamThreshold
                    ? (lum - beamThreshold) * 1.8 * intensity
                    : 0
                beam = Math.max(emit, beam * decay)
                beamGrid[idx] = beam
              }
            }
          } else if (bDir === 'horizontal') {
            for (let y = 0; y < rows; y++) {
              let beam = 0
              for (let x = 0; x < cols; x++) {
                const idx = y * cols + x
                const lum = lumGrid[idx]
                const emit =
                  lum > beamThreshold
                    ? (lum - beamThreshold) * 1.8 * intensity
                    : 0
                beam = Math.max(emit, beam * decay)
                beamGrid[idx] = beam
              }
            }
          } else if (bDir === 'diagonal-down') {
            for (let y = 0; y < rows; y++) {
              for (let x = 0; x < cols; x++) {
                const prev =
                  x > 0 && y > 0 ? beamGrid[(y - 1) * cols + (x - 1)] : 0
                const idx = y * cols + x
                const lum = lumGrid[idx]
                const emit =
                  lum > beamThreshold
                    ? (lum - beamThreshold) * 1.8 * intensity
                    : 0
                beamGrid[idx] = Math.max(emit, prev * decay)
              }
            }
          } else {
            // radial-out
            const cx = cols / 2
            const cy = rows / 2
            for (let y = 0; y < rows; y++) {
              for (let x = 0; x < cols; x++) {
                const idx = y * cols + x
                const dist = Math.hypot(x - cx, y - cy)
                const radialFactor =
                  Math.sin(dist * 0.15 - time * 2.0) * 0.5 + 0.5
                const lum = lumGrid[idx]
                const emit =
                  lum > beamThreshold
                    ? (lum - beamThreshold) * 1.5 * intensity
                    : 0
                beamGrid[idx] = emit * (0.6 + radialFactor * 0.6)
              }
            }
          }

          // 4. Dithering Matrix calculation & Color mapping
          const pattern = v.ditherPattern
          const levels = v.ditherLevels
          const threshold = v.threshold
          const spread = v.spread
          const contrast = v.contrast
          const palette = v.colorPalette

          const customA = parseHexColor(v.colorA)
          const customB = parseHexColor(v.colorB)

          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const idx = y * cols + x
              let effLum = lumGrid[idx] + beamGrid[idx] * 0.85
              effLum = Math.max(0, Math.min(1, (effLum - 0.5) * contrast + 0.5))

              // Pattern matrix threshold lookup
              let bVal = 0.5
              if (pattern === 'bayer4') {
                bVal = BAYER4_DATA[(y & 3) * 4 + (x & 3)]
              } else if (pattern === 'bayer8') {
                bVal = BAYER8_DATA[(y & 7) * 8 + (x & 7)]
              } else if (pattern === 'bayer2') {
                bVal = BAYER2_DATA[(y & 1) * 2 + (x & 1)]
              } else if (pattern === 'clustered-dot') {
                bVal = CLUSTERED4_DATA[(y & 3) * 4 + (x & 3)]
              } else if (pattern === 'blue-noise') {
                bVal = hashNoise(x, y)
              }

              const dithered = effLum + (bVal - 0.5) * spread

              // Quantize levels
              let state = 0
              if (levels.startsWith('2-level')) {
                state = dithered >= threshold ? 1.0 : 0.0
              } else if (levels.startsWith('4-level')) {
                const q = Math.floor((dithered - threshold + 0.5) * 3 + 0.5)
                state = Math.max(0, Math.min(3, q)) / 3
              } else if (levels.startsWith('8-level')) {
                const q = Math.floor((dithered - threshold + 0.5) * 7 + 0.5)
                state = Math.max(0, Math.min(7, q)) / 7
              } else {
                state = Math.max(0, Math.min(1, dithered))
              }

              // Color mapping
              let r = 0,
                g = 0,
                b = 0
              if (palette === 'neon-cyan') {
                if (state <= 0) {
                  r = 6
                  g = 10
                  b = 28
                } else {
                  const core = Math.max(0, Math.min(1, (effLum - 0.72) / 0.28))
                  r = Math.round(0 + core * 210)
                  g = Math.round(225 + core * 30)
                  b = 255
                }
              } else if (palette === 'cyber-green') {
                if (state <= 0) {
                  r = 3
                  g = 14
                  b = 8
                } else {
                  const core = Math.max(0, Math.min(1, (effLum - 0.72) / 0.28))
                  r = Math.round(core * 200)
                  g = 255
                  b = Math.round(100 + core * 145)
                }
              } else if (palette === 'amber-crt') {
                if (state <= 0) {
                  r = 16
                  g = 6
                  b = 1
                } else {
                  const core = Math.max(0, Math.min(1, (effLum - 0.72) / 0.28))
                  r = 255
                  g = Math.round(145 + core * 100)
                  b = Math.round(core * 180)
                }
              } else if (palette === 'gameboy') {
                if (state < 0.25) {
                  r = 15
                  g = 56
                  b = 15
                } else if (state < 0.55) {
                  r = 48
                  g = 98
                  b = 48
                } else if (state < 0.85) {
                  r = 139
                  g = 172
                  b = 15
                } else {
                  r = 155
                  g = 188
                  b = 15
                }
              } else if (palette === 'sunset') {
                if (state <= 0) {
                  r = 18
                  g = 4
                  b = 30
                } else if (effLum < 0.55) {
                  r = 255
                  g = 16
                  b = 120
                } else if (effLum < 0.8) {
                  r = 255
                  g = 170
                  b = 20
                } else {
                  r = 255
                  g = 245
                  b = 180
                }
              } else if (palette === 'source-rgb') {
                const sr = srcRGrid[idx]
                const sg = srcGGrid[idx]
                const sb = srcBGrid[idx]
                if (state <= 0.05) {
                  r = Math.round(sr * 0.12)
                  g = Math.round(sg * 0.12)
                  b = Math.round(sb * 0.12)
                } else {
                  r = Math.min(
                    255,
                    Math.round(sr * (0.4 + state * 1.1) + state * 40),
                  )
                  g = Math.min(
                    255,
                    Math.round(sg * (0.4 + state * 1.1) + state * 40),
                  )
                  b = Math.min(
                    255,
                    Math.round(sb * (0.4 + state * 1.1) + state * 40),
                  )
                }
              } else if (palette === 'monochrome') {
                const val = Math.round(state * 245 + 10)
                r = val
                g = val
                b = val
              } else {
                // custom
                const t = state
                r = Math.round(customA[0] + (customB[0] - customA[0]) * t)
                g = Math.round(customA[1] + (customB[1] - customA[1]) * t)
                b = Math.round(customA[2] + (customB[2] - customA[2]) * t)
                if (effLum > 0.8) {
                  const boost = (effLum - 0.8) / 0.2
                  r = Math.min(255, Math.round(r + boost * 55))
                  g = Math.min(255, Math.round(g + boost * 55))
                  b = Math.min(255, Math.round(b + boost * 55))
                }
              }

              pixels32[idx] = packRgba32(r, g, b, 255)
            }
          }

          // 5. Draw dither buffer to main screen
          this.offCtx.putImageData(this.imgData, 0, 0)

          ctx.imageSmoothingEnabled = false
          ctx.drawImage(this.offCanvas, 0, 0, W, H)

          // 6. Phosphor Bloom Glow
          if (v.bloomGlow > 0.01) {
            ctx.save()
            ctx.globalCompositeOperation = 'screen'
            ctx.globalAlpha = v.bloomGlow
            ctx.filter = 'blur(6px)'
            ctx.drawImage(this.offCanvas, 0, 0, W, H)
            ctx.restore()
          }

          // 7. CRT Scanlines
          if (v.scanlines > 0.01) {
            ctx.save()
            ctx.fillStyle = `rgba(0, 0, 0, ${v.scanlines})`
            const step = Math.max(2, pSize)
            for (let y = 0; y < H; y += step) {
              ctx.fillRect(0, y, W, 1)
            }
            ctx.restore()
          }

          // 8. Cinematic Vignette
          if (v.vignette > 0.01) {
            ctx.save()
            const vig = ctx.createRadialGradient(
              W / 2,
              H / 2,
              Math.min(W, H) * 0.35,
              W / 2,
              H / 2,
              Math.max(W, H) * 0.72,
            )
            vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
            vig.addColorStop(1, `rgba(0, 0, 0, ${v.vignette * 0.9})`)
            ctx.fillStyle = vig
            ctx.fillRect(0, 0, W, H)
            ctx.restore()
          }

          return `Dither Wave ${cols}×${rows} · ${pSize}px · ${v.colorPalette} · ${v.ditherPattern} · ${v.beamDirection} beams`
        },
      }

export default pixelBeams;
export { pixelBeams };
