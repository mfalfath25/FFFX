import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const gemSmokeFS = `
        precision highp float;
        varying vec2 v_uv;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_smokeSpeed;
        uniform float u_smokeSize;
        uniform float u_innerDistortion;
        uniform float u_outerDistortion;
        uniform float u_innerGlow;
        uniform float u_outerGlow;
        uniform float u_smokeDensity;
        uniform float u_refraction;
        uniform float u_angle;
        uniform vec2 u_cursor;
        uniform float u_cursorSwirl;
        uniform int u_gemType;
        uniform vec3 u_gemColor;
        uniform vec3 u_smokeColor;
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
          f += 0.1250 * snoise(p); p = p * 2.01;
          f += 0.0625 * snoise(p);
          return f;
        }

        vec2 smokeWarp(vec2 p, float t, float distort) {
          vec2 q = vec2(fbm(p + vec2(0.0, t * 0.2)), fbm(p + vec2(5.2, 1.3 - t * 0.15)));
          vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2 + t * 0.15)), fbm(p + 3.0 * q + vec2(8.3, 2.8 - t * 0.12)));
          return p + r * distort;
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
          vec2 facetNorm = vec2(lRight - lLeft, lDown - lUp);
          float facetEdge = length(facetNorm) * 3.0;

          vec2 refractUV = uv + facetNorm * u_refraction * 0.08;

          float rad = u_angle * 3.14159265 / 180.0;
          vec2 flow = vec2(cos(rad), sin(rad)) * u_time * 0.2 * u_smokeSpeed;

          vec2 toCursor = (uv - u_cursor) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float distCursor = length(toCursor);
          vec2 vortex = vec2(-toCursor.y, toCursor.x) * exp(-distCursor * 5.0) * u_cursorSwirl * 0.3;

          vec2 innerP = refractUV * u_smokeSize * 4.0 + flow + vortex;
          vec2 warpedInner = smokeWarp(innerP, u_time * u_smokeSpeed, u_innerDistortion);
          float innerSmoke = fbm(warpedInner);
          innerSmoke = pow(clamp(innerSmoke * 0.5 + 0.5, 0.0, 1.0), 1.4) * u_smokeDensity;

          vec2 outerP = uv * u_smokeSize * 2.5 - flow * 0.7 + vortex;
          vec2 warpedOuter = smokeWarp(outerP, u_time * u_smokeSpeed * 0.7, u_outerDistortion);
          float outerSmoke = fbm(warpedOuter);
          outerSmoke = pow(clamp(outerSmoke * 0.5 + 0.5, 0.0, 1.0), 1.8) * u_smokeDensity;

          vec3 gemBase = u_gemColor;
          vec3 smokeBase = u_smokeColor;

          if (u_gemType == 0) {
            gemBase = vec3(0.0, 0.85, 0.45);
            smokeBase = vec3(0.1, 1.0, 0.75);
          } else if (u_gemType == 1) {
            gemBase = vec3(0.9, 0.05, 0.2);
            smokeBase = vec3(1.0, 0.5, 0.15);
          } else if (u_gemType == 2) {
            gemBase = vec3(0.05, 0.35, 0.95);
            smokeBase = vec3(0.4, 0.85, 1.0);
          } else if (u_gemType == 3) {
            gemBase = vec3(0.55, 0.05, 0.85);
            smokeBase = vec3(0.95, 0.35, 0.9);
          } else if (u_gemType == 4) {
            gemBase = vec3(0.85, 0.92, 1.0);
            smokeBase = vec3(
              sin(warpedInner.x * 2.0) * 0.5 + 0.5,
              sin(warpedInner.y * 2.0 + 2.0) * 0.5 + 0.5,
              sin((warpedInner.x + warpedInner.y) * 2.0 + 4.0) * 0.5 + 0.5
            );
          } else {
            gemBase = vec3(0.12, 0.13, 0.18);
            smokeBase = vec3(0.7, 0.75, 0.85);
          }

          float sparkle = pow(clamp(fbm(refractUV * 25.0 + u_time * 0.5), 0.0, 1.0), 4.0) * facetEdge * 2.5;

          vec3 gemLit = gemBase * (luma * 0.6 + 0.4) * (innerSmoke * u_innerGlow * 1.5 + 0.2);
          vec3 smokeAura = smokeBase * outerSmoke * u_outerGlow * 1.2;
          vec3 facetSparkle = vec3(1.0, 0.98, 0.95) * (facetEdge * 0.8 + sparkle);

          float gemMask = clamp(luma * 1.5 + facetEdge * 1.2, 0.0, 1.0);
          vec3 scene = mix(smokeAura, gemLit + facetSparkle, gemMask);
          vec3 finalCol = mix(u_colorBack, scene, clamp(gemMask + outerSmoke * u_outerGlow * 0.8, 0.0, 1.0));

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `

      const gemSmoke = {
        id: 'gem-smoke',
        label: 'Gem Smoke',
        groups: [
          {
            title: 'Gemstone & Preset',
            controls: [
              {
                key: 'gemType',
                label: 'Gemstone Type',
                type: 'select',
                options: [
                  'EMERALD WISP',
                  'RUBY FLAME',
                  'SAPPHIRE FROST',
                  'AMETHYST NEBULA',
                  'OPAL PRISM',
                  'BLACK ONYX',
                ],
                value: 'EMERALD WISP',
              },
              {
                key: 'gemColor',
                label: 'Gem Base Color',
                type: 'color',
                value: '#00d672',
              },
              {
                key: 'smokeColor',
                label: 'Smoke Aura Color',
                type: 'color',
                value: '#38bdf8',
              },
              {
                key: 'colorBack',
                label: 'Background Tint',
                type: 'color',
                value: '#08090d',
              },
            ],
          },
          {
            title: 'Smoke Turbulence & Motion',
            controls: [
              {
                key: 'smokeSpeed',
                label: 'Smoke Flow Speed',
                type: 'range',
                min: 0.1,
                max: 3.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'smokeSize',
                label: 'Smoke Cloud Scale',
                type: 'range',
                min: 0.2,
                max: 2.0,
                step: 0.1,
                value: 0.8,
              },
              {
                key: 'innerDistortion',
                label: 'Core Swirl Distortion',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.6,
              },
              {
                key: 'outerDistortion',
                label: 'Aura Dispersion',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.4,
              },
              {
                key: 'angle',
                label: 'Flow Angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 5,
                value: 30,
                unit: '°',
              },
            ],
          },
          {
            title: 'Refraction & Radiance',
            controls: [
              {
                key: 'refraction',
                label: 'Prismatic Refraction',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.7,
              },
              {
                key: 'innerGlow',
                label: 'Gem Core Radiance',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.75,
              },
              {
                key: 'outerGlow',
                label: 'Smoke Aura Glow',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.35,
              },
              {
                key: 'smokeDensity',
                label: 'Smoke Density',
                type: 'range',
                min: 0.5,
                max: 2.0,
                step: 0.1,
                value: 1.2,
              },
            ],
          },
          {
            title: 'Interaction',
            controls: [
              {
                key: 'cursorSwirl',
                label: 'Cursor Vortex Power',
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
            return 'Gem Smoke (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('gemSmoke', gemSmokeFS)
          if (!progInfo) return 'Gem Smoke error'

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

          const gemIdx = [
            'EMERALD WISP',
            'RUBY FLAME',
            'SAPPHIRE FROST',
            'AMETHYST NEBULA',
            'OPAL PRISM',
            'BLACK ONYX',
          ].indexOf(v.gemType)

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (env.cursor.targetY / (H || 1)) : -1000.0
          const cursorSwirl = env.cursorEnabled ? v.cursorSwirl : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_resolution'), W, H)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_smokeSpeed'), v.smokeSpeed)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_smokeSize'), v.smokeSize)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_innerDistortion'), v.innerDistortion)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_outerDistortion'), v.outerDistortion)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_innerGlow'), v.innerGlow)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_outerGlow'), v.outerGlow)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_smokeDensity'), v.smokeDensity)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_refraction'), v.refraction)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle)
          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorSwirl'), cursorSwirl)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_gemType'), gemIdx >= 0 ? gemIdx : 0)
          const gemRgb = hexToRgb(v.gemColor || '#00d672')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_gemColor'), gemRgb[0], gemRgb[1], gemRgb[2])
          const smokeRgb = hexToRgb(v.smokeColor || '#38bdf8')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_smokeColor'), smokeRgb[0], smokeRgb[1], smokeRgb[2])
          const backRgb = hexToRgb(v.colorBack || '#08090d')
          gl.uniform3f(gl.getUniformLocation(progInfo.prog, 'u_colorBack'), backRgb[0], backRgb[1], backRgb[2])

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Gem Smoke · ${v.gemType} · ${v.smokeSpeed}x · Refr ${v.refraction}`
        },
      }

export default gemSmoke;
export { gemSmoke };
