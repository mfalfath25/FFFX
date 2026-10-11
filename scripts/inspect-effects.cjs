const fs = require('fs');
const path = require('path');

const file = fs.readFileSync(path.join(__dirname, '..', 'do-not-touch', 'index.html'), 'utf8');
const lines = file.split('\n');

const effectMarkers = [
  { name: 'quadtreeBokeh', startPattern: /const quadtreeBokeh = \{/ },
  { name: 'blobTracker', startPattern: /const blobTracker = \{/ },
  { name: 'voxelDrift', startPattern: /const voxelDrift = \{/ },
  { name: 'trackingV2', startPattern: /const trackingV2 = \{/ },
  { name: 'pixelTrail', startPattern: /const pixelTrail = \{/ },
  { name: 'pixelBeams', startPattern: /const pixelBeams = \{/ },
  { name: 'depthMap', startPattern: /const depthMap = \{/ },
  { name: 'heatmap', startPattern: /const heatmap = \{/ },
  { name: 'liquidMetal', startPattern: /const liquidMetal = \{/ },
  { name: 'chrome', startPattern: /const chrome = makeShapeEffect\(\{/ },
  { name: 'sxLiquidMetal', startPattern: /const sxLiquidMetal = makeShapeEffect\(\{/ },
  { name: 'gemSmoke', startPattern: /const gemSmoke = \{/ },
  { name: 'halftoneCMYK', startPattern: /const halftoneCMYK = \{/ },
  { name: 'halftoneDots', startPattern: /const halftoneDots = \{/ },
  { name: 'lensDistortion', startPattern: /const lensDistortion = \{/ },
  { name: 'dithering', startPattern: /const dithering = \{/ },
  { name: 'paperTexture', startPattern: /const paperTexture = \{/ },
  { name: 'effectsArray', startPattern: /const effects = \[/ },
];

effectMarkers.forEach(m => {
  const lineIdx = lines.findIndex(l => m.startPattern.test(l));
  console.log(`${m.name.padEnd(16)}: line ${lineIdx + 1}`);
});
