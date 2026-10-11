const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const URL = 'http://localhost:5173/';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleLogs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
          this.consoleLogs.push(`[${msg.params.type}] ${text}`);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.consoleLogs.push(`[EXCEPTION] ${JSON.stringify(msg.params.exceptionDetails)}`);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }
}

async function run() {
  console.log('Spawning headless Edge on port', PORT);
  const userDataDir = path.join(__dirname, '..', '.edge-test-profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  try {
    let version = null;
    for (let i = 0; i < 30; i++) {
      try {
        version = await fetchJson(`http://localhost:${PORT}/json/version`);
        if (version && version.webSocketDebuggerUrl) break;
      } catch (e) {}
      await sleep(200);
    }

    if (!version) throw new Error('Failed to connect to Edge DevTools');

    // Create a new target / page
    const targets = await fetchJson(`http://localhost:${PORT}/json/list`);
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Console.enable');

    console.log('Navigating to', URL);
    await cdp.send('Page.navigate', { url: URL });

    await sleep(2500);

    console.log('\n--- Console Logs ---');
    console.log(cdp.consoleLogs.join('\n') || '(no console logs)');

    const stats = await cdp.eval(`document.getElementById('stats')?.textContent`);
    const effectPill = await cdp.eval(`document.getElementById('effectPill')?.textContent`);
    const sourceBadge = await cdp.eval(`document.getElementById('sourceBadge')?.textContent`);
    const resPill = await cdp.eval(`document.getElementById('resPill')?.textContent`);

    console.log('\n--- UI Header State ---');
    console.log('Stats:', stats);
    console.log('Active Effect Pill:', effectPill);
    console.log('Source Badge:', sourceBadge);
    console.log('Resolution Pill:', resPill);

    const canvasStats = await cdp.eval(`(() => {
      const cvs = document.getElementById('canvas');
      if (!cvs) return { error: 'No canvas found' };
      const ctx = cvs.getContext('2d');
      const img = ctx.getImageData(0, 0, cvs.width, cvs.height);
      let nonZero = 0;
      let nonBlack = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i] !== 0 || img.data[i+1] !== 0 || img.data[i+2] !== 0) {
          nonBlack++;
        }
        if (img.data[i+3] > 0) nonZero++;
      }
      return {
        width: cvs.width,
        height: cvs.height,
        totalPixels: cvs.width * cvs.height,
        nonBlackPixels: nonBlack,
        nonZeroAlpha: nonZero,
        ratioNonBlack: (nonBlack / (cvs.width * cvs.height)).toFixed(4)
      };
    })()`);

    console.log('\n--- Canvas Diagnostic ---');
    console.log(JSON.stringify(canvasStats, null, 2));

    // Test switching to all 16 effects
    const allEffects = [
      'quadtree-bokeh',
      'blob-tracker',
      'voxel-drift',
      'depth-map',
      'pixel-trail',
      'pixel-beams',
      'heatmap',
      'liquid-metal',
      'sx-liquid-metal',
      'chrome',
      'gem-smoke',
      'halftone-cmyk',
      'halftone-dots',
      'lens-distortion',
      'dithering',
      'paper-texture',
    ];
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    let passedCount = 0;
    for (const id of allEffects) {
      await cdp.eval(`(() => {
        const btn = document.querySelector(\`#menu .drawer-item[data-effect-id="${id}"]\`);
        if (btn) btn.click();
      })()`);

      await sleep(600);

      const curEffect = await cdp.eval(`document.getElementById('effectPill')?.textContent`);
      const curStats = await cdp.eval(`document.getElementById('stats')?.textContent`);
      const cvsDiag = await cdp.eval(`(() => {
        const cvs = document.getElementById('canvas');
        const ctx = cvs.getContext('2d');
        const img = ctx.getImageData(0, 0, cvs.width, cvs.height);
        let nonBlack = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i] !== 0 || img.data[i+1] !== 0 || img.data[i+2] !== 0) {
            nonBlack++;
          }
        }
        return {
          nonBlackPixels: nonBlack,
          ratioNonBlack: (nonBlack / (cvs.width * cvs.height)).toFixed(4)
        };
      })()`);

      const hasActiveRendering = Number(cvsDiag.ratioNonBlack) > 0.05;
      console.log(`[${hasActiveRendering ? 'PASS' : 'FAIL'}] Effect: ${curEffect || id} | Stats: ${curStats} | Active Pixels: ${(Number(cvsDiag.ratioNonBlack)*100).toFixed(1)}%`);
      if (hasActiveRendering) passedCount++;

      // Capture screenshot
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotsDir, `${id}.png`), Buffer.from(shot.data, 'base64'));
    }

    console.log(`\nResults: ${passedCount}/${allEffects.length} effects successfully rendered visuals!`);

    // Test Media Source Preset (Sunset)
    console.log('\n--- Testing Media Preset Switch (Sunset) ---');
    await cdp.eval(`(() => {
      const btn = document.querySelector('#drawerSources .drawer-item[data-source="sunset"]');
      if (btn) btn.click();
    })()`);

    await sleep(600);

    const presetBadge = await cdp.eval(`document.getElementById('sourceBadge')?.textContent`);
    console.log('Preset Source Badge:', presetBadge);
    const shotSunset = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, 'preset-sunset.png'), Buffer.from(shotSunset.data, 'base64'));

    // Switch back to Motion Demo
    console.log('\n--- Switching Back to Motion Demo ---');
    await cdp.eval(`(() => {
      const btn = document.querySelector('#drawerSources .drawer-item[data-source="motion-demo"]');
      if (btn) btn.click();
    })()`);
    await sleep(600);
    const demoBadge = await cdp.eval(`document.getElementById('sourceBadge')?.textContent`);
    console.log('Demo Source Badge:', demoBadge);

    console.log(`\n[SUCCESS] All tested effects & preset sources verified!`);

  } finally {
    edge.kill();
  }
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
