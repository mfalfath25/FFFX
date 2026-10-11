const fs = require('fs');
const path = require('path');

global.document = {
  createElement: () => ({ getContext: () => ({}) })
};
global.window = global;
global.performance = { now: () => Date.now() };

// Test importing effects and checking their defaults
async function test() {
  const { effects } = await import('../src/effects/index.js');
  console.log(`Total effects: ${effects.length}`);

  const values = {};
  effects.forEach(effect => {
    values[effect.id] = {};
    const grps = effect.getGroups ? effect.getGroups(values[effect.id]) : (effect.groups || []);
    if (!grps) {
      console.error(`Effect ${effect.id} has NO groups!`);
      return;
    }
    grps.forEach(g => {
      if (!g.controls) {
        console.error(`Group ${g.title} in ${effect.id} has no controls!`);
        return;
      }
      g.controls.forEach(c => {
        values[effect.id][c.key] = c.value !== undefined ? c.value : null;
      });
    });
    console.log(`Effect ${effect.id}: ${Object.keys(values[effect.id]).length} controls. Keys:`, Object.keys(values[effect.id]).slice(0, 5).join(', '));
  });
}

test().catch(err => console.error(err));
