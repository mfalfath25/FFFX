import { env, TAU } from './env.js';
import { buildTables } from './sat.js';

/**
 * Procedural Animated Motion Demo
 * Simulates high-action video footage with moving physics entities,
 * gradients, and glow effects.
 */
export function initMotionDemoState() {
  env.demoState = {
    entities: [
      {
        x: 180,
        y: 300,
        vx: 2.2,
        vy: 1.6,
        r: 42,
        color: '#00ff88',
        shape: 'orb',
      },
      {
        x: 500,
        y: 220,
        vx: -1.8,
        vy: 2.1,
        r: 55,
        color: '#ec4899',
        shape: 'box',
      },
      {
        x: 740,
        y: 400,
        vx: -2.4,
        vy: -1.5,
        r: 36,
        color: '#38bdf8',
        shape: 'orb',
      },
      {
        x: 380,
        y: 450,
        vx: 1.5,
        vy: -2.3,
        r: 48,
        color: '#fbbf24',
        shape: 'poly',
      },
    ],
    particles: [],
  };
}

export function updateAndDrawMotionDemo(dt) {
  if (!env.demoState) {
    initMotionDemoState();
  }

  const s = env.demoState;
  const c = env.sourceCtx;
  const { W, H } = env;

  c.fillStyle = '#06070c';
  c.fillRect(0, 0, W, H);

  c.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  c.lineWidth = 1;
  const gridSize = 40;
  const offset = (env.time * 20) % gridSize;
  c.beginPath();
  for (let x = offset; x < W; x += gridSize) {
    c.moveTo(x, 0);
    c.lineTo(x, H);
  }
  for (let y = offset; y < H; y += gridSize) {
    c.moveTo(0, y);
    c.lineTo(W, y);
  }
  c.stroke();

  s.entities.forEach((e) => {
    e.x += e.vx;
    e.y += e.vy;
    if (e.x - e.r < 0 || e.x + e.r > W) e.vx *= -1;
    if (e.y - e.r < 0 || e.y + e.r > H) e.vy *= -1;

    const grad = c.createRadialGradient(
      e.x,
      e.y,
      e.r * 0.2,
      e.x,
      e.y,
      e.r * 1.8
    );
    grad.addColorStop(0, e.color);
    grad.addColorStop(1, 'transparent');
    c.fillStyle = grad;
    c.beginPath();
    c.arc(e.x, e.y, e.r * 1.8, 0, TAU);
    c.fill();

    c.fillStyle = '#ffffff';
    c.strokeStyle = e.color;
    c.lineWidth = 3;
    if (e.shape === 'orb') {
      c.beginPath();
      c.arc(e.x, e.y, e.r * 0.6, 0, TAU);
      c.fill();
      c.stroke();
    } else if (e.shape === 'box') {
      const sz = e.r * 1.1;
      c.fillRect(e.x - sz / 2, e.y - sz / 2, sz, sz);
      c.strokeRect(e.x - sz / 2, e.y - sz / 2, sz, sz);
    } else {
      c.save();
      c.translate(e.x, e.y);
      c.rotate(env.time * 1.5);
      c.beginPath();
      const sides = 5;
      for (let i = 0; i < sides; i++) {
        const a = (i * TAU) / sides;
        const px = Math.cos(a) * e.r * 0.7;
        const py = Math.sin(a) * e.r * 0.7;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
  });

  const cur = env.cursor;
  if (env.cursorEnabled && performance.now() - cur.lastMoveAt < 4000) {
    const aura = c.createRadialGradient(
      cur.targetX,
      cur.targetY,
      5,
      cur.targetX,
      cur.targetY,
      75
    );
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    aura.addColorStop(0.3, 'rgba(124, 131, 255, 0.55)');
    aura.addColorStop(1, 'transparent');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cur.targetX, cur.targetY, 75, 0, TAU);
    c.fill();
  }

  buildTables(c.getImageData(0, 0, W, H));
}
