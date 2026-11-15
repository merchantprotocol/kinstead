/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · high-resolution voxel model kit (the Asset Lab models).
   GreedyMesher      merges coplanar exposed faces that share a colour and a flat AO into one quad (per-voxel
                     colour, baked 3-neighbour AO, per-voxel emissive), so 100-voxel heroes and dense buildings
                     stay cheap. Same mesh(part, size, origin) contract as VoxelMesher, so VoxelModel can use it.
   StaticVoxelModel  one rigid voxel model (a building, a prop, a weapon) -> a shared geometry and a THREE.Group.
   ModelRegistry     K.Models: register(id, buildFn, meta) with one file per asset in src/models/<id>.js.
                     The game asks it first (heroes by role, castle pieces by type and level) and falls back
                     to the older sculpted / VoxKit models when an id is not registered.
   Colours are [r, g, b] in linear space (KV.Colour.hex); a 4th element makes the voxel emissive at that
   strength (KV.Colour.glow). Model space: y up, the model's front faces +z, 1 unit = 1 voxel. */
(function (G) {
  const K = (G.K = G.K || {}), KV = (G.KV = G.KV || {}), THREE = G.THREE;
  const { VoxelPart, VoxelMesher, Colour } = KV;

  /* an emissive colour: [r, g, b, strength]; the mesher puts these voxels in the unlit glow geometry */
  Colour.glow = (h, k = 2.2) => { const c = Colour.hex(h); c.push(k); return c; };

  /* ---------------- greedy mesher ---------------- */
  class GreedyMesher {
    constructor(opts = {}) { this.ao = opts.ao || [0.5, 0.68, 0.84, 1]; this.stats = { faces: 0, quads: 0 }; }

    /* the part as a dense grid of colour ids (0 = empty), padded by one voxel on every side */
    static grid(part) {
      const b = part.bounds(), x0 = b.x0 - 1, y0 = b.y0 - 1, z0 = b.z0 - 1;
      const X = b.x1 - b.x0 + 3, Y = b.y1 - b.y0 + 3, Z = b.z1 - b.z0 + 3;
      const ids = new Uint32Array(Math.max(1, X * Y * Z)), cols = [null], byRef = new Map(), byVal = new Map();
      for (const [k, c] of part.vox) {
        let id = byRef.get(c);
        if (id == null) {
          const key = c.join(','); id = byVal.get(key);
          if (id == null) { id = cols.length; cols.push(c); byVal.set(key, id); }
          byRef.set(c, id);
        }
        const [x, y, z] = VoxelPart.unkey(k);
        ids[((x - x0) * Y + (y - y0)) * Z + (z - z0)] = id;
      }
      return { ids, cols, X, Y, Z, x0, y0, z0 };
    }

    /* full output: { body, glow (or null), faces, quads }; geometry positions are (voxel - origin) * size */
    meshAll(part, size = 1, origin = [0, 0, 0]) {
      if (!part.count) return { body: GreedyMesher.geometry(new GeoOut()), glow: null, faces: 0, quads: 0 };
      const g = GreedyMesher.grid(part), { ids, cols, X, Y, Z } = g, D = [X, Y, Z], AO = this.ao;
      const at = (p) => ids[(p[0] * Y + p[1]) * Z + p[2]];
      const occ = (p) => (at(p) ? 1 : 0);
      const body = new GeoOut(), glow = new GeoOut();
      const off = [g.x0 - origin[0], g.y0 - origin[1], g.z0 - origin[2]];
      let faces = 0, quads = 0;
      const p = [0, 0, 0], q = [0, 0, 0], f = [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        const u = (a + 1) % 3, v = (a + 2) % 3, U = D[u], V = D[v];
        const mC = new Uint32Array(U * V), mA = new Uint16Array(U * V);
        for (const s of [1, -1]) {
          for (let sl = 1; sl < D[a] - 1; sl++) {
            // mask of exposed faces in this slice: colour id + AO (0..3 when all four corners agree, else 256 + packed)
            let any = false;
            for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
              p[a] = sl; p[u] = i; p[v] = j; const c = at(p); const m = j * U + i;
              mC[m] = 0; if (!c) continue;
              q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[a] += s; if (at(q)) continue;
              let pk = 0, a0 = -1, flat = true;
              for (let cn = 0; cn < 4; cn++) {
                const su = (cn === 1 || cn === 2) ? 1 : -1, sv = cn >= 2 ? 1 : -1;
                f[0] = q[0]; f[1] = q[1]; f[2] = q[2]; f[u] += su; const s1 = occ(f);
                f[u] -= su; f[v] += sv; const s2 = occ(f);
                f[u] += su; const cr = occ(f);
                const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
                pk |= ao << (cn * 2); if (a0 < 0) a0 = ao; else if (ao !== a0) flat = false;
              }
              mC[m] = c; mA[m] = flat ? a0 : 256 + pk; any = true; faces++;
            }
            if (!any) continue;
            for (let j = 0; j < V; j++) for (let i = 0; i < U;) {
              const m = j * U + i, c = mC[m]; if (!c) { i++; continue; }
              const ao = mA[m]; let w = 1, h = 1;
              if (ao < 4) {   // flat AO: grow along u, then along v while the whole row matches
                while (i + w < U && mC[m + w] === c && mA[m + w] === ao) w++;
                grow: while (j + h < V) { const r = (j + h) * U + i; for (let k = 0; k < w; k++) if (mC[r + k] !== c || mA[r + k] !== ao) break grow; h++; }
              }
              for (let jj = 0; jj < h; jj++) mC.fill(0, (j + jj) * U + i, (j + jj) * U + i + w);
              const col = cols[c], em = col.length > 3 ? col[3] : 0, out = em ? glow : body;
              const aos = ao < 4 ? [ao, ao, ao, ao] : [ao & 3, (ao >> 2) & 3, (ao >> 4) & 3, (ao >> 6) & 3];
              const plane = sl + (s > 0 ? 1 : 0), corners = [[0, 0], [w, 0], [w, h], [0, h]];
              const order = s > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
              const base = out.n, nrm = [0, 0, 0]; nrm[a] = s;
              for (const o of order) {
                const P = [0, 0, 0]; P[a] = plane; P[u] = i + corners[o][0]; P[v] = j + corners[o][1];
                out.pos.push((P[0] + off[0]) * size, (P[1] + off[1]) * size, (P[2] + off[2]) * size);
                out.nrm.push(nrm[0], nrm[1], nrm[2]);
                const k = em ? em : AO[aos[o]]; out.col.push(col[0] * k, col[1] * k, col[2] * k);
                // uv in voxel units, oriented so that on side faces uv.y is world up (the bevel shader lights the top lip)
                if (a === 2) out.uv.push(corners[o][0], corners[o][1]); else out.uv.push(corners[o][1], corners[o][0]);
              }
              const A = order.map((o) => aos[o]);
              if (A[0] + A[2] > A[1] + A[3]) out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
              else out.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
              out.n += 4; quads++; i += w;
            }
          }
        }
      }
      this.stats = { faces, quads };
      return { body: GreedyMesher.geometry(body), glow: glow.n ? GreedyMesher.geometry(glow) : null, faces, quads };
    }
    /* VoxelMesher-compatible: everything (glow voxels included) in one geometry */
    mesh(part, size, origin) {
      const r = this.meshAll(part, size, origin);
      if (!r.glow) return r.body;
      const g = KV.VoxelModel.merge([r.body, r.glow]); g.boundingSphere.radius /= 1.6; return g;
    }
    /* the HD voxel material: Lambert + per-voxel bevel computed from the voxel-unit uvs (no texture, so it stays
       crisp at any distance): a dark seam between cubes, a light top / left lip and a darker bottom / right lip,
       the way each cube in the Grok refs reads as a small bevelled block. A new material per call (rigs flash
       their emissive); the shader program is shared through customProgramCacheKey. */
    static material(opts = {}) {
      const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, emissive: new THREE.Color(0, 0, 0) }, opts));
      const B = GreedyMesher.BEVEL;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uBevel = { value: new THREE.Vector4(B.seam, B.lip, B.hi, B.lo) };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vVox;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\nvVox = uv;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vVox;\nuniform vec4 uBevel;')
          .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 f = fract(vVox), w = max(fwidth(vVox), vec2(1e-4));
            vec2 e0 = f / w, e1 = (1.0 - f) / w;                         // distance to each edge, in pixels
            float px = min(min(e0.x, e1.x), min(e0.y, e1.y));
            float seam = 1.0 - smoothstep(0.35, 1.25, px);               // a ~1 px groove between cubes
            float far = smoothstep(0.08, 0.2, min(w.x, w.y));            // cubes smaller than ~6 px: fade the lips
            vec2 L = vec2(uBevel.y);
            float hi = max(1.0 - smoothstep(0.0, L.y, 1.0 - f.y), 0.55 * (1.0 - smoothstep(0.0, L.x, f.x)));
            float lo = max(1.0 - smoothstep(0.0, L.y, f.y), 0.55 * (1.0 - smoothstep(0.0, L.x, 1.0 - f.x)));
            float k = 1.0 + (uBevel.z * hi - uBevel.w * lo) * (1.0 - 0.6 * far) - uBevel.x * seam * (1.0 - 0.5 * far);
            diffuseColor.rgb *= k;
          }`);
      };
      m.customProgramCacheKey = () => 'kinstead-voxbevel';
      return m;
    }
    static geometry(o) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
      g.setIndex(o.n > 65535 ? new THREE.Uint32BufferAttribute(o.idx, 1) : new THREE.Uint16BufferAttribute(o.idx, 1));
      g.computeBoundingSphere(); return g;
    }
  }
  /* bevel strengths: seam darkening, lip width (fraction of a voxel), top/left highlight, bottom/right shade */
  GreedyMesher.BEVEL = { seam: 0.42, lip: 0.2, hi: 0.2, lo: 0.24 };
  class GeoOut { constructor() { this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = []; this.n = 0; } }

  /* ---------------- static (rigid) models ---------------- */
  class StaticVoxelModel {
    /* opts: size (m per voxel), footprint [w, d] (m, for reference), flames [[x,y,z,scale] in voxels], lights [[x,y,z,strength]] */
    constructor(id, opts = {}) {
      this.id = id; this.size = opts.size || 0.03; this.footprint = opts.footprint || null;
      this.flames = opts.flames || []; this.lights = opts.lights || []; this.parts = [];
      this.geo = null; this.kind = 'static';
    }
    part(name = 'main') { const p = new VoxelPart(name); this.parts.push(p); return p; }
    get voxelCount() { return this.parts.reduce((n, p) => n + p.count, 0); }
    /* everything merged into one part (helpers that need the whole shape, e.g. snow and AO, see it all) */
    merged() { const out = new VoxelPart(this.id); for (const p of this.parts) for (const [k, c] of p.vox) out.vox.set(k, c); return out; }
    /* the model's base sits at y = 0, centred on x / z (in voxels) */
    origin() {
      const b = this.merged().bounds(); return [(b.x0 + b.x1 + 1) / 2, b.y0, (b.z0 + b.z1 + 1) / 2];
    }
    toWorld(v) { const o = this.origin(); return [(v[0] - o[0]) * this.size, (v[1] - o[1]) * this.size, (v[2] - o[2]) * this.size]; }
    build() {
      if (this.geo) return this.geo;
      const t0 = (G.performance || Date).now(), m = new GreedyMesher(), r = m.meshAll(this.merged(), this.size, this.origin());
      this.geo = { body: r.body, glow: r.glow }; this.faces = r.faces; this.quads = r.quads;
      this.tris = r.body.index.count / 3 + (r.glow ? r.glow.index.count / 3 : 0); this.meshMs = (G.performance || Date).now() - t0;
      return this.geo;
    }
    static material() {
      return StaticVoxelModel._mat || (StaticVoxelModel._mat = GreedyMesher.material());
    }
    static glowMaterial() { return StaticVoxelModel._gmat || (StaticVoxelModel._gmat = new THREE.MeshBasicMaterial({ vertexColors: true })); }
    /* a live instance: shared geometry and materials (clone the materials before changing them) */
    object3d() {
      const geo = this.build(), g = new THREE.Group(); g.name = 'model:' + this.id;
      const body = new THREE.Mesh(geo.body, StaticVoxelModel.material()); body.castShadow = true; body.receiveShadow = true; g.add(body);
      if (geo.glow) { const gm = new THREE.Mesh(geo.glow, StaticVoxelModel.glowMaterial()); gm.userData.glow = true; g.add(gm); }
      g.userData.model = this;
      return g;
    }
    /* flames / lights in metres, model-local (for CastleArt flames and the lab's point lights) */
    flamesM() { return this.flames.map((f) => [...this.toWorld(f), f[3] || 1]); }
    lightsM() { return this.lights.map((l) => [...this.toWorld(l), l[3] || 1]); }
    dispose() { if (this.geo) { this.geo.body.dispose(); if (this.geo.glow) this.geo.glow.dispose(); } this.geo = null; }
  }

  /* ---------------- reconstructed models (tools/lab/recon.mjs + rig-split.mjs -> src/models/<id>.data.js) ---------------- */
  class ReconModel {
    /* base64 of int8 x, y, z + uint8 palette index per voxel -> [[x, y, z, i], ...] */
    static unpack(b64) {
      const b = ReconModel.bytes(b64), s = (c) => (c > 127 ? c - 256 : c), out = [];
      for (let i = 0; i + 3 < b.length; i += 4) out.push([s(b[i]), s(b[i + 1]), s(b[i + 2]), b[i + 3]]);
      return out;
    }
    /* base64 -> bytes without atob/Buffer (the node tests run the engine in a bare vm context) */
    static bytes(b64) {
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', T = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) T[A.charCodeAt(i)] = i;
      const out = []; let acc = 0, bits = 0;
      for (let i = 0; i < b64.length; i++) { const v = T[b64.charCodeAt(i)]; if (v < 0) continue; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); } }
      return out;
    }
    static data(id) { return (K.ModelData && K.ModelData[id]) || null; }
    /* a rigged hero from its data: one VoxelPart per bone, pivots in voxels, size = height / voxels */
    static rig(id, ctx, opts = {}) {
      const D = ReconModel.data(id); if (!D) throw new Error(`no reconstruction data for ${id} (src/models/${id}.data.js)`);
      const pal = D.palette.map((h) => ctx.Colour.hex(h)), M = new ctx.VoxelModel('hd_' + id, { size: D.height / D.voxels, height: D.height, style: opts.style || 'swing', mesher: new ctx.GreedyMesher(), rest: opts.rest || {} });
      for (const [name, p] of Object.entries(D.parts)) { const part = M.part(name, p.pivot, p.parent, { jitter: 0 }); for (const [x, y, z, i] of ReconModel.unpack(p.data)) part.set(x, y, z, pal[i]); }
      return M;
    }
  }

  /* ---------------- the registry ---------------- */
  class ModelRegistry {
    constructor() { this.defs = new Map(); this.cache = new Map(); this.errors = new Map(); }
    /* register(id, buildFn, meta) or register(id, { build, ...meta }).
       buildFn(ctx) returns a KV.VoxelModel (rigged hero: meta.kind 'rig') or a StaticVoxelModel.
       meta: kind 'rig' | 'static', role (heroes), ref (reference image URL), view { yaw, pitch, fov }, title */
    register(id, build, meta = {}) {
      if (build && typeof build === 'object') { meta = build; build = meta.build; }
      if (typeof build !== 'function') throw new Error(`K.Models.register(${id}): build must be a function`);
      this.defs.set(id, Object.assign({ id, kind: 'static' }, meta, { build })); this.cache.delete(id); this.errors.delete(id);
      return this;
    }
    has(id) { return this.defs.has(id); }
    ids() { return [...this.defs.keys()]; }
    meta(id) { return this.defs.get(id) || null; }
    /* the built model (cached). A model that throws is reported once and treated as missing, so the game falls back */
    get(id) {
      if (this.cache.has(id)) return this.cache.get(id);
      const d = this.defs.get(id); if (!d) return null;
      let m = null;
      try {
        const t0 = (G.performance || Date).now(); m = d.build(ModelRegistry.context());
        if (m) { m.buildMs = (G.performance || Date).now() - t0; m.registryId = id; m.build(); }
      } catch (e) { this.errors.set(id, e); console.warn(`model ${id} failed to build; using the fallback`, e && e.message); m = null; }
      this.cache.set(id, m); return m;
    }
    /* drop the cached build (the lab rebuilds after a model file changes) */
    invalidate(id) { const m = this.cache.get(id); if (m && m.dispose) m.dispose(); this.cache.delete(id); this.errors.delete(id); }
    /* heroes: play's role names (knight, ranger, mage, troll) map to registry ids hero_<role> */
    static heroId(role) { return 'hero_' + role; }
    rigFor(role) { const id = ModelRegistry.heroId(role); return this.has(id) ? this.get(id) : null; }
    /* castle pieces: Level 2 uses <type>_lv2 when it exists, else the Level 1 model (CastleArt adds the level flag) */
    pieceId(type, level = 1) {
      if (level >= 2 && this.has(type + '_lv2')) return type + '_lv2';
      return this.has(type) ? type : null;
    }
    pieceFor(type, level = 1) { const id = this.pieceId(type, level); const m = id ? this.get(id) : null; return m ? { id, model: m, lv2: id.endsWith('_lv2') } : null; }
    static context() {
      return { K, KV, THREE, Colour: KV.Colour, Hash: KV.Hash, VoxelPart, VoxelModel: KV.VoxelModel, StaticVoxelModel, GreedyMesher, Shapes: K.Shapes, Palette: K.Palette };
    }
  }

  K.Models = new ModelRegistry();
  Object.assign(KV, { GreedyMesher, StaticVoxelModel, ModelRegistry, ReconModel });
})(typeof window !== 'undefined' ? window : globalThis);
