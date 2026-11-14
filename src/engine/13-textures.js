/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead 2D-HD diorama: procedural pixel-art textures painted per texel with hand-tuned palettes. */
(function (G) {
  const K = G.K;
  const { ramp, rampPick, bayer, hash2, PixelBuffer, Noise } = K;

  const TP = {
    snow: ramp('#74849f', '#8d9db9', '#a9b8d0', '#c6d2e3', '#dfe7f2', '#f1f5fb'),
    snowDim: ramp('#4f5d74', '#62718a', '#7888a2', '#91a1ba'),
    mud: ramp('#1d1512', '#2a1f19', '#3a2a20', '#4b3628', '#5e4532'),
    cobble: ramp('#25252b', '#34343c', '#46454d', '#5a5860', '#706d73', '#8a8689'),
    cobbleWarm: ramp('#2b2522', '#3c332e', '#504540', '#665952', '#7f7167'),
    slate: ramp('#161b24', '#202733', '#2b3342', '#374152', '#445064', '#556279', '#6a7890'),
    ice: ramp('#2c587a', '#3d7096', '#548db3', '#73abcc', '#9acbe2', '#c7e7f4', '#f2fcff'),
    forest: ramp('#1c242f', '#27313e', '#323e4e', '#404d60', '#536176'),
    needle: ramp('#0f1612', '#17221b', '#203127'),
    cliff: ramp('#121419', '#1b1e26', '#252935', '#303644', '#3d4454', '#4c5466', '#5e687b'),
    strataWarm: ramp('#1d1918', '#2a2422', '#3a312d', '#4b403a', '#5e5148'),
    rock: ramp('#0d0e12', '#15171d', '#1e2129', '#282c36', '#343945', '#424856'),
    stone: ramp('#1c1d22', '#2a2b31', '#3a3a41', '#4c4b52', '#605e64', '#78757a', '#918d8f'),
    stoneWarm: ramp('#211d1b', '#302a27', '#423935', '#564b45', '#6c5f57', '#857669'),
    moss: ramp('#1b2419', '#26331f', '#344527'),
    wood: ramp('#120c08', '#21160e', '#331f13', '#47301c', '#5d4026', '#765333', '#8f6a44'),
    iron: ramp('#0b0c10', '#16181e', '#22252d', '#30343e', '#454a55', '#636a76'),
    pine: ramp('#0a120f', '#102019', '#162a20', '#1f3829', '#2a4733', '#385a40'),
    bark: ramp('#0e0a08', '#1a130f', '#281d16', '#38291f', '#4a382a', '#5c4836'),
    cloth: ramp('#1a070c', '#3a0d16', '#5c1420', '#82202a', '#a8383a'),
    grass: ramp('#1f1e1a', '#2e2c25', '#423f33', '#58543f', '#6f6a4f', '#8a8466'),
    fern: ramp('#0f1a12', '#18291a', '#223a22', '#2f4d2c', '#40633a'),
  };

  class TexturePainter {
    constructor(seed = 1) { this.n = new Noise(seed); this.n2 = new Noise(seed * 7 + 3); }

    /* ---------- unique ground map for the whole diorama (top faces) ---------- */
    ground(layout, ppu = 32) {
      const W = layout.W * ppu, H = layout.D * ppu;
      const out = new PixelBuffer(W, H), spark = new PixelBuffer(W, H);
      const n = this.n, n2 = this.n2;
      for (let py = 0; py < H; py++) {
        const z = layout.Z0 + (py + 0.5) / ppu;
        const [xw, xe] = layout.chasmEdges(z);
        for (let px = 0; px < W; px++) {
          const x = layout.X0 + (px + 0.5) / ppu;
          const bd = bayer(px, py);
          const inChasm = x > xw && x < xe;
          const h = inChasm ? layout.height(x, z) : 0;
          let c;
          if (inChasm && h < -6) c = this.forestFloor(x, z, px, py, layout);
          else {
            c = this.snowPx(x, z, px, py, bd, inChasm ? 0.85 : 1);
            if (!inChasm) {
              const room = layout.roomAt(x, z);
              if (room) c = this.slatePx(x, z, px, py, bd, room) || c;
              const pm = layout.pathMask(x, z);
              if (pm + (bd - 0.5) * 0.55 > 0.5) c = this.pathPx(x, z, px, py, bd, pm);
              else if (pm > 0.05 && hash2(px, py, 5) < pm * 0.45) c = rampPick(TP.mud, 0.5 + pm, px, py, 0.25);
              const im = layout.iceMask(x, z);
              if (im + (bd - 0.5) * 0.18 > 0.06) c = this.icePx(x, z, px, py, bd, im);
              else if (im > -0.08 && hash2(px, py, 8) < 0.5) c = TP.snow[5];
              if (x >= xe && layout.height(x, z) > 1) c = this.rockTopPx(x, z, px, py, bd);
              // cliff lip: compacted brighter snow 1-2px along the edge
              const de = Math.min(Math.abs(x - xw), Math.abs(x - xe));
              if (de < 0.07 && layout.height(x, z) >= 0) c = TP.snow[5];
              else if (de < 0.16 && layout.height(x, z) >= 0 && bd < 0.5) c = TP.snow[4];
            }
          }
          out.set(px, py, c);
          if (c === TP.snow[5] || c === TP.ice[6]) {
            if (hash2(px, py, 77) < 0.35) spark.set(px, py, [255, Math.floor(hash2(px, py, 78) * 255), 0]);
          }
        }
      }
      return { tex: out, spark };
    }
    snowPx(x, z, px, py, bd, bright) {
      const n = this.n;
      const base = n.fbm(x * 0.9, z * 0.9, 4);
      const rip = Math.sin((x * 0.7 + z * 2.4) * 2.6 + n.fbm(x * 0.5, z * 0.5, 2) * 7);
      let v = (0.5 + (base - 0.5) * 1.3 + rip * 0.06) * bright;
      const gp = this.n2.fbm(x * 0.55 + 11, z * 0.55, 3) + (this.n.fbm(x * 3, z * 3, 2) - 0.5) * 0.25;
      if (bright >= 1 && gp > 0.66) {
        // frozen earth with dead grass tufts poking through
        const blade = hash2(px, py >> 1, 51), tuft = this.n.fbm(x * 4, z * 4, 2);
        if (tuft > 0.5 && blade < 0.55) return TP.grass[1 + Math.min(4, ((tuft - 0.5) * 9 + (py % 2 ? 0 : 1)) | 0)];
        if (gp < 0.64 && bd < 0.5) return TP.snow[2];
        return rampPick(TP.mud, 0.35 + tuft * 0.5, px, py, 0.3);
      }
      if (hash2(px, py, 11) < 0.006) return TP.snow[5];
      const pb = hash2(px >> 1, py >> 1, 12);
      if (pb < 0.0035) return (px + py) % 2 ? TP.cobble[3] : TP.cobble[1];
      // soft footprint-like dimples near the path
      return rampPick(TP.snow, v, px, py, 0.3);
    }
    forestFloor(x, z, px, py, layout) {
      const v = this.n.fbm(x * 1.2, z * 1.2, 4);
      const c = layout.chasmCenter(z) + 0.3 * Math.sin(z * 1.4);
      if (Math.abs(x - c) < 0.32 + (this.n2.fbm(x * 3, z * 3, 2) - 0.5) * 0.25) return rampPick(TP.ice, 0.45 + (v - 0.5), px, py, 0.3);
      if (hash2(px, py, 21) < 0.06) return TP.needle[(hash2(px, py, 22) * 3) | 0];
      return rampPick(TP.forest, v * 1.15 - 0.05, px, py, 0.35);
    }
    pathPx(x, z, px, py, bd, pm) {
      const n = this.n, n2 = this.n2;
      const cob = n2.fbm(x * 0.8, z * 0.8, 3);
      if (cob > 0.42 && pm > 0.55) {
        const S = 3.4, wx = x * S, wz = z * S * 1.15, e = 1 / (32 * 1.0);
        const [d1, d2, id] = n.worley(wx, wz);
        if (d2 - d1 < 0.11) return rampPick(TP.mud, 0.25 + hash2(px, py, 3) * 0.3, px, py, 0.5);
        const pal = id > 0.65 ? TP.cobbleWarm : TP.cobble;
        const idTL = n.worley(wx - e * S * 1.5, wz - e * S * 1.7)[2], idBR = n.worley(wx + e * S * 1.5, wz + e * S * 1.7)[2];
        let v = 0.35 + id * 0.35 - d1 * 0.25;
        if (idTL !== id) v += 0.35; else if (idBR !== id) v -= 0.3;
        if (n.fbm(x * 3, z * 3, 2) > 0.66) return rampPick(TP.snow, 0.55 + (v - 0.5) * 0.4, px, py, 0.3);
        return rampPick(pal, v, px, py, 0.25);
      }
      // mud with puddles, tracks and snow flecks
      const m = n.fbm(x * 2.2, z * 2.2, 3);
      if (m < 0.33) return rampPick(TP.ice, 0.18 + m * 0.6, px, py, 0.5);
      if (hash2(px, py, 31) < 0.03) return TP.snow[3];
      const track = Math.abs(Math.sin((x * 0.5 - z * 0.9) * 9)) < 0.08 ? -0.18 : 0;
      return rampPick(TP.mud, 0.25 + m * 0.75 + track, px, py, 0.3);
    }
    slatePx(x, z, px, py, bd, room) {
      const rh = 0.75, row = Math.floor((z - room.z0) / rh), lz = (z - room.z0) / rh - row;
      const off = (row % 2) * 0.5 + hash2(row, 1, 5) * 0.3, cw = 1.0;
      const col = Math.floor((x - room.x0 + off) / cw), lx = (x - room.x0 + off) / cw - col;
      const sid = hash2(col, row, 13);
      const drift = this.n2.fbm(x * 0.55 + 5, z * 0.55, 3);
      if (drift + (bd - 0.5) * 0.12 > 0.66) return null; // snow drift covers the floor here
      if (sid < 0.1) return rampPick(TP.mud, 0.2 + this.n.fbm(x * 4, z * 4, 2) * 0.8, px, py, 0.3); // missing slab
      const ex = 1 / 32 / cw, ez = 1 / 32 / rh;
      if (lx < ex || lz < ez) return TP.slate[0];
      let v = 0.32 + sid * 0.4 + (this.n.fbm(x * 2.5, z * 2.5, 3) - 0.5) * 0.35;
      if (lx < ex * 2 || lz < ez * 2) v += 0.28;
      else if (lx > 1 - ex * 1.5 || lz > 1 - ez * 1.5) v -= 0.25;
      if (sid > 0.75 && Math.abs(this.n.fbm(x * 1.7 + col, z * 1.7, 3) - 0.5) < 0.018) return TP.slate[0];
      if (drift > 0.6 && hash2(px, py, 41) < (drift - 0.6) * 9) return TP.snow[4];
      return rampPick(TP.slate, v, px, py, 0.28);
    }
    icePx(x, z, px, py, bd, im) {
      const n = this.n;
      if (im < 0.13) return rampPick(TP.snow, 0.85, px, py, 0.5);
      const [d1, d2] = n.worley(x * 1.6 + 30, z * 1.6);
      if (d2 - d1 < 0.04) return TP.ice[5];
      const streak = Math.sin((x * 1.0 + z * 0.6) * 7.0 + n.fbm(x, z, 2) * 3);
      let v = 0.3 + (n.fbm(x * 1.5, z * 1.5, 3) - 0.5) * 0.6 + im * 0.25;
      if (streak > 0.92) return TP.ice[6];
      if (streak > 0.75) v += 0.3;
      return rampPick(TP.ice, v, px, py, 0.35);
    }
    rockTopPx(x, z, px, py, bd) {
      const v = this.n2.fbm(x * 1.4, z * 1.4, 4);
      if (v < 0.36) return rampPick(TP.rock, 0.3 + v * 1.4, px, py, 0.28);
      if (v < 0.39 && bd < 0.5) return TP.snow[1];
      return this.snowPx(x, z, px, py, bd, 0.95);
    }

    /* ---------- cliff faces: u = along edge (8 units), v = depth below lip (10 units) ---------- */
    cliff(dark = false, ppu = 32) {
      const W = 8 * ppu, H = 10 * ppu, out = new PixelBuffer(W, H), n = this.n, n2 = this.n2;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const u = px / ppu, d = py / ppu, bd = bayer(px, py);
        // snow lip with drips
        const lip = 0.16 + hash2(px >> 1, 0, dark ? 3 : 4) * 0.12 + (hash2(px, 1, 9) < 0.07 ? 0.25 : 0);
        if (d < lip) { out.set(px, py, rampPick(TP.snow, 0.85 - d * 1.5, px, py, 0.25)); continue; }
        if (d < lip + 0.04) { out.set(px, py, (dark ? TP.rock : TP.cliff)[1]); continue; }
        let c;
        if (dark) {
          const strip = n.fbm(u * 3.5, d * 0.35, 3);
          const [d1, d2, id] = n2.worley(u * 1.4, d * 0.55);
          let v = 0.25 + strip * 0.55 + (id - 0.5) * 0.25;
          if (d2 - d1 < 0.06) v = 0.05;
          else if (n2.worley(u * 1.4 - 0.05, d * 0.55 - 0.03)[2] !== id) v += 0.3;
          c = rampPick(TP.rock, v, px, py, 0.3);
          if (n.fbm(u * 2, d * 2, 2) > 0.66 && hash2(px, py, 2) < 0.7) c = rampPick(TP.snow, 0.5, px, py, 0.3);
        } else {
          // horizontal strata bands, blocky fractured faces
          const band = d * 1.6 + n.fbm(u * 0.35, d * 0.2, 2) * 2.2;
          const bi = Math.floor(band), bf = band - bi;
          const warm = hash2(bi, 0, 17) > 0.62;
          const pal = warm ? TP.strataWarm : TP.cliff;
          const [d1, d2, id] = n2.worley(u * 1.1, band * 1.3);
          let v = 0.35 + (id - 0.5) * 0.35 + (n.fbm(u * 2.4, d * 2.4, 3) - 0.5) * 0.3;
          if (bf < 0.07) v = 0.02; // band crease
          else if (bf < 0.14) v += 0.38; // lit ledge just under the crease
          if (d2 - d1 < 0.05) v = 0.06;
          v -= Math.min(0.3, d * 0.035); // deeper = darker
          c = rampPick(pal, v, px, py, 0.3);
          if (bf < 0.14 && bf >= 0.07 && hash2(px, bi, 33) < 0.55) c = TP.snow[2 + ((bd * 2) | 0)];
          if (bf > 0.14 && bf < 0.4 && hash2(px >> 1, bi, 44) < 0.08) c = TP.ice[4 - Math.min(3, ((bf - 0.14) * 12) | 0)]; // icicles
          if (d > 6 && n.fbm(u * 1.5, d * 1.5, 2) > 0.6) c = rampPick(TP.moss, n.fbm(u * 5, d * 5, 2), px, py, 0.3);
        }
        out.set(px, py, c);
      }
      return out;
    }

    /* atlas of 4x4 irregular stone blocks, 16px each */
    stoneAtlas() {
      const T = 16, out = new PixelBuffer(T * 4, T * 4);
      for (let t = 0; t < 16; t++) {
        const ox = (t % 4) * T, oy = ((t / 4) | 0) * T, pal = t % 3 === 2 ? TP.stoneWarm : TP.stone;
        const base = 0.38 + hash2(t, 0, 1) * 0.25;
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          let v = base + (this.n.fbm((ox + x) * 0.3, (oy + y) * 0.3, 3) - 0.5) * 0.45;
          if (x === 0 || y === 0) v += 0.28; else if (x === T - 1 || y === T - 1) v = 0.05;
          else if (x === 1 || y === 1) v += 0.1;
          let c = rampPick(pal, v, x + ox, y + oy, 0.28);
          if (hash2(x + ox, y + oy, 5) < 0.04) c = pal[1];
          if (t % 5 === 1 && y > 11 && hash2(x, y, t) < 0.5) c = rampPick(TP.moss, 0.6, x, y, 0.5);
          if (t % 4 === 3 && Math.abs(x - 6 - (y >> 2)) < 0.6 && y > 3 && y < 13) c = pal[0];
          out.set(ox + x, oy + y, c);
        }
      }
      return out;
    }
    snowCap() {
      const out = new PixelBuffer(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let v = 0.6 + (this.n.fbm(x * 0.4, y * 0.4, 2) - 0.5) * 0.6;
        if (y > 12) v -= 0.25;
        out.set(x, y, hash2(x, y, 3) < 0.03 ? TP.snow[5] : rampPick(TP.snow, v, x, y, 0.3));
      }
      return out;
    }
    planks(w = 32, h = 32, crate = false) {
      const out = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const pl = Math.floor(y / 8), ly = y % 8;
        let v = 0.4 + hash2(pl, 0, 4) * 0.2 + Math.sin(x * 0.7 + pl * 3 + this.n.value(x * 0.3, pl) * 4) * 0.08;
        if (ly === 0) v = 0.02; else if (ly === 1) v += 0.25; else if (ly === 7) v -= 0.22;
        if (hash2(x >> 2, pl, 9) < 0.08 && ly > 2 && ly < 6) v -= 0.2;
        let c = rampPick(TP.wood, v, x, y, 0.25);
        if (crate) {
          const b = x < 3 || x > w - 4 || y < 3 || y > h - 4;
          const diag = Math.abs(x - y) < 2;
          if (b || diag) c = rampPick(TP.wood, 0.62 + ((x < 1 || y < 1) ? 0.2 : 0) - ((x > w - 2 || y > h - 2) ? 0.4 : 0), x, y, 0.5);
          if ((x === 1 || x === w - 2) && (y === 1 || y === h - 2)) c = TP.iron[5];
        } else if ((x === 3 || x === w - 4) && ly === 4) c = TP.iron[4];
        out.set(x, y, c);
      }
      return out;
    }
    bark(w = 16, h = 32) {
      const out = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = 0.42 + Math.sin(x * 1.7 + this.n.value(x * 0.5, y * 0.15) * 3) * 0.22 + (hash2(x, y >> 2, 3) - 0.5) * 0.2;
        out.set(x, y, rampPick(TP.bark, v, x, y, 0.25));
      }
      return out;
    }
    iron(w = 16, h = 16) {
      const out = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0.35 + (this.n.fbm(x * 0.5, y * 0.5, 2) - 0.5) * 0.4; if (y % 6 === 0) v = 0.6; if (y % 6 === 1) v = 0.12;
        out.set(x, y, rampPick(TP.iron, v, x, y, 0.25));
      }
      return out;
    }
    deck() {
      const out = new PixelBuffer(32, 32);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const sl = Math.floor(x / 16), lx = x % 16, row = Math.floor((y + sl * 5) / 11), ly = (y + sl * 5) % 11;
        let v = 0.35 + hash2(sl, row, 2) * 0.3 + (this.n.fbm(x * 0.3, y * 0.3, 2) - 0.5) * 0.3;
        if (lx === 0 || ly === 0) v = 0.03; else if (lx === 1 || ly === 1) v += 0.3; else if (lx === 15 || ly === 10) v -= 0.25;
        let c = rampPick(TP.stone, v, x, y, 0.25);
        if (this.n2.fbm(x * 0.12 + 3, y * 0.12, 2) > 0.64) c = rampPick(TP.snow, 0.55, x, y, 0.25);
        out.set(x, y, c);
      }
      return out;
    }
    /* pine tier texture: row 0 = cone base (flipY=false); u wraps around */
    pine() {
      const W = 32, H = 32, out = new PixelBuffer(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v0 = y / H;
        const clump = this.n.fbm(x * 0.35, y * 0.35, 3);
        const needle = hash2(x, y >> 1, 4);
        let v = 0.2 + clump * 0.5 + (needle - 0.5) * 0.35 + v0 * 0.15;
        let c = rampPick(TP.pine, v, x, y, 0.28);
        const snowy = this.n2.fbm(x * 0.28 + 4, y * 0.28, 3);
        if (snowy > 0.5 && hash2(x, y, 7) < 0.85) c = rampPick(TP.snow, 0.35 + (snowy - 0.5) * 2.5 + v0 * 0.2, x, y, 0.3);
        if (y < 2) c = snowy > 0.45 ? TP.snow[3] : TP.pine[0]; // drooping hem
        out.set(x, y, c);
      }
      return out;
    }
    fern() {
      const out = new PixelBuffer(16, 16);
      const fronds = [[8, 15, 2, 4], [8, 15, 14, 5], [8, 15, 5, 1], [8, 15, 11, 1], [8, 15, 8, 0]];
      fronds.forEach(([x0, y0, x1, y1], fi) => {
        const n = 16;
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = x0 + (x1 - x0) * t + Math.sin(t * 3) * (x1 > x0 ? -1 : 1), y = y0 + (y1 - y0) * t + t * t * 2;
          out.set(Math.round(x), Math.round(y), TP.fern[t < 0.3 ? 1 : 3]);
          if (i % 2 === 0 && t > 0.15) { out.set(Math.round(x) - 1, Math.round(y) + 1, TP.fern[2]); out.set(Math.round(x) + 1, Math.round(y) + 1, TP.fern[t > 0.7 ? 4 : 2]); }
          if (t > 0.8 && fi % 2 === 0) out.set(Math.round(x), Math.round(y) - 1, TP.snow[4]);
        }
      });
      return out;
    }
    banner() {
      const W = 16, H = 32, out = new PixelBuffer(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const tear = y > 24 && (hash2(x >> 1, 0, 6) * 8 + 24 < y);
        if (tear) continue;
        let v = 0.45 + Math.sin(x * 0.8) * 0.12 - y * 0.006;
        if (x === 0 || x === W - 1) v -= 0.3;
        let c = rampPick(TP.cloth, v, x, y, 0.25);
        // pale frost star sigil
        const cx = 8, cy = 12, dx = Math.abs(x - cx + 0.5), dy = Math.abs(y - cy);
        if ((dx < 1 && dy < 5) || (dy < 1 && dx < 4) || (dx < 1.6 && dy < 1.6)) c = TP.snow[dy < 2 && dx < 1.6 ? 5 : 4];
        if (y < 3) c = TP.cloth[1];
        out.set(x, y, c);
      }
      return out;
    }
    /* fire frames 16x24 (4 frames) + emissive */
    fire() {
      const frames = [];
      const pal = ramp('#5a1408', '#a3290c', '#e0561a', '#ff8f2e', '#ffc65a', '#fff2b8');
      for (let f = 0; f < 4; f++) {
        const out = new PixelBuffer(16, 24);
        for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
          const t = 1 - y / 24, cx = 8 + Math.sin(y * 0.5 + f * 1.6) * (1 - t) * 1.6;
          const w = 6.5 * Math.pow(t, 0.55) * (0.75 + 0.25 * Math.sin(f * 2 + y * 0.9));
          const d = Math.abs(x + 0.5 - cx) / Math.max(0.01, w);
          const flick = this.n.value(x * 0.5, y * 0.35 + f * 2.7);
          const v = (1 - d) * 1.05 + flick * 0.35 - (1 - t) * 0.55;
          if (v < 0.12) continue;
          out.set(x, y, rampPick(pal, Math.min(0.999, v * 0.95), x, y, 0.35));
        }
        frames.push(out);
      }
      return frames;
    }
  }
  Object.assign(K, { TP, TexturePainter });
})(typeof window !== 'undefined' ? window : globalThis);
