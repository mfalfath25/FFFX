import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const halftoneCMYKFS = `
        precision highp float;
        varying vec2 v_uv;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_scale;
        uniform float u_softness;
        uniform float u_angle;
        uniform float u_contrast;
        uniform float u_opacity;
        uniform float u_cScale;
        uniform float u_mScale;
        uniform float u_yScale;
        uniform float u_kScale;
        uniform vec3 u_paperColor;
        uniform vec2 u_cursor;
        uniform float u_cursorDistort;

        mat2 rot2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        float getChannelDot(vec2 uv, float angleDeg, float channelVal, float scale, float softness) {
          float rad = angleDeg * 3.14159265 / 180.0;
          mat2 rot = rot2d(rad);
          vec2 rotUV = rot * (uv * u_resolution) / scale;
          vec2 grid = fract(rotUV) - 0.5;
          float d = length(grid);
          float radius = sqrt(clamp(channelVal, 0.0, 1.0)) * 0.7071;
          float s = max(softness * 0.5, 0.001);
          return 1.0 - smoothstep(radius - s, radius + s, d);
        }

        void main() {
          vec2 uv = v_uv;
          
          vec2 toCursor = (uv - u_cursor) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float distCursor = length(toCursor);
          if (distCursor < 0.45 && u_cursorDistort > 0.0) {
            vec2 disp = normalize(toCursor) * sin(distCursor * 22.0) * exp(-distCursor * 5.5) * u_cursorDistort * 0.035;
            uv += disp;
          }

          vec4 img = texture2D(u_image, uv);
          vec3 rgb = clamp(img.rgb, 0.0, 1.0);

          rgb = clamp((rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);

          float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
          float denom = max(1.0 - k, 0.0001);
          float c = (1.0 - rgb.r - k) / denom;
          float m = (1.0 - rgb.g - k) / denom;
          float y = (1.0 - rgb.b - k) / denom;

          c = clamp(c * u_cScale, 0.0, 1.0);
          m = clamp(m * u_mScale, 0.0, 1.0);
          y = clamp(y * u_yScale, 0.0, 1.0);
          k = clamp(k * u_kScale, 0.0, 1.0);

          // Standard offset printing angles: C: 15°, M: 75°, Y: 0°, K: 45°
          float dotC = getChannelDot(uv, u_angle + 15.0, c, u_scale, u_softness);
          float dotM = getChannelDot(uv, u_angle + 75.0, m, u_scale, u_softness);
          float dotY = getChannelDot(uv, u_angle + 0.0,  y, u_scale, u_softness);
          float dotK = getChannelDot(uv, u_angle + 45.0, k, u_scale, u_softness);

          vec3 whitePaper = u_paperColor;
          vec3 cyanInk    = vec3(0.0, 0.65, 0.85);
          vec3 magentaInk = vec3(0.85, 0.05, 0.5);
          vec3 yellowInk  = vec3(0.95, 0.9, 0.05);
          vec3 blackInk   = vec3(0.05, 0.05, 0.08);

          vec3 outColor = whitePaper;
          outColor *= (vec3(1.0) - cyanInk * dotC);
          outColor *= (vec3(1.0) - magentaInk * dotM);
          outColor *= (vec3(1.0) - yellowInk * dotY);
          outColor *= (vec3(1.0) - (vec3(1.0) - blackInk) * dotK);

          vec3 finalRgb = mix(rgb, outColor, u_opacity);
          gl_FragColor = vec4(finalRgb, 1.0);
        }
      `

      const halftoneCMYK = {
        id: 'halftone-cmyk',
        label: 'Halftone CMYK',
        groups: [
          {
            title: 'Screen & Geometry',
            controls: [
              {
                key: 'scale',
                label: 'Screen Dot Size',
                type: 'range',
                min: 3,
                max: 50,
                step: 1,
                value: 12,
                unit: 'px',
              },
              {
                key: 'softness',
                label: 'Dot Softness',
                type: 'range',
                min: 0.01,
                max: 0.6,
                step: 0.02,
                value: 0.15,
              },
              {
                key: 'angle',
                label: 'Base Angle Offset',
                type: 'range',
                min: 0,
                max: 360,
                step: 5,
                value: 0,
                unit: '°',
              },
              {
                key: 'contrast',
                label: 'Image Contrast',
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
            title: 'Paper & Inks',
            controls: [
              {
                key: 'paperColor',
                label: 'Paper Tint',
                type: 'color',
                value: '#f8f6ee',
              },
              {
                key: 'opacity',
                label: 'CMYK Ink Opacity',
                type: 'range',
                min: 0.1,
                max: 1.0,
                step: 0.05,
                value: 1.0,
              },
              {
                key: 'cScale',
                label: 'Cyan Density',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'mScale',
                label: 'Magenta Density',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'yScale',
                label: 'Yellow Density',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'kScale',
                label: 'Black (K) Density',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
            ],
          },
          {
            title: 'Interaction',
            controls: [
              {
                key: 'cursorDistort',
                label: 'Cursor Print Ripple',
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
            return 'Halftone CMYK (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('halftoneCMYK', halftoneCMYKFS)
          if (!progInfo) return 'Halftone CMYK error'

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

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          const cursorDistort = env.cursorEnabled ? v.cursorDistort : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_scale'), v.scale)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_softness'), v.softness)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_contrast'), v.contrast)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_opacity'), v.opacity)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cScale'), v.cScale)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_mScale'), v.mScale)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_yScale'), v.yScale)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_kScale'), v.kScale)
          const paperRgb = hexToRgb(v.paperColor || '#f8f6ee')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_paperColor'), paperRgb[0], paperRgb[1], paperRgb[2])
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorDistort'), cursorDistort)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Halftone CMYK · ${v.scale}px dot · C:${v.cScale} M:${v.mScale} Y:${v.yScale} K:${v.kScale}`
        },
      }

export default halftoneCMYK;
export { halftoneCMYK };
