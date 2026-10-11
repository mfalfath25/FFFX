import { makeShapeEffect } from '../../core/webgl.js';

      const sxLiquidMetalFS = `
        uniform vec3 u_lightColor;
        uniform vec3 u_darkColor;
        uniform float u_turbulence;
        uniform float u_ripple;
        uniform float u_warp;
        uniform float u_speed;
        uniform float u_environment;
        uniform float u_envRotation;
        uniform float u_sharpness;
        uniform float u_dispersion;
        uniform float u_lightAngle;
        uniform float u_bevelWidth;
        uniform float u_bevelShape;

        float foldField(vec2 p, float t) {
          vec2 q = p * u_ripple * 0.55;
          for (int i = 0; i < 2; i++) {
            vec2 n2 = vec2(vnoise(vec3(q * 1.1 + vec2(1.7, 9.2), t)), vnoise(vec3(q * 1.1 + vec2(8.3, 2.8), t * 1.13)));
            q += (n2 - 0.5) * u_warp * 0.9;
          }
          return fbm4(vec3(q, t * 0.7));
        }

        void main() {
          vec2 p; float d; vec2 gd; float alpha;
          shapeSetup(p, d, gd, alpha);
          vec3 bg = sceneBg(d);
          if (alpha < 0.002) { fragColor = vec4(bg, 1.0); return; }

          float t = u_time * u_speed * 0.25;
          float e = 0.02;
          vec2 g = vec2(foldField(p + vec2(e, 0.0), t) - foldField(p - vec2(e, 0.0), t),
                        foldField(p + vec2(0.0, e), t) - foldField(p - vec2(0.0, e), t)) / (2.0 * e);

          vec3 n;
          if (u_shape == 0) {
            vec3 imgN = imageNormal(v_imageUV, 2.8 + u_warp * 1.2);
            n = normalize(vec3(imgN.xy * 0.7 + g * u_turbulence * 0.18, 1.0));
          } else {
            float w = u_bevelWidth * 3.5;
            n = bevelNormal(gd, d, w, u_bevelShape);
            float inner = smoothstep(0.0, 0.35, -d);
            n.xy += toScreen(p) * 0.35 * inner;
            n.xy += toScreen(g) * u_turbulence * 0.07 * (0.35 + 0.65 * inner);
            n = normalize(n);
          }

          vec3 I = vec3(0.0, 0.0, -1.0);
          vec3 r = reflect(I, n);
          float curv = length(fwidth(n.xy));
          float dl = u_dispersion * (0.02 + 0.2 * clamp(curv * 5.0, 0.0, 1.0));
          float rot = radians(u_envRotation) + u_time * u_speed * 0.15;
          float soft = mix(0.9, 0.0, u_sharpness);
          vec3 warm = vec3(1.0, 0.78, 0.5);
          vec3 cool = vec3(0.6, 0.7, 0.95);

          vec3 Lc = vec3(lum(studio(r, rot + dl, soft, 0.75, warm, cool, 0.25)),
                         lum(studio(r, rot, soft, 0.75, warm, cool, 0.25)),
                         lum(studio(r, rot - dl, soft, 0.75, warm, cool, 0.25)));
          vec3 refrMedia = texture(u_image, clamp(v_imageUV + n.xy * 0.07, 0.001, 0.999)).rgb;
          float Lm = lum(mix(mediaEnv(r, 0.3 + soft), refrMedia, 0.6)) * 1.4;
          Lc = mix(Lc, vec3(Lm), u_mediaReflect);
          vec3 m = 1.0 - exp(-Lc * u_environment * 0.8);
          vec3 col = mix(u_darkColor, u_lightColor, m);

          float la = radians(u_lightAngle);
          vec3 Lk = normalize(vec3(cos(la), -sin(la), 0.65));
          vec3 h = normalize(Lk + vec3(0.0, 0.0, 1.0));
          float nh = max(dot(n, h), 0.0);
          float shin = mix(30.0, 3000.0, u_sharpness * u_sharpness);
          float spec = pow(nh, shin) * (1.0 + u_sharpness * 4.0);
          vec3 h2 = normalize(normalize(vec3(-Lk.xy, 0.5)) + vec3(0.0, 0.0, 1.0));
          float spec2 = pow(max(dot(n, h2), 0.0), shin * 0.6) * 0.5;
          col += u_lightColor * (spec + spec2) * 1.1;

          if (u_shape > 0) {
            col *= mix(0.7, 1.0, smoothstep(0.0, 0.02, -d));
          }
          vec3 outc = mix(bg, tone(col), alpha);
          fragColor = vec4(outc, 1.0);
        }
      `
      const sxLiquidMetal = makeShapeEffect({
        id: 'sx-liquid-metal',
        label: 'Liquid Metal',
        fragment: sxLiquidMetalFS,
        defaults: { mediaReflect: 0.3 },
        groups: [
          {
            title: 'Metal Tone',
            controls: [
              { key: 'lightColor', label: 'Light color', type: 'color', value: '#eef0f6' },
              { key: 'darkColor', label: 'Dark color', type: 'color', value: '#141414' },
              { key: 'environment', label: 'Environment', type: 'range', min: 0, max: 4, step: 0.05, value: 1.5 },
              { key: 'envRotation', label: 'Env rotation', type: 'range', min: 0, max: 360, step: 1, value: 0, unit: '°' },
              { key: 'sharpness', label: 'Sharpness', type: 'range', min: 0, max: 1, step: 0.01, value: 0.6 },
              { key: 'dispersion', label: 'Dispersion', type: 'range', min: 0, max: 1, step: 0.01, value: 0.25 },
              { key: 'lightAngle', label: 'Light angle', type: 'range', min: 0, max: 360, step: 1, value: 265, unit: '°' },
            ],
          },
          {
            title: 'Molten Flow',
            controls: [
              { key: 'turbulence', label: 'Turbulence', type: 'range', min: 0, max: 3, step: 0.05, value: 1 },
              { key: 'ripple', label: 'Ripple scale', type: 'range', min: 1, max: 12, step: 0.1, value: 4 },
              { key: 'warp', label: 'Warp', type: 'range', min: 0, max: 4, step: 0.05, value: 1.5 },
              { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, value: 0.5 },
            ],
          },
          {
            title: 'Bevel',
            controls: [
              { key: 'bevelWidth', label: 'Bevel width', type: 'range', min: 0.005, max: 0.3, step: 0.001, value: 0.05 },
              { key: 'bevelShape', label: 'Bevel profile', type: 'range', min: 0, max: 1, step: 0.01, value: 0 },
            ],
          },
        ],
        describe: (v) => `Liquid Metal · ${v.shape} · Turb ${v.turbulence}`,
      })

export default sxLiquidMetal;
export { sxLiquidMetal };
