const fs = require('fs');
const path = require('path');

const srcHtml = fs.readFileSync(path.join(__dirname, '..', 'do-not-touch', 'index.html'), 'utf8');
const lines = srcHtml.split('\n');

// Helper to get lines 1-indexed inclusive
function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const effectsMeta = [
  {
    id: 'quadtree-bokeh',
    varName: 'quadtreeBokeh',
    folder: 'quadtree-bokeh',
    start: 952,
    end: 1215,
    imports: `import { env, ROOT, TAU } from '../../core/env.js';\nimport { rectSum, lumaStdDev, hash } from '../../core/sat.js';\n`,
  },
  {
    id: 'blob-tracker',
    varName: 'blobTracker',
    folder: 'blob-tracker',
    start: 1216,
    end: 3135,
    imports: `import { env, TAU } from '../../core/env.js';\nimport { hash } from '../../core/sat.js';\n`,
  },
  {
    id: 'voxel-drift',
    varName: 'voxelDrift',
    folder: 'voxel-drift',
    start: 3136,
    end: 3451,
    imports: `import { env } from '../../core/env.js';\nimport { hash } from '../../core/sat.js';\n`,
  },
  {
    id: 'tracking-v2',
    varName: 'trackingV2',
    folder: 'tracking-v2',
    start: 3452,
    end: 4594,
    imports: `import { env, TAU } from '../../core/env.js';\n`,
  },
  {
    id: 'pixel-trail',
    varName: 'pixelTrail',
    folder: 'pixel-trail',
    start: 4595,
    end: 5045,
    imports: `import { env, TAU } from '../../core/env.js';\n`,
  },
  {
    id: 'pixel-beams',
    varName: 'pixelBeams',
    folder: 'pixel-beams',
    start: 5046,
    end: 6069,
    imports: `import { env, TAU } from '../../core/env.js';\n`,
  },
  {
    id: 'depth-map',
    varName: 'depthMap',
    folder: 'depth-map',
    start: 6199,
    end: 6867,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram } from '../../core/webgl.js';\n`,
  },
  {
    id: 'heatmap',
    varName: 'heatmap',
    folder: 'heatmap',
    start: 6868,
    end: 7714,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
  {
    id: 'liquid-metal',
    varName: 'liquidMetal',
    folder: 'liquid-metal',
    start: 7715,
    end: 8040,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
  {
    id: 'sx-chrome',
    varName: 'chrome',
    folder: 'chrome',
    start: 8385,
    end: 8488,
    imports: `import { makeShapeEffect } from '../../core/webgl.js';\n`,
  },
  {
    id: 'sx-liquid-metal',
    varName: 'sxLiquidMetal',
    folder: 'sx-liquid-metal',
    start: 8489,
    end: 8610,
    imports: `import { makeShapeEffect } from '../../core/webgl.js';\n`,
  },
  {
    id: 'gem-smoke',
    varName: 'gemSmoke',
    folder: 'gem-smoke',
    start: 8611,
    end: 8969,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
  {
    id: 'halftone-cmyk',
    varName: 'halftoneCMYK',
    folder: 'halftone-cmyk',
    start: 8970,
    end: 9240,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
  {
    id: 'halftone-dots',
    varName: 'halftoneDots',
    folder: 'halftone-dots',
    start: 9241,
    end: 9615,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
  {
    id: 'lens-distortion',
    varName: 'lensDistortion',
    folder: 'lens-distortion',
    start: 9616,
    end: 10155,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram } from '../../core/webgl.js';\n`,
  },
  {
    id: 'dithering',
    varName: 'dithering',
    folder: 'dithering',
    start: 10156,
    end: 10495,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram } from '../../core/webgl.js';\n`,
  },
  {
    id: 'paper-texture',
    varName: 'paperTexture',
    folder: 'paper-texture',
    start: 10496,
    end: 11526,
    imports: `import { env } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';\n`,
  },
];

const effectsDir = path.join(__dirname, '..', 'src', 'effects');
fs.mkdirSync(effectsDir, { recursive: true });

effectsMeta.forEach((meta) => {
  const targetDir = path.join(effectsDir, meta.folder);
  fs.mkdirSync(targetDir, { recursive: true });

  let code = getLines(meta.start, meta.end);

  // In original code, `ctx` and `canvas` were globals. Now they can be accessed via `env.ctx` or `env.canvas`
  // if `const { ctx } = env` or `env.ctx` is used. But wait, in 2D canvas effects:
  // let's check if `ctx` is referenced directly as `ctx.something` without `const { ctx } = env`.
  // To ensure 100% safety, in 2D effects that use `ctx.`, we can add `const ctx = env.ctx;` or `const { ctx, canvas } = env;`
  // or define getter `const ctx = env.ctx` at module top!
  const modulePreamble = `const ctx = new Proxy({}, { get: (_, prop) => (typeof env.ctx[prop] === 'function' ? env.ctx[prop].bind(env.ctx) : env.ctx[prop]), set: (_, prop, val) => { env.ctx[prop] = val; return true; } });\nconst canvas = new Proxy({}, { get: (_, prop) => env.canvas[prop], set: (_, prop, val) => { env.canvas[prop] = val; return true; } });\n`;

  const finalCode = `${meta.imports}\n${modulePreamble}\n${code}\n\nexport default ${meta.varName};\nexport { ${meta.varName} };\n`;

  fs.writeFileSync(path.join(targetDir, 'index.js'), finalCode, 'utf8');
  console.log(`Created ${meta.folder}/index.js (${code.length} bytes)`);
});
