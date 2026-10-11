const fs = require('fs');
const path = require('path');

// Mock DOM environment
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 960,
        height: 640,
        getContext: (type) => {
          if (type.includes('webgl')) {
            return {
              createBuffer: () => ({}),
              bindBuffer: () => {},
              bufferData: () => {},
              createTexture: () => ({}),
              bindTexture: () => {},
              texParameteri: () => {},
              texImage2D: () => {},
              createShader: () => ({}),
              shaderSource: () => {},
              compileShader: () => {},
              getShaderParameter: () => true,
              createProgram: () => ({}),
              attachShader: () => {},
              linkProgram: () => {},
              getProgramParameter: () => true,
              getAttribLocation: () => 0,
              getUniformLocation: () => ({}),
              useProgram: () => {},
              viewport: () => {},
              enableVertexAttribArray: () => {},
              vertexAttribPointer: () => {},
              activeTexture: () => {},
              uniform1i: () => {},
              uniform2f: () => {},
              uniform1f: () => {},
              uniform3f: () => {},
              uniform4f: () => {},
              uniform1fv: () => {},
              uniform2fv: () => {},
              uniform3fv: () => {},
              uniform4fv: () => {},
              uniform1iv: () => {},
              uniform2iv: () => {},
              uniform3iv: () => {},
              uniform4iv: () => {},
              uniformMatrix3fv: () => {},
              uniformMatrix4fv: () => {},
              drawArrays: () => {},
              deleteShader: () => {},
              deleteProgram: () => {},
              deleteBuffer: () => {},
              deleteTexture: () => {},
              getShaderInfoLog: () => '',
              getProgramInfoLog: () => '',
            };
          }
          return {
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            scale: () => {},
            beginPath: () => {},
            closePath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            arc: () => {},
            clip: () => {},
            quadraticCurveTo: () => {},
            bezierCurveTo: () => {},
            setLineDash: () => {},
            getLineDash: () => [],
            clearRect: () => {},
            roundRect: () => {},
            ellipse: () => {},
            rect: () => {},
            strokeRect: () => {},
            fillRect: () => {},
            stroke: () => {},
            fill: () => {},
            fillText: () => {},
            measureText: () => ({ width: 10 }),
            drawImage: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(960 * 640 * 4) }),
            putImageData: () => {},
            createImageData: () => ({ data: new Uint8ClampedArray(960 * 640 * 4) }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
          };
        }
      };
    }
    return {
      appendChild: () => {},
      addEventListener: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      style: {},
      setAttribute: () => {},
    };
  },
  getElementById: (id) => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {},
    setAttribute: () => {},
    getContext: () => ({
      save: () => {},
      restore: () => {},
      drawImage: () => {},
      fillRect: () => {},
      beginPath: () => {},
      stroke: () => {},
      fill: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(960 * 640 * 4) }),
    })
  }),
  querySelectorAll: () => [],
};
global.window = global;
global.performance = { now: () => Date.now() };
global.Image = class {
  constructor() {
    this.width = 960;
    this.height = 640;
  }
};
global.URL = { createObjectURL: () => '', revokeObjectURL: () => {} };

async function runTest() {
  const { env, initEnv } = await import('../src/core/env.js');
  const canvas = global.document.createElement('canvas');
  initEnv({ canvas });

  const { buildTables } = await import('../src/core/sat.js');
  buildTables({ data: new Uint8ClampedArray(960 * 640 * 4) });

  const { effects } = await import('../src/effects/index.js');
  const { globalParameterStore } = await import('../src/ui/headless/store.js');

  for (const effect of effects) {
    const defaults = {};
    const grps = effect.getGroups ? effect.getGroups(defaults) : effect.groups || [];
    grps.forEach(g => g.controls.forEach(c => {
      defaults[c.key] = c.value !== undefined ? c.value : null;
    }));
    globalParameterStore.initEffect(effect.id, defaults);

    try {
      const v = globalParameterStore.getEffectValues(effect.id);
      const res = effect.draw(v, 0.016);
      console.log(`[OK] ${effect.id}: ${res}`);
    } catch (err) {
      console.error(`[ERROR] ${effect.id}:`, err);
    }
  }
}

runTest().catch(console.error);
