/* Fast checks for the Asset Lab model kit (src/engine/68-modelkit.js, 69-sculpt.js) and the models in src/models/.
   The engine modules are plain browser scripts, so they run here in a vm context with the vendored Three.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const MODELS = fs.readdirSync(path.join(SRC, 'models')).filter((n) => n.endsWith('.js')).sort().map((n) => 'models/' + n);

class EngineSandbox {
  constructor(files) {
    this.ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, Math, performance: { now: () => 0 } });
    this.ctx.window = this.ctx; this.ctx.self = this.ctx; this.ctx.globalThis = this.ctx;
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), this.ctx, { filename: f });
  }
}
const KIT = ['vendor/three/three.min.js', 'engine/65-voxkit3d.js', 'engine/66-characters3d.js', 'engine/67-actor3d.js', 'engine/68-modelkit.js', 'engine/69-sculpt.js'];
const box = new EngineSandbox([...KIT, ...MODELS]);
const { KV, K } = box.ctx;
const { VoxelPart, GreedyMesher, ModelRegistry, StaticVoxelModel, VoxelModel } = KV;
const RED = KV.Colour.hex('#ff0000'), BLUE = KV.Colour.hex('#0000ff'), LAMP = KV.Colour.glow('#ffcc66', 2.5);
const mesh = (p) => new GreedyMesher().meshAll(p, 1, [0, 0, 0]);
/* total quad area in voxel faces, from the emitted positions (each quad = 4 vertices) */
const area = (geo) => { if (!geo) return 0; const P = geo.attributes.position.array; let s = 0; for (let i = 0; i < P.length; i += 12) { const a = [P[i + 3] - P[i], P[i + 4] - P[i + 1], P[i + 5] - P[i + 2]], b = [P[i + 9] - P[i], P[i + 10] - P[i + 1], P[i + 11] - P[i + 2]]; const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; s += Math.hypot(...c); } return Math.round(s); };

// risk: render cost. Flat same-colour faces with flat AO must merge into one quad per side.
test('greedy mesher merges a 2x2x2 cube into 6 quads but still counts 24 exposed faces', () => {
  const r = mesh(new VoxelPart('a').box(0, 1, 0, 1, 0, 1, RED));
  assert.equal(r.faces, 24); assert.equal(r.quads, 6);
  assert.equal(r.body.attributes.position.count, 6 * 4); assert.equal(r.body.index.count, 6 * 6);
  assert.equal(area(r.body), 24);
});

// risk: visual holes / hidden faces. Only exposed faces, sealed hollows included, and nothing double-counted.
test('greedy mesher emits only exposed faces (lone voxel, sealed hollow) and covers exactly their area', () => {
  const one = mesh(new VoxelPart('b').set(0, 0, 0, RED)); assert.equal(one.faces, 6); assert.equal(one.quads, 6);
  const shell = mesh(new VoxelPart('s').box(0, 2, 0, 2, 0, 2, RED).set(1, 1, 1, null));
  assert.equal(shell.faces, 9 * 6 + 6); assert.equal(shell.quads, 12); assert.equal(area(shell.body), 60);
});

// risk: wrong colours. Different colours never merge into one quad.
test('greedy mesher keeps colours apart: a red-red-blue bar is 10 quads (2 per long side + 2 ends)', () => {
  const r = mesh(new VoxelPart('bar').set(0, 0, 0, RED).set(1, 0, 0, RED).set(2, 0, 0, BLUE));
  assert.equal(r.faces, 14); assert.equal(r.quads, 10); assert.equal(area(r.body), 14);
});

// risk: AO smearing. Faces whose corners have different AO must stay single quads (no stretched shading).
test('greedy mesher does not merge faces with uneven ambient occlusion, and the quads still cover every face', () => {
  const p = new VoxelPart('L').box(0, 4, 0, 0, 0, 4, RED).set(2, 1, 2, RED); // a slab with one voxel on top
  const r = mesh(p);
  assert.equal(r.faces, 25 * 2 + 5 * 4 + 5 - 1); // slab: top+bottom+4 sides, the bump: 5 faces, minus the covered top face
  assert.equal(area(r.body), r.faces);
  assert.ok(r.quads > 6 + 5, 'the occluded ring around the bump must not merge');
  // a random blob: quads always cover exactly the exposed faces
  const blob = new VoxelPart('blob').ellipsoid(0, 0, 0, 6, 4, 5, (x, y, z) => ((x + y + z) % 3 === 0 ? BLUE : RED));
  const rb = mesh(blob); assert.equal(area(rb.body), rb.faces); assert.ok(rb.quads < rb.faces);
});

// risk: glowing windows / embers render lit (or not at all). Emissive voxels go to their own geometry.
test('emissive voxels mesh into the separate glow geometry with boosted colour', () => {
  const p = new VoxelPart('w').box(0, 2, 0, 2, 0, 0, RED).set(1, 1, 1, LAMP);
  const r = mesh(p);
  assert.ok(r.glow, 'glow geometry exists'); assert.equal(area(r.glow), 5);
  assert.equal(area(r.body) + area(r.glow), r.faces);
  const c = r.glow.attributes.color.array; assert.ok(Math.abs(c[0] - LAMP[0] * 2.5) < 1e-6, 'glow colour = colour x strength');
});

// risk: the game shows nothing / crashes when an asset is not in the registry. Fallbacks must hold.
test('registry: heroes and castle pieces fall back when no model is registered or a model fails to build', () => {
  const reg = new ModelRegistry(); const sculptor = KV.CharacterSculptor;
  const cache = new K.VoxelModelCache(sculptor, () => reg);
  assert.equal(reg.rigFor('ranger'), null);
  assert.equal(cache.get('ranger').id, 'ranger', 'no registry model -> the sculpted ranger');
  reg.register('hero_mage', () => { throw new Error('broken model'); }, { kind: 'rig' });
  assert.equal(reg.get('hero_mage'), null); assert.ok(reg.errors.has('hero_mage'));
  assert.equal(new K.VoxelModelCache(sculptor, reg).get('mage').id, 'mage', 'a failing model falls back to the sculpted mage');
  reg.register('hero_ranger', (ctx) => { const M = new ctx.VoxelModel('hd_ranger', { size: 0.02, height: 1.5, rest: { armL: [0.1, 0, 0] } }); M.part('hips', [0, 0, 0]).box(0, 1, 0, 1, 0, 1, RED); return M; }, { kind: 'rig' });
  const c2 = new K.VoxelModelCache(sculptor, reg);
  assert.equal(c2.get('ranger').id, 'hd_ranger', 'a registered hero wins'); assert.deepEqual(c2.restOf('ranger'), { armL: [0.1, 0, 0] });
  assert.equal(c2.restOf('knight'), sculptor.REST.knight);
  // castle pieces: Level 2 uses <type>_lv2 when present, else the Level 1 model; unknown types -> null (VoxKit art)
  reg.register('quarry', (ctx) => { const m = new ctx.StaticVoxelModel('quarry', { size: 0.05 }); m.part().box(0, 3, 0, 3, 0, 3, RED); return m; });
  assert.equal(reg.pieceId('quarry', 1), 'quarry'); assert.equal(reg.pieceId('quarry', 2), 'quarry');
  assert.equal(reg.pieceFor('quarry', 2).lv2, false);
  reg.register('quarry_lv2', (ctx) => { const m = new ctx.StaticVoxelModel('quarry_lv2', { size: 0.05 }); m.part().box(0, 4, 0, 4, 0, 4, BLUE); return m; });
  assert.equal(reg.pieceId('quarry', 2), 'quarry_lv2'); assert.equal(reg.pieceFor('quarry', 2).lv2, true);
  assert.equal(reg.pieceFor('mine', 1), null);
});

// risk: placement. A static model sits on the ground (y = 0), centred on its footprint.
test('static models are centred on x/z with their base at y = 0', () => {
  const m = new StaticVoxelModel('t', { size: 0.1, flames: [[4, 6, 2, 1]] }); m.part().box(0, 9, 3, 7, 0, 3, RED);
  const g = m.build(); g.body.computeBoundingBox(); const bb = g.body.boundingBox;
  assert.ok(Math.abs(bb.min.y) < 1e-6 && Math.abs(bb.max.y - 0.5) < 1e-6);
  assert.ok(Math.abs(bb.min.x + 0.5) < 1e-6 && Math.abs(bb.max.x - 0.5) < 1e-6 && Math.abs(bb.min.z + 0.2) < 1e-6);
  assert.equal(JSON.stringify(m.flamesM()[0].map((v) => Math.round(v * 100) / 100 + 0)), JSON.stringify([-0.1, 0.3, 0, 1]));
});

// risk: lost hand-refined paint. A colour layer must round-trip onto the same shape.
test('colour layers round-trip through encode/decode', () => {
  const pal = [RED, BLUE, KV.Colour.hex('#00ff00')];
  const p = new VoxelPart('c').box(0, 3, 0, 3, 0, 3, (x, y, z) => pal[(x * 7 + y * 3 + z) % 3]);
  const code = K.ColourProjector.encode(p, pal); const q = new VoxelPart('d').box(0, 3, 0, 3, 0, 3, RED);
  assert.equal(K.ColourProjector.decode(q, code, pal), 64);
  for (const [k, c] of p.vox) assert.deepEqual(q.vox.get(k), c);
});

// risk: every registered model must build (a broken model file silently falls back in the game).
test('every model in src/models builds; heroes keep the bones the animator drives', () => {
  const ids = K.Models.ids(); assert.ok(ids.length >= 1);
  for (const id of ids) {
    const m = K.Models.get(id), meta = K.Models.meta(id);
    assert.ok(m, `${id} failed: ${K.Models.errors.get(id) && K.Models.errors.get(id).message}`);
    assert.ok(m.tris > 0 && m.voxelCount > 100, `${id} is empty`);
    if (meta.kind === 'rig') {
      assert.ok(m instanceof VoxelModel, `${id} is a VoxelModel`);
      for (const b of ['hips', 'torso', 'head', 'armR', 'armL', 'legR', 'legL', 'weapon']) assert.ok(m.parts.has(b), `${id} has bone ${b}`);
      for (const p of m.parts.values()) if (p.parent) assert.ok(m.parts.has(p.parent), `${id}.${p.name} parent ${p.parent}`);
      let y0 = 1e9, y1 = -1e9; for (const p of m.parts.values()) { const b = p.bounds(); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); }
      // 64 (Grok block rhythm, reconstructed heroes) up to ~100 (hand sculpts); below ~56 the faces stop reading
      assert.ok(y1 - y0 + 1 >= 56 && y1 - y0 + 1 <= 110, `${id} is ${y1 - y0 + 1} voxels tall (want 56-110)`);
    }
  }
});
