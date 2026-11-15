/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · skinned assets: textured 3D meshes (public/models/<id>.glb) made by projecting each Grok concept
   onto a 3D shape. Castle pieces, furniture and the heroes (static pose for now) use them when the file exists;
   everything else keeps today's voxel model, which is also what shows until a file has loaded.
     GlbParser       parses one-mesh glTF binaries (float or normalized-int attributes, KHR_mesh_quantization,
                     byteStride, optional indices, node translation / rotation / scale, one embedded image). DOM- and THREE-free.
     SkinnedFit      the scale that fits a model into a castle piece's footprint or a hero's height
     SkinnedAsset    one loaded model: shared geometry + material, hands out meshes
     SkinnedModels   the registry: which ids have a file (K.SKINNED_MODELS from the build), lazy loading, and
                     swapInto(group, id, fit), which replaces a fallback group's children once the model is ready
   Model space: y up, base at y = 0, centred on x / z, front facing +z (like the voxel heroes and castle pieces).
   Turn it off with ?skinned=0 in the page URL. */
(function (G) {
  const K = (G.K = G.K || {}), THREE = G.THREE;

  class GlbParser {
    static MAGIC = 0x46546c67;
    static TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    static NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
    static SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

    /* bytes: ArrayBuffer or Uint8Array -> { id, positions, normals, uvs, index, image: { bytes, mime }, extras, count } */
    parse(bytes) {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (u8.byteLength < 20 || dv.getUint32(0, true) !== GlbParser.MAGIC) throw new Error('not a glb file');
      if (dv.getUint32(4, true) !== 2) throw new Error('unsupported glb version ' + dv.getUint32(4, true));
      let off = 12, json = null, bin = null;
      while (off + 8 <= u8.byteLength) {
        const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), body = u8.subarray(off + 8, off + 8 + len);
        if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body)); else if (type === 0x004e4942) bin = body;
        off += 8 + len;
      }
      if (!json || !bin) throw new Error('glb is missing its json or binary chunk');
      const g = json, node = (g.nodes || []).find((n) => n.mesh != null);
      if (!node) throw new Error('glb has no mesh node');
      const prim = g.meshes[node.mesh].primitives[0], at = prim.attributes;
      if (at.POSITION == null) throw new Error('mesh has no positions');
      const positions = this.accessor(g, bin, at.POSITION), count = positions.length / 3;
      const normals = at.NORMAL != null ? this.accessor(g, bin, at.NORMAL) : null, uvs = at.TEXCOORD_0 != null ? this.accessor(g, bin, at.TEXCOORD_0) : null;
      this.transform(positions, normals, node);
      const index = prim.indices != null ? this.accessor(g, bin, prim.indices, true) : null;
      let image = null;
      const mat = prim.material != null ? g.materials[prim.material] : null, tx = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
      if (tx && g.textures && g.images) {
        const img = g.images[g.textures[tx.index].source], bv = img && img.bufferView != null ? g.bufferViews[img.bufferView] : null;
        if (bv) image = { bytes: bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), mime: img.mimeType || 'image/png' };
      }
      return { id: node.name || (g.extras && g.extras.id) || '', positions, normals, uvs, index, image, extras: g.extras || {}, count };
    }
    /* accessor -> Float32Array (normalized ints scaled to [-1, 1] / [0, 1]); raw=true keeps integer indices */
    accessor(g, bin, i, raw = false) {
      const a = g.accessors[i], bv = g.bufferViews[a.bufferView], T = GlbParser.TYPES[a.componentType], k = GlbParser.SIZE[a.type];
      if (!T || !k) throw new Error('unsupported accessor ' + a.componentType + ' ' + a.type);
      const es = T.BYTES_PER_ELEMENT, stride = bv.byteStride ? bv.byteStride / es : k, start = (bv.byteOffset || 0) + (a.byteOffset || 0);
      const src = new T(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + ((a.count - 1) * stride + k) * es));
      if (raw && stride === k) return src;
      const out = raw ? new T(a.count * k) : new Float32Array(a.count * k), n = a.normalized ? GlbParser.NORM[a.componentType] : 1;
      for (let e = 0; e < a.count; e++) for (let c = 0; c < k; c++) { const v = src[e * stride + c]; out[e * k + c] = raw ? v : a.normalized ? Math.max(v / n, -1) : v; }
      return out;
    }
    /* bake the node's scale, rotation (quaternion) and translation into the vertices */
    transform(P, N, node) {
      const s = node.scale || [1, 1, 1], t = node.translation || [0, 0, 0], q = node.rotation || [0, 0, 0, 1];
      const rot = (v, i) => {   // v' = v + w t + q x t, t = 2 (q x v)
        const [qx, qy, qz, qw] = q, x = v[i], y = v[i + 1], z = v[i + 2];
        const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
        v[i] = x + qw * tx + (qy * tz - qz * ty); v[i + 1] = y + qw * ty + (qz * tx - qx * tz); v[i + 2] = z + qw * tz + (qx * ty - qy * tx);
      };
      const hasRot = q[0] || q[1] || q[2];
      for (let i = 0; i < P.length; i += 3) { P[i] *= s[0]; P[i + 1] *= s[1]; P[i + 2] *= s[2]; if (hasRot) rot(P, i); P[i] += t[0]; P[i + 1] += t[1]; P[i + 2] += t[2]; }
      if (N) for (let i = 0; i < N.length; i += 3) {
        N[i] /= s[0]; N[i + 1] /= s[1]; N[i + 2] /= s[2]; if (hasRot) rot(N, i);
        const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
      }
    }
    /* model-space bounds of the parsed positions */
    static bounds(P) {
      const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) { const v = P[i + c]; if (v < b.min[c]) b.min[c] = v; if (v > b.max[c]) b.max[c] = v; }
      return b;
    }
  }

  /* how big a model is drawn: castle pieces fill their footprint, heroes stand at their voxel height */
  class SkinnedFit {
    /* uniform scale so the model's x / z extent fits inside footprint [w, d] (m) */
    static footprint(bounds, [w, d]) {
      const ex = bounds.max[0] - bounds.min[0], ez = bounds.max[2] - bounds.min[2];
      if (!(ex > 0) || !(ez > 0) || !(w > 0) || !(d > 0)) return 1;
      return Math.min(w / ex, d / ez);
    }
    /* uniform scale so the model is `height` tall */
    static height(bounds, height) { const h = bounds.max[1] - bounds.min[1]; return h > 0 && height > 0 ? height / h : 1; }
  }

  class SkinnedAsset {
    /* parsed: GlbParser output; texture: THREE.Texture or null */
    constructor(parsed, texture) {
      this.id = parsed.id; this.extras = parsed.extras; this.bounds = GlbParser.bounds(parsed.positions); this.tris = (parsed.index ? parsed.index.length : parsed.count) / 3;
      const geo = (this.geometry = new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(parsed.positions, 3));
      if (parsed.normals) geo.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3)); else geo.computeVertexNormals();
      if (parsed.uvs) geo.setAttribute('uv', new THREE.BufferAttribute(parsed.uvs, 2));
      if (parsed.index) geo.setIndex(new THREE.BufferAttribute(parsed.index, 1));
      geo.computeBoundingSphere();
      this.material = new THREE.MeshLambertMaterial({ map: texture || null, color: texture ? 0xffffff : 0x9a9aa0, side: THREE.DoubleSide });
    }
    /* a mesh sharing this asset's geometry and material, scaled by s */
    mesh(s = 1) {
      const m = new THREE.Mesh(this.geometry, this.material); m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true;
      m.name = 'skinned:' + this.id; m.userData.skinned = this.id; return m;
    }
  }

  class SkinnedModels {
    /* manifest: { base, ids } (K.SKINNED_MODELS, written by the build from public/models/*.glb); io: { fetch, texture } */
    constructor(manifest, io) {
      this.base = (manifest && manifest.base) || 'models/'; this.ids = new Set((manifest && manifest.ids) || []);
      this.io = io; this.parser = new GlbParser(); this.loads = new Map(); this.ready = new Map(); this.failed = new Set();
      this.enabled = true;
    }
    has(id) { return this.enabled && this.ids.has(id) && !this.failed.has(id); }
    get(id) { return this.ready.get(id) || null; }
    /* castle pieces: Level 2 uses <type>_lv2 when it exists, else the Level 1 model */
    pieceId(type, level = 1) { if (level >= 2 && this.has(type + '_lv2')) return type + '_lv2'; return this.has(type) ? type : null; }
    heroId(role) { const id = 'hero_' + role; return this.has(id) ? id : null; }
    /* -> Promise<SkinnedAsset|null>; one fetch per id however often it is asked for */
    load(id) {
      if (!this.has(id)) return Promise.resolve(null);
      if (this.loads.has(id)) return this.loads.get(id);
      const p = (async () => {
        try {
          const bytes = await this.io.fetch(this.base + id + '.glb'), parsed = this.parser.parse(bytes);
          const tex = parsed.image ? await this.io.texture(parsed.image) : null;
          const a = new SkinnedAsset(parsed, tex); a.id = id; this.ready.set(id, a); return a;
        } catch (e) { this.failed.add(id); if (G.console) G.console.warn('skinned model ' + id + ' failed: ' + (e && e.message)); return null; }
      })();
      this.loads.set(id, p); return p;
    }
    /* cb(asset) now if the model is loaded, else once it loads (never if it fails) */
    whenReady(id, cb) { const a = this.get(id); if (a) { cb(a); return; } this.load(id).then((x) => { if (x) cb(x); }); }
    /* replace group's drawn children with the skinned model once it is ready (frost shells stay).
       fit: { footprint: [w, d] } or { height: h } */
    swapInto(group, id, fit) {
      this.whenReady(id, (a) => {
        if (group.userData.skinned === id) return;
        for (const c of [...group.children]) if (!c.userData.frost) group.remove(c);
        const s = fit && fit.height ? SkinnedFit.height(a.bounds, fit.height) : fit && fit.footprint ? SkinnedFit.footprint(a.bounds, fit.footprint) : 1;
        group.add(a.mesh(s)); group.userData.skinned = id; delete group.userData.box;   // castle occlusion re-measures
      });
    }
  }

  /* browser io: fetch bytes; JPEG / PNG -> THREE.Texture without mipmaps (the per-triangle atlas bleeds at lower mips) */
  class BrowserSkinIO {
    async fetch(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return new Uint8Array(await r.arrayBuffer()); }
    async texture(image) {
      const blob = new Blob([image.bytes], { type: image.mime });
      const src = typeof createImageBitmap === 'function' ? await createImageBitmap(blob) : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
      const t = new THREE.Texture(src); t.flipY = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
    }
  }

  const off = G.location && /[?&]skinned=0\b/.test(G.location.search || '');
  K.SkinnedModels = new SkinnedModels(K.SKINNED_MODELS, new BrowserSkinIO());
  if (off) K.SkinnedModels.enabled = false;
  Object.assign(K, { GlbParser, SkinnedFit, SkinnedAsset, SkinnedModels, BrowserSkinIO });
})(typeof window !== 'undefined' ? window : globalThis);
