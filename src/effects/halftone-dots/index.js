import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const halftoneDotsFS = `
        precision highp float;
        varying vec2 v_uv;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_scale;
        uniform float u_softness;
        uniform float u_angle;
        uniform float u_contrast;
        uniform float u_waveSpeed;
        uniform float u_waveAmp;
        uniform int u_gridType;
        uniform int u_dotShape;
        uniform bool u_invert;
        uniform vec3 u_dotColor;
        uniform vec3 u_backColor;
        uniform vec2 u_cursor;
        uniform float u_cursorRipple;

        mat2 rot2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        float getDotDist(vec2 uv, int shape) {
          if (shape == 0) {
            return length(uv);
          } else if (shape == 1) {
            return (abs(uv.x) + abs(uv.y)) * 0.7071;
          } else if (shape == 2) {
            return max(abs(uv.x), abs(uv.y));
          } else {
            return min(length(uv), min(abs(uv.x) + abs(uv.y) * 0.35, abs(uv.y) + abs(uv.x) * 0.35));
          }
        }

        void main() {
          vec2 uv = v_uv;

          float rad = u_angle * 3.14159265 / 180.0;
          mat2 rot = rot2d(rad);

          vec2 toCursor = (uv - u_cursor) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float distCursor = length(toCursor);
          if (distCursor < 0.5 && u_cursorRipple > 0.0) {
            vec2 warp = normalize(toCursor) * sin(distCursor * 25.0 - u_time * 6.0) * exp(-distCursor * 5.0) * u_cursorRipple * 0.045;
            uv += warp;
          }

          if (u_waveAmp > 0.0) {
            float wave = sin(dot(uv, vec2(12.0, 16.0)) + u_time * u_waveSpeed * 3.0) * u_waveAmp * 0.015;
            uv += vec2(wave, wave * 0.6);
          }

          vec4 img = texture2D(u_image, uv);
          float luma = dot(img.rgb, vec3(0.299, 0.587, 0.114));
          luma = clamp((luma - 0.5) * u_contrast + 0.5, 0.0, 1.0);
          if (u_invert) luma = 1.0 - luma;

          vec2 p = rot * (uv * u_resolution) / u_scale;
          float d = 0.0;
          float maxRadius = 0.7071;

          if (u_gridType == 0) {
            vec2 grid = fract(p) - 0.5;
            d = getDotDist(grid, u_dotShape);
          } else if (u_gridType == 1) {
            vec2 r = vec2(1.0, 1.7320508);
            vec2 h = r * 0.5;
            vec2 a = mod(p, r) - h;
            vec2 b = mod(p - h, r) - h;
            vec2 g = dot(a, a) < dot(b, b) ? a : b;
            d = getDotDist(g, u_dotShape);
          } else if (u_gridType == 2) {
            mat2 dRot = rot2d(0.785398);
            vec2 dGrid = fract(dRot * p) - 0.5;
            d = getDotDist(dGrid, u_dotShape);
          } else {
            float lineCoord = abs(fract(p.y) - 0.5);
            d = lineCoord;
            maxRadius = 0.5;
          }

          float r = sqrt(luma) * maxRadius;
          float s = max(u_softness * 0.5, 0.001);
          float dotVal = smoothstep(r - s, r + s, d);

          vec3 col = mix(u_dotColor, u_backColor, dotVal);
          gl_FragColor = vec4(col, 1.0);
        }
      `

      const halftoneDots = {
        id: 'halftone-dots',
        label: 'Halftone Dots',
        groups: [
          {
            title: 'Pattern & Geometry',
            controls: [
              {
                key: 'gridType',
                label: 'Grid Layout',
                type: 'select',
                options: ['SQUARE GRID', 'HEXAGONAL GRID', 'DIAMOND RASTER', 'STRIPE LINES'],
                value: 'SQUARE GRID',
              },
              {
                key: 'dotShape',
                label: 'Dot Shape',
                type: 'select',
                options: ['CIRCLES', 'DIAMONDS', 'SQUARES', 'CROSSES'],
                value: 'CIRCLES',
              },
              {
                key: 'scale',
                label: 'Grid Cell Size',
                type: 'range',
                min: 4,
                max: 70,
                step: 1,
                value: 14,
                unit: 'px',
              },
              {
                key: 'softness',
                label: 'Edge Softness',
                type: 'range',
                min: 0.01,
                max: 0.6,
                step: 0.02,
                value: 0.18,
              },
              {
                key: 'angle',
                label: 'Grid Angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 5,
                value: 45,
                unit: '°',
              },
              {
                key: 'contrast',
                label: 'Luma Contrast',
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
            title: 'Colors & Palette',
            controls: [
              {
                key: 'dotColor',
                label: 'Dot Ink Color',
                type: 'color',
                value: '#101216',
              },
              {
                key: 'backColor',
                label: 'Paper Background',
                type: 'color',
                value: '#faf9f5',
              },
              {
                key: 'invert',
                label: 'Invert Dot Tone',
                type: 'checkbox',
                value: false,
              },
            ],
          },
          {
            title: 'Wave Dynamics & Interaction',
            controls: [
              {
                key: 'waveAmp',
                label: 'Wave Ripple Distortion',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.0,
              },
              {
                key: 'waveSpeed',
                label: 'Wave Motion Speed',
                type: 'range',
                min: 0.1,
                max: 3.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'cursorRipple',
                label: 'Cursor Dot Wave',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
            ],
          },
        ],
        draw(v, dt) {
          const { W, H } = env
          env.time += dt

          const { glCanvas, gl, quadBuffer, sharedTexture } = getWebGL()
          if (!gl) {
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            return 'Halftone Dots (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('halftoneDots', halftoneDotsFS)
          if (!progInfo) return 'Halftone Dots error'

          glCanvas.width = W
          glCanvas.height = H
          gl.viewport(0, 0, W, H)

          gl.useProgram(progInfo.prog)

          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
          gl.enableVertexAttribArray(progInfo.positionLocation)
          gl.vertexAttribPointer(progInfo.positionLocation, 2, gl.FLOAT, false, 0, 0)

          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, sharedTexture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, env.sourceCanvas)

          const gridIdx = ['SQUARE GRID', 'HEXAGONAL GRID', 'DIAMOND RASTER', 'STRIPE LINES'].indexOf(v.gridType)
          const dotIdx = ['CIRCLES', 'DIAMONDS', 'SQUARES', 'CROSSES'].indexOf(v.dotShape)

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          const cursorRipple = env.cursorEnabled ? v.cursorRipple : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_scale'), v.scale)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_softness'), v.softness)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_contrast'), v.contrast)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_waveSpeed'), v.waveSpeed)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_waveAmp'), v.waveAmp)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_gridType'), gridIdx >= 0 ? gridIdx : 0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_dotShape'), dotIdx >= 0 ? dotIdx : 0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_invert'), v.invert ? 1 : 0)
          const dotRgb = hexToRgb(v.dotColor || '#101216')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_dotColor'), dotRgb[0], dotRgb[1], dotRgb[2])
          const backRgb = hexToRgb(v.backColor || '#faf9f5')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_backColor'), backRgb[0], backRgb[1], backRgb[2])
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorRipple'), cursorRipple)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Halftone Dots · ${v.gridType} · ${v.dotShape} · ${v.scale}px`
        },
      }

export default halftoneDots;
export { halftoneDots };
