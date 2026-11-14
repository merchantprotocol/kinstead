/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · world document (versioned JSON, tile/voxel grid). */
(function (G) {
  const K = G.K;
  const TILE = 0.5;                 // 1 tile = 1 block = 0.5 world units (diorama scale: sprites are ~1.5 units tall)
  const HQ = 0.25;                  // heights are stored as Int8 in quarter units: -32 .. +31.75 world units
  const FORMAT = 'kinstead-world-3d', VERSION = 2;   // v2 = v1 + objects of kind 'building' (worlds without buildings still save as v1)
  const T = { SNOW: 0, PATH: 1, DIRT: 2, ICE: 3, CHASM: 4, WATER: 5, SLATE: 6, ROCK: 7 };
  const TERRAINS = [
    { id: 0, key: 'snow', name: 'Snow', sw: '#dfe7f2' },
    { id: 1, key: 'path', name: 'Cobble path', sw: '#5a5860' },
    { id: 2, key: 'dirt', name: 'Frozen dirt', sw: '#4b3628' },
    { id: 3, key: 'ice', name: 'Ice', sw: '#73abcc' },
    { id: 4, key: 'chasm', name: 'Chasm floor', sw: '#27313e' },
    { id: 5, key: 'water', name: 'Dark water', sw: '#1b4262' },
    { id: 6, key: 'slate', name: 'Slate floor', sw: '#374152' },
    { id: 7, key: 'rock', name: 'Bare rock', sw: '#282c36' },
  ];
  const PRESETS = [['Small · 64 × 48', 64, 48], ['Medium · 128 × 96', 128, 96], ['Large · 256 × 192', 256, 192], ['Tiny · 32 × 24', 32, 24]];
  const OUTSIDE = -14;

  const b64 = {
    enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
    dec(str, n) { const s = atob(str); if (s.length !== n) throw new Error('Tile layer has ' + s.length + ' bytes, expected ' + n + '.'); const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = s.charCodeAt(i); return u; },
  };

  class WorldDoc {
    constructor(w, h, opts = {}) {
      this.w = w | 0; this.h = h | 0;
      this.name = opts.name || 'Untitled world'; this.seed = (opts.seed >>> 0) || 1;
      this.terrain = new Uint8Array(this.w * this.h);
      this.height = new Int8Array(this.w * this.h);
      this.objects = []; this.nextId = 1; this.camera = null; this.game = null; this.floorAt = null;
    }
    get wu() { return this.w * TILE; }
    get hu() { return this.h * TILE; }
    idx(i, j) { return j * this.w + i; }
    inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
    hq(i, j) { return this.inside(i, j) ? this.height[j * this.w + i] : OUTSIDE / HQ; }
    hy(i, j) { return this.inside(i, j) ? this.height[j * this.w + i] * HQ : OUTSIDE; }
    type(i, j) { return this.inside(i, j) ? this.terrain[j * this.w + i] : T.SNOW; }
    tileOf(x, z) { return [Math.floor(x / TILE), Math.floor(z / TILE)]; }
    tileY(x, z) { return this.hy(Math.floor(x / TILE), Math.floor(z / TILE)); }
    uid(prefix) { return prefix + (this.nextId++).toString(36); }
    obj(id) { return this.objects.find((o) => o.id === id); }
    buildings() { return this.objects.filter((o) => o.kind === 'building'); }
    /* where something standing at (x,z) rests: a building floor, the ground, or a bridge deck.
       floorAt(i, j) is supplied by the renderer's BuildingSet (null outside buildings). */
    groundY(x, z, skipId) {
      if (this.floorAt) { const fy = this.floorAt(Math.floor(x / TILE), Math.floor(z / TILE)); if (fy != null) return fy; }
      let y = this.tileY(x, z);
      for (const o of this.objects) {
        if (o.kind !== 'bridge' || o.id === skipId) continue;
        const d = WorldDoc.bridgeLocal(o, x, z);
        if (d.s >= -0.05 && d.s <= d.L + 0.05 && Math.abs(d.n) < (o.w || 1.6) / 2 - 0.05) y = Math.max(y, WorldDoc.deckY(this, o, d.s / d.L));
      }
      return y;
    }
    static bridgeLocal(o, x, z) {
      const [ax, az] = o.a, [bx, bz] = o.b, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
      return { s: ((x - ax) * dx + (z - az) * dz) / L, n: (-(x - ax) * dz + (z - az) * dx) / L, L };
    }
    static bridgeEnds(doc, o) { return [Math.max(0, doc.tileY(o.a[0], o.a[1])), Math.max(0, doc.tileY(o.b[0], o.b[1]))]; }
    static deckY(doc, o, t) {
      t = Math.max(0, Math.min(1, t)); const [ya, yb] = WorldDoc.bridgeEnds(doc, o);
      const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
      return 0.04 + ya + (yb - ya) * t + Math.min(0.16, L * 0.03) * Math.sin(Math.PI * t);
    }
    clone() { return WorldDoc.fromJSON(JSON.parse(JSON.stringify(this.toJSON()))); }
    toJSON() {
      return {
        format: FORMAT, version: K.WorldV2 ? K.WorldV2.versionFor(this.objects) : 1, name: this.name, seed: this.seed,
        size: { w: this.w, h: this.h }, tileSize: TILE, heightUnit: HQ,
        legend: TERRAINS.map((t) => t.key),
        tiles: { terrain: b64.enc(this.terrain), height: b64.enc(new Uint8Array(this.height.buffer, this.height.byteOffset, this.height.length)) },
        objects: this.objects, nextId: this.nextId, camera: this.camera,
        ...(this.game ? { game: this.game } : {}),
      };
    }
    static fromJSON(o) {
      if (!o || o.format !== FORMAT) throw new Error('Not a Kinstead 3D world file (format should be "' + FORMAT + '").');
      if (!(o.version >= 1)) throw new Error('Missing world format version.');
      if (o.version > VERSION) throw new Error('This world was saved by a newer builder (v' + o.version + '). This builder reads v' + VERSION + '.');
      const w = o.size && o.size.w | 0, h = o.size && o.size.h | 0;
      if (!(w >= 8 && h >= 8 && w <= 512 && h <= 512)) throw new Error('World size must be between 8 and 512 tiles on each side.');
      const d = new WorldDoc(w, h, { name: o.name, seed: o.seed });
      d.terrain.set(b64.dec(o.tiles.terrain, w * h));
      d.height.set(new Int8Array(b64.dec(o.tiles.height, w * h).buffer));
      for (let i = 0; i < d.terrain.length; i++) if (d.terrain[i] >= TERRAINS.length) d.terrain[i] = 0;
      const objs = K.WorldV2 ? K.WorldV2.upgrade(o).objects : o.objects;   // normalizes buildings (fills defaults, furniture ids)
      d.objects = Array.isArray(objs) ? objs.filter((x) => x && x.id && x.kind) : [];
      d.game = o.game && typeof o.game === 'object' ? o.game : null;
      d.nextId = Math.max(o.nextId | 0, 1); d.camera = o.camera || null;
      return d;
    }
  }

  Object.assign(K, { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, WORLD_FORMAT: FORMAT, WORLD_VERSION: VERSION, OUTSIDE });
})(typeof window !== 'undefined' ? window : globalThis);

/* Ground painter: the diorama's per-texel palettes, driven by the tile grid instead of the hand-made layout. */
(function (G) {
  const K = G.K;
  const { TP, rampPick, bayer, hash2, PixelBuffer, ramp, T, TILE } = K;
  const SLATE_ORIGIN = { x0: 0.1, z0: 0.2 };
  const WATER = ramp('#0b1a2a', '#10263c', '#163450', '#1d4566', '#28597e', '#3a7499');

  class GroundPainter extends K.TexturePainter {
    constructor(seed) { super(seed); }
    /* paint tiles [i0,i1) x [j0,j1) of the doc into buffers that cover chunk origin (ci0,cj0); ppu texels per world unit */
    paint(doc, out, spark, ci0, cj0, i0, j0, i1, j1, ppu) {
      const tpx = TILE * ppu, n = this.n;
      const W = doc.w;
      const wts = new Float32Array(8);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const hq = doc.height[j * W + i], own = doc.terrain[j * W + i];
        const lowN = doc.hq(i, j - 1) < hq, lowS = doc.hq(i, j + 1) < hq, lowW = doc.hq(i - 1, j) < hq, lowE = doc.hq(i + 1, j) < hq;
        const y = hq * K.HQ;
        for (let ty = 0; ty < tpx; ty++) for (let tx = 0; tx < tpx; tx++) {
          const px = (i - ci0) * tpx + tx, py = (j - cj0) * tpx + ty;
          const gx = i * tpx + tx, gy = j * tpx + ty;           // global texel coords keep dither/hash seamless across chunks
          const x = (gx + 0.5) / ppu, z = (gy + 0.5) / ppu, bd = bayer(gx, gy);
          // bilinear type weights from same-level neighbours -> organic, noisy edges like the diorama masks
          wts.fill(0);
          const u = x / TILE - 0.5, v = z / TILE - 0.5, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
          for (let k = 0; k < 4; k++) {
            const ii = iu + (k & 1), jj = iv + (k >> 1), wgt = ((k & 1) ? fu : 1 - fu) * ((k >> 1) ? fv : 1 - fv);
            const t2 = doc.inside(ii, jj) && doc.height[jj * W + ii] === hq ? doc.terrain[jj * W + ii] : own;
            wts[t2] += wgt;
          }
          let typ = own, best = -9, nt = 0;
          for (let t2 = 0; t2 < 8; t2++) if (wts[t2] > 0) nt++;
          if (nt > 1) for (let t2 = 0; t2 < 8; t2++) {
            if (wts[t2] === 0) continue;
            const s = wts[t2] + (n.fbm(x * 1.3 + t2 * 17.3, z * 1.3 - t2 * 7.1, 2) - 0.5) * 0.6 + (bd - 0.5) * 0.16;
            if (s > best) { best = s; typ = t2; }
          }
          const c = this.texel(typ, x, z, gx, gy, bd, wts, y, own);
          let cc = c;
          // cliff lip: compacted brighter snow along edges that drop away
          if (typ !== T.WATER && typ !== T.ICE) {
            const fx = tx / tpx, fz = ty / tpx;
            let de = 9;
            if (lowN) de = Math.min(de, fz * TILE); if (lowS) de = Math.min(de, (1 - fz) * TILE);
            if (lowW) de = Math.min(de, fx * TILE); if (lowE) de = Math.min(de, (1 - fx) * TILE);
            de += (hash2(gx >> 1, gy >> 1, 61) - 0.5) * 0.05;
            if (de < 0.07) cc = TP.snow[5]; else if (de < 0.16 && bd < 0.5) cc = TP.snow[4];
          }
          const oi = (py * out.w + px) * 4, od = out.data, sd = spark.data;
          od[oi] = cc[0]; od[oi + 1] = cc[1]; od[oi + 2] = cc[2]; od[oi + 3] = 255;
          if ((cc === TP.snow[5] || cc === TP.ice[6] || cc === WATER[5]) && hash2(gx, gy, 77) < 0.35) { sd[oi] = 255; sd[oi + 1] = Math.floor(hash2(gx, gy, 78) * 255); sd[oi + 2] = 0; sd[oi + 3] = 255; }
          else { sd[oi] = 0; sd[oi + 1] = 0; sd[oi + 2] = 0; sd[oi + 3] = 255; }
        }
      }
    }
    texel(typ, x, z, px, py, bd, wts, y, own) {
      switch (typ) {
        case T.PATH: {
          const pm = Math.min(1, wts[T.PATH] * 1.15 + 0.1);
          return this.pathPx(x, z, px, py, bd, pm);
        }
        case T.ICE: {
          const im = Math.min(0.9, (wts[T.ICE] - 0.35) * 1.1);
          return this.icePx(x, z, px, py, bd, Math.max(0.14, im));
        }
        case T.DIRT: {
          const tuft = this.n.fbm(x * 4, z * 4, 2), blade = hash2(px, py >> 1, 51);
          if (tuft > 0.5 && blade < 0.55) return TP.grass[1 + Math.min(4, ((tuft - 0.5) * 9 + (py % 2 ? 0 : 1)) | 0)];
          if (hash2(px, py, 52) < 0.03) return TP.snow[3];
          return rampPick(TP.mud, 0.3 + tuft * 0.55, px, py, 0.3);
        }
        case T.CHASM: return y < -6 ? this.forestFloorT(x, z, px, py) : this.snowPx(x, z, px, py, bd, 0.85);
        case T.WATER: {
          const m = this.n.fbm(x * 1.4, z * 1.4, 3), streak = Math.sin((x * 0.8 + z * 0.5) * 6 + this.n.fbm(x, z, 2) * 4);
          if (streak > 0.95 && hash2(px, py, 9) < 0.6) return WATER[5];
          return rampPick(WATER, 0.25 + (m - 0.5) * 0.7 + (streak > 0.7 ? 0.25 : 0), px, py, 0.35);
        }
        case T.SLATE: {
          const room = SLATE_ORIGIN;
          return this.slatePx(x, z, px, py, bd, room) || this.snowPx(x, z, px, py, bd, 1);
        }
        case T.ROCK: return this.rockTopPx2(x, z, px, py, bd);
        default:
          if (y >= 1.5) return this.rockTopPx(x, z, px, py, bd);
          if (y < -6) return this.snowPx(x, z, px, py, bd, 0.8);
          {
            // dirt fringe next to paths, as in the diorama's pathMask falloff
            const pm = wts[T.PATH];
            if (pm > 0.05 && hash2(px, py, 5) < pm * 0.45) return rampPick(TP.mud, 0.5 + pm, px, py, 0.25);
            const im = wts[T.ICE];
            if (im > 0.02 && hash2(px, py, 8) < 0.5) return TP.snow[5];
          }
          return this.snowPx(x, z, px, py, bd, 1);
      }
    }
    forestFloorT(x, z, px, py) {
      const v = this.n.fbm(x * 1.2, z * 1.2, 4);
      const rid = Math.abs(this.n2.fbm(x * 0.18, z * 0.18, 3) - 0.5);
      if (rid < 0.035 + (this.n2.fbm(x * 3, z * 3, 2) - 0.5) * 0.03) return rampPick(TP.ice, 0.45 + (v - 0.5), px, py, 0.3);
      if (hash2(px, py, 21) < 0.06) return TP.needle[(hash2(px, py, 22) * 3) | 0];
      return rampPick(TP.forest, v * 1.15 - 0.05, px, py, 0.35);
    }
    pathPx(x, z, px, py, bd, pm) {
      // the diorama's path texel, with cobbles a little more likely so narrow tile paths still read as cobbled
      const n = this.n, n2 = this.n2, cob = n2.fbm(x * 0.8, z * 0.8, 3) + 0.06;
      if (cob > 0.42 && pm > 0.55) {
        const S = 3.4, wx = x * S, wz = z * S * 1.15, e = 1 / 32;
        const [d1, d2, id] = n.worley(wx, wz);
        if (d2 - d1 < 0.11) return rampPick(TP.mud, 0.25 + hash2(px, py, 3) * 0.3, px, py, 0.5);
        const pal = id > 0.65 ? TP.cobbleWarm : TP.cobble;
        const idTL = n.worley(wx - e * S * 1.5, wz - e * S * 1.7)[2], idBR = n.worley(wx + e * S * 1.5, wz + e * S * 1.7)[2];
        let v = 0.35 + id * 0.35 - d1 * 0.25;
        if (idTL !== id) v += 0.35; else if (idBR !== id) v -= 0.3;
        if (n.fbm(x * 3, z * 3, 2) > 0.66) return rampPick(TP.snow, 0.55 + (v - 0.5) * 0.4, px, py, 0.3);
        return rampPick(pal, v, px, py, 0.25);
      }
      return super.pathPx(x, z, px, py, bd, 0.3);
    }
    rockTopPx2(x, z, px, py, bd) {
      const v = this.n2.fbm(x * 1.4, z * 1.4, 4);
      if (v < 0.58) return rampPick(TP.rock, 0.25 + v * 1.1, px, py, 0.28);
      if (v < 0.61 && bd < 0.5) return TP.snow[1];
      return this.snowPx(x, z, px, py, bd, 0.9);
    }
  }
  K.GroundPainter = GroundPainter;
})(typeof window !== 'undefined' ? window : globalThis);
