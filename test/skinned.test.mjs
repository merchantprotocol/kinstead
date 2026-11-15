/* Checks for the skinned GLB models (src/engine/64-skinned.js): the GLB parser decodes exactly what the asset
   pipeline writes (quantized, strided, node-transformed), the shipped models are sane, and the registry loads each
   model once, falls back cleanly when a file is missing or broken, and swaps models into castle pieces. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src'), MODELS = path.join(ROOT, 'public', 'models');

class SkinnedSandbox {
  constructor() {
    this.ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, Math, TextDecoder, performance: { now: () => 0 } });
    this.ctx.window = this.ctx; this.ctx.self = this.ctx; this.ctx.globalThis = this.ctx;
    for (const f of ['vendor/three/three.min.js', 'engine/64-skinned.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), this.ctx, { filename: f });
  }
}
const { K, THREE } = new SkinnedSandbox().ctx;

/* builds a GLB the way the asset pipeline does (tools: skinned/tools/skin.py GlbWriter), so the test owns its numbers */
class TinyGlb {
  /* tris: [[x,y,z] x3] world positions; returns bytes plus the expected decoded arrays */
  static build({ positions, normals, uvs, rotation = null, jpeg = [0xff, 0xd8, 0xff, 0xd9], extras = { id: 'tiny' } }) {
    const n = positions.length, lo = [0, 1, 2].map((c) => Math.min(...positions.map((p) => p[c]))), hi = [0, 1, 2].map((c) => Math.max(...positions.map((p) => p[c])));
    const ctr = lo.map((v, c) => (v + hi[c]) / 2), half = lo.map((v, c) => Math.max((hi[c] - v) / 2, 1e-6));
    const q = new Int16Array(n * 4), n8 = new Int8Array(n * 4), u16 = new Uint16Array(n * 2);
    positions.forEach((p, i) => { for (let c = 0; c < 3; c++) q[i * 4 + c] = Math.round((p[c] - ctr[c]) / half[c] * 32767); });
    // like the pipeline: store S n (normalised), because glTF turns normals by the node's inverse-transpose scale
    normals.forEach((v, i) => { const sn = v.map((x, c) => x * half[c]), l = Math.hypot(...sn); for (let c = 0; c < 3; c++) n8[i * 4 + c] = Math.round(sn[c] / l * 127); });
    uvs.forEach((v, i) => { u16[i * 2] = Math.round(v[0] * 65535); u16[i * 2 + 1] = Math.round(v[1] * 65535); });
    const parts = [new Uint8Array(q.buffer), new Uint8Array(n8.buffer), new Uint8Array(u16.buffer), Uint8Array.from(jpeg)], views = []; let off = 0;
    for (const p of parts) { views.push({ buffer: 0, byteOffset: off, byteLength: p.byteLength }); off += Math.ceil(p.byteLength / 4) * 4; }
    views[0].byteStride = 8; views[1].byteStride = 4; views[2].byteStride = 4;
    const bin = new Uint8Array(off); let o = 0; for (const p of parts) { bin.set(p, o); o += Math.ceil(p.byteLength / 4) * 4; }
    const node = { mesh: 0, name: extras.id, translation: ctr, scale: half }; if (rotation) node.rotation = rotation;
    const g = { asset: { version: '2.0' }, extensionsUsed: ['KHR_mesh_quantization'], scene: 0, scenes: [{ nodes: [0] }], nodes: [node],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: 'image/jpeg' }],
      accessors: [{ bufferView: 0, componentType: 5122, normalized: true, count: n, type: 'VEC3' }, { bufferView: 1, componentType: 5120, normalized: true, count: n, type: 'VEC3' },
        { bufferView: 2, componentType: 5123, normalized: true, count: n, type: 'VEC2' }], bufferViews: views, buffers: [{ byteLength: off }], extras };
    let js = new TextEncoder().encode(JSON.stringify(g)); const pad = (4 - (js.length % 4)) % 4; js = Uint8Array.from([...js, ...Array(pad).fill(32)]);
    const out = new Uint8Array(12 + 8 + js.length + 8 + bin.length), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
    dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
    dv.setUint32(20 + js.length, bin.length, true); dv.setUint32(24 + js.length, 0x004e4942, true); out.set(bin, 28 + js.length);
    return out;
  }
}
const TRI = { positions: [[-0.5, 0, 0.25], [0.5, 0, 0.25], [0, 1.5, -0.25]], normals: [[0, 0, 1], [0, 0, 1], [0.6, 0, 0.8]], uvs: [[0, 0], [1, 0], [0.25, 0.75]] };
const close = (a, b, eps, msg) => { assert.equal(a.length, b.length, msg); for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= eps, `${msg} [${i}] ${a[i]} vs ${b[i]}`); };

// risk: data accuracy. A wrong stride, normalisation or node transform draws every model garbled or at the wrong size.
test('GlbParser decodes quantized, strided attributes and bakes the node scale and translation', () => {
  const r = new K.GlbParser().parse(TinyGlb.build(TRI));
  assert.equal(r.count, 3); assert.equal(r.id, 'tiny'); assert.equal(r.index, null);
  close(r.positions, TRI.positions.flat(), 1e-4, 'positions');
  close(r.normals, [0, 0, 1, 0, 0, 1, 0.6, 0, 0.8], 0.01, 'normals');
  close(r.uvs, TRI.uvs.flat(), 1e-4, 'uvs');
  assert.deepEqual([...r.image.bytes], [0xff, 0xd8, 0xff, 0xd9]); assert.equal(r.image.mime, 'image/jpeg');
});

// risk: data accuracy. A node rotation must turn positions and normals (90 degrees about y: +x goes to -z).
test('GlbParser applies a node rotation quaternion to positions and normals', () => {
  const s = Math.SQRT1_2, r = new K.GlbParser().parse(TinyGlb.build({ ...TRI, rotation: [0, s, 0, s] }));
  const want = TRI.positions.map(([x, y, z]) => [z, y, -x]).flat();
  close(r.positions, want, 1e-4, 'rotated positions');
  close(r.normals.slice(6), [0.8, 0, -0.6], 0.01, 'rotated normal');
});

// risk: crash on bad input. Anything that is not a GLB must be refused with an error, not half-parsed.
test('GlbParser rejects bytes that are not a GLB', () => {
  assert.throws(() => new K.GlbParser().parse(new Uint8Array(64)), /not a glb/);
  assert.throws(() => new K.GlbParser().parse(new TextEncoder().encode('<!doctype html><html>404 page that is long enough</html>')), /not a glb/);
});

// risk: shipped assets. Every model in public/models must decode to a closed set of textured triangles, upright
// (base on y = 0), centred and with a JPEG or PNG texture, or the game draws holes or floating pieces.
test('every shipped skinned model decodes to sane, textured, upright geometry', () => {
  const files = fs.existsSync(MODELS) ? fs.readdirSync(MODELS).filter((f) => f.endsWith('.glb')) : [];
  assert.ok(files.length > 0, 'no models shipped');
  for (const f of files) {
    const r = new K.GlbParser().parse(fs.readFileSync(path.join(MODELS, f))), b = K.GlbParser.bounds(r.positions);
    assert.equal(r.count % 3, 0, f + ' vertex count'); assert.ok(r.count >= 300, f + ' too few triangles');
    assert.ok(Math.abs(b.min[1]) < 1e-3, f + ' base not on y = 0');
    assert.ok(Math.abs(b.min[0] + b.max[0]) < 1e-2 && Math.abs(b.min[2] + b.max[2]) < 1e-2, f + ' not centred on x / z');
    assert.ok(Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) <= 1.001, f + ' larger than the unit box');
    for (let i = 0; i < r.uvs.length; i++) assert.ok(r.uvs[i] >= 0 && r.uvs[i] <= 1, f + ' uv out of range');
    for (let i = 0; i < r.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(r.normals[i], r.normals[i + 1], r.normals[i + 2]) - 1) < 0.02, f + ' normal not unit');
    const m = r.image.bytes; assert.ok((m[0] === 0xff && m[1] === 0xd8) || (m[0] === 0x89 && m[1] === 0x50), f + ' texture is not JPEG / PNG');
    assert.equal(r.extras.id, f.slice(0, -4), f + ' id does not match its file name');
  }
});

/* a registry over fake io: counts fetches, can fail an id, textures are plain objects */
class FakeIO {
  constructor(files) { this.files = files; this.fetches = []; }
  async fetch(url) { this.fetches.push(url); const b = this.files[url]; if (!b) throw new Error('404 ' + url); return b; }
  async texture() { return new THREE.Texture(); }
}
const tiny = (id) => TinyGlb.build({ ...TRI, extras: { id } });

// risk: performance / correctness. Many castle pieces ask for the same model at once; it must be fetched once.
test('SkinnedModels fetches a model once however many callers ask, and hands out shared geometry', async () => {
  const io = new FakeIO({ 'models/keep.glb': tiny('keep') }), S = new K.SkinnedModels({ base: 'models/', ids: ['keep'] }, io);
  const [a, b] = await Promise.all([S.load('keep'), S.load('keep')]);
  assert.equal(io.fetches.length, 1); assert.equal(a, b); assert.equal(S.get('keep'), a);
  assert.equal(a.mesh(2).geometry, a.mesh(1).geometry); assert.equal(a.mesh(2).scale.x, 2); assert.equal(a.tris, 1);
});

// risk: broken game. A missing or corrupt file must leave the voxel model in place and never be retried in a loop.
test('a missing or corrupt model fails once, reports not available, and never calls back', async () => {
  const io = new FakeIO({ 'models/bad.glb': new Uint8Array(40) }), S = new K.SkinnedModels({ base: 'models/', ids: ['gone', 'bad'] }, io);
  let called = 0;
  S.whenReady('gone', () => called++); S.whenReady('bad', () => called++);
  assert.equal(await S.load('gone'), null); assert.equal(await S.load('bad'), null);
  assert.equal(called, 0); assert.equal(S.has('gone'), false); assert.equal(S.has('bad'), false);
  await S.load('gone'); assert.equal(io.fetches.length, 2, 'failed ids are not fetched again');
  assert.equal(await S.load('not-in-manifest'), null); assert.equal(io.fetches.length, 2, 'ids outside the manifest are never fetched');
});

// risk: wrong building shown. Level 2 uses <type>_lv2 only when that file exists; ?skinned=0 turns everything off.
test('pieceId picks the Level 2 model only when it exists, and a disabled registry offers nothing', () => {
  const S = new K.SkinnedModels({ ids: ['mine', 'mine_lv2', 'smithy', 'hero_knight'] }, new FakeIO({}));
  assert.equal(S.pieceId('mine', 2), 'mine_lv2'); assert.equal(S.pieceId('mine', 1), 'mine');
  assert.equal(S.pieceId('smithy', 2), 'smithy'); assert.equal(S.pieceId('chapel', 1), null);
  assert.equal(S.heroId('knight'), 'hero_knight'); assert.equal(S.heroId('mage'), null);
  S.enabled = false; assert.equal(S.pieceId('mine', 2), null); assert.equal(S.heroId('knight'), null);
});

// risk: castle visuals. The swap must drop the drawn voxel children, keep a frost shell, fit the footprint, and not double up.
test('swapInto replaces a piece group\'s drawn children with the model fitted to the footprint, once', async () => {
  const io = new FakeIO({ 'models/barracks.glb': tiny('barracks') }), S = new K.SkinnedModels({ base: 'models/', ids: ['barracks'] }, io);
  const g = new THREE.Group(), frost = new THREE.Mesh(); frost.userData.frost = true; g.add(new THREE.Mesh(), new THREE.Mesh(), frost); g.userData.box = 'stale';
  S.swapInto(g, 'barracks', { footprint: [4.2, 2.2] }); await S.load('barracks'); await null;
  S.swapInto(g, 'barracks', { footprint: [4.2, 2.2] });
  const meshes = g.children.filter((c) => c.userData.skinned === 'barracks');
  assert.equal(meshes.length, 1); assert.equal(g.children.length, 2); assert.ok(g.children.includes(frost));
  assert.equal(g.userData.box, undefined, 'occlusion box is re-measured');
  // the tiny model is 1.0 wide (x) and 0.5 deep (z): footprint 4.2 x 2.2 -> min(4.2 / 1, 2.2 / 0.5) = 4.2
  assert.ok(Math.abs(meshes[0].scale.x - 4.2) < 1e-3);
});

// risk: size. Footprint fit keeps the model inside both sides; height fit matches the voxel hero height; junk input is neutral.
test('SkinnedFit keeps models inside their footprint and at hero height', () => {
  const b = { min: [-0.5, 0, -0.25], max: [0.5, 1, 0.25] };
  assert.equal(K.SkinnedFit.footprint(b, [2, 2]), 2); assert.equal(K.SkinnedFit.footprint(b, [4, 0.25]), 0.5);
  assert.equal(K.SkinnedFit.height(b, 1.56), 1.56);
  assert.equal(K.SkinnedFit.footprint({ min: [0, 0, 0], max: [0, 1, 0] }, [2, 2]), 1); assert.equal(K.SkinnedFit.height(b, 0), 1);
});
