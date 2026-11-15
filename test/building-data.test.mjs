/* Building data remains compatible after class/config module extraction. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class BuildingDataSandbox {
  constructor() {
    this.context = vm.createContext({ console, Math, JSON, Object, Map, Set, Uint8Array, Int8Array, Int16Array,
      btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
      atob: (value) => Buffer.from(value, 'base64').toString('binary') });
    this.context.window = this.context;
    this.context.globalThis = this.context;
    this.context.K = {};
    for (const file of [
      '11-core.js', '13-textures.js', '20-world.js', '71-building-prefabs.js',
      '71-building-data.js', '71-building-layout.js',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, 'src/engine', file), 'utf8');
      vm.runInContext(source, this.context, { filename: file });
    }
  }
}

// risk: save-data compatibility; a prefab must normalize and survive the real world-document serializer.
test('building prefab creates normalized furniture and survives a v2 world round trip', () => {
  const sandbox = new BuildingDataSandbox(), K = sandbox.context.K;
  const world = new K.WorldDoc(32, 24, { seed: 41 });
  const cottage = K.makeBuilding('cottage', 3, 4, 'cottage-test', world.seed);
  assert.equal(cottage.prefab, 'cottage');
  assert.ok(cottage.furniture.some((item) => item.type === 'hearth'));
  world.objects.push(cottage);

  const saved = world.toJSON();
  assert.equal(saved.version, 2);
  const loaded = K.WorldDoc.fromJSON(saved);
  assert.equal(loaded.buildings()[0].id, 'cottage-test');
  assert.deepEqual(Array.from(loaded.buildings()[0].furniture.map((item) => item.type)),
    Array.from(cottage.furniture.map((item) => item.type)));
});
