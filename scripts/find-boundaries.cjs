const fs = require('fs');
const path = require('path');

const srcHtml = fs.readFileSync(path.join(__dirname, '..', 'do-not-touch', 'index.html'), 'utf8');
const lines = srcHtml.split('\n');

const list = [
  { name: 'quadtreeBokeh', startText: 'const quadtreeBokeh = {' },
  { name: 'blobTracker', startText: 'const blobTracker = {' },
  { name: 'voxelDrift', startText: 'const voxelDrift = {' },
  { name: 'trackingV2', startText: 'const trackingV2 = {' },
  { name: 'pixelTrail', startText: 'const pixelTrail = {' },
  { name: 'pixelBeams', startText: 'const BAYER2_DATA = [' },
  { name: 'depthMap', startText: 'const depthMapFS = `#version 300 es' },
  { name: 'heatmap', startText: 'const heatmapFS = `#version 300 es' },
  { name: 'liquidMetal', startText: 'const liquidMetalFS = `' },
  { name: 'chrome', startText: 'const chromeFS = `' },
  { name: 'sxLiquidMetal', startText: 'const sxLiquidMetalFS = `' },
  { name: 'gemSmoke', startText: 'const gemSmokeFS = `' },
  { name: 'halftoneCMYK', startText: 'const halftoneCMYKFS = `' },
  { name: 'halftoneDots', startText: 'const halftoneDotsFS = `' },
  { name: 'lensDistortion', startText: 'const lensDistortionFS = `#version 300 es' },
  { name: 'dithering', startText: 'const ditheringFS = `' },
  { name: 'paperTexture', startText: 'const paperTextureFS = `#version 300 es' },
  { name: 'effectsArray', startText: 'const effects = [' }
];

const ranges = [];
for (let i = 0; i < list.length - 1; i++) {
  const cur = list[i];
  const next = list[i + 1];
  const startIdx = lines.findIndex(l => l.includes(cur.startText));
  const nextIdx = lines.findIndex(l => l.includes(next.startText));
  
  // Back up from nextIdx to find the last closing brace or line of cur
  let endIdx = nextIdx - 1;
  while (endIdx > startIdx && lines[endIdx].trim() === '' || lines[endIdx].trim().startsWith('//')) {
    endIdx--;
  }
  ranges.push({
    name: cur.name,
    startLine: startIdx + 1,
    endLine: endIdx + 1,
    startCode: lines[startIdx].trim().slice(0, 40),
    endCode: lines[endIdx].trim()
  });
}

ranges.forEach(r => {
  console.log(`${r.name.padEnd(16)}: lines ${r.startLine} - ${r.endLine} | end: ${r.endCode}`);
});
