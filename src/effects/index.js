/**
 * Central Effects Registry
 * Exports all active visual effects in the studio pipeline.
 */

import { quadtreeBokeh } from './quadtree-bokeh/index.js'
import { blobTracker } from './blob-tracker/index.js'
import { voxelDrift } from './voxel-drift/index.js'
import { depthMap } from './depth-map/index.js'
import { pixelTrail } from './pixel-trail/index.js'
import { pixelBeams } from './pixel-beams/index.js'
import { heatmap } from './heatmap/index.js'
import { liquidMetal } from './liquid-metal/index.js'
import { sxLiquidMetal } from './sx-liquid-metal/index.js'
import { chrome } from './chrome/index.js'
import { gemSmoke } from './gem-smoke/index.js'
import { halftoneCMYK } from './halftone-cmyk/index.js'
import { halftoneDots } from './halftone-dots/index.js'
import { lensDistortion } from './lens-distortion/index.js'
import { dithering } from './dithering/index.js'
import { paperTexture } from './paper-texture/index.js'

export const effects = [
  quadtreeBokeh,
  blobTracker,
  voxelDrift,
  // depthMap,
  pixelTrail,
  pixelBeams,
  heatmap,
  // liquidMetal,
  // sxLiquidMetal,
  // chrome,
  // gemSmoke,
  halftoneCMYK,
  halftoneDots,
  lensDistortion,
  dithering,
  // paperTexture,
]

export {
  quadtreeBokeh,
  blobTracker,
  voxelDrift,
  depthMap,
  pixelTrail,
  pixelBeams,
  heatmap,
  liquidMetal,
  sxLiquidMetal,
  chrome,
  gemSmoke,
  halftoneCMYK,
  halftoneDots,
  lensDistortion,
  dithering,
  paperTexture,
}
