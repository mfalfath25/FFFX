import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram } from '../../core/webgl.js';

      const depthMapFS = `#version 300 es
        precision highp float;

        in mediump vec2 v_imageUV;
        in mediump vec2 v_uv;
        out vec4 fragColor;

        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_cursor;

        uniform int u_style;
        uniform int u_colorMap;
        uniform float u_overlaySource;
        uniform float u_invert;

        uniform float u_contrastBoost;
        uniform float u_perspectiveBias;
        uniform float u_edgeSharpness;
        uniform float u_horizonLevel;
        uniform float u_subjectBoost;

        uniform float u_isoContours;
        uniform float u_contourLineWidth;
        uniform float u_focalDistance;
        uniform float u_bokehAperture;
        uniform float u_parallax;
        uniform float u_lightAngle;
        uniform float u_laserScan;

        float getLum(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        float sampleDepth(vec2 uv) {
          vec2 texel = 1.0 / u_resolution;
          vec3 col = texture(u_image, uv).rgb;
          float lum = getLum(col);

          float ground = clamp((uv.y - u_horizonLevel) / max(1.0 - u_horizonLevel, 0.02), 0.0, 1.0);
          float perspRamp = 1.0 - pow(ground, 0.75);

          float lLeft  = getLum(texture(u_image, uv - vec2(texel.x * 2.5, 0.0)).rgb);
          float lRight = getLum(texture(u_image, uv + vec2(texel.x * 2.5, 0.0)).rgb);
          float lUp    = getLum(texture(u_image, uv - vec2(0.0, texel.y * 2.5)).rgb);
          float lDown  = getLum(texture(u_image, uv + vec2(0.0, texel.y * 2.5)).rgb);
          vec2 grad = vec2(lRight - lLeft, lDown - lUp);
          float edgeEnergy = length(grad) * 2.2;

          float maxC = max(col.r, max(col.g, col.b));
          float minC = min(col.r, min(col.g, col.b));
          float sat = (maxC > 1e-4) ? (maxC - minC) / maxC : 0.0;

          vec2 centerVec = (uv - vec2(0.5, 0.55)) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float subjectPrior = exp(-dot(centerVec, centerVec) * 4.5);

          float d = mix(perspRamp, 1.0 - lum, 0.35);
          d = mix(d, perspRamp, clamp(u_perspectiveBias * 0.5, 0.0, 1.0));
          d -= edgeEnergy * u_edgeSharpness * 0.35;
          d -= sat * 0.15;
          d -= subjectPrior * u_subjectBoost * 0.25;

          d = clamp(d, 0.01, 0.99);
          d = pow(d, max(u_contrastBoost, 0.1));

          if (u_invert > 0.5) d = 1.0 - d;
          return clamp(d, 0.0, 1.0);
        }

        vec3 colormapTurbo(float x) {
          x = clamp(x, 0.0, 1.0);
          const vec4 kRedVec4   = vec4(0.13572138,  4.61539260, -42.66032258,  132.13108234);
          const vec4 kGreenVec4 = vec4(0.09140261,  2.19418839,   4.84296658,  -14.18503333);
          const vec4 kBlueVec4  = vec4(0.10667330, 12.64194608, -60.58204836,  110.36276771);
          const vec2 kRedVec2   = vec2(-152.94239396,  59.28637943);
          const vec2 kGreenVec2 = vec2(   4.27729857,   2.82956604);
          const vec2 kBlueVec2  = vec2( -89.90310912,  27.34824973);

          vec4 v4 = vec4(1.0, x, x * x, x * x * x);
          vec2 v2 = v4.zw * v4.z;
          return clamp(vec3(
            dot(v4, kRedVec4)   + dot(v2, kRedVec2),
            dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
            dot(v4, kBlueVec4)  + dot(v2, kBlueVec2)
          ), 0.0, 1.0);
        }

        vec3 colormapSpectral(float t) {
          t = clamp(t, 0.0, 1.0);
          if (t < 0.25) return mix(vec3(0.05, 0.1, 0.6), vec3(0.0, 0.7, 0.9), t * 4.0);
          if (t < 0.5)  return mix(vec3(0.0, 0.7, 0.9), vec3(0.1, 0.85, 0.3), (t - 0.25) * 4.0);
          if (t < 0.75) return mix(vec3(0.1, 0.85, 0.3), vec3(1.0, 0.9, 0.1), (t - 0.5) * 4.0);
          return mix(vec3(1.0, 0.9, 0.1), vec3(0.95, 0.15, 0.1), (t - 0.75) * 4.0);
        }

        vec3 colormapMagma(float t) {
          t = clamp(t, 0.0, 1.0);
          vec3 c1 = vec3(0.00, 0.00, 0.05);
          vec3 c2 = vec3(0.32, 0.07, 0.48);
          vec3 c3 = vec3(0.71, 0.21, 0.48);
          vec3 c4 = vec3(0.98, 0.55, 0.38);
          vec3 c5 = vec3(0.99, 0.99, 0.75);
          if (t < 0.25) return mix(c1, c2, t * 4.0);
          if (t < 0.50) return mix(c2, c3, (t - 0.25) * 4.0);
          if (t < 0.75) return mix(c3, c4, (t - 0.50) * 4.0);
          return mix(c4, c5, (t - 0.75) * 4.0);
        }

        vec3 colormapViridis(float t) {
          t = clamp(t, 0.0, 1.0);
          vec3 c1 = vec3(0.27, 0.00, 0.33);
          vec3 c2 = vec3(0.19, 0.41, 0.56);
          vec3 c3 = vec3(0.12, 0.63, 0.53);
          vec3 c4 = vec3(0.56, 0.79, 0.24);
          vec3 c5 = vec3(0.99, 0.91, 0.15);
          if (t < 0.25) return mix(c1, c2, t * 4.0);
          if (t < 0.50) return mix(c2, c3, (t - 0.25) * 4.0);
          if (t < 0.75) return mix(c3, c4, (t - 0.50) * 4.0);
          return mix(c4, c5, (t - 0.75) * 4.0);
        }

        vec3 colormapCyberpunk(float t) {
          t = clamp(t, 0.0, 1.0);
          vec3 c1 = vec3(0.04, 0.02, 0.16);
          vec3 c2 = vec3(0.48, 0.02, 0.45);
          vec3 c3 = vec3(0.95, 0.05, 0.65);
          vec3 c4 = vec3(0.00, 0.88, 1.00);
          vec3 c5 = vec3(0.95, 1.00, 1.00);
          if (t < 0.25) return mix(c1, c2, t * 4.0);
          if (t < 0.50) return mix(c2, c3, (t - 0.25) * 4.0);
          if (t < 0.75) return mix(c3, c4, (t - 0.50) * 4.0);
          return mix(c4, c5, (t - 0.75) * 4.0);
        }

        vec3 colormapEmerald(float t) {
          t = clamp(t, 0.0, 1.0);
          return mix(vec3(0.02, 0.10, 0.08), vec3(0.15, 1.00, 0.65), t);
        }

        vec3 applyPalette(float d) {
          if (u_colorMap == 0) return colormapTurbo(d);
          if (u_colorMap == 1) return colormapSpectral(d);
          if (u_colorMap == 2) return colormapMagma(d);
          if (u_colorMap == 3) return colormapViridis(d);
          if (u_colorMap == 4) return colormapCyberpunk(d);
          if (u_colorMap == 5) return colormapEmerald(d);
          return vec3(clamp(d, 0.0, 1.0));
        }

        void main() {
          vec2 uv = v_imageUV;
          float depth = sampleDepth(uv);
          vec3 srcCol = texture(u_image, uv).rgb;
          vec3 col = applyPalette(depth);

          // Style 0: LIDAR SCANNER (Turbo / Rainbow)
          if (u_style == 0) {
            if (u_isoContours > 0.5) {
              float ring = fract(depth * u_isoContours);
              float line = smoothstep(u_contourLineWidth * 0.06, 0.0, abs(ring - 0.5));
              col = mix(col, vec3(1.0), line * 0.45);
            }
            if (u_laserScan > 0.01) {
              float scanY = fract(u_time * 0.35);
              float scanDist = abs(uv.y - scanY);
              float laserBeam = exp(-scanDist * scanDist * 4000.0) * u_laserScan;
              col += vec3(0.3, 0.85, 1.0) * laserBeam * 2.2;
            }
          }
          // Style 1: INFRARED NIGHT VISION (NVG)
          else if (u_style == 1) {
            vec3 nvg = mix(vec3(0.01, 0.08, 0.03), vec3(0.15, 0.98, 0.35), pow(depth, 0.75));
            float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
            nvg *= 0.85 + 0.15 * scanline;
            float gn = fract(sin(dot(uv * (u_time + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
            nvg += (gn - 0.5) * 0.07;
            vec2 sc = uv - 0.5;
            float vig = 1.0 - dot(sc, sc) * 1.5;
            col = nvg * clamp(vig, 0.0, 1.0);
          }
          // Style 2: TOPOGRAPHIC CONTOURS
          else if (u_style == 2) {
            vec3 bgTop = vec3(0.04, 0.06, 0.09);
            float bands = depth * max(u_isoContours, 4.0);
            float bandFrac = fract(bands);
            float majorLine = smoothstep(u_contourLineWidth * 0.08, 0.0, abs(fract(bands * 0.2) - 0.5));
            float minorLine = smoothstep(u_contourLineWidth * 0.05, 0.0, abs(bandFrac - 0.5));
            vec3 topoCol = applyPalette(depth);
            col = mix(bgTop, topoCol, 0.18 + 0.82 * max(minorLine * 0.7, majorLine));
          }
          // Style 3: DEPTH OF FIELD BOKEH
          else if (u_style == 3) {
            float coc = abs(depth - u_focalDistance) * (u_bokehAperture / u_resolution.y);
            vec3 bokehAcc = vec3(0.0);
            float totalW = 0.0;
            const int TAPS = 16;
            for (int i = 0; i < TAPS; i++) {
              float th = float(i) * 2.39996323;
              float r = sqrt(float(i + 1) / float(TAPS)) * coc;
              vec2 off = vec2(cos(th), sin(th)) * r;
              vec3 tapCol = texture(u_image, clamp(uv + off, 0.001, 0.999)).rgb;
              float w = 1.0 + getLum(tapCol) * 1.6;
              bokehAcc += tapCol * w;
              totalW += w;
            }
            vec3 dof = bokehAcc / max(totalW, 1e-4);
            float focalGuide = smoothstep(0.02, 0.0, abs(depth - u_focalDistance));
            col = mix(dof, dof * vec3(1.1, 1.25, 1.0), focalGuide * 0.35);
          }
          // Style 4: ANAGLYPH 3D STEREO
          else if (u_style == 4) {
            float shift = (depth - 0.5) * (u_parallax / u_resolution.x);
            vec3 colL = texture(u_image, clamp(uv - vec2(shift, 0.0), 0.001, 0.999)).rgb;
            vec3 colR = texture(u_image, clamp(uv + vec2(shift, 0.0), 0.001, 0.999)).rgb;
            col = vec3(colL.r, colR.g, colR.b);
          }
          // Style 5: SURFACE NORMAL RELIEF
          else if (u_style == 5) {
            vec2 texel = 1.0 / u_resolution;
            float dL = sampleDepth(uv - vec2(texel.x * 2.0, 0.0));
            float dR = sampleDepth(uv + vec2(texel.x * 2.0, 0.0));
            float dU = sampleDepth(uv - vec2(0.0, texel.y * 2.0));
            float dD = sampleDepth(uv + vec2(0.0, texel.y * 2.0));
            vec3 norm = normalize(vec3((dL - dR) * 25.0, (dU - dD) * 25.0, 1.0));

            float la = radians(u_lightAngle);
            vec3 lightDir = normalize(vec3(cos(la), -sin(la), 0.7));
            float diff = max(dot(norm, lightDir), 0.0);
            vec3 halfV = normalize(lightDir + vec3(0.0, 0.0, 1.0));
            float spec = pow(max(dot(norm, halfV), 0.0), 32.0) * 0.6;

            vec3 clay = applyPalette(depth);
            col = clay * (0.28 + 0.72 * diff) + vec3(1.0) * spec;
          }
          // Style 6: CYBERPUNK HOLO-GRID
          else if (u_style == 6) {
            vec2 gridUV = uv * vec2(30.0, 20.0) + vec2(depth * 5.0, 0.0);
            vec2 gridLines = abs(fract(gridUV - 0.5) - 0.5) / max(fwidth(gridUV), vec2(0.001));
            float lineG = 1.0 - min(min(gridLines.x, gridLines.y), 1.0);
            vec3 gridCol = mix(vec3(0.02, 0.03, 0.08), vec3(0.0, 0.9, 1.0), depth);
            gridCol += vec3(1.0, 0.0, 0.65) * lineG * 1.6;
            col = gridCol;
          }
          // Style 7: PRISTINE LINEAR DEPTH
          else {
            col = vec3(depth);
          }

          if (u_overlaySource > 0.001) {
            col = mix(col, srcCol, clamp(u_overlaySource, 0.0, 1.0));
          }

          fragColor = vec4(col, 1.0);
        }
      `;

      const depthMap = {
        id: 'depth-map',
        label: 'Depth Map',

        groups: [
          {
            title: 'Visual Style & Palette',
            controls: [
              {
                key: 'style',
                label: 'Depth Style',
                type: 'select',
                options: [
                  'LIDAR SCANNER (Turbo)',
                  'INFRARED NIGHT VISION',
                  'TOPOGRAPHIC CONTOURS',
                  'DEPTH OF FIELD BOKEH',
                  'ANAGLYPH 3D STEREO',
                  'SURFACE NORMAL RELIEF',
                  'CYBERPUNK HOLO-GRID',
                  'PRISTINE LINEAR DEPTH',
                ],
                value: 'LIDAR SCANNER (Turbo)',
              },
              {
                key: 'colorMap',
                label: 'Color Palette',
                type: 'select',
                options: ['Turbo', 'Spectral', 'Magma', 'Viridis', 'Cyberpunk', 'Emerald', 'Monochrome'],
                value: 'Turbo',
              },
              {
                key: 'overlaySource',
                label: 'Original Media Blend',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                value: 0.15,
              },
              {
                key: 'invert',
                label: 'Invert Depth',
                type: 'checkbox',
                value: false,
              },
            ],
          },
          {
            title: 'Depth Estimation Parameters',
            controls: [
              {
                key: 'contrastBoost',
                label: 'Depth Dynamic Range',
                type: 'range',
                min: 0.5,
                max: 3.0,
                step: 0.05,
                value: 1.4,
              },
              {
                key: 'perspectiveBias',
                label: 'Perspective Gradient',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.05,
                value: 0.85,
              },
              {
                key: 'edgeSharpness',
                label: 'Edge Discontinuity',
                type: 'range',
                min: 0.0,
                max: 3.0,
                step: 0.05,
                value: 1.2,
              },
              {
                key: 'horizonLevel',
                label: 'Horizon Position',
                type: 'range',
                min: 0.1,
                max: 0.9,
                step: 0.01,
                value: 0.45,
              },
              {
                key: 'subjectBoost',
                label: 'Subject Pop (Near)',
                type: 'range',
                min: 0.0,
                max: 2.0,
                step: 0.05,
                value: 0.7,
              },
            ],
          },
          {
            title: 'Style Specific Modifiers',
            controls: [
              {
                key: 'isoContours',
                label: 'Contour Rings',
                type: 'range',
                min: 0,
                max: 50,
                step: 1,
                value: 16,
              },
              {
                key: 'contourLineWidth',
                label: 'Ring Line Width',
                type: 'range',
                min: 0.5,
                max: 5.0,
                step: 0.1,
                value: 1.5,
              },
              {
                key: 'focalDistance',
                label: 'Bokeh Focal Plane',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.01,
                value: 0.45,
              },
              {
                key: 'bokehAperture',
                label: 'Bokeh Blur Radius',
                type: 'range',
                min: 0.0,
                max: 25.0,
                step: 0.5,
                value: 12.0,
              },
              {
                key: 'parallax',
                label: '3D Parallax Shift',
                type: 'range',
                min: 0.0,
                max: 40.0,
                step: 0.5,
                value: 14.0,
              },
              {
                key: 'lightAngle',
                label: 'Relief Light Angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 1,
                value: 315,
                unit: '°',
              },
              {
                key: 'laserScan',
                label: 'LiDAR Laser Sweep',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.01,
                value: 0.6,
              },
            ],
          },
          {
            title: 'HUD & Diagnostics',
            controls: [
              {
                key: 'showHUD',
                label: 'Show Distance HUD',
                type: 'checkbox',
                value: true,
              },
              {
                key: 'showDepthRuler',
                label: 'Depth Colorbar Ruler',
                type: 'checkbox',
                value: true,
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
            return 'Depth Map (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('depthMap', depthMapFS)
          if (!progInfo) return 'Depth Map shader error'

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

          const loc = (n) => gl.getUniformLocation(progInfo.prog, n)
          gl.uniform1i(loc('u_image'), 0)
          gl.uniform2f(loc('u_resolution'), W, H)
          gl.uniform1f(loc('u_time'), env.time)

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          gl.uniform2f(loc('u_cursor'), curX, curY)

          const styleIdx = [
            'LIDAR SCANNER (Turbo)',
            'INFRARED NIGHT VISION',
            'TOPOGRAPHIC CONTOURS',
            'DEPTH OF FIELD BOKEH',
            'ANAGLYPH 3D STEREO',
            'SURFACE NORMAL RELIEF',
            'CYBERPUNK HOLO-GRID',
            'PRISTINE LINEAR DEPTH',
          ].indexOf(v.style)
          gl.uniform1i(loc('u_style'), Math.max(0, styleIdx))

          const colorMapIdx = ['Turbo', 'Spectral', 'Magma', 'Viridis', 'Cyberpunk', 'Emerald', 'Monochrome'].indexOf(v.colorMap)
          gl.uniform1i(loc('u_colorMap'), Math.max(0, colorMapIdx))

          gl.uniform1f(loc('u_overlaySource'), Number(v.overlaySource || 0))
          gl.uniform1f(loc('u_invert'), v.invert ? 1.0 : 0.0)

          gl.uniform1f(loc('u_contrastBoost'), Number(v.contrastBoost || 1.4))
          gl.uniform1f(loc('u_perspectiveBias'), Number(v.perspectiveBias || 0.85))
          gl.uniform1f(loc('u_edgeSharpness'), Number(v.edgeSharpness || 1.2))
          gl.uniform1f(loc('u_horizonLevel'), Number(v.horizonLevel || 0.45))
          gl.uniform1f(loc('u_subjectBoost'), Number(v.subjectBoost || 0.7))

          gl.uniform1f(loc('u_isoContours'), Number(v.isoContours || 16))
          gl.uniform1f(loc('u_contourLineWidth'), Number(v.contourLineWidth || 1.5))
          gl.uniform1f(loc('u_focalDistance'), Number(v.focalDistance || 0.45))
          gl.uniform1f(loc('u_bokehAperture'), Number(v.bokehAperture || 12))
          gl.uniform1f(loc('u_parallax'), Number(v.parallax || 14))
          gl.uniform1f(loc('u_lightAngle'), Number(v.lightAngle || 315))
          gl.uniform1f(loc('u_laserScan'), Number(v.laserScan || 0.6))

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          // 2D HUD & Diagnostics Overlays
          if (v.showDepthRuler) {
            this.drawDepthRuler(W, H, v)
          }
          if (v.showHUD) {
            this.drawHUD(W, H, v)
          }

          return `Depth Map · ${v.style} · Palette ${v.colorMap}`
        },

        drawDepthRuler(W, H, v) {
          const rx = W - 32
          const ry = 60
          const rw = 10
          const rh = H - 120
          if (rh <= 20) return

          ctx.save()
          // Background capsule
          ctx.fillStyle = 'rgba(10, 14, 20, 0.75)'
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
          ctx.lineWidth = 1
          ctx.fillRect(rx - 4, ry - 18, rw + 28, rh + 36)
          ctx.strokeRect(rx - 4, ry - 18, rw + 28, rh + 36)

          // Color gradient
          const grad = ctx.createLinearGradient(0, ry, 0, ry + rh)
          if (v.colorMap === 'Spectral') {
            grad.addColorStop(0, '#0d1a99')
            grad.addColorStop(0.33, '#00b3e6')
            grad.addColorStop(0.66, '#1ad94d')
            grad.addColorStop(1, '#f2261a')
          } else if (v.colorMap === 'Magma') {
            grad.addColorStop(0, '#00000d')
            grad.addColorStop(0.35, '#7a1c7a')
            grad.addColorStop(0.7, '#fa8c61')
            grad.addColorStop(1, '#fcfebe')
          } else if (v.colorMap === 'Viridis') {
            grad.addColorStop(0, '#440154')
            grad.addColorStop(0.35, '#31688e')
            grad.addColorStop(0.7, '#35b779')
            grad.addColorStop(1, '#fde725')
          } else if (v.colorMap === 'Cyberpunk') {
            grad.addColorStop(0, '#0a0529')
            grad.addColorStop(0.4, '#f20da6')
            grad.addColorStop(0.8, '#00e1ff')
            grad.addColorStop(1, '#ffffff')
          } else if (v.colorMap === 'Emerald') {
            grad.addColorStop(0, '#051a14')
            grad.addColorStop(1, '#26ffa6')
          } else if (v.colorMap === 'Monochrome') {
            grad.addColorStop(0, '#000000')
            grad.addColorStop(1, '#ffffff')
          } else {
            // Turbo default
            grad.addColorStop(0, '#30123b')
            grad.addColorStop(0.25, '#1ae4b6')
            grad.addColorStop(0.5, '#a2fc3c')
            grad.addColorStop(0.75, '#fb8022')
            grad.addColorStop(1, '#7a0403')
          }

          ctx.fillStyle = grad
          ctx.fillRect(rx, ry, rw, rh)

          // Labels
          ctx.font = '8px monospace'
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'left'
          ctx.fillText('FAR', rx + rw + 4, ry + 6)
          ctx.fillText('12m', rx + rw + 4, ry + 16)
          ctx.fillText('MID', rx + rw + 4, ry + rh * 0.5 + 3)
          ctx.fillText('NEAR', rx + rw + 4, ry + rh - 4)
          ctx.fillText('0.3m', rx + rw + 4, ry + rh + 6)
          ctx.restore()
        },

        drawHUD(W, H, v) {
          ctx.save()
          // Corner Brackets
          const bsz = 14
          ctx.strokeStyle = '#00f0ff'
          ctx.lineWidth = 1.5

          // Top Left
          ctx.beginPath()
          ctx.moveTo(12, 12 + bsz); ctx.lineTo(12, 12); ctx.lineTo(12 + bsz, 12)
          ctx.stroke()
          // Top Right
          ctx.beginPath()
          ctx.moveTo(W - 12 - bsz, 12); ctx.lineTo(W - 12, 12); ctx.lineTo(W - 12, 12 + bsz)
          ctx.stroke()
          // Bottom Left
          ctx.beginPath()
          ctx.moveTo(12, H - 12 - bsz); ctx.lineTo(12, H - 12); ctx.lineTo(12 + bsz, H - 12)
          ctx.stroke()
          // Bottom Right
          ctx.beginPath()
          ctx.moveTo(W - 12 - bsz, H - 12); ctx.lineTo(W - 12, H - 12); ctx.lineTo(W - 12, H - 12 - bsz)
          ctx.stroke()

          // Telemetry Text
          ctx.fillStyle = 'rgba(10, 15, 24, 0.75)'
          ctx.fillRect(16, 16, 210, 36)
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)'
          ctx.strokeRect(16, 16, 210, 36)

          ctx.font = '9px monospace'
          ctx.fillStyle = '#00f0ff'
          ctx.fillText(`LIDAR ESTIMATOR // ${v.style.slice(0, 16)}`, 22, 29)
          ctx.fillStyle = '#a0c0d0'
          ctx.fillText(`RANGE: 0.3m-15.0m · FOV: 78° · 60FPS`, 22, 43)

          // Interactive Cursor Depth Probe
          if (env.cursorEnabled && env.cursor.x > 0 && env.cursor.y > 0) {
            const cx = env.cursor.x
            const cy = env.cursor.y
            const normY = cy / H
            const estDist = (0.3 + (1.0 - normY) * 9.5).toFixed(2)
            const zPct = Math.round((1.0 - normY) * 100)

            ctx.strokeStyle = '#ff0055'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(cx, cy, 14, 0, Math.PI * 2)
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 16, cy)
            ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 20, cy)
            ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 16)
            ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy + 20)
            ctx.stroke()

            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
            ctx.fillRect(cx + 18, cy - 16, 105, 28)
            ctx.strokeStyle = '#ff0055'
            ctx.strokeRect(cx + 18, cy - 16, 105, 28)

            ctx.font = '9px monospace'
            ctx.fillStyle = '#ff0055'
            ctx.fillText(`DEPTH: ${estDist}m`, cx + 22, cy - 4)
            ctx.fillStyle = '#ffffff'
            ctx.fillText(`Z: [${zPct}%]`, cx + 22, cy + 8)
          }

          ctx.restore()
        },
      }

export default depthMap;
export { depthMap };
