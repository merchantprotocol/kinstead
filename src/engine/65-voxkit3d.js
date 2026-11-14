/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · 3D voxel characters, core kit.
   VoxelPart    a sparse voxel grid for one rigid body part (sculpted with boxes, capsules, ellipsoids, bitmaps)
   VoxelMesher  turns a part into one BufferGeometry: only exposed faces, baked voxel AO, per-voxel colour
                jitter and a bevel texture so every cube reads as a cube (like the HD voxel art)
   VoxelModel   the parts of one character plus its bone hierarchy (pivot points, parents)
   VoxelRig     a live Three.js instance of a model: bone Object3Ds, shared geometry, one material per actor
   VoxelAnimator the procedural skeleton animation: idle breathe, walk, run, attack, cast, hurt, death */
(function (G) {
  const THREE = G.THREE;
  const KV = (G.KV = G.KV || {});

  class Hash {
    static h3(x, y, z, s = 0) {
      let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2246822519) + Math.imul(s | 0, 3266489917);
      h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
  }

  /* palette colours are authored in sRGB hex and stored linear (what WebGL vertex colours expect) */
  class Colour {
    static hex(h) { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }
    static mul(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
    static mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    static palette(o) { const p = {}; for (const k in o) p[k] = Colour.hex(o[k]); return p; }
  }

  class VoxelPart {
    constructor(name, pivot = [0, 0, 0], parent = null, opts = {}) {
      this.name = name; this.pivot = pivot; this.parent = parent; this.vox = new Map();
      this.jitter = opts.jitter == null ? 0.07 : opts.jitter; this.glow = !!opts.glow;
    }
    static key(x, y, z) { return ((x + 512) << 20) | ((y + 512) << 10) | (z + 512); }
    static unkey(k) { return [((k >>> 20) & 1023) - 512, ((k >>> 10) & 1023) - 512, (k & 1023) - 512]; }
    has(x, y, z) { return this.vox.has(VoxelPart.key(x, y, z)); }
    get(x, y, z) { return this.vox.get(VoxelPart.key(x, y, z)); }
    set(x, y, z, c) { const k = VoxelPart.key(x, y, z); if (c) this.vox.set(k, c); else this.vox.delete(k); return this; }
    get count() { return this.vox.size; }
    static ink(paint, x, y, z) { return typeof paint === 'function' ? paint(x, y, z) : paint; }
    fill(x0, x1, y0, y1, z0, z1, test, paint) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) {
        if (!test(x, y, z)) continue; const c = VoxelPart.ink(paint, x, y, z); if (c) this.set(x, y, z, c);
      }
      return this;
    }
    box(x0, x1, y0, y1, z0, z1, paint) { return this.fill(x0, x1, y0, y1, z0, z1, () => true, paint); }
    /* box with its vertical edges rounded off by r voxels */
    rbox(x0, x1, y0, y1, z0, z1, r, paint) {
      return this.fill(x0, x1, y0, y1, z0, z1, (x, y, z) => {
        const dx = Math.max(0, x0 + r - x, x - (x1 - r)), dz = Math.max(0, z0 + r - z, z - (z1 - r));
        return dx * dx + dz * dz <= r * r + 0.5;
      }, paint);
    }
    ellipsoid(cx, cy, cz, rx, ry, rz, paint) {
      return this.fill(cx - rx, cx + rx, cy - ry, cy + ry, cz - rz, cz + rz, (x, y, z) => {
        const a = (x - cx) / (rx + 0.35), b = (y - cy) / (ry + 0.35), c = (z - cz) / (rz + 0.35); return a * a + b * b + c * c <= 1;
      }, paint);
    }
    /* tapered capsule from a (radius r0) to b (radius r1) */
    seg(a, b, r0, r1, paint, cap = true) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz || 1, R = Math.max(r0, r1);
      return this.fill(Math.min(a[0], b[0]) - R, Math.max(a[0], b[0]) + R, Math.min(a[1], b[1]) - R, Math.max(a[1], b[1]) + R, Math.min(a[2], b[2]) - R, Math.max(a[2], b[2]) + R, (x, y, z) => {
        let t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L2;
        if (!cap && (t < 0 || t > 1)) return false;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + dx * t - x, py = a[1] + dy * t - y, pz = a[2] + dz * t - z, r = r0 + (r1 - r0) * t + 0.45;
        return px * px + py * py + pz * pz <= r * r;
      }, paint);
    }
    carve(test) { for (const k of [...this.vox.keys()]) { const [x, y, z] = VoxelPart.unkey(k); if (test(x, y, z)) this.vox.delete(k); } return this; }
    recolor(test, paint) { for (const [k, c] of this.vox) { const [x, y, z] = VoxelPart.unkey(k); if (test(x, y, z, c)) { const n = VoxelPart.ink(paint, x, y, z, c); if (n) this.vox.set(k, n); } } return this; }
    /* stamp a character bitmap onto the outermost voxels facing +z (front) or -z (back);
       rows[0] is the top row, x0/yTop are the bitmap's top-left in voxel coordinates */
    stamp(rows, inks, x0, yTop, face = 1, mirror = false) {
      const W = rows[0].length;
      for (let r = 0; r < rows.length; r++) for (let i = 0; i < W; i++) {
        const ch = rows[r][i], c = inks[ch]; if (!c) continue;
        const x = x0 + (mirror ? W - 1 - i : i), y = yTop - r;
        let best = null;
        for (let z = -60; z <= 60; z++) if (this.has(x, y, z)) { if (best == null || (face > 0 ? z > best : z < best)) best = z; }
        if (best != null) this.set(x, y, best, c);
      }
      return this;
    }
    /* stamp a bitmap on the outermost voxels facing +x / -x (for side-facing plates such as a shield) */
    stampSide(rows, inks, z0, yTop, face = 1) {
      const W = rows[0].length;
      for (let r = 0; r < rows.length; r++) for (let i = 0; i < W; i++) {
        const c = inks[rows[r][i]]; if (!c) continue;
        const z = z0 + (face > 0 ? W - 1 - i : i), y = yTop - r; let best = null;
        for (let x = -80; x <= 80; x++) if (this.has(x, y, z)) { if (best == null || (face > 0 ? x > best : x < best)) best = x; }
        if (best != null) this.set(best, y, z, c);
      }
      return this;
    }
    /* nearest-neighbour resample by factor f (f > 1 = fewer, bigger voxels) */
    resampled(f) {
      const b = this.bounds(), out = new VoxelPart(this.name, this.pivot.map((v) => v / f), this.parent, { jitter: this.jitter, glow: this.glow });
      for (let x = Math.floor(b.x0 / f) - 1; x <= Math.ceil(b.x1 / f) + 1; x++) for (let y = Math.floor(b.y0 / f) - 1; y <= Math.ceil(b.y1 / f) + 1; y++) for (let z = Math.floor(b.z0 / f) - 1; z <= Math.ceil(b.z1 / f) + 1; z++) {
        const c = this.get(Math.round(x * f), Math.round(y * f), Math.round(z * f)); if (c) out.set(x, y, z, c);
      }
      return out;
    }
    bounds() {
      const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      for (const k of this.vox.keys()) { const [x, y, z] = VoxelPart.unkey(k); b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); }
      return b;
    }
  }

  /* exposed-face mesher with classic 3-neighbour voxel ambient occlusion */
  class VoxelMesher {
    constructor(opts = {}) { this.ao = opts.ao || [0.5, 0.68, 0.84, 1]; }
    static FACES = [
      { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], u: [0, 0, 1], v: [0, 1, 0] },
      { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], u: [0, 0, -1], v: [0, 1, 0] },
      { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [1, 0, 0], v: [0, 0, -1] },
      { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: [1, 0, 0], v: [0, 0, 1] },
      { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: [1, 0, 0], v: [0, 1, 0] },
      { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: [-1, 0, 0], v: [0, 1, 0] },
    ];
    mesh(part, size, origin) {
      const pos = [], nrm = [], col = [], uv = [], idx = [], F = VoxelMesher.FACES, AO = this.ao, J = part.jitter;
      const ox = origin[0], oy = origin[1], oz = origin[2];
      const occ = (x, y, z) => (part.has(x, y, z) ? 1 : 0);
      for (const [k, c] of part.vox) {
        const [x, y, z] = VoxelPart.unkey(k);
        const j = 1 + (Hash.h3(x, y, z, 7) - 0.5) * 2 * J;
        for (const f of F) {
          const n = f.n; if (part.has(x + n[0], y + n[1], z + n[2])) continue;
          const base = pos.length / 3, aos = [];
          for (const cn of f.c) {
            // the 3 voxels touching this corner in the layer in front of the face
            const sx = cn[0] * 2 - 1, sy = cn[1] * 2 - 1, sz = cn[2] * 2 - 1;
            const fx = x + n[0], fy = y + n[1], fz = z + n[2];
            const ax = n[0] ? 0 : sx, ay = n[1] ? 0 : sy, az = n[2] ? 0 : sz;
            let s1, s2;
            if (n[0]) { s1 = occ(fx, fy + ay, fz); s2 = occ(fx, fy, fz + az); }
            else if (n[1]) { s1 = occ(fx + ax, fy, fz); s2 = occ(fx, fy, fz + az); }
            else { s1 = occ(fx + ax, fy, fz); s2 = occ(fx, fy + ay, fz); }
            const cr = occ(fx + ax, fy + ay, fz + az);
            const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cr); aos.push(a);
            pos.push((x + cn[0] - ox) * size, (y + cn[1] - oy) * size, (z + cn[2] - oz) * size);
            nrm.push(n[0], n[1], n[2]);
            const s = AO[a] * j; col.push(c[0] * s, c[1] * s, c[2] * s);
          }
          uv.push(0, 0, 1, 0, 1, 1, 0, 1);
          if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      g.computeBoundingSphere();
      return g;
    }
    /* the cube bevel: a light face with a dark seam and a soft highlight on the upper-left lip */
    static bevelTexture() {
      if (VoxelMesher._bevel) return VoxelMesher._bevel;
      const N = 16, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const e = Math.min(x, y, N - 1 - x, N - 1 - y);
        let v = e === 0 ? 0.6 : e === 1 ? 0.86 : 1.0;
        if (e === 1 && (x === 1 || y === 1)) v = 1.08;
        v = Math.min(1, v * 0.93 + (x + y) * 0.002);
        const i = (y * N + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.round(v * 255); im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.generateMipmaps = true;
      return (VoxelMesher._bevel = t);
    }
  }

  /* one character design: parts with pivots + parent names, voxel size, animation style */
  class VoxelModel {
    constructor(id, opts) {
      this.id = id; this.size = opts.size; this.style = opts.style || 'swing'; this.parts = new Map();
      this.height = opts.height; this.glowColor = opts.glowColor || null; this.geo = null;
    }
    part(name, pivot, parent = null, opts) { const p = new VoxelPart(name, pivot, parent, opts); this.parts.set(name, p); return p; }
    get voxelCount() { let n = 0; for (const p of this.parts.values()) n += p.count; return n; }
    get boneNames() { return [...this.parts.keys()]; }
    /* trade voxel resolution for triangles (the troll is ~4x a hero's surface) */
    resample(f) { if (this.geo) throw new Error('resample before build'); for (const [n, p] of this.parts) this.parts.set(n, p.resampled(f)); this.size *= f; return this; }
    /* geometry is built once per model and shared by every actor that wears it: one skinned body
       (each vertex rigidly bound to its part's bone), plus unlit meshes for glowing parts */
    build() {
      if (this.geo) return this.geo;
      const m = new VoxelMesher(), names = this.boneNames, body = [], glow = new Map();
      names.forEach((name, i) => {
        const p = this.parts.get(name);
        if (p.glow) glow.set(name, m.mesh(p, this.size, p.pivot));
        else body.push(VoxelModel.skin(m.mesh(p, this.size, [0, 0, 0]), i));
      });
      const g = VoxelModel.merge(body); let tris = g.index.count / 3; for (const q of glow.values()) tris += q.index.count / 3;
      this.geo = { body: g, glow }; this.tris = tris; return this.geo;
    }
    static skin(g, bone) {
      const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
    }
    static merge(list) {
      const out = new THREE.BufferGeometry(), names = Object.keys(list[0].attributes); let nv = 0, ni = 0;
      for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
      for (const k of names) {
        const a0 = list[0].attributes[k], arr = new a0.array.constructor(nv * a0.itemSize); let o = 0;
        for (const g of list) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
        out.setAttribute(k, new THREE.BufferAttribute(arr, a0.itemSize));
      }
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let io = 0, vo = 0;
      for (const g of list) { const s = g.index.array; for (let i = 0; i < s.length; i++) idx[io++] = s[i] + vo; vo += g.attributes.position.count; g.dispose(); }
      out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); out.boundingSphere.radius *= 1.6; return out;
    }
    /* a coarse copy of the body for the sun's shadow pass only: every part resampled by f (bigger cubes,
       about 1/f^2 the triangles), same bone order so it rides the same skeleton as the full mesh */
    buildShadow(f = VoxelModel.SHADOW_RESAMPLE) {
      if (this.shadowGeo) return this.shadowGeo;
      const m = new VoxelMesher(), list = [];
      this.boneNames.forEach((name, i) => {
        const p = this.parts.get(name); if (p.glow) return;
        list.push(VoxelModel.skin(m.mesh(p.resampled(f), this.size * f, [0, 0, 0]), i));
      });
      this.shadowGeo = VoxelModel.merge(list); this.shadowTris = this.shadowGeo.index.count / 3; return this.shadowGeo;
    }
    dispose() { if (this.geo) { this.geo.body.dispose(); for (const g of this.geo.glow.values()) g.dispose(); } if (this.shadowGeo) this.shadowGeo.dispose(); this.geo = null; this.shadowGeo = null; }
  }
  VoxelModel.SHADOW_RESAMPLE = 2;

  /* a live instance: root group (world placement + facing) > body > bone hierarchy, one skinned mesh */
  class VoxelRig {
    constructor(model, opts = {}) {
      this.model = model; const geo = model.build(), s = model.size, names = model.boneNames;
      this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: VoxelMesher.bevelTexture(), emissive: new THREE.Color(0, 0, 0) });
      this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.35, 1.35, 1.4) });
      this.group = new THREE.Group(); this.body = new THREE.Group(); this.group.add(this.body);
      this.bones = {}; this.rest = {};
      for (const name of names) { const b = new THREE.Bone(); b.name = name; this.bones[name] = b; }
      for (const name of names) {
        const p = model.parts.get(name), bone = this.bones[name], par = p.parent ? model.parts.get(p.parent) : null, pp = par ? par.pivot : [0, 0, 0];
        bone.position.set((p.pivot[0] - pp[0]) * s, (p.pivot[1] - pp[1]) * s, (p.pivot[2] - pp[2]) * s);
        (par ? this.bones[p.parent] : this.body).add(bone);
        this.rest[name] = { p: bone.position.clone(), r: bone.rotation.clone() };
        const gg = geo.glow.get(name);
        if (gg) {
          const mesh = new THREE.Mesh(gg, this.glowMat); bone.add(mesh);
          if (model.glowColor) {
            const b = p.bounds(), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VoxelRig.glowTexture(), color: new THREE.Color(model.glowColor), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
            sp.position.set(((b.x0 + b.x1 + 1) / 2 - p.pivot[0]) * s, ((b.y0 + b.y1 + 1) / 2 - p.pivot[1]) * s, ((b.z0 + b.z1 + 1) / 2 - p.pivot[2]) * s);
            const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) * s * 3.2; sp.scale.set(r, r, 1); sp.renderOrder = 5; bone.add(sp); this.glowSprite = sp;
          }
        }
      }
      this.mesh = new THREE.SkinnedMesh(geo.body, this.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
      this.body.add(this.mesh);
      // shadow proxy: the full mesh stops casting; a low-res copy on its own layer casts instead and is
      // never drawn by the view camera (only a shadow camera with VoxelRig.SHADOW_LAYER enabled sees it)
      if (opts.shadowProxy) {
        this.mesh.castShadow = false;
        this.shadow = new THREE.SkinnedMesh(model.buildShadow(), VoxelRig.shadowMaterial());
        this.shadow.castShadow = true; this.shadow.receiveShadow = false; this.shadow.layers.set(VoxelRig.SHADOW_LAYER);
        this.body.add(this.shadow);
      }
      this.group.updateMatrixWorld(true);
      this.mesh.bind(new THREE.Skeleton(names.map((n) => this.bones[n])));
      if (this.shadow) this.shadow.bind(this.mesh.skeleton, this.mesh.bindMatrix);
      if (opts.rest) for (const [n, r] of Object.entries(opts.rest)) if (this.bones[n]) { this.bones[n].rotation.set(r[0], r[1], r[2]); this.rest[n].r = this.bones[n].rotation.clone(); }
    }
    static shadowMaterial() { return VoxelRig._shadowMat || (VoxelRig._shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); }
    static glowTexture() {
      if (VoxelRig._glow) return VoxelRig._glow;
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.25, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (VoxelRig._glow = t);
    }
    resetPose() { for (const n in this.bones) { const b = this.bones[n], r = this.rest[n]; b.position.copy(r.p); b.rotation.copy(r.r); b.scale.set(1, 1, 1); } this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0); }
    meshes() { return [this.mesh]; }
    dispose() { this.mat.dispose(); this.glowMat.dispose(); if (this.glowSprite) this.glowSprite.material.dispose(); this.mesh.skeleton.dispose(); }
  }

  VoxelRig.SHADOW_LAYER = 7;

  /* procedural skeleton animation; every clip is a pure function of (state, time-in-state, clock) */
  class VoxelAnimator {
    constructor(rig, opts = {}) { this.rig = rig; this.style = rig.model.style; this.phase = opts.phase || 0; this.walkT = 0; this.blend = 0; }
    add(name, rx = 0, ry = 0, rz = 0) { const b = this.rig.bones[name]; if (!b) return; const r = this.rig.rest[name].r; b.rotation.set(r.x + rx, r.y + ry, r.z + rz); }
    apply(state, T, t, dt) {
      const R = this.rig, B = R.bones, s = R.model.size, st = this.style, ph = this.phase;
      R.resetPose();
      const moving = state === 'walk' || state === 'run';
      this.blend += ((moving ? 1 : 0) - this.blend) * Math.min(1, dt * 10);
      if (moving) this.walkT += dt * (state === 'run' ? 13 : 8.5) * (st === 'slam' ? 0.7 : 1);
      const w = this.walkT, k = this.blend, amp = state === 'run' ? 1.35 : 1;
      const sw = Math.sin(w) * k * amp, bob = Math.abs(Math.cos(w)) * k * amp;
      // idle breathe (always on, fades while moving)
      const br = Math.sin(t * 2.0 + ph) * (1 - k * 0.7);
      let torsoX = 0.02 * br, torsoY = 0, headX = -0.015 * br, headY = Math.sin(t * 0.6 + ph) * 0.06 * (1 - k);
      let armRX = -0.04 * br + sw * 0.55, armLX = -0.04 * br - sw * 0.55, armRZ = -0.05 - 0.02 * br, armLZ = 0.05 + 0.02 * br;
      let legRX = -sw * 0.62, legLX = sw * 0.62, bodyY = (bob * 0.9 + 0.25 * br) * s, bodyX = 0.04 * k * amp;
      let capeX = 0.22 * k * amp + 0.03 * Math.sin(t * 1.7 + ph) + 0.05 * bob, weapX = 0, weapZ = 0, rootX = 0, sink = 0, shieldY = 0;
      if (B.torso) B.torso.scale.y = 1 + 0.012 * br;
      if (state === 'attack') {
        const p = Math.min(1, T / 0.42), wind = p < 0.35 ? p / 0.35 : 1, strike = p < 0.35 ? 0 : p < 0.6 ? (p - 0.35) / 0.25 : 1, rec = p < 0.6 ? 0 : (p - 0.6) / 0.4;
        const e = (x) => x * x * (3 - 2 * x);
        if (st === 'swing') { // overhead diagonal sword cut
          armRX = -2.5 * e(wind) + 1.9 * e(strike) + 0.6 * e(rec); armRZ = -0.35 * e(wind) + 0.4 * e(strike) - 0.05 * e(rec);
          torsoY = 0.35 * e(wind) - 0.7 * e(strike) + 0.35 * e(rec); torsoX = -0.08 * e(wind) + 0.22 * e(strike) - 0.14 * e(rec);
          weapX = -0.4 * e(wind) + 0.5 * e(strike) - 0.1 * e(rec); armLX = -0.5 * e(strike) * (1 - e(rec));
        } else if (st === 'bow') { // raise the bow, draw, loose
          armLX = -1.45 * e(wind) * (1 - e(rec)); armRX = -1.45 * e(wind) * (1 - e(rec)); armRZ = 0.5 * e(wind) * (1 - e(rec)) - 0.25 * e(strike) * (1 - e(rec));
          torsoY = 0.5 * e(wind) * (1 - e(rec)); headY = -0.4 * e(wind) * (1 - e(rec));
        } else if (st === 'cast') { // staff thrust forward with a flare
          armLX = -1.3 * e(wind) + 0.2 * e(strike) + 1.1 * e(rec); armRX = -0.9 * e(wind) * (1 - e(rec)); torsoX = 0.15 * e(strike) * (1 - e(rec));
        } else { // slam: club overhead and down
          armRX = -2.7 * e(wind) + 2.2 * e(strike) + 0.5 * e(rec); armLX = -0.6 * e(wind) + 0.9 * e(strike) - 0.3 * e(rec);
          torsoX = -0.2 * e(wind) + 0.45 * e(strike) - 0.25 * e(rec); bodyY -= 2 * e(strike) * (1 - e(rec)) * s;
        }
      } else if (state === 'action') { // cast / use loop
        const c = (T % 0.9) / 0.9, up = Math.sin(c * Math.PI);
        armRX = -1.2 - 0.3 * up; armLX = -1.2 - 0.3 * up; armRZ = -0.25; armLZ = 0.25; torsoX = -0.06 + 0.1 * up; headX = -0.1;
      } else if (state === 'hurt') {
        const h = Math.max(0, 1 - T / 0.28); torsoX = -0.35 * h; headX = -0.3 * h; armRZ -= 0.4 * h; armLZ += 0.4 * h; bodyX -= 0.1 * h;
      } else if (state === 'dead') {
        const d = Math.min(1, T / 0.55), e = d * d; rootX = -1.5 * e; sink = 0.05 * e;
        armRX = -0.6 * e; armLX = -0.9 * e; armRZ = -0.7 * e; armLZ = 0.7 * e; legRX = -0.2 * e; legLX = 0.15 * e; headX = -0.3 * e; capeX = 0;
      }
      this.add('torso', torsoX + bodyX, torsoY, 0); this.add('head', headX, headY, 0);
      this.add('armR', armRX, 0, armRZ); this.add('armL', armLX, shieldY, armLZ);
      this.add('legR', legRX, 0, 0); this.add('legL', legLX, 0, 0);
      this.add('cape', capeX, 0, 0); this.add('weapon', weapX, 0, weapZ);
      this.add('skirt', 0, 0, 0);
      R.body.position.y = bodyY - sink * (R.model.height || 1);
      if (rootX) R.body.rotation.x = rootX; // falling over pivots around the heels
    }
  }

  Object.assign(KV, { Hash, Colour, VoxelPart, VoxelMesher, VoxelModel, VoxelRig, VoxelAnimator });
})(typeof window !== 'undefined' ? window : globalThis);
