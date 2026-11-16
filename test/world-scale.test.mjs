/* World-scale persistence bounds for the Redwood world expansion. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console, Math, Uint8Array, Int8Array, Float32Array, Uint32Array, btoa, atob });
context.window = context; context.globalThis = context;
for (const name of ['11-core.js', '13-textures.js', '20-world.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src/engine', name), 'utf8'), context, { filename: name });
}
const K = context.K;

// risk: world data loss/crash. Large-world saves must round-trip dimensions and tile layers.
test('world documents round-trip at the 1280x960 Redwood dimensions', () => {
  const world = new K.WorldDoc(1280, 960, { name: 'Redwood scale fixture' });
  world.terrain[world.terrain.length - 1] = K.T.ROCK;
  world.height[world.height.length - 1] = 7;
  const loaded = K.WorldDoc.fromJSON(world.toJSON());
  assert.equal(loaded.w, 1280);
  assert.equal(loaded.h, 960);
  assert.equal(loaded.terrain.at(-1), K.T.ROCK);
  assert.equal(loaded.height.at(-1), 7);
});

// risk: backwards compatibility. Existing worlds at the original builder limit remain loadable.
test('the previous 512-tile document limit remains supported', () => {
  const world = new K.WorldDoc(512, 512);
  const loaded = K.WorldDoc.fromJSON(world.toJSON());
  assert.equal(loaded.w, 512);
  assert.equal(loaded.h, 512);
});
