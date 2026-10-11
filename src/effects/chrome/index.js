import { makeShapeEffect } from '../../core/webgl.js';

      const chromeFS = `
        uniform vec3 u_tint;
        uniform vec3 u_warmColor;
        uniform vec3 u_coolColor;
        uniform float u_bevelWidth;
        uniform float u_bevelShape;
        uniform float u_curvature;
        uniform float u_waviness;
        uniform float u_environment;
        uniform float u_envRotation;
        uniform float u_softness;
        uniform float u_spectral;
        uniform float u_dispersion;
        uniform float u_shadows;
        uniform float u_speed;

        void main() {
          vec2 p; float d; vec2 gd; float alpha;
          shapeSetup(p, d, gd, alpha);
          vec3 bg = sceneBg(d);
          if (alpha < 0.002) { fragColor = vec4(bg, 1.0); return; }

          float t = u_time * u_speed;
          vec3 n;
          if (u_shape == 0) {
            vec3 imgN = imageNormal(v_imageUV, 3.2 + u_curvature * 5.0);
            vec2 wp = p * 1.7;
            vec2 wob = vec2(fbm4(vec3(wp, 0.3 + t * 0.03)), fbm4(vec3(wp + 7.7, 1.1 + t * 0.03))) - 0.5;
            n = normalize(vec3(imgN.xy + wob * u_waviness * 1.5, imgN.z));
          } else {
            float w = u_bevelWidth * 3.5;
            n = bevelNormal(gd, d, w, u_bevelShape);
            float inner = smoothstep(0.0, 0.35, -d);
            n.xy += toScreen(p) * u_curvature * 0.6 * inner;
            vec2 wp = p * 1.7;
            vec2 wob = vec2(fbm4(vec3(wp, 0.3 + t * 0.03)), fbm4(vec3(wp + 7.7, 1.1 + t * 0.03))) - 0.5;
            n.xy += wob * u_waviness * 1.2;
            n = normalize(n);
          }

          vec3 I = vec3(0.0, 0.0, -1.0);
          vec3 r = reflect(I, n);
          float curv = length(fwidth(n.xy));
          float dl = u_dispersion * (0.015 + 0.22 * clamp(curv * 6.0, 0.0, 1.0));
          float rot = radians(u_envRotation) + t * 0.3;
          float depth = u_shadows;

          vec3 refrMedia = texture(u_image, clamp(v_imageUV + n.xy * 0.06, 0.001, 0.999)).rgb;
          vec3 media = mix(mediaEnv(r, 0.4 + u_softness), refrMedia, 0.65) * 1.3;
          vec3 eR = mix(studio(r, rot + dl, u_softness, depth, u_warmColor, u_coolColor, u_spectral), media, u_mediaReflect);
          vec3 eG = mix(studio(r, rot, u_softness, depth, u_warmColor, u_coolColor, u_spectral), media, u_mediaReflect);
          vec3 eB = mix(studio(r, rot - dl, u_softness, depth, u_warmColor, u_coolColor, u_spectral), media, u_mediaReflect);
          vec3 col = vec3(eR.r, eG.g, eB.b) * u_tint * u_environment;

          float F = 0.88 + 0.12 * pow(1.0 - n.z, 4.0);
          col *= F;
          if (u_shape > 0) {
            col *= mix(0.65, 1.0, smoothstep(0.0, 0.02, -d));
          }

          vec3 outc = mix(bg, tone(col), alpha);
          fragColor = vec4(outc, 1.0);
        }
      `
      const chrome = makeShapeEffect({
        id: 'sx-chrome',
        label: 'Chrome',
        fragment: chromeFS,
        defaults: { mediaReflect: 0.25 },
        groups: [
          {
            title: 'Metal & Studio Lights',
            controls: [
              { key: 'tint', label: 'Tint', type: 'color', value: '#ffffff' },
              { key: 'warmColor', label: 'Warm strip', type: 'color', value: '#ffa94d' },
              { key: 'coolColor', label: 'Cool strip', type: 'color', value: '#74c0fc' },
              { key: 'environment', label: 'Environment', type: 'range', min: 0, max: 4, step: 0.05, value: 1.4 },
              { key: 'envRotation', label: 'Env rotation', type: 'range', min: 0, max: 360, step: 1, value: 0, unit: '°' },
              { key: 'softness', label: 'Softbox blur', type: 'range', min: 0, max: 1, step: 0.01, value: 0.2 },
              { key: 'spectral', label: 'Color saturation', type: 'range', min: 0, max: 1, step: 0.01, value: 0.4 },
              { key: 'dispersion', label: 'Dispersion', type: 'range', min: 0, max: 1, step: 0.01, value: 0.35 },
              { key: 'shadows', label: 'Contrast flags', type: 'range', min: 0, max: 1, step: 0.01, value: 0.65 },
              { key: 'speed', label: 'Orbit speed', type: 'range', min: 0, max: 3, step: 0.05, value: 0.35 },
            ],
          },
          {
            title: 'Surface & Distortion',
            controls: [
              { key: 'curvature', label: 'Curvature (dome)', type: 'range', min: 0, max: 1, step: 0.01, value: 0.45 },
              { key: 'waviness', label: 'Waviness', type: 'range', min: 0, max: 1, step: 0.01, value: 0.15 },
            ],
          },
          {
            title: 'Bevel',
            controls: [
              { key: 'bevelWidth', label: 'Bevel width', type: 'range', min: 0.005, max: 0.3, step: 0.001, value: 0.05 },
              { key: 'bevelShape', label: 'Bevel profile', type: 'range', min: 0, max: 1, step: 0.01, value: 0.3 },
            ],
          },
        ],
        describe: (v) => `Chrome · ${v.shape} · Env ${v.environment}`,
      })

export default chrome;
export { chrome };
