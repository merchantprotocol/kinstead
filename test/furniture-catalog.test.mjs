/* Exercise every furniture builder through its real catalogue entry point. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class Matrix4Stub {
  makeRotationY() { return this; }
  makeRotationX() { return this; }
  makeRotationZ() { return this; }
  makeTranslation() { return this; }
  makeScale() { return this; }
  makeRotationFromEuler() { return this; }
  setPosition() { return this; }
  multiply() { return this; }
}

class FurnitureKit {
  constructor() { this.operations = 0; }
  box() { this.operations++; return this; }
  geo() { this.operations++; return this; }
  quad() { this.operations++; return this; }
  push() { return this; }
  pop() { return this; }
}

class FurnitureSandbox {
  constructor() {
    const K = { VoxKit: { CYL: {}, CYL8: {} } };
    this.context = vm.createContext({ K, THREE: { Matrix4: Matrix4Stub,
      Euler: class {}, SphereGeometry: class {} }, console, Math });
    this.context.window = this.context;
    this.context.globalThis = this.context;
    const files = ['73-furniture-tools.js', '73-furniture-bedroom.js', '73-furniture-armory.js',
      '73-furniture-kitchen.js', '73-furniture-smithy.js', '73-furniture-stable.js',
      '73-furniture-study.js', '73-furniture-decor.js', '73-furniture-bakery.js',
      '73-furniture-shops.js', '73-furniture-butcher.js', '73-furniture-alchemist.js',
      '73-furniture-market-goods.js', '73-furniture.js'];
    for (const file of files) {
      const source = fs.readFileSync(path.join(ROOT, 'src/engine', file), 'utf8');
      vm.runInContext(source, this.context, { filename: file });
    }
  }
}

// risk: model availability; a missing helper or broken builder would leave placed furniture invisible.
test('every furniture catalogue entry builds geometry using its registered group class', () => {
  const { K } = new FurnitureSandbox().context;
  assert.ok(Object.keys(K.FURNITURE).length > 40);
  for (const [type, def] of Object.entries(K.FURNITURE)) {
    assert.equal(typeof def.build, 'function', `${type} has a builder`);
    const kit = new FurnitureKit();
    def.build(kit, { state: { kind: 'wood' } }, def);
    assert.ok(kit.operations > 0, `${type} emitted no furniture geometry`);
  }
});
