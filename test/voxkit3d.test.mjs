/* Fast checks for the 3D voxel character kit (src/engine/65-voxkit3d.js + 66-characters3d.js).
   The engine modules are plain browser scripts, so they run here in a vm context with the vendored Three.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

class EngineSandbox {
  constructor(files) {
    this.ctx = vm.createContext({ console, Math, performance: { now: () => 0 } });
    this.ctx.window = this.ctx; this.ctx.self = this.ctx; this.ctx.globalThis = this.ctx;
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), this.ctx, { filename: f });
  }
  get KV() { return this.ctx.KV; }
}

const box = new EngineSandbox(['vendor/three/three.min.js', 'engine/65-voxkit3d.js', 'engine/66-characters3d.js']);
const { VoxelPart, VoxelMesher, CharacterSculptor } = box.KV;
const RED = [1, 0, 0];
const faces = (part) => new VoxelMesher().mesh(part, 1, [0, 0, 0]).index.count / 6; // 2 triangles = 6 indices per face

// risk: render cost / visual holes. The mesher must emit exactly the exposed faces, no hidden interior ones.
test('mesher emits only exposed faces: 2x2x2 cube has 24, a lone voxel 6', () => {
  assert.equal(faces(new VoxelPart('a').box(0, 1, 0, 1, 0, 1, RED)), 24);
  assert.equal(faces(new VoxelPart('b').set(0, 0, 0, RED)), 6);
});

test('mesher hides faces between touching voxels and skips hollows (L-shape and 3x3x3 with a hole in the core)', () => {
  const L = new VoxelPart('L').set(0, 0, 0, RED).set(1, 0, 0, RED).set(0, 1, 0, RED);
  assert.equal(faces(L), 3 * 6 - 2 * 2); // two shared contacts hide 4 faces
  const shell = new VoxelPart('s').box(0, 2, 0, 2, 0, 2, RED).set(1, 1, 1, null); // sealed hollow: inner walls are exposed to the hole
  assert.equal(faces(shell), 9 * 6 + 6);
  const geo = new VoxelMesher().mesh(shell, 1, [0, 0, 0]);
  assert.equal(geo.attributes.position.count, faces(shell) * 4);
});

// risk: animation breakage. Every character must build with the bones the animator and play view drive.
test('each character builds a rig with the expected bone hierarchy', () => {
  const want = { knight: 10, ranger: 9, mage: 9, troll: 8 }; // bones per character (one per rigid part)
  for (const role of Object.keys(want)) {
    const model = CharacterSculptor.build(role), names = model.boneNames;
    assert.equal(names.length, want[role], `${role} bone count`);
    assert.equal(new Set(names).size, names.length, `${role} has duplicate bone names`);
    for (const p of model.parts.values()) if (p.parent) assert.ok(model.parts.has(p.parent), `${role}.${p.name} parent ${p.parent} missing`);
    assert.ok(model.voxelCount > 100 && model.tris > 0 && model.height > 0, `${role} built empty`);
  }
});
