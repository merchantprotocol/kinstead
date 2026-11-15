/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · renderer: builds the diorama scene FROM the World document, chunk by chunk. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const V3 = THREE.Vector3;
  const { TILE, HQ, T, WorldDoc } = K;
  const CH = 32, PPU = 32;   // chunk = 32 x 32 tiles (16 x 16 world units), ground texture 32 texels per unit (diorama density)

  class TextureBank {
    constructor(renderer) { this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    canvasOf(buf) {
      const c = document.createElement('canvas'); c.width = buf.w; c.height = buf.h;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
      return c;
    }
    texOf(canvas, { srgb = true, mips = true } = {}) {
      const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = mips; t.flipY = false; t.anisotropy = this.aniso;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
    }
    pixel(buf, { repeat = false, srgb = true, mips = true, flipY = false } = {}) {
      const t = new THREE.CanvasTexture(this.canvasOf(buf));
      t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
      t.generateMipmaps = mips; t.flipY = flipY; t.anisotropy = this.aniso;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    }
  }

  /* Merges many transformed geometries into one indexed BufferGeometry */
  class GeometryBuilder {
    constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; this.count = 0; this._v = new V3(); this._m3 = new THREE.Matrix3(); }
    add(geo, matrix, uvMap) {
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      this._m3.getNormalMatrix(matrix);
      const base = this.count, v = this._v;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrix); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(this._m3).normalize(); this.n.push(v.x, v.y, v.z);
        let u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0;
        if (uvMap) [u, w] = uvMap(u, w); this.uv.push(u, w);
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
      else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
      this.count += pos.count;
      return this;
    }
    quad(a, b, c, d, normal, uvs) {
      // ensure CCW winding w.r.t. normal
      const e1 = new V3().subVectors(b, a), e2 = new V3().subVectors(c, a), cr = new V3().crossVectors(e1, e2);
      let pts = [a, b, c, d], u = uvs;
      if (cr.dot(normal) < 0) { pts = [a, d, c, b]; u = [uvs[0], uvs[3], uvs[2], uvs[1]]; }
      const base = this.count;
      pts.forEach((p, i) => { this.p.push(p.x, p.y, p.z); this.n.push(normal.x, normal.y, normal.z); this.uv.push(u[i][0], u[i][1]); });
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); this.count += 4;
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
  }
  const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
  const tileUV = (tile, n = 4) => (u, v) => [((tile % n) + u) / n, (((tile / n) | 0) + v) / n];

  const UNIT = { cone: new THREE.ConeGeometry(1, 1, 8, 1, false), trunk: new THREE.CylinderGeometry(0.6, 1, 1, 6), log: new THREE.CylinderGeometry(0.15, 0.16, 1.1, 8),
    stick: new THREE.CylinderGeometry(0.05, 0.06, 0.62, 6), pole: new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), bowl: new THREE.CylinderGeometry(0.28, 0.15, 0.22, 8), ico: new THREE.IcosahedronGeometry(1, 0) };

  /* the diorama's PropBuilder, made placeable: every piece goes through put(), which applies an optional local->world transform */
  class PropBuilder {
    constructor(doc) {
      this.doc = doc; this.rng = new K.RNG(1); this.xf = null;
      for (const k of PropBuilder.KEYS) this[k] = new GeometryBuilder();
      this.box = new THREE.BoxGeometry(1, 1, 1);
    }
    put(b, geo, m, uv) { if (this.xf) m = this.xf.clone().multiply(m); b.add(geo, m, uv); }
    block(x, y, z, w, h, d, ry = 0, tile, rx = 0, rz = 0) {
      const t = tile === undefined ? this.rng.int(0, 15) : tile;
      this.put(this.stone, this.box, M4(x, y + h / 2, z, rx, ry, rz, w, h, d), tileUV(t));
    }
    cap(x, y, z, w, d, ry = 0, th = 0.08) { this.put(this.snow, this.box, M4(x, y + th / 2, z, 0, ry, 0, w, th, d), tileUV(this.rng.int(0, 3), 1)); }
    /* ruined wall along a segment; prof(t) -> number of block rows; follows the ground under each block */
    wall(x0, z0, x1, z1, prof, depth = 0.42) {
      const R = this.rng, len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return;
      const dx = (x1 - x0) / len, dz = (z1 - z0) / len, ang = Math.atan2(-dz, dx), rowH = 0.3, doc = this.doc;
      for (let row = 0; row < 7; row++) {
        let s = row % 2 ? -0.18 : 0;
        while (s < len) {
          const w = Math.min(len - Math.max(0, s), R.range(0.34, 0.6)); const a = Math.max(0, s), mid = a + w / 2, t = mid / len;
          const n = prof(t);
          if (w > 0.06 && row < n) {
            const jx = R.range(-0.03, 0.03), cx = x0 + dx * mid - dz * jx, cz = z0 + dz * mid + dx * jx, g = doc.tileY(cx, cz);
            const bh = rowH * R.range(0.9, 1.05), y = g + row * rowH;
            this.block(cx, y, cz, w - 0.03, bh, depth * R.range(0.92, 1.06), ang + R.range(-0.05, 0.05));
            const topRow = row === n - 1 || (row === Math.floor(n) - 1);
            if (topRow && R.chance(0.82)) this.cap(cx, y + bh, cz, w + 0.02, depth + 0.07, ang + R.range(-0.04, 0.04), R.range(0.06, 0.11));
          } else if (row === n && R.chance(0.15)) {
            const side = R.chance(0.5) ? 1 : -1, cx = x0 + dx * mid - dz * side * 0.55, cz = z0 + dz * mid + dx * side * 0.55;
            this.block(cx, doc.tileY(cx, cz), cz, 0.42, 0.26, 0.36, R.range(0, 3), undefined, R.range(-0.2, 0.2), R.range(-0.2, 0.2));
          } else R.next();
          s += w;
        }
      }
    }
    pillar(x, z, rows, y0 = 0) {
      for (let r = 0; r < rows; r++) this.block(x + this.rng.range(-0.02, 0.02), y0 + r * 0.32, z, 0.56, 0.31, 0.56, this.rng.range(-0.08, 0.08));
      this.cap(x, y0 + rows * 0.32, z, 0.6, 0.6, 0, 0.12);
    }
    rubble(cx, cz, n, rad, y0 = 0) {
      const R = this.rng;
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), d = Math.sqrt(R.next()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const s = R.range(0.16, 0.36), y = y0 + (1 - d / rad) * rad * 0.42 - s * 0.3;
        this.block(x, y, z, s * R.range(1, 1.5), s * 0.8, s, R.range(0, 3), undefined, R.range(-0.5, 0.5), R.range(-0.5, 0.5));
        if (R.chance(0.35)) this.cap(x, y + s * 0.8, z, s * 1.1, s * 0.9, R.range(0, 3), 0.05);
      }
    }
    crateAt(x, y, z, s = 0.5, ry = 0, snow = true) {
      this.put(this.crate, this.box, M4(x, y + s / 2, z, 0, ry, 0, s, s, s));
      if (snow) this.cap(x, y + s, z, s * 0.9, s * 0.85, ry + 0.05, 0.06);
    }
    pineAt(x, y, z, H) {
      const R = this.rng;
      this.put(this.bark, UNIT.trunk, M4(x, y + H * 0.17, z, 0, 0, 0, 0.1 * H / 3, H * 0.35, 0.1 * H / 3));
      const tiers = 4 + (H > 4 ? 1 : 0), R0 = H * 0.3;
      for (let i = 0; i < tiers; i++) {
        const f = i / tiers, r = R0 * (1 - f * 0.78), th = H * 0.34 * (1 - f * 0.35);
        const yy = y + H * 0.2 + f * H * 0.68 + th / 2;
        this.put(this.pine, UNIT.cone, M4(x + R.range(-0.03, 0.03), yy, z, R.range(-0.04, 0.04), R.range(0, 6), R.range(-0.04, 0.04), r, th, r), (u, v) => [u * 2 + i * 0.37, v]);
      }
    }
    deadTree(x, y, z) {
      const R = this.rng;
      const seg = (p0, p1, r0, r1) => {
        const d = new V3().subVectors(p1, p0), L = d.length();
        const g = new THREE.CylinderGeometry(r1, r0, L, 6);
        const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
        const m = new THREE.Matrix4().compose(new V3().addVectors(p0, p1).multiplyScalar(0.5), q, new V3(1, 1, 1));
        this.put(this.bark, g, m, (u, v) => [u, v * L * 2]); g.dispose();
      };
      const pts = [new V3(x, y - 0.1, z), new V3(x + 0.08, y + 0.9, z - 0.05), new V3(x - 0.06, y + 1.7, z + 0.04), new V3(x + 0.12, y + 2.4, z)];
      for (let i = 0; i < 3; i++) seg(pts[i], pts[i + 1], 0.2 - i * 0.05, 0.15 - i * 0.05);
      const branch = (p, dir, len, r, depth) => {
        const e = p.clone().addScaledVector(dir, len); seg(p, e, r, r * 0.55);
        if (depth > 0) for (let k = 0; k < 2; k++) {
          const nd = dir.clone().add(new V3(R.range(-0.7, 0.7), R.range(0.1, 0.6), R.range(-0.7, 0.7))).normalize();
          branch(e, nd, len * 0.6, r * 0.55, depth - 1);
        }
      };
      [[1.0, -0.6, 0.55, 0.3], [1.5, 0.7, 0.5, -0.2], [2.0, -0.5, 0.7, 0.4], [2.3, 0.4, 0.8, 0.5], [1.2, 0.2, 0.4, 0.9]].forEach(([h, dx, dy, dz]) => {
        branch(new V3(x + 0.02, y + h, z), new V3(dx, dy, dz).normalize(), R.range(0.6, 0.95), 0.07, 2);
      });
    }
    fernAt(x, y, z, s = 0.42) {
      const R = this.rng, pl = new THREE.PlaneGeometry(s, s); pl.translate(0, s / 2 - 0.03, 0);
      const ry = R.range(0, Math.PI);
      this.put(this.fern, pl, M4(x, y, z, 0, ry, 0)); this.put(this.fern, pl, M4(x, y, z, 0, ry + Math.PI / 2, 0)); pl.dispose();
    }
    boulderAt(x, y, z, r) {
      const R = this.rng;
      this.put(this.boulder, UNIT.ico, M4(x, y + r * 0.35, z, R.range(0, 3), R.range(0, 3), R.range(0, 3), r * R.range(0.9, 1.3), r * R.range(0.6, 0.8), r * R.range(0.9, 1.2)), (u, v) => [u * 0.5, v * 0.5]);
    }

    /* ---------- World-document objects ---------- */
    static wallProf(o, segIdx) {
      const base = o.hs && o.hs[segIdx] != null ? o.hs[segIdx] : o.h == null ? 2.4 : o.h, amp = o.ruin == null ? 2.0 : o.ruin, seed = (o.seed | 0) + segIdx * 7;
      const gaps = (o.gaps || []).filter((g) => g[0] === segIdx);
      return (t) => {
        for (const g of gaps) if (t > g[1] && t < g[2]) return 0;
        return Math.max(0, Math.min(7, Math.round(base + (K.hash2((t * 9) | 0, 0, seed) - 0.5) * amp + Math.sin(t * 7 + seed) * amp * 0.4)));
      };
    }
    buildWall(o) {
      this.xf = null; this.rng = new K.RNG(o.seed | 0 || 1);
      const P = WorldDoc.wallPts(o), n = P.length - 1;
      for (let k = 0; k < n; k++) this.wall(P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], PropBuilder.wallProf(o, k), o.depth || 0.42);
      if (o.pillars !== false) {
        const corners = o.closed ? P.slice(0, n) : P;
        corners.forEach((p, k) => { const rows = Math.max(2, Math.round((o.h == null ? 2.4 : o.h) + 1.5 + this.rng.range(-1, 2))); this.pillar(p[0], p[1], rows, this.doc.tileY(p[0], p[1])); });
      }
    }
    buildBridge(o) {
      const doc = this.doc, [ax, az] = o.a, [bx, bz] = o.b, L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return;
      const ang = Math.atan2(-(bz - az), bx - ax), bw = o.w || 1.6, ca = Math.cos(ang), sa = Math.sin(ang);
      const R = (this.rng = new K.RNG(o.seed | 0 || 7));
      this.xf = M4(ax, 0, az, 0, ang, 0);
      const deck = (s) => WorldDoc.deckY(doc, o, s / L);
      const world = (s, n) => [ax + ca * s + sa * n, az - sa * s + ca * n];    // local (s along, n across) -> world x,z
      const floorAt = (s) => { let m = 99; for (const n of [-bw / 2, 0, bw / 2]) { const [x, z] = world(s, n); m = Math.min(m, doc.tileY(x, z)); } return m; };
      // deck + stone under-course
      const steps = Math.max(1, Math.round(L / 0.5)), sw = L / steps;
      for (let k = 0; k < steps; k++) {
        const s = (k + 0.5) * sw, y = deck(s);
        this.put(this.deck, this.box, M4(s, y - 0.15, 0, 0, 0, 0, sw, 0.3, bw));
        this.block(s, y - 0.42, 0, sw, 0.14, bw + 0.08, 0, 5);
      }
      // piers where the ground falls away, arches between landings and piers
      const npier = L > 3.2 ? Math.max(1, Math.round(L / 5.5)) : 0, piers = [];
      for (let k = 1; k <= npier; k++) piers.push((L * k) / (npier + 1));
      piers.forEach((ps) => {
        const fy = floorAt(ps), top = deck(ps) - 0.45; if (fy > top - 0.3) return;
        for (let y = fy - 0.1; y < top; y += 0.32) for (const [ox, oz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]])
          this.block(ps + ox + R.range(-0.02, 0.02), y, oz * (bw / 1.6), 0.52, Math.min(0.31, top - y + 0.01), 0.52, R.range(-0.04, 0.04));
      });
      const stops = [0.5, ...piers.flatMap((p) => [p - 0.55, p + 0.55]), L - 0.5];
      for (let k = 0; k + 1 < stops.length; k += 2) {
        const a = stops[k], b = stops[k + 1]; if (b - a < 0.6) continue;
        const cx = (a + b) / 2, r = (b - a) / 2;
        for (let q = 0; q <= 8; q++) {
          const an = Math.PI * (q / 8), s = cx - Math.cos(an) * r, top = deck(s) - 0.42;
          const y = Math.max(floorAt(s), top - r + Math.sin(an) * r - 0.1);
          for (let yy = y; yy < top - 0.05; yy += 0.3) this.block(s, yy, 0, 0.34, Math.min(0.3, top - yy), bw - 0.1, 0, undefined, 0, 0, Math.cos(an) * 0.5);
        }
      }
      // posts + wooden rails (a couple broken)
      const brokenA = R.int(1, 6), brokenB = R.int(1, 6);
      for (const side of [-1, 1]) {
        let prev = null, idx = 0;
        const np = Math.max(2, Math.round(L / 0.9) + 1);
        for (let k = 0; k < np; k++) {
          const s = 0.25 + (k / (np - 1)) * (L - 0.5), y = deck(s), z = side * (bw / 2 - 0.1);
          this.block(s, y, z, 0.2, 0.62, 0.2, 0, 2); this.cap(s, y + 0.62, z, 0.24, 0.24, 0, 0.07);
          if (prev && !(side === 1 && idx === brokenA) && !(side === -1 && idx === brokenB)) {
            const ms = (prev[0] + s) / 2, my = (prev[1] + y) / 2, len = s - prev[0], sl = Math.atan2(y - prev[1], len);
            this.put(this.wood, this.box, M4(ms, my + 0.48, z, 0, 0, sl, len, 0.07, 0.07));
            this.put(this.wood, this.box, M4(ms, my + 0.24, z, 0, 0, sl, len, 0.06, 0.06));
          }
          prev = [s, y]; idx++;
        }
      }
      this.xf = null;
    }
    buildProp(o, state) {
      const def = PropBuilder.PROPS[o.type]; if (!def || !def.build) return;
      const y = this.doc.groundY(o.x, o.z), s = o.s || 1;
      this.rng = new K.RNG(o.seed | 0 || 3);
      this.xf = M4(o.x, y, o.z, 0, o.rot || 0, 0, s, s, s);
      def.build(this, o, state || null);
      this.xf = null;
    }
    /* small round-ish clump from flat-shaded icosahedra (herbs, ore lumps) */
    clump(mat, x, y, z, r) { this.put(this[mat], UNIT.ico, M4(x, y + r * 0.5, z, this.rng.range(0, 3), this.rng.range(0, 3), 0, r, r * 0.8, r)); }
    static roleOf(o) {
      const def = PropBuilder.PROPS[o.type] || {};
      if (def.start) return 'player';
      if (!def.sprite) return null;
      return o.role || def.role || (def.group === 'Monsters' ? 'enemy' : 'npc');
    }
    static spriteOf(o) { const def = PropBuilder.PROPS[o.type] || {}; if (!def.sprite) return null; return (def.start ? o.hero : o.look) || def.sprite; }
  }
  PropBuilder.KEYS = ['stone', 'snow', 'wood', 'crate', 'bark', 'iron', 'deck', 'pine', 'boulder', 'fern', 'hole', 'ore', 'leaf'];
  /* prop catalogue: build() emits static geometry in local space; dyn describes fire/light/cloth/sprite parts */
  PropBuilder.PROPS = {
    campfire: { name: 'Campfire', group: 'Light', r: 0.6, build(pb) {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; pb.block(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, 0.2, 0.13, 0.17, a, i % 16); }
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; pb.put(pb.bark, UNIT.stick, M4(Math.cos(a) * 0.14, 0.17, Math.sin(a) * 0.14, Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0)); }
    }, dyn: { fire: [0, 0.1, 0, 1.0], light: [0, 0.6, 0, 1], embers: [0, 0.3, 0] } },
    torch: { name: 'Torch brazier', group: 'Light', r: 0.35, build(pb) {
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; pb.put(pb.iron, pb.box, M4(Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25, 0.05, 0.6, 0.05)); }
      pb.put(pb.iron, UNIT.bowl, M4(0, 0.66, 0));
    }, dyn: { fire: [0, 0.74, 0, 0.62], light: [0, 1.0, 0, 0.6], embers: [0, 0.8, 0] } },
    banner: { name: 'Banner', group: 'Ruins', r: 0.35, build(pb) {
      pb.put(pb.wood, UNIT.pole, M4(0, 1.2, 0)); pb.put(pb.wood, pb.box, M4(0.25, 2.3, 0, 0, 0, 0, 0.62, 0.05, 0.05));
    }, dyn: { banner: [0.27, 2.27, 0] } },
    pine: { name: 'Pine', group: 'Nature', r: 0.7, build(pb) { pb.pineAt(0, -0.05, 0, 3.2 * pb.rng.range(0.85, 1.2)); } },
    deadtree: { name: 'Dead tree', group: 'Nature', r: 0.5, build(pb) { pb.deadTree(0, 0, 0); } },
    shrub: { name: 'Shrub', group: 'Nature', r: 0.35, build(pb) { const R = pb.rng; pb.fernAt(0, 0, 0, R.range(0.36, 0.5)); for (let i = 0; i < 2; i++) pb.fernAt(R.range(-0.3, 0.3), 0, R.range(-0.3, 0.3), R.range(0.3, 0.42)); } },
    rock: { name: 'Rock', group: 'Nature', r: 0.45, build(pb) { pb.boulderAt(0, 0, 0, 0.42); } },
    rubble: { name: 'Rubble pile', group: 'Ruins', r: 0.6, build(pb) { pb.rubble(0, 0, 10, 0.55); } },
    crate: { name: 'Crate', group: 'Ruins', r: 0.35, build(pb) { pb.crateAt(0, 0, 0, 0.52, 0); } },
    crates: { name: 'Crate stack', group: 'Ruins', r: 0.6, build(pb) { pb.crateAt(0, 0, 0, 0.55, 0.2); pb.crateAt(0.55, 0, -0.15, 0.45, -0.3); pb.crateAt(0.1, 0.55, 0, 0.42, 0.5); } },
    pillar: { name: 'Pillar', group: 'Ruins', r: 0.4, build(pb) { pb.pillar(0, 0, 4 + pb.rng.int(0, 2)); } },
    log: { name: 'Log bench', group: 'Ruins', r: 0.6, build(pb) {
      pb.put(pb.bark, UNIT.log, M4(0, 0.15, 0, 0, 0, Math.PI / 2)); pb.cap(0, 0.27, 0, 0.9, 0.16, 0, 0.05);
    } },
    'start': { name: 'Player start', group: 'Characters', r: 0.45, sprite: 'warden', start: true, build(pb) {
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pb.block(Math.cos(a) * 0.5, -0.06, Math.sin(a) * 0.5, 0.16, 0.12, 0.12, -a, 5 + (i % 3)); }
    } },
    'sprite:warden': { name: 'The Warden', group: 'Characters', r: 0.4, sprite: 'warden' },
    'npc:merchant': { name: 'Merchant', group: 'Characters', r: 0.45, sprite: 'witch', role: 'merchant', build(pb) { pb.crateAt(0.42, 0, -0.2, 0.36, 0.3); pb.crateAt(-0.45, 0, -0.15, 0.3, -0.2); } },
    'sprite:witch': { name: 'Rime Witch', group: 'Characters', r: 0.4, sprite: 'witch', dyn: { staff: true } },
    'sprite:ghoulA': { name: 'Frost Ghoul', group: 'Monsters', r: 0.4, sprite: 'ghoulA' },
    'sprite:ghoulB': { name: 'Pale Ghoul', group: 'Monsters', r: 0.4, sprite: 'ghoulB' },
    'sprite:troll': { name: 'Rime Troll', group: 'Monsters', r: 0.7, sprite: 'troll' },
    /* resource nodes: play mode looks up `interact` in the interaction registry; build(pb, o, state) draws the depleted look */
    'res:ore': { name: 'Ore vein', group: 'Resources', r: 0.55, h: 0.9, interact: 'ore', build(pb, o, st) {
      if (st === 'depleted') { pb.rubble(0, 0, 6, 0.4); return; }
      pb.boulderAt(0, 0, 0, 0.52); pb.boulderAt(0.38, 0, 0.2, 0.3); pb.boulderAt(-0.3, 0, 0.25, 0.24);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + pb.rng.range(-0.3, 0.3); pb.clump('ore', Math.cos(a) * 0.42, 0.1 + pb.rng.range(0, 0.2), Math.sin(a) * 0.36, pb.rng.range(0.11, 0.16)); }
      pb.clump('ore', 0.05, 0.38, 0.12, 0.14); pb.clump('ore', -0.16, 0.33, -0.1, 0.12);
      pb.cap(-0.05, 0.42, -0.05, 0.36, 0.3, 0.4, 0.06);
    } },
    'res:pine': { name: 'Choppable pine', group: 'Resources', r: 0.6, h: 3, interact: 'tree', build(pb, o, st) {
      pb.put(pb.bark, UNIT.log, M4(0.55, 0.13, 0.35, 0, 0.4, Math.PI / 2, 0.9, 0.7, 0.9)); pb.put(pb.bark, UNIT.log, M4(0.62, 0.13, 0.62, 0, 0.5, Math.PI / 2, 0.9, 0.7, 0.9));
      if (st === 'depleted') { pb.put(pb.bark, UNIT.trunk, M4(0, 0.13, 0, 0, 0, 0, 0.13, 0.26, 0.13)); pb.cap(0, 0.26, 0, 0.26, 0.26, 0, 0.05); return; }
      pb.pineAt(0, -0.05, 0, 2.9 * pb.rng.range(0.92, 1.08));
    } },
    'res:herb': { name: 'Herb patch', group: 'Resources', r: 0.4, h: 0.5, interact: 'herb', build(pb, o, st) {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pb.block(Math.cos(a) * 0.42, -0.05, Math.sin(a) * 0.42, 0.12, 0.1, 0.1, -a, 9 + (i % 4)); }
      if (st === 'depleted') { pb.fernAt(0, 0, 0, 0.16); return; }
      pb.fernAt(0, 0, 0, 0.38); pb.fernAt(0.18, 0, 0.12, 0.3); pb.fernAt(-0.17, 0, -0.08, 0.32);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; pb.clump('leaf', Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 0.09); }
    } },
    'res:fish': { name: 'Ice-fishing hole', group: 'Resources', r: 0.5, h: 0.4, interact: 'fish', build(pb, o, st) {
      const disc = new THREE.CylinderGeometry(0.36, 0.36, 0.04, 12);
      pb.put(st === 'depleted' ? pb.snow : pb.hole, disc, M4(0, 0.0, 0)); disc.dispose();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; pb.cap(Math.cos(a) * 0.43, -0.02, Math.sin(a) * 0.43, 0.2, 0.12, -a, 0.08); }
      pb.put(pb.bark, UNIT.stick, M4(0.5, 0.22, -0.32, 0.25, 0, 0.55)); pb.crateAt(-0.55, 0, 0.3, 0.26, 0.4);
    } },
  };
  WorldDoc.wallPts = (o) => (o.closed ? o.pts.concat([o.pts[0]]) : o.pts);

  class SpriteActor {
    constructor(sprite, bank, opts = {}) {
      this.sprite = sprite; this.frame = 0; this.phase = opts.phase || 0; this.flip = !!opts.flip;
      const nF = sprite.frames.length, W = sprite.w, H = sprite.h;
      const sheet = new K.PixelBuffer(W * nF, H), gsheet = new K.PixelBuffer(W * nF, H);
      sprite.frames.forEach((f, i) => sheet.blit(f, i * W, 0)); sprite.glows.forEach((f, i) => gsheet.blit(f, i * W, 0));
      this.map = bank.pixel(sheet, { mips: false, flipY: true }); this.map.repeat.set(1 / nF * (this.flip ? -1 : 1), 1);
      this.gmap = bank.pixel(gsheet, { mips: false, flipY: true }); this.gmap.repeat.copy(this.map.repeat);
      if (this.flip) { this.map.wrapS = this.gmap.wrapS = THREE.RepeatWrapping; }
      const w = W / sprite.ppu, h = H / sprite.ppu;
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2 - (opts.sink || 1 / sprite.ppu), 0);
      const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 0.42, 0.91);
      this.mat = new THREE.MeshLambertMaterial({ map: this.map, alphaTest: 0.5, emissive: new THREE.Color(0.2, 0.22, 0.27), emissiveMap: this.map });
      this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.castShadow = true;
      this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.map, alphaTest: 0.5 });
      this.glowMat = new THREE.MeshBasicMaterial({ map: this.gmap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(3.2, 3.2, 3.2) });
      this.glow = new THREE.Mesh(geo, this.glowMat); this.glow.position.z = 0.012; this.glow.renderOrder = 5;
      this.group = new THREE.Group(); this.group.add(this.mesh, this.glow);
      // pixelated blob shadow
      this.group.position.set(opts.x, opts.y, opts.z);
      this.shadow = SpriteActor.blob(bank, w * 0.75);
      this.shadow.position.set(opts.x, opts.y + 0.015, opts.z);
      this.setFrame(0);
    }
    static blob(bank, size) {
      const b = new K.PixelBuffer(16, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 8, (y + 0.5 - 4) / 4);
        if (d < 1) b.set(x, y, [8, 10, 18], d < 0.6 ? 150 : 90);
      }
      const t = bank.pixel(b, { mips: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: 0xffffff }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
      return m;
    }
    setFrame(f) {
      const nF = this.sprite.frames.length; this.frame = f % nF;
      const off = this.flip ? (this.frame + 1) / nF : this.frame / nF;
      this.map.offset.x = off; this.gmap.offset.x = off;
    }
    update(t, yaw) {
      this.setFrame(Math.floor(t * 6 + this.phase));
      this.group.rotation.y = yaw;
    }
  }


  /* falling snow that wraps around the camera target, so any world size is covered */
  class SnowField {
    constructor(count) {
      const R = new K.RNG(5), p = new Float32Array(count * 3), s = new Float32Array(count);
      for (let i = 0; i < count; i++) { p[i * 3] = R.range(0, 44); p[i * 3 + 1] = R.range(0, 22); p[i * 3 + 2] = R.range(0, 44); s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uC: { value: new THREE.Vector3() }, uScale: { value: 900 } };
      const m = new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: false, depthWrite: true,
        vertexShader: `attribute float seed; uniform float uTime; uniform vec3 uC; uniform float uScale; varying float vS;
          void main(){ vec3 p=position; float sp=0.55+seed*0.6;
            p.y = uC.y - 10.0 + mod(p.y - uTime*sp - uC.y, 22.0);
            p.x += sin(uTime*0.7+seed*40.0)*0.35 + uTime*0.18; p.z += cos(uTime*0.5+seed*20.0)*0.25;
            p.x = uC.x - 22.0 + mod(p.x - uC.x + 22.0, 44.0); p.z = uC.z - 22.0 + mod(p.z - uC.z + 22.0, 44.0);
            vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; vS=seed;
            gl_PointSize = max(1.0, (0.035+seed*0.03)*uScale/-mv.z); }`,
        fragmentShader: `varying float vS; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard; gl_FragColor=vec4(vec3(0.85,0.9,1.0)*(0.9+vS*0.4),1.0);}`,
      });
      this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    }
    update(t, h, c) { this.uni.uTime.value = t; this.uni.uScale.value = h * 1.05; this.uni.uC.value.copy(c); }
  }
  class EmberField {
    constructor(sources) {
      const n = 60 * sources.length, p = new Float32Array(n * 3), s = new Float32Array(n);
      const R = new K.RNG(8);
      for (let i = 0; i < n; i++) { const o = sources[i % sources.length]; p[i * 3] = o[0]; p[i * 3 + 1] = o[1]; p[i * 3 + 2] = o[2]; s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uScale: { value: 900 } };
      this.points = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
          void main(){ float life=fract(uTime*0.35+seed*7.13); vec3 p=position; p.y+=life*2.2+0.2; p.x+=sin(life*6.0+seed*30.0)*0.25*life; p.z+=cos(life*5.0+seed*17.0)*0.2*life;
            vA=1.0-life; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,0.05*uScale/-mv.z); }`,
        fragmentShader: `varying float vA; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard; gl_FragColor=vec4(vec3(5.0,1.9,0.5)*vA,1.0);}`,
      }));
      this.points.frustumCulled = false;
    }
    update(t, h) { this.uni.uTime.value = t; this.uni.uScale.value = h; }
  }

  /* paints ground bands on worker threads (same painter code, run from this file's own source) */
  class PaintPool {
    constructor() {
      this.jobs = new Map(); this.seq = 1; this.workers = []; this.busy = 0;
      if (G.KINSTEAD_NO_WORKERS) return;
      try {
        const src = '(' + G.KPaintModules.toString() + ')();\n' +
          'const P = new K.GroundPainter(7);\n' +
          'onmessage = (e) => { const m = e.data, d = new K.WorldDoc(m.w, m.h); d.terrain = m.terrain; d.height = m.height;\n' +
          '  const [i0, j0, i1, j1] = m.rect, tp = K.TILE * m.ppu, W = (i1 - i0) * tp, H = (j1 - j0) * tp;\n' +
          '  const out = new K.PixelBuffer(W, H), spark = new K.PixelBuffer(W, H);\n' +
          '  P.paint(d, out, spark, i0, j0, i0, j0, i1, j1, m.ppu);\n' +
          '  postMessage({ id: m.id, data: out.data, sdata: spark.data }, [out.data.buffer, spark.data.buffer]); };';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
        for (let i = 0; i < n; i++) {
          const w = new Worker(url); w.onmessage = (e) => this.done(e.data); w.onerror = (e) => { console.warn('paint worker failed; painting on the main thread', e.message); this.workers = []; };
          w.free = true; this.workers.push(w);
        }
      } catch (e) { console.warn('paint workers unavailable; painting on the main thread', e); this.workers = []; }
    }
    get ok() { return this.workers.length > 0; }
    get idle() { return this.workers.some((w) => w.free); }
    send(job, doc) {
      const w = this.workers.find((x) => x.free); if (!w) return false;
      job.id = this.seq++; job.worker = w; w.free = false; this.jobs.set(job.id, job);
      w.postMessage({ id: job.id, w: doc.w, h: doc.h, terrain: doc.terrain.slice(), height: doc.height.slice(), rect: job.rect, ppu: PPU });
      return true;
    }
    done(m) { const job = this.jobs.get(m.id); if (!job) return; this.jobs.delete(m.id); job.worker.free = true; job.cb(m); }
    cancelAll() { for (const j of this.jobs.values()) j.cb = () => {}; }
  }

  /* one 32x32-tile block of the world: ground texture + terrain mesh + merged prop meshes */
  class Chunk {
    constructor(R, ci, cj) {
      const doc = R.doc;
      this.R = R; this.ci = ci; this.cj = cj; this.i0 = ci * CH; this.j0 = cj * CH;
      this.i1 = Math.min(doc.w, this.i0 + CH); this.j1 = Math.min(doc.h, this.j0 + CH);
      const tw = (this.i1 - this.i0) * TILE * PPU, th = (this.j1 - this.j0) * TILE * PPU;
      const buf = new K.PixelBuffer(tw, th), spark = new K.PixelBuffer(tw, th);
      buf.fill(K.TP.snow[3]); spark.fill([0, 0, 0]);
      this.canvas = R.bank.canvasOf(buf); this.scanvas = R.bank.canvasOf(spark);
      this.ctx = this.canvas.getContext('2d'); this.sctx = this.scanvas.getContext('2d');
      this.tex = R.bank.texOf(this.canvas); this.stex = R.bank.texOf(this.scanvas, { srgb: false, mips: false });
      this.mat = R.makeTopMaterial(this.tex, this.stex);
      this.group = new THREE.Group(); R.scene.add(this.group);
      this.terrain = []; this.props = [];
      this.dirtyT = new Uint8Array((this.i1 - this.i0) * (this.j1 - this.j0)); this.ver = new Uint32Array(this.dirtyT.length); this.nDirty = 0; this.inflight = 0; this.flying = new Set();
      this.geoDirty = true; this.propsDirty = true; this.painted = false; this.sig = '';
    }
    queuePaint(i0, j0, i1, j1) {
      i0 = Math.max(this.i0, i0); j0 = Math.max(this.j0, j0); i1 = Math.min(this.i1, i1); j1 = Math.min(this.j1, j1);
      if (i0 >= i1 || j0 >= j1) return;
      const cw = this.i1 - this.i0;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const q = (j - this.j0) * cw + (i - this.i0); this.dirtyT[q] = 1; this.ver[q]++; }
      this.nDirty = 1;
    }
    get paintQueue() { return this.nDirty ? [1] : []; }
    /* take the next band of dirty tiles (up to 4 rows, only the dirty x-range) */
    nextBand(rows) {
      if (!this.nDirty) return null;
      const cw = this.i1 - this.i0, chh = this.j1 - this.j0, D = this.dirtyT;
      let r = -1;
      for (let jj = 0; jj < chh && r < 0; jj++) for (let ii = 0; ii < cw; ii++) if (D[jj * cw + ii]) { r = jj; break; }
      if (r < 0) { this.nDirty = 0; return null; }
      let a = cw, b = -1; const r1 = Math.min(chh, r + rows);
      for (let jj = r; jj < r1; jj++) for (let ii = 0; ii < cw; ii++) if (D[jj * cw + ii]) { a = Math.min(a, ii); b = Math.max(b, ii); D[jj * cw + ii] = 0; }
      const rect = [this.i0 + a, this.j0 + r, this.i0 + b + 1, this.j0 + r1], vers = [];
      for (let j = rect[1]; j < rect[3]; j++) for (let i = rect[0]; i < rect[2]; i++) vers.push(this.ver[(j - this.j0) * cw + (i - this.i0)]);
      return { rect, vers };
    }
    /* copy a painted band into the chunk canvases, skipping tiles that were edited again since it was sent */
    blit(band, data, sdata) {
      const [i0, j0, i1, j1] = band.rect, tp = TILE * PPU, W = (i1 - i0) * tp, H = (j1 - j0) * tp, cw = this.i1 - this.i0;
      const img = new ImageData(new Uint8ClampedArray(data.buffer || data), W, H), simg = new ImageData(new Uint8ClampedArray(sdata.buffer || sdata), W, H);
      const ox = (i0 - this.i0) * tp, oy = (j0 - this.j0) * tp;
      let q = 0, stale = 0;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++, q++) if (this.ver[(j - this.j0) * cw + (i - this.i0)] !== band.vers[q]) stale++;
      if (!stale) { this.ctx.putImageData(img, ox, oy); this.sctx.putImageData(simg, ox, oy); }
      else {
        q = 0;
        for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++, q++) {
          if (this.ver[(j - this.j0) * cw + (i - this.i0)] !== band.vers[q]) continue;
          const dx = (i - i0) * tp, dy = (j - j0) * tp;
          this.ctx.putImageData(img, ox, oy, dx, dy, tp, tp); this.sctx.putImageData(simg, ox, oy, dx, dy, tp, tp);
        }
      }
      this.texDirty = true; this.R.lastBlitAt = performance.now();
    }
    paintStep(pool) {
      const R = this.R;
      if (pool && pool.ok) {
        if (!pool.idle) return false;
        const band = this.nextBand(4); if (!band) return false;
        band.cb = (m) => { if (!this.flying.delete(band)) return; this.inflight--; if (!this.disposed) { this.blit(band, m.data, m.sdata); R.pumpPaint(); } };
        this.inflight++; this.flying.add(band); pool.send(band, R.doc); return true;
      }
      const band = this.nextBand(2); if (!band) return false;
      const [i0, j0, i1, j1] = band.rect, tp = TILE * PPU, W = (i1 - i0) * tp, H = (j1 - j0) * tp;
      const out = new K.PixelBuffer(W, H), spark = new K.PixelBuffer(W, H);
      R.painter.paint(R.doc, out, spark, i0, j0, i0, j0, i1, j1, PPU);
      this.blit(band, out.data, spark.data);
      return true;
    }
    flushTex() { if (this.texDirty) { this.tex.needsUpdate = true; this.stex.needsUpdate = true; this.texDirty = false; } }
    clear(list) { list.forEach((m) => { this.group.remove(m); m.geometry.dispose(); }); list.length = 0; }
    buildTerrain() {
      const doc = this.R.doc, R = this.R; this.clear(this.terrain);
      const top = new GeometryBuilder(), cliff = new GeometryBuilder(), rock = new GeometryBuilder();
      const up = new V3(0, 1, 0), cw = (this.i1 - this.i0) * TILE, cd = (this.j1 - this.j0) * TILE, X0 = this.i0 * TILE, Z0 = this.j0 * TILE;
      const uv = (x, z) => [(x - X0) / cw, (z - Z0) / cd];
      const sides = [[1, 0, new V3(1, 0, 0)], [-1, 0, new V3(-1, 0, 0)], [0, 1, new V3(0, 0, 1)], [0, -1, new V3(0, 0, -1)]];
      for (let j = this.j0; j < this.j1; j++) {
        // merge horizontal runs of equal height into one top quad (keeps vertex counts low on big plateaus)
        let i = this.i0;
        while (i < this.i1) {
          const y = doc.hy(i, j); let e = i + 1; while (e < this.i1 && doc.hy(e, j) === y) e++;
          const x0 = i * TILE, x1 = e * TILE, z0 = j * TILE, z1 = z0 + TILE;
          top.quad(new V3(x0, y, z0), new V3(x0, y, z1), new V3(x1, y, z1), new V3(x1, y, z0), up, [uv(x0, z0), uv(x0, z1), uv(x1, z1), uv(x1, z0)]);
          i = e;
        }
        for (let i2 = this.i0; i2 < this.i1; i2++) {
          const y = doc.hy(i2, j), x0 = i2 * TILE, z0 = j * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
          for (const [di, dj, nrm] of sides) {
            const yn = doc.hy(i2 + di, j + dj); if (yn >= y) continue;
            let ax, az, bx, bz;
            if (di === 1) { ax = x1; az = z0; bx = x1; bz = z1; } else if (di === -1) { ax = x0; az = z1; bx = x0; bz = z0; }
            else if (dj === 1) { ax = x1; az = z1; bx = x0; bz = z1; } else { ax = x0; az = z0; bx = x1; bz = z0; }
            const b = y >= 1.5 ? rock : cliff;
            const ua = (di !== 0 ? az : ax) / 8, ub = (di !== 0 ? bz : bx) / 8;
            b.quad(new V3(ax, y, az), new V3(bx, y, bz), new V3(bx, yn, bz), new V3(ax, yn, az), nrm, [[ua, 0], [ub, 0], [ub, (y - yn) / 10], [ua, (y - yn) / 10]]);
          }
        }
      }
      const add = (gb, mat, cast) => { if (!gb.count) return; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast; m.receiveShadow = true; m.userData.terrain = true; this.group.add(m); this.terrain.push(m); };
      add(top, this.mat, false); add(cliff, R.mats.cliff, true); add(rock, R.mats.rock, true);
      this.geoDirty = false;
    }
    buildProps(objs) {
      const R = this.R; this.clear(this.props);
      const pb = new PropBuilder(R.doc);
      for (const o of objs) {
        try {
          if (o.kind === 'building') continue;   // buildings are meshes of the renderer's BuildingSet, not chunk geometry
          if (o.kind === 'wall') pb.buildWall(o); else if (o.kind === 'bridge') pb.buildBridge(o); else if (o.kind === 'prop') pb.buildProp(o, R.propState.get(o.id));
        } catch (e) { console.warn('object ' + o.id + ' failed to build', e); }
      }
      for (const k of PropBuilder.KEYS) {
        const gb = pb[k]; if (!gb.count) continue;
        const m = new THREE.Mesh(gb.build(), R.mats[k]); m.castShadow = k !== 'fern'; m.receiveShadow = true; this.group.add(m); this.props.push(m);
      }
      this.propsDirty = false;
    }
    dispose() {
      this.disposed = true; this.clear(this.terrain); this.clear(this.props); this.R.scene.remove(this.group);
      this.tex.dispose(); this.stex.dispose(); this.mat.dispose();
    }
  }

  /* the scene: lights, atmosphere, chunks, dynamic parts (fires, banners, sprites) */
  class WorldRenderer {
    constructor(renderer) {
      this.renderer = renderer; this.scene = new THREE.Scene();
      this.painter = new K.GroundPainter(7); this.texPainter = new K.TexturePainter(7); this.bank = new TextureBank(renderer);
      this.lib = new K.CharacterLibrary();
      this.pool = new PaintPool(); this.chunks = []; this.dyn = new Map(); this.lightSrc = []; this.anim = new Map(); this.fires = new Map(); this.actors = new Map(); this.propState = new Map();
      this.target = new V3();
      const S = this.scene;
      S.background = new THREE.Color('#1a2131');
      S.fog = new THREE.Fog('#26324a', 30, 70);
      this.sparkUni = { uTime: { value: 0 } };
      this.makeMaterials(); this.makeLights(); this.makeAtmosphere();
      // buildings: one BuildingSet for the whole world (meshes, interior lights, smoke, roof cut-away)
      this.bmats = new K.BuildingMaterials(this.bank);
      this.buildings = new K.BuildingSet({ mats: this.bmats, fireTex: this.fireTex, catalog: K.FURNITURE }).attach(this);
      this.buildingSig = null;
    }
    /* rebuild building meshes when (and only when) a building's JSON changed; force after terrain edits under them */
    syncBuildings(force) {
      const doc = this.doc, list = doc.buildings(), sig = JSON.stringify(list.map((b) => [b, doc.objects.indexOf(b) >= 0]));
      if (!force && sig === this.buildingSig) return false;
      this.buildingSig = sig;
      const inside = this.buildings.inside && this.buildings.inside.spec.id, cam = this.buildings.inside && this.buildings.inside.camera;
      this.buildings.setBuildings(list, doc);
      doc.floorAt = list.length ? (i, j) => this.buildings.floorY(i, j) : null;
      if (inside && this.buildings.get(inside)) { const b = this.buildings.get(inside); this.buildings.inside = b; b.setInterior(true, { camera: cam, snap: true }); }
      if (this.onBuildings) this.onBuildings();
      return true;
    }
    makeTopMaterial(tex, stex) {
      const m = new THREE.MeshLambertMaterial({ map: tex });
      const su = this.sparkUni;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = su.uTime; sh.uniforms.sparkMap = { value: stex };
        sh.fragmentShader = 'uniform float uTime; uniform sampler2D sparkMap;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           vec4 spk = texture2D(sparkMap, vMapUv);
           float tw = spk.r * pow(max(0.0, sin(uTime*1.7 + spk.g*40.0 + (cameraPosition.x*0.9 + cameraPosition.z*0.6)*2.5)), 30.0);
           totalEmissiveRadiance += vec3(0.85,0.95,1.0) * tw * 4.0;`);
      };
      m.customProgramCacheKey = () => 'kinstead-top';
      return m;
    }
    makeMaterials() {
      const P = this.texPainter, B = this.bank;
      const cliffTex = B.pixel(P.cliff(false), { repeat: true }), rockTex = B.pixel(P.cliff(true), { repeat: true });
      cliffTex.wrapT = rockTex.wrapT = THREE.ClampToEdgeWrapping;
      const lam = (t, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map: t }, o));
      const stoneTex = B.pixel(P.stoneAtlas()), snowTex = B.pixel(P.snowCap());
      this.mats = {
        cliff: lam(cliffTex), rock: lam(rockTex), stone: lam(stoneTex), snow: lam(snowTex),
        deck: lam(B.pixel(P.deck(), { repeat: true })), wood: lam(B.pixel(P.planks(32, 32))), crate: lam(B.pixel(P.planks(16, 16, true))),
        bark: lam(B.pixel(P.bark(), { repeat: true })), iron: lam(B.pixel(P.iron())),
        pine: lam(B.pixel(P.pine(), { repeat: true }), { flatShading: true }), boulder: lam(stoneTex, { flatShading: true }),
        fern: lam(B.pixel(P.fern(), { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide }),
        banner: lam(B.pixel(P.banner(), { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide }),
        hole: lam(B.pixel(WorldRenderer.pattern(K.ramp('#050b14', '#0b1a2a', '#10263c', '#1d4566', '#3a7499'), 21, 0.35))),
        ore: lam(B.pixel(WorldRenderer.pattern(K.ramp('#3a1a0a', '#7a3a14', '#b0602a', '#e09a4a', '#ffd08a'), 22, 0.6)), { flatShading: true }),
        leaf: lam(B.pixel(WorldRenderer.pattern(K.ramp('#10241a', '#1f4a2c', '#2f6a3c', '#4a8a50', '#9fd0b8'), 23, 0.55)), { flatShading: true }),
      };
      const fireFrames = P.fire();
      this.fireSheet = new K.PixelBuffer(16 * 4, 24); fireFrames.forEach((f, i) => this.fireSheet.blit(f, i * 16, 0));
      this.fireTex = B.pixel(this.fireSheet, { mips: false, flipY: true });
      this.spriteTex = {};
    }
    /* tiny dithered noise texture from a ramp (resource materials) */
    static pattern(pal, seed, spread) {
      const b = new K.PixelBuffer(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) b.set(x, y, K.rampPick(pal, 0.5 + (K.hash2(x >> 1, y >> 1, seed) - 0.5) * spread * 2, x, y, 0.6));
      return b;
    }
    /* per-object visual state (e.g. a depleted ore vein) -> rebuild that object's chunk */
    setPropState(id, st) {
      if (st) this.propState.set(id, st); else this.propState.delete(id);
      const o = this.doc && this.doc.obj(id); const c = o && this.anchorChunk(o); if (c) c.propsDirty = true;
    }
    clearPropStates() { const ids = [...this.propState.keys()]; this.propState.clear(); ids.forEach((id) => this.setPropState(id, null)); }
    /* the static sprite markers placed in the editor (hidden while play mode spawns live actors) */
    setStaticActorsVisible(v) { for (const a of this.actors.values()) { a.group.visible = v; a.shadow.visible = v; } }
    makeLights() {
      const S = this.scene;
      S.add(new THREE.HemisphereLight('#7f9cd0', '#1c2230', 1.25));
      const sun = new THREE.DirectionalLight('#ffd6a8', 2.4);
      this.sunOff = new V3(-10, 9, 9);
      sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
      const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 70;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
      S.add(sun, sun.target); this.sun = sun;
      const rim = new THREE.DirectionalLight('#6d8ee0', 0.6); rim.position.set(30, 12, -10); S.add(rim);
      // fixed pool of point lights handed to the light sources nearest the view (keeps shaders stable)
      this.lightPool = [];
      for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ff8a3c', 0, 9, 1.4); l.position.set(0, -50, 0); S.add(l); this.lightPool.push(l); }
    }
    makeAtmosphere() {
      const N = 128, fb = new K.PixelBuffer(N, N), n = new K.Noise(3);
      const tile = (a, b) => n.fbm(a / 22, b / 22, 4);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / N, fy = y / N;
        const s = tile(x, y) * (1 - fx) * (1 - fy) + tile(x + N, y) * fx * (1 - fy) + tile(x, y + N) * (1 - fx) * fy + tile(x + N, y + N) * fx * fy;
        fb.set(x, y, [255, 255, 255], Math.max(0, Math.min(255, (s - 0.32) * 520)));
      }
      this.fogTex = new THREE.CanvasTexture(this.bank.canvasOf(fb)); this.fogTex.wrapS = this.fogTex.wrapT = THREE.RepeatWrapping;
      this.fogLayers = [];
      this.snow = new SnowField(3400); this.scene.add(this.snow.points);
      this.embers = null;
    }
    buildFog() {
      this.fogLayers.forEach((f) => { this.scene.remove(f.m); f.m.geometry.dispose(); f.t.dispose(); });
      this.fogLayers = [];
      const doc = this.doc, wu = doc.wu, hu = doc.hu;
      [-7.6, -6.4, -5.2, -4.0, -2.9].forEach((y, i) => {
        const t = this.fogTex.clone(); t.needsUpdate = true; t.offset.set(i * 0.37, i * 0.21); t.repeat.set(wu / 7, hu / 8);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wu, hu), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.07 + i * 0.025, depthWrite: false, color: '#6f86ad', fog: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(wu / 2, y, hu / 2); m.renderOrder = 3; this.scene.add(m); this.fogLayers.push({ m, t, sp: 0.004 + i * 0.002 });
      });
    }

    /* ---------- document binding ---------- */
    setDoc(doc) {
      this.chunks.forEach((c) => c.dispose()); this.chunks = []; this.pool.cancelAll();
      for (const id of [...this.dyn.keys()]) this.removeDyn(id);
      this.doc = doc;
      this.ncx = Math.ceil(doc.w / CH); this.ncz = Math.ceil(doc.h / CH);
      for (let cj = 0; cj < this.ncz; cj++) for (let ci = 0; ci < this.ncx; ci++) { const c = new Chunk(this, ci, cj); c.queuePaint(c.i0, c.j0, c.i1, c.j1); this.chunks.push(c); }
      this.buildFog();
      this.objectsChanged(true);
      this.pumpPaint();
    }
    chunkAt(i, j) { const ci = Math.floor(i / CH), cj = Math.floor(j / CH); if (ci < 0 || cj < 0 || ci >= this.ncx || cj >= this.ncz) return null; return this.chunks[cj * this.ncx + ci]; }
    anchorChunk(o) {
      const p = o.kind === 'building' ? [o.x * TILE, o.z * TILE] : o.kind === 'prop' ? [o.x, o.z] : o.kind === 'bridge' ? o.a : o.pts[0];
      const [i, j] = this.doc.tileOf(p[0], p[1]);
      return this.chunkAt(Math.max(0, Math.min(this.doc.w - 1, i)), Math.max(0, Math.min(this.doc.h - 1, j)));
    }
    static objBox(o) {
      if (o.kind === 'building') { const b = K.BuildingGeo.worldBox(o); return [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]; }
      if (o.kind === 'prop') return [o.x - 1, o.z - 1, o.x + 1, o.z + 1];
      const P = o.kind === 'bridge' ? [o.a, o.b] : o.pts; let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      P.forEach(([x, z]) => { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); });
      return [a - 1.5, b - 1.5, c + 1.5, d + 1.5];
    }
    /* tiles changed in [i0,i1) x [j0,j1): repaint (with a 1-tile apron), rebuild terrain + props that sit there */
    tilesChanged(i0, j0, i1, j1) {
      const a0 = i0 - 1, b0 = j0 - 1, a1 = i1 + 1, b1 = j1 + 1;
      for (const c of this.chunks) {
        if (c.i1 <= a0 || c.i0 >= a1 || c.j1 <= b0 || c.j0 >= b1) continue;
        c.queuePaint(a0, b0, a1, b1); c.geoDirty = true;
      }
      const x0 = a0 * TILE, z0 = b0 * TILE, x1 = a1 * TILE, z1 = b1 * TILE;
      let bdirty = false;
      for (const o of this.doc.objects) {
        const bb = WorldRenderer.objBox(o); if (bb[2] < x0 || bb[0] > x1 || bb[3] < z0 || bb[1] > z1) continue;
        if (o.kind === 'building') { bdirty = true; continue; }    // a building's base height follows the terrain under it
        const c = this.anchorChunk(o); if (c) c.propsDirty = true;
      }
      if (bdirty) this.syncBuildings(true);
      this.placeDynamics();
    }
    objectsChanged(force) {
      const per = new Map();
      for (const o of this.doc.objects) { const c = this.anchorChunk(o); if (!c) continue; if (!per.has(c)) per.set(c, []); per.get(c).push(o); }
      this.chunkObjs = per;
      this.syncBuildings(force);
      for (const c of this.chunks) {
        const sig = JSON.stringify((per.get(c) || []).filter((o) => o.kind !== 'building'));
        if (force || sig !== c.sig) { c.sig = sig; c.propsDirty = true; }
      }
      // bridges change the ground for anything standing on them; just re-place all dynamics
      this.syncDynamics();
    }
    /* do queued rebuild work within a time budget; nearest chunks first */
    work(budgetMs = 10, sync = false) {
      const t0 = performance.now(), tg = this.target;
      const dist = (c) => Math.hypot((c.i0 + CH / 2) * TILE - tg.x, (c.j0 + CH / 2) * TILE - tg.z);
      const order = this.chunks.slice().sort((a, b) => dist(a) - dist(b));
      let busy = false;
      for (const c of order) if (c.geoDirty) { c.buildTerrain(); busy = true; }
      for (const c of order) if (c.propsDirty) { c.buildProps(this.chunkObjs.get(c) || []); busy = true; if (performance.now() - t0 > budgetMs * 2) break; }
      for (const c of order) {
        while (c.nDirty && performance.now() - t0 < budgetMs) { if (c.paintStep(sync ? null : this.pool)) busy = true; else break; }
        c.flushTex();
        if (performance.now() - t0 >= budgetMs) break;
      }
      this.pending = this.chunks.reduce((s, c) => s + (c.nDirty ? 1 : 0) + (c.inflight ? 1 : 0) + (c.propsDirty ? 1 : 0) + (c.geoDirty ? 1 : 0), 0);
      return busy;
    }
    /* keep the paint workers fed between frames (nearest chunks first) */
    pumpPaint() {
      if (!this.pool.ok) return; const tg = this.target;
      const order = this.chunks.filter((c) => c.nDirty).sort((a, b) => Math.hypot((a.i0 + CH / 2) * TILE - tg.x, (a.j0 + CH / 2) * TILE - tg.z) - Math.hypot((b.i0 + CH / 2) * TILE - tg.x, (b.j0 + CH / 2) * TILE - tg.z));
      for (const c of order) while (c.nDirty && this.pool.idle) if (!c.paintStep(this.pool)) break;
    }
    finishAll() {
      // bands still on worker threads are re-painted here (their late results are discarded by the version check)
      for (const c of this.chunks) { for (const b of c.flying) c.queuePaint(...b.rect); c.flying.clear(); c.inflight = 0; }
      let n = 0; do { this.work(1e9, true); } while (this.chunks.some((c) => c.nDirty || c.propsDirty || c.geoDirty) && ++n < 50); this.chunks.forEach((c) => c.flushTex()); }
    /* resolves once every chunk is painted and built (workers included) */
    ready(timeoutMs = 60000) {
      const t0 = performance.now();
      return new Promise((res) => { const tick = () => { this.work(30); this.chunks.forEach((c) => c.flushTex()); if (this.pending === 0 || performance.now() - t0 > timeoutMs) res(performance.now() - t0); else setTimeout(tick, 15); }; tick(); });
    }

    /* ---------- dynamic parts ---------- */
    removeDyn(id) {
      const d = this.dyn.get(id); if (!d) return;
      if (d.actor) { const a = d.actor; this.scene.remove(a.group); a.mesh.geometry.dispose(); a.map.dispose(); a.gmap.dispose(); a.mat.dispose(); a.glowMat.dispose(); a.mesh.customDepthMaterial.dispose(); }
      d.objs.forEach((m) => { this.scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) { [].concat(m.material).forEach((mm) => { if (mm.map && mm.map !== this.fireTex && mm.map.isClone) mm.map.dispose(); mm.dispose(); }); } });
      this.dyn.delete(id); this.anim.delete(id); this.fires.delete(id); this.actors.delete(id);
    }
    syncDynamics() {
      const seen = new Set();
      for (const o of this.doc.objects) {
        if (o.kind !== 'prop') continue; const def = PropBuilder.PROPS[o.type]; if (!def || !(def.dyn || def.sprite)) continue;
        seen.add(o.id);
        const key = JSON.stringify([o.type, o.s, o.rot, o.flip, o.seed, o.hero, o.look]);
        const cur = this.dyn.get(o.id);
        if (cur && cur.key === key) continue;
        if (cur) this.removeDyn(o.id);
        this.addDyn(o, def, key);
      }
      for (const id of [...this.dyn.keys()]) if (!seen.has(id)) this.removeDyn(id);
      this.placeDynamics();
    }
    addDyn(o, def, key) {
      const d = { key, objs: [], o }; const S = this.scene, s = o.s || 1;
      if (def.sprite) {
        const a = new SpriteActor(this.lib.get(PropBuilder.spriteOf(o)), this.bank, { x: 0, y: 0, z: 0, phase: (o.seed % 7) * 0.6, flip: !!o.flip });
        a.group.scale.setScalar(s); a.shadow.scale.setScalar(s);
        S.add(a.group, a.shadow); d.objs.push(a.shadow); d.actor = a; this.actors.set(o.id, a);
      }
      const dy = def.dyn || {};
      if (dy.fire) {
        const [fx, fy, fz, fs] = dy.fire, t = this.fireTex.clone(); t.isClone = true; t.needsUpdate = true; t.repeat.set(0.25, 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * fs * s, 0.93 * fs * s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.6, 2.2, 1.9) }));
        m.geometry.translate(0, 0.93 * fs * s / 2 - 0.05, 0); m.renderOrder = 6; S.add(m); d.objs.push(m);
        this.fires.set(o.id, { mesh: m, tex: t, ph: (o.seed % 13) * 0.31, off: [fx * s, fy * s, fz * s] });
      }
      if (dy.banner) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), this.mats.banner); ban.geometry.translate(0, -0.5, 0); ban.castShadow = true;
        ban.scale.setScalar(s); S.add(ban); d.objs.push(ban); d.banner = ban;
        const ph = (o.seed % 11) * 0.5;
        this.anim.set(o.id, (t) => { ban.rotation.y = (o.rot || 0) + Math.sin(t * 0.9 + ph) * 0.18; ban.rotation.x = Math.sin(t * 1.3 + ph) * 0.05; });
      }
      d.def = def; this.dyn.set(o.id, d);
    }
    placeDynamics() {
      const doc = this.doc; this.lightSrc = []; const emb = [];
      for (const [id, d] of this.dyn) {
        const o = doc.obj(id); if (!o) continue; d.o = o;
        const y = doc.groundY(o.x, o.z), s = o.s || 1, rot = o.rot || 0, c = Math.cos(rot), sn = Math.sin(rot);
        const loc = (lx, ly, lz) => [o.x + (lx * c + lz * sn) * s, y + ly * s, o.z + (-lx * sn + lz * c) * s];
        if (d.actor) { d.actor.group.position.set(o.x, y, o.z); d.actor.shadow.position.set(o.x, y + 0.015, o.z); }
        const f = this.fires.get(id); if (f) { const [fx, fy, fz] = f.off; f.mesh.position.set(o.x + fx, y + fy, o.z + fz); }
        if (d.banner) { const p = loc(0.27, 2.27, 0); d.banner.position.set(p[0], p[1], p[2]); }
        const dy = d.def.dyn || {};
        if (dy.light) { const p = loc(dy.light[0], dy.light[1], dy.light[2]); this.lightSrc.push({ x: p[0], y: p[1], z: p[2], color: 0xff8a3c, base: 14 * dy.light[3] * s, dist: 9 * dy.light[3] * Math.sqrt(s), ph: (o.seed % 17) * 0.37, fire: true }); }
        if (dy.embers) emb.push(loc(dy.embers[0], dy.embers[1], dy.embers[2]));
        if (dy.staff) this.lightSrc.push({ x: o.x - 0.25 * s, y: y + 1.4 * s, z: o.z + 0.2 * s, color: 0x8fe2ff, base: 3.5, dist: 4.5, ph: 0, staff: true });
      }
      if (this.embers) { this.scene.remove(this.embers.points); this.embers.points.geometry.dispose(); this.embers.points.material.dispose(); this.embers = null; }
      if (emb.length) { this.embers = new EmberField(emb); this.scene.add(this.embers.points); }
    }
    update(t, camera, viewH, target, dist, pitch = 0.7) {
      this.target.copy(target);
      const yaw = this.cameraYaw(camera);
      const tilt = -Math.max(0, pitch - 0.8) * 0.9;
      for (const a of this.actors.values()) { a.update(t, yaw); a.group.rotation.order = 'YXZ'; a.group.rotation.x = tilt; }
      for (const f of this.fires.values()) { f.tex.offset.x = (Math.floor(t * 9 + f.ph) % 4) * 0.25; f.mesh.rotation.y = yaw; }
      for (const fn of this.anim.values()) fn(t);
      // light pool: nearest sources to the view target
      const src = this.lightSrc; for (const s of src) s.d = (s.x - target.x) ** 2 + (s.z - target.z) ** 2;
      src.sort((a, b) => a.d - b.d);
      this.lightPool.forEach((l, i) => {
        const s = src[i];
        if (!s) { l.intensity = 0; l.position.set(0, -60, 0); return; }
        l.position.set(s.x, s.y, s.z); l.color.setHex(s.color); l.distance = s.dist; l.decay = s.staff ? 1.5 : 1.4;
        l.intensity = s.staff ? 3.2 + Math.sin(t * 2.2) * 0.8 : s.base * (0.82 + 0.12 * Math.sin(t * 13 + s.ph) + 0.08 * Math.sin(t * 29 + s.ph * 3));
      });
      // sun + shadow frustum follow the view so big worlds keep crisp shadows
      const span = Math.max(14, dist * 1.25), sc = this.sun.shadow.camera;
      const tx = Math.round(target.x * 4) / 4, tz = Math.round(target.z * 4) / 4;
      this.sun.target.position.set(tx, 0, tz); this.sun.position.set(tx + this.sunOff.x, this.sunOff.y, tz + this.sunOff.z);
      if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span * 0.85; sc.bottom = -span * 0.85; sc.far = 90; sc.updateProjectionMatrix(); }
      this.scene.fog.near = dist + 9; this.scene.fog.far = dist + 49;
      this.sparkUni.uTime.value = t;
      this.fogLayers.forEach((f, i) => { f.t.offset.set(i * 0.37 + t * f.sp * 0.36, i * 0.21 + t * f.sp * 0.96); });
      this.snow.update(t, viewH, target); if (this.embers) this.embers.update(t, viewH);
    }
    cameraYaw(camera) { const d = new V3(); camera.getWorldDirection(d); return Math.atan2(-d.x, -d.z); }
  }

  /* orbit rig (diorama CameraRig with editor-friendly limits and a top-down mode) */
  class CameraRig {
    constructor(camera) {
      this.cam = camera; this.drift = false;
      this.cur = { tx: 8, ty: 0, tz: 8, yaw: -0.2, pitch: 0.7, dist: 21 }; this.goal = Object.assign({}, this.cur);
      this.bounds = [0, 0, 32, 24];
    }
    set(v, snap) { Object.assign(this.goal, v); this.clamp(); if (snap) this.cur = Object.assign({}, this.goal); }
    clamp() {
      const g = this.goal, b = this.bounds;
      g.pitch = Math.max(0.35, Math.min(1.53, g.pitch)); g.dist = Math.max(4, Math.min(this.maxDist || Math.max(40, (b[2] - b[0]) * 1.4), g.dist));
      g.tx = Math.max(b[0], Math.min(b[2], g.tx)); g.tz = Math.max(b[1], Math.min(b[3], g.tz));
    }
    update(dt, t) {
      const k = 1 - Math.pow(0.0015, dt);
      for (const key of ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist']) this.cur[key] += (this.goal[key] - this.cur[key]) * k;
      const c = this.cur, yaw = c.yaw + (this.drift ? Math.sin(t * 0.07) * 0.06 : 0), p = c.pitch;
      this.cam.position.set(c.tx + Math.sin(yaw) * Math.cos(p) * c.dist, c.ty + Math.sin(p) * c.dist, c.tz + Math.cos(yaw) * Math.cos(p) * c.dist);
      this.cam.lookAt(c.tx, c.ty, c.tz);
      return c.dist;
    }
  }

  Object.assign(K, { CH, PPU, PropBuilder, WorldRenderer, TextureBank, CameraRig, Chunk, SpriteActor, GeometryBuilderW: GeometryBuilder, M4, UNIT });
})(typeof window !== 'undefined' ? window : globalThis);