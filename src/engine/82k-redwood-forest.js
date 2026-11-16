/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the Redwood world. Old-growth coast redwoods all around the snowfield: giants 60-90 m tall on flared,
   fluted trunks, younger redwoods, ferns, sorrel, mossy fallen logs and old stumps, light shafts through the mist.
     RedwoodForest  where every trunk, log and fern stands. Deterministic from the seed and the land, so every player
                    sees the same forest and nothing of it needs saving. Not doc objects: a world of 50,000 trunks
                    stays a plain list of numbers. It blocks the nav grid where trunks and logs stand.
     RedwoodArt     the meshes (built once, in metres, flat-shaded with vertex colours: the diorama look)
     RedwoodView    instanced meshes of what is near the view, regathered as you walk; the forest's light and mist
   Giants are scenery and never choppable; the young redwoods are doc props ('c:youngred', below) you can fell.
   Tunables: K.REDWOOD.forest (21-redwood-config.js). */
(function (G) {
  const K = G.K, TILE = K.TILE, T = K.T;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const KIND = { GIANT: 0, MID: 1, LOG: 2, STUMP: 3 };
  const GIANT_R = [1.9, 2.15, 2.5];     // base radius of each giant shape at 75 m (scaled with the tree: 60-90 m -> 1.5-3 m)
  const MID_R = [0.68, 0.82];          // base radius of each younger shape at 30 m (20-40 m -> 0.45-1.1 m)

  class RedwoodForest {
    /* o: { doc, plan (K.WorldPlan), clear(x, z, r) -> false where one of the core's own props stands } */
    constructor(o) {
      this.doc = o.doc; this.plan = o.plan; this.clear = o.clear || (() => true);
      this.cfg = K.REDWOOD.forest; this.seed = this.cfg.seed; this.n = new K.Noise(this.seed); this.n2 = new K.Noise(this.seed + 7);
      this.wu = this.doc.wu; this.hu = this.doc.hu; this.cell = this.cfg.cellM;
      this.ncx = Math.ceil(this.wu / this.cell); this.ncz = Math.ceil(this.hu / this.cell);
      this.floorCache = new Map();
      this.generate();
    }
    h(a, b, s) { return K.hash2(a, b, this.seed * 31 + s); }
    inCore(x, z) { const c = this.plan.coreMetres; return x < c.w && z < c.h; }
    terrainAt(x, z) { const d = this.doc, i = Math.floor(x / TILE), j = Math.floor(z / TILE); return d.inside(i, j) ? d.terrain[j * d.w + i] : T.ROCK; }
    /** how thick the forest is here, 0..1: groves and clearings, nothing on rock, water or near anyone's plot */
    density(x, z) {
      if (x < 8 || z < 8 || x > this.wu - 8 || z > this.hu - 8) return 0;
      const t = this.terrainAt(x, z); if (t === T.ROCK || t === T.CHASM || t === T.WATER) return 0;
      const grove = clamp01((this.n.fbm(x * 0.0085, z * 0.0085, 3) - 0.34) / 0.2);
      if (!this.inCore(x, z)) return Math.max(0.12, grove);
      const d = this.plan.plotDist(x, z), c = this.cfg;
      if (d < c.coreClearM) return 0;
      return grove * 0.75 * clamp01((d - c.coreClearM) / c.coreRampM);
    }
    /* ---------- generation: every trunk, log and stump of the world, once ---------- */
    generate() {
      const c = this.cfg, list = [];   // [kind, x, z, r, h, rot, variant, len]
      const gS = c.giant.spacingM, gW = Math.ceil(this.wu / gS), gH = Math.ceil(this.hu / gS);
      const giants = new Map();   // giant slot -> index in list (mids keep clear of them)
      for (let gz = 0; gz < gH; gz++) for (let gx = 0; gx < gW; gx++) {
        const x = (gx + 0.5 + (this.h(gx, gz, 1) - 0.5) * 0.7) * gS, z = (gz + 0.5 + (this.h(gx, gz, 2) - 0.5) * 0.7) * gS;
        if (this.h(gx, gz, 3) >= c.giant.chance * this.density(x, z)) continue;
        const hh = c.giant.heightM[0] + (c.giant.heightM[1] - c.giant.heightM[0]) * this.h(gx, gz, 4), v = Math.floor(this.h(gx, gz, 5) * GIANT_R.length) % GIANT_R.length, r = GIANT_R[v] * hh / 75;
        if (this.inCore(x, z) && !this.clear(x, z, r * 1.4 + 1.5)) continue;
        giants.set(gz * gW + gx, list.length); list.push([KIND.GIANT, x, z, r, hh, this.h(gx, gz, 6) * 6.283, v, 0]);
      }
      const nearGiant = (x, z, pad) => {
        const gx = Math.floor(x / gS), gz = Math.floor(z / gS);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const k = giants.get((gz + dz) * gW + gx + dx); if (k == null) continue; const g = list[k]; if (Math.hypot(g[1] - x, g[2] - z) < g[3] * 1.6 + pad) return true; }
        return false;
      };
      this.nearGiant = nearGiant;
      const mS = c.mid.spacingM, mW = Math.ceil(this.wu / mS), mH = Math.ceil(this.hu / mS);
      for (let mz = 0; mz < mH; mz++) for (let mx = 0; mx < mW; mx++) {
        const x = (mx + 0.5 + (this.h(mx, mz, 11) - 0.5) * 0.6) * mS, z = (mz + 0.5 + (this.h(mx, mz, 12) - 0.5) * 0.6) * mS;
        if (this.h(mx, mz, 13) >= c.mid.chance * this.density(x, z)) continue;
        const hh = c.mid.heightM[0] + (c.mid.heightM[1] - c.mid.heightM[0]) * this.h(mx, mz, 14), v = Math.floor(this.h(mx, mz, 15) * MID_R.length) % MID_R.length, r = MID_R[v] * hh / 30;
        if (nearGiant(x, z, r + 2) || (this.inCore(x, z) && !this.clear(x, z, r + 1.4))) continue;
        list.push([KIND.MID, x, z, r, hh, this.h(mx, mz, 16) * 6.283, v, 0]);
      }
      const scatter = (spec, s0, kind, make) => {
        const S = spec.spacingM, W = Math.ceil(this.wu / S), H = Math.ceil(this.hu / S);
        for (let qz = 0; qz < H; qz++) for (let qx = 0; qx < W; qx++) {
          const x = (qx + 0.5 + (this.h(qx, qz, s0) - 0.5) * 0.8) * S, z = (qz + 0.5 + (this.h(qx, qz, s0 + 1) - 0.5) * 0.8) * S;
          if (this.inCore(x, z) || this.h(qx, qz, s0 + 2) >= spec.chance * this.density(x, z)) continue;
          const it = make(x, z, (k) => this.h(qx, qz, s0 + 3 + k)); if (it) list.push(it);
        }
      };
      // fallen giants: long mossy logs, kept off the standing trunks (sampled every 2 m along)
      scatter(c.log, 21, KIND.LOG, (x, z, q) => {
        const len = 10 + q(0) * 18, r = 0.55 + q(1) * 0.65, rot = q(2) * 3.1416, dx = Math.cos(rot), dz = Math.sin(rot);
        for (let s = -len / 2; s <= len / 2; s += 2) { const px = x + dx * s, pz = z + dz * s; if (nearGiant(px, pz, r + 0.8) || this.density(px, pz) <= 0) return null; }
        return [KIND.LOG, x, z, r, len, rot, 0, len];
      });
      scatter(c.stump, 31, KIND.STUMP, (x, z, q) => { const r = 1.3 + q(0) * 1.2; return nearGiant(x, z, r + 1) ? null : [KIND.STUMP, x, z, r, 1.2 + q(1) * 1.6, q(2) * 6.283, 0, 0]; });
      // flat arrays and a per-cell index (counting sort by cell)
      const n = list.length; this.count = n;
      this.kind = new Uint8Array(n); this.x = new Float32Array(n); this.z = new Float32Array(n); this.r = new Float32Array(n); this.ht = new Float32Array(n); this.rot = new Float32Array(n); this.variant = new Uint8Array(n); this.len = new Float32Array(n);
      const cells = this.ncx * this.ncz, start = new Int32Array(cells + 1), cellOf = new Int32Array(n);
      list.forEach((t, k) => { this.kind[k] = t[0]; this.x[k] = t[1]; this.z[k] = t[2]; this.r[k] = t[3]; this.ht[k] = t[4]; this.rot[k] = t[5]; this.variant[k] = t[6]; this.len[k] = t[7]; const ci = this.cellKey(t[1], t[2]); cellOf[k] = ci; start[ci + 1]++; });
      for (let i = 0; i < cells; i++) start[i + 1] += start[i];
      const fill = start.slice(0, cells), items = new Int32Array(n); for (let k = 0; k < n; k++) items[fill[cellOf[k]]++] = k;
      this.cellStart = start; this.cellItems = items;
      this.cosR = this.rot.map(Math.cos); this.sinR = this.rot.map(Math.sin);
    }
    cellKey(x, z) { const ci = Math.max(0, Math.min(this.ncx - 1, Math.floor(x / this.cell))), cj = Math.max(0, Math.min(this.ncz - 1, Math.floor(z / this.cell))); return cj * this.ncx + ci; }
    /** call fn(k) for every trunk/log/stump whose cell lies within radius m of (x,z) */
    near(x, z, m, fn) {
      const S = this.cell, ci0 = Math.max(0, Math.floor((x - m) / S)), ci1 = Math.min(this.ncx - 1, Math.floor((x + m) / S)), cj0 = Math.max(0, Math.floor((z - m) / S)), cj1 = Math.min(this.ncz - 1, Math.floor((z + m) / S));
      for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) { const c = cj * this.ncx + ci; for (let q = this.cellStart[c]; q < this.cellStart[c + 1]; q++) fn(this.cellItems[q]); }
    }
    stats() { const s = { giants: 0, mids: 0, logs: 0, stumps: 0 }; for (let k = 0; k < this.count; k++) s[['giants', 'mids', 'logs', 'stumps'][this.kind[k]]]++; return s; }
    /** the radius a trunk blocks (the flared base is wider than the trunk) */
    blockR(k) { const kd = this.kind[k]; return kd === KIND.GIANT ? this.r[k] * 1.3 : kd === KIND.MID ? this.r[k] * 1.1 : this.r[k]; }
    /** is (x,z) inside a trunk, stump or log? */
    solidAt(x, z) {
      let hit = false;
      this.near(x, z, 12, (k) => { if (hit) return; if (this.kind[k] === KIND.LOG) { if (this.logDist(k, x, z) < this.r[k]) hit = true; } else if (Math.hypot(this.x[k] - x, this.z[k] - z) < this.blockR(k)) hit = true; });
      return hit;
    }
    logDist(k, x, z) { const c = this.cosR[k], s = this.sinR[k], dx = x - this.x[k], dz = z - this.z[k], t = Math.max(-this.len[k] / 2, Math.min(this.len[k] / 2, dx * c + dz * s)); return Math.hypot(dx - c * t, dz - s * t); }
    /** trunks, stumps and logs block the ground: nobody walks through a redwood */
    blockNav(nav) {
      const w = nav.w;
      for (let k = 0; k < this.count; k++) {
        const isLog = this.kind[k] === KIND.LOG, R = isLog ? this.len[k] / 2 + this.r[k] : this.blockR(k), x = this.x[k], z = this.z[k];
        const i0 = Math.max(0, Math.floor((x - R) / TILE)), i1 = Math.min(nav.w - 1, Math.floor((x + R) / TILE)), j0 = Math.max(0, Math.floor((z - R) / TILE)), j1 = Math.min(nav.h - 1, Math.floor((z + R) / TILE));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
          if (isLog ? this.logDist(k, cx, cz) < this.r[k] : Math.hypot(cx - x, cz - z) < R) nav.walk[j * w + i] = 0;
        }
      }
    }
    /* ---------- the forest floor (ferns and sorrel), made per cell on demand for drawing ---------- */
    floor(ci, cj) {
      const key = cj * this.ncx + ci; let f = this.floorCache.get(key); if (f) return f;
      const c = this.cfg, S = this.cell, ferns = [], sorrel = [], x0 = ci * S, z0 = cj * S;
      const solid = (x, z, pad) => { let hit = false; this.near(x, z, 8, (k) => { if (!hit && this.kind[k] !== KIND.LOG && Math.hypot(this.x[k] - x, this.z[k] - z) < this.blockR(k) + pad) hit = true; }); return hit; };
      const grid = (spec, s0, out, ok) => {
        const sp = spec.spacingM, n = Math.ceil(S / sp);
        for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
          const gx = ci * 64 + a, gz = cj * 64 + b, x = x0 + (a + this.h(gx, gz, s0)) * sp, z = z0 + (b + this.h(gx, gz, s0 + 1)) * sp;
          if (x >= x0 + S || z >= z0 + S || this.terrainAt(x, z) !== T.FOREST) continue;
          const p = ok(x, z); if (this.h(gx, gz, s0 + 2) >= spec.chance * p || solid(x, z, 0.3)) continue;
          out.push(x, z, 0.65 + this.h(gx, gz, s0 + 3) * 0.8, this.h(gx, gz, s0 + 4) * 6.283);
        }
      };
      grid(c.fern, 41, ferns, (x, z) => 0.35 + 0.65 * clamp01((this.n2.fbm(x * 0.05, z * 0.05, 2) - 0.38) * 4));
      grid(c.sorrel, 51, sorrel, (x, z) => clamp01((this.n2.fbm(x * 0.09 + 40, z * 0.09, 2) - 0.48) * 6));
      f = { ferns: new Float32Array(ferns), sorrel: new Float32Array(sorrel) };
      if (this.floorCache.size > 4000) this.floorCache.delete(this.floorCache.keys().next().value);
      this.floorCache.set(key, f); return f;
    }
    /** where the choppable young redwoods stand (the builder adds them as doc props after the core's own) */
    youngSpots() {
      const c = this.cfg.young, S = 10, W = Math.ceil(this.wu / S), H = Math.ceil(this.hu / S), out = [], p = c.per100m2;
      for (let qz = 0; qz < H && out.length < c.max; qz++) for (let qx = 0; qx < W && out.length < c.max; qx++) {
        const x = (qx + 0.5 + (this.h(qx, qz, 61) - 0.5) * 0.8) * S, z = (qz + 0.5 + (this.h(qx, qz, 62) - 0.5) * 0.8) * S;
        if (this.inCore(x, z) || this.h(qx, qz, 63) >= p * this.density(x, z)) continue;
        if (this.solidAt(x, z) || this.nearGiant(x, z, 1.5)) continue;
        let busy = false; this.near(x, z, 6, (k) => { if (!busy && this.kind[k] !== KIND.LOG && Math.hypot(this.x[k] - x, this.z[k] - z) < this.blockR(k) + 1.4) busy = true; }); if (busy) continue;
        out.push({ x, z, s: 0.85 + this.h(qx, qz, 64) * 0.5, rot: this.h(qx, qz, 65) * 6.283 });
      }
      return out;
    }
  }
  RedwoodForest.KIND = KIND; RedwoodForest.GIANT_R = GIANT_R; RedwoodForest.MID_R = MID_R;

  /* ---------- the meshes (needs THREE) ---------- */
  class RedwoodArt {
    constructor() { this.pal = K.TP; }
    static col(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
    rampCol(ramp, v) { const p = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(v * (ramp.length - 1))))]; return [p[0] / 255, p[1] / 255, p[2] / 255]; }
    /** a non-indexed buffer geometry from triangle soup (flat shading, vertex colours) */
    static geo(pos, col) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    }
    /** fluted, flared trunk: rings of heights ys, radius fn rad(y, a) */
    trunk(pos, col, ys, N, rad, colour) {
      const ring = (y) => { const out = []; for (let s = 0; s <= N; s++) { const a = (s / N) * 6.2832, r = rad(y, a); out.push([Math.cos(a) * r, y, Math.sin(a) * r, a]); } return out; };
      let prev = ring(ys[0]);
      for (let q = 1; q < ys.length; q++) {
        const cur = ring(ys[q]);
        for (let s = 0; s < N; s++) {
          const a = prev[s], b = prev[s + 1], c = cur[s + 1], d = cur[s], cc = colour(ys[q - 1], (a[3] + b[3]) / 2, s);
          pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2]);
          for (let k = 0; k < 6; k++) col.push(cc[0], cc[1], cc[2]);
        }
        prev = cur;
      }
    }
    /** an irregular foliage clump (a squashed icosahedron, jittered) */
    clump(pos, col, x, y, z, rx, ry, rz, seed, ramp) {
      const ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), p = ico.attributes.position.array;
      const jit = (v, k) => 1 + (K.hash2(Math.round(v * 1000), k, seed) - 0.5) * 0.35;
      for (let i = 0; i < p.length; i += 9) {
        const ny = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, c = this.rampCol(ramp, clamp01(0.3 + ny * 0.45 + (K.hash2(i, seed, 3) - 0.5) * 0.35));
        for (let v = 0; v < 9; v += 3) { const j = jit(p[i + v] * 3 + p[i + v + 1] * 7 + p[i + v + 2] * 13, seed); pos.push(x + p[i + v] * rx * j, y + p[i + v + 1] * ry * j, z + p[i + v + 2] * rz * j); col.push(c[0], c[1], c[2]); }
      }
      ico.dispose();
    }
    /** a redwood in metres: height H, base radius R, crown from cy; lod 0 full, 1 far */
    tree(H, R, cy, lod, seed) {
      const pos = [], col = [], N = lod ? 7 : 18, P = this.pal;
      const ys = lod ? [-0.8, 1.5, H * 0.12, H * 0.4, H * 0.75, H] : [-0.8, 0.3, 0.9, 1.8, 3, 4.8, H * 0.1, H * 0.17, H * 0.26, H * 0.36, H * 0.48, H * 0.6, H * 0.74, H * 0.88, H];
      const ph = K.hash2(seed, 1, 9) * 6.28, ph2 = K.hash2(seed, 2, 9) * 6.28, fl = H * 0.028;
      const rad = (y, a) => {
        const t = Math.max(0, y) / H, base = R * (1 - 0.72 * Math.pow(t, 0.8)), flare = 1 + 0.75 * Math.exp(-Math.max(0, y) / fl);
        const lobes = 1 + 0.32 * Math.exp(-Math.max(0, y) / (fl * 1.2)) * Math.pow(Math.max(0, Math.cos(4 * a + ph)), 2);
        return base * flare * lobes * (lod ? 1 : 1 + 0.055 * Math.sin(9 * a + ph2) + 0.03 * Math.sin(17 * a));
      };
      this.trunk(pos, col, ys, N, rad, (y, a, s) => {
        const streak = K.hash2(s, seed, 5), t = Math.max(0, y) / H;
        let c = this.rampCol(P.redbark, clamp01(0.32 + streak * 0.42 + t * 0.25 - (s % 3 === 0 ? 0.18 : 0)));
        const moss = Math.max(0, Math.cos(a - 2.2)) * Math.exp(-Math.max(0, y) / (H * 0.08)) * 0.85;   // moss on the north-west foot
        if (moss > 0.2) { const m = this.rampCol(P.redwoodMoss, 0.35 + streak * 0.4); c = [c[0] + (m[0] - c[0]) * moss, c[1] + (m[1] - c[1]) * moss, c[2] + (m[2] - c[2]) * moss]; }
        if (y < 0.4) c = c.map((v) => v * 0.7);
        return c;
      });
      // the crown: clumps spiralling up a narrow cone; a few bare branch stubs show below it
      const n = lod ? Math.max(6, Math.round(H / 9)) : Math.round(H / 2.6), top = H + 2;
      for (let q = 0; q < n; q++) {
        const t = q / n, y = cy + t * (top - cy), spread = (R * 0.6 + (H * 0.075) * Math.pow(1 - t, 0.85)) * (0.85 + K.hash2(q, seed, 7) * 0.3), a = q * 2.399 + ph;
        const rr = (H * 0.05 + 1.2) * (1 - t * 0.55) * (lod ? 1.5 : 1);
        this.clump(pos, col, Math.cos(a) * spread, y, Math.sin(a) * spread, rr, rr * 0.62, rr, seed * 97 + q, P.pine);
      }
      if (!lod) this.clump(pos, col, 0, top - 0.6, 0, 1.4, 2.4, 1.4, seed + 5, P.pine);
      return RedwoodArt.geo(pos, col);
    }
    fern() {
      const pos = [], col = [], n = 9, P = this.pal;
      for (let f = 0; f < n; f++) {
        const a = (f / n) * 6.283 + K.hash2(f, 3, 3) * 0.4, L = 0.75 + K.hash2(f, 4, 3) * 0.5, w = 0.13, ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, pz = ca * w;
        const m = [ca * L * 0.5, 0.42, sa * L * 0.5], tip = [ca * L, 0.18 + K.hash2(f, 5, 3) * 0.12, sa * L];
        const c1 = this.rampCol(P.fern, 0.45 + K.hash2(f, 6, 3) * 0.4), c2 = this.rampCol(P.fern, 0.75);
        pos.push(0, 0.02, 0, m[0] + px, m[1], m[2] + pz, m[0] - px, m[1], m[2] - pz); col.push(...c1, ...c2, ...c2);
        pos.push(m[0] + px, m[1], m[2] + pz, tip[0], tip[1], tip[2], m[0] - px, m[1], m[2] - pz); col.push(...c2, ...c2, ...c2);
      }
      return RedwoodArt.geo(pos, col);
    }
    sorrel() {
      const pos = [], col = [], P = this.pal;
      for (let q = 0; q < 7; q++) {
        const cx = (K.hash2(q, 1, 8) - 0.5) * 0.9, cz = (K.hash2(q, 2, 8) - 0.5) * 0.9, r = 0.09 + K.hash2(q, 3, 8) * 0.07, y = 0.05 + K.hash2(q, 4, 8) * 0.08, c = this.rampCol(P.redwoodMoss, 0.65 + K.hash2(q, 5, 8) * 0.35);
        for (let s = 0; s < 3; s++) { const a = s * 2.094, lx = cx + Math.cos(a) * r, lz = cz + Math.sin(a) * r; for (let e = 0; e < 5; e++) { const b0 = (e / 5) * 6.283, b1 = ((e + 1) / 5) * 6.283; pos.push(lx, y, lz, lx + Math.cos(b1) * r, y, lz + Math.sin(b1) * r, lx + Math.cos(b0) * r, y, lz + Math.sin(b0) * r); col.push(...c, ...c, ...c); } }
      }
      return RedwoodArt.geo(pos, col);
    }
    /** a fallen log along x, length 1 and radius 1 (scaled per instance), moss on top, pale cut ends */
    log() {
      const pos = [], col = [], N = 10, P = this.pal;
      for (let s = 0; s < N; s++) {
        const a0 = (s / N) * 6.283, a1 = ((s + 1) / N) * 6.283, y0 = Math.sin(a0), z0 = Math.cos(a0), y1 = Math.sin(a1), z1 = Math.cos(a1), up = (y0 + y1) / 2;
        const c = up > 0.45 ? this.rampCol(P.redwoodMoss, 0.4 + K.hash2(s, 1, 4) * 0.4) : this.rampCol(P.redbark, 0.3 + K.hash2(s, 2, 4) * 0.35);
        pos.push(-0.5, y0, z0, 0.5, y0, z0, 0.5, y1, z1, -0.5, y0, z0, 0.5, y1, z1, -0.5, y1, z1); for (let k = 0; k < 6; k++) col.push(...c);
        const e = this.rampCol(P.wood, 0.75);
        for (const x of [-0.5, 0.5]) { pos.push(x, 0, 0, x, y0, z0, x, y1, z1); col.push(...e, ...e, ...e); }
      }
      return RedwoodArt.geo(pos, col);
    }
    stump() {
      const pos = [], col = [], P = this.pal;
      this.trunk(pos, col, [-0.5, 0.2, 0.6, 1], 12, (y, a) => (1 + 0.5 * Math.exp(-Math.max(0, y) / 0.3)) * (1 + 0.12 * Math.sin(5 * a)), (y, a, s) => this.rampCol(P.redbark, 0.25 + K.hash2(s, 7, 4) * 0.4));
      const top = this.rampCol(P.redwoodMoss, 0.55);
      for (let s = 0; s < 12; s++) { const a0 = (s / 12) * 6.283, a1 = ((s + 1) / 12) * 6.283, j = 1 + K.hash2(s, 8, 4) * 0.5; pos.push(0, 1.05, 0, Math.cos(a1), 1 + (j - 1) * 0.6, Math.sin(a1), Math.cos(a0), 1, Math.sin(a0)); col.push(...top, ...top, ...top); }
      return RedwoodArt.geo(pos, col);
    }
    /** a light shaft: a tall plane whose alpha fades at both ends */
    shaftTex() {
      const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,240,205,0)'); g.addColorStop(0.25, 'rgba(255,240,205,0.9)'); g.addColorStop(0.75, 'rgba(255,236,190,0.55)'); g.addColorStop(1, 'rgba(255,230,180,0)');
      x.fillStyle = g; x.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
  }

  /** what of the forest you can see: instanced meshes near the view, regathered as you walk */
  class RedwoodView {
    constructor(game, forest) {
      this.g = game; this.f = forest; this.cfg = K.REDWOOD.forest; this.art = new RedwoodArt(); this.group = new THREE.Group(); this.group.name = 'redwoods';
      this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      this.fernMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const mk = (geo, cap, shadow, mat = this.mat) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(m); return m; };
      this.giant = GIANT_R.map((r, v) => [mk(this.art.tree(75, r, 35, 0, 11 + v), 700, true), mk(this.art.tree(75, r, 35, 1, 11 + v), 3000, false)]);
      this.mid = MID_R.map((r, v) => [mk(this.art.tree(30, r, 9, 0, 31 + v), 1600, true), mk(this.art.tree(30, r, 9, 1, 31 + v), 3000, false)]);
      this.logs = mk(this.art.log(), 500, true); this.stumps = mk(this.art.stump(), 400, true);
      this.ferns = mk(this.art.fern(), 7000, false, this.fernMat); this.sorrel = mk(this.art.sorrel(), 5000, false, this.fernMat);
      this.shaftMat = new THREE.MeshBasicMaterial({ map: this.art.shaftTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.16, fog: true });
      this.shafts = []; for (let q = 0; q < 12; q++) { const s = new THREE.Group(); for (const ry of [0, 1.5708]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shaftMat); p.rotation.y = ry; p.renderOrder = 5; s.add(p); } s.visible = false; this.group.add(s); this.shafts.push(s); }
      game.R.scene.add(this.group);
      this.at = null; this.near = []; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
      this.ambience = 0;
    }
    ground(x, z, r) { const d = this.g.play.doc; let y = d.tileY(x, z); if (r) for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) y = Math.min(y, d.tileY(x + dx, z + dz)); return y; }
    put(mesh, x, y, z, rot, sx, sy, sz) {
      const i = mesh.count; if (i >= mesh.instanceMatrix.count) return -1;
      this.q.setFromAxisAngle(this.up, rot); this.m4.compose(this.v.set(x, y, z), this.q, this.sc.set(sx, sy, sz)); mesh.setMatrixAt(i, this.m4); mesh.count = i + 1; return i;
    }
    /** gather what is near (x,z) into the instanced meshes */
    gather(x, z) {
      const f = this.f, c = this.cfg, all = [...this.giant.flat(), ...this.mid.flat(), this.logs, this.stumps, this.ferns, this.sorrel];
      for (const m of all) m.count = 0;
      this.near = []; const KD = KIND;
      f.near(x, z, c.drawGiantsM, (k) => {
        const d = Math.hypot(f.x[k] - x, f.z[k] - z), kd = f.kind[k], r = f.r[k];
        if (kd === KD.GIANT) { if (d > c.drawGiantsM) return; const near = d < c.drawGiantsLodM, s = f.ht[k] / 75, mesh = this.giant[f.variant[k]][near ? 0 : 1], i = this.put(mesh, f.x[k], this.ground(f.x[k], f.z[k], r), f.z[k], f.rot[k], s, s, s); if (near && i >= 0) this.near.push({ mesh, i, x: f.x[k], z: f.z[k], r: r * 1.3, s }); }
        else if (kd === KD.MID) { if (d > c.drawMidM) return; const near = d < c.drawGiantsLodM * 0.6, s = f.ht[k] / 30, mesh = this.mid[f.variant[k]][near ? 0 : 1], i = this.put(mesh, f.x[k], this.ground(f.x[k], f.z[k], r), f.z[k], f.rot[k], s, s, s); if (near && i >= 0) this.near.push({ mesh, i, x: f.x[k], z: f.z[k], r: r * 1.1, s }); }
        else if (kd === KD.LOG) { if (d < c.drawFloorM * 1.8) this.put(this.logs, f.x[k], this.ground(f.x[k], f.z[k]) + r * 0.55, f.z[k], -f.rot[k], f.len[k], r, r); }
        else if (d < c.drawFloorM * 1.8) this.put(this.stumps, f.x[k], this.ground(f.x[k], f.z[k], r * 0.5), f.z[k], f.rot[k], r, f.ht[k], r);
      });
      const S = f.cell, R = c.drawFloorM, ci0 = Math.max(0, Math.floor((x - R) / S)), ci1 = Math.min(f.ncx - 1, Math.floor((x + R) / S)), cj0 = Math.max(0, Math.floor((z - R) / S)), cj1 = Math.min(f.ncz - 1, Math.floor((z + R) / S));
      for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
        if (Math.hypot((ci + 0.5) * S - x, (cj + 0.5) * S - z) > R + S) continue;
        const fl = f.floor(ci, cj);
        for (const [arr, mesh] of [[fl.ferns, this.ferns], [fl.sorrel, this.sorrel]]) for (let q = 0; q < arr.length; q += 4) this.put(mesh, arr[q], this.ground(arr[q], arr[q + 1]), arr[q + 1], arr[q + 3], arr[q + 2], arr[q + 2], arr[q + 2]);
      }
      for (const m of all) { m.instanceMatrix.needsUpdate = true; m.instanceMatrix.clearUpdateRanges && m.instanceMatrix.clearUpdateRanges(); }
      // light shafts in the gaps near you (fixed spots on a 28 m grid, so they do not swim as you walk)
      let n = 0; const sg = 28, gx0 = Math.floor(x / sg) - 2, gz0 = Math.floor(z / sg) - 2;
      for (let gz = gz0; gz < gz0 + 5 && n < this.shafts.length; gz++) for (let gx = gx0; gx < gx0 + 5 && n < this.shafts.length; gx++) {
        const sx = (gx + K.hash2(gx, gz, 71)) * sg, sz = (gz + K.hash2(gx, gz, 72)) * sg; if (K.hash2(gx, gz, 73) > 0.55 || f.density(sx, sz) < 0.3 || f.solidAt(sx, sz)) continue;
        const s = this.shafts[n++], w = 3 + K.hash2(gx, gz, 74) * 5, h = 70; s.visible = true; s.position.set(sx, this.ground(sx, sz) + h * 0.42, sz); s.rotation.set(0.32, K.hash2(gx, gz, 75) * 0.5 + 0.6, 0.12); s.scale.set(w, h, w);
      }
      for (; n < this.shafts.length; n++) this.shafts[n].visible = false;
      this.at = { x, z };
    }
    /** trunks between the camera and the hero step aside (shrink away), as castle walls fade */
    cutaway(cam, me) {
      const ax = cam.position.x, az = cam.position.z, bx = me.x, bz = me.z, L = Math.hypot(bx - ax, bz - az) || 1;
      let dirty = new Set();
      for (const t of this.near) {
        const u = ((t.x - ax) * (bx - ax) + (t.z - az) * (bz - az)) / (L * L), cx = ax + (bx - ax) * u, cz = az + (bz - az) * u;
        const block = u > -0.05 && u < 0.97 && Math.hypot(t.x - cx, t.z - cz) < t.r + 0.6, hidden = !!t.hidden;
        if (block === hidden) continue;
        t.hidden = block; t.mesh.getMatrixAt(t.i, this.m4); this.m4.decompose(this.v, this.q, this.sc); this.sc.setScalar(block ? 0.0001 : t.s); this.m4.compose(this.v, this.q, this.sc); t.mesh.setMatrixAt(t.i, this.m4); dirty.add(t.mesh);
      }
      for (const m of dirty) m.instanceMatrix.needsUpdate = true;
    }
    update(dt, night) {
      const me = this.g.play.me; if (!me) return;
      if (!this.at || Math.hypot(me.x - this.at.x, me.z - this.at.z) > this.cfg.refreshM) this.gather(me.x, me.z);
      this.cutaway(this.g.app.camera, me);
      const amb = clamp01(this.f.density(me.x, me.z) * 1.4 + (this.f.inCore(me.x, me.z) ? 0 : 0.35));
      this.ambience += (amb - this.ambience) * Math.min(1, dt * 0.6);
      this.shaftMat.opacity = 0.16 * this.ambience * (1 - night);
    }
    dispose() {
      this.g.R.scene.remove(this.group);
      this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.mat.dispose(); this.fernMat.dispose(); this.shaftMat.map.dispose(); this.shaftMat.dispose();
    }
  }

  /* the young redwoods you can fell (doc props: chunk-merged like every other prop) */
  if (K.PropBuilder) {
    K.PropBuilder.PROPS['c:youngred'] = { name: 'Young redwood', group: 'Castle', r: 0.6, h: 7, interact: 'c_tree', build(pb, o, st) {
      if (st === 'depleted') return;
      const H = 7.5 * pb.rng.range(0.9, 1.15);
      pb.put(pb.bark, K.UNIT.trunk, K.M4(0, H * 0.3, 0, 0, 0, 0, 0.17, H * 0.6, 0.17));
      for (let i = 0; i < 6; i++) { const f = i / 6, r = 1.25 * (1 - f * 0.8), th = 1.7 * (1 - f * 0.3); pb.put(pb.pine, K.UNIT.cone, K.M4(pb.rng.range(-0.03, 0.03), H * 0.28 + f * H * 0.68 + th / 2, 0, 0, pb.rng.range(0, 6), 0, r, th, r), (u, v) => [u * 2 + i * 0.37, v]); }
    } };
  }

  Object.assign(K, { RedwoodForest, RedwoodArt, RedwoodView });
})(typeof window !== 'undefined' ? window : globalThis);
