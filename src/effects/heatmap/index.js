import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const heatmapFS = `#version 300 es
        precision highp float;

        in mediump vec2 v_imageUV;
        in mediump vec2 v_uv;
        out vec4 fragColor;

        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_speed;

        uniform vec4 u_colorBack;
        uniform vec4 u_colors[10];
        uniform float u_colorsCount;

        uniform float u_contour;
        uniform float u_angle;
        uniform float u_noise;
        uniform float u_innerGlow;
        uniform float u_outerGlow;
        uniform float u_scale;
        uniform float u_rotation;
        uniform float u_offsetX;
        uniform float u_offsetY;

        uniform int u_shapeType;
        uniform float u_shapeMorph;
        uniform float u_blobSize;
        uniform float u_seed;

        uniform vec2 u_cursor;
        uniform float u_cursorHeat;

        #define TWO_PI 6.28318530718
        #define PI 3.14159265358979323846

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float getImgFrame(vec2 uv, float th) {
          float frame = 1.;
          frame *= smoothstep(0., th, uv.y);
          frame *= 1. - smoothstep(1. - th, 1., uv.y);
          frame *= smoothstep(0., th, uv.x);
          frame *= 1. - smoothstep(1. - th, 1., uv.x);
          return frame;
        }

        float circle(vec2 uv, vec2 c, vec2 r) {
          return 1. - smoothstep(r[0], r[1], length(uv - c));
        }

        float lst(float edge0, float edge1, float x) {
          return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        }

        float sst(float edge0, float edge1, float x) {
          return smoothstep(edge0, edge1, x);
        }

        // 0. Classic Paper Design Visor (Curved visor cutout wave)
        float shapeVisor(vec2 uv, float t, float contour) {
          vec2 scaledUV = uv;
          float posY = mix(-1., 2., t);

          scaledUV.y -= .5;
          float mainCircleScale = sst(0., .8, posY) * lst(1.4, .9, posY);
          scaledUV *= vec2(1., 1. + 1.5 * mainCircleScale);
          scaledUV.y += .5;

          float innerR = .4;
          float outerR = 1. - .3 * (sst(.1, .2, t) * (1. - sst(.2, .5, t)));
          float s = circle(scaledUV, vec2(.5, posY - .2), vec2(innerR, outerR));
          s = pow(s, 1.4) * 1.2;

          float topFlattener = 0.;
          {
            float pos = posY - uv.y;
            float edge = 1.2;
            topFlattener = lst(-.4, 0., pos) * (1. - sst(.0, edge, pos));
            topFlattener = pow(topFlattener, 3.);
            float topFlattenerMixer = (1. - sst(.0, .3, pos));
            s = mix(topFlattener, s, topFlattenerMixer);
          }

          float seedOff = u_seed * 0.173;
          {
            float visibility = sst(.6, .7, t) * (1. - sst(.8, .9, t));
            float angle = -2. - t * TWO_PI + seedOff;
            float rightCircle = circle(uv, vec2(.95 - .2 * cos(angle), .4 - .1 * sin(angle)), vec2(.15, .3));
            rightCircle *= visibility;
            s = mix(s, 0., rightCircle);
          }

          {
            float topCircle = circle(uv, vec2(.5, .19), vec2(.05, .25));
            topCircle += 2. * contour * circle(uv, vec2(.5, .19), vec2(.2, .5));
            float visibility = .55 * sst(.2, .3, t) * (1. - sst(.3, .45, t));
            topCircle *= visibility;
            s = mix(s, 0., topCircle);
          }

          float leafMask = circle(uv, vec2(.53, .13), vec2(.08, .19));
          leafMask = mix(leafMask, 0., 1. - sst(.4, .54, uv.x));
          leafMask = mix(0., leafMask, sst(.0, .2, uv.y));
          leafMask *= (sst(.5, 1.1, posY) * sst(1.5, 1.3, posY));
          s += leafMask;

          {
            float visibility = sst(.0, .4, t) * (1. - sst(.6, .8, t));
            s = mix(s, 0., visibility * circle(uv, vec2(.52, .92), vec2(.09, .25)));
          }

          {
            float pos = sst(.0, .6, t) * (1. - sst(.6, 1., t));
            s = mix(s, .5, circle(uv, vec2(.0, 1.2 - .5 * pos), vec2(.1, .3)));
            s = mix(s, .0, circle(uv, vec2(1., .5 + .5 * pos), vec2(.1, .3)));

            s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * sst(.7, .5, t)), vec2(.07, .22)));
            s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * (1. - sst(.5, .7, t))), vec2(.07, .22)));
            s /= max(1e-4, sst(1., .85, uv.y));
          }

          return clamp(s, 0.0, 1.0);
        }

        // 1. RECT GLOW (Rectangular scanning bar moving linearly from top to bottom)
        float shapeRectGlow(vec2 uv, float t, float contour) {
          float posY = mix(1.25, -0.25, t); // Top to bottom scan
          float dy = abs(uv.y - posY);
          float height = 0.22 * max(0.2, u_blobSize);

          float band = exp(-pow(dy / max(0.01, height * 0.65), 2.0));
          float core = 1.0 - smoothstep(0.0, height * 0.95, dy);
          float glow = band * 0.85 + core * 0.45;

          // Subtle horizontal soft frame
          float edgeX = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
          glow *= edgeX;

          // Seed variation
          float seedMod = sin(uv.x * 5.0 + u_seed * 0.8 + t * TWO_PI) * 0.035;
          float bandMod = exp(-pow((dy + seedMod) / max(0.01, height * 0.8), 2.0));
          glow = mix(glow, bandMod * 1.15, 0.4);

          return clamp(glow, 0.0, 1.0);
        }

        // 2. CENTER BLOBS (Thermal blob traveling top to bottom: Small -> Full Size in Middle -> Small)
        float shapeCenterBlobs(vec2 uv, float t, float contour) {
          // Progress from top to bottom
          float posY = mix(1.22, -0.22, t);
          float seedAngle = u_seed * 1.31415;
          float posX = 0.5 + 0.07 * sin(t * TWO_PI + seedAngle);
          vec2 blobCenter = vec2(posX, posY);

          // Pulse: 0 at top (t=0), 1.0 at center (t=0.5), 0 at bottom (t=1.0)
          float progress = clamp(t, 0.0, 1.0);
          float scaleCurve = sin(progress * PI);
          scaleCurve = pow(scaleCurve, 0.85);

          // Size bounds: small at top/bottom, full size in middle
          float minRadius = 0.12 * max(0.2, u_blobSize);
          float maxRadius = 0.62 * max(0.2, u_blobSize);
          float currentRadius = mix(minRadius, maxRadius, scaleCurve);

          float dist = length(uv - blobCenter);
          float innerR = currentRadius * 0.15;
          float outerR = currentRadius;
          float mainBlob = 1.0 - smoothstep(innerR, outerR, dist);
          mainBlob = pow(mainBlob, 1.2) * (0.65 + 0.65 * scaleCurve);

          // Orbiting satellite thermal droplets
          float orbAngle = t * TWO_PI * 1.5 + seedAngle;
          float orbDist = currentRadius * (0.55 + 0.2 * scaleCurve);
          vec2 orb1 = blobCenter + vec2(cos(orbAngle), sin(orbAngle)) * orbDist;
          vec2 orb2 = blobCenter + vec2(cos(orbAngle + 2.3), sin(orbAngle + 2.3)) * (orbDist * 0.8);

          float b1 = 1.0 - smoothstep(0.02 * u_blobSize, currentRadius * 0.45, length(uv - orb1));
          float b2 = 1.0 - smoothstep(0.02 * u_blobSize, currentRadius * 0.38, length(uv - orb2));

          float totalBlob = mainBlob + b1 * 0.45 * scaleCurve + b2 * 0.35 * scaleCurve;
          return clamp(totalBlob, 0.0, 1.0);
        }

        // 3. METABALL CLUSTER (Swirling metaball group traveling from top to bottom)
        float shapeMetaballs(vec2 uv, float t, float contour) {
          float posY = mix(1.25, -0.25, t);
          float progress = clamp(t, 0.0, 1.0);
          float scaleCurve = sin(progress * PI);
          scaleCurve = pow(scaleCurve, 0.85);

          vec2 c = vec2(0.5, posY);
          float field = 0.0;
          float seedOff = u_seed * 0.8123;

          for (int k = 0; k < 6; k++) {
            float fk = float(k);
            float kAngle = t * TWO_PI * (0.5 + 0.2 * sin(fk + seedOff)) + fk * 1.047 + seedOff;
            float kDist = (0.08 + 0.20 * sin(t * PI + fk * 0.7)) * u_blobSize * mix(0.3, 1.0, scaleCurve);
            vec2 kPos = c + vec2(cos(kAngle), sin(kAngle)) * kDist;
            float d = length(uv - kPos);
            float radius = (0.03 + 0.025 * sin(fk + t * TWO_PI)) * u_blobSize * mix(0.3, 1.0, scaleCurve);
            field += radius / max(0.001, d * d + 0.008);
          }

          float s = smoothstep(0.30, 1.25, field) * (0.5 + 0.85 * scaleCurve);
          return clamp(s, 0.0, 1.0);
        }

        // 4. Concentric Ripple Pulse
        float shapeRipple(vec2 uv, float t, float contour) {
          float r = length(uv - vec2(0.5));
          float seedOff = fract(u_seed * 0.137);
          float ringProgress = fract(t + seedOff);
          float pulse = sin(ringProgress * PI);

          float ringRadius = ringProgress * 0.65 * u_blobSize;
          float ringThickness = (0.08 + 0.06 * pulse) * u_blobSize;

          float ring = exp(-pow((r - ringRadius) / max(0.01, ringThickness), 2.0));
          ring *= pulse * 1.4;

          float core = circle(uv, vec2(0.5), vec2(0.02 * u_blobSize, 0.18 * u_blobSize * pulse));
          float s = ring + core * 0.6;
          return clamp(s, 0.0, 1.0);
        }

        float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
          vec2 texel = 1.0 / vec2(textureSize(tex, 0));
          vec2 r = radius * texel;

          float w1 = 1.0, w2 = 2.0, w4 = 4.0;
          float norm = 16.0;
          float sum = w4 * centerSample;

          sum += w2 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).g;
          sum += w2 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).g;
          sum += w2 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).g;
          sum += w2 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).g;

          sum += w1 * textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).g;
          sum += w1 * textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).g;
          sum += w1 * textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).g;
          sum += w1 * textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).g;

          return sum / norm;
        }

        void main() {
          vec2 centered = v_imageUV - vec2(0.5);
          
          float s = max(0.05, u_scale);
          centered /= s;

          float rotRad = radians(u_rotation);
          float cosR = cos(rotRad);
          float sinR = sin(rotRad);
          centered = vec2(centered.x * cosR - centered.y * sinR, centered.x * sinR + centered.y * cosR);

          centered -= vec2(u_offsetX, -u_offsetY);

          vec2 imgUV = centered + vec2(0.5);
          float imgSoftFrame = getImgFrame(imgUV, .03);

          vec4 img = texture(u_image, imgUV);
          vec2 dudx = dFdx(imgUV);
          vec2 dudy = dFdy(imgUV);

          if (imgUV.x < 0. || imgUV.x > 1. || imgUV.y < 0. || imgUV.y > 1.) {
            fragColor = vec4(u_colorBack.rgb, 1.0);
            return;
          }

          float t = .1 * u_time * u_speed;
          t -= .3;

          float tCopy = t + 1. / 3.;
          float tCopy2 = t + 2. / 3.;

          t = mod(t, 1.);
          tCopy = mod(tCopy, 1.);
          tCopy2 = mod(tCopy2, 1.);

          vec2 animationUV = imgUV - vec2(.5);
          float angle = -u_angle * PI / 180.;
          float cosA = cos(angle);
          float sinA = sin(angle);
          animationUV = vec2(
            animationUV.x * cosA - animationUV.y * sinA,
            animationUV.x * sinA + animationUV.y * cosA
          ) + vec2(.5);

          // Texture Channels:
          // img.r = presence (1.0 inside object, 0.0 in background)
          // img.g = gBlur (distance / volume blur field from 0.0 to 1.0)
          // img.b = contour (Sobel edge magnitude)
          float presence = img.r;
          float gBlur = blurEdge3x3(u_image, imgUV, dudx, dudy, 6., img.g);
          float contourVal = img.b;

          // Inside shape vs Outside shape fields
          float innerField = gBlur * presence;
          float outerField = gBlur * (1.0 - presence);

          float inner = 0.0;
          float outer = 0.0;

          if (u_shapeType == 0) {
            // Shape 0: Classic Paper Design Visor
            float shadow = shapeVisor(animationUV, t, innerField);
            float shadowCopy = shapeVisor(animationUV, tCopy, innerField);
            float shadowCopy2 = shapeVisor(animationUV, tCopy2, innerField);

            inner = (0.5 + 0.9 * innerField) * presence;
            inner = mix(inner, 0., shadow);
            inner = mix(inner, 0., shadowCopy);
            inner = mix(inner, 0., shadowCopy2);
            inner *= mix(0., 2.5, u_innerGlow);
            inner += (u_contour * 2.8) * contourVal * presence;

            if (u_outerGlow > 0.001) {
              float tOuter = mod(t * 3. - .1, 1.);
              float y = mod(animationUV.y - tOuter, 1.);
              float animatedMask = sst(.25, .65, y) * (1. - sst(.65, 1., y));
              animatedMask = .5 + animatedMask;

              outer = pow(outerField, 0.75) * animatedMask;
              outer *= mix(0., 3.5, u_outerGlow);
              outer *= imgSoftFrame;
            }
          } else {
            // Shapes 1-4: Glowing Scanning Waves & Traveling Blobs
            float wave = 0.0;
            if (u_shapeType == 1) {
              // RECT GLOW (Top-to-bottom rectangular scan)
              wave = shapeRectGlow(animationUV, t, contourVal);
              float wave2 = shapeRectGlow(animationUV, tCopy, contourVal) * 0.35;
              wave = max(wave, wave2);
            } else if (u_shapeType == 2) {
              // CENTER BLOBS (Top-to-bottom traveling blob: small -> big in middle -> small)
              wave = shapeCenterBlobs(animationUV, t, contourVal);
              float wave2 = shapeCenterBlobs(animationUV, tCopy, contourVal) * 0.25;
              wave = max(wave, wave2);
            } else if (u_shapeType == 3) {
              // METABALL CLUSTER
              wave = shapeMetaballs(animationUV, t, contourVal);
            } else if (u_shapeType == 4) {
              // RIPPLE PULSE
              wave = shapeRipple(animationUV, t, contourVal);
            }

            if (u_shapeMorph > 0.001) {
              float morphTarget = (u_shapeType == 1) ? shapeCenterBlobs(animationUV, t, contourVal) : shapeRectGlow(animationUV, t, contourVal);
              wave = mix(wave, morphTarget, u_shapeMorph);
            }

            // 1. INNER GLOW: Object interior thermal glow illuminated by passing wave
            float innerBase = (0.20 + 0.40 * innerField) * presence * u_innerGlow;
            float innerWave = (0.65 + 1.10 * innerField) * presence * wave * mix(1.0, 2.5, u_innerGlow);
            float innerContour = (u_contour * 2.8) * contourVal * presence * (0.35 + 0.65 * wave);
            inner = innerBase + innerWave + innerContour;
            inner = clamp(inner, 0.0, 1.0);

            // 2. OUTER GLOW: Halo radiating into ambient perimeter in sync with wave
            if (u_outerGlow > 0.001) {
              outer = pow(outerField, 0.75) * (0.35 + 0.85 * wave);
              outer *= mix(0.0, 3.5, u_outerGlow);
              outer *= imgSoftFrame;
            }
          }

          inner = pow(inner, 1.15);
          float heat = clamp(inner + outer, 0., 1.);

          // Interactive cursor beacon
          if (u_cursorHeat > 0.0 && u_cursor.x >= 0.0) {
            float distToCursor = length(imgUV - u_cursor);
            float curBeacon = exp(-distToCursor * 7.5) * u_cursorHeat * 0.85;
            heat = clamp(heat + curBeacon, 0., 1.);
          }

          // Grain noise modulated by seed
          heat += (.005 + .35 * u_noise) * (fract(sin(dot(v_imageUV + u_seed * 17.319, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

          float mixer = clamp(heat, 0.0, 1.0) * max(1.0, u_colorsCount - 1.0);
          int baseIdx = int(floor(mixer));
          float frac = fract(mixer);

          vec4 gradient = u_colors[0];
          for (int i = 0; i < 9; i++) {
            if (i == baseIdx) {
              vec4 cA = u_colors[i];
              vec4 cB = u_colors[i + 1];
              gradient = mix(cA, cB, frac);
              break;
            }
          }

          vec3 color = gradient.rgb;
          float opacity = gradient.a;

          vec3 bgColor = u_colorBack.rgb;
          color = color + bgColor * (1.0 - opacity);

          color += .02 * (fract(sin(dot(v_imageUV + 1. + u_seed * 7.113, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

          fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
        }
      `

      const HEATMAP_PRESETS = {
        'DEFAULT': {
          colorCount: 6,
          colors: ['#112069', '#1f3ca3', '#3265e7', '#6bd8ff', '#ffe77a', '#ff9a1f', '#ff441f', '#ff0055', '#ffffff', '#ffffff'],
          colorBack: '#000000',
          contour: 1.00,
          angle: 172,
          noise: 1.00,
          innerGlow: 0.40,
          outerGlow: 0.50,
          speed: 1.00,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        },
        'SEPIA': {
          colorCount: 5,
          colors: ['#120904', '#3d210f', '#7c4a22', '#c28b51', '#fae3c6', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
          colorBack: '#000000',
          contour: 0.85,
          angle: 145,
          noise: 0.80,
          innerGlow: 0.35,
          outerGlow: 0.45,
          speed: 0.80,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        },
        'CYBER NEON': {
          colorCount: 7,
          colors: ['#060210', '#28084d', '#6b1182', '#b5179e', '#f72585', '#4361ee', '#4cc9f0', '#ffffff', '#ffffff', '#ffffff'],
          colorBack: '#05020c',
          contour: 1.10,
          angle: 90,
          noise: 0.90,
          innerGlow: 0.50,
          outerGlow: 0.60,
          speed: 1.20,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        },
        'MAGMA VOLCANO': {
          colorCount: 6,
          colors: ['#000004', '#140e36', '#3b0f70', '#8c2981', '#de4968', '#fcfdbf', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
          colorBack: '#000000',
          contour: 0.95,
          angle: 45,
          noise: 0.75,
          innerGlow: 0.45,
          outerGlow: 0.40,
          speed: 0.90,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        },
        'TOXIC EMERALD': {
          colorCount: 5,
          colors: ['#020b06', '#094426', '#179857', '#45e88e', '#b5fad4', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
          colorBack: '#000000',
          contour: 1.00,
          angle: 200,
          noise: 0.85,
          innerGlow: 0.40,
          outerGlow: 0.50,
          speed: 1.00,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        },
        'SOLAR FLARE': {
          colorCount: 6,
          colors: ['#0c0202', '#590d0d', '#c7261a', '#f77f00', '#fcbf49', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
          colorBack: '#000000',
          contour: 1.05,
          angle: 60,
          noise: 0.80,
          innerGlow: 0.45,
          outerGlow: 0.55,
          speed: 1.10,
          scale: 0.75,
          rotation: 0,
          offsetX: 0.00,
          offsetY: 0.00,
        }
      }

      const heatmap = {
        id: 'heatmap',
        label: 'Heatmap',
        thermalCanvas: null,
        thermalCtx: null,
        thermalTexture: null,

        ensureThermalCanvas(W, H) {
          if (!this.thermalCanvas) {
            this.thermalCanvas = document.createElement('canvas')
            this.thermalCtx = this.thermalCanvas.getContext('2d', { willReadFrequently: true })
          }
          if (this.thermalCanvas.width !== W || this.thermalCanvas.height !== H) {
            this.thermalCanvas.width = W
            this.thermalCanvas.height = H
          }
        },

        getGroups(v) {
          const count = Math.max(2, Math.min(10, Math.round(v.colorCount || 6)))
          const colorControls = []
          
          for (let i = 1; i <= count; i++) {
            const key = `color${i}`
            if (!v[key]) {
              v[key] = HEATMAP_PRESETS['DEFAULT'].colors[i - 1] || '#ffffff'
            }
            colorControls.push({
              key: key,
              label: `color${i}`,
              type: 'color',
              value: v[key],
            })
          }

          return [
            {
              title: 'Presets',
              controls: [
                {
                  key: 'preset',
                  label: 'Load Preset',
                  type: 'select',
                  options: Object.keys(HEATMAP_PRESETS),
                  value: 'DEFAULT',
                  onChange(presetName) {
                    const p = HEATMAP_PRESETS[presetName]
                    if (p) {
                      v.colorCount = p.colorCount
                      for (let i = 1; i <= 10; i++) {
                        v[`color${i}`] = p.colors[i - 1] || '#ffffff'
                      }
                      v.colorBack = p.colorBack
                      v.contour = p.contour
                      v.angle = p.angle
                      v.noise = p.noise
                      v.innerGlow = p.innerGlow
                      v.outerGlow = p.outerGlow
                      v.speed = p.speed
                      v.scale = p.scale
                      v.rotation = p.rotation
                      v.offsetX = p.offsetX
                      v.offsetY = p.offsetY
                      renderPanel()
                    }
                  }
                },
                {
                  key: 'colorCount',
                  label: 'colorCount',
                  type: 'range',
                  min: 2,
                  max: 10,
                  step: 1,
                  value: v.colorCount !== undefined ? v.colorCount : 6,
                  onChange(val) {
                    v.colorCount = val
                    renderPanel()
                  }
                },
                ...colorControls,
                {
                  key: 'colorBack',
                  label: 'colorBack',
                  type: 'color',
                  value: v.colorBack || '#000000',
                },
              ]
            },
            {
              title: 'Controls & Thermal Dynamics',
              controls: [
                {
                  key: 'contour',
                  label: 'contour',
                  type: 'range',
                  min: 0.00,
                  max: 2.00,
                  step: 0.05,
                  value: v.contour !== undefined ? v.contour : 1.00,
                },
                {
                  key: 'angle',
                  label: 'angle',
                  type: 'range',
                  min: 0,
                  max: 360,
                  step: 1,
                  value: v.angle !== undefined ? v.angle : 172,
                },
                {
                  key: 'noise',
                  label: 'noise',
                  type: 'range',
                  min: 0.00,
                  max: 1.00,
                  step: 0.05,
                  value: v.noise !== undefined ? v.noise : 1.00,
                },
                {
                  key: 'innerGlow',
                  label: 'innerGlow',
                  type: 'range',
                  min: 0.00,
                  max: 1.00,
                  step: 0.05,
                  value: v.innerGlow !== undefined ? v.innerGlow : 0.40,
                },
                {
                  key: 'outerGlow',
                  label: 'outerGlow',
                  type: 'range',
                  min: 0.00,
                  max: 1.00,
                  step: 0.05,
                  value: v.outerGlow !== undefined ? v.outerGlow : 0.50,
                },
                {
                  key: 'speed',
                  label: 'speed',
                  type: 'range',
                  min: 0.00,
                  max: 3.00,
                  step: 0.05,
                  value: v.speed !== undefined ? v.speed : 1.00,
                },
                {
                  key: 'scale',
                  label: 'scale',
                  type: 'range',
                  min: 0.10,
                  max: 2.00,
                  step: 0.05,
                  value: v.scale !== undefined ? v.scale : 0.75,
                },
                {
                  key: 'rotation',
                  label: 'rotation',
                  type: 'range',
                  min: -180,
                  max: 180,
                  step: 1,
                  value: v.rotation !== undefined ? v.rotation : 0,
                },
                {
                  key: 'offsetX',
                  label: 'offsetX',
                  type: 'range',
                  min: -1.00,
                  max: 1.00,
                  step: 0.02,
                  value: v.offsetX !== undefined ? v.offsetX : 0.00,
                },
                {
                  key: 'offsetY',
                  label: 'offsetY',
                  type: 'range',
                  min: -1.00,
                  max: 1.00,
                  step: 0.02,
                  value: v.offsetY !== undefined ? v.offsetY : 0.00,
                },
                {
                  key: 'cursorHeat',
                  label: 'cursorHeat',
                  type: 'range',
                  min: 0.00,
                  max: 2.00,
                  step: 0.1,
                  value: v.cursorHeat !== undefined ? v.cursorHeat : 1.00,
                  unit: 'x',
                },
              ]
            }
          ]
        },

        // Static groups fallback
        get groups() {
          const v = (typeof values !== 'undefined' && values['heatmap']) ? values['heatmap'] : {
            colorCount: 6,
            color1: '#112069', color2: '#1f3ca3', color3: '#3265e7', color4: '#6bd8ff', color5: '#ffe77a', color6: '#ff9a1f',
            colorBack: '#000000', contour: 1.0, angle: 172, noise: 1.0, innerGlow: 0.4, outerGlow: 0.5, speed: 1.0, scale: 0.75, rotation: 0, offsetX: 0, offsetY: 0, cursorHeat: 1.0
          }
          return this.getGroups(v)
        },

        draw(v, dt) {
          const { W, H } = env
          env.time += dt

          const { glCanvas, gl, quadBuffer } = getWebGL()
          if (!gl) {
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            return 'Heatmap (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('heatmap', heatmapFS)
          if (!progInfo) return 'Heatmap error'

          this.ensureThermalCanvas(W, H)
          const pCtx = this.thermalCtx
          pCtx.drawImage(env.sourceCanvas, 0, 0, W, H)

          const srcImgData = pCtx.getImageData(0, 0, W, H)
          const srcData = srcImgData.data
          const totalPx = W * H

          const gray = new Uint8Array(totalPx)
          for (let i = 0; i < totalPx; i++) {
            const px = i * 4
            const lum = (srcData[px] * 77 + srcData[px + 1] * 150 + srcData[px + 2] * 29) >> 8
            gray[i] = 255 - lum
          }

          const dstImgData = pCtx.createImageData(W, H)
          const dst = dstImgData.data

          const stepX = Math.max(1, Math.floor(W / 120))
          const stepY = Math.max(1, Math.floor(H / 80))

          for (let y = 0; y < H; y++) {
            const yOff = y * W
            const yMin = Math.max(0, y - stepY * 4) * W
            const yMax = Math.min(H - 1, y + stepY * 4) * W
            for (let x = 0; x < W; x++) {
              const idx = yOff + x
              const px = idx * 4
              const cVal = gray[idx]
              const xMin = Math.max(0, x - stepX * 4)
              const xMax = Math.min(W - 1, x + stepX * 4)

              const gBlur = (cVal * 4 + gray[yMin + x] * 2 + gray[yMax + x] * 2 + gray[yOff + xMin] * 2 + gray[yOff + xMax] * 2) / 12

              const edge = Math.abs(gray[yOff + Math.min(W - 1, x + 1)] - gray[yOff + Math.max(0, x - 1)]) +
                           Math.abs(gray[Math.min(H - 1, y + 1) * W + x] - gray[Math.max(0, y - 1) * W + x])

              dst[px + 0] = Math.min(255, 255 - cVal)
              dst[px + 1] = Math.min(255, gBlur)
              dst[px + 2] = Math.min(255, edge * 3)
              dst[px + 3] = 255
            }
          }

          pCtx.putImageData(dstImgData, 0, 0)

          if (!this.thermalTexture) {
            this.thermalTexture = gl.createTexture()
          }
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, this.thermalTexture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.thermalCanvas)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

          glCanvas.width = W
          glCanvas.height = H
          gl.viewport(0, 0, W, H)

          gl.useProgram(progInfo.prog)

          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
          gl.enableVertexAttribArray(progInfo.positionLocation)
          gl.vertexAttribPointer(progInfo.positionLocation, 2, gl.FLOAT, false, 0, 0)

          const count = Math.max(2, Math.min(10, Math.round(v.colorCount !== undefined ? v.colorCount : 6)))

          const colorUniforms = new Float32Array(10 * 4)
          for (let i = 0; i < 10; i++) {
            const hex = v[`color${i + 1}`] || (HEATMAP_PRESETS['DEFAULT'].colors[i] || '#ffffff')
            const rgb = hexToRgb(hex)
            colorUniforms[i * 4 + 0] = rgb[0]
            colorUniforms[i * 4 + 1] = rgb[1]
            colorUniforms[i * 4 + 2] = rgb[2]
            colorUniforms[i * 4 + 3] = 1.0
          }

          const curX = env.cursorEnabled ? (env.cursor.targetX / (W || 1)) : -1000.0
          const curY = env.cursorEnabled ? (1.0 - env.cursor.targetY / (H || 1)) : -1000.0
          const cursorHeat = env.cursorEnabled ? (v.cursorHeat !== undefined ? v.cursorHeat : 1.0) : 0.0

          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_time'), env.time)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_speed'), v.speed !== undefined ? v.speed : 1.00)

          const cBack = hexToRgb(v.colorBack || '#000000')
          gl.uniform4f(gl.getUniformLocation(progInfo.prog, 'u_colorBack'), cBack[0], cBack[1], cBack[2], 1.0)
          gl.uniform4fv(gl.getUniformLocation(progInfo.prog, 'u_colors'), colorUniforms)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_colorsCount'), count)

          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_contour'), v.contour !== undefined ? v.contour : 1.00)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle !== undefined ? v.angle : 172)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_noise'), v.noise !== undefined ? v.noise : 1.00)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_innerGlow'), v.innerGlow !== undefined ? v.innerGlow : 0.40)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_outerGlow'), v.outerGlow !== undefined ? v.outerGlow : 0.50)

          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_scale'), v.scale !== undefined ? v.scale : 0.75)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_rotation'), v.rotation !== undefined ? v.rotation : 0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_offsetX'), v.offsetX !== undefined ? v.offsetX : 0.00)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_offsetY'), v.offsetY !== undefined ? v.offsetY : 0.00)

          gl.uniform2f(gl.getUniformLocation(progInfo.prog, 'u_cursor'), curX, curY)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_cursorHeat'), cursorHeat)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          return `Heatmap · ${count} colors · Angle ${v.angle}° · Scale ${v.scale}`
        },
      }

export default heatmap;
export { heatmap };
