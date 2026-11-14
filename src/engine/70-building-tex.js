/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead 2D-HD diorama · buildings: pixel-painted textures for walls, roofs, floors and furniture.
   Same method as TexturePainter: per-texel palettes + ordered dither, 32 texels per world unit. */
(function (G) {
  const K = G.K;
  const { TP, ramp, rampPick, hash2, PixelBuffer } = K;

  const BP = {
    plaster: ramp('#3d352f', '#5b5047', '#7a6c5e', '#968671', '#ae9e86', '#c3b49b', '#d6c9b1'),
    timber: ramp('#0b0806', '#160f0a', '#22170f', '#311f13', '#422a19', '#553722'),
    thatch: ramp('#1c150b', '#312513', '#47371b', '#5f4b25', '#795f30', '#93763e', '#ad8f50'),
    shingle: ramp('#120d0b', '#1d1612', '#2b201a', '#3a2c23', '#4c3a2e', '#5f4a3a'),
    floor: ramp('#170f0a', '#25180f', '#352315', '#47301c', '#5b3e24', '#704d2e', '#875e39'),
    straw: ramp('#211709', '#36260f', '#4f3818', '#6a4c22', '#86622e', '#a07a3c', '#b8924f'),
    linen: ramp('#4d4c52', '#77757a', '#a29d9a', '#c6bfb6', '#e3dccf', '#f5f0e5'),
    blue: ramp('#090d1b', '#131c35', '#1e2d55', '#2c4176', '#3f5994', '#5876b0'),
    green: ramp('#0b130e', '#142219', '#1e3324', '#2a4631', '#3a5c40', '#4f7552'),
    leather: ramp('#120a07', '#24150d', '#3a2315', '#53331e', '#6d4427', '#8a5832'),
    steel: ramp('#161a22', '#2b3240', '#47516a', '#6a7891', '#95a3bb', '#c4cfdf', '#eef3fa'),
    brass: ramp('#22150a', '#4d3313', '#7a5520', '#a77b31', '#d2a74a', '#f2d47a'),
    horse: ramp('#1c1009', '#341d10', '#4f2c18', '#6c3e21', '#8a522c', '#a86939', '#c4834c'),
    mane: ramp('#060608', '#0e0e12', '#18171d', '#24222a', '#33303a'),
    hay: ramp('#30260f', '#4f4018', '#705c24', '#917832', '#b09444', '#cbb05c', '#e0c879'),
    wax: ramp('#5f5848', '#958c75', '#c3b99f', '#e3dac2', '#f7f1df'),
    soot: ramp('#07070a', '#101013', '#18181c', '#222227', '#2d2c31'),
    glass: ramp('#0f1726', '#1a2a40', '#2a4058', '#3d5670'),
    glow: ramp('#5a1e08', '#9c3c10', '#d9661c', '#f79a36', '#ffc768', '#fff0b8'),
    water: ramp('#0a1828', '#10243a', '#17334f', '#1f4566', '#2c5c80'),
    food: ramp('#2a0c08', '#4e1a10', '#7a2c18', '#a24526', '#c4663a', '#df9258'),
    bread: ramp('#2b170a', '#4f2c12', '#76451e', '#9c652d', '#bf8843', '#dcae66'),
    book: [ramp('#1a0609', '#3a0d14', '#5e1822', '#842a32'), ramp('#081022', '#122243', '#1e3766', '#2f4f8a'), ramp('#0a160c', '#15291a', '#22402a', '#335a3c'), ramp('#24160a', '#462b12', '#6b4420', '#8f6130'), ramp('#1a1520', '#2f2638', '#463a55', '#5f5272')],
  };

  class BuildingPainter extends K.TexturePainter {
    constructor(seed = 7) { super(seed); }
    buf(w, h, fn) { const out = new PixelBuffer(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) out.set(x, y, c, c[3] === undefined ? 255 : c[3]); } return out; }

    /* lime plaster, 64x64 = 2x2 units: soft mottling, grime near the bottom, hairline cracks, chipped patches showing stone */
    plaster() {
      const n = this.n, n2 = this.n2;
      return this.buf(64, 64, (x, y) => {
        let v = 0.62 + (n.fbm(x * 0.09, y * 0.09, 4) - 0.5) * 0.5 + (hash2(x, y, 3) - 0.5) * 0.06;
        if (y > 50) v -= (y - 50) * 0.018;
        const crack = Math.abs(n2.fbm(x * 0.06 + 3, y * 0.06, 3) - 0.5);
        if (crack < 0.012 && hash2(x >> 1, y >> 1, 4) < 0.8) return BP.plaster[1];
        const chip = n2.fbm(x * 0.11 + 40, y * 0.11, 3);
        if (chip > 0.7) {
          const [d1, d2] = n.worley(x * 0.18, y * 0.25);
          if (d2 - d1 < 0.09) return TP.stone[0];
          return rampPick(TP.stoneWarm, 0.3 + d1 * 0.6, x, y, 0.3);
        }
        if (chip > 0.67) v -= 0.25;
        return rampPick(BP.plaster, v, x, y, 0.3);
      });
    }
    /* dark adzed beam, grain along u */
    timber() {
      return this.buf(32, 32, (x, y) => {
        let v = 0.42 + Math.sin(y * 0.9 + this.n.value(x * 0.12, y * 0.4) * 5) * 0.14 + (hash2(x >> 2, y, 6) - 0.5) * 0.12;
        if (hash2(x >> 3, y >> 2, 7) < 0.05) v -= 0.25;
        return rampPick(BP.timber, v, x, y, 0.25);
      });
    }
    /* dressed stone courses (0.25 unit rows), staggered joints, warm/cool stones, frost in the mortar */
    ashlar() {
      return this.buf(64, 64, (x, y) => {
        const row = Math.floor(y / 8), ly = y % 8, off = (row % 2) * 9 + ((hash2(row, 2, 9) * 6) | 0);
        const bw = 14 + ((hash2(row, 3, 9) * 6) | 0), col = Math.floor((x + off) / bw), lx = (x + off) % bw;
        const id = hash2(col, row, 11), pal = id > 0.7 ? TP.stoneWarm : TP.stone;
        if (ly === 7 || lx === bw - 1) return hash2(x, y, 12) < 0.25 ? TP.snow[1] : TP.stone[0];
        let v = 0.36 + id * 0.3 + (this.n.fbm(x * 0.3, y * 0.3, 2) - 0.5) * 0.35;
        if (ly === 0 || lx === 0) v += 0.25; else if (ly === 6 || lx === bw - 2) v -= 0.2;
        if (id < 0.12 && ly > 3 && hash2(x, y, 13) < 0.5) return rampPick(TP.moss, 0.6, x, y, 0.4);
        return rampPick(pal, v, x, y, 0.28);
      });
    }
    /* straw thatch: overlapping courses, strands along v (eave -> ridge) */
    thatch() {
      return this.buf(32, 64, (x, y) => {
        const course = Math.floor(y / 12), ly = y % 12;
        let v = 0.32 + (hash2(x, course, 14) - 0.5) * 0.5 + this.n.fbm(x * 0.2, y * 0.05, 2) * 0.3 - ly * 0.022;
        if (ly < 2) v -= 0.3;
        if (hash2(x, y >> 2, 15) < 0.08) v += 0.3;
        return rampPick(BP.thatch, v, x, y, 0.3);
      });
    }
    /* slate roof: overlapping rectangular slates, rows along u; v runs eave -> ridge */
    slateRoof() {
      return this.buf(32, 32, (x, y) => {
        const row = Math.floor(y / 6), ly = y % 6, off = (row % 2) * 4, col = Math.floor((x + off) / 8), lx = (x + off) % 8;
        const id = hash2(col, row, 16);
        if (ly === 0) return TP.slate[0];
        if (lx === 0 && ly < 5) return TP.slate[1];
        let v = 0.3 + id * 0.45 - ly * 0.04 + (this.n.fbm(x * 0.4, y * 0.4, 2) - 0.5) * 0.2;
        if (ly === 1) v += 0.2;
        if (id > 0.93) return rampPick(TP.moss, 0.5, x, y, 0.4);
        return rampPick(TP.slate, v, x, y, 0.25);
      });
    }
    /* split-wood shingles */
    shingleRoof() {
      return this.buf(32, 32, (x, y) => {
        const row = Math.floor(y / 8), ly = y % 8, off = (row % 2) * 3, col = Math.floor((x + off) / 6), lx = (x + off) % 6;
        const id = hash2(col, row, 17);
        if (ly === 0) return BP.shingle[0];
        if (lx === 0) return BP.shingle[1];
        const v = 0.3 + id * 0.45 - ly * 0.03 + Math.sin(x * 1.3 + id * 9) * 0.06;
        return rampPick(BP.shingle, v, x, y, 0.25);
      });
    }
    /* snow sheet for roof slopes (RGBA): v = 0 at the eave (ragged, drippy edge), thinning into patches lower down */
    roofSnow() {
      const W = 128, H = 96;
      return this.buf(W, H, (x, y) => {
        const v = y / H, edge = 0.07 + this.n.fbm(x * 0.09, 3.3, 2) * 0.09 + (hash2(x >> 1, 0, 18) < 0.12 ? -0.04 : 0);
        if (v < edge) return null;
        const holes = this.n2.fbm(x * 0.045 + 9, y * 0.06, 4);
        if (holes < 0.4 - v * 0.22 && v < 0.8) return null;
        let s = 0.62 + (this.n.fbm(x * 0.12, y * 0.12, 3) - 0.5) * 0.5;
        if (v < edge + 0.025) s += 0.3;
        if (holes < 0.44 - v * 0.22) s -= 0.3;
        const c = hash2(x, y, 19) < 0.02 ? TP.snow[5] : rampPick(TP.snow, s, x, y, 0.3);
        return [c[0], c[1], c[2], 255];
      });
    }
    floorBoards() {
      return this.buf(32, 32, (x, y) => {
        const b = Math.floor(x / 8), lx = x % 8, joint = (hash2(b, 0, 20) * 32) | 0, seg = y >= joint ? 1 : 0;
        const id = hash2(b, seg, 21);
        let v = 0.36 + id * 0.3 + Math.sin(y * 0.6 + id * 20 + this.n.value(x * 0.3, y * 0.1) * 3) * 0.07;
        if (lx === 0) v = 0.02; else if (lx === 1) v += 0.18; else if (lx === 7) v -= 0.18;
        if (y === joint) v = 0.05;
        if ((y === (joint + 2) % 32 || y === (joint + 29) % 32) && (lx === 3 || lx === 4)) return TP.iron[3];
        return rampPick(BP.floor, v, x, y, 0.25);
      });
    }
    flagstones() {
      return this.buf(64, 64, (x, y) => {
        const [d1, d2, id] = this.n.worley(x * 0.07, y * 0.07);
        if (d2 - d1 < 0.06) return hash2(x, y, 22) < 0.3 ? TP.mud[2] : TP.stone[0];
        const pal = id > 0.6 ? TP.stoneWarm : TP.stone;
        const v = 0.35 + id * 0.3 - d1 * 0.15 + (this.n2.fbm(x * 0.2, y * 0.2, 2) - 0.5) * 0.25;
        return rampPick(pal, v, x, y, 0.28);
      });
    }
    strawFloor() {
      return this.buf(32, 32, (x, y) => {
        const m = this.n.fbm(x * 0.15, y * 0.15, 3);
        if (m < 0.4) return rampPick(TP.mud, 0.3 + m, x, y, 0.4);
        const strand = hash2(x + (y >> 1), y, 23);
        return rampPick(BP.straw, 0.25 + strand * 0.55 + (m - 0.5) * 0.4, x, y, 0.3);
      });
    }
    /* woven rug: border, field pattern, fringe (u across, v along) */
    rug(pal = TP.cloth, pal2 = BP.blue) {
      const W = 48, H = 64;
      return this.buf(W, H, (x, y) => {
        if (y < 2 || y > H - 3) return x % 2 ? BP.linen[3] : null;
        const bx = Math.min(x, W - 1 - x), by = Math.min(y - 2, H - 3 - y), b = Math.min(bx, by);
        let c;
        if (b < 2) c = pal2[1]; else if (b < 5) c = (x + y) % 4 < 2 ? BP.linen[3] : pal2[3];
        else if (b < 6) c = pal2[1];
        else {
          const cx = Math.abs(x - W / 2 + 0.5), cy = Math.abs(y - H / 2 + 0.5);
          const dia = (cx + cy) % 12;
          c = dia < 2 ? BP.linen[4] : dia < 4 ? pal2[3] : rampPick(pal, 0.45 + this.n.fbm(x * 0.2, y * 0.2, 2) * 0.3, x, y, 0.3);
        }
        return hash2(x, y, 24) < 0.05 ? K.mix(c, [20, 14, 12], 0.35) : c;
      });
    }
    /* checked wool blanket */
    blanket(pal = TP.cloth) {
      return this.buf(32, 32, (x, y) => {
        const chk = (((x >> 3) + (y >> 3)) & 1), stripe = (x % 8 === 3 || y % 8 === 3);
        let v = 0.45 + chk * 0.25 + Math.sin(x * 0.5) * 0.05;
        if (stripe) return BP.linen[2];
        return rampPick(pal, v, x, y, 0.3);
      });
    }
    linen() { return this.buf(32, 32, (x, y) => rampPick(BP.linen, 0.62 + (this.n.fbm(x * 0.2, y * 0.2, 2) - 0.5) * 0.4 + (y % 4 === 0 ? -0.08 : 0), x, y, 0.3)); }
    /* book spines filling a shelf front (u along shelf, v up) */
    books() {
      return this.buf(32, 32, (x, y) => {
        let s = 0, i = 0, w;
        for (;;) { w = 2 + ((hash2(i, 0, 25) * 3) | 0); if (x < s + w) break; s += w; i++; }
        const top = 3 + ((hash2(i, 1, 25) * 6) | 0);
        if (y < top) return BP.soot[2];
        const pal = BP.book[(hash2(i, 2, 25) * BP.book.length) | 0];
        let v = 0.55 + (x === s ? -0.3 : x === s + w - 1 ? -0.15 : 0.1);
        if (y === top + 3 || y === 28) return BP.brass[3];
        return rampPick(pal, v, x, y, 0.3);
      });
    }
    /* leaded window pane, warm interior glow (used on an emissive material; colour scaled by night) */
    windowPane() {
      return this.buf(16, 24, (x, y) => {
        if (x === 0 || y === 0 || x === 15 || y === 23 || x === 7 || x === 8 || y === 11 || y === 12) return BP.soot[1];
        const v = 0.55 + (this.n.fbm(x * 0.3, y * 0.2, 2) - 0.5) * 0.5 - (y < 12 ? 0.05 : 0);
        if ((x + y) % 7 === 0 && hash2(x, y, 26) < 0.6) return BP.glow[5];
        return rampPick(BP.glow, v, x, y, 0.35);
      });
    }
    hay() {
      return this.buf(32, 32, (x, y) => {
        const strand = hash2(x, (y + (x >> 2)) >> 1, 27);
        let v = 0.3 + strand * 0.55 + this.n.fbm(x * 0.2, y * 0.2, 2) * 0.2;
        if (y % 11 === 0 && x % 2) return BP.leather[2];
        return rampPick(BP.hay, v, x, y, 0.3);
      });
    }
    coat(pal) { return this.buf(16, 16, (x, y) => rampPick(pal, 0.45 + (this.n.fbm(x * 0.3, y * 0.3, 2) - 0.5) * 0.5 + (hash2(x, y, 28) - 0.5) * 0.1, x, y, 0.3)); }
    metal(pal) {
      return this.buf(16, 16, (x, y) => {
        let v = 0.5 + (this.n.fbm(x * 0.4, y * 0.4, 2) - 0.5) * 0.35;
        if (y === 0 || x === 0) v += 0.3; else if (y === 15 || x === 15) v -= 0.3;
        return rampPick(pal, v, x, y, 0.3);
      });
    }
    /* glowing coals for forge beds and hearth embers */
    coals() {
      return this.buf(16, 16, (x, y) => {
        const [d1, d2] = this.n.worley(x * 0.35, y * 0.35);
        if (d2 - d1 < 0.12) return BP.soot[0];
        return rampPick(BP.glow, 0.25 + (1 - d1) * 0.7, x, y, 0.4);
      });
    }
    /* wall-hung banner cloth (alpha) */
    hanging(pal = BP.blue) {
      const W = 16, H = 32;
      return this.buf(W, H, (x, y) => {
        if (y > 26 && Math.abs(x - 7.5) > (31 - y) * 1.7) return null;
        let c = rampPick(pal, 0.5 + Math.sin(x * 0.8) * 0.12 - y * 0.005, x, y, 0.25);
        if (x === 0 || x === W - 1) c = pal[1];
        const dx = Math.abs(x - 7.5), dy = Math.abs(y - 13);
        if (dx + dy < 4.5 && dx + dy > 2.5) c = BP.brass[4];
        if (y < 2) c = BP.timber[3];
        return c;
      });
    }
  }

  Object.assign(K, { BP, BuildingPainter });
})(typeof window !== 'undefined' ? window : globalThis);
