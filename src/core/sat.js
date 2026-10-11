import { env } from './env.js';

/**
 * Builds summed-area tables for fast O(1) rectangular box filters and standard deviation.
 * @param {ImageData} imageData 
 */
export function buildTables(imageData) {
  const { W, H } = env;
  const data = imageData.data;
  const stride = W + 1;
  const size = stride * (H + 1);
  const r = new Float64Array(size);
  const g = new Float64Array(size);
  const b = new Float64Array(size);
  const l = new Float64Array(size);
  const l2 = new Float64Array(size);

  for (let y = 0; y < H; y++) {
    let rr = 0,
      gg = 0,
      bb = 0,
      ll = 0,
      ll2 = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      rr += data[i];
      gg += data[i + 1];
      bb += data[i + 2];
      ll += luma;
      ll2 += luma * luma;
      const idx = (y + 1) * stride + (x + 1);
      const up = y * stride + (x + 1);
      r[idx] = r[up] + rr;
      g[idx] = g[up] + gg;
      b[idx] = b[up] + bb;
      l[idx] = l[up] + ll;
      l2[idx] = l2[up] + ll2;
    }
  }
  env.sat = { r, g, b, l, l2, stride };
}

/**
 * Calculates sum over a square region using SAT in O(1) time
 */
export function rectSum(table, x, y, s) {
  const st = env.sat.stride;
  return (
    table[(y + s) * st + (x + s)] -
    table[y * st + (x + s)] -
    table[(y + s) * st + x] +
    table[y * st + x]
  );
}

/**
 * Calculates standard deviation of luminance in a square region
 */
export function lumaStdDev(x, y, s) {
  const n = s * s;
  const mean = rectSum(env.sat.l, x, y, s) / n;
  const variance = rectSum(env.sat.l2, x, y, s) / n - mean * mean;
  return Math.sqrt(Math.max(0, variance));
}

/**
 * Fast deterministic integer hash
 */
export function hash(x, y, s) {
  let h =
    Math.imul(x, 374761393) +
    Math.imul(y, 668265263) +
    Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
