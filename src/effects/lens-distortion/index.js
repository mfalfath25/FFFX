import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram } from '../../core/webgl.js';

                  // ======================================================================
      // 11. LENS DISTORTION (Paper Shaders Parity with chromatic aberration, bulge, swirl & grain)
      // Reference: https://shaders.paper.design/lens-distortion
      // ======================================================================
      const LENS_DISTORTION_PRESETS = {
        DEFAULT: {
          spread: 0.32,
          bias: -0.34,
          angle: 4,
          perspective: 1.00,
          count: 35,
          dispersion: 1.00,
          dispersionShift: 0.00,
          dispersionColor: 0.60,
          focusCenter: 0.80,
          focusEdges: 1.00,
          swirl: 0.35,
          noise: 0.00,
          noiseFrequency: 0.25,
          noiseOffset: 0.00,
          lensBulge: 0.00,
          lensCircle: 0.00,
          grainMixer: 0.00,
          grainOverlay: 0.00,
          imageX: 0.00,
          imageY: 0.00,
          scale: 1.00,
          fit: 'contain',
        },
        FISHEYE: {
          spread: 0.45,
          bias: 0.00,
          angle: 0,
          perspective: 1.00,
          count: 30,
          dispersion: 0.80,
          dispersionShift: 0.20,
          dispersionColor: 0.30,
          focusCenter: 0.90,
          focusEdges: 0.30,
          swirl: 0.00,
          noise: 0.00,
          noiseFrequency: 0.25,
          noiseOffset: 0.00,
          lensBulge: 0.70,
          lensCircle: 0.65,
          grainMixer: 0.00,
          grainOverlay: 0.02,
          imageX: 0.00,
          imageY: 0.00,
          scale: 0.95,
          fit: 'contain',
        },
        DUOTONE: {
          spread: 0.60,
          bias: -0.45,
          angle: 35,
          perspective: 0.80,
          count: 40,
          dispersion: 1.00,
          dispersionShift: -0.15,
          dispersionColor: 0.85,
          focusCenter: 0.50,
          focusEdges: 0.95,
          swirl: 0.50,
          noise: 0.20,
          noiseFrequency: 0.35,
          noiseOffset: 0.10,
          lensBulge: 0.25,
          lensCircle: 0.00,
          grainMixer: 0.15,
          grainOverlay: 0.10,
          imageX: 0.00,
          imageY: 0.00,
          scale: 1.00,
          fit: 'contain',
        },
        SMOKE: {
          spread: 0.75,
          bias: -0.20,
          angle: 80,
          perspective: 0.60,
          count: 45,
          dispersion: 0.90,
          dispersionShift: 0.10,
          dispersionColor: 0.55,
          focusCenter: 0.30,
          focusEdges: 0.80,
          swirl: 0.85,
          noise: 0.50,
          noiseFrequency: 0.60,
          noiseOffset: 0.30,
          lensBulge: -0.20,
          lensCircle: 0.00,
          grainMixer: 0.25,
          grainOverlay: 0.20,
          imageX: 0.00,
          imageY: 0.00,
          scale: 1.05,
          fit: 'contain',
        },
      }

      const lensDistortionFS = `#version 300 es
        precision highp float;
        in vec2 v_imageUV;
        out vec4 fragColor;

        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform vec2 u_imageResolution;
        uniform float u_time;

        uniform float u_spread;
        uniform float u_bias;
        uniform float u_angle;
        uniform float u_perspective;
        uniform float u_count;
        uniform float u_dispersion;
        uniform float u_dispersionShift;
        uniform float u_dispersionColor;
        uniform float u_focusCenter;
        uniform float u_focusEdges;
        uniform float u_swirl;
        uniform float u_noise;
        uniform float u_noiseFrequency;
        uniform float u_noiseOffset;
        uniform float u_lensBulge;
        uniform float u_lensCircle;
        uniform float u_grainMixer;
        uniform float u_grainOverlay;
        uniform float u_imageX;
        uniform float u_imageY;
        uniform float u_scale;
        uniform int u_fit;
        uniform vec2 u_center;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float noise2d(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash12(i + vec2(0.0, 0.0));
          float b = hash12(i + vec2(1.0, 0.0));
          float c = hash12(i + vec2(0.0, 1.0));
          float d = hash12(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        vec3 spectralRainbow(float t) {
          t = fract(t);
          vec3 c = 0.5 + 0.5 * cos(6.28318530718 * (t + vec3(0.0, 0.333, 0.667)));
          return c * 1.5;
        }

        vec4 sampleFittedImage(vec2 p) {
          vec2 uvCoord = p;
          
          if (u_fit == 0) { // contain
            float imgRatio = u_imageResolution.x / max(1.0, u_imageResolution.y);
            float screenRatio = u_resolution.x / max(1.0, u_resolution.y);
            vec2 fittedDim = (screenRatio > imgRatio) 
              ? vec2(u_resolution.y * imgRatio, u_resolution.y) 
              : vec2(u_resolution.x, u_resolution.x / imgRatio);
            vec2 offset = (u_resolution - fittedDim) * 0.5 / u_resolution;
            vec2 relUV = (uvCoord - offset) * (u_resolution / fittedDim);
            relUV = (relUV - 0.5) / max(0.01, u_scale) + 0.5;
            relUV -= vec2(u_imageX, u_imageY);
            if (relUV.x < 0.0 || relUV.x > 1.0 || relUV.y < 0.0 || relUV.y > 1.0) {
              return vec4(0.0, 0.0, 0.0, 1.0);
            }
            return texture(u_image, relUV);
          } else if (u_fit == 1) { // cover
            float imgRatio = u_imageResolution.x / max(1.0, u_imageResolution.y);
            float screenRatio = u_resolution.x / max(1.0, u_resolution.y);
            vec2 fittedDim = (screenRatio < imgRatio) 
              ? vec2(u_resolution.y * imgRatio, u_resolution.y) 
              : vec2(u_resolution.x, u_resolution.x / imgRatio);
            vec2 offset = (u_resolution - fittedDim) * 0.5 / u_resolution;
            vec2 relUV = (uvCoord - offset) * (u_resolution / fittedDim);
            relUV = (relUV - 0.5) / max(0.01, u_scale) + 0.5;
            relUV -= vec2(u_imageX, u_imageY);
            return texture(u_image, clamp(relUV, 0.0, 1.0));
          } else { // fill
            vec2 relUV = (uvCoord - 0.5) / max(0.01, u_scale) + 0.5;
            relUV -= vec2(u_imageX, u_imageY);
            return texture(u_image, clamp(relUV, 0.0, 1.0));
          }
        }

        void main() {
          vec2 uv = v_imageUV;
          vec2 center = u_center;
          vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
          
          vec2 p = (uv - center) * aspect;
          float r = length(p);
          
          // Lens Bulge (barrel / pincushion)
          vec2 warpedP = p;
          if (abs(u_lensBulge) > 0.001) {
            float k = u_lensBulge * 1.8;
            float r2 = r * r;
            if (u_lensBulge > 0.0) {
              float f = 1.0 + k * r2 + k * 0.5 * r2 * r2;
              warpedP = p * f;
            } else {
              float f = 1.0 / (1.0 + abs(k) * r2 * 1.5);
              warpedP = p * f;
            }
          }
          
          // Lens Circle
          float circleMask = 1.0;
          if (u_lensCircle > 0.01) {
            float maxR = 0.5 * min(aspect.x, aspect.y);
            float edgeDist = length(warpedP) / max(0.001, maxR);
            if (edgeDist > 1.0) {
              float squeeze = mix(1.0, 1.0 / edgeDist, u_lensCircle);
              warpedP *= squeeze;
            }
            circleMask = 1.0 - smoothstep(1.0 - 0.05 * u_lensCircle, 1.0, length(warpedP) / maxR) * u_lensCircle;
          }
          
          vec2 baseUV = warpedP / aspect + center;
          
          if (u_spread <= 0.001) {
            vec4 col = sampleFittedImage(baseUV);
            if (u_grainOverlay > 0.001) {
              float gNoise = (hash12(gl_FragCoord.xy + fract(u_time * 17.13) * 100.0) - 0.5);
              col.rgb += gNoise * u_grainOverlay;
            }
            col.rgb *= circleMask;
            fragColor = vec4(col.rgb, 1.0);
            return;
          }
          
          int sampleCount = int(clamp(u_count, 2.0, 50.0));
          float fCount = float(sampleCount);
          float distC = length(warpedP);
          
          float centerFocus = smoothstep(0.0, 0.45 * (u_focusCenter + 0.001), distC);
          float edgeFocus = 1.0 - u_focusEdges * smoothstep(0.35 * min(aspect.x, aspect.y), 0.70 * max(aspect.x, aspect.y), distC);
          float focusMod = mix(1.0, centerFocus * edgeFocus, clamp(max(u_focusCenter, u_focusEdges), 0.0, 1.0));
          
          float rad = radians(u_angle);
          vec2 dirLinear = vec2(cos(rad), sin(rad));
          vec2 dirRadial = (distC > 0.0001) ? normalize(warpedP) : vec2(0.0);
          vec2 baseSpreadDir = normalize(mix(dirLinear, dirRadial, clamp(u_perspective, 0.0, 1.0)));
          
          vec3 accumColor = vec3(0.0);
          float totalWeight = 0.0;
          
          for (int i = 0; i < 50; i++) {
            if (i >= sampleCount) break;
            
            float t = float(i) / max(1.0, fCount - 1.0);
            float normProg = (t - 0.5) * 2.0;
            
            float biasedProg = normProg;
            if (abs(u_bias) > 0.01) {
              float signP = sign(normProg);
              float absP = abs(normProg);
              if (u_bias > 0.0) {
                biasedProg = signP * pow(absP, 1.0 + u_bias * 2.5);
              } else {
                biasedProg = signP * (1.0 - pow(1.0 - absP, 1.0 + abs(u_bias) * 2.5));
              }
            }
            
            vec2 layerP = warpedP;
            if (abs(u_swirl) > 0.001) {
              float swirlFalloff = max(0.0, 1.0 - distC / (0.75 * min(aspect.x, aspect.y)));
              float swirlAngle = biasedProg * u_swirl * 3.14159265 * swirlFalloff;
              float cosS = cos(swirlAngle);
              float sinS = sin(swirlAngle);
              layerP = vec2(layerP.x * cosS - layerP.y * sinS, layerP.x * sinS + layerP.y * cosS);
            }
            
            vec2 layerNoise = vec2(0.0);
            if (u_noise > 0.001) {
              vec2 nCoord = (layerP * (1.0 + u_noiseFrequency * 8.0)) + vec2(u_noiseOffset * 7.13, u_noiseOffset * 11.37);
              float n1 = noise2d(nCoord) - 0.5;
              float n2 = noise2d(nCoord + vec2(37.2, 59.4)) - 0.5;
              layerNoise = vec2(n1, n2) * (u_noise * 0.12 * (1.0 + abs(biasedProg)));
            }
            
            vec2 layerGrain = vec2(0.0);
            if (u_grainMixer > 0.001) {
              float g1 = hash12(gl_FragCoord.xy + vec2(float(i) * 19.3, float(i) * 31.7)) - 0.5;
              float g2 = hash12(gl_FragCoord.xy + vec2(float(i) * 43.1, float(i) * 7.9)) - 0.5;
              layerGrain = vec2(g1, g2) * (u_grainMixer * 0.04);
            }
            
            float spreadDist = u_spread * 0.35 * focusMod * biasedProg;
            vec2 layerOffset = (baseSpreadDir * spreadDist + layerNoise + layerGrain) / aspect;
            vec2 layerUV = layerP / aspect + center + layerOffset;
            
            vec4 sampleCol = sampleFittedImage(layerUV);
            vec3 layerRGB = sampleCol.rgb;
            
            if (u_dispersion > 0.001) {
              float shift = u_dispersionShift * (distC - 0.3);
              float spectrumHue = fract(t + u_dispersionColor + shift);
              vec3 spectrumCol = spectralRainbow(spectrumHue);
              layerRGB = mix(layerRGB, layerRGB * spectrumCol, u_dispersion);
            }
            
            accumColor += layerRGB;
            totalWeight += 1.0;
          }
          
          vec3 finalCol = (totalWeight > 0.0) ? (accumColor / totalWeight) : vec3(0.0);
          
          if (u_grainOverlay > 0.001) {
            float overlayGrain = (hash12(gl_FragCoord.xy + fract(u_time * 19.41) * 100.0) - 0.5);
            finalCol += overlayGrain * u_grainOverlay;
          }
          
          finalCol *= circleMask;
          fragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
        }
      `

      const lensDistortion = {
        id: 'lens-distortion',
        label: 'Lens Distortion',
        groups: [
          {
            title: 'Presets',
            controls: [
              {
                key: 'preset',
                label: 'Load Preset',
                type: 'select',
                options: Object.keys(LENS_DISTORTION_PRESETS),
                value: 'DEFAULT',
                onChange(presetName) {
                  const p = LENS_DISTORTION_PRESETS[presetName]
                  if (p) {
                    const v = values['lens-distortion']
                    Object.assign(v, p)
                    renderPanel()
                  }
                },
              },
            ],
          },
          {
            title: 'Spread & Dispersion',
            controls: [
              {
                key: 'spread',
                label: 'spread',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.32,
              },
              {
                key: 'bias',
                label: 'bias',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: -0.34,
              },
              {
                key: 'angle',
                label: 'angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 1,
                value: 4,
                unit: '°',
              },
              {
                key: 'perspective',
                label: 'perspective',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 1.00,
              },
              {
                key: 'count',
                label: 'count',
                type: 'range',
                min: 2,
                max: 50,
                step: 1,
                value: 35,
              },
              {
                key: 'dispersion',
                label: 'dispersion',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 1.00,
              },
              {
                key: 'dispersionShift',
                label: 'dispersionShift',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'dispersionColor',
                label: 'dispersionColor',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.60,
              },
              {
                key: 'focusCenter',
                label: 'focusCenter',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.80,
              },
              {
                key: 'focusEdges',
                label: 'focusEdges',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 1.00,
              },
            ],
          },
          {
            title: 'Warp, Swirl & Noise',
            controls: [
              {
                key: 'swirl',
                label: 'swirl',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: 0.35,
              },
              {
                key: 'noise',
                label: 'noise',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'noiseFrequency',
                label: 'noiseFrequency',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.25,
              },
              {
                key: 'noiseOffset',
                label: 'noiseOffset',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'lensBulge',
                label: 'lensBulge',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'lensCircle',
                label: 'lensCircle',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'grainMixer',
                label: 'grainMixer',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'grainOverlay',
                label: 'grainOverlay',
                type: 'range',
                min: 0.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
            ],
          },
          {
            title: 'Transform & Fit',
            controls: [
              {
                key: 'imageX',
                label: 'imageX',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'imageY',
                label: 'imageY',
                type: 'range',
                min: -1.00,
                max: 1.00,
                step: 0.01,
                value: 0.00,
              },
              {
                key: 'scale',
                label: 'scale',
                type: 'range',
                min: 0.10,
                max: 3.00,
                step: 0.01,
                value: 1.00,
              },
              {
                key: 'fit',
                label: 'fit',
                type: 'select',
                options: ['contain', 'cover', 'fill'],
                value: 'contain',
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
            return 'Lens Distortion (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('lensDistortionV3', lensDistortionFS)
          if (!progInfo) return 'Lens Distortion compilation error'

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

          const fitMap = { contain: 0, cover: 1, fill: 2 }
          const fitMode = fitMap[v.fit] !== undefined ? fitMap[v.fit] : 0

          let centerX = 0.5
          let centerY = 0.5
          if (env.cursorEnabled && env.cursor.targetX >= 0) {
            centerX = env.cursor.targetX / (W || 1)
            centerY = env.cursor.targetY / (H || 1)
          }

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_imageResolution'), env.sourceCanvas.width || W, env.sourceCanvas.height || H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)

          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_spread'), v.spread !== undefined ? v.spread : 0.32)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_bias'), v.bias !== undefined ? v.bias : -0.34)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle !== undefined ? v.angle : 4.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_perspective'), v.perspective !== undefined ? v.perspective : 1.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_count'), v.count !== undefined ? v.count : 35.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_dispersion'), v.dispersion !== undefined ? v.dispersion : 1.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_dispersionShift'), v.dispersionShift !== undefined ? v.dispersionShift : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_dispersionColor'), v.dispersionColor !== undefined ? v.dispersionColor : 0.60)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_focusCenter'), v.focusCenter !== undefined ? v.focusCenter : 0.80)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_focusEdges'), v.focusEdges !== undefined ? v.focusEdges : 1.00)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_swirl'), v.swirl !== undefined ? v.swirl : 0.35)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_noise'), v.noise !== undefined ? v.noise : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_noiseFrequency'), v.noiseFrequency !== undefined ? v.noiseFrequency : 0.25)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_noiseOffset'), v.noiseOffset !== undefined ? v.noiseOffset : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_lensBulge'), v.lensBulge !== undefined ? v.lensBulge : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_lensCircle'), v.lensCircle !== undefined ? v.lensCircle : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_grainMixer'), v.grainMixer !== undefined ? v.grainMixer : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_grainOverlay'), v.grainOverlay !== undefined ? v.grainOverlay : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_imageX'), v.imageX !== undefined ? v.imageX : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_imageY'), v.imageY !== undefined ? v.imageY : 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_scale'), v.scale !== undefined ? v.scale : 1.0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_fit'), fitMode)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_center'), centerX, centerY)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Lens Distortion · Spread ${v.spread} · Disp ${v.dispersion} · Bulge ${v.lensBulge}`
        },
      }

export default lensDistortion;
export { lensDistortion };
