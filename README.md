# FFFX · Vision & Shader Studio

A high-performance real-time creative coding lab for monocular depth estimation, computer vision, photogrammetry tracking, procedural motion, and WebGL shader materials.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
yarn install
```

### 2. Development Server
Starts Vite with instant Hot Module Replacement (HMR):
```bash
yarn dev
```

### 3. Build for Production / GitHub Pages
Builds the standalone static application to `dist/`:
```bash
yarn build
```

### 4. Preview Production Build
```bash
yarn preview
```

---

## 📁 Project Architecture

```text
FFFX/
├── do-not-touch/
│   └── index.html                # Untouched pristine single-file backup
├── dist/                         # Compiled static distribution (for hosting)
├── .github/workflows/
│   └── deploy.yml                # Automatic GitHub Pages CI/CD workflow
├── index.html                    # Clean HTML layout & module entry point
├── package.json
├── vite.config.js                # Relative base paths enabled for GitHub Pages
├── jsconfig.json                 # Path aliases & future TypeScript readiness
└── src/
    ├── main.js                   # Application bootstrap & 60fps render loop
    ├── styles/
    │   └── main.css              # Studio styles, dark/light theme, and layout
    ├── core/
    │   ├── env.js                # Shared canvas state (W, H, cursor, time, media frames)
    │   ├── sat.js                # Summed-Area Table & computer-vision box filters
    │   ├── webgl.js              # WebGL / WebGL2 engine, shader compilation & shapes
    │   ├── media.js              # Webcam, video upload, presets & drop pipeline
    │   └── motion-demo.js        # Procedural animated physics motion demo
    ├── ui/
    │   ├── headless/
    │   │   ├── store.js          # Reactive ParameterStore (get, set, presets, batch)
    │   │   ├── controls.js       # Headless control descriptors (range, select, color, etc.)
    │   │   └── group.js          # Headless group accordion/collapse model
    │   ├── renderers/
    │   │   └── panel-renderer.js # DOM adapter rendering controls into the sidebar
    │   ├── menu.js               # Left drawer effect & media catalog navigation
    │   └── stage-tools.js        # Toolbar tools, shortcuts, theme & pointer tracking
    └── effects/
        ├── index.js              # Central registry of all active studio effects
        ├── quadtree-bokeh/       # Quadtree Bokeh focus & particle dispersion
        ├── blob-tracker/         # Photogrammetry tracking, glitch HUD & vectors
        ├── voxel-drift/          # Volumetric voxel displacement & void disintegration
        ├── tracking-v2/          # Dual-engine MediaPipe + Kinematic joint tracking
        ├── depth-map/            # Monocular depth estimation (LiDAR, NVG, Bokeh, 3D)
        ├── pixel-trail/          # Slit-scan pixelated trail persistence
        ├── pixel-beams/          # Dither wave & phosphor cathode rays
        ├── heatmap/              # Official Paper Design heatmap gradient solver
        ├── liquid-metal/         # Molten chrome fluid & specular reflections
        ├── chrome/               # 3D studio reflection & metallic bevel badge
        ├── sx-liquid-metal/      # Molten metal wave displacement
        ├── gem-smoke/            # Gemstone refraction & ethereal smoke wisps
        ├── halftone-cmyk/        # 4-color offset printing CMYK raster angles
        ├── halftone-dots/        # Graphic halftone wave grids
        ├── lens-distortion/      # Chromatic aberration, barrel bulge & grain
        ├── dithering/            # Bayer ordered matrix & blue noise dithering
        └── paper-texture/        # Crease studio & procedural paper crumples
```

---

## 🧩 Headless Design System Components

The parameter panel uses a **headless architecture**:
1. **Model & State (`src/ui/headless/store.js`)**: All parameters are managed by `ParameterStore`. State is decoupled from the DOM.
2. **Control Descriptors (`src/ui/headless/controls.js`)**: Pure declarative specifications (`range`, `select`, `color`, `checkbox`, `button`) defining min, max, step, formatters, and normalizers.
3. **Renderer Adapter (`src/ui/renderers/panel-renderer.js`)**: Renders the headless models to HTML DOM elements. Themes, styling, and DOM representations can be changed without touching any effect code.

---

## 🛠 Adding a New Effect

To add a new effect:
1. Create a folder in `src/effects/my-effect/index.js`.
2. Implement the standard Effect contract:
```javascript
import { env } from '../../core/env.js';

export const myEffect = {
  id: 'my-effect',
  label: 'My New Effect',
  groups: [
    {
      title: 'Parameters',
      controls: [
        { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 100, value: 50 },
      ],
    },
  ],
  draw(values, dt) {
    const { ctx, W, H } = env;
    // Render logic here
    return `My Effect · Intensity: ${values.intensity}`;
  },
};

export default myEffect;
```
3. Export it in `src/effects/index.js` and add it to the `effects` array.

---

## 🚢 Deployment

### GitHub Pages
1. Push to your repository.
2. Go to **Repository Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` builds and publishes the site automatically.

### Standalone Server (Nginx, Caddy, Apache, Docker)
Run `npm run build` and serve the static files in the `dist/` directory.
