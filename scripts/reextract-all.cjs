const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcHtml = fs.readFileSync(path.join(__dirname, '..', 'do-not-touch', 'index.html'), 'utf8');
const lines = srcHtml.split('\n');

function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const effectsMeta = [
  {
    varName: 'quadtreeBokeh',
    folder: 'quadtree-bokeh',
    start: 954,
    end: 1213,
    imports: `import { env, canvas, ctx, ROOT, TAU } from '../../core/env.js';\nimport { rectSum, lumaStdDev, hash } from '../../core/sat.js';`,
  },
  {
    varName: 'blobTracker',
    folder: 'blob-tracker',
    start: 1227,
    end: 3127,
    imports: `import { env, canvas, ctx, TAU } from '../../core/env.js';\nimport { hash } from '../../core/sat.js';`,
  },
  {
    varName: 'voxelDrift',
    folder: 'voxel-drift',
    start: 3136,
    end: 3449,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { hash } from '../../core/sat.js';`,
  },
  {
    varName: 'trackingV2',
    folder: 'tracking-v2',
    start: 3464,
    end: 4592,
    imports: `import { env, canvas, ctx, TAU } from '../../core/env.js';`,
  },
  {
    varName: 'pixelTrail',
    folder: 'pixel-trail',
    start: 4600,
    end: 5043,
    imports: `import { env, canvas, ctx, TAU } from '../../core/env.js';`,
  },
  {
    varName: 'pixelBeams',
    folder: 'pixel-beams',
    start: 5046,
    end: 6065,
    imports: `import { env, canvas, ctx, TAU } from '../../core/env.js';`,
  },
  {
    varName: 'depthMap',
    folder: 'depth-map',
    start: 6206,
    end: 6868,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram } from '../../core/webgl.js';`,
  },
  {
    varName: 'heatmap',
    folder: 'heatmap',
    start: 6875,
    end: 7713,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'liquidMetal',
    folder: 'liquid-metal',
    start: 7719,
    end: 8040,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'chrome',
    folder: 'chrome',
    start: 8386,
    end: 8487,
    imports: `import { makeShapeEffect } from '../../core/webgl.js';`,
  },
  {
    varName: 'sxLiquidMetal',
    folder: 'sx-liquid-metal',
    start: 8490,
    end: 8609,
    imports: `import { makeShapeEffect } from '../../core/webgl.js';`,
  },
  {
    varName: 'gemSmoke',
    folder: 'gem-smoke',
    start: 8615,
    end: 8968,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'halftoneCMYK',
    folder: 'halftone-cmyk',
    start: 8978,
    end: 9238,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'halftoneDots',
    folder: 'halftone-dots',
    start: 9244,
    end: 9516,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'lensDistortion',
    folder: 'lens-distortion',
    start: 9518,
    end: 10155,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram } from '../../core/webgl.js';`,
  },
  {
    varName: 'dithering',
    folder: 'dithering',
    start: 10161,
    end: 10494,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
  {
    varName: 'paperTexture',
    folder: 'paper-texture',
    start: 10502,
    end: 11525,
    imports: `import { env, canvas, ctx } from '../../core/env.js';\nimport { getWebGL, getOrCreateProgram, hexToRgb } from '../../core/webgl.js';`,
  },
];

const effectsDir = path.join(__dirname, '..', 'src', 'effects');
fs.mkdirSync(effectsDir, { recursive: true });

effectsMeta.forEach((meta) => {
  const targetDir = path.join(effectsDir, meta.folder);
  fs.mkdirSync(targetDir, { recursive: true });

  const rawSnippet = getLines(meta.start, meta.end);

  const fileContent = `${meta.imports}

${rawSnippet}

export default ${meta.varName};
export { ${meta.varName} };
`;

  fs.writeFileSync(path.join(targetDir, 'index.js'), fileContent, 'utf8');

  // Validate syntax
  try {
    // Replace import/export for syntax test in vm.Script
    const testCode = fileContent
      .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+default\s+[^;]+;?/g, '')
      .replace(/export\s+\{[^}]+\};?/g, '');
    new vm.Script(testCode);
    console.log(`[PASS] ${meta.folder}/index.js parsed successfully!`);
  } catch (err) {
    console.error(`[FAIL] ${meta.folder}/index.js syntax error:`, err.message);
  }
});
