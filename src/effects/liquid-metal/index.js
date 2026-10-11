import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const liquidMetalFS = `
        precision highp float;
        varying vec2 v_uv;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_speed;
        uniform float u_repetition;
        uniform float u_softness;
        uniform float u_distortion;
        uniform float u_contour;
        uniform float u_angle;
        uniform float u_chromaticShift;
        uniform float u_specularBoost;
        uniform vec2 u_cursor;
        uniform float u_cursorRipple;
        uniform int u_preset;
        uniform vec3 u_colorTint;
        uniform vec3 u_colorBack;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        float fbm(vec2 p) {
          float f = 0.0;
          f += 0.5000 * snoise(p); p = p * 2.02;
          f += 0.2500 * snoise(p); p = p * 2.03;
          f += 0.1250 * snoise(p);
          return f;
        }

        float getStripeBand(float p, float softness) {
          float fp = fract(p);
          float s = max(softness, 0.01);
          float b1 = smoothstep(0.0, s, fp) * (1.0 - smoothstep(0.4 - s, 0.4 + s, fp));
          float b2 = smoothstep(0.5 - s, 0.5 + s, fp) * (1.0 - smoothstep(0.85 - s, 0.85 + s, fp));
          float spec = pow(smoothstep(0.15 - s * 0.5, 0.15 + s * 0.5, fp) * (1.0 - smoothstep(0.25 - s * 0.5, 0.25 + s * 0.5, fp)), 2.0) * 1.5;
          return clamp(b1 * 0.7 + b2 * 0.95 + spec, 0.0, 1.5);
        }

        void main() {
          vec2 uv = v_uv;
          vec2 texel = 1.0 / u_resolution;
          vec4 img = texture2D(u_image, uv);
          float luma = dot(img.rgb, vec3(0.299, 0.587, 0.114));

          float lLeft  = dot(texture2D(u_image, uv - vec2(texel.x * 2.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lRight = dot(texture2D(u_image, uv + vec2(texel.x * 2.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lUp    = dot(texture2D(u_image, uv - vec2(0.0, texel.y * 2.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lDown  = dot(texture2D(u_image, uv + vec2(0.0, texel.y * 2.0)).rgb, vec3(0.299, 0.587, 0.114));
          vec2 norm = vec2(lRight - lLeft, lDown - lUp);
          float edge = length(norm) * 2.5;

          float rad = (-u_angle + 70.0) * 3.14159265 / 180.0;
          mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
          vec2 rotUV = rot * (uv - 0.5) + 0.5;

          float fluid = fbm(uv * 3.5 + vec2(u_time * 0.15 * u_speed, u_time * 0.08 * u_speed));

          float distToCursor = length((uv - u_cursor) * vec2(u_resolution.x / u_resolution.y, 1.0));
          float cursorWave = sin(distToCursor * 25.0 - u_time * 8.0) * exp(-distToCursor * 4.0) * u_cursorRipple * 0.15;

          float baseCoord = rotUV.y * u_repetition + 
                            fluid * u_distortion * 1.5 + 
                            edge * u_contour * 0.8 + 
                            cursorWave + 
                            luma * 0.4 - 
                            u_time * 0.35 * u_speed;

          float disp = u_chromaticShift * 0.05;
          float rVal = getStripeBand(baseCoord + disp, u_softness);
          float gVal = getStripeBand(baseCoord, u_softness);
          float bVal = getStripeBand(baseCoord - disp, u_softness);
          vec3 metal = vec3(rVal, gVal, bVal) * u_specularBoost;

          vec3 metalColor = metal;
          if (u_preset == 0) {
            metalColor = metal * vec3(0.92, 0.96, 1.05);
          } else if (u_preset == 1) {
            metalColor = vec3(metal.r * 1.15, metal.g * 0.92, metal.b * 0.35);
          } else if (u_preset == 2) {
            metalColor = vec3(metal.r * 1.1, metal.g * 0.65, metal.b * 0.55);
          } else if (u_preset == 3) {
            vec3 iridescent = vec3(
              sin(baseCoord * 3.0) * 0.5 + 0.5,
              sin(baseCoord * 3.0 + 2.0) * 0.5 + 0.5,
              sin(baseCoord * 3.0 + 4.0) * 0.5 + 0.5
            );
            metalColor = mix(metal, iridescent * 1.2, 0.55);
          } else if (u_preset == 4) {
            metalColor = vec3(metal.r * 0.3, metal.g * 0.95, metal.b * 1.15);
          } else {
            metalColor = pow(metal, vec3(1.6)) * vec3(0.65, 0.7, 0.8);
          }

          metalColor = mix(metalColor, metalColor * u_colorTint, 0.6);

          float mask = clamp(luma * 1.8 + edge * 1.5, 0.0, 1.0);
          vec3 finalCol = mix(u_colorBack, metalColor, mask);

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `

      const liquidMetal = {
        id: 'liquid-metal',
        label: 'Liquid Metal (Paper)',
        groups: [
          {
            title: 'Metal Material & Preset',
            controls: [
              {
                key: 'metalPreset',
                label: 'Material Preset',
                type: 'select',
                options: [
                  'MERCURY CHROME',
                  'LIQUID GOLD',
                  'ROSE COPPER',
                  'TITANIUM OIL-SLICK',
                  'CYBER CYAN',
                  'OBSIDIAN GLOSS',
                ],
                value: 'MERCURY CHROME',
              },
              {
                key: 'colorTint',
                label: 'Surface Tint',
                type: 'color',
                value: '#ffffff',
              },
              {
                key: 'colorBack',
                label: 'Background Tint',
                type: 'color',
                value: '#06070a',
              },
              {
                key: 'softness',
                label: 'Reflection Softness',
                type: 'range',
                min: 0.05,
                max: 0.8,
                step: 0.02,
                value: 0.35,
              },
            ],
          },
          {
            title: 'Stripes & Distortion',
            controls: [
              {
                key: 'repetition',
                label: 'Stripe Density',
                type: 'range',
                min: 1.0,
                max: 10.0,
                step: 0.5,
                value: 4.0,
              },
              {
                key: 'distortion',
                label: 'Fluid Turbulence',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.55,
              },
              {
                key: 'contour',
                label: 'Edge Distortion',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.8,
              },
              {
                key: 'angle',
                label: 'Reflection Angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 5,
                value: 70,
                unit: '°',
              },
              {
                key: 'speed',
                label: 'Fluid Speed',
                type: 'range',
                min: 0.1,
                max: 3.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
            ],
          },
          {
            title: 'Dispersion & Specular',
            controls: [
              {
                key: 'chromaticShift',
                label: 'RGB Dispersion',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.45,
              },
              {
                key: 'specularBoost',
                label: 'Specular Lustre',
                type: 'range',
                min: 0.5,
                max: 2.5,
                step: 0.1,
                value: 1.4,
              },
              {
                key: 'cursorRipple',
                label: 'Cursor Fluid Ripple',
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
            return 'Liquid Metal (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('liquidMetal', liquidMetalFS)
          if (!progInfo) return 'Liquid Metal error'

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

          const presetIdx = [
            'MERCURY CHROME',
            'LIQUID GOLD',
            'ROSE COPPER',
            'TITANIUM OIL-SLICK',
            'CYBER CYAN',
            'OBSIDIAN GLOSS',
          ].indexOf(v.metalPreset)

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          const cursorRipple = env.cursorEnabled ? v.cursorRipple : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_speed'), v.speed)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_repetition'), v.repetition)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_softness'), v.softness)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_distortion'), v.distortion)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_contour'), v.contour)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_chromaticShift'), v.chromaticShift)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_specularBoost'), v.specularBoost)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorRipple'), cursorRipple)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_preset'), presetIdx >= 0 ? presetIdx : 0)
          const tintRgb = hexToRgb(v.colorTint || '#ffffff')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_colorTint'), tintRgb[0], tintRgb[1], tintRgb[2])
          const backRgb = hexToRgb(v.colorBack || '#06070a')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_colorBack'), backRgb[0], backRgb[1], backRgb[2])

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Liquid Metal · ${v.metalPreset} · ${v.repetition} stripes · Disp ${v.chromaticShift}`
        },
      }

export default liquidMetal;
export { liquidMetal };
