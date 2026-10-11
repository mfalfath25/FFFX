import { env, canvas, ctx } from '../../core/env.js';
import { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';

      const paperTextureFS = `#version 300 es
        precision mediump float;

        uniform sampler2D u_image;
        uniform bool u_isImage;
        uniform float u_imageAspectRatio;

        uniform vec4 u_colorBack;
        uniform vec4 u_colorPaper;
        uniform vec4 u_colorShadow;

        uniform float u_blending;
        uniform float u_distortion;
        uniform bool u_clip;
        uniform float u_angle;
        uniform float u_seed;

        uniform float u_roughness;
        uniform float u_roughnessSize;
        uniform float u_roughnessRows;
        uniform float u_fiber;
        uniform float u_fiberSize;
        uniform float u_folds;
        uniform float u_foldSizeX;
        uniform float u_foldSizeY;
        uniform float u_foldOffsetX;
        uniform float u_foldOffsetY;
        uniform float u_wrinkles;
        uniform float u_wrinkleSize;
        uniform float u_crumples;
        uniform float u_crumpleCount;
        uniform float u_drops;

        // Custom Point-to-Point Creases (up to 16 crease vectors)
        uniform vec4 u_creases[16];
        uniform int u_creaseCount;
        uniform float u_creaseDepth;
        uniform float u_creaseWidth;
        uniform float u_creaseHighlight;
        uniform float u_creaseBuckle;

        uniform sampler2D u_noiseTexture;

        in vec2 v_imageUV;
        out vec4 fragColor;

        #define TWO_PI 6.28318530718
        #define PI 3.14159265358979323846

        float getUvFrame(vec2 uv) {
          vec2 invAA = .5 / clamp(fwidth(uv), 1e-5, .02);
          vec2 lo = clamp(uv * invAA + .5, 0., 1.);
          vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
          return lo.x * hi.x * lo.y * hi.y;
        }

        float lst(float edge0, float edge1, float x) {
          return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        }

        float hash21(vec2 p) {
          p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
          p += dot(p, p + 19.19);
          return fract(p.x * p.y);
        }

        vec2 hash22(vec2 p) {
          p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
          p += dot(p, p.yx + 19.19);
          return fract(vec2(p.x * p.y, p.x + p.y));
        }

        float getRoughness(vec2 p, vec2 lightDir, vec2 seedShift, float basePixel) {
          vec2 u = p / vec2(2.0, 4.0);
          float w = 100. * basePixel;
          float eps = 4. * w;

          float size = mix(3.2, .8, u_roughnessSize);
          float logLac = log2(2.1);
          float level = -log2(w + 1e-8) / logLac;
          float baseLevel = floor(level) - 2.;
          float fade = fract(level);

          vec2 px = (u.x + vec2(eps, -eps)) * .1;
          float py = u.y * .1;

          vec2 sum = vec2(0.);
          float norm = 0., amp = .5;
          float freq = exp2(baseLevel * logLac);
          for (int i = 0; i < 4; i++) {
            float absIdx = baseLevel + float(i);
            vec2 qx = size * px * freq;
            float qy = size * py * freq;

            float wi = 1.;
            if (i == 0) wi = 1. - fade;
            if (i == 3) wi = fade;

            vec2 fx = fract(qx);
            float fy = fract(qy);
            vec2 shift = .5 + absIdx * .3 + seedShift;
            float uvY = floor(qy) / 50. + shift.y;
            vec2 s0a = textureLod(u_noiseTexture, fract(vec2(floor(qx.x) / 50. + shift.x, uvY)), 0.).rg;
            vec2 s1a = textureLod(u_noiseTexture, fract(vec2( ceil(qx.x) / 50. + shift.x, uvY)), 0.).rg;
            vec2 s0b = textureLod(u_noiseTexture, fract(vec2(floor(qx.y) / 50. + shift.x, uvY)), 0.).rg;
            vec2 s1b = textureLod(u_noiseTexture, fract(vec2( ceil(qx.y) / 50. + shift.x, uvY)), 0.).rg;
            vec2 ny0 = mix(vec2(s0a.r, s0b.r), vec2(s0a.g, s0b.g), fy);
            vec2 ny1 = mix(vec2(s1a.r, s1b.r), vec2(s1a.g, s1b.g), fy);
            vec2 n = mix(ny0, ny1, fx);

            sum += amp * wi * n;
            norm += amp * wi;
            amp *= .8;
            freq *= 2.1;
          }

          vec2 r = sum / norm;
          float dx = .5 + r.x - r.y;
          float grain = 3. * dx * dx - .7;

          float rowBand = fract(dot(p, lightDir) * .05 * size);
          return grain + .6 * u_roughnessRows * (rowBand - .5);
        }

        float getFiber(vec2 p, vec2 seedShift, float basePixel) {
          float size = mix(4., 1., u_fiberSize);
          float w = 50. * basePixel;
          float level = -log2(w + 1e-8);
          float baseLevel = floor(level) - 3.;
          float fade = fract(level);

          vec2 grad = vec2(0.);
          float scale = 1.;
          float amp = 1.;
          float freq = pow(1.7, baseLevel);
          for (int i = 0; i < 5; i++) {
            float absIdx = baseLevel + float(i);
            vec2 q = size * p * freq;

            float an = absIdx * .8;
            float rc = cos(an), rs = sin(an);
            q = vec2(rc * q.x - rs * q.y, rs * q.x + rc * q.y);

            float wi = 1.;
            if (i == 0) wi = 1. - fade;
            if (i == 4) wi = fade;

            vec2 iq = floor(q);
            vec2 fq = fract(q);
            float shift = absIdx * .3;
            vec4 uv = fract(vec4(iq, iq + 1.) / 50. + .5 + shift + seedShift.xyxy);
            float aF = textureLod(u_noiseTexture, uv.xy, 0.).b;
            float bF = textureLod(u_noiseTexture, uv.zy, 0.).b;
            float cF = textureLod(u_noiseTexture, uv.xw, 0.).b;
            float dF = textureLod(u_noiseTexture, uv.zw, 0.).b;
            vec2 u = fq * fq * (3. - 2. * fq);
            vec2 du = 8. * fq * (1. - fq);
            float dx = du.x * mix(bF - aF, dF - cF, u.y);
            float dy = du.y * mix(cF - aF, dF - bF, u.x);
            grad += wi * amp * scale * vec2(rc * dx + rs * dy, -rs * dx + rc * dy);
            scale *= 1.7;
            amp *= .5;
            freq *= 1.7;
          }

          return clamp(.333 * length(grad), 0., 1.);
        }

        vec2 smoothNoise(vec2 p) {
          vec2 t = p * 50. - .5;
          vec2 i = floor(t);
          vec2 f = fract(t);
          f = f * f * (3. - 2. * f);
          return textureLod(u_noiseTexture, fract((i + f + .5) / vec2(50.)), 0.).rg;
        }

        float getDrops(vec2 uv, vec2 seedShift) {
          vec2 iDropsUV = floor(uv);
          vec2 fDropsUV = fract(uv);
          float dropsMinDist = 1.;
          for (int y = -1; y < 2; y += 1) {
            for (int x = -1; x < 2; x += 1) {
              vec2 neighbor = vec2(float(y), float(x));
              vec2 offset = hash22(iDropsUV + neighbor + 50. * seedShift);
              vec2 pos = neighbor + offset - fDropsUV;
              dropsMinDist *= min(1., dot(pos, pos));
            }
          }
          return .5 * lst(.09, .08, sqrt(sqrt(dropsMinDist)));
        }

        vec2 getCellTilt(float idx, float radius) {
          vec2 rand = hash22(vec2(idx + 31., idx * u_seed + 17.));
          float an = rand.x * TWO_PI;
          return vec2(cos(an), sin(an)) * mix(.3, 1.7, rand.y * rand.y) * mix(.7, 1., radius);
        }

        vec2 getCrumpleDetail(vec2 uv, float freq, float shift, float basePixel, out float depth) {
          depth = 0.;
          vec2 v = uv * freq;
          float pixel = .9 * freq * basePixel;
          vec2 base = floor(v);
          float n1 = 9., n2 = 9.;
          vec2 s1 = vec2(0.), s2 = vec2(0.), q1 = vec2(0.), q2 = vec2(0.);

          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 cell = base + vec2(float(x), float(y));
              vec2 q = hash22(vec2(cell.y * 1.9 + 3.1 + shift, cell.x * 1.3 + .11 * u_seed));
              float keep = .8;
              if (q.y > keep) continue;

              vec2 r = hash22(vec2(cell.x + .37 * u_seed + shift + 11.1, cell.y - .21 * u_seed + 5.7));
              vec2 s = cell + .06 + .88 * r;

              vec2 d = v - s;
              float dsq = dot(d, d);
              if (dsq < n1) {
                n2 = n1;
                s2 = s1;
                q2 = q1;
                n1 = dsq;
                s1 = s;
                q1 = q;
              } else if (dsq < n2) {
                n2 = dsq;
                s2 = s;
                q2 = q;
              }
            }
          }

          if (n1 > 8.) return vec2(0.);

          float an1 = q1.x * TWO_PI, mag1 = q1.y / .8;
          vec2 t1 = vec2(cos(an1), sin(an1)) * mix(.3, 1.7, mag1 * mag1);
          float an2 = q2.x * TWO_PI, mag2 = q2.y / .8;
          vec2 t2 = vec2(cos(an2), sin(an2)) * mix(.3, 1.7, mag2 * mag2);

          vec2 span = s1 - s2;
          float spanLen = max(length(span), 1e-4);
          float toEdge = (n2 - n1) / (2. * spanLen);

          float pair = hash21(s1 + s2 + 1.7 * abs(s1 - s2));
          float pairSoft = .05 + .1 * step(pair, .4);
          float b = clamp(toEdge / max(1.5 * pixel, .5 * pairSoft), 0., 1.);
          b = b * b * (3. - 2. * b);
          float d1 = max(sqrt(n1), 1e-4);
          depth = .2 * d1;
          float shoulderAmt = max(0., 1. - toEdge / .42) * b;
          vec2 shoulder = vec2(0.);
          if (shoulderAmt > 0.) {
            float d2 = max(sqrt(n2), 1e-4);
            shoulder = shoulderAmt * ((v - s2) / d2 - (v - s1) / d1);
          }

          vec2 mid = .5 * (t1 + t2);
          return mid + (t1 - mid) * b + .9 * shoulder;
        }

        vec4 getCrumples(vec2 uv) {
          float crumpleN = max(2., floor(u_crumpleCount + .5));
          float near = 60000., nearB = 60000.;
          float idx = 0., rad = 0.;
          vec2 nearP = vec2(0.), nearPb = vec2(0.);
          vec4 seeds[15];
          for (int i = 0; i < 15; i++) {
            if (float(i) >= crumpleN) break;
            vec2 rand = hash22(vec2(float(i), float(i) * u_seed));
            float an = rand.x * TWO_PI;
            vec2 p = vec2(cos(an), sin(an)) * rand.y;
            seeds[i] = vec4(p, rand);

            vec2 d = uv - p;
            float dsq = dot(d, d);
            if (dsq < near) {
              nearB = near;
              nearPb = nearP;
              near = dsq;
              idx = float(i);
              rad = rand.y;
              nearP = p;
            } else if (dsq < nearB) {
              nearB = dsq;
              nearPb = p;
            }
          }
          float l = sqrt(near), lb = sqrt(nearB);
          vec2 dir = (uv - nearP) / max(l, 1e-4);
          float edge = lst(0., .5, lb - l);

          float shoulderLimit = l + .5;

          vec2 tilt = getCellTilt(idx, rad);
          float tiltSum = 1.;
          vec2 wide = vec2(0.);
          float wideSum = 0.;
          float toEdge = 9., edgeSoft = 0.;

          for (int i = 0; i < 15; i++) {
            if (float(i) >= crumpleN) break;
            if (float(i) == idx) continue;
            vec4 seed = seeds[i];
            vec2 p = seed.xy;
            vec2 rand = seed.zw;

            vec2 d = uv - p;
            float dsq = dot(d, d);

            if (dsq < shoulderLimit * shoulderLimit) {
              float di = sqrt(dsq);
              float shoulder = lst(.5, 0., di - l);
              wide += shoulder * (d / max(di, 1e-4) - dir);
              wideSum += shoulder;
            }

            float pairSoft = .01 + .05 * step(.2, rand.x) + .3 * rand.y;
            float toBisector = (dsq - near) / (.2 * max(length(p - nearP), 1e-4));
            if (toBisector < toEdge) {
              toEdge = toBisector;
              edgeSoft = pairSoft;
            }

            float w = 1. - toBisector / pairSoft;
            if (w > 0.) {
              w *= w;
              tilt += w * getCellTilt(float(i), rand.y);
              tiltSum += w;
            }
          }

          float blend = clamp(toEdge / edgeSoft, 0., 1.);
          vec2 sharp = (1. - edge) * ((uv - nearPb) / max(lb, 1e-4) - dir);
          vec2 rounding = mix(sharp, wide / max(wideSum, 1.), min(2. * edgeSoft, 1.));
          float radial = l / max(l + toEdge, 1e-4);

          return vec4(tilt / tiltSum + rounding * blend * radial, .2 * l, edge);
        }

        void getFolds(vec2 coord, vec2 offset, vec2 count, vec2 noise, vec2 baseFwidth, out vec2 slope, out vec2 dark, out vec2 lift) {
          vec2 g = coord * count + .5 * offset + noise;
          vec2 dx = fract(g) - .5;
          vec2 adx = abs(dx);
          float foldRadius = .3;
          vec2 t = clamp(adx / foldRadius, 0., 1.);
          dark = t * t * (3. - 2. * t);
          lift = 1. - t;
          lift *= lift;

          vec2 crease = clamp(dx / max(count * baseFwidth, 1e-5), -1., 1.);
          slope = crease * (1. - dark);

          vec2 lineWidth = .02 * count * mix(vec2(2.5), vec2(.8), dark.yx) + .1 * noise;
          slope -= 1. - smoothstep(vec2(0.), lineWidth, adx);
        }

        void main() {
          vec2 patternUV = (v_imageUV - .5) * vec2(u_imageAspectRatio, 1.);
          float basePixel = max(length(dFdx(patternUV)), length(dFdy(patternUV)));
          vec2 baseFwidth = fwidth(patternUV);

          float pattern = 0.;

          float crumpleDepth = 0.;
          float wrinkleDepth = 0.;
          float foldDepth = 0.;
          float roughness = 0.;
          float fiber = 0.;
          float drops = 0.;

          float grazing = 0.7;
          float lightRad = radians(u_angle);
          vec2 lightDir = vec2(sin(lightRad), -cos(lightRad));
          float foldAngleInSector = mod(u_angle, 90.);
          float foldLightRad = radians(u_angle - foldAngleInSector + mix(12., 78., foldAngleInSector / 90.));
          vec2 foldLightDir = vec2(sin(foldLightRad), -cos(foldLightRad));
          vec2 relief = vec2(0.);
          vec2 foldSlope = vec2(0.);
          float reliefAmount = 0.;
          float foldInk = 1.;
          vec2 crumpleFlow = vec2(0.);

          vec2 warpNoise = vec2(0.);
          if (u_crumples > 0. || u_folds > 0. || u_wrinkles > 0.) {
            warpNoise = smoothNoise(patternUV * .1 + .2 + .6 * fract(.017 * u_seed)) - .5;
          }
          vec2 crumplesUV = (patternUV * .9) + .012 * warpNoise;

          if (u_crumples > 0.) {
            vec4 crumples = getCrumples(crumplesUV);

            vec2 crumpleTilt = .5 * u_crumples * crumples.xy;
            crumpleTilt -= .1 * max(dot(crumpleTilt, lightDir), 0.) * lightDir;
            relief += crumpleTilt;
            reliefAmount += .6 * u_crumples;
            crumpleFlow = crumples.w * crumpleTilt;

            crumpleDepth = clamp(5. * crumples.z, 0., 1.);
          }

          if (u_wrinkles > 0.) {
            float detailFreq = mix(10., 1., u_wrinkleSize);
            float detailAmp = .2;
            vec2 detailGrad = vec2(0.);
            float detailDepth = 0., depthSum = 0.;
            for (int i = 0; i < 3; i++) {
              float layerDepth;
              detailGrad += detailAmp * getCrumpleDetail(crumplesUV, detailFreq, 31. * float(i), basePixel, layerDepth);
              detailDepth += detailAmp * layerDepth;
              depthSum += detailAmp;
              detailAmp *= (.5 + .2 * detailGrad.x);
              detailFreq *= 2.1;
            }

            vec2 detailTilt = 1.5 * u_wrinkles * detailGrad;
            detailTilt -= .65 * max(dot(detailTilt, lightDir), 0.) * lightDir;
            relief += detailTilt;
            reliefAmount += .6 * u_wrinkles;

            wrinkleDepth = clamp(5. * detailDepth / max(depthSum, 1e-4), 0., 1.);
          }

          if (u_folds > 0.) {
            vec2 foldOffset = vec2(1. - 2. * u_foldOffsetX, 1. - 2. * u_foldOffsetY);
            vec2 foldCount = vec2(mix(3., .5, u_foldSizeX), mix(3., .5, u_foldSizeY));
            vec2 foldNoise = .005 * warpNoise * foldCount;
            vec2 uv = patternUV + .03 * crumpleFlow;

            vec2 slope, dark, lift;
            getFolds(uv, foldOffset, foldCount, foldNoise, baseFwidth, slope, dark, lift);

            foldSlope = u_folds * slope;
            reliefAmount += 1. * u_folds;
            vec2 ink = mix(vec2(.96), vec2(1.), dark);
            float flatness = dark.x * dark.y;
            foldInk *= mix(1., ink.x * ink.y * mix(.5, .3, flatness), u_folds);

            foldDepth = u_folds * (lift.y * foldLightDir.y - lift.x * foldLightDir.x);
          }

          // Custom Point-to-Point Paper Creases
          float customCreaseDepth = 0.0;
          if (u_creaseCount > 0) {
            float wWidth = max(0.003, u_creaseWidth * 0.04);
            for (int i = 0; i < 16; i++) {
              if (i >= u_creaseCount) break;
              vec4 cLine = u_creases[i];
              vec2 pa = (patternUV - (cLine.xy - 0.5) * vec2(u_imageAspectRatio, 1.0));
              vec2 ba = (cLine.zw - cLine.xy) * vec2(u_imageAspectRatio, 1.0);
              float baLenSq = dot(ba, ba);
              if (baLenSq > 1e-5) {
                float h = clamp(dot(pa, ba) / baLenSq, 0.0, 1.0);
                vec2 perp = pa - ba * h;
                float dist = length(perp);
                if (dist < wWidth * 5.0) {
                  vec2 normDir = normalize(perp + 1e-4);
                  float valley = -exp(-dist / wWidth) * u_creaseDepth * 1.3;
                  float ridge = exp(-dist / (wWidth * 0.35)) * u_creaseHighlight * 0.85;
                  
                  vec2 cTilt = normDir * (valley + ridge);
                  relief += cTilt * 1.5;
                  reliefAmount += 0.8 * u_creaseDepth;
                  crumpleFlow += normDir * exp(-dist / (wWidth * 2.0)) * u_creaseBuckle * 0.5;
                  customCreaseDepth += exp(-dist / wWidth);
                }
              }
            }
          }

          float unlit = cos(grazing);
          float lit = unlit;

          if (reliefAmount > 0.) {
            float lightFalloff = clamp(.5 + dot(v_imageUV - .5, lightDir), 0., 1.);
            float lightPower = mix(.5, 1., lightFalloff);
            float slope = clamp(dot(relief, lightDir) + dot(foldSlope, foldLightDir), -1.2, 1.2);
            lit = max(cos(slope + grazing), 0.);

            pattern += (clamp(reliefAmount, 0., 1.) * unlit + (lit - unlit)) * foldInk * lightPower;
          }

          patternUV += .04 * crumpleFlow;

          vec2 seedShift = floor(fract(u_seed * vec2(.7548776662, .5698402909)) * 50.) / 50.;

          if (u_roughness > 0.) {
            roughness = u_roughness * getRoughness(1000. * patternUV, lightDir, seedShift, basePixel);
            pattern += roughness;
          }

          if (u_fiber > 0.) {
            fiber = u_fiber * getFiber(50. * patternUV, seedShift, basePixel);
            pattern += fiber;
          }

          if (u_drops > 0.) {
            drops = u_drops * getDrops(patternUV * 10., seedShift);
          }

          pattern = clamp(pattern, 0., 1.);

          vec3 backColor = u_colorBack.rgb * u_colorBack.a;
          float backOpacity = u_colorBack.a;
          vec3 baseColor = u_colorPaper.rgb * u_colorPaper.a;
          float baseOpacity = u_colorPaper.a;
          vec3 shadowColor = u_colorShadow.rgb * u_colorShadow.a;
          float shadowOpacity = u_colorShadow.a;

          float notClipped = u_clip ? .1 : 1.;
          vec2 imageCenteredUV = v_imageUV - .5;
          float edgeDist = 2. * max(abs(imageCenteredUV.x), abs(imageCenteredUV.y));
          float wrinkleDistortion = mix(.38, .0175, smoothstep(0., 1., edgeDist));
          float scaleDistortion = .15 * u_crumples * (crumpleDepth - .5) + wrinkleDistortion * u_wrinkles * (wrinkleDepth - .5) + .05 * foldDepth + .1 * customCreaseDepth;
          vec2 linearDistortion = notClipped * .002 * lightDir * drops;
          float radialDistortion = notClipped * .02 * (roughness + fiber);
          vec2 centeredUV = imageCenteredUV * (1. - u_distortion * scaleDistortion);
          centeredUV -= u_distortion * linearDistortion;
          vec2 imageUV = .5 + centeredUV * (1. - abs(u_distortion) * radialDistortion * dot(centeredUV, centeredUV));

          vec3 color = shadowColor * pattern;
          float opacity = shadowOpacity * pattern;
          color += baseColor * (1. - opacity);
          opacity += baseOpacity * (1. - opacity);

          if (u_isImage) {
            float frame = getUvFrame(imageUV);
            vec4 image = texture(u_image, imageUV);
            frame *= image.a;

            float maxC = max(max(image.r, image.g), image.b);
            float minC = min(min(image.r, image.g), image.b);
            float sat = maxC > 0. ? (maxC - minC) / maxC : 0.;
            float midC = image.r + image.g + image.b - maxC - minC;
            float secondaryness = maxC > minC ? (midC - minC) / (maxC - minC) : 0.;
            float satDampen = sat * (1. - .5 * secondaryness);
            float darkDampen = 1. - dot(vec3(.2126, .7152, .0722), image.rgb);
            float dampen = mix(0., .7, u_blending) * max(satDampen, darkDampen);

            vec3 paper = vec3(1.) - opacity + color;
            vec3 pic = image.rgb * paper * u_blending + image.rgb * (1. - u_blending);
            pic = mix(pic, vec3(1.), .6 * pow(dampen, 2. + 3. * pattern));

            color = mix(color, pic, frame);
            opacity = frame + opacity * (1. - frame);

            if (u_clip) {
              color *= frame;
              opacity *= frame;
            }
          }

          color *= mix(vec3(1.), .5 * u_colorShadow.rgb, drops * shadowOpacity);

          color += backColor * (1. - opacity);
          opacity += backOpacity * (1. - opacity);

          fragColor = vec4(color, opacity);
        }
      `

      const paperTexture = {
        id: 'paper-texture',
        label: 'Paper Texture',
        creases: [
          { x1: 0.15, y1: 0.25, x2: 0.85, y2: 0.75 },
          { x1: 0.80, y1: 0.15, x2: 0.20, y2: 0.85 },
        ],
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        dragCurrent: { x: 0, y: 0 },

        groups: [
          {
            title: 'Paper Preset & Color',
            controls: [
              {
                key: 'preset',
                label: 'Paper Type Preset',
                type: 'select',
                options: [
                  'CRUMPLED KRAFT',
                  'VINTAGE PARCHMENT',
                  'JAPANESE WASHI',
                  'WHITE ORIGAMI',
                  'WATERCOLOR ROUGH',
                  'NEWSPRINT MANILA',
                  'CUSTOM CREASE STUDIO',
                ],
                value: 'CRUMPLED KRAFT',
                onChange(newType) {
                  const v = values['paper-texture']
                  if (newType === 'CRUMPLED KRAFT') {
                    v.colorPaper = '#c4a67e'; v.colorShadow = '#543c22'; v.colorBack = '#2a1a0c'
                    v.crumples = 0.85; v.wrinkles = 0.6; v.fiber = 0.4; v.roughness = 0.7; v.folds = 0.3; v.blending = 0.85; v.distortion = 0.5
                  } else if (newType === 'VINTAGE PARCHMENT') {
                    v.colorPaper = '#e8d8b8'; v.colorShadow = '#785834'; v.colorBack = '#18120c'
                    v.crumples = 0.65; v.wrinkles = 0.75; v.fiber = 0.5; v.roughness = 0.5; v.folds = 0.4; v.blending = 0.9; v.distortion = 0.4
                  } else if (newType === 'JAPANESE WASHI') {
                    v.colorPaper = '#faf7ee'; v.colorShadow = '#6a5a4a'; v.colorBack = '#141414'
                    v.crumples = 0.2; v.wrinkles = 0.25; v.fiber = 0.95; v.roughness = 0.45; v.folds = 0.15; v.blending = 0.8; v.distortion = 0.25
                  } else if (newType === 'WHITE ORIGAMI') {
                    v.colorPaper = '#ffffff'; v.colorShadow = '#555560'; v.colorBack = '#111115'
                    v.crumples = 0.25; v.wrinkles = 0.15; v.fiber = 0.1; v.roughness = 0.3; v.folds = 0.95; v.blending = 0.75; v.distortion = 0.6
                    paperTexture.addPresetCreases('origami')
                  } else if (newType === 'WATERCOLOR ROUGH') {
                    v.colorPaper = '#f5f2e6'; v.colorShadow = '#4a443a'; v.colorBack = '#151515'
                    v.crumples = 0.45; v.wrinkles = 0.9; v.fiber = 0.6; v.roughness = 0.9; v.folds = 0.25; v.blending = 0.95; v.distortion = 0.45
                  } else if (newType === 'NEWSPRINT MANILA') {
                    v.colorPaper = '#ded4b8'; v.colorShadow = '#483c28'; v.colorBack = '#18140c'
                    v.crumples = 0.7; v.wrinkles = 0.8; v.fiber = 0.75; v.roughness = 0.8; v.folds = 0.5; v.blending = 0.85; v.distortion = 0.4
                  } else if (newType === 'CUSTOM CREASE STUDIO') {
                    v.colorPaper = '#f7f5ed'; v.colorShadow = '#3c342a'; v.colorBack = '#101010'
                    v.crumples = 0.35; v.wrinkles = 0.3; v.fiber = 0.3; v.roughness = 0.4; v.folds = 0.2; v.blending = 0.8; v.distortion = 0.65
                  }
                  renderPanel()
                },
              },
              {
                key: 'colorPaper',
                label: 'Paper Color',
                type: 'color',
                value: '#c4a67e',
              },
              {
                key: 'colorShadow',
                label: 'Shadow / Ink Tint',
                type: 'color',
                value: '#543c22',
              },
              {
                key: 'colorBack',
                label: 'Background Back Color',
                type: 'color',
                value: '#2a1a0c',
              },
              {
                key: 'blending',
                label: 'Media Ink Blend',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.85,
              },
              {
                key: 'distortion',
                label: 'Surface Warping',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.5,
              },
            ],
          },
          {
            title: 'Physical Crumples & Texture',
            controls: [
              {
                key: 'crumples',
                label: 'Crumples Intensity',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.85,
              },
              {
                key: 'crumpleCount',
                label: 'Crumple Facets Count',
                type: 'range',
                min: 2,
                max: 15,
                step: 1,
                value: 12,
              },
              {
                key: 'wrinkles',
                label: 'Micro Wrinkles',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.6,
              },
              {
                key: 'wrinkleSize',
                label: 'Wrinkle Size Scale',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.45,
              },
              {
                key: 'folds',
                label: 'Global Grid Folds',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.3,
              },
              {
                key: 'fiber',
                label: 'Cellulose Fibers',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.4,
              },
              {
                key: 'fiberSize',
                label: 'Fiber Thickness',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.5,
              },
              {
                key: 'roughness',
                label: 'Pulp Roughness',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.7,
              },
              {
                key: 'drops',
                label: 'Water / Oil Drops',
                type: 'range',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.0,
              },
            ],
          },
          {
            title: 'Point-to-Point Crease Drawing (Drag on Canvas)',
            controls: [
              {
                key: 'creaseDepth',
                label: 'Crease Shadow Depth',
                type: 'range',
                min: 0.0,
                max: 2.5,
                step: 0.1,
                value: 1.2,
                unit: 'x',
              },
              {
                key: 'creaseHighlight',
                label: 'Crease Ridge Highlight',
                type: 'range',
                min: 0.0,
                max: 2.5,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'creaseWidth',
                label: 'Crease Width',
                type: 'range',
                min: 0.2,
                max: 3.0,
                step: 0.1,
                value: 1.0,
                unit: 'x',
              },
              {
                key: 'creaseBuckle',
                label: 'Paper Buckle Warp',
                type: 'range',
                min: 0.0,
                max: 1.5,
                step: 0.05,
                value: 0.6,
              },
              {
                key: 'addDiagBtn',
                label: '+ ADD DIAGONAL CREASES',
                type: 'button',
                onClick() {
                  paperTexture.addPresetCreases('diagonal')
                },
              },
              {
                key: 'addOrigamiBtn',
                label: '+ ADD ORIGAMI GRID FOLDS',
                type: 'button',
                onClick() {
                  paperTexture.addPresetCreases('origami')
                },
              },
              {
                key: 'clearCreasesBtn',
                label: 'CLEAR ALL CUSTOM CREASES',
                type: 'button',
                onClick() {
                  paperTexture.clearCreases()
                },
              },
            ],
          },
          {
            title: 'Lighting & Seed',
            controls: [
              {
                key: 'angle',
                label: 'Light Angle',
                type: 'range',
                min: 0,
                max: 360,
                step: 5,
                value: 45,
                unit: '°',
              },
              {
                key: 'seed',
                label: 'Texture Seed',
                type: 'range',
                min: 0,
                max: 100,
                step: 1,
                value: 42,
              },
            ],
          },
        ],

        onPointerDown(x, y) {
          this.isDragging = true
          const u = x / (env.W || 1)
          const v = y / (env.H || 1)
          this.dragStart = { x: u, y: v }
          this.dragCurrent = { x: u, y: v }
        },

        onPointerMove(x, y, isDown) {
          if (!this.isDragging) return
          this.dragCurrent = {
            x: x / (env.W || 1),
            y: y / (env.H || 1),
          }
        },

        onPointerUp(x, y) {
          if (!this.isDragging) return
          this.isDragging = false
          const u = x / (env.W || 1)
          const v = y / (env.H || 1)
          const dx = u - this.dragStart.x
          const dy = v - this.dragStart.y
          const dist = Math.hypot(dx, dy)

          if (dist > 0.02) {
            if (this.creases.length >= 15) {
              this.creases.shift()
            }
            this.creases.push({
              x1: this.dragStart.x,
              y1: this.dragStart.y,
              x2: u,
              y2: v,
            })
          }
        },

        clearCreases() {
          this.creases = []
        },

        addPresetCreases(type) {
          if (type === 'cross') {
            this.creases = [
              { x1: 0.5, y1: 0.0, x2: 0.5, y2: 1.0 },
              { x1: 0.0, y1: 0.5, x2: 1.0, y2: 0.5 },
            ]
          } else if (type === 'diagonal') {
            this.creases = [
              { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 },
              { x1: 0.9, y1: 0.1, x2: 0.1, y2: 0.9 },
            ]
          } else if (type === 'origami') {
            this.creases = [
              { x1: 0.5, y1: 0.0, x2: 0.5, y2: 1.0 },
              { x1: 0.0, y1: 0.5, x2: 1.0, y2: 0.5 },
              { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
              { x1: 1.0, y1: 0.0, x2: 0.0, y2: 1.0 },
              { x1: 0.5, y1: 0.0, x2: 1.0, y2: 0.5 },
              { x1: 1.0, y1: 0.5, x2: 0.5, y2: 1.0 },
              { x1: 0.5, y1: 1.0, x2: 0.0, y2: 0.5 },
              { x1: 0.0, y1: 0.5, x2: 0.5, y2: 0.0 },
            ]
          }
        },

        draw(v, dt) {
          const { W, H } = env
          env.time += dt

          const { glCanvas, gl, quadBuffer, sharedTexture, noiseTexture } = getWebGL()
          if (!gl) {
            ctx.drawImage(env.sourceCanvas, 0, 0, W, H)
            return 'Paper Texture (WebGL fallback)'
          }

          const progInfo = getOrCreateProgram('paperTexture', paperTextureFS)
          if (!progInfo) return 'Paper Texture error'

          glCanvas.width = W
          glCanvas.height = H
          gl.viewport(0, 0, W, H)

          gl.useProgram(progInfo.prog)

          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
          gl.enableVertexAttribArray(progInfo.positionLocation)
          gl.vertexAttribPointer(progInfo.positionLocation, 2, gl.FLOAT, false, 0, 0)

          // Bind media source canvas to texture unit 0
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, sharedTexture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, env.sourceCanvas)

          // Bind noise texture to texture unit 1
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, noiseTexture)

          // Set Uniforms matching official Paper Design shader
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_image'), 0)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_noiseTexture'), 1)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_isImage'), 1)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_imageAspectRatio'), (W || 1) / (H || 1))

          const cPaper = hexToRgb(v.colorPaper || '#c4a67e')
          const cShadow = hexToRgb(v.colorShadow || '#543c22')
          const cBack = hexToRgb(v.colorBack || '#2a1a0c')

          gl.uniform4f(gl.getUniformLocation(progInfo.prog, 'u_colorPaper'), cPaper[0], cPaper[1], cPaper[2], 1.0)
          gl.uniform4f(gl.getUniformLocation(progInfo.prog, 'u_colorShadow'), cShadow[0], cShadow[1], cShadow[2], 1.0)
          gl.uniform4f(gl.getUniformLocation(progInfo.prog, 'u_colorBack'), cBack[0], cBack[1], cBack[2], 1.0)

          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_blending'), v.blending)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_distortion'), v.distortion)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_clip'), 0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_angle'), v.angle)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_seed'), v.seed)

          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_roughness'), v.roughness)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_roughnessSize'), 0.5)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_roughnessRows'), 0.0)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_fiber'), v.fiber)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_fiberSize'), v.fiberSize)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_folds'), v.folds)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_foldSizeX'), 0.5)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_foldSizeY'), 0.5)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_foldOffsetX'), 0.5)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_foldOffsetY'), 0.5)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_wrinkles'), v.wrinkles)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_wrinkleSize'), v.wrinkleSize)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_crumples'), v.crumples)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_crumpleCount'), v.crumpleCount)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_drops'), v.drops)

          // Custom Creases
          const allCreases = [...this.creases]
          if (this.isDragging && env.cursorEnabled) {
            allCreases.push({
              x1: this.dragStart.x,
              y1: this.dragStart.y,
              x2: this.dragCurrent.x,
              y2: this.dragCurrent.y,
            })
          }

          const creaseFlat = new Float32Array(16 * 4)
          const creaseCount = Math.min(16, allCreases.length)
          for (let i = 0; i < creaseCount; i++) {
            const c = allCreases[i]
            creaseFlat[i * 4 + 0] = c.x1
            creaseFlat[i * 4 + 1] = c.y1
            creaseFlat[i * 4 + 2] = c.x2
            creaseFlat[i * 4 + 3] = c.y2
          }

          gl.uniform4fv(gl.getUniformLocation(progInfo.prog, 'u_creases'), creaseFlat)
          gl.uniform1i(gl.getUniformLocation(progInfo.prog, 'u_creaseCount'), creaseCount)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_creaseDepth'), v.creaseDepth)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_creaseWidth'), v.creaseWidth)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_creaseHighlight'), v.creaseHighlight)
          gl.uniform1f(gl.getUniformLocation(progInfo.prog, 'u_creaseBuckle'), v.creaseBuckle)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          ctx.drawImage(glCanvas, 0, 0)

          // Draw active drag guide line
          if (this.isDragging && env.cursorEnabled) {
            ctx.save()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(this.dragStart.x * W, this.dragStart.y * H)
            ctx.lineTo(this.dragCurrent.x * W, this.dragCurrent.y * H)
            ctx.stroke()
            
            ctx.fillStyle = '#00ff88'
            ctx.setLineDash([])
            ctx.beginPath()
            ctx.arc(this.dragStart.x * W, this.dragStart.y * H, 4, 0, Math.PI * 2)
            ctx.arc(this.dragCurrent.x * W, this.dragCurrent.y * H, 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }

          return `Paper Texture · ${v.preset} · ${creaseCount} creases · Crumples ${v.crumples}`
        },
      }

export default paperTexture;
export { paperTexture };
