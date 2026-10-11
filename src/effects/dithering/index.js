import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const ditheringFS = `
        precision highp float;
        varying vec2 v_uv;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_pixelSize;
        uniform float u_contrast;
        uniform float u_ditherAmount;
        uniform float u_levels;
        uniform int u_matrixType;
        uniform int u_palette;
        uniform bool u_invert;
        uniform vec3 u_lightColor;
        uniform vec3 u_darkColor;
        uniform vec2 u_cursor;
        uniform float u_cursorScatter;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float bayer4(vec2 p) {
          vec2 f = mod(floor(p), 4.0);
          int x = int(f.x);
          int y = int(f.y);
          int index = x + y * 4;
          if (index == 0) return 0.0/16.0;
          if (index == 1) return 8.0/16.0;
          if (index == 2) return 2.0/16.0;
          if (index == 3) return 10.0/16.0;
          if (index == 4) return 12.0/16.0;
          if (index == 5) return 4.0/16.0;
          if (index == 6) return 14.0/16.0;
          if (index == 7) return 6.0/16.0;
          if (index == 8) return 3.0/16.0;
          if (index == 9) return 11.0/16.0;
          if (index == 10) return 1.0/16.0;
          if (index == 11) return 9.0/16.0;
          if (index == 12) return 15.0/16.0;
          if (index == 13) return 7.0/16.0;
          if (index == 14) return 13.0/16.0;
          return 5.0/16.0;
        }

        float bayer8(vec2 p) {
          vec2 f = mod(floor(p), 8.0);
          vec2 f4 = mod(f, 4.0);
          float m4 = bayer4(f4);
          vec2 halfBlock = floor(f / 4.0);
          float offset = 0.0;
          if (halfBlock.x == 0.0 && halfBlock.y == 0.0) offset = 0.0;
          else if (halfBlock.x == 1.0 && halfBlock.y == 0.0) offset = 2.0;
          else if (halfBlock.x == 0.0 && halfBlock.y == 1.0) offset = 3.0;
          else offset = 1.0;
          return (m4 * 4.0 + offset * (1.0 / 4.0)) / 4.0;
        }

        float getDitherThreshold(vec2 coord, int type) {
          if (type == 0) {
            return bayer8(coord) - 0.5;
          } else if (type == 1) {
            return bayer4(coord) - 0.5;
          } else if (type == 2) {
            return hash21(coord + fract(u_time * 0.05)) - 0.5;
          } else if (type == 3) {
            vec2 c = mod(floor(coord), 4.0);
            float d = (c.x == c.y || c.x == 3.0 - c.y) ? 0.35 : -0.35;
            return d;
          } else if (type == 4) {
            vec2 c = fract(coord / 6.0) - 0.5;
            return (1.0 - length(c) * 2.0) - 0.5;
          } else {
            return hash21(coord * 7.13 + u_time) - 0.5;
          }
        }

        vec3 mapPalette(float val, vec3 origRgb, int pal) {
          val = clamp(val, 0.0, 1.0);
          if (u_invert) val = 1.0 - val;

          if (pal == 0) {
            return mix(u_darkColor, u_lightColor, step(0.5, val));
          } else if (pal == 1) {
            if (val < 0.25) return vec3(0.06, 0.22, 0.06);
            if (val < 0.5)  return vec3(0.19, 0.38, 0.19);
            if (val < 0.75) return vec3(0.54, 0.67, 0.06);
            return vec3(0.61, 0.73, 0.06);
          } else if (pal == 2) {
            if (val < 0.25) return vec3(0.05, 0.02, 0.15);
            if (val < 0.5)  return vec3(0.95, 0.05, 0.45);
            if (val < 0.75) return vec3(0.0, 0.85, 0.95);
            return vec3(1.0, 0.95, 0.2);
          } else if (pal == 3) {
            return mix(vec3(0.08, 0.03, 0.0), vec3(1.0, 0.7, 0.1), val);
          } else if (pal == 4) {
            if (val < 0.25) return vec3(0.0, 0.0, 0.0);
            if (val < 0.5)  return vec3(0.0, 0.67, 0.67);
            if (val < 0.75) return vec3(0.67, 0.0, 0.67);
            return vec3(1.0, 1.0, 1.0);
          } else if (pal == 5) {
            if (val < 0.25) return vec3(0.18, 0.1, 0.35);
            if (val < 0.5)  return vec3(0.95, 0.5, 0.65);
            if (val < 0.75) return vec3(0.45, 0.85, 0.9);
            return vec3(1.0, 0.95, 0.85);
          } else {
            return clamp(origRgb, 0.0, 1.0);
          }
        }

        void main() {
          vec2 uv = v_uv;
          float pSize = max(1.0, u_pixelSize);

          vec2 toCursor = (uv - u_cursor) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float distCursor = length(toCursor);
          if (distCursor < 0.45 && u_cursorScatter > 0.0) {
            float scatter = hash21(floor(uv * u_resolution / pSize) + u_time) * u_cursorScatter * 0.03;
            uv += (toCursor / (distCursor + 0.001)) * scatter;
          }

          vec2 pixelCoord = floor(uv * u_resolution / pSize);
          vec2 sampledUV = (pixelCoord + 0.5) * pSize / u_resolution;
          sampledUV = clamp(sampledUV, 0.0, 1.0);

          vec4 img = texture2D(u_image, sampledUV);
          vec3 rgb = clamp((img.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
          float luma = dot(rgb, vec3(0.299, 0.587, 0.114));

          float dither = getDitherThreshold(pixelCoord, u_matrixType) * u_ditherAmount;

          if (u_palette == 6) {
            float steps = max(1.0, u_levels - 1.0);
            vec3 qRgb = floor((rgb + vec3(dither)) * steps + 0.5) / steps;
            gl_FragColor = vec4(clamp(qRgb, 0.0, 1.0), 1.0);
          } else {
            float steps = max(1.0, u_levels - 1.0);
            float qLuma = floor((luma + dither) * steps + 0.5) / steps;
            vec3 finalCol = mapPalette(qLuma, rgb, u_palette);
            gl_FragColor = vec4(finalCol, 1.0);
          }
        }
      `

      const dithering = {
        id: 'dithering',
        label: 'Dithering',
        groups: [
          {
            title: 'Matrix & Quantization',
            controls: [
              {
                key: 'matrixType',
                label: 'Dither Pattern',
                type: 'select',
                options: [
                  'BAYER 8X8',
                  'BAYER 4X4',
                  'BLUE NOISE GRAIN',
                  'CROSSHATCH',
                  'CLUSTER DOTS',
                  'RANDOM NOISE',
                ],
                value: 'BAYER 8X8',
              },
              {
                key: 'palette',
                label: 'Color Palette',
                type: 'select',
                options: [
                  '1-BIT MONOCHROME',
                  'GAME BOY CLASSIC',
                  'CYBERPUNK NEON',
                  'AMBER CRT',
                  'CGA RETRO',
                  'VAPORWAVE PASTEL',
                  'TRUE COLOR DITHER',
                ],
                value: '1-BIT MONOCHROME',
              },
              {
                key: 'pixelSize',
                label: 'Pixel Downscale',
                type: 'range',
                min: 1,
                max: 24,
                step: 1,
                value: 4,
                unit: 'px',
              },
              {
                key: 'levels',
                label: 'Quantize Steps',
                type: 'range',
                min: 2,
                max: 16,
                step: 1,
                value: 4,
              },
              {
                key: 'ditherAmount',
                label: 'Dither Amount',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.65,
              },
              {
                key: 'contrast',
                label: 'Luma Contrast',
                type: 'range',
                min: 0.5,
                max: 2.5,
                step: 0.1,
                value: 1.2,
                unit: 'x',
              },
            ],
          },
          {
            title: 'Palette Customization',
            controls: [
              {
                key: 'lightColor',
                label: 'Light Tint',
                type: 'color',
                value: '#f0f1f5',
              },
              {
                key: 'darkColor',
                label: 'Dark Tint',
                type: 'color',
                value: '#0e1014',
              },
              {
                key: 'invert',
                label: 'Invert Palette',
                type: 'checkbox',
                value: false,
              },
            ],
          },
          {
            title: 'Interaction',
            controls: [
              {
                key: 'cursorScatter',
                label: 'Cursor Glitch Scatter',
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
            return 'Dithering (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('dithering', ditheringFS)
          if (!progInfo) return 'Dithering error'

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

          const matrixIdx = [
            'BAYER 8X8',
            'BAYER 4X4',
            'BLUE NOISE GRAIN',
            'CROSSHATCH',
            'CLUSTER DOTS',
            'RANDOM NOISE',
          ].indexOf(v.matrixType)

          const palIdx = [
            '1-BIT MONOCHROME',
            'GAME BOY CLASSIC',
            'CYBERPUNK NEON',
            'AMBER CRT',
            'CGA RETRO',
            'VAPORWAVE PASTEL',
            'TRUE COLOR DITHER',
          ].indexOf(v.palette)

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          const cursorScatter = env.cursorEnabled ? v.cursorScatter : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_pixelSize'), v.pixelSize)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_contrast'), v.contrast)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_ditherAmount'), v.ditherAmount)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_levels'), v.levels)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_matrixType'), matrixIdx >= 0 ? matrixIdx : 0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_palette'), palIdx >= 0 ? palIdx : 0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_invert'), v.invert ? 1 : 0)
          const lightRgb = hexToRgb(v.lightColor || '#f0f1f5')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_lightColor'), lightRgb[0], lightRgb[1], lightRgb[2])
          const darkRgb = hexToRgb(v.darkColor || '#0e1014')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_darkColor'), darkRgb[0], darkRgb[1], darkRgb[2])
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorScatter'), cursorScatter)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Dithering · ${v.matrixType} · ${v.palette} · ${v.pixelSize}px`
        },
      }

export default dithering;
export { dithering };
